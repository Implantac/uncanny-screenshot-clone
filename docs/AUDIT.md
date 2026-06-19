# USE MODA PLM — Auditoria de Reposicionamento

> Diretriz: **não remover nada**. Catalogar → classificar → reorganizar → completar.
> ERP permanece como fonte oficial financeira/fiscal/comercial. PLM consome via integração.

## Legenda

- **Classe**
  - `PLM-core` — pertence ao núcleo do PLM, evoluir
  - `PLM-suporte` — apoia o PLM com escopo reduzido
  - `ERP-mirror` — pertence ao ERP; aqui apenas leitura/visualização
  - `Wip` — incompleto / a revisar
- **Status**: Funcional · Parcial · Incompleto · Quebrado · Duplicado

## Módulos (de `src/lib/modules.ts`)

| Slug              | Título                      | Classe      | Novo grupo       | Status             | Observação                                                |
| ----------------- | --------------------------- | ----------- | ---------------- | ------------------ | --------------------------------------------------------- |
| command-center    | Command Center              | PLM-core    | Operação         | Parcial            | Onda 2: trocar KPIs financeiros por operacionais          |
| fashion-calendar  | Fashion Calendar            | PLM-core    | Operação         | Funcional          |                                                           |
| colecoes          | Coleções                    | PLM-core    | Coleções         | Parcial            | Onda 3: virar núcleo, abas plano/mood/produtos/cronograma |
| trends            | Hub de Tendências           | PLM-core    | Coleções         | Funcional          |                                                           |
| produtos          | Desenvolvimento de Produtos | PLM-core    | Desenvolvimento  | Funcional          |                                                           |
| dev-kanban        | Kanban de Desenvolvimento   | PLM-core    | Desenvolvimento  | Funcional          |                                                           |
| ficha-tecnica     | Ficha Técnica               | PLM-core    | Desenvolvimento  | Parcial            | Revisar materiais/operações/consumos/tempos               |
| cad               | CAD e Modelagem             | PLM-core    | Desenvolvimento  | Parcial            | Anexos AI/CDR/DXF/SVG/PDF/PLT                             |
| prototipos        | Protótipos                  | PLM-core    | Desenvolvimento  | Funcional          |                                                           |
| pilots            | Gestão de Pilotos           | PLM-core    | Desenvolvimento  | Funcional          |                                                           |
| pcp               | PCP e Produção              | PLM-core    | PCP & Produção   | Funcional          |                                                           |
| pcp-kanban        | PCP Kanban                  | PLM-core    | PCP & Produção   | Parcial            | Onda 5: stages configuráveis por owner                    |
| centro-de-corte   | Centro de Corte             | PLM-core    | PCP & Produção   | Funcional          |                                                           |
| twin-factory      | Twin Factory                | PLM-core    | PCP & Produção   | Funcional          | Torre de controle                                         |
| capacity          | Production Capacity         | PLM-core    | PCP & Produção   | Funcional          |                                                           |
| almoxarifado      | Almoxarifado                | PLM-suporte | Cadeia (PLM)     | Funcional          | Escopo: insumos/MP                                        |
| fornecedores      | Fornecedores                | PLM-suporte | Cadeia (PLM)     | Funcional          |                                                           |
| supplier-score    | Supplier Scorecard          | PLM-suporte | Cadeia (PLM)     | Funcional          |                                                           |
| stock-health      | Stock Health                | PLM-suporte | Cadeia (PLM)     | Parcial            | Restringir a insumos PLM                                  |
| marketing         | Marketing                   | PLM-core    | Marketing        | Parcial            | Performance de produto/coleção                            |
| influencers       | Influencer Management       | PLM-core    | Marketing        | Parcial            | Onda 6: baseline antes/depois (dados ERP)                 |
| influencer-roi    | Influencer ROI              | PLM-core    | Marketing        | Parcial            | Consumir vendas do ERP                                    |
| campaigns         | Campaign Performance        | PLM-core    | Marketing        | Funcional          |                                                           |
| geo-sales         | Geo Sales                   | PLM-core    | Marketing        | Parcial            | Onda 6: mapa BR consumindo ERP                            |
| attribution       | Marketing Attribution       | ERP-mirror  | Marketing        | Parcial            | Leitura ERP                                               |
| intelligence      | Intelligence Engine         | PLM-core    | Inteligência     | Funcional          |                                                           |
| control-tower     | Control Tower               | PLM-core    | Inteligência     | Funcional          |                                                           |
| product-score     | Product Score               | PLM-core    | Inteligência     | Funcional          |                                                           |
| product-success   | Product Success             | PLM-core    | Inteligência     | Funcional          |                                                           |
| grade-needs       | Necessidade por Grade       | PLM-core    | Inteligência     | Funcional          |                                                           |
| replenishment     | Smart Replenishment         | PLM-suporte | Inteligência     | Parcial            | Sugestão p/ produção, sem virar compras                   |
| margem            | Margem & Rentabilidade      | ERP-mirror  | ERP (Integração) | Parcial            | Leitura do ERP                                            |
| profitability     | Motor de Rentabilidade      | ERP-mirror  | ERP (Integração) | Parcial            | Leitura do ERP                                            |
| cashflow          | Cashflow Health             | ERP-mirror  | ERP (Integração) | **Remover do PLM** | Pertence ao ERP — esconder do menu PLM                    |
| financeiro        | Financeiro                  | ERP-mirror  | ERP (Integração) | **Remover do PLM** | Idem                                                      |
| sales-performance | Sales Performance           | ERP-mirror  | ERP (Integração) | Parcial            | Leitura do ERP                                            |
| comercial         | Comercial / B2B             | ERP-mirror  | ERP (Integração) | **Remover do PLM** | Pertence ao ERP                                           |
| clientes          | Clientes                    | ERP-mirror  | ERP (Integração) | **Remover do PLM** | CRM/ERP                                                   |
| representantes    | Representantes              | ERP-mirror  | ERP (Integração) | **Remover do PLM** | CRM/ERP                                                   |
| pedidos-compra    | Pedidos de Compra           | ERP-mirror  | ERP (Integração) | **Remover do PLM** | Compras financeiras = ERP                                 |
| movimentacoes     | Movimentações Estoque       | ERP-mirror  | ERP (Integração) | **Remover do PLM** | Estoque fiscal = ERP                                      |
| compras           | Compras (necessidade)       | PLM-suporte | Cadeia (PLM)     | Parcial            | Manter só "necessidade técnica"                           |
| showroom          | Showroom Digital            | PLM-core    | Plataforma       | Wip                |                                                           |
| dpp               | Digital Product Passport    | PLM-core    | Plataforma       | Funcional          |                                                           |
| mobile            | Aplicativo Mobile           | PLM-core    | Plataforma       | Wip                |                                                           |
| bi                | BI e Analytics              | PLM-core    | Plataforma       | Funcional          |                                                           |
| fashion-gpt       | Fashion GPT                 | PLM-core    | Plataforma       | Funcional          |                                                           |
| use-ai            | USE AI                      | PLM-core    | Plataforma       | Funcional          |                                                           |
| security-center   | Segurança                   | PLM-core    | Plataforma       | Funcional          |                                                           |
| audit             | Auditoria & LGPD            | PLM-core    | Plataforma       | Funcional          |                                                           |
| data-lake         | Data Lake                   | PLM-core    | Plataforma       | Funcional          |                                                           |
| equipe            | Equipe & Permissões         | PLM-core    | Plataforma       | Funcional          |                                                           |

