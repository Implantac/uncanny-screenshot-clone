# Auditoria Enterprise — Gap Matrix (13 Fases)

> Cruzamento do **Prompt Supremo Unificado v3.0** com o estado real do USE MODA PLM.
> Stack alvo do prompt: Laravel/Vue/MySQL → **stack real: TanStack Start + Supabase**.
> Itens marcados ⚠️ "stack-mismatch" são sugestões do prompt incompatíveis com a stack real e foram traduzidas para o equivalente Postgres/RLS/serverFn.
>
> Legenda: ✅ feito · ⚠️ parcial / precisa polir · ❌ falta · 🚫 fora de escopo (ERP, vendas/fiscal — não construir aqui)

---

## Fase 1 — BOM & Rastreabilidade

| Item | Status | Onde está | Recomendação (1 linha) |
|---|---|---|---|
| BOM versionada por ficha técnica | ✅ | `tech_sheets`, `tech_sheet_versions`, `tech_sheet_materials` | OK — versões já existem com snapshot. |
| Custo recalculado por trigger | ✅ | `tech_sheets_recompute_costs` / `tech_sheets_overhead_recompute` | OK — propaga p/ `products.cost_price`. |
| Templates de BOM (reuso) | ✅ | `bom_templates`, `bom-templates-button.tsx` | OK. |
| Rastreabilidade lote → OP → ficha → fornecedor | ✅ | `production_batches`, `production_stage_log`, `traceability.functions.ts` | OK — drawer `lote-references-drawer` já cobre. |
| DPP (Digital Product Passport) público | ✅ | `dpp_records`, `routes/dpp.$id.tsx` | OK. |
| Aprovação eletrônica da ficha (assinatura/quem aprovou) | ⚠️ | `tech_sheets.status='aprovada'` muda mas não registra aprovador | Adicionar `approved_by`, `approved_at` em `tech_sheets` + audit. |
| Comparar duas versões lado-a-lado | ⚠️ | `tech-sheet-versions-drawer` lista mas não faz diff | Adicionar diff materials/operations. |

## Fase 2 — Custo & Variância

| Item | Status | Onde está | Recomendação |
|---|---|---|---|
| Custo padrão vs realizado | ✅ | `cost-variance-panel`, `cost-variance.functions.ts` | OK. |
| Alertas de custo > meta | ✅ | `tech-sheet-cost-alerts-panel` + `product_target_costs` | OK. |
| Cost Watch (variação de matéria-prima) | ✅ | `cost-watch-panel` | OK. |
| Margem por produto (preço-venda/custo) | ⚠️ | `products.price` existe, mas não há painel margem | Painel margem só se ERP enviar preço — senão, **🚫 ERP**. |

## Fase 3 — PCP & Capacidade

| Item | Status | Onde está | Recomendação |
|---|---|---|---|
| Kanban por estágio configurável | ✅ | `pcp_stages`, `_app.pcp-kanban.tsx` | OK. |
| OS / passagens entre setores | ✅ | `service_orders` + trigger `service_orders_on_received` | OK. |
| Capacidade por fornecedor + simulador | ✅ | `supplier_capacity`, `capacity-simulator` | OK. |
| MRP (explosão de necessidade) | ✅ | `pcp-mrp.functions.ts`, `pcp-mrp-panel` | OK. |
| Previsão de atraso (IA) | ✅ | `delay-prediction-panel` | OK. |
| TOC / gargalo (capacity vs demand) | ✅ | `pcp-capacity-toc-panel` (recente) | OK. |
| Eficiência por célula / SAM | ✅ | `cell-efficiency-panel`, `sam-efficiency-panel` | OK. |
| Sequenciamento (APS) inteligente | ❌ | — | Adicionar ordenação sugerida por due_date × setup × família. |
| Recomendação automática de fornecedor | ✅ | `supplier-recommender` | OK. |

## Fase 4 — Qualidade & CAPA

