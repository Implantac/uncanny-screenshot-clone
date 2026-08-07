# TODO — Tarefa 5.1 Modo fornecedor na ficha técnica (conclusão)

## Status: Em andamento

### Etapas
- [x] 1. API pública GET `src/routes/api/public/supplier-portal-ficha.$token.$sheetId.ts`
- [x] 2. Rota pública `src/routes/portal.fornecedor.$token.ficha.$sheetId.tsx`
  - Consome a API e renderiza `FichaDocument` com `supplierView` + `canEdit={false}`
- [x] 3. `product_id`/`tech_sheet_id` na API `supplier-portal.$token.ts` (por OP)
- [x] 4. Link "Ver ficha técnica" no portal (`portal.fornecedor.$token.tsx`) por OP
- [x] 5. `npx prettier --write` nos arquivos alterados
- [x] 6. `npx tsc --noEmit` — sem novos erros nos arquivos alterados
- [x] 7. Atualizar checkboxes em `TODO-5-1-FORNECEDOR.md`, `TODO-5-1-FORNECEDOR-PLAN.md` e `TODO.md`

