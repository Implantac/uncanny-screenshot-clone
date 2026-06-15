## Diagnóstico atual

A Onda 1 do reposicionamento **já está implementada** no projeto:

- `docs/AUDIT.md` cataloga todos os módulos com classe (PLM-core / PLM-suporte / ERP-mirror / Wip) e status (Funcional / Parcial / Incompleto).
- `src/lib/modules.ts` reagrupa o menu em 9 grupos PLM: Operação, Coleções, Desenvolvimento, PCP & Produção, Cadeia (PLM), Marketing, Inteligência, ERP (Integração), Plataforma.
- Módulos financeiros/comerciais (financeiro, cashflow, comercial, clientes, representantes, pedidos-compra, movimentações) foram marcados `hidden: true` — **rotas preservadas**, apenas saem do sidebar PLM.
- Módulos ERP-mirror restantes (attribution, sales-performance, margem, profitability) ficam visíveis no grupo "ERP (Integração)" com badge **ERP** no menu.
- Triggers de duplicação com ERP catalogados em `AUDIT.md` para desativação na Onda 8 (preservam dados existentes até lá).

Diretriz "não remover, só reorganizar" está sendo respeitada.

## Plano de execução por ondas

Cada onda é um PR independente. Nenhuma onda apaga rotas/tabelas — só esconde, completa ou redireciona leitura para ERP.

### Onda 2 — Command Center operacional
Substituir KPIs financeiros do `/` por KPIs operacionais:
- Coleções (em desenvolvimento / aprovadas / em produção)
- Produtos (pesquisa / modelagem / piloto / aprovados)
- Produção (lotes ativos / atrasados / setores em gargalo)
- Alertas (produtos sem ficha, pilotos pendentes, lotes parados)
- Timeline operacional em tempo real (via `production_stage_log` + realtime).

### Onda 3 — Coleções como núcleo
`/colecoes/:id` ganha abas: Planejamento · Moodboard · Tendências · Produtos · Cronograma · Status · Performance. Criação de produto/protótipo passa a nascer **dentro** de uma coleção.

### Onda 4 — Lotes multi-referência + passagens parciais
- `production_batches` aceita N referências por lote (já existe a tabela; falta UI e regra de negócio).
- `service_orders` já suporta `kind = 'parcial'` com `qty_received` — completar UI no `/pcp-kanban` e `/lotes` para movimentação por pacote / grade / quantidade.
- Rastreabilidade: tela "onde está cada peça/lote/referência" consumindo `production_stage_log`.

### Onda 5 — Stages PCP configuráveis por empresa
Hoje os stages são enum fixo. Criar `pcp_stages` (por owner, ordenável) e refatorar `production_orders.stage` para FK textual. Migração preserva dados atuais mapeando enum → linhas default.

### Onda 6 — Marketing / Influencers / Geo consumindo ERP
- `/marketing`, `/influencer-roi`, `/geo-sales` passam a ler de `erp_sales_mirror` (criada na Onda 7).
- `/influencers`: baseline antes/depois da campanha calculada sobre vendas do ERP.

### Onda 7 — Camada de integração ERP
- `src/lib/erp/` com client + tipagens.
- Tabelas `erp_*_mirror` (sales, customers, orders) populadas por job/webhook.
- Server functions com `requireSupabaseAuth` para leitura; nada de escrita financeira no PLM.

### Onda 8 — Limpeza de duplicações (com aprovação caso a caso)
Desativar triggers:
- `b2b_orders_to_financial_account`
- `purchase_orders_to_financial_account`
- `purchase_orders_to_stock_entries`

E avaliar remoção definitiva das rotas hidden quando o ERP estiver integrado.

## Detalhes técnicos

- Stack mantida: TanStack Start + Supabase + RLS por `owner_id`.
- Toda nova leitura ERP via `createServerFn` + `requireSupabaseAuth` (sem expor service role).
- Realtime do Command Center via `useRealtime("production_stage_log", ...)`.
- Nenhuma migração desta etapa apaga tabelas; apenas adições (`pcp_stages`, `erp_*_mirror`) e flags.
- Menu segue dirigido por `src/lib/modules.ts`; `hidden: true` é o mecanismo oficial de ocultar sem quebrar links.

## O que NÃO faremos
- Não recriar Financeiro/Fiscal/CRM/Tesouraria no PLM.
- Não apagar rotas existentes nesta fase — só esconder.
- Não trocar a stack nem o design system.

## Próximo passo sugerido
Começar pela **Onda 2 (Command Center operacional)** — é a mudança mais visível do reposicionamento e não depende de integração ERP. Confirma?
