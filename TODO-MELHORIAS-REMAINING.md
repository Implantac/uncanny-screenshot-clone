# TODO — Melhorias de Usabilidade (Lote 2 e 3 restantes)

## Status: Em andamento

### LOTE 2 — 🟡 Correções Médias (Fluxo Diário)
- [x] **2.2** Botão "Editar Ficha" desabilitado quando não há ficha (com tooltip "Crie uma ficha técnica primeiro")
  - Arquivo: `src/routes/_authenticated/_app.produto.$id.tsx`
  - **Status:** ✅ Concluído (já implementado com Tooltip + disabled)
- [x] **2.3** Filtros da lista de produtos em URL (status, coleção, pinned, busca)
  - Arquivo: `src/routes/_authenticated/_app.produtos.tsx`
  - **Status:** ✅ Concluído (query params `q`, `status`, `collection`, `pinned`)
- [x] **2.4** Input de cores e tamanhos como chips no ProductDialog
  - Arquivo: `src/routes/_authenticated/_app.produtos.tsx` + `src/components/ui/chip-input.tsx`
  - **Status:** ✅ Concluído (novo ChipInput + CollectionPaletteSuggestion adaptado)

### LOTE 3 — 🟢 Correções Leves (Polimento)
- [x] **3.1** Renomear módulos em inglês (Fashion Calendar, Fit Sessions, Target Costing)
  - Arquivo: `src/lib/modules.ts`
  - **Status:** ✅ Concluído (Calendário de Coleções, Sessões de Prova, Custo Alvo)
- [x] **3.2** Padronizar nomenclatura "Salvar rascunho"/"Publicar" nos dialogs
  - Arquivos: `src/routes/_authenticated/_app.produtos.tsx` (ProductDialog)
  - **Status:** ✅ Parcial — ProductDialog padronizado; demais dialogs mantêm labels contextuais
- [x] **3.3** Export CSV com grade expandida (cores/tamanhos em colunas separadas)
  - Arquivo: `src/routes/_authenticated/_app.produtos.tsx` (helper `toCsvRows`)
  - **Status:** ✅ Concluído (colunas size_1..6, color_1..6, grade)
