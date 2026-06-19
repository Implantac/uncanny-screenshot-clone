import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({ q: z.string().trim().max(80).optional().default("") });

export const lookupCommandRefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const q = data.q;

    const productsQ = supabase
      .from("products")
      .select("sku, name")
      .eq("owner_id", userId)
      .not("sku", "is", null)
      .order("updated_at", { ascending: false })
      .limit(25);
    const suppliersQ = supabase
      .from("suppliers")
      .select("name")
      .eq("owner_id", userId)
      .eq("active", true)
      .order("name")
      .limit(25);

    const [{ data: products }, { data: suppliers }] = await Promise.all([
      q ? productsQ.or(`sku.ilike.%${q}%,name.ilike.%${q}%`) : productsQ,
      q ? suppliersQ.ilike("name", `%${q}%`) : suppliersQ,
    ]);

    return {
      products: (products ?? []).map((p: any) => ({
        sku: p.sku as string,
        name: p.name as string,
      })),
      suppliers: (suppliers ?? []).map((s: any) => s.name as string),
    };
  });
