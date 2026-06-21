import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const GATES = ["conceito", "modelagem", "ficha", "piloto", "aprovacao"] as const;
export type GateKey = (typeof GATES)[number];
export type GateStatus = "pendente" | "aprovado" | "reprovado";

export const GATE_LABEL: Record<GateKey, string> = {
  conceito: "Conceito",
  modelagem: "Modelagem",
  ficha: "Ficha técnica",
  piloto: "Piloto",
  aprovacao: "Aprovação final",
};

export type Gate = {
  id: string;
  prototype_id: string;
  gate: GateKey;
  status: GateStatus;
  approver_id: string | null;
  decided_at: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
};

export type HandoffEvent = {
  id: string;
  prototype_id: string;
  from_sector: string | null;
  to_sector: string;
  event: string;
  actor_id: string | null;
  notes: string | null;
  created_at: string;
};

export const getGates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prototypeId: string }) =>
    z.object({ prototypeId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Gate[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("prototype_gates")
      .select("*")
      .eq("prototype_id", data.prototypeId);
    if (error) throw new Error(error.message);
    const byKey = new Map<GateKey, Gate>(
      ((rows ?? []) as Gate[]).map((g) => [g.gate, g]),
    );
    // garante 5 gates virtuais na ordem
    return GATES.map(
      (k, i) =>
        byKey.get(k) ??
        ({
          id: `virtual-${k}`,
          prototype_id: data.prototypeId,
          gate: k,
          status: "pendente" as GateStatus,
          approver_id: null,
          decided_at: null,
          due_date: null,
          notes: null,
          created_at: new Date(Date.now() - i).toISOString(),
        } as Gate),
    );
  });

export const decideGate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { prototypeId: string; gate: GateKey; status: GateStatus; notes?: string }) =>
      z
        .object({
          prototypeId: z.string().uuid(),
          gate: z.enum(GATES),
          status: z.enum(["pendente", "aprovado", "reprovado"]),
          notes: z.string().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const payload = {
      prototype_id: data.prototypeId,
      gate: data.gate,
      status: data.status,
      approver_id: context.userId,
      decided_at: data.status === "pendente" ? null : new Date().toISOString(),
      notes: data.notes ?? null,
    };
    const { error } = await sb
      .from("prototype_gates")
      .upsert(payload, { onConflict: "prototype_id,gate" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getHandoffTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prototypeId: string }) =>
    z.object({ prototypeId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<HandoffEvent[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("prototype_handoff_events")
      .select("*")
      .eq("prototype_id", data.prototypeId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as HandoffEvent[];
  });

export const registerHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      prototypeId: string;
      fromSector?: string | null;
      toSector: string;
      event?: string;
      notes?: string;
    }) =>
      z
        .object({
          prototypeId: z.string().uuid(),
          fromSector: z.string().nullable().optional(),
          toSector: z.string().min(1),
          event: z.string().optional(),
          notes: z.string().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("prototype_handoff_events").insert({
      prototype_id: data.prototypeId,
      from_sector: data.fromSector ?? null,
      to_sector: data.toSector,
      event: data.event ?? "entrega",
      actor_id: context.userId,
      notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    // também atualiza o setor atual no protótipo
    await sb
      .from("prototypes")
      .update({ current_sector: data.toSector })
      .eq("id", data.prototypeId);
    return { ok: true };
  });
