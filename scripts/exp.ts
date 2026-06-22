import { usesoftQuery } from "../src/integrations/usesoft/client.server";
(async () => {
  const r = await usesoftQuery<any>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='solpedid' ORDER BY column_name`
  );
  console.log("all cols:", r.rows.map((x:any)=>x.column_name).join(", "));
  const s2 = await usesoftQuery<any>(`SELECT cfatfinpedid, COUNT(*) c FROM solpedid WHERE ddatapedid >= CURRENT_DATE - INTERVAL '90 days' GROUP BY 1 ORDER BY 2 DESC`);
  console.log("cfatfinpedid:", JSON.stringify(s2.rows));
  const s3 = await usesoftQuery<any>(`SELECT cstatuspedid, COUNT(*) c FROM solpedid WHERE ddatapedid >= CURRENT_DATE - INTERVAL '90 days' GROUP BY 1 ORDER BY 2 DESC`);
  console.log("cstatus:", JSON.stringify(s3.rows));
})().catch(e => { console.error("ERR:", e.message); });
