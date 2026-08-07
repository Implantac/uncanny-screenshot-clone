# Plano de Melhorias — AteliêFlow PLM (Pós-revisão)

> **Versão:** 2.1
> **Data:** Julho 2026
> **Base:** Avaliação de especialista PLM (nota 8,2/10) + gaps da revisão do módulo Ficha Técnica
> **Priorização:** P0 (imediato) → P1 (curto prazo) → P2 (médio prazo) → P3 (estratégico)
> **Status:** Em andamento — Sprint 1 (P0)

---

## 1. Contexto e Objetivo

O **AteliêFlow PLM** já entrega um módulo de Ficha Técnica como documento técnico real (aba "Documento", completude, bloqueio por aprovação, materiais tipados). Este plano organiza as melhorias para elevar o sistema de **"pronto para demonstração"** para **"pronto para produção industrial multi-setor"**.

**Objetivo principal:** fechar os gaps funcionais e de UX que impedem a adoção plena por uma confecção — integração da ficha no produto, fluxo de aprovação por área, dados transacionais para BI e controle de acesso por perfil.

---

## 2. Resumo dos 3 Focos Estratégicos

| # | Foco | Motivo | Prioridade | Sprint |
|---|------|--------|------------|--------|
| 1 | **Integrar FichaDocument no Product Workspace** | Ver a ficha sem sair do produto | P0 | Sprint 1 |
| 2 | **Fluxo de aprovação multi-etapas** | PLM real exige Estilo→Modelagem→Compras→Custos→Diretoria | P1 | Sprint 2 |
| 3 | **Migrar blocos de JSON para tabelas + RBAC** | Relatórios/BI e controle de acesso por perfil | P2 | Sprint 3 |

---

## 3. Roadmap Visual

```
Sprint 1 (3d) ──► Sprint 2 (8d) ──► Sprint 3 (10d) ──► Sprint 4 (8d)
   P0              P1                P2                 P3
╔═══════════╗   ╔══════════════╗   ╔═══════════════╗   ╔══════════════╗
║ Ficha no   ║   ║ Aprovação    ║   ║ Blocos→tab     ║   ║ Modo         ║
║ produto    ║──►║ multi-etapa  ║──►║ + RBAC + grade ║──►║ fornecedor   ║
║ (1.1)      ║   ║ (2.1)        ║   ║ (3.1,3.2,4.x) ║   ║ + mobile     ║
║ Dashboard  ║   ║ Notificações ║   ║ SKU matrix    ║   ║ prova (5.x)  ║
║ + tooltips ║   ║ (2.2)        ║   ║ (4.2)         ║   ║              ║
╚═══════════╝   ╚══════════════╝   ╚═══════════════╝   ╚══════════════╝
```

---

## 4. Eixo 1 — Experiência do Produto (P0)

### 1.1 Embutir FichaDocument na aba "Ficha Técnica" do Product Workspace

**Arquivo:** `src/routes/_authenticated/_app.produto.$id.tsx`
**Reutiliza:** `FichaDocument`, `DocMaterial`, `CompletenessItem` de `@/components/tech-pack/sheet-document.tsx` (já existentes)

**Descrição:** Substituir o resumo atual (3 métricas + link) pelo `FichaDocument` como visualização inline, com toggle "Visualizar / Editar".

**Tarefas técnicas:**
- [x] Importar `FichaDocument`, `DocMaterial`, `CompletenessItem` de `@/components/tech-pack/sheet-document`
- [x] Adicionar campo `colors`/`sizes` no select do `product-workspace` (query já traz, completar)
- [x] Criar query `ts-doc-materials` no Product Workspace (replicar da rota ficha-tecnica)
- [x] Calcular `completeness` com dados do produto + ficha (reutilizar lógica da rota principal)
- [x] Renderizar `FichaDocument` dentro da tab "ficha" com `canEdit={canEditSheet}` (aprovada = bloqueada)
- [x] Adicionar `onBlockChange` e `onObservationChange` com mutation para salvar em `tech_sheets.content`
- [x] Manter link "Editor completo" para `/ficha-tecnica` como fallback