## Triggers de banco — duplicação com ERP

Status atual (Onda 8 aplicada): **DESATIVADOS**. Removidos do `pg_trigger`:

- ~~`trg_b2b_to_financial`~~ — removido. ERP gera contas a receber.
- ~~`trg_po_to_financial`~~ — removido. ERP gera contas a pagar.
- ~~`trg_po_to_stock`~~ — removido. Estoque fiscal vive no ERP.

Funções (`b2b_orders_to_financial_account`, `purchase_orders_to_financial_account`, `purchase_orders_to_stock_entries`) permanecem no schema caso seja necessário religar.

## Ondas concluídas

- ✅ Onda 9 — Tech Pack completo (BOM, operações SAM, POM, custos automáticos via trigger).
- ✅ Onda 10 — Grade/Cor/SKU (`product_color_options`, `product_size_options`, `product_variants`, grids OP/OS) em `/variantes`.
- ✅ Onda 11 — Cadeia & Qualidade: `supplier_capabilities`, `supplier_compliance`, `quality_inspections` (AQL) em `/inspecoes`.

## Rotas deprecadas (hidden no menu desde Onda 1)

Não removidas para preservar URLs/histórico, mas marcadas como **DEPRECATED** — leitura migrada para `erp_*_mirror`:

- `/financeiro` · `/cashflow` · `/comercial` · `/clientes` · `/representantes` · `/pedidos-compra` · `/movimentacoes`

