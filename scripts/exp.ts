import { usesoftQuery } from "../src/integrations/usesoft/client.server";
(async () => {
  const s = await usesoftQuery<any>(`
    SELECT t.nnumerotpped, t.cnometpped, t.cmovfintpped, t.ctpvendtpped, t.csiglatpped,
           COUNT(p.nnumeropedid) c, COALESCE(SUM(p.nvalorpedid),0) total
      FROM soltpped t
      LEFT JOIN solpedid p ON p.nnumerotpped = t.nnumerotpped AND p.ddatapedid >= CURRENT_DATE - INTERVAL '90 days'
     WHERE t.nnumerotpped IN ('49115','70438','49199','77683','70440','70439','49131','70546','49132','72714','70757')
     GROUP BY 1,2,3,4,5 ORDER BY c DESC`);
  console.log(JSON.stringify(s.rows, null, 2));
})().catch(e => console.error("ERR:", e.message));
