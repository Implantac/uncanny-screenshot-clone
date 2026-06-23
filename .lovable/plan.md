# Evolução PLM/PCP — 4 frentes industriais

Implementação em ordem de dependência. Cada frente reutiliza tabelas existentes; só adiciono colunas/tabelas onde realmente falta. Zero mock — tudo lê dados reais.

---

## Frente 1 — BOM com consumo por tamanho (base das outras)

**Por quê primeiro:** MRP, T&A e Facção dependem da explosão correta por grade.

**Schema (migration):**
- `tech_sheet_materials.consumption_by_size jsonb` — `{ "P": 1.2, "M": 1.35, "G": 1.5, "GG": 1.7 }`. Quando preenchido, sobrepõe `consumption` (média). Quando vazio, mantém comportamento atual.
- Sem breaking change: `consumption` continua sendo o fallback/média.

**Código:**
- `src/lib/bom-explosion.functions.ts` — para cada material com `consumption_by_size`, multiplicar pela `production_order_grid.quantity` agrupada por `size`, não pelo total bruto.
- `src/lib/pcp-mrp.functions.ts` — mesma lógica na explosão MRP.
- UI: editor da ficha técnica ganha mini-tabela "Consumo por tamanho" (opcional) ao lado do consumo padrão.

---

## Frente 2 — MRP com lead time real e data-alvo de compra

**Schema (migration):**
- `inventory_items.lead_time_days int` (default 7)
- `suppliers.default_lead_time_days int` (default 15)
- `purchase_orders.suggested_order_date date` (calculada, não obrigatória)

**Código (`pcp-mrp.functions.ts`):**
- Para cada material em déficit, achar `due_date` mínimo das OPs contribuintes.
- `latestOrderDate = min(opDueDate - leadTime - safetyDays)` — onde `leadTime = inventory_items.lead_time_days ?? supplier.default_lead_time_days`.
- Status novo: `urgencia` ∈ `vencido | critico (≤3d) | atencao (≤7d) | ok`.
- Retornar `latestOrderDate` e `urgencia` em cada item.
- UI `pcp-mrp-panel.tsx`: coluna "Comprar até" + badge de urgência, ordenação default por `urgencia desc`.

---

## Frente 3 — Time & Action (cronograma de coleção)

**Schema (migration):**
- Nova tabela `collection_milestones`:
  - `collection_id`, `stage` (enum: `briefing|moodboard|tech_pack|piloto|aprovacao|producao|lancamento`), `planned_date`, `actual_date`, `responsible_user_id`, `status` (`pendente|em_andamento|concluido|atrasado`), `sla_days`, `notes`.
- GRANT + RLS por `owner_id` (via `collection.owner_id`).
- Trigger: ao mudar `collections.status`, marca `actual_date` do milestone correspondente.
- Função auxiliar para gerar template padrão de 7 milestones ao criar coleção (sem seed — só roda quando user criar coleção real).

**Código:**
- `src/lib/collection-timeline.functions.ts` — `listMilestones`, `upsertMilestone`, `markDone`.
- UI: nova aba "Time & Action" dentro da rota de coleção, timeline horizontal com dias de gap real × planejado, badge de atraso, link pro responsável.
- Alertas: integrar no `alerts-panel` existente (milestones atrasados).

---

## Frente 4 — Facção 360°

**Reuso:** `service_orders`, `service_order_grid`, `production_occurrences`, `suppliers`.

**Schema (migration mínima):**
- `service_orders.expected_return_date date` (se não existir)
- `service_orders.qty_lost int default 0`, `qty_defect int default 0` (se não existir — verificar)
- View materializada NÃO — calcular em server fn pra refletir tempo real.

**Código:**
- `src/lib/facao-360.functions.ts` — para cada facção (supplier com capability=costura/acabamento):
  - OS abertas, em trânsito, atrasadas (`expected_return_date < today AND status != recebida`)
  - Total enviado vs recebido (últimos 90d)
  - Índice de perda = `sum(qty_lost) / sum(quantity)`
  - Índice de defeito = `sum(qty_defect + production_occurrences.severity=alta) / sum(qty_received)`
  - Lead time médio real = `avg(received_at - sent_at)`
  - Ranking + sugestão IA (reutiliza `ai-reason.ts`)
- UI: nova rota `_app.faccoes.tsx` — cards por facção com KPIs, drawer com histórico de OS, ações "Nova OS" e "Cobrar retorno".

---

## Ordem de execução

1. Migration única consolidada (todas as colunas + tabela `collection_milestones` + GRANTs + RLS + trigger).
2. Frente 1 (BOM por tamanho) — backend + UI ficha técnica.
3. Frente 2 (MRP lead time) — backend + UI painel MRP.
4. Frente 3 (T&A) — backend + UI timeline.
5. Frente 4 (Facção 360°) — backend + UI rota.
6. Rodar `npm run check:no-mocks` e validar build a cada frente.

## Detalhes técnicos

- Todas as server fns com `requireSupabaseAuth` + filtro por `owner_id`.
- Migrations seguem ordem: CREATE → GRANT → RLS → POLICY.
- Triggers em `SECURITY DEFINER` + `SET search_path = public`.
- Sem dados seed — telas vazias mostram empty state com CTA real.
- Tipos Supabase regenerados após cada migration aprovada.

Aprovar para começar pela migration consolidada?
