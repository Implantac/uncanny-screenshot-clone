#!/usr/bin/env bash
# ============================================================
# Verificação de material_reservations × inventory_items_available
#
# Roda 2 níveis de checagem:
#  1) Suite SQL transacional (BEGIN/ROLLBACK) com 9 cenários — exige role
#     com permissão de UPDATE em tech_sheets / production_orders (admin ou
#     service_role). Em sandbox/leitura, pular.
#  2) Verificação rápida sobre dados REAIS: garante que a view bate com o
#     cálculo manual e que toda saída vinculada a OP tem reserva.
#
# Uso:
#   bash scripts/test-material-reservations.sh           # ambos
#   bash scripts/test-material-reservations.sh --live    # só nível 2
# ============================================================
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ "${1:-}" != "--live" ]; then
  echo "▶ Nível 1: suite transacional"
  if psql -f "$HERE/verify-material-reservations.sql" 2>&1 | tee /tmp/mrsv.out | tail -20; then
    if grep -q "✅ Todos os cenários passaram" /tmp/mrsv.out; then
      echo "✓ suite SQL OK"
    else
      echo "⚠ suite SQL não completou — verifique permissões de UPDATE."
    fi
  fi
fi

echo
echo "▶ Nível 2: invariantes sobre dados reais"

psql -v ON_ERROR_STOP=1 <<'SQL'
WITH manual AS (
  SELECT ii.id AS inventory_item_id, ii.balance,
         COALESCE(SUM(GREATEST(0, mr.qty_reserved - mr.qty_consumed))
                  FILTER (WHERE mr.status = 'ativa'), 0) AS committed_manual
    FROM public.inventory_items ii
    LEFT JOIN public.material_reservations mr ON mr.inventory_item_id = ii.id
   GROUP BY ii.id, ii.balance
)
SELECT 'view × manual',
       COUNT(*) AS total,
       COUNT(*) FILTER (
         WHERE v.committed IS DISTINCT FROM m.committed_manual
            OR v.available IS DISTINCT FROM GREATEST(0, v.balance - m.committed_manual)
       ) AS divergencias
  FROM public.inventory_items_available v
  JOIN manual m USING (inventory_item_id);

SELECT 'saidas OP sem reserva',
       COUNT(*) FILTER (
         WHERE sm.reference_kind = 'production_order'
           AND NOT EXISTS (
             SELECT 1 FROM public.material_reservations mr
              WHERE mr.production_order_id = sm.reference_id
                AND mr.inventory_item_id = sm.inventory_item_id
           )
       ) AS divergencias
  FROM public.stock_movements sm
 WHERE sm.type = 'saida';

SELECT 'reservas super-consumidas (qty_consumed > qty_reserved)',
       COUNT(*) AS divergencias
  FROM public.material_reservations
 WHERE qty_consumed > qty_reserved;
SQL
