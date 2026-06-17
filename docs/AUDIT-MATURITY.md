# USE MODA PLM — Matriz de Maturidade Enterprise

> Referências de mercado (benchmark, **não cópia**): Centric PLM · PTC FlexPLM · YuniquePLM · Delogue · Backbone · Kubix Link · WFX · Coats Digital.
> Regra: **evoluir o que existe**, nunca recriar. Toda lacuna abaixo aponta para o módulo/tabela já presente que deve ser estendido.

Legenda: ✅ Completo · 🟡 Parcial (evoluir) · ⚪ Ausente (implementar)

## 1. Pesquisa & Tendências

| Capacidade Enterprise | Status | Onde vive hoje | Evolução proposta |
|---|---|---|---|
| Mood board por coleção | ✅ | `collection_moodboard` + `/colecoes` | — |
| Biblioteca de referências reutilizável | 🟡 | `collection_moodboard` (escopo coleção) | Promover a biblioteca global filtrável |
| Hub de tendências | ✅ | `/trends` + `trends.functions` | — |
| Benchmark concorrentes | ⚪ | — | Aba dentro de `/trends` (sem nova tela) |
| Cartela de cores oficial | 🟡 | `product_color_options` | Promover a cartela mestre por temporada |
| Cartela de tecidos / material library | ✅ | `material_library` | — |

## 2. Gestão de Coleções

| Capacidade | Status | Onde | Evolução |
|---|---|---|---|
| Coleções / temporadas | ✅ | `collections` + `/colecoes` | — |
| Subcoleções / cápsulas | ⚪ | — | Campo `parent_id` em `collections` |
| Metas (peças, receita, margem) | 🟡 | `collections.target_*` parcial | Completar tela de metas em `/colecao-360` |
| Mix planejado vs realizado | ⚪ | — | View consumindo `erp_sales_mirror` |
| Curva ABC | ⚪ | — | Card em Collection Intelligence (Onda 17) |
| ROI da coleção | 🟡 | `collection-intelligence` (risco) | Adicionar ROI = receita ERP − custo ficha − marketing |

## 3. Desenvolvimento de Produto

| Capacidade | Status | Onde | Evolução |
|---|---|---|---|
| Workflow Kanban | ✅ | `/dev-kanban` | — |
| Aprovações multi-etapa | 🟡 | `/approvals` | Roteamento configurável por papel |
| Timeline do produto | ✅ | `product-timeline` | — |
| Versionamento | 🟡 | `collection_versions`, `dpp_records` | Estender a `products` e `tech_sheets` |
| Histórico de alterações | 🟡 | `audit_logs` | UI "diff" por produto |

## 4. Protótipos / Pilotos

| Capacidade | Status | Onde | Evolução |
|---|---|---|---|
| Controle de pilotos | ✅ | `prototypes` + `/pilots` | — |
| Ajustes / fit sessions | ✅ | `prototype_adjustments`, `fit_sessions` | — |
| Fotos / vídeos | 🟡 | `storage-uploader` em alguns pontos | Padronizar uploader no piloto |
| Histórico | ✅ | `prototype-timeline` | — |

## 5. Ficha Técnica

| Capacidade | Status | Onde | Evolução |
|---|---|---|---|
| Tecidos/aviamentos/etiquetas/embalagens | ✅ | `tech_sheet_materials` (Onda 9) | — |
| Bordado/silk | 🟡 | tipo livre em materials | Tipos padronizados + área aplicação |
| Medidas (POM) | ✅ | `tech_sheet_measurements` | — |
| Composição | ✅ | `tech_sheets` | — |
| Imagens / anexos | ✅ | `tech_sheet_attachments` | — |
| **Versionamento de ficha** | ⚪ | — | Tabela `tech_sheet_versions` (snapshot) |
| **Diff entre versões** | ⚪ | — | UI lado-a-lado |
| Aprovações | ✅ | `tech_sheets.status` | — |

## 6. BOM (Bill of Materials)

| Capacidade | Status | Onde | Evolução |
|---|---|---|---|
| Lista de materiais por produto | ✅ | `tech_sheet_materials` | — |
| Fornecedor, consumo, custo, unidade | ✅ | mesma tabela | — |
| **BOM reutilizável entre produtos** | ⚪ | — | "Copiar BOM de…" + templates |
| Integração com almoxarifado | 🟡 | `inventory_items` | Linkar `inventory_item_id` na BOM |

## 7. BOP (Bill of Process)

| Capacidade | Status | Onde | Evolução |
|---|---|---|---|
| Operações com SAM | ✅ | `tech_sheet_operations` (Onda 9) | — |
| Sequência | 🟡 | campo `position` existe | UI drag-drop |
| Responsável por etapa | ⚪ | — | Campo `responsible_role` |
| Custo estimado | ✅ | `total_cost` | — |

## 8. Engenharia de Custos

| Capacidade | Status | Onde | Evolução |
|---|---|---|---|
| Custo teórico (ficha) | ✅ | `tech_sheets.cost_price` | — |
| **Custo real (produção)** | ⚪ | dados existem em OPs/lotes | Função `compute_real_cost(order_id)` |
| **Variação teórico × real** | ⚪ | — | Painel em `/margem` reaproveitado |
| Target costing | ✅ | `product_target_costs` | — |

