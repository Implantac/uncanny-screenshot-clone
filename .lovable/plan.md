# Evolução — Acompanhamento de Produção

Princípio: **evoluir, não reconstruir**. Reaproveito tudo que já existe (KPIs, kanban, SLA, insights, drawer de histórico, `moveOrderToColumn`, `predictDelays`, `production_occurrences`) e adiciono camadas em cima. Nada de tela nova, nada de dado financeiro.

---

## Frente 1 — Ações de chão de fábrica no próprio card (1-2 cliques)

Hoje o card só permite arrastar. Vou adicionar um **menu de ação rápida** (ícone `⋯` no canto do card → `DropdownMenu` shadcn):

- **Apontar produção parcial** — popover com input de quantidade + slider de %, grava em `production_orders.progress` e gera linha em `production_stage_log` com `is_partial=true` e `quantity`. Atalho: clicar na barra de progresso abre direto.
- **Registrar ocorrência** — abre o componente existente `production-occurrence.tsx` em um `Sheet` lateral pré-preenchido com a OP (tipos: parada, refugo, retrabalho, falta de insumo). Usa tabela `production_occurrences`.
- **Mover para próxima etapa** — botão "Avançar →" calcula próxima coluna válida (mesmo mapa do `COL_MAP`) e chama `moveOrderToColumn`. Elimina o drag para o caso comum.
- **Adicionar nota rápida** — textarea inline, persiste em `production_order_comments` (tabela já existe).
- **Abrir tech sheet / ficha** — atalho para `production-tech-sheet-drawer.tsx` (já existe).

Tudo sem sair da tela, sem modal cheio de campo. Toast de confirmação + invalidação da query.

## Frente 2 — Inteligência preditiva embarcada

`src/lib/delay-prediction.functions.ts` já calcula ETA e risco por OP — hoje só aparece em painel separado. Vou:

- **Pré-carregar `predictDelays` no loader** (via `useQuery`, cache 5 min) e indexar por `orderId`.
- **Badge de risco no card** — pontinho colorido (verde/âmbar/vermelho) + tooltip com `reason` ("parada há 4d em costura, média 2d · previsão 36h após o prazo").
- **ETA no cabeçalho de cada coluna** — quantos lotes vão estourar prazo se ficarem no ritmo atual.
- **Alerta de SLA estourado em tempo real** — comparar `stage_updated_at` com `SLA_HOURS` (já existe); card ganha borda vermelha pulsante quando passa do alvo. Aproveita lógica do `slaBySetor`.
- **Painel "Insights do PCP" enriquecido** — sugestões de balanceamento usam dados reais de `predictDelays`, não só contagem. Ex.: "Costura Externa com 5 OPs prevendo atraso ≥48h — redistribuir 2 para fornecedor X que tem folga de 60h".

## Frente 3 — Densidade e UX do kanban

- **Card compacto** — thumb do produto (40px), SKU + qtd, barra de progresso real (`progress%` da meta), badge de status, ícone do terceiro se externa. Hoje o card tem texto demais.
- **Swimlanes opcionais** — toggle no header: "Agrupar por: nenhum / coleção / terceiro / linha". Renderiza faixas horizontais dentro de cada coluna. Reaproveita os campos já carregados.
- **Modo painel de fábrica (TV)** — botão fullscreen: esconde filtros, aumenta fonte, oculta colunas vazias, auto-refresh a cada 30s via realtime (`useRealtime("production_orders", ...)` já existe como hook). Ideal pra TV no chão de fábrica.
- **Realtime sempre on** — subscrever `production_orders` + `production_stage_log` e invalidar query. Hoje só atualiza quando o usuário mexe.
- **Contadores de coluna mais úteis** — além de "X lotes · Y peças", mostrar quantos estão atrasados na própria coluna.

## Frente 4 — Filtros, presets e URL

- **Sincronizar filtros com search params** (zod + `validateSearch`) — todos os 12 filtros viram URL state. Permite compartilhar link "minha visão do PCP hoje". Sem novas dependências (`@tanstack/zod-adapter` já no stack TanStack).
- **Presets salvos por usuário** — botão "Salvar visão atual" → persiste em uma nova tabela `user_view_presets` (id, user_id, module='acompanhamento_producao', name, filters jsonb). RLS por `user_id`. Dropdown "Minhas visões" no header com presets prontos do sistema: "Meus atrasados", "Entrega esta semana", "Externa em risco", "Aguardando há +3 dias".
- **Busca por terceiro** já existe; adiciono busca por nome do operador/responsável da última passagem (vem de `production_stage_log.note` ou de coluna `assignee` se houver — se não houver, omito).

---

## Tecnicamente

**Arquivos editados (sem rewrite):**
- `src/routes/_authenticated/_app.acompanhamento-producao.tsx` — adicionar menu do card, swimlanes, modo TV, integração com `predictDelays`, URL state, dropdown de presets.

**Arquivos novos:**
- `src/components/production-card-actions.tsx` — DropdownMenu + popovers de apontamento/nota.
- `src/lib/view-presets.functions.ts` — server fns CRUD com `requireSupabaseAuth`.

**Migração (1 só):**
- Tabela `user_view_presets` com RLS por `user_id`, GRANT padrão, trigger `updated_at`.

**Sem mexer em:**
- `production-tracking.functions.ts`, `delay-prediction.functions.ts`, `production-occurrence.tsx`, hooks existentes — só consumir.

---

## Filtros aplicados (regra de ouro)

- ✅ Reutiliza: `moveOrderToColumn`, `predictDelays`, `production-occurrence`, `useRealtime`, `SLA_HOURS`, `STATUS_META`, drawer de histórico.
- ✅ Agrega valor: cada ação é 1-2 cliques, predição vira ação, modo TV é caso de uso real do chão de fábrica.
- ❌ Não duplica: nada que já exista em outra tela.
- ❌ Não vira ERP: zero campo financeiro/fiscal.

---

## Ordem de implementação

1. **Frente 1** (ações no card) + **Frente 3** parcial (card compacto) — maior impacto operacional, é o que o usuário do chão sente.
2. **Frente 2** (predição embarcada + realtime + SLA pulsante).
3. **Frente 3** restante (swimlanes + modo TV).
4. **Frente 4** (URL state + presets, exige migração).

Confirma o plano ou ajusto o escopo de alguma frente?
