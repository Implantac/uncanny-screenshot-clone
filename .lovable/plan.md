
# Evolução incremental do USE MODA PLM

Filosofia: **melhorar sem destruir, reutilizar antes de criar, reduzir cliques**. Nada do que já existe será removido — apenas estendido.

## Diagnóstico do que já existe (reutilizar)

| Pronto hoje | Como será reaproveitado |
|---|---|
| `intel-hub.tsx` (257 linhas) | Vira host das 3 IAs (Desenvolvimento / PCP / Marketing) em abas |
| `fashion-gpt.tsx` + `fashion-context.ts` | Camada de prompt já especializada — passa a ler dados reais via novas server fns |
| `marketing-ai.functions.ts`, `pcp-ops.functions.ts`, `agents.functions.ts` | Base para os endpoints de insight; ganham handlers novos sem quebrar os atuais |
| `replenishment.tsx` (140 linhas) | Recebe o motor inteligente (hoje só estoque mínimo) |
| `control-tower.tsx` (345 linhas, com WIP/gargalos realtime) | Já é a base da "sala de guerra"; ganha aba "Coleção" |
| `colecao-360.tsx` (255 linhas) | Vira a Sala de Guerra por coleção — sem nova rota |
| `producao-do-dia.$stage.tsx` | Ganha colunas de prioridade/prazo/tempo previsto |
| `quick-pass.tsx` | Já entrega passagem parcial/integral em 2 cliques — só falta variante por grade/pacote |
| `product-score.tsx` | Vira fonte do Score de Prioridade (estende fórmula) |

## Entregas (4 ondas, todas incrementais)

### Onda A — Camada de IA especialista (3 personas, 1 tela)
- Server fn nova `src/lib/ai-insights.functions.ts` com 3 handlers: `askDevelopment`, `askPcp`, `askMarketing`. Cada um monta contexto real (queries `production_orders`, `prototypes`, `tech_sheets`, `erp_sales_mirror`) e chama Lovable AI Gateway (`google/gemini-3-flash-preview`) via helper `ai-gateway.server.ts` já existente.
- `intel-hub.tsx` ganha 3 abas: **Desenvolvimento**, **PCP**, **Marketing**, cada uma com chat curto + lista de perguntas pré-prontas (atrasos, gargalos, pilotos pendentes, ROI por produto, etc.).
- Nada é recriado: `fashion-gpt.tsx` permanece como chat livre.

### Onda B — Motor inteligente de necessidade de produção
- Server fn `computeReplenishmentNeeds()` em `src/lib/replenishment.functions.ts`:
  - Lê `erp_inventory_mirror`, `erp_sales_mirror` (7/30/90d), `production_orders` em curso, `product_target_costs`, `product_variants`.
  - Para cada SKU calcula: velocidade de venda, cobertura em dias, risco de ruptura, excesso, lead time, rentabilidade.
  - Retorna **Score de Prioridade 0–100** + motivos (lista de strings) + sugestão de quantidade.
- `replenishment.tsx` passa a renderizar a tabela com: produto, prioridade, motivos, sugestão, ação "Gerar OP" (já existe via `pcp-ops.functions.ts`).
- Cálculo por grade (PP/P/M/G/GG/XG/XXG) a partir de `product_size_options` × histórico real em `erp_sales_mirror.items` (sem divisão proporcional).

### Onda C — Sala de Guerra da Coleção
- Estende `colecao-360.tsx` (sem nova rota): adiciona 6 cards consolidados em uma única tela — produtos em dev, pilotos pendentes, sem ficha, liberados, lotes em produção, campeões/críticos. Reutiliza queries já existentes.
- Aba "Marketing" puxa `marketing-ai.functions.ts` (investimento, ROI, sell-out por coleção — só leitura ERP).

### Onda D — Produção do Dia + Passagens
- `producao-do-dia.$stage.tsx`: ordenar por Score de Prioridade da Onda B; adicionar colunas Prazo, Tempo Previsto (de `tech_sheet_operations.minutes`), Responsável.
- `quick-pass.tsx`: adicionar toggle de modo (Integral / Parcial / Por Pacote / Por Grade) sem sair do popover atual — máx. 2 cliques.

## O que NÃO faremos (proteções)
- Não criar tabelas financeiras, fiscais, de pedidos B2B ou de clientes — tudo isso já é ERP-mirror.
- Não tocar em `marketing.tsx`, `campaigns.tsx`, `influencers.tsx` além de plugar os mesmos insights via Onda A.
- Não remover rotas legadas (auditoria anterior já marcou `hidden` as órfãs).
- Não trocar provider de IA (continua Lovable AI Gateway, sem chave do usuário).

## Detalhes técnicos

```
src/lib/
├── ai-insights.functions.ts        (novo) askDevelopment | askPcp | askMarketing
├── replenishment.functions.ts      (novo) computeReplenishmentNeeds + computeGridNeeds
└── priority-score.ts               (novo) puro, testável — fórmula do score 0-100

src/routes/_authenticated/
├── _app.intel-hub.tsx              (estende) 3 abas de IA
├── _app.replenishment.tsx          (estende) motor + tabela com score
├── _app.colecao-360.tsx            (estende) sala de guerra (6 cards)
└── _app.producao-do-dia.$stage.tsx (estende) ordenação por score
```

Fórmula do Score (`priority-score.ts`):
```
score = 0.30*sellOutVelocity + 0.25*margin + 0.20*ruptureRisk
      + 0.15*abcWeight       + 0.10*seasonality
```
Cada componente normalizado 0–1. Motivos são as 3 maiores contribuições.

## Ordem sugerida de execução

1. **Onda A** (IA × 3) — maior impacto percebido, baixo risco.
2. **Onda B** (motor de necessidade + score) — base para C e D.
3. **Onda C** (Sala de Guerra) — usa dados de A+B.
4. **Onda D** (Produção do Dia + Passagens) — polimento operacional.

Posso começar pela Onda A?
