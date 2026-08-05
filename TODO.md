# TODO — Revisão Profunda do Módulo Ficha Técnica

## Status: Em andamento

### Revisão — Ficha Técnica como documento técnico real (AteliêFlow PLM)

- [x] **1. Migration** — `supabase/migrations/20260731000001_revisao_ficha_blocos.sql`
  - Adicionar colunas em `tech_sheet_materials`: `type`, `code`, `description`, `supplier`, `color`.
- [x] **2. Componente novo** — `src/components/tech-pack/sheet-document.tsx`
  - `FichaCompletenessBar` (barra de completude com checklist).
  - `FichaStatusSeal` (selos Aprovada / Bloqueada / Rascunho / Em revisão).
  - `FichaLockBanner` ("Esta versão está aprovada e bloqueada…").
  - `FichaIncompleteAlert` (alerta de ficha incompleta).
  - `SheetBlockCard` + editor genérico de blocos (composição, embalagem, beneficiamentos, estamparia, bordado, lavanderia, observações, qualidade).
  - `FichaDocument` (documento técnico completo).
- [x] **3. Revisão** — `src/components/tech-pack/panels.tsx`
  - `MaterialsPanel`: colunas Tipo, Código, Fornecedor, Cor + filtro/agrupamento por tipo.
  - `exportBomPdf`: incluir tipo/código/fornecedor.
- [x] **4. Revisão principal** — `src/routes/_authenticated/_app.ficha-tecnica.tsx`
  - Aba "Documento" como primeira aba do editor.
  - Extensão do modelo `SheetContent` com novos blocos.
  - Bloqueio de edição quando ficha aprovada (cadeado + aviso).
  - Manter abas, nova versão, comparar, exportar PDF, aprovar.

### Follow-up
- [x] Validar build/lint (tsc — apenas erros pré-existentes em arquivos não relacionados).
- [ ] Aplicar migration no Supabase local.

---

## Sprint 1 (P0) — Melhorias pós-revisão (PLANO-MELHORIAS-POS-REVISAO.md v2.1)

### 1.1 ✅ Embutir FichaDocument na aba "Ficha Técnica" do Product Workspace
- `src/routes/_authenticated/_app.produto.$id.tsx`
- Ficha técnica completa (documento técnico) renderizada dentro do produto, sem redirecionar.
- Query `ts-doc-materials`, cálculo de `completeness`, mutation `saveSheetContent`, `updateBlock`.
- `canEditSheet = status !== 'aprovada'` (bloqueio pós-aprovação, mesmo comportamento da rota `/ficha-tecnica`).
- tsc sem novos erros.

### 1.2 ✅ Filtrar alertas de insumos no Dashboard por categoria de confecção
- `src/routes/_authenticated/_app.index.tsx`
- Coluna `category` já existe em `inventory_items` (usada no select `category`).
- Filtro `CONFECCAO_CATEGORIES` — só insumos de confecção (tecido, malha, forro, aviamento, etiqueta, tag, embalagem, linha, elástico, renda, entretela, acabado) com saldo ≤ mínimo.
- Exibe nome amigável da categoria (`category_label`) em cada item do alerta.
- Migration `20260731000002_inventory_category.sql` não é necessária.

### 1.3 ✅ Tooltips para orientar modelistas
- `src/components/tech-pack/panels.tsx`
- Tooltip no `SizeConsumptionPopover` (consumo por tamanho) e `GradeRulePopover` (regra de salto).
- Textos em pt-BR, orientando o usuário a definir consumo por tamanho e aplicar regra de salto.
- tsc sem novos erros.

