# Onda 13 — Evolução incremental (sem reconstruir nada)

Filosofia: **completar o que existe, ≤2 cliques, IA explica o porquê**. Nenhuma rota é removida, nenhuma tabela nova é criada. Reutiliza dados de `production_orders`, `production_stage_log`, `prototypes`, `collections`, `erp_*_mirror` e as funções já prontas em `pcp-ops.functions.ts`, `marketing-ai.functions.ts`, `ai-insights.functions.ts`, `priority-score.ts`.

## Entregas (6 itens, ordem de execução)

### 1. Command Center operacional na home
Hoje `_app.index.tsx` mostra KPIs genéricos. Trocar por painel operacional:
- OPs hoje (count por stage), gargalo do dia (stage com maior WIP em `v_supplier_wip` + `production_orders`), 3 OPs mais atrasadas (`due_date < now`), top-3 sugestões do motor de necessidade (reusa `computeReplenishmentNeeds`), insight IA curto (reusa `askPcp`).
- Tudo em 1 tela, cards clicáveis levam direto à ação (≤2 cliques).

### 2. War Room da Coleção
Nova rota `_app.war-room-colecao.$id.tsx`. Reutiliza queries do `colecao-360`. Layout consolidado:
- Header com nome/temporada/% concluído.
- 6 cards: produtos em dev, pilotos pendentes, sem ficha, liberados, lotes em produção, campeões/críticos (vindo de `erp_sales_mirror`).
- Painel lateral `<AICoordinatorPanel persona="dev"/>` com sugestões proativas.

### 3. War Room da Produção
Nova rota `_app.war-room-producao.tsx`. Consolida `twin-factory` + `listDayProduction` + `listOutsourcedWip` numa visão única:
- Heatmap stages × OPs, lista de gargalos, OPs críticas, terceirizados com WIP alto.
- Painel `<AICoordinatorPanel persona="pcp"/>` explica por que cada item é crítico.

### 4. Rastreabilidade visual `/onde-esta`
Nova rota `_app.onde-esta.tsx`. Input: código OP ou batch. Lê `production_stage_log` ordenado por `created_at`:
- Timeline vertical (stage, qty, parcial/integral, fornecedor, quando).
- Mostra "agora está em X há Y horas". Sem nova tabela.

### 5. Comparador de pilotos (aba dentro de `/prototipos`)
Estende `_app.prototipos.tsx` adicionando uma aba "Comparar": selecionar 2-3 protótipos do mesmo produto e ver lado a lado (foto, fit, custo, materiais, decisão). Reusa dados já carregados. Sem nova rota.

### 6. Componente `<AICoordinatorPanel persona="dev|pcp|marketing"/>`
Reutilizável em qualquer tela. Chama `askDevelopment`/`askPcp`/`askMarketing` (já existem em `ai-insights.functions.ts`) com contexto da página atual. Renderiza:
- Lista de 3 alertas proativos com **motivo** (não só número).
- Botão "Ação rápida" quando aplicável (ex: gerar OP, abrir kanban, contatar fornecedor).

## Arquivos

```
src/
├── components/
│   ├── ai-coordinator-panel.tsx          (novo, reutilizável)
│   └── command-center-ops.tsx            (novo, usado na home)
├── routes/_authenticated/
│   ├── _app.index.tsx                    (estende — troca KPIs)
│   ├── _app.war-room-colecao.$id.tsx     (novo)
│   ├── _app.war-room-producao.tsx        (novo)
│   ├── _app.onde-esta.tsx                (novo)
│   └── _app.prototipos.tsx               (estende — aba Comparar)
└── lib/
    └── traceability.functions.ts         (novo — getOrderTimeline)
```

## Garantias
- Nenhuma tabela nova, nenhuma migration.
- Nenhuma rota antiga removida.
- IA continua via Lovable AI Gateway (sem chave do usuário).
- Cada nova tela cabe em 1 viewport, ação principal em ≤2 cliques.
- Sem dados financeiros/fiscais — tudo PLM/operacional.

## Ordem de execução
1 → 6 → 4 → 2 → 3 → 5. O componente IA (item 6) vem cedo porque os War Rooms o consomem.

Posso começar pelo item 1 (Command Center operacional) + item 6 (AICoordinatorPanel) em paralelo?
