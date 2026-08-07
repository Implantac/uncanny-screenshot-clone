# TODO — 4.1 Integrar grade real na completude da ficha

## Status: Concluído ✅

## Objetivo
O checklist de completude da Ficha Técnica usava `measurements.length` como proxy de grade. Melhorado para consultar a **grade real** do produto via `product_variants`, `product_size_options` e `product_color_options`.

## Tarefas
- [x] Query `ts-doc-product-variants` (product_variants por produto, com joins size.label e color.name)
- [x] "Grade definida" = `sizes.length > 0 && colors.length > 0` (dados reais, não proxy)
- [x] "SKUs gerados" = `variants.length > 0`
- [x] Novo item no checklist: "Variantes/SKUs geradas"
- [x] Aplicar também no Product Workspace (`_app.produto.$id.tsx`) para consistência
- [x] `npx prettier --write` nos arquivos alterados
- [x] `npx tsc --noEmit` — sem novos erros nos arquivos alterados (apenas erros pré-existentes)
- [ ] Atualizar checkboxes no `PLANO-MELHORIAS-POS-REVISAO.md` (seção 4.1) e `TODO.md`

## Arquivos
- [x] `src/routes/_authenticated/_app.ficha-tecnica.tsx`
- [x] `src/routes/_authenticated/_app.produto.$id.tsx`
