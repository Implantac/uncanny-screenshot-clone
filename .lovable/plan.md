# Evolução USE Fashion → Enterprise Fashion OS

**Princípio absoluto:** evoluir, nunca reconstruir. Nenhuma rota removida, nenhuma tabela renomeada, nenhuma tecnologia trocada. Cada onda entrega valor visível e roda em produção antes da próxima começar.

## Estado atual (auditoria resumida)

O sistema já cobre 100+ rotas em 12 domínios. O que existe funciona; o que falta é **conexão entre módulos** e **regras de negócio que atravessam setores**.

| Domínio | O que existe (reusar) | Gap enterprise (evoluir) |
|---|---|---|
| **Produto** | `products`, `/produtos`, `/produto/$id` (workspace criado na última turn), `product_lifecycle`, `product_families`, `product_lines` | Workspace ainda é agregador visual — falta contrato de estados e transições |
| **Engenharia / Ficha** | `tech_sheets` + materials/operations/measurements + versões imutáveis + snapshot em aprovação | Sem gate obrigatório antes de OP; custo propaga mas não bloqueia |
| **Protótipos** | `prototypes`, `prototype_gates` (gate → stage promotion), handoff timeline | Gates existem mas não conversam com o workflow global do produto |
| **PCP / Produção** | `production_orders` com stages Compras→…→Acabamento, kanban, APS, MRP, reservas de material, ERP sector sync (890+ OPs reais) | OPs podem ser criadas sem ficha aprovada — trigger só reserva material *se* houver ficha |
| **Qualidade** | `quality_inspections`, `quality_capa` + auto-CAPA por inspeção reprovada e envio a influenciador | CAPA não bloqueia liberação do produto |
| **Suppliers / Compras** | `suppliers`, `supplier_capabilities`, `supplier_capacity`, `supplier_compliance`, portal com token, `purchase_orders` → financeiro + estoque | Compliance vencido não bloqueia PO |
| **MRP** | `mrp_recalc_queue` + triggers de estoque/ERP + `mrp-recalc` hook | OK — reusar |
| **Marketing** | `marketing_briefs` auto-criado no `lancamento`, `marketing_campaigns`, ROI por SKU | OK — reusar |
| **BI / IA** | 20+ painéis (`ai-coordinator`, `persona-insights`, `dev-intelligence`, `pcp-intelligence`, `quality-intelligence`, `marketing-intelligence`, `executive-kpis`) via Lovable AI Gateway | IA hoje é **reativa** (usuário clica → gera). Falta camada **contínua** que grava sugestões |
| **Timeline / Audit** | `audit_logs` + `log_audit()` SECURITY DEFINER, `ProductTimeline` component, `production_stage_log`, `prototype_handoff_events`, `tech_sheet_versions` | Cada domínio tem sua timeline — falta view unificada por produto |
| **Alertas** | `alerts-center` (18) agrega 6 fontes | OK — plugar workflow engine como 7ª fonte |
| **Segurança** | RLS + GRANT em toda tabela pública, `has_role`, `has_sector`, findings recorrentes já corrigidos | Manter — cada nova tabela segue o padrão |

**Duplicações detectadas (não reconstruir, consolidar aos poucos):**
- `_app.pcp-kanban.tsx` e `_app.dev-kanban.tsx` compartilham drag-and-drop → extrair `useKanbanDnd` hook em onda 4.
- `product-timeline.tsx` e `prototype-timeline.tsx` têm mesmo shape → unificar em onda 3 sem quebrar assinatura pública.

## Ondas de entrega

Cada onda é fechada, testável, publicável. Nada depende da próxima.

### Onda 1 — Workflow Engine + Stage Gates (fundação)
Nova tabela `product_workflow_states` + `product_stage_gates` + função `can_advance_product(product_id, target_state)` que valida requisitos (BOM, ficha aprovada, custo, medidas, protótipo aprovado, fornecedor, compliance vigente). Trigger em `product_lifecycle` chama `can_advance_product` antes de transitar. Novo componente `<StageGateBadge>` no `_app.produto.$id.tsx` mostra requisitos verdes/pendentes. **Reusa** `product_lifecycle` já existente — só adiciona validação.

### Onda 2 — Timeline unificada por produto
View `v_product_events` UNION ALL sobre `audit_logs`, `production_stage_log`, `prototype_handoff_events`, `tech_sheet_versions`, `stock_movements` filtrando por `product_id`. Aba "Timeline" do workspace passa a ler dela em vez de agregar client-side. Cada evento traz who/when/what/old→new. Zero nova UI — só troca a fonte.

### Onda 3 — Workspace conectado (evolução do aggregator atual)
Adicionar ao `_app.produto.$id.tsx`:
- Header "Próximo passo" calculado do workflow engine (onda 1).
- KPIs contextuais (margem real vs alvo, dias no estágio, blockers ativos).
- Aba "Suppliers" listando fornecedores capazes (via `supplier_capabilities`) + compliance status.
- Aba "MRP" mostrando faltas para este SKU vindo do `mrp_recalc_queue`.
- Deep-links contextuais: cada aba abre o módulo original com filtro pré-aplicado.

### Onda 4 — AI Contínua
Nova tabela `ai_recommendations(product_id, kind, severity, title, rationale, suggested_action, created_at, dismissed_at)`. Cron `/api/public/hooks/ai-scan` roda a cada 6h, itera produtos ativos, chama Gateway (`google/gemini-2.5-flash`) com contexto (margem, lead time, qualidade, vendas) e grava sugestões. Widget "Recomendações IA" no workspace + integração com Central de Alertas (fonte 7). Reusa `createLovableAiGatewayProvider`.

### Onda 5 — Contextual UX
- Wizard "Novo produto" (4 passos: identidade → ficha → protótipo → fornecedor) usando os fluxos que já existem, apenas encadeados.
- Command palette (`command-palette.tsx` já existe) ganha ações contextuais por produto.
- Extrair `useKanbanDnd` compartilhado entre PCP e Dev kanban.

### Onda 6 — Endurecimento enterprise
- Audit log obrigatório em cada mutation nova (via trigger, padrão já usado em `tech_sheets_stamp_approval`).
- Permissões por estágio: `has_sector` estendido para verificar responsabilidade de aprovação.
- Acessibilidade: revisar contraste + navegação por teclado nas telas de workspace/kanban.

## Regras invioláveis durante toda a execução

1. **Nada de mock/seed/fake** — `scripts/check-no-mocks.mjs` bloqueia build.
2. **RLS + GRANT em toda nova tabela**, na mesma migration.
3. **Nenhuma escrita no ERP** — permanece read-only (`default_transaction_read_only=on`).
4. **Nenhuma edge function nova** — tudo via `createServerFn` ou rota `/api/public/*`.
5. **Nenhum arquivo em `src/routes/_authenticated/route.tsx`** (integration-managed).
6. **Cada nova rota tem `head()` próprio** com title/description únicos.
7. **Reusar componentes existentes** (`PageHeader`, `EmptyState`, `ErrorState`, painéis de IA) — nunca duplicar.

## Onde começar

Onda 1 é a única que destrava as outras. Vou abrir com a migration do workflow engine + stage gates, depois o `<StageGateBadge>` no workspace de produto. Aprova?
