# PLANO DE REFATORAÇÃO — PLM de Alta Performance (estilo colecao.moda)

> **Auditoria realizada em:** $(Get-Date -Format "yyyy-MM-dd")
> **Projeto:** uncanny-screenshot-clone → USE MODA PLM

---

## FASE 1 — Auditoria de Dados e Redundância (Prioridade: 🔴 Alta)

### 1.1 Centralização de Materiais (BOM → Biblioteca Global)

**Problema:** O `ProductCreationWizard` (Step 2) cria materiais soltos em `tech_sheet_materials` sem `material_id` vinculado à `material_library`. Isso gera duplicidade.

**Solução:**
- [ ] Adicionar `MaterialPickerDialog` reutilizável que busca na `material_library`
- [ ] No Wizard Step 2, substituir input livre por seletor de biblioteca + fallback para material avulso
- [ ] Ao selecionar material da biblioteca, preencher automaticamente: `name`, `unit`, `unit_cost` (reference_cost), `loss_pct`
- [ ] Criar mutation `linkMaterialToSheet(materialId, sheetId, consumption)` no lugar de insert direto

**Arquivos afetados:**
- `src/components/product-creation-wizard.tsx` (Step 2)
- `src/components/material-picker-dialog.tsx` ✅ já existe — verificar se atende
- `src/lib/modules.ts` (possível nova função de linking)

### 1.2 Single Source of Truth — Sincronização Automática de Custos

**Problema:** `MaterialLibrarySyncPanel` já existe e sincroniza custos manualmente via botão. O fluxo não é automático.

**Solução:**
- [ ] Adicionar trigger `ON UPDATE` no Supabase (migration) que atualiza `tech_sheet_materials.unit_cost` quando `material_library.reference_cost` muda
- [ ] Alternativa: criar job agendado ou botão "Sincronizar todos os custos" global
- [ ] Manter `MaterialCostDivergenceBadge` como alerta visual de divergência > 5%

**Arquivos afetados:**
- `supabase/migrations/` (nova migration)
- `src/components/material-library-sync-panel.tsx` (já funcional)

### 1.3 Eliminação de Cliques — Edição Inline no Workspace

**Problema:** Para editar BOM, o usuário precisa navegar para `/ficha-tecnica` página separada.

**Solução:**
- [ ] Na Tab "BOM" do workspace, adicionar modo de edição inline (toggle Edit/Save)
- [ ] `TechSheetDrawer` já existe para visualização — estender com edição rápida
- [ ] Adicionar `canEdit` prop nos panels (MaterialsPanel, OperationsPanel, MeasurementsPanel)

**Arquivos afetados:**
- `src/routes/_authenticated/_app.produto.$id.tsx` (Tabs)
- `src/components/tech-sheet-drawer.tsx` (estender com edição)
- `src/components/tech-pack/panels.tsx` (modo edição)

---

## FASE 2 — Navegação e UX (Prioridade: 🔴 Alta)

### 2.1 Hierarquia Visual — Sidebar + Breadcrumbs Profissionais

**Problema:** Sidebar já existe mas breadcrumbs têm navegação limitada.

**Solução:**
- [ ] Melhorar `PlmBreadcrumb` com suporte a ícones e links dinâmicos por papel
- [ ] Adicionar atalhos de teclado nos breadcrumbs (ex: "P" volta para produtos)
- [ ] Sidebar enxuta: agrupar módulos por fase do ciclo de vida (já implementado em `modules.ts` com `LifecyclePhase`)

**Arquivos afetados:**
- `src/components/ui/plm-breadcrumb.tsx` (melhorias)
- `src/components/app-shell.tsx` (sidebar lifecycle)

### 2.2 Interface Centrada no Produto — Sistema de Abas de Alta Performance

**Problema:** Tabs já existem mas algumas são vazias/placeholder (Marketing, BI).

**Solução:**
- [ ] Preencher Tab "Geral": Briefing + Fotos + Status + Métricas
- [ ] Preencher Tab "Engenharia/BOM": Lista de materiais com cálculo automático + botão "Adicionar da Biblioteca"
- [ ] Preencher Tab "Modelagem/Medidas": Tabela de graduação inteligente com regras de salto
- [ ] Preencher Tab "Prototipagem": Timeline de peças piloto com status visuais
- [ ] Remover tabs vazias (Marketing, BI) — mover para links externos

**Arquivos afetados:**
- `src/routes/_authenticated/_app.produto.$id.tsx`
- `src/components/product-lifecycle-guide.tsx`

### 2.3 Modais de Ação Rápida

**Problema:** Criar fornecedor, cor, ou material tira o usuário do contexto atual.

**Solução:**
- [ ] `QuickSupplierDialog` — Dialog minimalista para cadastrar fornecedor inline
- [ ] `QuickColorDialog` — Dialog para adicionar cor à paleta
- [ ] `QuickMaterialDialog` — Dialog para criar material na biblioteca + já vincular

**Arquivos a criar:**
- `src/components/quick-supplier-dialog.tsx`
- `src/components/quick-color-dialog.tsx`
- `src/components/quick-material-dialog.tsx`

---

## FASE 3 — Transformação em 'PLM de Verdade' (Prioridade: 🟡 Média)

