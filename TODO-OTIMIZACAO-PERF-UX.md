# TODO — Otimização de Performance e UX (Auditoria)

> Base: `AUDITORIA-UX-PERFORMANCE.md`
> Status: Em andamento

## Sprint A — Desempenho (baixo risco, alto impacto)
- [ ] **A1.** Reduzir home de 5 painéis de IA → 1 painel (elimina ~4 chamadas de IA concorrentes)
  - Arquivo: `src/routes/_authenticated/_app.index.tsx` (`MorningBriefing` + `AICoordinatorPanel` x4)
- [ ] **A2.** Adicionar `staleTime` no `useDashboard()` (30–60s) — evita refazer as 7 queries a cada visita
  - Arquivo: `src/routes/_authenticated/_app.index.tsx`
- [ ] **A3.** Catálogo: trocar `.select("*")` por colunas específicas + `.limit()`
  - Arquivo: `src/routes/_authenticated/_app.produtos.tsx`
- [ ] **A4.** Agregar `ProductReadinessBadge` em 1 query por lista (em vez de N por card)
  - Arquivo: `src/routes/_authenticated/_app.produtos.tsx` + `src/components/product-readiness-badge.tsx`
- [ ] **A5.** Remover o `AICoordinatorPanel` duplicado do catálogo
  - Arquivo: `src/routes/_authenticated/_app.produtos.tsx`

## Sprint B — Clareza (UX)
- [ ] **B1.** Consolidar home em abas: "Resumo" / "Produção" / "Análises" / "IA" (1 painel)
  - Arquivo: `src/routes/_authenticated/_app.index.tsx`
- [ ] **B2.** 1 painel de IA por tela com seletor de persona
  - Arquivo: `src/routes/_authenticated/_app.index.tsx` + `src/components/ai-coordinator-panel.tsx`

## Verificação
- [ ] `npx prettier --write` nos arquivos alterados
- [ ] `npx tsc --noEmit` sem novos erros
- [ ] Atualizar checkboxes em `AUDITORIA-UX-PERFORMANCE.md`

