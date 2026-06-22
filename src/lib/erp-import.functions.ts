/**
 * Sync ERP → PLM (read-only do lado do ERP).
 * Lê via `usesoftQuery` e faz upsert em tabelas do PLM por (owner_id, erp_source, erp_id).
 * Não sobrescreve campos próprios do PLM (palette, cover_url, description, etc).
 */
import type { Database } from "@/integrations/supabase/types";
type CollectionUpdate = Database["public"]["Tables"]["collections"]["Update"];
type CollectionStatus = Database["public"]["Enums"]["collection_status"];
type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
type ProductStatus = Database["public"]["Enums"]["product_status"];
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";



const ERP_SOURCE = "usesoft";

export const syncErpCollections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const startedAt = new Date().toISOString();

    const { usesoftQuery } = await import(
      "@/integrations/usesoft/client.server"
    );

    // 1) LEITURA do ERP (read-only)
    let erpRows: Array<{
      nnumerogrife: number | string;
      cdescrigrife: string;
      cstatusgrife: string | null;
    }> = [];
    try {
      const r = await usesoftQuery<{
        nnumerogrife: number | string;
        cdescrigrife: string;
        cstatusgrife: string | null;
      }>(
        `SELECT nnumerogrife, cdescrigrife, cstatusgrife
           FROM solgrife
          ORDER BY cdescrigrife`,
      );
      erpRows = r.rows;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
      await supabase.from("erp_sync_log").insert({
        owner_id: userId,
        direction: "in",
        event_type: "sync",
        entity_type: "collections",
        entity_ref: "solgrife",
        status: "error",
        records_affected: 0,
        error_message: msg,
      });
      throw new Error(msg);
    }

    // 2) Carrega coleções já vinculadas ao ERP para esse owner
    const { data: existing } = await supabase
      .from("collections")
      .select("id, erp_id, name, status")
      .eq("owner_id", userId)
      .eq("erp_source", ERP_SOURCE);

    const existingByErpId = new Map<string, { id: string; name: string; status: string }>(
      (existing ?? []).map((c) => [
        String(c.erp_id),
        { id: c.id as string, name: c.name as string, status: c.status as string },
      ]),
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    // 3) Upsert por linha (volume baixo; grifes raramente passam de centenas)
    for (const row of erpRows) {
      const erpId = String(row.nnumerogrife);
      const nome = String(row.cdescrigrife ?? "").trim();
      if (!nome) {
        skipped++;
        continue;
      }
      const ativa = (row.cstatusgrife ?? "A") === "A";

      const found = existingByErpId.get(erpId);
      if (found) {
        // Só atualiza name (cadastro do ERP) e timestamp; preserva campos PLM.
        const patch: CollectionUpdate = { erp_synced_at: now };
        if (found.name !== nome) patch.name = nome;
        // Se o ERP desativou e o PLM ainda está em briefing/desenvolvimento,
        // marcamos como descontinuada. Nunca rebaixa um lançamento ativo.
        if (
          !ativa &&
          (found.status === "briefing" || found.status === "desenvolvimento")
        ) {
          patch.status = "descontinuada";
        }
        const { error } = await supabase
          .from("collections")
          .update(patch)
          .eq("id", found.id);
        if (!error) updated++;
        else skipped++;
      } else {
        // Nova coleção espelhada do ERP — começa em "briefing" para o PLM trabalhar.
        const newStatus: CollectionStatus = ativa ? "briefing" : "descontinuada";
        const { error } = await supabase.from("collections").insert({
          owner_id: userId,
          name: nome,
          season: "ERP",
          year: new Date().getFullYear(),
          status: newStatus,
          erp_source: ERP_SOURCE,
          erp_id: erpId,
          erp_synced_at: now,
        });
        if (!error) inserted++;
        else skipped++;
      }
    }

    const summary = {
      total_erp: erpRows.length,
      inserted,
      updated,
      skipped,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    };

    await supabase.from("erp_sync_log").insert({
      owner_id: userId,
      direction: "in",
      event_type: "sync",
      entity_type: "collections",
      entity_ref: "solgrife",
      status: "success",
      records_affected: inserted + updated,
      payload: summary,
    });

    return summary;
  });

export const getErpCollectionSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ count: linkedCount }, { data: lastLog }] = await Promise.all([
      supabase
        .from("collections")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .eq("erp_source", ERP_SOURCE),
      supabase
        .from("erp_sync_log")
        .select("created_at, status, records_affected, payload, error_message")
        .eq("owner_id", userId)
        .eq("entity_type", "collections")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      linked: linkedCount ?? 0,
      lastSync: lastLog ?? null,
    };
  });