| Item | Status | Onde está | Recomendação |
|---|---|---|---|
| Inspeções + FPY | ✅ | `quality_inspections`, `quality-fpy-panel` | OK. |
| Pareto de defeitos | ✅ | `quality-pareto-panel` | OK. |
| CoNQ (custo da não-qualidade) | ✅ | `quality-conq-panel` | OK. |
| CAPA manual + auto por inspeção reprovada | ✅ | `quality_capa`, trigger `quality_inspections_autocapa` | OK. |
| CAPA auto por envio a influencer crítico | ✅ | trigger `influencer_shipments_autocapa` + rules | OK (recente). |
| Configuração de critérios CAPA + simulação | ✅ | `_app.quality.capa-rules.tsx` | OK (recente). |
| Bridges Qualidade × Dev/Coleções/Marketing | ✅ | `quality-dev-bridge`, `quality-collections-bridge`, `quality-marketing-bridge` | OK (recente). |
| Reincidência por fornecedor (RCA) | ⚠️ | Pareto mostra defeito, não consolida por fornecedor | Adicionar ranking fornecedor × defeito recorrente. |

## Fase 5 — Almoxarifado (⭐ MAIOR GAP REAL)

| Item | Status | Onde está | Recomendação |
|---|---|---|---|
| Itens + saldo + movimentações | ✅ | `inventory_items`, `stock_movements` | OK. |
| Mínimo manual | ✅ | `inventory_items.minimum` | OK. |
| **Ponto de reposição dinâmico (consumo × lead-time)** | ❌ | — | **Item-foco do passo 2 — calcular via `turnover_30d` + lead-time fornecedor.** |
| FEFO / FIFO por lote/validade | ❌ | sem coluna `expires_at` em movimentos | Adicionar lote + validade + algoritmo de baixa. |
| Sucata / refugo registrado | ⚠️ | `stock_movements.type='ajuste'` cobre, mas sem motivo | Adicionar `scrap_reason` + painel %scrap por OP. |
| Inventário cíclico (contagem) | ❌ | — | Tela contagem ciclica por endereço/categoria. |
| Endereçamento (rua/prateleira) | ⚠️ | `inventory_items.location` (texto livre) | Suficiente — não virar WMS (escopo ERP). |
| Anexos do item | ✅ | bucket `inventory-attachments` | OK. |

## Fase 6 — Desenvolvimento & Coleções

| Item | Status | Onde está | Recomendação |
|---|---|---|---|
| Coleções com lifecycle (rascunho→produção→lançamento→markdown→descontinuada) | ✅ | `collections.status` + trigger `collections_lifecycle_transition` | OK. |
| Moodboard / temas / linhas | ✅ | `collection_moodboard`, `collection_themes`, `product_lines` | OK. |
| Carry-over | ✅ | `carry-over-panel` | OK. |
| Comparar coleções | ✅ | `collection-compare-dialog` | OK. |
| Mix de canais / sortimento | ✅ | `channel-mix-panel`, `assortment-panel` | OK. |
| Lifecycle de produto (planned/active/markdown/NOS/discontinued) | ✅ | `product_lifecycle` | OK. |
| Protótipos com aprovação + adjustments + comments | ✅ | `prototypes`, `prototype_approvals`, `prototype_adjustments` | OK. |
| Fit sessions (provas de modelagem) | ✅ | `fit_sessions`, `fit_session_comments` | OK. |
| Family / variantes / cores / tamanhos | ✅ | `product_families`, `product_variants`, `product_color_options`, `product_size_options` | OK. |
| Sustentabilidade do produto | ✅ | `product_sustainability` + `trust.tsx` | OK. |
| **Auditoria do trigger `collections_lifecycle_transition`** | ⚠️ | trigger faz muito (cria OPs, briefs, lifecycle) | Documentar e adicionar testes — risco se mudar. |

## Fase 7 — ERP / e-commerce (espelhos)

