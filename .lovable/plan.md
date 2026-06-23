# Protótipos & Coleções 360° — Fechar o ciclo

A auditoria mostrou que **tudo existe** (12 painéis ricos, kanban, gates, handoff, carry-over, assortment, moodboard, war room, milestones). O problema é **fragmentação**: metade dos painéis vive em `colecoes.tsx`, outros em `marketing.tsx` / `quality.tsx`, e a rota `colecao-360` não tem ID na URL nem realtime de protótipos. O ciclo Briefing → Protótipo → OP → Lançamento → Sell-through → Carry-over nunca fecha numa tela só.

Este plano **não cria features novas** — só conecta as existentes. Zero duplicação, zero mock, preserva todas as rotas atuais.

---

## Frente única — 7 ajustes cirúrgicos

### 1. `colecao-360` ganha `:id` na URL
- Rota vira `/colecao-360/$id` (mantém `/colecao-360` como redirect para a coleção mais recente).
- Substitui o `useState` local pelo param da URL.
- Habilita deep-link de notificações, war room, protótipo, etc.

### 2. Botão "Ver Coleção 360°" no detalhe do protótipo
- Em `_app.prototipo.$id.tsx` (header, ao lado de "← Protótipos"), adicionar CTA que navega para `/colecao-360/$id` usando `proto.products?.collection_id`.
- Fluxo inverso passa a existir.

### 3. Filtro `collectionId` em `_app.prototipos.tsx`
- Adicionar `collectionId` ao search schema (querystring).
- Aplicar no `filtered` memo.
- Pipeline de protótipos em `colecao-360` passa a linkar `/prototipos?collectionId=...`.
- Banner "Filtrando por coleção X · limpar".

### 4. Realtime de protótipos em `colecao-360`
- Adicionar `useRealtime("prototypes", ["colecao-360", id])` ao lado do existente de `production_orders`.
- KPI `semPiloto` e pipeline atualizam ao vivo quando gate é aprovado.

### 5. Plugar painéis existentes na rota 360° (sem duplicar)
Importar em `_app.colecao-360.$id.tsx`, passando `collectionId`:
- `CollectionIntelligencePanel` — na aba Visão 360°
- `LaunchingWeekPanel` — na aba Visão 360° (semana de lançamento)
- `QualityCollectionsBridgePanel` — na aba Visão 360°
- `MarketingBriefStudio` — nova aba "Marketing" (passar `collectionId`)
- `CarryOverPanel` — nova aba "Carry-over"
- `AssortmentPanel` + `ChannelMixPanel` — nova aba "Assortment & Mix"
- `CollectionMoodboard` — nova aba "Moodboard"

Tabs resultantes: **Visão 360° · Time & Action · Moodboard · Assortment · Marketing · Carry-over**.

> Se algum painel não aceita `collectionId` como prop hoje, adicionar a prop (opcional) e usar como filtro — mantém todos os call sites atuais funcionando.

### 6. Sell-through fecha o loop → CTA Carry-over
- No card KPI Sell-through (`colecao-360`), adicionar botão "Decidir carry-over" que muda para a aba Carry-over da mesma coleção.

### 7. Corrigir shortcut ABC + adicionar shortcuts cruzados
- Trocar shortcut "Rentabilidade" para apontar `/abc-colecao?collectionId=...` (atualmente vai para `/profitability`).
- Adicionar shortcut "War Room" e "Ficha Técnica das peças da coleção".

---

## Detalhes técnicos

**Rota nova:** `src/routes/_authenticated/_app.colecao-360.$id.tsx` (renomear o arquivo atual; manter `_app.colecao-360.tsx` como redirect para `/colecao-360/$lastId` ou para `/colecoes` se não houver).

**Querystring filter no Tanstack Router:**
```ts
validateSearch: z.object({
  collectionId: z.string().uuid().optional(),
})
```

**Realtime adicional:**
```ts
useRealtime("prototypes", ["colecao-360", id]);
useRealtime("prototype_gates", ["colecao-360", id]);
```

**Props opcionais nos painéis** (`CollectionIntelligencePanel`, `MarketingBriefStudio`, `LaunchingWeekPanel`, `QualityCollectionsBridgePanel`): adicionar `collectionId?: string` quando ausente. Default = comportamento atual (todas as coleções). Quando passado = filtra. Zero breaking change.

**Sem migration** — só código. As tabelas `prototypes`, `collections`, `collection_milestones`, `carry_over_decisions`, etc. já têm tudo necessário.

**Validações finais:**
- `bunx tsc --noEmit` = 0 erros
- `npm run check:no-mocks` ok
- Smoke manual via Playwright: navegar protótipo → 360° → carry-over → voltar.

---

Aprovar para começar?
