# Revisão Geral — USE MODA PLM

_Auditoria executada em 20/06/2026 cobrindo Segurança/RLS, Funcionalidades end-to-end, UX/consistência visual e Performance/qualidade de código. Achados agrupados por severidade e área. **Nenhum código foi alterado nesta passada.**_

---

## 🚨 Prioridade 0 — Críticos (resolver antes de qualquer feature nova)

| # | Onde | Problema | Fix |
|---|---|---|---|
| C1 | `src/lib/agents.functions.ts:79` | `runAgent` ignora `userId` e busca o agente sem `eq("owner_id", …)`. **Um usuário autenticado pode executar agente de outro tenant** se souber o UUID. | Adicionar `.eq("owner_id", userId)` antes do `.single()`. |
| C2 | `src/lib/agents.functions.ts:28–31` | Contexto do agente (`products`, `production_orders`, `sales`) montado sem filtro por tenant — dados de outros clientes vazam no prompt da IA. | Aplicar `.eq("owner_id", userId)` nas 3 sub-queries. |
| C3 | `src/routes/api.public.agents.run-due.ts` | Endpoint de cron autentica via `SUPABASE_PUBLISHABLE_KEY` no header — **chave publishable é pública**, qualquer pessoa que inspecionar o JS dispara todos os agentes. | Criar secret `CRON_SECRET` e comparar com header `x-cron-secret`. |
| C4 | `src/routes/api/public/supplier-portal.$token.ts` | Sem rate limit no endpoint público de token. Permite brute-force mesmo com hash SHA-256. | Rate limit por IP (5 req/min) + bloqueio após N falhas. |
| C5 | `src/hooks/use-role.ts` (uso geral) | RBAC só no client. Server fns sensíveis (ex.: `team.functions.ts`) precisam revalidar role server-side via `has_role()`. | Em toda fn que muta dado administrativo, chamar `supabase.rpc('has_role', {_user_id: userId, _role: 'admin'})` antes da operação. |
| C6 | **TanStack Query sem `staleTime` global** | 293 `useQuery`, apenas 7 com `staleTime`. Cada `window focus` revalida tudo. | Em `src/router.tsx`, `new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 5*60_000, retry: 1 } } })`. **Maior ROI da auditoria.** |

### Findings do scanner (banner More) — análise rápida

- **`supplier_portal_tokens.token_hash`**: já é SHA-256 (confirmado em `api/public/supplier-portal.$token.ts`). ⚠️ Apenas ignorar com explicação se quiser limpar o alerta.
- **`dpp_views` sem `owner_id`**: by design — gravação só via service role do endpoint `/dpp/$id`. Aceitável; documentar.
- **`prototype_comments` INSERT com `owner_id = auth.uid()`**: bloqueia colaboração entre membros do mesmo tenant. Trocar `WITH CHECK` por verificação de tenancy compartilhada (ou remover constraint de owner_id e manter só `author_id = auth.uid()`).

---

## 🔴 Prioridade 1 — Alta

### Segurança / Dados
- **S1** `_authenticated/route.tsx` é `ssr:false`. Ok para o template Lovable, mas rotas administrativas (`/equipe`, `/security-center`) **não checam role no `beforeLoad`** — qualquer designer acessa via URL direta. → adicionar gate por role.
- **S2** `supplier-portal.$token.ts` upload: `rfqId`/`orderId` não validados como UUID → 500 silencioso. → `z.string().uuid()`.
- **S3** `supplier_portal_acks` sem dedup → duplo-clique cria 2 acks. → `UNIQUE(production_order_id, decision)`.
- **S4** `dpp.$id.tsx` e `trust.tsx` públicos — confirmar que **não vazam** `owner_id`, custos, fornecedores.

### Performance
- **P1** `_app.intelligence.tsx:156–194` faz `select('*')` em 6 tabelas pesadas simultaneamente. → projetar colunas, agrupar em server fn.
- **P2** `_app.intelligence.tsx` (2.171 linhas) e `_app.colecoes.tsx` (2.180 linhas) — quebrar em subcomponentes por aba.
- **P3** 165 ocorrências de `: any` em `src/lib/` (`ai-insights`, `marketing-ai`, etc.) — usar tipos gerados em `integrations/supabase/types.ts`.
- **P4** `(supabase as any).from("sales" | "influencers")` em intelligence — tipos desatualizados. → regenerar `types.ts`.

