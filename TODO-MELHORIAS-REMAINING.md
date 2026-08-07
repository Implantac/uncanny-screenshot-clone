# TODO — Implementação: Home em abas + Perf (Restante)

> Escopo aprovado: **P1–P4** (tudo)
> Foco: reduzir **confusão** (home empilhada) e **lentidão** (chamadas de IA concorrentes + N queries do badge).

## Sprint Home — organização + performance
- [x] **P1.** Organizar home em abas: "Resumo" / "Operações" / "Módulos"
  - Arquivo: `src/routes/_authenticated/_app.index.tsx`
  - A home agora usa `<Tabs>` com 3 abas. "Resumo" (briefing, recentes, KPIs, alertas, coleção/marketing), "Operações" (IA unificada, gráficos, feed, tendências), "Módulos" (grade de acesso rápido — todos, sem slice).
- [x] **P2.** Reduzir para 1 chamada de IA concorrente na carga inicial
  - `MorningBriefingPanel` só dispara ao clicar em "Gerar briefing" (sem autoLoad) — 0 chamadas na carga.
  - `AICoordinatorPanel` no topo da aba "Operações" com `personaSelector` — 1 chamada por vez (usuário troca de persona). Fica atrás de aba, então não dispara na carga da "Resumo".
  - Arquivo: `src/routes/_authenticated/_app.index.tsx`

## Sprint Catálogo — N queries do badge
- [x] **P3.** Reduzir disparo de N `product_gate_status` ao abrir a lista de produtos
  - Arquivo: `src/components/product-readiness-badge.tsx`
  - Abordagem escolhida (menor risco, sem SQL): **lazy-render via IntersectionObserver** — o badge só busca a RPC quando o card está próximo da viewport (`rootMargin: 120px`). Isso elimina o "burst" de N queries concorrentes na carga da listagem.

## Sprint Workspace — clareza de rótulos
- [x] **P4.** Renomear abas técnicas para português claro
  - Arquivo: `src/routes/_authenticated/_app.produto.$id.tsx`
  - "Overview" → **"Visão geral"**; "Timeline" → **"Histórico"** (BOM/BOP mantidos como termos técnicos, contexto de engenharia).

## Verificação
- [x] `npx prettier --write` nos arquivos alterados (index, produto.$id, product-readiness-badge)
- [x] `npx tsc --noEmit` — sem erros novos nos arquivos alterados (erros restantes são pré-existentes em `approval-workflow.functions.ts`, `usesoft.functions.ts`, `product-timeline.tsx` e teste que depende de `jest-axe` não instalado).
- [x] Atualizar `TODO-MELHORIAS-REMAINING.md`
