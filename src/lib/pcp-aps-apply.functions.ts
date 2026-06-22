import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Persiste o sequenciamento APS no banco mapeando a posição da fila
 * para o campo `priority` (1..5) das OPs. Topo da fila → priority 5.
 *
 * Recebe a lista de IDs já ordenada (a UI tem o ranking calculado).
 */
export const applyApsSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderedOpIds: z.array(z.string().uuid()).min(1).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const total = data.orderedOpIds.length;

    let updated = 0;
    for (let i = 0; i < total; i++) {
      // top da fila = priority 5, decai linearmente até 1
      const rank = total === 1 ? 5 : Math.round(5 - (i / (total - 1)) * 4);
      const priority = Math.max(1, Math.min(5, rank));
      const { error } = await supabase
        .from("production_orders")
        .update({ priority })
        .eq("id", data.orderedOpIds[i])
        .eq("owner_id", userId);
      if (!error) updated++;
    }

    return { ok: true, updated, total };
  });
