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
- [x] **P3.** Lazy loading dos painéis abaixo da dobra na home (IntersectionObserver)
  - Arquivos: `src/components/lazy-reveal.tsx` (novo), `src/hooks/use-in-view.ts` (novo), `src/routes/_authenticated/_app.index.tsx`
  - **Status:** ✅ Concluído — novo hook `useInView` (IntersectionObserver) + componente `LazyReveal` que só monta o conteúdo quando o usuário rola até ele. Aplicado ao bloco "Coleção em destaque + Marketing ROI" da aba Resumo (evita render/IA extra na 1ª carga). As abas "Operações" e "Módulos" já só montam ao serem abertas (TanStack Tabs).

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
- [x] `npx prettier --write` nos arquivos alterados — ✅ todos "unchanged" (já formatados)
- [x] `npx tsc --noEmit` sem novos erros — ✅ 0 erros nos arquivos editados (`_app.produtos`, `_app.index`, `app-shell`, `product-mini-next-step`, `lazy-reveal`, `use-in-view`); erros pré-existentes fora de escopo permanecem
- [x] Commit e push no GitHub — ✅ head `dc3b76e2`, branch `blackboxai/ficha-tecnica-revisao` sincronizada com `origin`
