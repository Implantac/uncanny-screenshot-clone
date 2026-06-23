## Demand Planning + Grade de Estoque (evolução do almoxarifado inteligente)

Reaproveita 100% do que já existe (`inventory-smart.functions.ts`, `inventory-smart-panel.tsx`, ROP/EOQ/Z, `product_variants`, `suppliers`, `sales`/`erp_sales_mirror`, `purchase_orders`). Nada é removido — adicionamos camadas: ABC automático, grade por categoria, sazonalidade mensal e um **painel de compras agrupado por fornecedor com matriz cor × tamanho**.

---

### 1) Banco (1 migration única)

Novas tabelas + 1 coluna em `products`:

- `products.abc_class` enum `product_abc_class` (`A`,`B`,`C`) — nullable, calculado pelo job.
- `products.abc_revenue_12m numeric` — cache do faturamento usado no ranking.
- `products.abc_updated_at timestamptz`.
- `size_grids` — grade padrão de vendas por categoria/grupo.  
  Campos: `owner_id`, `scope` (`category` | `product_group` | `product`), `scope_value text`, `product_id uuid null`, `distribution jsonb` (`{"P":0.10,"M":0.40,"G":0.40,"GG":0.10}`), `notes`.  
  Unique: `(owner_id, scope, scope_value, product_id)`.
- `seasonality_curves` — multiplicador mensal por escopo.  
  Campos: `owner_id`, `scope`, `scope_value`, `multipliers jsonb` (`{"1":0.5,...,"12":1.2}`), `notes`.  
  Unique igual.

Função `public.recompute_abc_class(_owner uuid)` (SECURITY DEFINER) — soma `sales.total_value` (fallback `erp_sales_mirror.total_value`) dos últimos 365d, ranqueia por receita, marca top 20% = A, 30% = B, 50% = C. Atualiza `products.abc_class/abc_revenue_12m/abc_updated_at`.

Grants padrão `authenticated`/`service_role` em ambas as tabelas + RLS `auth.uid() = owner_id`. Função executável por `authenticated`.

Não tocar em tabelas existentes além da coluna em `products` (compatível, default NULL).

---

### 2) Lógica (server functions, em arquivos novos)

`src/lib/demand-planning.functions.ts`:

- `recomputeAbcClass()` → `select` na função SQL acima, devolve contagem por classe.
- `getSeasonalityFactor(productId, month)` → resolve cascata `product → product_group → category → 1.0`. Helper puro server-side.
- `getDemandPlanningByVariant({ productId? })` — para cada variant ativa:
  - puxa `annualDemand` e `dailyAvg` do pai (consumo via `sales`/`erp_sales_mirror` ou, na falta, do `stock_movements` do item de almoxarifado vinculado);
  - aplica % da grade resolvida (variant.size → distribution[size]);
  - aplica fator de sazonalidade do mês corrente em `dailyAvg`;
  - Z dinâmico por `abc_class` (A=1.65, B=1.41, C=1.28; default 1.65);
  - calcula `safetyStock`, `ROP`, `LEC` (S/H vindos de `mrp_overrides` do produto, com defaults atuais);
  - status `Emitir Pedido` se `variant_balance ≤ ROP` (balance via `production_order_grid`/saldo do almoxarifado ligado ao SKU; quando ausente, balance=0).
- `getPurchaseSuggestionsBySupplier()` — agrupa variantes em `Emitir Pedido` por `products.preferred_supplier_id` (fallback `suppliers` via `inventory_items.preferred_supplier_id` do pai). Retorna por fornecedor:
  ```
  { supplier, products: [{ product, rows:[color], cols:[size], matrix:{[colorId]:{[sizeId]:lec}}, totalQty, totalCost }], totalQty, totalCost }
  ```

`src/lib/size-grids.functions.ts` + `src/lib/seasonality.functions.ts`: CRUD simples (`list`, `upsert`, `delete`) com `requireSupabaseAuth`, validação Zod (soma da distribuição ≈ 1; multiplicadores 0–5 com aviso fora da faixa).

---

### 3) UI (rotas e componentes novos, sem remover nada)

Reaproveita design tokens, `glass`, `Badge`, `Tabs`, `Dialog`, sonner. Mantém `inventory-smart-panel.tsx` intacto.

- **Nova rota** `src/routes/_authenticated/_app.demand-planning.tsx` com 3 abas:
  1. **Sugestão de compras por fornecedor** (default).
     - Lista de cards por fornecedor (logo/inicial, total peças, custo total, badge se atingir/atinge mínimo do fornecedor caso configurado).
     - Para cada produto pai dentro do card: matriz **linhas=cor × colunas=tamanho** com o LEC por SKU, célula vazia quando variant não existe; linha total e coluna total; rodapé com `Total peças`, `Custo total`, botão **"Gerar pedido de compra"** (cria `purchase_orders` + `purchase_order_items` aproveitando o fluxo existente).
  2. **Grade padrão** — editor por categoria/grupo: tabela com tamanhos como colunas; input % por tamanho; soma destacada em verde quando =100%, vermelha caso ≠. Salva em `size_grids`.
  3. **Sazonalidade** — 12 inputs (Jan–Dez), preview gráfico em barras com Recharts (já existe no projeto), com pré-sets ("verão", "inverno", "neutro"). Salva em `seasonality_curves`.
- **Painel adicional** dentro de `inventory-smart-panel.tsx`: badge mostrando a classe ABC do pai (A/B/C) e o Z aplicado, com tooltip "ABC recalculado em <data>". Botão "Recalcular ABC" no header da aba "Reposição".
- **Item no menu lateral**: adicionar entrada "Demand Planning" em `app-sidebar.tsx` (ou equivalente) abaixo de "Almoxarifado".

UX: máx 2 cliques para emitir pedido (card → "Gerar pedido"). Matriz editável só na aba "Grade padrão" — na sugestão é read-only. IA explica o porquê em cada card ("Z 1.65 (classe A) · sazonalidade jun 1.8 × · LEC otimizado").

---

### 4) Integrações com o que já existe

- `inventory-smart.functions.ts` continua sendo a fonte para itens de almoxarifado (matérias-primas). Demand Planning trata produtos acabados/SKUs.
- Reutiliza `applyReorderSuggestion`/`updateReorderParams` (S, H) — agora ao nível do produto pai.
- Geração de pedido reusa `purchase_orders` + `purchase_order_items` (trigger `purchase_orders_to_financial_account` já existente cria a conta a pagar automaticamente quando aprovado).
- Notificações: nada novo — usa `marketing_notifications` apenas se já existir um canal para PCP.

---

### 5) Validações (consistentes com a faixa atual)

- `service_factor_z`: 0–4 (default por classe).
- `holding_cost_annual`: 0–10.000.
- `lead_time_days`: 1–365.
- `daily_avg_sales`: 0–100.000.
- Distribuição de grade: cada tamanho 0–1; soma 0,95–1,05 (aviso fora).
- Multiplicador sazonal: 0–5 (aviso >3).
- Erros aparecem inline no painel já criado.

---

### Entregáveis

1. 1 migration (tabelas + coluna + função SQL + grants + RLS).
2. 3 arquivos `.functions.ts` (demand-planning, size-grids, seasonality).
3. 1 rota nova + 3 componentes (`PurchaseBySupplierPanel`, `SizeGridEditor`, `SeasonalityEditor`).
4. Pequena evolução do `inventory-smart-panel.tsx` (badge ABC + botão recalcular).
5. Item no menu lateral.

Nada existente é removido; o módulo atual continua funcional para matérias-primas.