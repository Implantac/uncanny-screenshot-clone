# USE MODA PLM — Matriz de Maturidade Enterprise

> Referências de mercado (benchmark, **não cópia**): Centric PLM · PTC FlexPLM · YuniquePLM · Delogue · Backbone · Kubix Link · WFX · Coats Digital.
> Regra: **evoluir o que existe**, nunca recriar. Toda lacuna abaixo aponta para o módulo/tabela já presente que deve ser estendido.

Legenda: ✅ Completo · 🟡 Parcial (evoluir) · ⚪ Ausente (implementar)

## 1. Pesquisa & Tendências

| Capacidade Enterprise                  | Status | Onde vive hoje                          | Evolução proposta                       |
| -------------------------------------- | ------ | --------------------------------------- | --------------------------------------- |
| Mood board por coleção                 | ✅     | `collection_moodboard` + `/colecoes`    | —                                       |
| Biblioteca de referências reutilizável | 🟡     | `collection_moodboard` (escopo coleção) | Promover a biblioteca global filtrável  |
| Hub de tendências                      | ✅     | `/trends` + `trends.functions`          | —                                       |
| Benchmark concorrentes                 | ⚪     | —                                       | Aba dentro de `/trends` (sem nova tela) |
| Cartela de cores oficial               | 🟡     | `product_color_options`                 | Promover a cartela mestre por temporada |
| Cartela de tecidos / material library  | ✅     | `material_library`                      | —                                       |

## 2. Gestão de Coleções

| Capacidade                     | Status | Onde                              | Evolução                                              |
| ------------------------------ | ------ | --------------------------------- | ----------------------------------------------------- |
| Coleções / temporadas          | ✅     | `collections` + `/colecoes`       | —                                                     |
| Subcoleções / cápsulas         | ⚪     | —                                 | Campo `parent_id` em `collections`                    |
| Metas (peças, receita, margem) | 🟡     | `collections.target_*` parcial    | Completar tela de metas em `/colecao-360`             |
| Mix planejado vs realizado     | ⚪     | —                                 | View consumindo `erp_sales_mirror`                    |
| Curva ABC                      | ⚪     | —                                 | Card em Collection Intelligence (Onda 17)             |
| ROI da coleção                 | 🟡     | `collection-intelligence` (risco) | Adicionar ROI = receita ERP − custo ficha − marketing |

## 3. Desenvolvimento de Produto

| Capacidade              | Status | Onde                                 | Evolução                              |
| ----------------------- | ------ | ------------------------------------ | ------------------------------------- |
| Workflow Kanban         | ✅     | `/dev-kanban`                        | —                                     |
| Aprovações multi-etapa  | 🟡     | `/approvals`                         | Roteamento configurável por papel     |
| Timeline do produto     | ✅     | `product-timeline`                   | —                                     |
| Versionamento           | 🟡     | `collection_versions`, `dpp_records` | Estender a `products` e `tech_sheets` |
| Histórico de alterações | 🟡     | `audit_logs`                         | UI "diff" por produto                 |

## 4. Protótipos / Pilotos

| Capacidade             | Status | Onde                                    | Evolução                      |
| ---------------------- | ------ | --------------------------------------- | ----------------------------- |
| Controle de pilotos    | ✅     | `prototypes` + `/pilots`                | —                             |
| Ajustes / fit sessions | ✅     | `prototype_adjustments`, `fit_sessions` | —                             |
| Fotos / vídeos         | 🟡     | `storage-uploader` em alguns pontos     | Padronizar uploader no piloto |
| Histórico              | ✅     | `prototype-timeline`                    | —                             |

## 5. Ficha Técnica

