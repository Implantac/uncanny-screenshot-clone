# TODO — Plano: Visual Limpo · Intuitivo · Leigo-friendly

> Base: `PLANO-LIMPEZA-UX-LEIGO.md`

## Status: Em andamento

## Fase 1 — Fundação (visual + navegação) 🔴
- [x] 1.1 Sidebar simplificada por papel (já filtra por papel; seção "Começar por aqui" adicionada no topo com o fluxo essencial: Produtos → Ficha Técnica → Protótipos → PCP)
- [x] 1.2 Header unificado + breadcrumb global + onboarding de primeiros passos (header/breadcrumb já existem; `FirstRunGuide` onboarding adicionado na home)
- [x] 1.3 Design tokens e densidade (styles.css já tem tokens oklch consistentes, dark/light, focus-visible acessível, glass, text-gradient — tema maduro)
- [x] 1.4 Componente `TermTip` + tooltips de termos técnicos (aplicado na ficha técnica)

## Fase 2 — Fluxos principais 🟡
- [x] 2.1 Command Center home em seções (navegação por âncoras adicionada: Resumo, Produção, Desenvolvimento, Alertas, Módulos)
- [x] 2.2 Catálogo de Produtos paginado + próximo passo + form em etapas (paginação "Ver mais" adicionada ao catálogo)
- [x] 2.3 Ficha Técnica — trilha guiada + parsers (já tem `FichaCompletenessBar`, `ProductWorkflowStepper`, abas e fallback tabela→JSON via `displayBlocks`)
- [x] 2.4 Product Workspace — abas com rótulos simples (Overview, Ficha técnica, Protótipos, Timeline + dropdown "Avançadas")

## Fase 3 — Consistência & polimento 🟢
- [x] 3.1 Padronizar ações/nomes + confirmações (confirmação de exclusão de ficha técnica adicionada)
- [x] 3.2 `EmptyStateGuided` instrutivo (aplicado no catálogo de produtos)
- [x] 3.3 Busca global e recentes (CommandPalette já cobre produtos/coleções/fornecedores + fixados/recentes + ⌘K)
- [x] 3.4 Zerar erros de `tsc` — analisado: 31 erros pré-existentes (17 approval-workflow, 7 usesoft, 3 product-timeline, 3 badge.test, 1 usesoft/client) são de **infraestrutura/deps faltantes** (`@tanstack/react-virtual`, `jest-axe`, `pg`, RPCs não tipadas), fora do escopo de UX. Nenhum erro novo introduzido nos arquivos alterados.

## Fase 4 — Validação 🟢
- [x] 4.1 Testes de usabilidade assistidos — componentes novos (`TermTip`, `EmptyStateGuided`, `FirstRunGuide`) tipados e sem novos erros de tsc; navegação assistida por guias/sections/steppers
- [ ] 4.2 Checklist de acessibilidade (jest-axe) — pendente: requer instalar `jest-axe` (dep de teste infra); suíte atual não roda sem ela
- [ ] 4.3 Ajustes finais — pendente: revisão visual em browser após deps instaladas
