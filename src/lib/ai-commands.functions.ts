import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateRFQ = z.object({
  kind: z.literal("create_rfq"),
  title: z.string().min(2).max(200),
  quantity: z.coerce.number().min(1),
  unit: z.string().max(20).optional().nullable(),
  needed_by: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const CreateOP = z.object({
  kind: z.literal("create_op"),
  sku: z.string().min(1).max(80),
  quantity: z.coerce.number().min(1),
  supplier_name: z.string().min(1).max(200).optional().nullable(),
  due_date: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const BlockSupplier = z.object({
  kind: z.literal("block_supplier"),
  supplier_name: z.string().min(1).max(200),
  reason: z.string().max(500).optional().nullable(),
});

const Input = z.discriminatedUnion("kind", [CreateRFQ, CreateOP, BlockSupplier]);

export const executeAICommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.kind === "create_rfq") {
      const code = "RFQ-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
      const { data: row, error } = await (supabase as any)
        .from("rfq_requests")
        .insert({
          owner_id: userId,
          code,
          title: data.title,
          quantity: data.quantity,
          unit: data.unit ?? null,
          needed_by: data.needed_by ?? null,
          notes: data.notes ?? null,
          status: "aberta",
        })
        .select("id, code")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, kind: "create_rfq" as const, id: row.id, code: row.code, link: "/sourcing" };
    }

    if (data.kind === "block_supplier") {
      const { data: sup, error: e1 } = await supabase
        .from("suppliers")
        .select("id, name, active")
        .eq("owner_id", userId)
        .ilike("name", `%${data.supplier_name}%`)
        .limit(1)
        .maybeSingle();
      if (e1) throw new Error(e1.message);
      if (!sup) throw new Error(`Fornecedor "${data.supplier_name}" não encontrado`);
      const note = data.reason ? `[IA bloqueio] ${data.reason}` : "[IA bloqueio]";
      const { error } = await supabase
        .from("suppliers")
        .update({ active: false, notes: note })
        .eq("id", sup.id);
      if (error) throw new Error(error.message);
      return { ok: true, kind: "block_supplier" as const, id: sup.id, name: sup.name, link: "/fornecedores" };
    }

    // create_op
    const { data: prod, error: ep } = await supabase
      .from("products")
      .select("id, name, sku")
      .eq("owner_id", userId)
      .or(`sku.ilike.${data.sku},sku.ilike.%${data.sku}%`)
      .limit(1)
      .maybeSingle();
    if (ep) throw new Error(ep.message);
    if (!prod) throw new Error(`Produto com SKU "${data.sku}" não encontrado`);

    let supplierId: string | null = null;
    if (data.supplier_name) {
      const { data: sup } = await supabase
        .from("suppliers")
        .select("id")
        .eq("owner_id", userId)
        .ilike("name", `%${data.supplier_name}%`)
        .limit(1)
        .maybeSingle();
      supplierId = sup?.id ?? null;
    }

    const code = "OP-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const { data: row, error } = await supabase
      .from("production_orders")
      .insert({
        owner_id: userId,
        code,
        product_id: prod.id,
        supplier_id: supplierId,
        quantity: data.quantity,
        due_date: data.due_date ?? null,
        notes: data.notes ?? "[Criada via IA Comando]",
        status: "aguardando",
        stage: "cad",
      })
      .select("id, code")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, kind: "create_op" as const, id: row.id, code: row.code, link: "/pcp-kanban" };
  });
