# Plano — USE MODA PLM 100% funcional

## 1. Diagnóstico atual (o que já existe)

Após Ondas 1–8 o projeto tem a fundação certa para PLM moda:

- **Menu reorganizado** em 9 grupos PLM (`src/lib/modules.ts`), com ERP-mirror separado.
- **Núcleo de dados**: `collections`, `collection_versions`, `products`, `prototypes`, `tech_sheets`, `production_orders`, `production_batches`, `service_orders` (com `kind=parcial`), `production_stage_log`, `pcp_stages` (configuráveis), `marketing_campaigns`, `influencers`, `suppliers`, `inventory_items`.
- **Camada ERP**: `erp_sales_mirror` / `erp_purchase_mirror` / `erp_inventory_mirror` + `src/lib/erp/`.
- **Triggers úteis ativos**: protótipo aprovado → OP, mudança de stage → log, OS recebida → log + avanço, ficha aprovada → custo do produto, movimentos → saldo. Triggers ERP-duplicantes desativados.
- **Auth + RLS por `owner_id`** + roles (`has_role`), `handle_new_user` semeia perfil/role/stages.

## 2. Lacunas que impedem "100% PLM"

Identifiquei 6 grupos de lacunas — cada um vira uma onda nova (9 a 14).

### Onda 9 — Tech Pack completo (núcleo do PLM)
Hoje `tech_sheets` é apenas um cabeçalho com `cost_price` e `status`. Falta o coração do PLM.
- Tabelas filhas: `tech_sheet_materials` (BOM: insumo, consumo, unidade, perda %, custo), `tech_sheet_operations` (operação, SAM/SMV, máquina, valor), `tech_sheet_measurements` (POM: ponto, tolerância +/-, valores por tamanho), `tech_sheet_labels` (etiquetas, composição, cuidados), `tech_sheet_attachments` (CAD/imagem/PDF).
- Recalcular `cost_price` automaticamente a partir de BOM + operações via trigger.
- UI em abas dentro de `/ficha-tecnica/:id`: Resumo · BOM · Operações · Medidas · Etiquetas · Anexos · Custos.

### Onda 10 — Grade, cor e SKU
PLM moda exige variantes (cor × tamanho).
- `product_color_options`, `product_size_options`, `product_variants` (SKU, EAN, cor, tamanho, ativo).
- `production_order_grid` (qty por variante) e `service_order_grid` (passagem por variante).
- UI no `/produtos/:id` aba "Grade" + integração no PCP Kanban e nos lotes.

### Onda 11 — Cadeia & qualidade
- `supplier_capabilities` (corte, costura, estamparia, lavanderia…) e `supplier_compliance` (certificações, vencimento).
- `quality_inspections` (AQL, amostra, defeitos, aprovado/refação) ligadas a OP/OS e protótipo.
- UI `/qualidade` lista + drawer + exporta laudo.

### Onda 12 — DPP (Digital Product Passport) real (ESPR-ready)
Rota `/dpp/:id` já existe; falta dado.
- Página pública com QR code (rota pública `/p/dpp/:id`), composição, origem, fornecedores, instruções de cuidado, reparabilidade, certificações.
- `dpp_records` versionado por produto/variante + assinatura (hash) e log de visualizações.

### Onda 13 — Integração ERP viva
- Webhook público `POST /api/public/erp-sync` com HMAC + Zod, escreve em `erp_*_mirror` via `supabaseAdmin`.
- Server fns `pullErpSnapshot` / `pushPlmRelease` (release de ficha aprovada → item master ERP) sob `requireSupabaseAuth` + `has_role('admin')`.
- Painel `/erp-integration` com último sync, erros, fila.

### Onda 14 — Polimento operacional
- Realtime no Command Center (já preparado) ligado a `production_stage_log`, `pilots`, `prototypes`.
- Notificações (`notifications` table + bell): aprovação pendente, OS atrasada, ficha sem BOM, piloto vencendo.
- Permissões finas por papel (designer / modelista / pcp / qualidade / admin) usando `has_role` em todas as server fns de escrita sensível.
- Export PDF do tech pack e do DPP.
- Testes E2E mínimos: criar coleção → produto → protótipo aprovado → OP gerada → OS parcial → fechamento.

## 3. Como vou executar

Cada onda será um PR independente, na ordem 9 → 14. Para cada uma eu:
1. Crio a migração (tabelas + GRANT + RLS por `owner_id` + triggers).
2. Adiciono server fns (`*.functions.ts`) com `requireSupabaseAuth` + role-check onde necessário.
3. Atualizo/crio rota(s) com `head()`, loader via TanStack Query, `errorComponent`/`notFoundComponent`.
4. Atualizo `docs/AUDIT.md` marcando o item como ✅.
5. Não removo rotas/tabelas legadas — só completo, esconde ou redireciona leitura.

## 4. Premissas

- Stack: TanStack Start + Lovable Cloud + RLS por `owner_id` (mantida).
- ERP continua dono de financeiro/fiscal/CRM — PLM só lê via `erp_*_mirror`.
- Sem refactor de design system; uso tokens existentes (`glass`, `primary`, etc).
- Não criamos Edge Functions; toda lógica em `createServerFn` ou rota server (`/api/public/*` só para webhooks ERP).

## 5. O que **não** está no escopo

- Substituir o ERP (financeiro, fiscal, CRM, contas a pagar/receber).
- Trocar autenticação/stack.
- Editor 3D (CLO/Browzwear) — fica como roadmap.

## 6. Sugestão de próximo passo

Começar pela **Onda 9 (Tech Pack completo)** — é o que mais diferencia um PLM de moda de qualquer outro sistema e destrava as ondas 10–14 (grade depende de BOM, DPP depende de composição, qualidade depende de POM).

Confirma começar pela Onda 9? Se preferir outra ordem ou quiser ondas adicionais (ex.: 3D, sustentabilidade scoring Higg, sourcing RFQ), me diga antes de eu executar.