Critério de remoção definitiva: quando os módulos equivalentes do ERP (Marketing/Vendas/Compras) estiverem 100% espelhados em `erp_sales_mirror` / `erp_purchase_mirror` / `erp_inventory_mirror` e nenhum link interno apontar mais para essas rotas.

## Tabelas — classificação inicial

- **PLM-core**: collections, collection_versions, products, prototypes, tech_sheets, production_orders, production_batches, production_stage_log, service_orders, pcp_stages, ai_agents, marketing_campaigns, influencers, audit_logs, mobile_devices
- **PLM-suporte**: suppliers, inventory_items (escopo insumos)
- **ERP-mirror (leitura)**: erp_sales_mirror, erp_purchase_mirror, erp_inventory_mirror
- **ERP-legacy (deprecated, manter para histórico)**: b2b_orders, customers, representatives, purchase_orders, purchase_order_items, financial_accounts, sales, stock_movements
- **Infra**: profiles, user_roles

## Ondas — status

- **Onda 1** ✅ — regrupamento de menu, hidden de ERP-mirror.
- **Onda 2** ✅ — Command Center operacional.
- **Onda 3** ✅ — Coleções como núcleo.
- **Onda 4** ✅ — Lotes + passagens parciais.
- **Onda 5** ✅ — Stages PCP configuráveis (`pcp_stages`).
- **Onda 6** ✅ — Marketing/Influencers/Geo lendo `erp_sales_mirror`.
- **Onda 7** ✅ — `src/lib/erp/` + tabelas `erp_*_mirror`.
- **Onda 8** ✅ — triggers de duplicação desativados.
- **Onda 9** ✅ — Tech Pack completo: BOM, operações (SAM), POM, custos recalculados.
- **Onda 10** ✅ — Grade/Cor/SKU: `product_color_options`, `product_size_options`, `product_variants`, `production_order_grid`, `service_order_grid`. UI `/variantes` com gerador de combinações.
- **Onda 11** ✅ — Cadeia & Qualidade: `supplier_capabilities`, `supplier_compliance`, `quality_inspections` (AQL) em `/inspecoes`.
- **Onda 12** ✅ — DPP versionado: `dpp_records` + `dpp_views`, publicação com hash SHA-256, QR público em `/dpp/:id` lê última versão publicada.
- **Onda 13** ✅ — Ficha técnica versionada: `tech_sheet_versions`, snapshots e diff visual em drawer.
- **Onda 14** ✅ — Qualidade CAPA: `quality_capa`, painel de ações corretivas/preventivas, eficácia e status.
- **Onda 15** ✅ — Almoxarifado técnico: cores interna/fornecedor e lote do fornecedor em itens/movimentações.
- **Onda 16** ✅ — PCP Enterprise: modo Kanban por lote, drawer de referências do lote e simulador de capacidade.
