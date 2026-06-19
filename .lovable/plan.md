# Sprint 1 — Fundamento: Carry-Over + NOS (Never Out of Stock)

## Por que começar aqui

Os 3 pilares discutidos (Estrutura de Dados, Assortment, Lifecycle) dependem de **um único pré-requisito**: desacoplar `produto` de `coleção`. Hoje `products.collection_id` é 1:N — isso impede um básico de viver em 4 coleções sem virar 4 SKUs diferentes. Sem resolver isso, Assortment Plan e State Machine herdam o problema.

Esta sprint **evolui** o schema existente (não substitui). `collections`, `products`, `product_variants`, `product_color_options`, `product_size_options` permanecem. Adicionamos 2 tabelas e migramos o vínculo.

## O que muda no schema

### 1. Nova tabela `collection_products` (N:N)

Ponte produto↔coleção com papel e origem.

| Campo | Tipo | Papel |
|---|---|---|
| `collection_id`, `product_id` | FK | chave composta |
| `role` | enum `hero` \| `carry_over` \| `nos` \| `capsule` \| `regular` | classifica o papel do produto naquela coleção |
| `source_collection_id` | FK nullable | de onde veio (carry-over) |
| `intro_season` | text | primeira temporada que apareceu (NOS preserva) |
| `channel_exclusive` | text[] nullable | trava em canais específicos |
| `display_order` | int | ordenação no line plan |

### 2. Nova tabela `product_lifecycle`

Estado do produto **por coleção** (separado do `products.status` global).

| Campo | Tipo |
|---|---|
| `product_id`, `collection_id` | FK composta |
| `state` | enum `planned` \| `active` \| `markdown` \| `discontinued` \| `nos_permanent` |
| `replenishment_policy` | jsonb nullable (`{min, max, lead_time_days}` para NOS) |
| `markdown_pct` | numeric nullable |
| `state_changed_at` | timestamptz |

### 3. Migração de `products.collection_id`

- Manter a coluna por compatibilidade (depreciar, não remover ainda).
- Backfill: cada `product` existente vira uma linha em `collection_products` com `role='regular'`.
- Código novo lê de `collection_products`; código antigo continua funcionando.

### 4. GRANTs + RLS

Padrão do projeto: `GRANT` para `authenticated`/`service_role`, RLS por `owner_id` (herdado via join com `collections`).

## O que muda no código (mínimo viável)

| Arquivo | Mudança |
|---|---|
| `src/lib/collection-intelligence.functions.ts` | trocar `products.eq('collection_id', ...)` por join com `collection_products`; expor `role` no payload |
| `src/routes/_authenticated/_app.fashion-calendar.tsx` | contagem de produtos via `collection_products` |
| `src/routes/_authenticated/_app.approvals.tsx` | sem mudança nesta sprint |
| Nova função `src/lib/carry-over.functions.ts` | `addCarryOver(productId, fromCollectionId, toCollectionId)` — cria entrada em `collection_products` + `product_lifecycle` em `planned` |
| Componente novo `CarryOverPanel` na página de coleção | lista produtos da coleção anterior com checkbox "trazer para esta" |
| Badge no `ProductGallery` quando `role='carry_over'` ou `'nos'` | leitura visual instantânea (regra de ouro: 2 cliques) |

## O que NÃO entra nesta sprint

- Assortment Plan por canal — Sprint 2
- State machine de `collections.status` com triggers — Sprint 3
- Tela de Line Plan visual (kanban de slots) — Sprint 2
- Remoção da coluna `products.collection_id` — depreciar agora, remover daqui a 2 sprints

## KPIs que esta sprint destrava

- **% de carry-over por coleção** (saúde do mix novo vs. continuidade)
- **# de SKUs NOS ativos** e cobertura de estoque por dias
- **Lifetime de produto** (em quantas coleções viveu — métrica de campeão)
- **Margem por papel** (`hero` vs. `carry_over` vs. `nos`) — geralmente NOS é mais margem

## IA-Coordenadora ganha 2 novos insights

1. *"Camiseta básica preta foi top 5 em 3 coleções seguidas — promover para NOS permanente?"* (baseado em `erp_sales_mirror` + lifetime)
2. *"Coleção Verão 26 tem 0% de carry-over. Coleções com <15% costumam ter -22% de sell-through nas 4 primeiras semanas."* (baseado em histórico)

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Quebrar telas que leem `products.collection_id` | Manter coluna + backfill; migrar leitores incrementalmente |
| ERP sync espelha SKU em coleção errada | `erp_sales_mirror` não muda; join com `collection_products` é só na leitura |
| Confusão entre `products.status` e `product_lifecycle.state` | `products.status` = ciclo do molde (rascunho/ativo/arquivado); `product_lifecycle.state` = ciclo comercial por coleção. Documentar |

## Próximas sprints (preview)

- **Sprint 2 — Assortment Plan:** tabela `assortment_plan(channel, collection, family, target_skus, target_units, target_revenue)` + Line Plan visual + OTB básico.
- **Sprint 3 — Lifecycle automatizado:** triggers Postgres para transições de `collections.status` + ações automáticas (gerar OPs em rascunho, push e-commerce, sugerir markdown via IA).

---

**Aprovando este plano, eu executo a migração + ajustes mínimos de código numa única passada.** Sprints 2 e 3 ficam para mensagens separadas — cada uma é um bloco coeso e isolado.
