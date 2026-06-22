import { usesoftQuery } from "../src/integrations/usesoft/client.server";
(async () => {
  const cols = await usesoftQuery<any>(`SELECT column_name FROM information_schema.columns WHERE table_name='soltpped' ORDER BY ordinal_position`);
  console.log("cols:", cols.rows.map((x:any)=>x.column_name).join(","));
  const t = await usesoftQuery<any>(`SELECT * FROM soltpped LIMIT 3`);
  console.log("sample:", JSON.stringify(t.rows, null, 2));
})().catch(e => console.error("ERR:", e.message));
