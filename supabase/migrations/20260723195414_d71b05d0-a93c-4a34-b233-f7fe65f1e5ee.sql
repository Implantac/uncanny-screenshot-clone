
CREATE OR REPLACE VIEW public.v_product_events
WITH (security_invoker = true) AS
SELECT
  p.id::text                              AS event_id,
  p.owner_id,
  p.id                                    AS product_id,
  p.created_at                            AS occurred_at,
  'product'::text                         AS source,
  'created'::text                         AS event_type,
  'Produto criado'::text                  AS title,
  COALESCE(p.name, p.sku)                 AS detail,
  'default'::text                         AS severity,
  'products'::text                        AS ref_table,
  p.id::text                              AS ref_id,
  NULL::text                              AS actor_email
FROM public.products p

UNION ALL
SELECT
  ('proto-' || pr.id::text),
  pr.owner_id, pr.product_id,
  COALESCE(pr.updated_at, pr.created_at),
  'prototype', 'stage:' || pr.stage::text,
  'Protótipo ' || pr.code || ' · ' || pr.stage::text,
  pr.notes,
  CASE WHEN pr.stage::text = 'aprovado' THEN 'success'
       WHEN pr.stage::text = 'reprovado' THEN 'danger'
       ELSE 'primary' END,
  'prototypes', pr.id::text, NULL
FROM public.prototypes pr
WHERE pr.product_id IS NOT NULL

UNION ALL
SELECT
  ('pgate-' || pg.id::text),
  pg.owner_id, pr.product_id,
  COALESCE(pg.decided_at, pg.updated_at, pg.created_at),
  'prototype_gate', 'gate:' || pg.gate::text || ':' || pg.status::text,
  'Gate ' || pg.gate::text || ' · ' || pg.status::text || ' (' || pr.code || ')',
  pg.notes,
  CASE WHEN pg.status::text = 'aprovado' THEN 'success'
       WHEN pg.status::text = 'reprovado' THEN 'danger'
       ELSE 'warning' END,
  'prototype_gates', pg.id::text, NULL
FROM public.prototype_gates pg
JOIN public.prototypes pr ON pr.id = pg.prototype_id
WHERE pr.product_id IS NOT NULL

UNION ALL
SELECT
  ('sheet-' || ts.id::text),
  ts.owner_id, ts.product_id,
  COALESCE(ts.approved_at, ts.updated_at, ts.created_at),
  'tech_sheet', 'status:' || ts.status::text,
  'Ficha técnica ' || COALESCE(ts.version, '—') || ' · ' || ts.status::text,
  ts.approval_note,
  CASE WHEN ts.status::text = 'aprovada' THEN 'success' ELSE 'default' END,
  'tech_sheets', ts.id::text, NULL
FROM public.tech_sheets ts
WHERE ts.product_id IS NOT NULL

UNION ALL
SELECT
  ('sheetv-' || tsv.id::text),
  tsv.owner_id, ts.product_id, tsv.created_at,
  'tech_sheet_version', 'version:' || tsv.version_number::text,
  'Ficha versão v' || tsv.version_number::text || COALESCE(' · ' || tsv.label, ''),
  tsv.notes, 'primary',
  'tech_sheet_versions', tsv.id::text, NULL
FROM public.tech_sheet_versions tsv
JOIN public.tech_sheets ts ON ts.id = tsv.tech_sheet_id
WHERE ts.product_id IS NOT NULL

UNION ALL
SELECT
  ('fit-' || fs.id::text),
  fs.owner_id, fs.product_id,
  COALESCE(fs.session_date::timestamptz, fs.created_at),
  'fit_session', 'status:' || fs.status::text,
  'Prova de modelagem · ' || fs.status::text,
  fs.fit_model, 'primary',
  'fit_sessions', fs.id::text, NULL
FROM public.fit_sessions fs
WHERE fs.product_id IS NOT NULL

UNION ALL
SELECT
  ('op-' || po.id::text),
  po.owner_id, po.product_id, po.created_at,
  'production_order', 'opened:' || po.status::text,
  'OP ' || po.code || ' aberta (' || COALESCE(po.quantity, 0)::text || ' pç)',
  'Estágio ' || po.stage::text || ' · ' || po.status::text,
  'primary',
  'production_orders', po.id::text, NULL
FROM public.production_orders po
WHERE po.product_id IS NOT NULL

