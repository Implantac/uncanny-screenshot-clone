import { usesoftQuery } from "../src/integrations/usesoft/client.server";
(async () => {
  const r = await usesoftQuery<{column_name: string}>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='solpedid' AND (column_name ILIKE '%tipo%' OR column_name ILIKE '%status%' OR column_name ILIKE '%natu%' OR column_name ILIKE '%oper%' OR column_name ILIKE '%fin%') ORDER BY column_name`
  );
  console.log("cols:", r.rows.map(x=>x.column_name).join(", "));
  const sample = await usesoftQuery<any>(`SELECT DISTINCT ntipopedid FROM solpedid WHERE ddatapedid >= CURRENT_DATE - INTERVAL '90 days' ORDER BY ntipopedid`);
  console.log("tipos:", JSON.stringify(sample.rows));
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
