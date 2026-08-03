# PLANO DE MELHORIAS — USABILIDADE PLM

## Critérios: Prioridade 🔴 > 🟡 > 🟢

---

## LOTE 1 — 🔴 Correções Críticas (UX Core)

### 1.1 Breadcrumb Global em Rotas Dinâmicas
**Problema:** `GlobalBreadcrumb` retorna `null` em rotas dinâmicas (`/produto/$id`), deixando o usuário perdido.
**Solução:** Detectar rotas filhas de módulo e renderizar breadcrumb com fallback para o módulo pai.
**Arquivo:** `src/components/global-breadcrumb.tsx`

### 1.2 Sidebar Destacar Módulo Ativo em Rotas Filhas
**Problema:** Em `/produto/$id`, a sidebar não destaca "Produtos" como ativo.
**Solução:** Comparar `active.startsWith(m.path)` no AppShell para destacar o módulo pai.
**Arquivo:** `src/components/app-shell.tsx`

### 1.3 Tooltips em Termos Técnicos (BOM, BOP, SKU, SAM, MRP)
**Problema:** Usuário leigo não entende jargão PLM.
**Solução:** Adicionar tooltips explicativos em português nos labels dos campos técnicos.
**Arquivos:** `src/components/tech-pack/panels.tsx`, `src/components/product-creation-wizard.tsx`, `src/routes/_authenticated/_app.produto.$id.tsx`

### 1.4 Confirmação em Ações Destrutivas
**Problema:** Botão "Remover" produto não tem confirmação.
**Solução:** Adicionar `alert-dialog` de confirmação antes de excluir.
**Arquivo:** `src/routes/_authenticated/_app.produtos.tsx`

---

## LOTE 2 — 🟡 Correções Médias (Fluxo Diário)

### 2.1 Agrupar Abas Técnicas no Workspace
**Problema:** 11 abas confundem o usuário.
**Solução:** Separar em "Principais" (Overview, Ficha, Protótipos, Timeline) e "Avançadas" (BOM, BOP, Medidas, Custos, PCP, Marketing, BI) com separador visual.
**Arquivo:** `src/routes/_authenticated/_app.produto.$id.tsx`

### 2.2 Botão "Editar Ficha" Mostrar Desabilitado Quando Não Há Ficha
**Problema:** Botão de edição some quando não há ficha técnica.
**Solução:** Mostrar botão desabilitado com tooltip "Crie uma ficha técnica primeiro".
**Arquivo:** `src/routes/_authenticated/_app.produto.$id.tsx`

### 2.3 Filtros da Lista de Produtos em URL
**Problema:** Filtros não persistem ao navegar e voltar.
**Solução:** Usar query params para todos os filtros (status, coleção, busca, pinned).
**Arquivo:** `src/routes/_authenticated/_app.produtos.tsx`

### 2.4 Input de Cores e Tamanhos como Chips no ProductDialog
**Problema:** Input de texto livre separado por vírgula é propenso a erro.
**Solução:** Substituir por seletor de chips (tags) visual no ProductDialog.
**Arquivo:** `src/routes/_authenticated/_app.produtos.tsx`

---

## LOTE 3 — 🟢 Correções Leves (Polimento)

### 3.1 Renomear Módulos em Inglês
**Problema:** "Fashion Calendar", "Fit Sessions", "Target Costing" em inglês.
**Solução:** Adicionar tradução em português nos breadcrumbs e labels.
**Arquivo:** `src/lib/modules.ts`

### 3.2 Nomenclatura Padrão "Salvar Rascunho" vs "Publicar"
**Problema:** Botões "Salvar" vs "Criar" vs "Atualizar" inconsistentes.
**Solução:** Padronizar para "Salvar rascunho" e "Publicar" nos dialogs.
**Arquivos:** Múltiplos componentes de dialog.

### 3.3 Export CSV com Grade Expandida
**Problema:** Arrays de cores e tamanhos são exportados como JSON.
**Solução:** Expandir em colunas separadas no CSV.
**Arquivo:** `src/lib/csv.ts`

---

## 📋 Resumo de Impacto

| Lote | Arquivos | Esforço |
|------|----------|---------|
| 🔴 Lote 1 | 4 | 2 dias |
| 🟡 Lote 2 | 2 | 3 dias |
| 🟢 Lote 3 | 3 | 1 dia |
| **Total** | **9** | **~6 dias** |
