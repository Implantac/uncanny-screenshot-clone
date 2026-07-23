# USE Fashion — Plano de Evolução (Ondas 2 → 6)

O que já foi entregue nas ondas anteriores permanece intacto:

- **Onda 0 — Auditoria + Product Workspace** (`/produto/$id` como agregador de 11 painéis existentes).
- **Onda 1 — Workflow Engine + Stage Gates** (`product_gate_status`, `can_advance_product`, trigger de auditoria, `StageGateBadge` no Workspace).
- **Onda 2 (parcial) — Timeline unificada** (`v_product_events` com 12 fontes + `<ProductTimeline>` virtualizada com infinite scroll).

Este plano cobre o que falta, sem quebrar nada.

---

## Onda 2 — Timeline & Colaboração (completar)

**Objetivo:** transformar a Timeline em canal ativo, não só histórico.

- Comentários por evento (thread leve reutilizando `prototype_comments` como padrão) escopados por `product_id`.
- Anexos por evento (bucket `product-timeline` privado).
- Filtro por setor + intervalo de datas + busca textual (server-side na view).
- Assinaturas de eventos → toca `push_notifications` para quem seguiu o produto.
- Botão "Seguir produto" (nova tabela `product_watchers`).

Sem novas rotas — tudo dentro do `Product Workspace › Timeline`.

## Onda 3 — Stage Gates ampliados + Approvals

**Objetivo:** transformar Gates em fluxo de aprovação real.

- Adicionar 3 gates críticos ao `product_gate_status`:
  - **Grade de tamanhos definida** (`product_size_options`).
  - **Rota de produção definida** (`product_routing`).
  - **Meta de custo respeitada** (`product_target_costs` vs `tech_sheets.cost_price`).
- Nova tabela `product_approvals(product_id, gate_key, required_role, approver_id, decision, note, decided_at)`.
- Cada gate reprovado abre uma tarefa nomeada com responsável (usa `user_roles`).
- Painel `StageGateBadge` vira `StageGatePanel` expansível dentro do Workspace, mostrando bloqueios com CTA "resolver agora".
- Nada de rota nova; substituição in-place do componente atual.

## Onda 4 — Cost Cockpit + AI Insights por Produto

**Objetivo:** margem viva ao lado do produto.

- View `v_product_cost_snapshot` (custo BOM + operações + overhead + reservas ativas + custo real via `stock_movements`) — reaproveita triggers existentes.
- Aba "Custo" no Workspace com:
  - Meta vs Real vs Última venda (`erp_sales_mirror`).
  - Waterfall de custo (materiais / mão-de-obra / overhead).
  - Sensibilidade: "se subir X% no fornecedor Y, margem cai Z%".
- `ai_agents` já existe → 1 agente novo `product_insight` que roda on-demand e escreve em `marketing_notifications`/`alertas` com o **porquê + ação sugerida** (regra de ouro).

## Onda 5 — PCP inteligente do Produto

**Objetivo:** o Workspace mostra o estado real da fábrica para aquele produto.

- Aba "PCP" já existe → adicionar:
  - Card de gargalo por setor (usa `production_stage_log` + SLA).
  - Previsão de conclusão (SAM × capacidade do setor via `supplier_capacity`).
  - Reservas de material (`material_reservations`) com semáforo verde/amarelo/vermelho.
- Sem novas tabelas; só uma função SQL `product_pcp_health(_product_id)`.

## Onda 6 — Enterprise hardening

**Objetivo:** deixar production-ready no padrão Centric/Backbone.

- Auditoria: revisar policies faltantes de INSERT em `audit_logs` para todas as tabelas críticas.
- Performance: índices em `v_product_events` fontes (occorred_at desc por product_id).
- Acessibilidade: revisão AA no Workspace (foco visível, labels ARIA nos badges/timeline).
- Erro global: `errorComponent` + `notFoundComponent` em todas as rotas de `_authenticated/_app.produto*`.
- Testes de fumaça headless (Playwright) das transições Gate → Approval → Timeline.

---

## Detalhes técnicos

**Migrations planejadas** (uma por onda, aprovadas separadamente):

```text
onda2: product_watchers, product_timeline_comments, product_timeline_attachments
onda3: product_approvals, product_gate_status v2 (+3 requisitos)
onda4: v_product_cost_snapshot (view), ai_agents seed 'product_insight'
onda5: fn product_pcp_health(uuid)
onda6: índices + policies faltantes
```

**Componentes reaproveitados** (nada novo desnecessário): `ProductTimeline`, `StageGateBadge`, `PageHeader`, `EmptyState`, `ErrorState`, painéis já existentes de BOM/PCP/Qualidade/Marketing.

**Rotas:** nenhuma criada. Tudo entra como abas/painéis do `_app.produto.$id.tsx`.

**Guardrails obrigatórios respeitados:** sem mock, sem duplicação, sem ERP-features (financeiro/fiscal), sem reescrita, RLS + GRANT em toda tabela nova.

---

## O que quero validar antes de codar

1. Aprova avançar **onda a onda** (uma migration + código por vez), começando pela **Onda 2 — comentários + anexos + seguir produto na Timeline**?
2. Ou prefere pular direto para **Onda 3 (Stage Gates + Approvals)**, que tem impacto de negócio maior?
3. Alguma onda deve sair do escopo?