### 3.1 Tabela de Medidas Pro — Regras de Salto

**Problema:** `ProductSizeGridCard` mostra grade estática, sem cálculo automático.

**Solução:**
- [ ] Implementar lógica de "Regras de Salto": usuário define tamanho base (ex: M) e o sistema calcula a grade completa
  - Regras: PP(-2), P(-1), M(base), G(+1), GG(+2)
  - Salto configurável por categoria (ex: Vestido = 4cm, Calça = 3cm)
- [ ] Criar `SizeGradeCalculator` hook/server function
- [ ] Adicionar preview visual com sliders interativos

**Arquivos afetados:**
- `src/components/product-size-grid-card.tsx` (refatorar completamente)
- `src/lib/size-grids.functions.ts` (adicionar lógica de salto)

### 3.2 Workflow de Peça Piloto — Fluxo de Aprovação

**Problema:** Protótipos são listados mas sem fluxo de aprovação claro.

**Solução:**
- [ ] Revisar status: "Em Confecção" → "Em Prova" → "Ajustar" → "Aprovado"
- [ ] Adicionar `PrototypeApprovalGate` com ações: Aprovar, Solicitar Ajustes, Reprovar
- [ ] Adicionar timeline visual de aprovações (quem aprovou, quando, observações)
- [ ] Checklist de fitting integrado ao fluxo (já existe `FitChecklistPanel`)

**Arquivos afetados:**
- `src/routes/_authenticated/_app.produto.$id.tsx` (Tab Protótipos)
- `src/components/prototype-approval-gate.tsx` ✅ já existe — verificar
- `src/components/fit-checklist-panel.tsx` (integrar ao fluxo)

### 3.3 Cálculo de Pre-Costing Automático

**Problema:** `ProductPriceSuggestionCard` calcula preço sugerido mas não persiste no produto.

**Solução:**
- [ ] Integrar server function `getSuggestedRetailPrice` ao save do produto
- [ ] Adicionar campo `target_markup` na tabela `products` ou `tech_sheets`
- [ ] Mostrar break-even analysis: "Para atingir 55% de margem, preço mínimo = R$ X"
- [ ] Preencher `sell_price` automaticamente com sugestão (usuário pode sobrescrever)

**Arquivos afetados:**
- `src/components/product-price-suggestion-card.tsx` (melhorias)
- `src/components/product-creation-wizard.tsx` (Step 3)
- `src/lib/product-cost-engine.functions.ts` (estender)

---

## FASE 4 — Refinamento Estético e Intuitivo (Prioridade: 🟢 Baixa)

### 4.1 Empty States Profissionais

**Problema:** Empty states existem mas são inconsistentes (texto, ícone, action).

**Solução:**
- [ ] Criar componente `<PlmEmptyState>` padronizado com:
  - Ícone contextual + gradiente
  - Título + descrição clara
  - Call-to-action obrigatório (ex: "Buscar na biblioteca")
  - Ilustração opcional (SVG inline)
- [ ] Aplicar em todos os componentes que listam dados vazios

**Arquivos afetados:**
- `src/components/ui/empty-state.tsx` (refatorar)
- Todos os panels que usam EmptyState

### 4.2 Status Visual Consistente

**Problema:** Cores de status espalhadas pelo código (hardcoded classes).

**Solução:**
- [ ] Criar utilitário `statusColor(status: string, kind: string)` que retorna tailwind classes
- [ ] Centralizar mapeamento de cores por domínio:
  - Produto: `rascunho`(slate), `em_desenvolvimento`(blue), `piloto_aprovado`(emerald), `em_producao`(amber)
  - Ficha: `rascunho`(slate), `aprovada`(emerald)
  - Protótipo: `em_confeccao`(blue), `em_prova`(amber), `ajustar`(rose), `aprovado`(emerald)
- [ ] Aplicar `StatusBadge` consistente (já existe parcialmente)

**Arquivos afetados:**
- `src/components/status-badge.tsx` (refatorar)
- `src/lib/utils.ts` (adicionar utilitário de cores)

### 4.3 Consistência de Tabelas

**Problema:** Algumas tabelas usam `Table` shadcn, outras usam divs customizadas.

**Solução:**
- [ ] Garantir que todas as listas usem `<Table>` do shadcn/ui
- [ ] Adicionar `DataTable` wrapper com busca, filtros, ordenação
- [ ] Adicionar suporte a imagens em miniatura nas tabelas

**Arquivos afetados:**
- `src/components/ui/data-table.tsx` (criar wrapper)
- Múltiplos components

---

## 📋 Resumo de Impacto

| Fase | Arquivos Novos | Arquivos Modificados | Esforço |
|------|---------------|---------------------|---------|
| Fase 1 | 0 | 4 | 🔴 3 dias |
| Fase 2 | 3 | 4 | 🔴 4 dias |
| Fase 3 | 1 | 5 | 🟡 5 dias |
| Fase 4 | 1 | 8 | 🟢 3 dias |
| **Total** | **5 novos** | **21 modificados** | **~15 dias** |

---

**Próximo passo:** Aprovar este plano para iniciarmos a implementação ordenada por fases.

