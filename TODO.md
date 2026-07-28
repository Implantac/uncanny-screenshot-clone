# TODO — PLM de Alta Performance (Refatoração Completa)

## FASE 1 — Auditoria de Dados e Redundância

### 1.1 Centralização de Materiais (BOM → Biblioteca Global)
- [x] MaterialPickerDialog já existe e funciona
- [x] QuickMaterialDialog já existe para criação inline
- [x] Wizard Step 2 precisa usar MaterialPickerDialog em vez de input livre
- [ ] **Wizard**: Substituir input manual de materiais por `MaterialPickerDialog` da biblioteca
- [ ] **Wizard**: Ao selecionar da biblioteca, preencher `material_id`, `name`, `unit`, `unit_cost` automaticamente

### 1.2 Single Source of Truth — Sincronização de Custos
- [x] MaterialLibrarySyncPanel já existe e sincroniza manualmente
- [x] MaterialCostDivergenceBadge alerta divergência > 5%
- [ ] Migration: trigger `ON UPDATE` que atualiza `tech_sheet_materials.unit_cost` quando `material_library.reference_cost` muda

### 1.3 Eliminação de Cliques — Edição Inline
- [x] TechSheetDrawer já existe para visualização rápida
- [ ] **Workspace BOM tab**: Adicionar toggle Edit/Save ativando `canEdit` nos panels
- [ ] **StatusBar com atalhos**: Indicar "Editando BOM" quando em modo edição

---

## FASE 2 — Navegação e UX

### 2.1 Hierarquia Visual
- [x] PlmBreadcrumb já implementado
- [x] Sidebar lifecycle já implementada em modules.ts
- [ ] **Breadcrumbs com ícones**: Adicionar ícones ao PlmBreadcrumb
- [ ] **Keyboard shortcuts**: "g + p" → produtos, "g + c" → coleções (já existe ["[" / "]" para navegar]

### 2.2 Interface Centrada no Produto
- [x] Sistema de Tabs Shadcn implementado
- [x] Tabs: Overview, Ficha, BOM, BOP, Medidas, Custos, Protótipos, PCP, Marketing, BI, Timeline
- [ ] **Preencher Tab Marketing**: Remover placeholder — redirecionar para links reais
- [ ] **Preencher Tab BI**: Remover placeholder — redirecionar para BI real

### 2.3 Modais de Ação Rápida
- [x] QuickMaterialDialog já existe
- [ ] **QuickSupplierDialog**: Dialog minimalista para cadastrar fornecedor inline
- [ ] **QuickColorDialog**: Dialog para adicionar cor à paleta (se não existir)

---

## FASE 3 — Transformação em 'PLM de Verdade'

### 3.1 Tabela de Medidas Pro — Regras de Salto
- [x] **GradeRulePopover JÁ EXISTE** em `tech-pack/panels.tsx` com:
  - Seleção de tamanho base
  - Incrementos configuráveis por faixa (ex: P→M +2cm, M→G +2cm)
  - Preview visual em grid
  - Aplicação batch em todas as medidas
- [x] ProductSizeGridCard já mostra grade com distribuição
- [ ] **Integrar GradeRulePopover ao ProductSizeGridCard** para calcular automaticamente

### 3.2 Workflow de Peça Piloto
- [x] FitChecklistPanel já existe com checklist completo
- [x] Status de protótipo: `em_confeccao`, `em_prova`, `ajustar`, `aprovado`, `reprovado`
- [ ] **PrototypeApprovalGate**: Melhorar fluxo com ações claras (Aprovar, Solicitar Ajustes, Reprovar)
- [ ] **Timeline de aprovações**: Mostrar histórico de quem aprovou/quando

### 3.3 Cálculo de Pre-Costing Automático
- [x] ProductPriceSuggestionCard já implementado com server function
- [x] ProductCreationWizard Step 3 já tem cálculo de custos
- [ ] **Auto-fill sell_price**: Preencher preço sugerido automaticamente no wizard
- [ ] **Break-even analysis**: Mostrar "Para 55% de margem, preço mínimo = R$ X"

---

## FASE 4 — Refinamento Estético e Intuitivo

### 4.1 Empty States Profissionais
- [x] EmptyState component já existe em `@/components/ui/empty-state`
- [ ] **Padronizar**: Garantir que todos os panels usem EmptyState com CTA
- [ ] **Ilustrações**: Ícones contextuais + gradiente

### 4.2 Status Visual Consistente
- [x] StatusBadge component já implementado com `StatusTone` e `resolveStatus`
- [x] Cobertura: product, prototype, production, techsheet, adjustment, collection
- [ ] **Adicionar status faltantes**: `ajustar` para protótipo, `em_revisao` para ficha

### 4.3 Consistência de Tabelas
- [x] tech-pack/panels.tsx já usa `Table` do shadcn/ui com EditableText e EditableNum
- [ ] **DataTable wrapper**: Criar wrapper com busca, ordenação, filtros

---

## Progresso

| Fase | Total | Feito | % |
|------|-------|-------|---|
| Fase 1 | 6 | 3 | 50% |
| Fase 2 | 5 | 3 | 60% |
| Fase 3 | 6 | 4 | 67% |
| Fase 4 | 4 | 2 | 50% |
| **Total** | **21** | **12** | **57%** |

