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

// ============================================================================
// PRODUTOS — solprodu → public.products
// ============================================================================

export const syncErpProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const startedAt = new Date().toISOString();

    const { usesoftQuery } = await import(
      "@/integrations/usesoft/client.server"
    );

    // 1) LEITURA do ERP (somente produtos ativos, com vínculo opcional à grife)
    type ErpRow = {
      nnumeroprodu: number | string;
      ccodigoprodu: string | null;
      ceanprodu: string | null;
      cnomeprodu: string;
      cstatusprodu: string | null;
      ncustoprodu: number | string | null;
      nprcvenprodu: number | string | null;
      nnumerogrife: number | string | null;
      cdsccplprodu: string | null;
    };
    let erpRows: ErpRow[] = [];
    try {
      const r = await usesoftQuery<ErpRow>(
        `SELECT nnumeroprodu, ccodigoprodu, ceanprodu, cnomeprodu,
                cstatusprodu, ncustoprodu, nprcvenprodu,
                nnumerogrife, cdsccplprodu
           FROM solprodu
          WHERE cstatusprodu = 'A'
          ORDER BY cnomeprodu`,
      );
      erpRows = r.rows;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
      await supabase.from("erp_sync_log").insert({
        owner_id: userId,
        direction: "in",
        event_type: "sync",
        entity_type: "products",
        entity_ref: "solprodu",
        status: "error",
        records_affected: 0,
        error_message: msg,
      });
      throw new Error(msg);
    }

    // 2) Mapa de grifes do ERP → collection.id do PLM (para auto-vinculo)
    const { data: erpCollections } = await supabase
      .from("collections")
      .select("id, erp_id")
      .eq("owner_id", userId)
      .eq("erp_source", ERP_SOURCE);
    const collectionByErpId = new Map<string, string>(
      (erpCollections ?? [])
        .filter((c) => c.erp_id)
        .map((c) => [String(c.erp_id), c.id as string]),
    );

    // 3) Produtos já vinculados ao ERP
    const { data: existing } = await supabase
      .from("products")
      .select("id, erp_id, name, status, cost_price, sell_price, collection_id")
      .eq("owner_id", userId)
      .eq("erp_source", ERP_SOURCE);
    const existingByErpId = new Map<
      string,
      {
        id: string;
        name: string;
        status: string;
        cost_price: number | null;
        sell_price: number | null;
        collection_id: string | null;
      }
    >(
      (existing ?? []).map((p) => [
        String(p.erp_id),
        {
          id: p.id as string,
          name: p.name as string,
          status: p.status as string,
          cost_price: p.cost_price as number | null,
          sell_price: p.sell_price as number | null,
          collection_id: p.collection_id as string | null,
        },
      ]),
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    for (const row of erpRows) {
      const erpId = String(row.nnumeroprodu);
      const nome = String(row.cnomeprodu ?? "").trim();
      if (!nome) {
        skipped++;
        continue;
      }
      const sku =
        (row.ccodigoprodu ? String(row.ccodigoprodu).trim() : "") ||
        `ERP-${erpId}`;
      const custo = row.ncustoprodu == null ? 0 : Number(row.ncustoprodu) || 0;
      const preco = row.nprcvenprodu == null ? 0 : Number(row.nprcvenprodu) || 0;
      const collectionId = row.nnumerogrife
        ? collectionByErpId.get(String(row.nnumerogrife)) ?? null
        : null;

      const found = existingByErpId.get(erpId);
      if (found) {
        // Atualiza só campos espelhados do ERP. Preserva ficha técnica,
        // imagens, sizes/colors, descrições e qualquer trabalho do PLM.
        const patch: ProductUpdate = { erp_synced_at: now };
        if (found.name !== nome) patch.name = nome;
        if ((found.cost_price ?? 0) !== custo) patch.cost_price = custo;
        if ((found.sell_price ?? 0) !== preco) patch.sell_price = preco;
        if (collectionId && found.collection_id !== collectionId) {
          patch.collection_id = collectionId;
        }
        const { error } = await supabase
          .from("products")
          .update(patch)
          .eq("id", found.id);
        if (!error) updated++;
        else skipped++;
      } else {
        const newStatus: ProductStatus = "producao";
        const { error } = await supabase.from("products").insert({
          owner_id: userId,
          name: nome,
          sku,
          status: newStatus,
          cost_price: custo,
          sell_price: preco,
          collection_id: collectionId,
          description: row.cdsccplprodu ? String(row.cdsccplprodu) : null,
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
      entity_type: "products",
      entity_ref: "solprodu",
      status: "success",
      records_affected: inserted + updated,
      payload: summary,
    });

    return summary;
  });

export const getErpProductSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ count: linkedCount }, { data: lastLog }] = await Promise.all([
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .eq("erp_source", ERP_SOURCE),
      supabase
        .from("erp_sync_log")
        .select("created_at, status, records_affected, payload, error_message")
        .eq("owner_id", userId)
        .eq("entity_type", "products")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      linked: linkedCount ?? 0,
      lastSync: lastLog ?? null,
    };
  });