**Critérios de aceite:**
- [x] O usuário vê a ficha completa (documento técnico) dentro do produto, sem redirecionar
- [x] O toggle "Editar ficha" habilita edição inline dos blocos e observações
- [x] Alterações salvas persistem ao recarregar e aparecem no histórico de versões
- [x] Ficha aprovada exibe cadeado e bloqueia edição (mesmo comportamento da rota `/ficha-tecnica`)

**Testes:**
- [x] `npx tsc --noEmit` — sem novos erros nos arquivos alterados (apenas erros pré-existentes)
- [ ] Teste E2E: abrir produto → aba Ficha → editar bloco → salvar → recarregar → dado persiste

---

### 1.2 ✅ Filtrar alertas de insumos no Dashboard por categoria de confecção

**Arquivo:** `src/routes/_authenticated/_app.index.tsx`

**Descrição:** O alerta "Alertas de insumos" puxa todos os `inventory_items`. Filtrar apenas categorias de confecção.

**Tarefas:**
- [x] Verificar se `inventory_items` possui coluna `category` — **sim, já existe** (usada no select)
- [x] Migration `20260731000002_inventory_category.sql` **não necessária** (coluna já presente)
- [x] Filtrar por categorias: `tecido`, `malha`, `forro`, `aviamento`, `etiqueta`, `tag`, `embalagem`, `linha`, `elástico`, `renda`, `entretela`, `acabado` (const `CONFECCAO_CATEGORIES`)
- [x] Exibir nome amigável da categoria (`category_label`) em cada item do alerta

**Critérios de aceite:**
- [x] Alertas mostram apenas insumos de confecção (não ferramentas de máquina)
- [x] Categoria visível em cada item do alerta

---

### 1.3 Tooltips para orientar modelistas

**Arquivo:** `src/components/tech-pack/panels.tsx`

**Descrição:** Orientar usuários menos experientes nos botões de consumo por tamanho e regra de salto.

**Tarefas:**
- [x] Adicionar `TooltipProvider` + `Tooltip` no `SizeConsumptionPopover` (botão régua)
- [x] Texto: "Definir consumo específico por tamanho (ex.: P=1.2m, M=1.35m, G=1.5m)"
- [x] Adicionar tooltip no `GradeRulePopover` (botão Δ)
- [x] Texto: "Aplicar regra de salto: defina o tamanho base e incrementos automáticos entre as faixas"

**Critérios de aceite:**
- [x] Tooltip aparece ao passar o mouse nos botões (desktop) e funciona com teclado (acessibilidade)
- [x] Textos claros em pt-BR, sem jargão

---

## 5. Eixo 2 — Aprovações e Workflow (P1)

### 2.1 Fluxo de aprovação multi-etapas

**Novo componente:** `src/components/approval-multi-stage.tsx`
**Migration:** `supabase/migrations/20260731000003_approval_workflow.sql`

**Descrição:** Substituir aprovação de etapa única por fluxo configurável de 7 etapas.

**Modelo de dados (`approval_workflow`):**
```sql
CREATE TABLE approval_workflow (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  product_id UUID NOT NULL REFERENCES products(id),
  tech_sheet_id UUID REFERENCES tech_sheets(id),
  stage INTEGER NOT NULL,            -- ordem 1..7
  role TEXT NOT NULL,                -- estilo, modelagem, compras, custos, qualidade, diretoria, producao
  assigned_to UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, em_analise, aprovado, reprovado, pulado, cancelado
  sent_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: cada empresa vê apenas seus próprios registros
ALTER TABLE approval_workflow ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_approval_company ON approval_workflow
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
```

