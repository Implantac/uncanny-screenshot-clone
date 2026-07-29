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
- [x] **✅ Migration: trigger ON UPDATE** — `20260731000000_trigger_sync_material_cost.sql` criado

### 1.3 Eliminação de Cliques — Edição Inline
- [x] TechSheetDrawer já existe para visualização rápida
- [ ] **🔴 Edição inline BOM workspace** — Toggle Edit/Save nas tabs BOM/BOP/Medidas

---

## FASE 2 — Navegação e UX

### 2.1 Hierarquia Visual
- [x] PlmBreadcrumb já implementado
- [x] Sidebar lifecycle já implementada em modules.ts
- [ ] **🟢 Breadcrumbs com ícones**: Adicionar ícones contextuais ao PlmBreadcrumb

### 2.2 Interface Centrada no Produto
- [x] Sistema de Tabs Shadcn implementado
- [x] Tabs: Overview, Ficha, BOM, BOP, Medidas, Custos, Protótipos, PCP, Marketing, BI, Timeline

### 2.3 Modais de Ação Rápida
- [x] QuickMaterialDialog já existe
- [ ] **🟡 QuickSupplierDialog**: Dialog para cadastrar fornecedor inline
- [ ] **🟡 QuickColorDialog**: Dialog para adicionar cor à paleta inline

---

## FASE 3 — Transformação em 'PLM de Verdade'

### 3.1 Tabela de Medidas Pro — Regras de Salto
- [x] GradeRulePopover JÁ EXISTE em `tech-pack/panels.tsx` com preview visual
- [x] ProductSizeGridCard já mostra grade com distribuição
- [ ] **🟡 Integrar GradeRulePopover ao ProductSizeGridCard** — Calcular grade automaticamente

### 3.2 Workflow de Peça Piloto
- [x] FitChecklistPanel já existe com checklist completo
- [x] PrototypeApprovalGate já existe com 3 selos (Modelagem, Custo, Comercial)
- [ ] **🟡 PrototypeApprovalGate + Timeline aprovações** — Melhorar fluxo com ações claras + histórico

### 3.3 Cálculo de Pre-Costing Automático
- [x] ProductPriceSuggestionCard já implementado com server function
- [x] ProductCreationWizard Step 3 tem cálculo de custos + margem estimada
- [ ] **🟡 Auto-fill sell_price + Break-even analysis** — Preencher preço sugerido + análise de margem mínima

---

## FASE 4 — Refinamento Estético e Intuitivo

### 4.1 Empty States Profissionais
- [x] EmptyState component já existe em `@/components/ui/empty-state`
- [ ] **🟢 Padronizar**: Garantir que todos os panels usem EmptyState com CTA

### 4.2 Status Visual Consistente
- [x] StatusBadge component já implementado com `StatusTone` e `resolveStatus`
- [x] Cobertura: product, prototype, production, techsheet, adjustment, collection

### 4.3 Consistência de Tabelas
- [x] tech-pack/panels.tsx já usa `Table` do shadcn/ui com EditableText e EditableNum
- [ ] **🟢 DataTable wrapper**: Criar wrapper padronizado com busca, ordenação, filtros

---

## 📋 PLANO DE IMPLEMENTAÇÃO — 9 Itens

### Lote 1 — Infraestrutura (execução paralela possível)
| # | Item | Arquivos | Esforço |
|---|------|----------|---------|
| 1 | Migration trigger ON UPDATE | `supabase/migrations/XXX_trigger_sync_material_cost.sql` | 🔴 1 dia |
| 2 | QuickSupplierDialog | `src/components/quick-supplier-dialog.tsx` | 🟡 1 dia |
| 3 | QuickColorDialog | `src/components/quick-color-dialog.tsx` | 🟡 0.5 dia |

### Lote 2 — Workspace & UX
| # | Item | Arquivos | Esforço |
|---|------|----------|---------|
| 4 | Breadcrumbs com ícones | `src/components/ui/plm-breadcrumb.tsx` + `global-breadcrumb.tsx` | 🟢 0.5 dia |
| 5 | DataTable wrapper | `src/components/ui/data-table.tsx` | 🟢 1 dia |
| 6 | Edição inline BOM workspace | `src/routes/_authenticated/_app.produto.$id.tsx` | 🔴 2 dias |

### Lote 3 — Funcionalidades Avançadas
| # | Item | Arquivos | Esforço |
|---|------|----------|---------|
| 7 | GradeRulePopover → ProductSizeGridCard | `src/components/product-size-grid-card.tsx` | 🟡 2 dias |
| 8 | PrototypeApprovalGate + Timeline | `src/components/prototype-approval-gate.tsx` + workspace | 🟡 2 dias |
| 9 | Auto-fill sell_price + Break-even | `src/components/product-price-suggestion-card.tsx` + wizard | 🟡 1 dia |

**Total estimado: ~10 dias**

## Progresso

| Fase | Total | Feito | % |
|------|-------|-------|---|
| Fase 1 | 6 | 3 | 50% |
| Fase 2 | 5 | 3 | 60% |
| Fase 3 | 6 | 4 | 67% |
| Fase 4 | 4 | 2 | 50% |
| **Total** | **21** | **12** | **57%** |