UNION ALL
SELECT
  ('stage-' || psl.id::text),
  psl.owner_id, po.product_id, psl.created_at,
  'production_stage_log', 'stage:' || psl.to_stage::text,
  COALESCE(po.code, 'OP') || ': ' || COALESCE(psl.from_stage::text, '—') || ' → ' || psl.to_stage::text,
  CASE WHEN psl.is_partial THEN 'Parcial' ELSE 'Integral' END
    || ' · ' || psl.quantity::text || ' pç'
    || COALESCE(' · ' || psl.note, ''),
  CASE WHEN psl.is_partial THEN 'warning' ELSE 'success' END,
  'production_stage_log', psl.id::text, NULL
FROM public.production_stage_log psl
JOIN public.production_orders po ON po.id = psl.order_id
WHERE po.product_id IS NOT NULL

UNION ALL
SELECT
  ('occ-' || occ.id::text),
  occ.owner_id, po.product_id, occ.created_at,
  'production_occurrence', 'occurrence:' || occ.status,
  'Ocorrência ' || occ.kind || COALESCE(' · ' || occ.sector, '') || ' · ' || occ.status,
  occ.description
    || CASE WHEN occ.affected_qty IS NOT NULL AND occ.affected_qty > 0
            THEN ' · ' || occ.affected_qty::text || ' pç afetadas' ELSE '' END,
  CASE WHEN occ.status = 'aberta' THEN 'warning'
       WHEN occ.status = 'resolvida' THEN 'success'
       ELSE 'default' END,
  'production_occurrences', occ.id::text, NULL
FROM public.production_occurrences occ
JOIN public.production_orders po ON po.id = occ.order_id
WHERE po.product_id IS NOT NULL

UNION ALL
SELECT
  ('qi-' || qi.id::text),
  qi.owner_id, po.product_id, qi.created_at,
  'quality_inspection', 'result:' || COALESCE(qi.result, 'pendente'),
  'Inspeção ' || COALESCE(qi.inspection_type, '') || ' · ' || COALESCE(qi.result, 'pendente'),
  'Crít: ' || COALESCE(qi.critical_defects,0)::text
    || ' · Maior: ' || COALESCE(qi.major_defects,0)::text
    || ' · Menor: ' || COALESCE(qi.minor_defects,0)::text,
  CASE WHEN qi.result IN ('aprovado','aprovada') THEN 'success'
       WHEN qi.result IN ('reprovado','reprovada') THEN 'danger'
       ELSE 'default' END,
  'quality_inspections', qi.id::text, NULL
FROM public.quality_inspections qi
JOIN public.production_orders po ON po.id = qi.production_order_id
WHERE po.product_id IS NOT NULL

UNION ALL
SELECT
  ('capa-i-' || cp.id::text),
  cp.owner_id, po.product_id, cp.created_at,
  'quality_capa', 'capa:' || cp.status,
  'CAPA ' || COALESCE(cp.severity, '') || ' · ' || cp.status,
  cp.title,
  CASE WHEN cp.severity = 'critica' THEN 'danger'
       WHEN cp.severity IN ('alta','media') THEN 'warning'
       ELSE 'default' END,
  'quality_capa', cp.id::text, NULL
FROM public.quality_capa cp
JOIN public.quality_inspections qi ON qi.id = cp.inspection_id
JOIN public.production_orders po ON po.id = qi.production_order_id
WHERE po.product_id IS NOT NULL

UNION ALL
SELECT
  ('capa-o-' || cp.id::text),
  cp.owner_id, po.product_id, cp.created_at,
  'quality_capa', 'capa:' || cp.status,
  'CAPA ' || COALESCE(cp.severity, '') || ' · ' || cp.status,
  cp.title,
  CASE WHEN cp.severity = 'critica' THEN 'danger'
       WHEN cp.severity IN ('alta','media') THEN 'warning'
       ELSE 'default' END,
  'quality_capa', cp.id::text, NULL
FROM public.quality_capa cp
JOIN public.production_orders po ON po.id = cp.order_id
WHERE cp.order_id IS NOT NULL
  AND cp.inspection_id IS NULL
  AND po.product_id IS NOT NULL

UNION ALL
SELECT
  ('audit-' || al.id::text),
  p.owner_id, p.id, al.created_at,
  'audit', 'audit:' || al.action,
  'Auditoria: ' || al.action,
  al.actor_email,
  'default',
  'audit_logs', al.id::text, al.actor_email
FROM public.audit_logs al
JOIN public.products p ON p.id::text = al.entity_id
WHERE al.entity IN ('product','tech_sheet','prototype');

GRANT SELECT ON public.v_product_events TO authenticated;
GRANT SELECT ON public.v_product_events TO service_role;

COMMENT ON VIEW public.v_product_events IS
  'Linha do tempo unificada por produto (security_invoker: respeita RLS das tabelas de origem).';
