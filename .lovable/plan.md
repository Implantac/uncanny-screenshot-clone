# MRP Inteligente — Plano de Evolução

Já existe base no projeto: `src/lib/pcp-mrp.functions.ts` (explosão BOM × OPs, déficit, em-pedido), `src/components/pcp-mrp-panel.tsx`, `inventory-smart.functions.ts/panel`, `_app.almoxarifado.tsx`, `erp_inventory_mirror`, `erp_purchase_mirror`, `erp_sales_mirror`, `inventory_items` (com `minimum`, `balance`, `last_entry_at`, `last_exit_at`, `turnover_30d`), `stock_movements`, `purchase_orders/items`, `suppliers (lead_time_days)`. Vou **evoluir**, não reconstruir.

Por escopo e qualidade, entrego em 4 fases (cada fase = entrega funcional ponta-a-ponta com dados reais do ERP). Confirme a fase 1 e sigo nela; depois avançamos.

## Fase 1 — Engine MRP + Tela MRP enterprise (entrego agora)
- **Engine `computeMrpPlanning`** (`src/lib/mrp-planning.functions.ts`):
  consumo diário (saídas 90d / 90), demanda mensal/anual, σ das demandas mensais (12m), nível de serviço configurável (90/95/97/99 → Z), lead time do fornecedor principal, ES = Z·σ·√LT, PP, mínimo, LEC = √(2·D·S/H), máximo = mín + LEC, cobertura, capital empatado, giro, status (CRÍTICO/ATENÇÃO/NORMAL/EXCESSO), sugestão de compra (= máx − atual, mas ≥ LEC). Lê de `inventory_items` + `stock_movements` + `purchase_orders` + `suppliers`.
- **Config global por owner** (nova tabela `mrp_config`): `service_level_default`, `order_cost_default (S)`, `holding_cost_pct_default (H%)`, `working_days_per_month=22`. Override por item em coluna nova `inventory_items.mrp_overrides jsonb`.
- **Tela `/almoxarifado/mrp`** (rota nova, dentro do almoxarifado): tabela completa com todos os 16 campos do briefing, filtros (grupo, fornecedor, status, almoxarifado, busca), ordenação, paginação client, exportar Excel/PDF (`xlsxwriter`/`pdf.ts` já existem no projeto).
- **Cards de dashboard no topo**: valor total estoque, capital parado, itens críticos, em excesso, cobertura média, rupturas, compras sugeridas (qtd e R$).

## Fase 2 — Drawer lateral do material + alertas + sugestão automática
- Drawer com abas: Resumo · Estoque · Consumo (gráficos 30/90/180/365d) · Pedidos (POs em aberto) · Produção (OPs e necessidade) · Planejamento (todos os cálculos) · Timeline · Indicadores.
- Auto-criação de alertas em `marketing_notifications` quando PP atingido, cobertura <10d ou estoque > máximo (reuso de infra existente).
- Botão **"Gerar Solicitação de Compra"** cria `purchase_orders` com `purchase_order_items` na quantidade sugerida, fornecedor principal e `expected_date = hoje + lead_time`. Registra timeline.

## Fase 3 — BI MRP
- Painel `/almoxarifado/mrp/bi` com Curva ABC (valor de consumo), XYZ (CV = σ/μ), Cobertura, Capital parado, Rupturas histórico, Lead Time por fornecedor, Giro, Top consumos. Reuso de `recharts` e `abc-collection.functions.ts` adaptado.

## Fase 4 — IA Copilot MRP
- Extensão do `api.copilot.ts` com tools dedicadas (`mrp_critical_items`, `mrp_buy_suggestions`, `mrp_capital_parado`, `mrp_supplier_leadtime`). Responde com dados reais via gateway Lovable AI (`google/gemini-3-flash-preview`).

## Eventos / recálculo
Trigger no Postgres em `stock_movements` já mantém `turnover_30d`/`last_entry_at`/`last_exit_at`. Tudo o resto é derivado on-the-fly por `computeMrpPlanning` (sem materializar) — evita drift e roda em <2s para milhares de itens. Cache via TanStack Query, invalidado pelo cron ERP existente.

## Detalhes técnicos
- Tudo server-side em `createServerFn` com `requireSupabaseAuth`.
- Sem mocks. Itens sem histórico de movimentação aparecem com `consumo_diario=0`, status="NORMAL" e nota visual "sem histórico".
- Nova migração: tabela `mrp_config` + coluna `inventory_items.mrp_overrides jsonb` + GRANTs.
- Reaproveita: `inventory_items`, `stock_movements`, `purchase_orders/items`, `suppliers`, `erp_inventory_mirror`, `marketing_notifications`, `pcp-mrp.functions.ts` (renomeio para `mrp-explosion`).
- Sem duplicar telas: a tela atual de Almoxarifado ganha aba "MRP" em vez de virar rota solta.

## Diagrama de fluxo (Fase 1)

```text
ERP cron → erp_inventory_mirror + stock_movements + purchase_orders + suppliers
                              │
                              ▼
                  computeMrpPlanning(serverFn)
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   Cards dashboard      Tabela MRP            Filtros + export
```

## Pergunta antes de começar
Quer que eu **comece pela Fase 1 inteira agora** (engine + tabela + cards + config), ou prefere que eu primeiro confirme as **constantes-padrão** (S=R$10, H=3,9%, dias úteis=22, nível serviço=95%) extraídas do seu briefing?
