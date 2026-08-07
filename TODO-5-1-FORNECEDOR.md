# TODO — 5.1 Modo fornecedor na ficha técnica

## Status: Em andamento

### Objetivo
Portal do fornecedor com ficha técnica em modo somente-leitura, ocultando custos e fornecedores concorrentes.

### Tarefas
- [x] `src/components/tech-pack/sheet-document.tsx` — prop `supplierView` no `FichaDocument` e `MaterialsByType`
  - Ocultar coluna "Custo" e "Fornecedor" em `MaterialsByType`
  - Forçar `canEdit={false}` nos blocos
- [x] `src/routes/api/public/supplier-portal-ficha.$token.$sheetId.ts` — API pública GET
  - Valida token (`supplier_portal_tokens`)
  - Retorna ficha (sem custos), produto, medidas, observações, composição, embalagem,
    materiais **sem custo/fornecedor**
- [x] `src/routes/portal.fornecedor.$token.ficha.$sheetId.tsx` — rota pública
  - Consome a API e renderiza `FichaDocument` com `supplierView` + `canEdit={false}`
- [x] Link a partir do portal existente (`portal.fornecedor.$token.tsx`) para cada OP
- [x] `npx tsc --noEmit` — sem novos erros nos arquivos alterados

