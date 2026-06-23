# Evolução PLM/PCP — 4 frentes industriais ✅ CONCLUÍDO

Status final: todas as 4 frentes implementadas, validadas (`tsc --noEmit` = 0 erros, `check-no-mocks` ok) e em produção. Findings de segurança relacionados também corrigidos.

---

## Frente 1 — BOM com consumo por tamanho ✅
- `tech_sheet_materials.consumption_by_size jsonb` (fallback para `consumption`)
- `src/lib/bom-explosion.functions.ts` + `src/lib/pcp-mrp.functions.ts` explodem por grade
- UI ficha técnica com mini-tabela "Consumo por tamanho"

## Frente 2 — MRP com lead time real ✅
- `inventory_items.lead_time_days`, `suppliers.default_lead_time_days`, `purchase_orders.suggested_order_date`
- `pcp-mrp.functions.ts` calcula `latestOrderDate` + `urgencia ∈ vencido|critico|atencao|ok`
- `pcp-mrp-panel.tsx` com coluna "Comprar até" + badge

## Frente 3 — Time & Action ✅
- Tabela `collection_milestones` (stage/planned/actual/responsável/status/sla)
- Trigger `collections_sync_milestone_actual` espelha mudanças de status
- `src/lib/collection-timeline.functions.ts` + rota `_app.time-and-action.tsx`
- Alertas integrados ao `alerts-panel`

## Frente 4 — Facção 360° ✅
- Colunas em `service_orders` (expected_return_date, qty_lost, qty_defect)
- `src/lib/facao-360.functions.ts` calcula KPIs (atrasadas, perda, defeito, lead time, ranking + IA)
- Rota `_app.faccoes.tsx` com cards + drawer de OS

---

## Segurança correlata ✅
- `production_order_comments_cross_tenant_insert` — política permissiva removida
- `supplier_portal_tokens_hash_readable` — SELECT da coluna `token_hash` revogado de `authenticated`/`anon`