| Capacidade                              | Status | Onde                            | Evolução                            |
| --------------------------------------- | ------ | ------------------------------- | ----------------------------------- |
| Tecidos/aviamentos/etiquetas/embalagens | ✅     | `tech_sheet_materials` (Onda 9) | —                                   |
| Bordado/silk                            | 🟡     | tipo livre em materials         | Tipos padronizados + área aplicação |
| Medidas (POM)                           | ✅     | `tech_sheet_measurements`       | —                                   |
| Composição                              | ✅     | `tech_sheets`                   | —                                   |
| Imagens / anexos                        | ✅     | `tech_sheet_attachments`        | —                                   |
| **Versionamento de ficha**              | ✅     | `tech_sheet_versions` + drawer  | —                                   |
| **Diff entre versões**                  | ✅     | `tech-sheet-versions-drawer`    | —                                   |
| Aprovações                              | ✅     | `tech_sheets.status`            | —                                   |

## 6. BOM (Bill of Materials)

| Capacidade                          | Status | Onde                           | Evolução                          |
| ----------------------------------- | ------ | ------------------------------ | --------------------------------- |
| Lista de materiais por produto      | ✅     | `tech_sheet_materials`         | —                                 |
| Fornecedor, consumo, custo, unidade | ✅     | mesma tabela                   | —                                 |
| **BOM reutilizável entre produtos** | ✅     | `bom_templates`, ficha técnica | —                                 |
| Integração com almoxarifado         | 🟡     | `inventory_items`              | Linkar `inventory_item_id` na BOM |

## 7. BOP (Bill of Process)

| Capacidade            | Status | Onde                             | Evolução                 |
| --------------------- | ------ | -------------------------------- | ------------------------ |
| Operações com SAM     | ✅     | `tech_sheet_operations` (Onda 9) | —                        |
| Sequência             | 🟡     | campo `position` existe          | UI drag-drop             |
| Responsável por etapa | ⚪     | —                                | Campo `responsible_role` |
| Custo estimado        | ✅     | `total_cost`                     | —                        |

## 8. Engenharia de Custos

| Capacidade                  | Status | Onde                             | Evolução |
| --------------------------- | ------ | -------------------------------- | -------- |
| Custo teórico (ficha)       | ✅     | `tech_sheets.cost_price`         | —        |
| **Custo real (produção)**   | ✅     | `CostVariancePanel` em `/margem` | —        |
| **Variação teórico × real** | ✅     | `cost-variance.functions`        | —        |
| Target costing              | ✅     | `product_target_costs`           | —        |

## 9. PCP & Capacidade

| Capacidade                                | Status | Onde                                | Evolução                  |
| ----------------------------------------- | ------ | ----------------------------------- | ------------------------- |
| Kanban OPs                                | ✅     | `/pcp-kanban` (Ondas 5, 16)         | —                         |
| Stages configuráveis                      | ✅     | `pcp_stages`                        | —                         |
| Capacidade por setor/linha/facção         | 🟡     | `/capacity`                         | Adicionar dimensão facção |
| **Simulador "consigo entregar X até Y?"** | ✅     | `capacity-simulator`                | —                         |
| **Kanban modo Lote**                      | ✅     | `/pcp-kanban` toggle `ordens/lotes` | —                         |
| Predição de atraso IA                     | ✅     | `delay-prediction` (Onda anterior)  | —                         |

## 10. Qualidade

| Capacidade                      | Status | Onde                                        | Evolução |
| ------------------------------- | ------ | ------------------------------------------- | -------- |
| Não conformidades               | ✅     | `production_occurrences`                    | —        |
| Inspeções AQL                   | ✅     | `quality_inspections` (Onda 11)             | —        |
| Indicadores / ranking           | ✅     | `/quality` + Quality Intelligence (Onda 18) | —        |
| **CAPA (Corretiva/Preventiva)** | ✅     | `quality_capa` + `CapaPanel`                | —        |
| Ranking por fornecedor          | ✅     | Quality Intelligence                        | —        |

## 11. Fornecedores

