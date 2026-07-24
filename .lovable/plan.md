## Contexto do que já existe (auditoria rápida)

- **Stepper**: `ProductWorkflowStepper` já ativo em `/produto/$id` (linha 254). Bom.
- **Breadcrumb**: componente `ui/breadcrumb` existe mas quase ninguém usa — a maioria das rotas usa só o `eyebrow` do `PageHeader` como "voltar".
- **BOM**: `MaterialsPanel` em `tech-pack/panels.tsx` já tem `MaterialPickerDialog` visual e edição — precisa validar cálculo em tempo real.
- **Medidas**: `MeasurementsPanel` (linha 655) é grid estático, sem regra de salto.
- **Peça piloto**: `_app.prototipo.$id.tsx` tem timeline mas não diff visual entre revisões.
- **Empty States / Skeleton / Badges**: já existem (`EmptyState`, badges com status_color), aplicação inconsistente.
- **Integridade material**: `material_library` referenciada por `tech_sheet_materials.material_id` — hoje não bloqueia.

## Ondas de execução (posso pausar entre cada uma)

### Onda 1 — Navegação consistente (Stepper + Breadcrumbs)
- Criar `PlmBreadcrumb` (wrapper fino sobre `ui/breadcrumb`) que aceita `items: {label, to?, params?}[]`.
- Aplicar breadcrumb Coleção > Produto > SKU em:
  - `_app.produto.$id.tsx` (adiciona Coleção antes de Produtos)
  - `_app.ficha-tecnica.tsx` (Produto > Ficha vX)
  - `_app.prototipo.$id.tsx` (Produto > Piloto)
- Confirmar Stepper presente em Produto, adicionar mini-versão do Stepper no topo de Ficha/Piloto quando `productId` está no contexto (mesmo cache, sem refetch).

### Onda 2 — BOM (edição inline + custo live)
- `MaterialsPanel`: garantir input `consumo` com edição inline direta na célula e recomputo local do `totalCost` via `useMemo` antes de salvar (optimistic).
- Substituir formulário "adicionar material" por `MaterialPickerDialog` já existente onde ainda usar select simples.
- Rodapé sticky com "Custo total materiais: R$ X,XX (recalculado)" com badge amarelo enquanto houver alterações não salvas.

### Onda 3 — Medidas com Regra de Salto (por faixa)
- Adicionar coluna `grade_rule` em `tech_sheet_measurements` (jsonb: `{PP-P:1.5, P-M:2, M-G:2, G-GG:3}`).
- Botão "Aplicar salto" abre popover onde usuário define incremento por faixa (PP-P, P-M, M-G, G-GG) → preenche colunas dependentes a partir do valor base (M por padrão).
- Recomputo puramente client-side; salvar dispara update em batch.

### Onda 4 — Peça piloto: histórico visual + comparar versões
- `_app.prototipo.$id.tsx`: agrupar `prototype_adjustments` em cards "Rodada N" com data, badge de status, foto (attachment thumbnail), comentário.
- Botão "Comparar com anterior" abre `Dialog` com layout 2 colunas (foto + campos alterados destacados).

### Onda 5 — Consistência visual (menor esforço, alto impacto)
- Criar `StatusBadge` central mapeando `product_status`, `prototype_stage`, `production_status` → cor semântica (verde/amarelo/vermelho/azul). Substituir badges ad-hoc nas 4 telas críticas.
- Auditar `EmptyState` em Coleções vazias, Produto sem BOM, Ficha sem medidas — adicionar CTA "Adicionar primeiro".
- Skeleton loader padrão (`TableSkeleton`) nas 3 tabelas maiores (produtos, materiais, protótipos).

### Onda 6 — Integridade referencial (guardrail material)
- Nova server fn `checkMaterialUsage(materialId)` retornando `{ productCount, products: [{sku, name}] }`.
- Ao clicar em excluir material na drawer, chamar checagem primeiro. Se `productCount > 0`, mostrar `AlertDialog`:
  > "Este material está em uso em N produto(s): SKU-01, SKU-02… Remova das fichas antes de excluir."
  Sem opção de forçar (conforme decisão).
- Migration não necessária (já existe FK; só melhora a experiência antes do erro do banco).

## Detalhe técnico

- Novo componente: `src/components/ui/plm-breadcrumb.tsx`, `src/components/status-badge.tsx`.
- Migration (Onda 3): `ALTER TABLE tech_sheet_measurements ADD COLUMN grade_rule jsonb`. Trigger de recompute apenas se `grade_rule IS NOT NULL`.
- Server fn (Onda 6): `src/lib/material-usage.functions.ts` com `.middleware([requireSupabaseAuth])`.
- Nenhuma tabela nova em Ondas 1, 2, 4, 5. Nenhum breaking change em Cloud.

## Ordem de entrega proposta

Executar Ondas 1 + 5 juntas (mesma família UX), depois 2, depois 6 (rápida), depois 3, depois 4. Cada onda é um push separado com typecheck verde antes de seguir.

Confirma essa sequência ou quer reordenar?
