# TODO — PLM de Alta Performance (Refatoração Completa)

## Status: ✅ 100% — Todos os 21 itens implementados

## FASE 1 — Auditoria de Dados e Redundância

### 1.1 Centralização de Materiais (BOM → Biblioteca Global)
- [x] MaterialPickerDialog já existe e funciona
- [x] QuickMaterialDialog já existe para criação inline
- [x] Wizard Step 2 usa MaterialPickerDialog com botões "Biblioteca" + "Em branco"
- [x] Wizard: Ao selecionar da biblioteca, preenche `material_id`, `name`, `unit`, `unit_cost` automaticamente

### 1.2 Single Source of Truth — Sincronização de Custos
- [x] MaterialLibrarySyncPanel já existe e sincroniza manualmente
- [x] MaterialCostDivergenceBadge alerta divergência > 5%
- [x] **Migration: trigger ON UPDATE** — `20260731000000_trigger_sync_material_cost.sql` criado

### 1.3 Eliminação de Cliques — Edição Inline
- [x] TechSheetDrawer já existe para visualização rápida
- [x] **Edição inline BOM workspace** — Toggle Edit/Save nas tabs BOM/BOP/Medidas via `canEdit` prop

---

## FASE 2 — Navegação e UX

### 2.1 Hierarquia Visual
- [x] PlmBreadcrumb já implementado com suporte a ícones
- [x] Sidebar lifecycle já implementada em modules.ts
- [x] **Breadcrumbs com ícones**: `GlobalBreadcrumb` usa `PlmBreadcrumb` com ícones contextuais dos módulos

### 2.2 Interface Centrada no Produto
- [x] Sistema de Tabs Shadcn implementado
- [x] Tabs: Overview, Ficha, BOM, BOP, Medidas, Custos, Protótipos, PCP, Marketing, BI, Timeline

### 2.3 Modais de Ação Rápida
- [x] QuickMaterialDialog já existe
- [x] **QuickSupplierDialog**: Dialog para cadastrar fornecedor inline
- [x] **QuickColorDialog**: Dialog para adicionar cor à paleta inline

---

## FASE 3 — Transformação em 'PLM de Verdade'

### 3.1 Tabela de Medidas Pro — Regras de Salto
- [x] GradeRulePopover existe em `tech-pack/panels.tsx` com preview visual
- [x] ProductSizeGridCard mostra grade com distribuição
- [x] **GradeRulePopover integrado ao ProductSizeGridCard** — Botão "Calcular salto" com preview inline

### 3.2 Workflow de Peça Piloto
- [x] FitChecklistPanel já existe com checklist completo
- [x] PrototypeApprovalGate existe com 3 selos (Modelagem, Custo, Comercial)
- [x] **Ações: Registrar/Revogar selo, custo vs meta, gap analysis**

### 3.3 Cálculo de Pre-Costing Automático
- [x] `getSuggestedRetailPrice` server function implementada
- [x] ProductPriceSuggestionCard com break-even analysis (margem, markup, preço mínimo)
- [x] **Auto-fill sell_price** — Botão "Aplicar como preço de venda" persiste no produto

---

## FASE 4 — Refinamento Estético e Intuitivo

### 4.1 Empty States Profissionais
- [x] EmptyState component existe em `@/components/ui/empty-state`
- [x] Padronizado com ícone, título, descrição e CTA nos principais panels

### 4.2 Status Visual Consistente
- [x] StatusBadge component implementado com `StatusTone` e `resolveStatus`
- [x] Cobertura: product, prototype, production, techsheet, adjustment, collection

### 4.3 Consistência de Tabelas
- [x] tech-pack/panels.tsx usa `Table` do shadcn/ui com `EditableText` e `EditableNum`
- [x] **DataTable wrapper** — `src/components/ui/data-table.tsx` com busca, ordenação, paginação

---

## 📋 PLANO DE IMPLEMENTAÇÃO — 9 Itens

### Lote 1 — Infraestrutura (✅ 3/3)
| # | Item | Arquivos | Status |
|---|------|----------|--------|
| 1 | Migration trigger ON UPDATE | `supabase/migrations/20260731000000_trigger_sync_material_cost.sql` | ✅ |
| 2 | QuickSupplierDialog | `src/components/quick-supplier-dialog.tsx` | ✅ |
| 3 | QuickColorDialog | `src/components/quick-color-dialog.tsx` | ✅ |

### Lote 2 — Workspace & UX (✅ 3/3)
| # | Item | Arquivos | Status |
|---|------|----------|--------|
| 4 | Breadcrumbs com ícones | `src/components/ui/plm-breadcrumb.tsx` + `global-breadcrumb.tsx` | ✅ |
| 5 | DataTable wrapper | `src/components/ui/data-table.tsx` | ✅ |
| 6 | Edição inline BOM workspace | `src/routes/_authenticated/_app.produto.$id.tsx` + panels | ✅ |

### Lote 3 — Funcionalidades Avançadas (✅ 3/3)
| # | Item | Arquivos | Status |
|---|------|----------|--------|
| 7 | GradeRulePopover → ProductSizeGridCard | `src/components/product-size-grid-card.tsx` | ✅ |
| 8 | PrototypeApprovalGate + Timeline | `src/components/prototype-approval-gate.tsx` | ✅ |
| 9 | Auto-fill sell_price + Break-even | `src/components/product-price-suggestion-card.tsx` | ✅ |

## 📋 MELHORIAS DE USABILIDADE — PLANO-MELHORIAS-USABILIDADE

### 1.1 — Breadcrumb Global em Rotas Dinâmicas
**Status:** ✅ Concluído
**Descrição:** `GlobalBreadcrumb` agora detecta rotas filhas dinâmicas (`/produto/$id`) e renderiza breadcrumb com fallback para o módulo pai. Inclui mapeamento singular/plural (ex: `/produto/123` → módulo `Produtos`).
**Arquivos:** `src/components/global-breadcrumb.tsx`
**Progresso:** 100%

### 1.2 — Sidebar Destacar Módulo Ativo em Rotas Filhas
**Status:** ✅ Concluído
**Descrição:** Sidebar (`AppShell`) agora destaca o módulo pai como ativo quando em rotas filhas dinâmicas. Comparação usa `active.startsWith(m.path + "/")` + fallback singular/plural.
**Arquivos:** `src/components/app-shell.tsx`
**Progresso:** 100%

### 1.3 — Tooltips em termos técnicos
**Status:** ✅ Concluído
**Descrição:** Adicionar tooltips explicativos nos termos PLM das abas do workspace (BOM, BOP, PCP) para novos usuários.
**Arquivos:** `src/routes/_authenticated/_app.produto.$id.tsx`
**Progresso:** 100%

### 1.4 — Confirmação de exclusão de produto
**Status:** ✅ Concluído
**Descrição:** Adicionar `AlertDialog` de confirmação antes de remover um produto, prevenindo exclusões acidentais.
**Arquivos:** `src/routes/_authenticated/_app.produtos.tsx`
**Progresso:** 100%

### 2.1 — Agrupar Abas Técnicas no Workspace
**Status:** ✅ Concluído
**Descrição:** Separar as 11 abas do workspace de produto em "Principais" (Overview, Ficha técnica, Protótipos, Timeline) e "Avançadas" (BOM, BOP, Medidas, Custos, PCP, Marketing, BI) em dropdown menu, reduzindo a carga cognitiva para novos usuários.
**Arquivos:** `src/routes/_authenticated/_app.produto.$id.tsx`
**Progresso:** 100%

---

**Total: 26/26 itens — 100% concluído** 🎉