> Princípio core: **PLM não vira ERP**. Aqui só espelhamos.

| Item | Status | Onde está | Recomendação |
|---|---|---|---|
| Mirror de vendas | ✅ | `erp_sales_mirror`, `erp-sync.functions.ts` | OK. |
| Mirror de compras | ✅ | `erp_purchase_mirror` | OK. |
| Mirror de estoque (ERP) | ✅ | `erp_inventory_mirror` | OK. |
| Webhook seguro de sync | ✅ | `routes/api/public/erp-sync.$publicId.ts` + `ERP_WEBHOOK_SECRET` | OK. |
| Log de sincronização | ✅ | `erp_sync_log` | OK. |
| **Loja própria / checkout / fiscal** | 🚫 | — | **Não construir** (já está no ERP). |
| RFQ / cotações com fornecedor | ✅ | `rfq_requests`, `rfq_quotes` | OK. |
| Portal fornecedor (token) | ✅ | `supplier_portal_tokens`, `routes/portal.fornecedor.$token.tsx` | OK. |

## Fase 8 — IA & Automação

| Item | Status | Onde está | Recomendação |
|---|---|---|---|
| AI Coordenador (visão geral) | ✅ | `ai-coordinator-panel`, `agents.functions.ts` | OK. |
| Designer AI Assistant | ✅ | `designer-ai-assistant` | OK. |
| Marketing AI (brief studio) | ✅ | `marketing-brief-studio`, `marketing-ai.functions.ts` | OK. |
| PCP Intelligence | ✅ | `pcp-intelligence-panel` | OK. |
| Quality Intelligence | ✅ | `quality-intelligence-panel` | OK. |
| Trend Radar | ✅ | `trend-radar-panel`, `trends.functions.ts` | OK. |
| Ask Fashion AI (chat global) | ✅ | `ask-fashion-ai` + `routes/api.chat.ts` | OK. |
| Agentes agendados (cron) | ✅ | `ai_agents` + `routes/api.public.agents.run-due.ts` | OK. |
| Auto-push / Sentinel | ✅ | `auto-push-sentinel`, `push-notifications` | OK. |
| **Explicabilidade da sugestão (por que?)** | ⚠️ | Algumas saídas só mostram número | Padronizar: toda sugestão IA traz `reason` curto. |

## Fase 9 — Dashboards & BI

| Item | Status | Onde está | Recomendação |
|---|---|---|---|
| Executive KPIs | ✅ | `executive-kpis-panel` | OK. |
| Morning Briefing | ✅ | `morning-briefing-panel` | OK. |
| Launching Week | ✅ | `launching-week-panel` | OK. |
| War Room (decisões) | ✅ | `war-room-panel`, `war-room-decisions` | OK. |
| Collection Intelligence | ✅ | `collection-intelligence-panel` | OK. |
| Dev Intelligence | ✅ | `dev-intelligence-panel` | OK. |
| Marketing Intelligence | ✅ | `marketing-intelligence` | OK. |
| SKU performance | ✅ | `sku-performance-panel` | OK. |
| Channel mix | ✅ | `channel-mix-panel` | OK. |
| Product Marketing ROI | ✅ | `product-marketing-roi-panel` | OK. |
| **Dashboards financeiros** (DRE, fluxo de caixa) | 🚫 | — | **Não construir** — ERP. |

## Fase 10 — Notificações & Alertas

| Item | Status | Onde está | Recomendação |
|---|---|---|---|
| Sino + filtros | ✅ | `notifications-bell`, `notifications-filter` | OK. |
| Painel de alertas com dismiss | ✅ | `alerts-panel`, `alert_dismissals` | OK. |
| Push (PWA) | ✅ | `push-notifications.functions.ts`, `device-registration-panel` | OK. |
| Sentinela auto-push | ✅ | `auto-push-sentinel` | OK. |
| Notificações por setor | ✅ | `marketing_notifications`, `user_sectors`, `sector-chat` | OK. |
| **Preferências por tipo de alerta** (mute específico) | ⚠️ | filtro client-side existe, sem persistência | Persistir preferência por usuário. |

