# Plano — Visual Limpo · Intuitivo · Fácil para Usuários Leigos

> Baseado na avaliação global do USE MODA PLM. Objetivo: reduzir a complexidade percebida,
> guiar o usuário por fluxos claros e padronizar a experiência em todo o sistema, sem quebrar
> as funcionalidades já existentes.

## Princípios diretores
1. **Menos é mais** — cada tela tem 1 ação principal e no máximo 3 secundárias em destaque.
2. **Linguagem simples** — substituir jargão PLM por termos em português com tooltip quando necessário.
3. **Guia por contexto** — o usuário sempre sabe onde está, o que fazer agora e o que vem depois.
4. **Consistência** — mesmos componentes, mesmas cores, mesmos nomes de ação em todo o sistema.
5. **Acessibilidade** — navegação por teclado, contraste, foco visível e textos alternativos.

---

## Fase 1 — Fundação (visual + navegação) 🔴 · ~5 dias

### 1.1 Sidebar simplificada por papel (leigo-first)
**Arquivo:** `src/components/app-shell.tsx`, `src/lib/modules.ts`
- Para não-admin, mostrar no máximo **7 módulos essenciais por fase** (em vez de todos os visíveis).
- Agrupar por ciclo de vida já existente, mas rotular com verbo de ação: "Planejar", "Criar produto", "Produzir", "Vender", "Analisar".
- Adicionar busca na sidebar (Command Palette já existe; garantir que o placeholder diga "Buscar módulo ou produto…").
- **Critério:** um usuário leigo deve encontrar o módulo certo em ≤ 2 cliques.

### 1.2 Header unificado com estado do sistema
**Arquivo:** `src/components/app-shell.tsx`
- Padronizar ícones com tooltip em todos os botões do header (tema, notificações, chat, atalhos).
- Adicionar **breadcrumb global visível** em todas as telas (não só em dinâmicas) com rótulos em português.
- Criar um **onboarding de "primeiros passos"** guiado (tour de 4 passos) na primeira entrada do usuário.

### 1.3 Design tokens e densidade
**Arquivo:** `src/styles.css`
- Cadastrar paleta semântica clara (danger/warning/success/info) já usada; garantir contraste AA.
- Reduzir densidade dos cards: mais respiro, hierarquia por sombra/raio, não por borda dupla.
- Padronizar `glass`/`rounded-xl`/espaçamento para consistência total.

### 1.4 Tooltips de termos técnicos
**Arquivos:** `src/components/tech-pack/panels.tsx`, `src/components/product-creation-wizard.tsx`, `src/routes/_authenticated/_app.produto.$id.tsx`
- Criar componente reutilizável `TermTip` (ícone `?` com tooltip) para: BOM, BOP, SKU, SAM, MRP, POM, AQL, grade, aviamento.
- Aplicar nos labels dos campos técnicos em português.

---

## Fase 2 — Fluxos principais (rumo ao leigo) 🟡 · ~6 dias

### 2.1 Command Center — home "inteligente"
**Arquivo:** `src/routes/_authenticated/_app.index.tsx`
- Manter o bloco "Próxima ação" como hero (já existe e é ótimo).
- **Reduzir para 3 seções** no topo: (1) Próxima ação, (2) KPIs, (3) Atalhos de módulos.
- Mover gráficos/feed/IA para abas secundárias ("Análises", "Atividade", "IA") — hoje tudo empilhado vira ruído.
- Destaque visual único por tipo de alerta (crítico=vermelho, atenção=âmbar, ok=verde).

### 2.2 Catálogo de Produtos — lista por cards com "próximo passo"
**Arquivo:** `src/routes/_authenticated/_app.produtos.tsx`
- **Paginar** a listagem (mín. página de 20) para performance e leitura.
- Em cada card, mostrar o **"próximo passo"** do produto (já existe no detalhe; levar para o card como badge).
- Colocar o botão **"Novo produto"** como única ação primária; "Exportar CSV" vira secundária no menu.
- Simplificar o formulário: agrupar em etapas (1. Identidade → 2. Grade/Cores → 3. Preços/Status) em vez de um form longo.

