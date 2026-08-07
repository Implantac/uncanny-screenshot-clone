# Relatório de Auditoria — UX e Performance (olhar de usuário)

> Data: Julho 2026
> Origem: análise do sistema com o olhar de usuário — "o sistema está confuso e muito lento"

## Configuração de cache existente (bom)
- ✅ `src/router.tsx` define `QueryClient` global com `staleTime: 60s`, `gcTime: 5min`, `retry: 1`, `refetchOnWindowFocus: false`.
- Base de cache já é sólida; o problema está em quem NÃO usa staleTime e dispara tudo em paralelo.

---

## 🐢 LENTIDÃO — causas raiz confirmadas

| # | Causa | Onde | Severidade |
|---|-------|------|-----------|
| L1 | Home dispara **7 queries em paralelo** (`production_orders`, `collections`, `inventory_items`, `products 200`, `prototypes`, `tech_sheets 500`, `marketing_campaigns`) **sem `staleTime` próprio** no `useDashboard()` | `src/routes/_authenticated/_app.index.tsx` | 🔴 Alta |
| L2 | Home monta **5 painéis de IA** (`MorningBriefing` + `AICoordinatorPanel` x4) — **cada um chama o modelo Gemini + queries pesadas** (marketing puxa até 2000 vendas do ERP). **5 chamadas de IA concorrentes na primeira carga** | `src/routes/_authenticated/_app.index.tsx` | 🔴 Muito alta |
| L3 | Catálogo de produtos usa **`.select("*")` sem `.limit()`** — baixa todos os produtos e todas as colunas (descrição, imagem, etc.) | `src/routes/_authenticated/_app.produtos.tsx` (linha 305) | 🟡 Média |
| L4 | `ProductReadinessBadge` renderizado **por card** na lista → N queries de readiness por tela | `src/routes/_authenticated/_app.produtos.tsx` | 🟡 Média |
| L5 | `AICoordinatorPanel` incluído **dentro do catálogo** → mais 1 chamada de IA ao abrir Produtos | `src/routes/_authenticated/_app.produtos.tsx` | 🟡 Média |

---

## 😕 CONFUSÃO — causas raiz confirmadas

| # | Causa | Onde |
|---|-------|------|
| C1 | Home = "mural de tudo": NextAction + FirstRunGuide + nav âncoras + MorningBriefing + RecentProducts + RecentCollections + ExecutiveKpis + 4 KPIs + 5 alertas + coleção destaque + marketing ROI + **5 painéis de IA** + pipeline + produção + coleções + feed + tendências + 12 módulos | `src/routes/_authenticated/_app.index.tsx` |
| C2 | **5 painéis de IA repetidos** com rótulos parecidos ("Desenvolvimento", "Produção", "Marketing", "Qualidade", "Comercial") — todos geram insights simultâneos = ruído | `src/routes/_authenticated/_app.index.tsx` |
| C3 | Home longa demais para scroll; âncoras ajudam mas há duplicação de informação (KPIs, alertas, painéis de IA) | `src/routes/_authenticated/_app.index.tsx` |

---

## 🎯 PLANO DE OTIMIZAÇÃO (por prioridade)

### Sprint A — Desempenho (baixo risco, alto impacto imediato)
- **A1.** Reduzir painéis de IA na home de 5 para 1 (manter `MorningBriefing` ou 1 `AICoordinatorPanel` com seletor de persona). Elimina ~4 chamadas de IA concorrentes.
- **A2.** Adicionar `staleTime`/`gcTime` no `useDashboard()` (30–60s) para não refazer as 7 queries a cada visita.
- **A3.** Catálogo de produtos: trocar `.select("*")` por colunas específicas + `.limit()`/paginação server-side.
- **A4.** `ProductReadinessBadge`: agregar em 1 query por lista (ou lazy render) em vez de N.
- **A5.** Remover/adiar o `AICoordinatorPanel` do catálogo (duplicado com o produto).

### Sprint B — Clareza (UX)
- **B1.** Consolidar home em abas: "Resumo" (KPIs + alertas + próxima ação) / "Produção" / "Análises" / "IA" (1 painel). Tela enxuta, sem scroll infinito.
- **B2.** Reduzir sobreposição de painéis de IA — 1 painel por tela com seletor de persona.

---

## Critérios de aceite
1. Home carrega com **1–2 chamadas de IA** no máximo (antes: 5+).
2. Dashboard usa cache (`staleTime`) — não refaz queries redundantes.
3. Catálogo de produtos não baixa `*` ilimitado.
4. `tsc --noEmit` sem novos erros.
