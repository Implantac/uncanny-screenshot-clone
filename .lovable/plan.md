## Visão geral

A auditoria identificou **20 features parciais** — todas evoluem código já existente (zero telas novas, zero recursos de ERP). Plano em **4 ondas progressivas**, começando por 6 quick wins de alto impacto.

---

## 🌊 Onda 1 — Quick Wins (esforço S, alto impacto)

Tudo aqui é "ligar fio solto": o dado/lógica já existe, falta UI ou conexão.

### 1.1 Meta de receita real em `/colecao-360`
- `colecao-360.tsx:1133` usa `investment × 1.5` hardcoded.
- Incluir `target_revenue, target_pieces, target_margin_pct` na query de coleções.
- Substituir o cálculo pelo campo real; fallback ao cálculo só quando `target_revenue` é null.
- Adicionar inputs desses 3 campos no formulário de edição em `/colecoes`.

### 1.2 `scrap_reason` em sucata/refugo
- Migration: adicionar `scrap_reason text` em `stock_movements`.
- Enum sugerido: `corte`, `costura`, `acabamento`, `defeito_mp`, `manuseio`, `outro`.
- Dropdown no formulário de ajuste de estoque; filtro novo em `inventory-scraps-panel`.

### 1.3 UI de Preferências de Notificação
- Tabela `notification_preferences` já existe.
- Novo drawer em `notifications-bell.tsx` com toggles por categoria (qualidade, produção, marketing, compras, sistema).
- Persistir em `notification_preferences`; filtro do bell passa a ler do banco em vez de `useState` local.
- Resolve simultaneamente item 17 (filtro persistido).

### 1.4 RCA por Fornecedor — render check
- `supplier-defect-rca-panel.tsx` existe mas pode não estar renderizado.
- Adicionar como aba "Reincidência" em `/fornecedores` e card em `/quality`.
- Se faltar query consolidada, finalizar `quality-rca.functions.ts`.

### 1.5 Cartela de Cores Mestre em `/biblioteca`
- Nova aba "Cores" lendo `product_color_options` agrupado por coleção/temporada.
- Filtros: temporada, família, status (ativa/descontinuada).
- Botão "promover para padrão" marca cor como reutilizável.

### 1.6 Drag-and-drop em operações da Ficha Técnica
- `tech_sheet_operations.position` já existe.
- `@dnd-kit/sortable` (já instalado em outras telas) nas linhas de operação.
- Mutation `update position` em lote ao soltar.

**Entrega Onda 1:** 6 features concluídas, 1 migration, ~8 arquivos editados.

---

## 🌊 Onda 2 — PLM Core (esforço M)

### 2.1 Botão "Aprovar Ficha Técnica" funcional
- Server function `approveTechSheet` que escreve `approved_by = auth.uid()`, `approved_at = now()`.
- RLS policy: só `engenharia` ou `admin` aprovam (via `has_role`).
- Botão "Aprovar" no `tech-sheet-drawer` com confirmação; bloqueia edição após aprovação.

### 2.2 Diff lado-a-lado entre versões de Ficha Técnica
- Em `tech-sheet-versions-drawer`: seletor "Comparar com versão X".
- Server function `diffTechSheetVersions(v1, v2)` retornando linhas added/removed/changed para materiais e operações.
- UI de duas colunas com highlight visual (verde/vermelho/amarelo).

### 2.3 Link BOM ↔ Almoxarifado
- Migration: `tech_sheet_materials.inventory_item_id uuid REFERENCES inventory_items(id)`.
- Combobox de busca de item do almoxarifado na linha da BOM.
- Habilita futuras features de rastreabilidade MP→produto e custeio real.

### 2.4 APS — fechar o loop "Aplicar sequenciamento"
- Confirmar/implementar botão em `pcp-aps-panel` que persiste `priority` ordenada das OPs no banco.
- Toast com resumo: "X OPs reordenadas conforme APS".

**Entrega Onda 2:** 4 features, 1 migration, ~10 arquivos.

---

## 🌊 Onda 3 — Operação Real (esforço M)

### 3.1 Ponto de Reposição Dinâmico em `/compras`
- Server function `computeReorderPoints()`: `turnover_30d × supplier.lead_time_days × safety_factor`.
- Coluna nova na tabela de compras: `Reposição Sugerida` vs `Saldo Atual` vs `Mínimo Manual`.
- IA-explica o motivo de cada sugestão (consistente com regra "IA é especialista").

### 3.2 FEFO com lot/expires reais
- Migration: `stock_movements.lot_number text, expires_at date`.
- Inputs no formulário de entrada de estoque.
- `inventory-fefo.functions.ts` passa a ordenar por `expires_at` real (hoje usa fallback).

### 3.3 Capacidade com dimensão Facção
- Em `/capacity`, toggle "Interna | Facção | Combinada".
- Modo Facção lê `supplier_capacity` agrupado por fornecedor terceirizado.
- Bloco de alerta quando facção próxima do limite.

### 3.4 Mapa SVG do Brasil em `/geo-sales`
- Substituir grid de divs por SVG real de UFs (paths públicos do IBGE).
- `fill` dinâmico pelo heatmap de receita já calculado.
- Hover mostra UF + receita + variação.

**Entrega Onda 3:** 4 features, 1 migration, ~8 arquivos.

---

## 🌊 Onda 4 — Polimento & Testes (mix)

### 4.1 Aprovações com roteamento por papel
- Tabela `approval_rules(entity_type, stage, required_role)`.
- Server function de aprovação valida `has_role(auth.uid(), required_role)`.
- UI mínima de configuração em `/security-center`.

### 4.2 Influencer ROI com mapeamento explícito
- Coluna `influencers.external_code`.
- Tela de mapeamento simples (modal): vincular handle ↔ código do ERP.
- Janela de tempo configurável (7/14/30 dias) para baseline antes/depois.

### 4.3 E2E coverage de fluxos críticos
- Specs Playwright: aprovar ficha técnica, criar OP via MRP, CAPA por inspeção reprovada, lifecycle de coleção.

### 4.4 (Opcional/futuro) `/showroom` lookbook e `/mobile` PWA offline
- Esforço L — fica como backlog após Onda 4. Hoje servem como vitrine; usuário não está bloqueado.

---

## 📋 Detalhes técnicos

**Migrations necessárias:** 4 (scrap_reason, inventory_item_id na BOM, lot/expires em stock_movements, approval_rules + external_code). Todas pequenas, todas com `GRANT` + RLS conforme padrão do projeto.

**Server functions novas:** `approveTechSheet`, `diffTechSheetVersions`, `computeReorderPoints`, `applyApsSequence`, `evaluateApprovalRule`.

**Componentes reutilizados:** `@dnd-kit/sortable`, `tech-sheet-drawer`, `notifications-bell`, `supplier-defect-rca-panel`, `inventory-scraps-panel` — nenhuma biblioteca nova.

**Filosofia respeitada:**
- Zero telas novas; só evolução de existentes.
- Nada de financeiro/fiscal — ERP segue como fonte para receita real, espelhos só leem.
- Máx 2 cliques: drawer de preferências, toggle de capacidade, dropdown de scrap_reason.
- IA explica (ponto de reposição vem com motivo, APS já tem score+motivo).

---

## ❓ Antes de começar

Quer que eu execute **Onda 1 inteira agora** (6 quick wins, ~1 commit), ou prefere ir item-a-item para revisar cada um? Também posso reordenar prioridades se algum item específico for mais urgente para você.