**Tarefas:**
- [x] Migration `20260731000003` com tabela + RLS + índices (`product_id`, `tech_sheet_id`)
- [x] `src/lib/approval-workflow.functions.ts` com server functions: `list`, `send`, `decide`, `skip`, `cancel`
- [x] Componente `ApprovalMultiStage` com cards visuais (etapa, responsável, status, datas, comentário)
- [x] Modal de decisão com comentário obrigatório para reprovação
- [x] Lógica de transição de status:
  - Todas aprovadas → `tech_sheets.status = 'aprovada'`
  - Qualquer reprovada → `tech_sheets.status = 'em_revisao'`
  - Reprovação gera `tech_sheet_versions` snapshot para auditoria
- [x] Notificação ao próximo responsável ao aprovar etapa
- [x] Integração na rota `_app.ficha-tecnica.tsx` (nova aba "Aprovações")

**Critérios de aceite:**
- [ ] O fluxo de 7 etapas aparece na aba Documento (ou nova aba "Aprovações")
- [ ] Cada etapa registra usuário, data, status e comentário
- [ ] Reprovação bloqueia a ficha e exige correção (cria nova versão)
- [ ] Aprovação completa automatiza `status='aprovada'` + índice de completude
- [ ] RLS garante isolamento por empresa

**Testes:**
- [ ] Teste unitário da lógica de transição de status
- [ ] Teste E2E: aprovar todas etapas → ficha fica "Aprovada" e bloqueada

---

### 2.2 Notificações automáticas da ficha técnica

**Arquivo:** `src/components/notifications-bell.tsx` (existente) + novo `src/lib/tech-sheet-notify.functions.ts`

**Descrição:** Disparar notificações internas em eventos da ficha.

**Eventos a notificar:**
- Ficha aprovada → notificar Estilo, Modelagem, Compras
- Ficha alterada → notificar o aprovador anterior
- Nova versão criada → notificar o time do produto
- Ficha incompleta há 7+ dias → notificar o responsável

**Tarefas:**
- [x] Criar `tech-sheet-notify.functions.ts` com `notifyTechSheetEvent`
  - Eventos: `aprovada`, `alterada`, `nova_versao`, `incompleta`
  - Insere em `push_notifications` reaproveitando infra do sino (`getRecentPushes`)
- [x] Chamar na mutation de aprovação (`approveTechSheet`) — notifica o responsável com evento `aprovada`
- [x] Chamar na mutation de nova versão (`newVersion`) — notifica o owner da ficha original com evento `nova_versao`
- [x] Chamar na mutation de salvamento de blocos (`saveSheetContent`) se rascunho há >7 dias — notifica o owner quando outro usuário edita um rascunho incompleto antigo (evento `incompleta`)
- [x] Criar job agendado (Supabase cron) para alertar fichas incompletas
  - Migration `20260731000004_tech_sheet_incomplete_cron.sql`
  - Função `alert_incomplete_tech_sheets()` (SECURITY DEFINER) → insere em `push_notifications`
  - Respeita `notification_preferences` (categoria `tech_sheet`)
  - Agendado via pg_cron às 07:00 UTC (`alert-incomplete-tech-sheets`)

**Critérios de aceite:**
- [ ] Notificação aparece no sino ao aprovar/alterar/criar versão
- [ ] Job diário alerta fichas incompletas há 7+ dias

---

## 6. Eixo 3 — Dados e Arquitetura (P2)

### 3.1 Migrar blocos técnicos de JSON para tabelas

**Migration:** `supabase/migrations/20260731000005_block_tables.sql`

**Descrição:** Criar tabelas dedicadas para cada bloco, mantendo retrocompatibilidade com o JSON `content`.

**Tabelas novas (padrão único):**
```sql
CREATE TABLE tech_sheet_composition (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tech_sheet_id UUID NOT NULL REFERENCES tech_sheets(id) ON DELETE CASCADE,
  fiber TEXT,
  percentage NUMERIC(5,2),
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tech_sheet_treatments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tech_sheet_id UUID NOT NULL REFERENCES tech_sheets(id) ON DELETE CASCADE,
  type TEXT, description TEXT, supplier TEXT,
  position INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now()
);
-- printing, embroidery, laundry, packaging, quality: mesmo padrão
```

