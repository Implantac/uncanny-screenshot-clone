# Onda 14 — Evolução cirúrgica (13 melhorias)

Antes de tocar em código: a maior parte das 13 melhorias já tem base no projeto. O plano abaixo separa o que **já existe e está pronto**, o que precisa de **complemento pequeno**, e o que é **novo de fato**. Nada é reescrito. Nenhuma tabela/rota é removida. Nada vira ERP.

## Status atual (auditoria rápida)

| #   | Melhoria                                                | Status hoje                                                                                                            | Ação                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Protótipos · setor + ajustes + fotos/vídeos + timeline  | **Pronto** (`prototype-adjustments.tsx` cobre setor, motivo, quem pediu, data, responsável, status, anexos, histórico) | Adicionar **timeline visual única** no card do protótipo (consolida `prototype_comments` + `prototype_adjustments` + `production_stage_log` da OP gerada)                                                                                         |
| 02  | Coleções · metas, KPIs, mood, mix, ROI                  | Parcial (`colecao-360`, `war-room-colecao` já mostram dev/pilotos/OPs; falta financeiro+mood)                          | Estender `colecao-360`: aba **Metas & ROI** (campos em `collections` que já existem ou JSON `goals`) + aba **Mood** (upload no bucket `collection-covers`) + painel **Mix planejado vs realizado** lendo `production_orders` + `erp_sales_mirror` |
| 03  | Kanban modo lote                                        | Parcial (existe `production_batches` + `_app.lotes.tsx`)                                                               | Adicionar **toggle "por OP / por lote"** em `_app.pcp-kanban.tsx`. No modo lote, agrupar cards por `batch_id`, expandir ao clicar                                                                                                                 |
| 04  | Página visual do lote                                   | Parcial (`/lotes` é listagem)                                                                                          | Criar `_app.lote.$id.tsx`: header com %concluído, grade, OPs filhas (cards), tempo por setor, ocorrências (já existem em `production-occurrence.tsx`), responsável                                                                                |
| 05  | Passagem de produção · histórico                        | **Pronto** (`production_stage_log` + `/onde-esta`)                                                                     | Expor o **mesmo timeline** dentro da página do lote (item 4) e na ficha da OP. Sem nova tabela                                                                                                                                                    |
| 06  | Passagem de segunda linha (retrabalho)                  | Faltando                                                                                                               | Adicionar coluna `kind` em `service_orders` (`primeira`/`segunda_linha`) **OU** novo campo `defect_type` em `production_order_comments` com type tag. Migration mínima (1 campo) + toggle "2ª linha" no diálogo de passagem                       |
| 07  | Ocorrências de produção                                 | **Pronto** (`production-occurrence.tsx` já criado na onda anterior)                                                    | Garantir botão "+ Ocorrência" presente em (a) card do Kanban, (b) página do lote (item 4) — sem nova tela                                                                                                                                         |
| 08  | Almoxarifado · foto + cor + PDF + consumo prev x real   | Parcial (`inventory_items` tem campos básicos)                                                                         | Estender `_app.almoxarifado.tsx`: campos `image_url`, `color_internal`, `color_supplier`, `tech_sheet_pdf_url`. Migration (4 colunas) + UI. Consumo previsto vem de `tech_sheet_materials`, realizado de `stock_movements`                        |
| 09  | Marketing · fotos/vídeos/custos/ROI por produto+coleção | Parcial (`marketing-envios`, `influencer-shipments`, `marketing_campaigns` já existem)                                 | Em `colecao-360` (aba ROI do item 2), agregar custos vindos de `marketing_campaigns.budget` + `influencer_shipments.value` × receita de `erp_sales_mirror`. Nenhuma rota nova                                                                     |
| 10  | BI · seções Dev/Prod/Qualidade/Marketing/Comercial      | Parcial (`_app.bi.tsx` existe)                                                                                         | Adicionar 5 abas no BI atual lendo dados já existentes. Cards reaproveitam queries dos War Rooms                                                                                                                                                  |
| 11  | USE AI · análises práticas com dados reais              | **Pronto** (`ai-insights.functions.ts` + `use-ai.tsx` + `AICoordinatorPanel`)                                          | Adicionar **8 perguntas pré-prontas** (chips) na home do `/use-ai` — exatamente as do prompt                                                                                                                                                      |
| 12  | Central de alertas                                      | Parcial (`marketing_notifications` + `notifications-bell.tsx`)                                                         | Estender `notifications-bell` com 6 categorias (atraso, retrabalho, parado, sem-movimentação, coleção-meta, material-crítico). Job de cálculo: server-fn `computeAlerts` lendo OPs, log e estoque. Sem nova tabela                                |
| 13  | Dashboard executivo                                     | Parcial (`/` index já tem KPIs + IA)                                                                                   | Reorganizar `_app.index.tsx` em 5 blocos (Dev/Prod/Mkt/Comercial/Qualidade) reutilizando dados das War Rooms. Sem rota nova                                                                                                                       |

## O que será criado (mínimo)

```
src/routes/_authenticated/
  _app.lote.$id.tsx                (novo — item 4)
src/components/
  prototype-timeline.tsx           (novo — item 1, ~80 linhas)
  alerts-engine.ts                 (novo — item 12)
src/lib/
  alerts.functions.ts              (novo — item 12, lê tabelas existentes)
```

Migrations mínimas:

- `inventory_items` + 4 colunas (item 8)
- `service_orders` + 1 coluna `kind` (item 6)

Nada mais.

## Ordem sugerida

Implementar em 4 PRs curtos, cada um cabendo em uma resposta:

1. **PR-A · Visual & timeline** — itens 1, 4, 5 (timeline protótipo + página do lote)
2. **PR-B · Operação** — itens 3, 6, 7 (modo lote no kanban, 2ª linha, garantir ocorrências)
3. **PR-C · Inteligência** — itens 2, 9, 10, 11, 13 (ROI coleção, abas BI, chips IA, blocos home)
4. **PR-D · Alertas & almoxarifado** — itens 8, 12 (campos + central)

Cada PR não toca nada fora do escopo, não remove rotas e não cria ERP.

## Pergunta

Por qual PR começo? Sugiro **PR-A** (mais visual, impacto imediato no usuário), mas se preferir começar pelo PR-C (inteligência/ROI) ou PR-D (alertas) é só dizer.
