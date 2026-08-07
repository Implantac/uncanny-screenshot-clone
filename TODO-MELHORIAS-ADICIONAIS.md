# TODO — Melhorias Adicionais (Performance + Clareza)

> Escopo aprovado: P1–P6 (todas as melhorias propostas)
> Objetivo: aprofundar a redução de **lentidão** e **confusão** no USE MODA PLM.

## Sprint Performance
- [x] **P1.** Catálogo com paginação server-side (20 por página) + filtros no banco
  - Arquivo: `src/routes/_authenticated/_app.produtos.tsx`
  - **Status:** ✅ Concluído — `page` no URL, `.range()` + `.count('exact')`, filtros no banco (`.eq`/`.or`/`.ilike`), botões Anterior/Próxima, soma na URL quando filtros mudam.
- [x] **P2.** Dividir `useDashboard()` em queries menores com `staleTime` próprio
  - Arquivo: `src/routes/_authenticated/_app.index.tsx`
  - **Status:** ✅ Concluído — 7 queries individuais com `staleTime: 60s` + query computada que agrega quando os dados estão prontos (`enabled: !isLoading`).
- [ ] **P3.** Lazy loading dos painéis abaixo da dobra na home (IntersectionObserver)
  - Arquivo: `src/routes/_authenticated/_app.index.tsx`

## Sprint Clareza
- [x] **C1.** Reduzir visão da sidebar para módulos essenciais por papel
  - Arquivo: `src/components/app-shell.tsx`
  - **Status:** ✅ Concluído — limita a `MAX_PER_GROUP` (6) módulos por fase no menu, com botão "Ver todos os N módulos" para expandir. A fase ativa nunca é truncada.
- [x] **C2.** Mostrar "próximo passo" no card do catálogo
  - Arquivo: `src/routes/_authenticated/_app.produtos.tsx` + novo `src/components/product-mini-next-step.tsx`
  - **Status:** ✅ Concluído — novo componente compacto que reutiliza o cache key `product-gate-status` (sem query extra) e mostra o próximo gate pendente com link direto.
- [x] **C3.** Melhorar feedback de carregamento (skeletons mais fiéis + mensagens)
  - Arquivos: `_app.index.tsx`, `_app.produtos.tsx`
  - **Status:** ✅ Concluído — skeleton do catálogo refeito para espelhar o layout real (lista de filtros + cards + painel de detalhe).

## Verificação
- [ ] `npx prettier --write` nos arquivos alterados
- [ ] `npx tsc --noEmit` sem novos erros
- [ ] Commit e push no GitHub
