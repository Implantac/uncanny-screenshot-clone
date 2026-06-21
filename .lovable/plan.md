# Evolução Enterprise — Fases 5, 6, 8 e 9

Princípio: **uma fase por turno**, sempre evoluindo o que já existe. Cada fase é fechada antes de abrir a próxima, com server fn + painel + auditoria + IA contextual quando fizer sentido.

---

## Turno 1 — Fase 5 · Almoxarifado FEFO + Scraps

Hoje o almoxarifado tem ponto de reposição dinâmico (passo anterior) mas não controla lote/validade nem registra perda.

**Banco**
- `inventory_lots` (novo): `inventory_item_id`, `lot_code`, `quantity`, `expires_at`, `received_at`, `status` (ativo/esgotado/descartado), `notes`.
- `inventory_scraps` (novo): `inventory_item_id`, `lot_id?`, `quantity`, `reason` (vencimento/avaria/qualidade/sobra-corte/outros), `cost_value`, `production_order_id?`, `notes`.
- `stock_movements.lot_id` (FK opcional) — para amarrar saída/entrada ao lote.
- Trigger: ao consumir saída, sugerir/descontar do **lote com `expires_at` mais próximo** (FEFO). Se `lot_id` vier explícito, respeita.
- GRANTs + RLS por `owner_id` no padrão dos outros itens.

**Server fns** (`src/lib/inventory-fefo.functions.ts`)
- `getItemLots(itemId)` — lotes ativos ordenados por validade.
- `registerLotEntry(...)` — registra entrada com lote+validade (cria lote + stock_movement).
- `registerScrap(...)` — baixa de estoque tipada como perda + custo agregado.
- `getScrapsSummary(window)` — perda 30/90d por motivo, top SKUs, valor total.

**UI**
- `InventoryLotBreakdown` (existe) — passar a renderizar lotes reais com badge "vence em Xd".
- Novo `InventoryScrapsPanel` na tela `_app.almoxarifado.tsx` — botão "Registrar perda", lista das últimas, mini Pareto por motivo.
- Card de "vencimento próximo" no topo (lotes com <15d).

---

## Turno 2 — Fase 6 · Desenvolvimento (Gates + Handoff Timeline)

Hoje protótipos já têm aprovação simples; falta gate explícito por etapa e visão de handoff entre áreas.

**Banco**
- `prototype_gates` (novo): `prototype_id`, `gate` (conceito/modelagem/ficha/piloto/aprovação), `status` (pendente/aprovado/reprovado), `approver_id`, `decided_at`, `notes`.
- Trigger: ao aprovar gate "aprovação", atualizar `prototypes.stage = 'aprovado'` (reaproveita automação existente que gera OP).
- `prototype_handoff_events` (novo): `prototype_id`, `from_sector`, `to_sector`, `event` (entrega/devolução), `actor_id`, `notes`.

**Server fns** (`src/lib/prototype-gates.functions.ts`)
- `getGates(prototypeId)`, `decideGate(...)`, `getHandoffTimeline(prototypeId)`.

**UI**
- `PrototypeGatesPanel` no drawer de protótipo — 5 selos sequenciais, cada um clicável para aprovar/reprovar.
- `PrototypeHandoffTimeline` — linha do tempo das passagens entre setores (reaproveita estilo de `prototype-timeline`).

---

## Turno 3 — Fase 8 · IA Contextual por Persona

Hoje há vários painéis de IA pontuais. Falta um **núcleo** que entende quem está olhando e dá insight explicado.

**Server fn** (`src/lib/ai-persona-insights.functions.ts`)
- `getPersonaInsights({ persona })` onde persona ∈ `coord-dev | pcp | marketing | qualidade`.
- Cada persona puxa 3-5 sinais cruzados do banco (ex.: PCP → atrasos > capacidade célula × FPY semanal × CAPA aberto crítico).
- Envia pro Lovable AI Gateway com prompt fixo: "explique em 2 frases por que isso importa e qual a próxima ação".
- Retorna `{ signal, evidence, why, nextAction, severity }[]`.

**UI**
- Componente `<PersonaInsightsPanel persona="..." />` — card list compacto, cada item com badge de severidade, evidência (números reais), motivo, botão "fazer agora" (link contextual).
- Plugar no topo das telas correspondentes (Desenvolvimento, PCP, Marketing, Qualidade).

---

## Turno 4 — Fase 9 · Executive Dashboard Cruzado

`executive-kpis-panel` já existe mas isolado. Vamos transformar em uma **tela executiva** que cruza dimensões.

**Server fn** (`src/lib/executive-cross-kpis.functions.ts`)
- `getCrossKPIs(window)` retornando matriz: por **coleção** × { FPY %, custo real vs alvo %, OTD %, markdown %, sell-through % do ERP }.
- Top 5 "produtos no vermelho" (≥2 KPIs ruins) e top 5 "estrela" (≥3 KPIs verdes).

**UI**
- Nova rota `/executivo` (ou consolida com dashboard existente se for o caso).
- Tabela cruzada coleção×KPI com semáforo, drilldown clicando na célula.
- Painel "vital few" do mês com insight IA explicando o que mudou vs mês anterior.

---

## Regras transversais (todos os turnos)

- Reutilizar componentes (`Card`, `Badge`, `Tabs`, painéis existentes) — zero design novo gratuito.
- Toda nova tabela: GRANTs + RLS `owner_id = auth.uid()` + log de auditoria via `log_audit()`.
- Toda server fn protegida: `requireSupabaseAuth`.
- Nada de financeiro/fiscal/vendas — quando precisar de venda, lê de `erp_sales_mirror`.
- Cada turno termina com a tela acessível pelo menu da área correspondente.

---

## Fora deste plano (avisos)

- **Finding aberto** `audit_logs_admin_cross_tenant_read` (admin lê logs cross-tenant) — corrijo num turno separado se você confirmar.
- Edição dos campos novos do almoxarifado (`preferred_supplier_id`, `safety_days`) no form de SKU — pequeno, faço junto do turno 1 se quiser.

Confirma que ataco o **Turno 1 (Fase 5 — FEFO + Scraps)** agora?
