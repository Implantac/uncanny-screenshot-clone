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

