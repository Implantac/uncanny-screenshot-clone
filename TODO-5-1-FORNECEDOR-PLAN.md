# Plano — Tarefa 5.1 Modo Fornecedor na ficha técnica

## Status: Em andamento

### Etapas
- [x] 1. Criar API pública GET `src/routes/api/public/supplier-portal-ficha.$token.$sheetId.ts`
  - Valida token (`supplier_portal_tokens`) + checa expiração
  - Confere que a ficha pertence ao `owner_id` do token
  - Retorna: sheet (sem custos), produto, materials (sem custo/fornecedor), blocks (tabela + fallback JSON), measurements, skuVariants
- [x] 2. Criar rota pública `src/routes/portal.fornecedor.$token.ficha.$sheetId.tsx`
  - Consome a API e renderiza `FichaDocument` com `supplierView` + `canEdit={false}`
- [x] 3. Adicionar link "Ver ficha técnica" no portal existente (`portal.fornecedor.$token.tsx`) por OP
- [x] 4. `npx prettier --write` nos arquivos alterados
- [x] 5. `npx tsc --noEmit` — sem novos erros nos arquivos alterados
- [x] 6. Atualizar checkboxes em `TODO-5-1-FORNECEDOR.md`