| Capacidade                               | Status | Onde                                            | Evolução |
| ---------------------------------------- | ------ | ----------------------------------------------- | -------- |
| Cadastro                                 | ✅     | `suppliers`                                     | —        |
| Capabilities & compliance                | ✅     | `supplier_capabilities`, `supplier_compliance`  | —        |
| Scorecard                                | ✅     | `/supplier-score`                               | —        |
| **Portal Fornecedor (visualização)**     | ✅     | `/portal.fornecedor.$token` (Onda 19)           | —        |
| **Portal: enviar amostra/responder**     | ✅     | portal público + anexos/checklist               | —        |
| **Portal: validação interna de amostra** | ✅     | `/fornecedores` + `supplier_portal_attachments` | —        |
| RFQ                                      | ✅     | `rfq_requests`, `rfq_quotes`                    | —        |

## 12. Almoxarifado

| Capacidade                       | Status | Onde                                         | Evolução                   |
| -------------------------------- | ------ | -------------------------------------------- | -------------------------- |
| Itens, saldo, movimentações      | ✅     | `inventory_items`, `stock_movements`         | —                          |
| Foto do material                 | 🟡     | `storage-uploader` integrado (onda anterior) | Garantir em todos os itens |
| **Cor interna × cor fornecedor** | ✅     | `inventory_items`, `stock_movements`         | —                          |
| **Lote do fornecedor**           | ✅     | `stock_movements.supplier_lot`               | —                          |
| Rastreabilidade                  | 🟡     | `/cadeia-360`                                | Vincular lote→OP→produto   |

## 13. Marketing de Moda

| Capacidade                                      | Status | Onde                                       | Evolução |
| ----------------------------------------------- | ------ | ------------------------------------------ | -------- |
| Campanhas                                       | ✅     | `marketing_campaigns`                      | —        |
| Influencers + ROI                               | ✅     | `/influencers`, `/influencer-roi` (Onda 6) | —        |
| Geo / atribuição                                | ✅     | `/geo-sales`, `/attribution`               | —        |
| **Custo ensaio/foto/vídeo/tráfego por produto** | ✅     | `product_marketing_costs`, `/marketing`    | —        |
| **ROI por produto e por coleção**               | ✅     | `/marketing` aba ROI Produto + ERP mirror  | —        |

## 14. Comercial (ERP-mirror — só leitura)

| Capacidade                                 | Status                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Sell-in/Sell-out, Curva ABC, giro, ruptura | 🟡 leitura via `erp_sales_mirror` — consolidar em `/sales-performance` |

## 15. BI & IA

| Capacidade                         | Status | Onde                                        | Evolução |
| ---------------------------------- | ------ | ------------------------------------------- | -------- |
| Indicadores por área               | ✅     | `/bi`, `/intelligence`, `/control-tower`    | —        |
| IA por persona (Dev/PCP/Marketing) | ✅     | `ask-fashion-ai` + `ai-insights`            | —        |
| IA Comando (plano + execução)      | ✅     | Ondas 20–22                                 | —        |
| **Digital Twin da coleção**        | ✅     | `/colecao-360` com ERP + estoque + produção | —        |

## 16. UX/UI

- Manter identidade atual (Linear/Notion-like).
- **Não** trocar componentes shadcn nem o design system.
- Evoluções permitidas: hierarquia visual, densidade, atalhos, menos cliques.

---

## Top 10 lacunas priorizadas (ordem sugerida)

1. **Subcoleções / cápsulas** (§2) — `parent_id` em `collections`.
2. **BOP responsável por etapa** (§7) — campo `responsible_role`.
3. **Curva ABC por coleção** (§2).
4. **Biblioteca global de referências** (§1).
5. **Automação de alertas de ROI e margem** (§13/15).
6. **Custo por facção/terceirizado no real × teórico** (§8/9).
7. **Governança de metas por coleção/canal** (§13/15).
8. **Assinatura/termo aceite no portal fornecedor** (§11).
9. **Metas completas por coleção** (§2/15).
10. **Foto do material em todos os itens** (§12).

Nenhum item acima cria tela nova desnecessária — todos estendem módulo/tabela existente.