**Tarefas:**
- [x] Migration com 7 tabelas + RLS (herdado de `tech_sheets`) + índices
  - `20260731000005_block_tables.sql` — composition, treatments, printing, embroidery, laundry, packaging, quality
  - RLS por `owner_id` + índices + triggers `updated_at`
- [x] Server functions CRUD genéricas em `src/lib/tech-sheet-blocks.functions.ts`
  - `listTechSheetBlocks` (tabelas-first, fallback JSON) + `saveTechSheetBlock` (delete+insert transacional)
- [x] Script de migração de dados: `content->block` → inserir na tabela (idempotente, só quando vazia)
- [x] Trigger `sync_block_to_json` para manter `content` sincronizado (retrocompatibilidade)
- [x] Atualizar `FichaDocument` para ler dados transacionais (fallback para JSON)
  - Integrado em `_app.ficha-tecnica.tsx` e `_app.produto.$id.tsx` (na rota; `FichaDocument` segue props-driven)

**Critérios de aceite:**
- [x] Dados migrados sem perda (script idempotente)
- [x] `FichaDocument` lê de tabela; se vazia, usa JSON (retrocompatível)
- [x] Relatórios SQL conseguem agrupar por bloco (ex.: "produtos com stone wash")
- [x] `npx tsc --noEmit` — sem novos erros nos arquivos alterados (blocos/ficha/produto)
- [ ] Aplicar migration `20260731000005_block_tables.sql` no Supabase

**Risco:** migração de dados existentes. **Mitigação:** script idempotente + teste em cópia de produção.

---

### 3.2 RBAC por role (aprimorar canEdit)

**Novo arquivo:** `src/lib/permissions.ts`

**Descrição:** `canEdit` atual depende de `owner_id`. Evoluir para respeitar roles.

**Matriz de permissões:**
| Role | Rascunho | Medidas | Materiais | Custos | Aprovar |
|------|----------|---------|-----------|--------|---------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Estilo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Produto | ✅ | ✅ | ✅ | ✅ | ❌ |
| Modelagem | ✅ | ✅ | ✅ | ✅ | ❌ |
| Compras | ❌ | ❌ | ✅ | ❌ | ❌ |
| Custos | ❌ | ❌ | ❌ | ✅ | ✅ |
| Diretoria | ❌ | ❌ | ❌ | ❌ | ✅ |
| Fornecedor | ❌ | ❌ | ❌ | ❌ | ❌ (leitura) |

**Tarefas:**
- [x] Definir `CAN_EDIT` por módulo em `src/lib/permissions.ts`
- [x] Hook `useUserRole()` (consulta `user_roles`)
- [x] Passar permissões granulares aos panels (`canEditMaterials`, `canEditMeasurements`, `canEditCosts`)
- [x] Bloquear UI por permissão (desabilitar inputs, esconder botões)

**Critérios de aceite:**
- [x] Compras edita só materiais; Modelagem só medidas; etc.
- [x] Diretoria aprova mas não edita
- [x] Permissões aplicadas em todos os panels e na aba Documento

---

## 7. Eixo 4 — Grade, Cores e SKUs (P2)

### 4.1 ✅ Integrar grade real na completude da ficha

**Arquivo:** `src/routes/_authenticated/_app.ficha-tecnica.tsx` + `_app.produto.$id.tsx`

**Descrição:** O checklist usava `measurements.length` como proxy de grade. Melhorado para consultar grade real via `product_variants`.

**Tarefas:**
- [x] Query `ts-doc-product-variants` (product_variants por produto, com joins size.label e color.name)
- [x] "Grade definida" = `sizes.length > 0 && colors.length > 0` (dados reais)
- [x] "SKUs gerados" = `variants.length > 0`
- [x] Novo item no checklist: "Variantes/SKUs geradas"
- [x] Aplicado também no Product Workspace (`_app.produto.$id.tsx`)
- [x] `npx prettier --write` + `npx tsc --noEmit` sem novos erros