## 9. PCP & Capacidade

| Capacidade | Status | Onde | Evolução |
|---|---|---|---|
| Kanban OPs | ✅ | `/pcp-kanban` (Ondas 5, 16) | — |
| Stages configuráveis | ✅ | `pcp_stages` | — |
| Capacidade por setor/linha/facção | 🟡 | `/capacity` | Adicionar dimensão facção |
| **Simulador "consigo entregar X até Y?"** | ⚪ | — | Server fn usando capacidade + fila |
| **Kanban modo Lote** | ⚪ | só modo referência | Toggle no header do `/pcp-kanban` |
| Predição de atraso IA | ✅ | `delay-prediction` (Onda anterior) | — |

## 10. Qualidade

| Capacidade | Status | Onde | Evolução |
|---|---|---|---|
| Não conformidades | ✅ | `production_occurrences` | — |
| Inspeções AQL | ✅ | `quality_inspections` (Onda 11) | — |
| Indicadores / ranking | ✅ | `/quality` + Quality Intelligence (Onda 18) | — |
| **CAPA (Corretiva/Preventiva)** | ⚪ | — | Tabela `quality_actions` ligada a ocorrência |
| Ranking por fornecedor | ✅ | Quality Intelligence | — |

## 11. Fornecedores

| Capacidade | Status | Onde | Evolução |
|---|---|---|---|
| Cadastro | ✅ | `suppliers` | — |
| Capabilities & compliance | ✅ | `supplier_capabilities`, `supplier_compliance` | — |
| Scorecard | ✅ | `/supplier-score` | — |
| **Portal Fornecedor (visualização)** | ✅ | `/portal.fornecedor.$token` (Onda 19) | — |
| **Portal: enviar amostra/responder** | ⚪ | só leitura hoje | Upload + status na API pública |
| RFQ | ✅ | `rfq_requests`, `rfq_quotes` | — |

## 12. Almoxarifado

| Capacidade | Status | Onde | Evolução |
|---|---|---|---|
| Itens, saldo, movimentações | ✅ | `inventory_items`, `stock_movements` | — |
| Foto do material | 🟡 | `storage-uploader` integrado (onda anterior) | Garantir em todos os itens |
| **Cor interna × cor fornecedor** | ⚪ | — | Campos `internal_color`, `supplier_color` |
| **Lote do fornecedor** | ⚪ | — | Campo `supplier_lot` em movimentação |
| Rastreabilidade | 🟡 | `/cadeia-360` | Vincular lote→OP→produto |

## 13. Marketing de Moda

| Capacidade | Status | Onde | Evolução |
|---|---|---|---|
| Campanhas | ✅ | `marketing_campaigns` | — |
| Influencers + ROI | ✅ | `/influencers`, `/influencer-roi` (Onda 6) | — |
| Geo / atribuição | ✅ | `/geo-sales`, `/attribution` | — |
| **Custo ensaio/foto/vídeo/tráfego por produto** | ⚪ | só nível campanha | Tabela `product_marketing_costs` |
| **ROI por produto e por coleção** | 🟡 | parcial em campanhas | Cruzar com `erp_sales_mirror` |

## 14. Comercial (ERP-mirror — só leitura)

| Capacidade | Status |
|---|---|
| Sell-in/Sell-out, Curva ABC, giro, ruptura | 🟡 leitura via `erp_sales_mirror` — consolidar em `/sales-performance` |

## 15. BI & IA

| Capacidade | Status | Onde | Evolução |
|---|---|---|---|
| Indicadores por área | ✅ | `/bi`, `/intelligence`, `/control-tower` | — |
| IA por persona (Dev/PCP/Marketing) | ✅ | `ask-fashion-ai` + `ai-insights` | — |
| IA Comando (plano + execução) | ✅ | Ondas 20–22 | — |
| **Digital Twin da coleção** | 🟡 | `/colecao-360` + Collection Intelligence | Agregar prod+estoque+vendas+margem em uma visão única |

## 16. UX/UI

- Manter identidade atual (Linear/Notion-like).
- **Não** trocar componentes shadcn nem o design system.
- Evoluções permitidas: hierarquia visual, densidade, atalhos, menos cliques.

---

## Top 10 lacunas priorizadas (ordem sugerida)

1. **Versionamento de ficha técnica + diff** (§5) — base PLM Enterprise, hoje ausente.
2. **Custo real × teórico** (§8) — dados já existem, falta consolidar.
3. **CAPA na Qualidade** (§10) — fecha o ciclo de não-conformidade.
4. **Kanban modo Lote** (§9) — toggle, sem nova tela.
5. **Simulador de capacidade** (§9) — "entrego X até Y?".
6. **Portal Fornecedor 2.0 — upload de amostra** (§11).
7. **Almoxarifado: cor interna/fornecedor + lote** (§12).
8. **ROI marketing por produto/coleção** (§13).
9. **BOM reutilizável / templates** (§6).
10. **Digital Twin agregado da coleção** (§15).

Nenhum item acima cria tela nova desnecessária — todos estendem módulo/tabela existente.