### UX (vazamento / acessibilidade)
- **U1** Kanban PCP (`_app.pcp-kanban.tsx:297`) — `xl:grid-cols-7` sem `overflow-x-auto`. Quebra em laptops 1024–1280px.
- **U2** Vários `<Button size="icon">` em ações destrutivas **sem `aria-label`**: `_app.variantes.tsx:390`, `_app.pcp.tsx:855/858`, `_app.inspecoes.tsx:180`, `_app.comercial.tsx:275/278`, `_app.intelligence.tsx:1610/1613`, `_app.fit-sessions.tsx:252`. → adicionar `aria-label` descritivo (10 ocorrências).
- **U3** Cores hardcoded fora do token system: `_app.closed-loop.tsx`, `_app.approvals.tsx`, `_app.marketing.tsx:1045/1049`, `war-room-panel.tsx`, `executive-kpis-panel.tsx:128`. → trocar por `text-success`, `text-destructive`, `text-warning`.

---

## 🟡 Prioridade 2 — Média

### Funcionalidades
- `hooks/use-realtime.ts:12` — canal com `Math.random()` no nome + `queryKey` não está nas deps. Subscriptions ficam dessincronizadas quando a key muda.
- `auth-middleware.ts:10–13` — variáveis ausentes geram 500 cru; retornar 503 JSON.
- Confirmar que `auto-refresh token` está ligado no client (já está em `integrations/supabase/client.ts`).
- 63 das 130 server fns sem `inputValidator` Zod — adicionar pelo menos nas que recebem IDs.

### Performance
- `_app.pcp.tsx`, `_app.lotes.tsx`, `_app.almoxarifado.tsx`, `_app.produtos.tsx` — todos usam `select('*')` em tabelas grandes. Projetar campos e usar `staleTime` (resolvido em parte por **C6**).
- `_app.colecoes.tsx:475` — join `bom + inventory_items` sem filtro de `tech_sheet_id` → N+? rows.
- `_app.produtos.tsx:228` — `useEffect` redundante para `setSelectedId(filtered[0]?.id)` → calcular no próprio `useMemo`.
- Handlers inline em forms grandes (`_app.intelligence.tsx`) → memoizar com `useCallback` ou isolar form.

### UX
- Grids fixos sem responsivo: `_app.dev-kanban.tsx:126` (`grid-cols-3`), `_app.trends.tsx:196` (`grid-cols-8`), `_app.lote.$id.tsx:412` (`grid-cols-5`).
- Duplicação: `production-order-comments.tsx` ≅ `prototype-comments.tsx` (~170 LOC). Extrair `<CommentsPanel/>`.
- Constante `SEV_BADGE` duplicada em `war-room-panel.tsx` e `push-history-panel.tsx` → mover para `lib/severity-styles.ts`.

---

## 🟢 Prioridade 3 — Baixa

- `use-auth.ts` chama `onAuthStateChange` antes de `getSession` → flash de loading.
- `use-role.ts` sem context → re-fetch por componente.
- `bg-white` hardcoded no `lote-qr-button.tsx` — intencional (QR exige fundo branco), apenas comentar.
- `_app.trends.tsx:203` `text-white/80` sobre cores claras some — calcular contraste ou `mix-blend-difference`.
- Nenhum `console.log` esquecido. ✅
- Nenhum `TODO/FIXME` no fonte. ✅
- Todos os 79 slugs de `lib/modules.ts` têm rota correspondente. ✅

---

## 📊 Indicadores numéricos

| Métrica | Valor |
|---|---|
| Linhas totais em `src/` | 54.204 |
| Rotas autenticadas | 79 |
| Arquivos `.functions.ts` | 43 (≈ 130 fns) |
| `useQuery` no projeto | 293 (apenas **7** com `staleTime`) |
| `: any` em `src/lib/` | 165 |
| `aria-label` faltando em ações destrutivas | 10 |
| Cores hardcoded fora dos tokens | 7+ |
| Tabelas sem RLS | 0 ✅ (todas com RLS habilitado) |
| GRANTs faltando | 0 ✅ |

---

## 🎯 Plano de ataque sugerido (ordem)

1. **Hoje (1–2h):** C1, C2, C3 + finding `prototype_comments` (migration única).
2. **Esta semana:** C4 (rate limit), C5 (RBAC server-side em fns admin), C6 (staleTime global — 1 linha).
3. **Próxima onda:** S1–S4 + U2 (aria-labels) + U3 (tokens de cor) — todos low-risk e high-impact.
4. **Refactor:** P1, P2 (quebrar intelligence + coleções) e remover `: any` em lib/.
5. **Polimento:** prioridade 2 e 3.

Posso atacar qualquer um destes pontos quando você der o go — recomendo começar pelos C1–C3 (vazamento de tenant) e C6 (1 linha que tira ~80% dos refetches desnecessários).