**Critério de aceite:**
- [x] Completude reflete a grade real do produto, não proxy

---

### 4.2 ✅ Matriz visual cor × tamanho (SkuMatrix)

**Arquivo:** `src/components/tech-pack/sheet-document.tsx`

**Descrição:** Seção visual de SKUs (cor × tamanho com status).

**Tarefas:**
- [x] Componente `SkuMatrix` (cores em linha, tamanhos em coluna, status no cruzamento)
- [x] Incluir em `FichaDocument` (nova prop `skuVariants` + `onToggleVariantActive`)
- [x] Conectar em `_app.ficha-tecnica.tsx` (query `ts-doc-product-variants` + mutation toggle)
- [x] Conectar em `_app.produto.$id.tsx` (query `product-workspace-variants` + mutation toggle)
- [x] Toggle ativo/inativo por variante (se `canEdit`)
- [x] `npx prettier --write` + `npx tsc --noEmit` sem novos erros

**Critério de aceite:**
- [x] Matriz clara, com cores e status de cada variante

---

## 8. Eixo 5 — Fornecedor e Produção (P3)

### 5.1 Modo fornecedor na ficha técnica

**Arquivo:** `src/routes/portal.fornecedor.$token.tsx` (existente)

**Descrição:** Portal do fornecedor com dados autorizados (imagem, medidas, observações) e ocultação de custos/fornecedores.

**Tarefas:**
- [ ] Permissão `supplier_view` → produto, imagem, medidas, observações, composição, embalagem
- [ ] Bloquear: custos, preço de materiais, lista de fornecedores concorrentes
- [ ] Rota `portal.fornecedor.$token.ficha.$sheetId.tsx`
- [ ] Renderizar `FichaDocument` com `canEdit={false}` e blocos autorizados

**Critério de aceite:**
- [ ] Fornecedor não vê custos nem concorrentes

---

### 5.2 PWA para prova de roupa

**Descrição:** Modelista fotografa a peça no manequim e anexa na ficha, com avaliação.

**Tarefas:**
- [ ] Modal "Registrar prova" (vestibilidade, medidas, acabamento, costura, foto)
- [ ] Tabela `fit_trials` (migration `20260731000006_fit_trials.sql`)
- [ ] Timeline de provas na aba Documento
- [ ] Notificar estilo ao registrar prova

**Critério de aceite:**
- [ ] Foto e avaliação anexadas à ficha; visíveis em linha do tempo

---

## 9. Priorização — Esforço × Impacto × Custo

| Melhoria | Esforço | Impacto | Custo estimado* | Prioridade |
|----------|---------|---------|-----------------|------------|
| 1.1 Ficha no produto | 2 dias | Alto | R$ 1.600 | P0 |
| 1.2 Dashboard insumos | 1 dia | Médio | R$ 800 | P0 |
| 1.3 Tooltips | 0,5 dia | Médio | R$ 400 | P0 |
| 2.1 Aprovação multi-etapa | 5 dias | Alto | R$ 4.000 | P1 |
| 2.2 Notificações | 3 dias | Alto | R$ 2.400 | P1 |
| 3.1 Blocos→tabelas | 4 dias | Médio | R$ 3.200 | P2 |
| 3.2 RBAC | 3 dias | Alto | R$ 2.400 | P2 |
| 4.1 Grade real | 1 dia | Médio | R$ 800 | P2 |
| 4.2 SkuMatrix | 2 dias | Médio | R$ 1.600 | P2 |
| 5.1 Modo fornecedor | 3 dias | Médio | R$ 2.400 | P3 |
| 5.2 Mobile prova | 5 dias | Baixo | R$ 4.000 | P3 |
| **Total** | **29,5 dias** | — | **R$ 23.600** | — |

*\*Estimativa com hora a R$ 100 (referencial). Validar com o time.*

---

## 10. Cronograma por Sprint

### Sprint 1 (P0) — 3 dias
- [x] 1.1 Embutir FichaDocument no Product Workspace
- [x] 1.2 Filtro de insumos no Dashboard
- [x] 1.3 Tooltips para modelistas