### 2.3 Ficha Técnica — trilha guiada de preenchimento
**Arquivo:** `src/routes/_authenticated/_app.ficha-tecnica.tsx`, `src/components/tech-pack/sheet-document.tsx`
- **Ordenar as abas como trilha**: Dados → Grade/SKUs → Composição → BOM → BOP → Medidas → Custo → Aprovação.
- **Bloquear/indicar** o próximo passo do checklist ("Próximo campo: Composição") com CTA.
- Abas de custo/fornecedor só aparecem para quem tem permissão (RBAC já existe).
- Unificar os parsers de bloco duplicados entre `ficha-tecnica` e `produto.$id` num hook/componente compartilhado.

### 2.4 Product Workspace — abas com rótulos simples
**Arquivo:** `src/routes/_authenticated/_app.produto.$id.tsx`
- Renomear abas para português claro: "Visão geral", "Ficha", "Protótipos", "Histórico", e manter "Avançadas" no dropdown.
- Garantir o breadcrumb sempre visível (já usa `PlmBreadcrumb`).
- O botão "Editar ficha" já tem tooltip explicativo — manter e expandir para "Avançadas".

---

## Fase 3 — Consistência & polimento 🟢 · ~4 dias

### 3.1 Padronizar ações e nomes
- **Salvar** = "Salvar rascunho" (não final) · **Publicar** = avança status. Aplicar em TODOS os dialogs.
- Confirmar ações destrutivas (remover produto/ficha/coleção) com `AlertDialog` — já feito em produtos; replicar onde faltar.
- Botões primários = 1 por tela; secundários = contorno; destrutivos = sempre com confirmação.

### 3.2 Estado vazio instrutivo
- Criar componente `EmptyStateGuided` que mostra: "O que é esta tela", "Como começar" (3 passos), e CTA.
- Aplicar em telas sem dados (produtos, fichas, coleções, fornecedores, qualidade).

### 3.3 Busca global e recentes
- Garantir Command Palette com resultados agrupados (Ações / Produtos / Coleções / Módulos).
- Persistir "recentes" já existente e exibir na home.

### 3.4 Saúde de tipos (facilitador de evolução)
- Zerar os 31 erros de `tsc` (tipar RPCs, instalar `pg`/`@tanstack/react-virtual`/`jest-axe`).
- Isso permite evoluir o visual sem risco de regressão. (Transversal, mas necessário.)

---

## Fase 4 — Validação com usuário leigo 🟢 · ~3 dias

### 4.1 Testes de usabilidade assistidos
- Roteiro de 5 tarefas com um usuário sem treino: cadastrar produto, criar ficha, solicitar piloto, ver OP, aprovar.
- Medir: tempo por tarefa, cliques, erros, olhar dirigido.

### 4.2 Checklist de acessibilidade (axe)
- Rodar `jest-axe` nos componentes-chave (produto, ficha, produto.$id, app-shell).
- Garantir foco visível, `aria-label` e navegação por teclado completa.

### 4.3 Ajustes finais
- Aplicar feedback do teste; iterar em 1 ciclo.

---

## Matriz de impacto (rápida)

| Item | Esforço | Impacto leigo | Risco |
|------|---------|---------------|-------|
| Sidebar por papel (1.1) | 2d | Alto | Baixo |
| Trilha guiada na ficha (2.3) | 3d | Muito alto | Médio |
| Catálogo com próximo passo + paginação (2.2) | 2d | Alto | Baixo |
| Command Center em abas (2.1) | 2d | Alto | Baixo |
| Tooltips/termos (1.4) | 1d | Médio | Baixo |
| Zerar tsc (3.4) | 2d | — (facilitador) | Baixo |
| EmptyStateGuided (3.2) | 1d | Médio | Baixo |
| Testes leigo + axe (4.1/4.2) | 3d | Validação | Baixo |

**Total estimado: ~18 dias** (3 semanas), sem quebrar funcionalidades existentes.

---

## Critérios de aceite (o que define "pronto")
1. Um usuário leigo cadastra um produto e cria uma ficha técnica em menos de 5 minutos sem ajuda.
2. Toda tela tem 1 CTA primário claro e breadcrumb/estado visível.
3. Nenhum jargão técnico sem tooltip em português.
4. `tsc --noEmit` limpo (0 erros novos).
5. `jest-axe` sem violações críticas de acessibilidade.
6. Nenhuma funcionalidade existente removida/quebrada.
