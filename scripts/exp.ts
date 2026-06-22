import { usesoftQuery } from "../src/integrations/usesoft/client.server";
(async () => {
  const s = await usesoftQuery<any>(`SELECT nnumerotpped, COUNT(*) c, SUM(nvalorpedid) total FROM solpedid WHERE ddatapedid >= CURRENT_DATE - INTERVAL '90 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 30`);
  console.log("tpped:", JSON.stringify(s.rows));
  // tipo pedido lookup table?
  const tabs = await usesoftQuery<any>(`SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%tpped%' OR table_name ILIKE '%tippedi%' OR table_name ILIKE 'soltp%'`);
  console.log("tabs:", JSON.stringify(tabs.rows));
})().catch(e => console.error("ERR:", e.message));
