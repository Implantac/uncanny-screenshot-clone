# TODO — 4.2 Matriz visual SKU × cor × tamanho (SkuMatrix)

## Status: Concluído ✅

## Objetivo
Criar uma seção visual de SKUs (cores em linha, tamanhos em coluna, status no cruzamento) no documento da ficha técnica, com toggle ativo/inativo quando permitido.

## Tarefas
- [x] Componente `SkuMatrix` em `src/components/tech-pack/sheet-document.tsx` (puro, props-driven)
- [x] Incluir em `FichaDocument` (nova prop `skuVariants` + `onToggleVariantActive`)
- [x] Conectar em `_app.ficha-tecnica.tsx` (query `ts-doc-product-variants` + mutation toggle)
- [x] Conectar em `_app.produto.$id.tsx` (query `product-workspace-variants` + mutation toggle)
- [x] Toggle ativo/inativo por variante (somente se `canEdit`)
- [x] `npx prettier --write` nos arquivos alterados
- [x] `npx tsc --noEmit` — sem novos erros nos arquivos alterados
- [ ] Atualizar checkboxes no `PLANO-MELHORIAS-POS-REVISAO.md` (seção 4.2) e `TODO.md`

## Arquivos
- [x] `src/components/tech-pack/sheet-document.tsx`
- [x] `src/routes/_authenticated/_app.ficha-tecnica.tsx`
- [x] `src/routes/_authenticated/_app.produto.$id.tsx`