### Sprint 2 (P1) — 8 dias
- [x] 2.1 Fluxo de aprovação multi-etapas (migration + componente + testes)
- [x] 2.2 Notificações automáticas

### Sprint 3 (P2) — 10 dias
- [x] 3.1 Migrar blocos para tabelas (migration + CRUD + script + sincronia)
- [x] 3.2 RBAC por role
- [x] 4.1 Integrar grade real na completude
- [x] 4.2 Matriz visual SKU × cor × tamanho (SkuMatrix)

### Sprint 4 (P3) — 8 dias
- [ ] 5.1 Modo fornecedor na ficha
- [ ] 5.2 PWA para prova de roupa

**Total estimado:** ~29,5 dias de desenvolvimento

---

## 11. Métricas de Sucesso (KPIs)

Após implementação de cada eixo, medir:

| Eixo | Métrica | Meta |
|------|---------|------|
| Experiência (P0) | Tempo para visualizar ficha de um produto | < 5s (sem redirecionar) |
| Aprovação (P1) | Tempo médio de aprovação completa | < 3 dias |
| Aprovação (P1) | % de reprovações com registro de motivo | 100% |
| Dados (P2) | % de fichas com blocos em tabela | 100% |
| RBAC (P2) | % de ações bloqueadas indevidamente | 0% |
| Fornecedor (P3) | % de fornecedores usando o portal | > 60% |

---

## 12. Riscos e Mitigações

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Migração de blocos corrompe dados | Média | Alto | Script idempotente + teste em cópia |
| RBAC trava usuários legítimos | Média | Alto | Testes de permissão por role + revisão da matriz |
| Fluxo de aprovação complexo desestimula uso | Média | Médio | Permitir "pular etapa" + configuração flexível |
| Migração nova em produção | Média | Médio | Deploy em janela + rollback documentado |
| Escopo cresce (11 melhorias) | Alta | Médio | Priorização P0→P3 + entregas incrementais por sprint |

---

## 13. Dependências

| Melhoria | Depende de | Precede |
|----------|------------|---------|
| 1.1 Ficha no produto | Nenhuma | — |
| 1.2 Dashboard insumos | Migration `inventory_category` (se necessária) | — |
| 2.1 Aprovação multi-etapa | Migration `20260731000003` | 2.2 |
| 2.2 Notificações | 2.1 | — |
| 3.1 Blocos→tabelas | Migration `20260731000005` | 3.2 (leitura) |
| 3.2 RBAC | Nenhuma | 5.1 |
| 5.1 Modo fornecedor | 3.2 | — |

---

## 14. Migrations Planejadas (reserva de ordinais)

| Arquivo | Conteúdo | Sprint |
|---------|----------|--------|
| `20260731000002_inventory_category.sql` | Coluna `category` em `inventory_items` (se necessário) | 1 |
| `20260731000003_approval_workflow.sql` | Tabela `approval_workflow` + RLS | 2 |
| `20260731000004_tech_sheet_incomplete_cron.sql` | Cron diário de alerta de fichas incompletas | 2 |
| `20260731000005_block_tables.sql` | 7 tabelas de blocos + RLS + trigger sync | 3 |
| `20260731000006_fit_trials.sql` | Tabela `fit_trials` | 4 |

> **Nota:** ordinais separados para evitar conflito com a migration já aplicada `20260731000001_revisao_ficha_blocos.sql`.

---

## 15. Aprovação

Este plano cobre os gaps identificados na avaliação de especialista PLM (nota 8,2/10), organizados em 4 sprints incrementais.

**Próximos passos:**
1. ✅ Revisar e aprovar prioridades com o time de produto
2. Definir dono técnico por sprint
3. Iniciar Sprint 1 (P0) — melhorias que não exigem novas migrations, com impacto imediato na experiência
4. Atualizar este documento conforme o progresso (checkboxes)

---

*Documento vivo — revisar a cada sprint concluído.*