## Fase 11 — Mobile & PWA

| Item | Status | Onde está | Recomendação |
|---|---|---|---|
| Manifest PWA | ✅ | `public/manifest.webmanifest` | OK. |
| Registro de device | ✅ | `mobile_devices`, `device-registration-panel` | OK. |
| Quick pass (chão de fábrica) | ✅ | `quick-pass.tsx` | OK. |
| Lote QR | ✅ | `lote-qr-button` | OK. |
| **Offline-first em quick-pass** | ❌ | — | Service worker + fila de mutations. |

## Fase 12 — Segurança & Compliance

| Item | Status | Onde está | Recomendação |
|---|---|---|---|
| RLS em todas as tabelas | ✅ | todas com `ENABLE ROW LEVEL SECURITY` | OK. |
| Roles separadas (`user_roles` + `has_role`) | ✅ | conforme guideline | OK. |
| Audit log centralizado | ✅ | `audit_logs` + `log_audit()` | OK. |
| Supplier compliance | ✅ | `supplier_compliance` | OK. |
| Portal fornecedor com token + ack | ✅ | `supplier_portal_tokens`, `supplier_portal_acks` | OK. |
| **Política SELECT `prototype_comments` não cobre time do owner** | ⚠️ | scan flag atual | Ajustar policy: liberar p/ qualquer user cujo `user_sectors` esteja no owner. |
| **`user_roles` falta RESTRICTIVE INSERT global** | ⚠️ | scan flag atual | Adicionar policy RESTRICTIVE: INSERT exige `has_role(auth.uid(),'admin')`. |
| HIBP leaked password | ❓ | — | Verificar config — habilitar se off. |

## Fase 13 — Performance & Observabilidade

| Item | Status | Onde está | Recomendação |
|---|---|---|---|
| Error capture / boundaries | ✅ | `error-capture`, `route-boundaries` | OK. |
| Observability hook | ✅ | `observability.ts` | OK. |
| Lovable error reporting | ✅ | `lovable-error-reporting` | OK. |
| E2E tests | ⚠️ | só 2 specs (`intelligence-url-restore`, `supplier-portal`) | Ampliar p/ fluxos críticos (CAPA, MRP, lifecycle). |
| Slow query monitoring | ❌ | — | Usar `supabase--slow_queries` periodicamente. |
| Index review | ⚠️ | indexes implícitos por FK | Revisar índices em `quality_inspections.created_at`, `production_orders.due_date`, `stock_movements.inventory_item_id+created_at`. |

---

## Resumo executivo

| Categoria | ✅ | ⚠️ | ❌ | 🚫 |
|---|---|---|---|---|
| Total itens | 68 | 13 | 7 | 4 |

**Gaps reais que valem implementar (sem virar ERP):**

1. **Almoxarifado** — Ponto de reposição dinâmico, FEFO/lote+validade, sucata com motivo, contagem cíclica.
2. **Segurança** — Corrigir 2 findings do scan (`prototype_comments` SELECT + `user_roles` RESTRICTIVE INSERT).
3. **APS** — Sequenciamento sugerido no PCP (due_date × setup × família).
4. **Aprovação ficha técnica** — Registrar `approved_by` + diff de versões.
5. **Qualidade** — Ranking fornecedor × defeito recorrente.
6. **IA** — Padronizar `reason` em toda sugestão.
7. **Offline** — Quick-pass com service worker.
8. **Observabilidade** — Índices + slow queries + ampliar E2E.

**Fora de escopo (ERP/Fiscal — não construir):**
- Loja própria, checkout, NF-e, DRE, fluxo de caixa, contas a pagar/receber detalhado, WMS pleno.
