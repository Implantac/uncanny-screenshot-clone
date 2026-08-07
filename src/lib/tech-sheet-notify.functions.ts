import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Notificações automáticas da ficha técnica.
 *
 * Insere registros em `push_notifications` para o destinatário (owner_id),
 * reaproveitando a infraestrutura já consumida pelo sino de notificações.
 *
 * Eventos suportados:
 *  - aprovada    → ficha aprovada (notifica Estilo/Modelagem/Compras via product team)
 *  - alterada    → ficha alterada (notifica o aprovador anterior)
 *  - nova_versao → nova versão criada (notifica o time do produto)
 *  - incompleta  → ficha incompleta há 7+ dias (job diário)
 */

const TECH_SHEET_NOTIFY_SCHEMA = z.object({
  recipientId: z.string().uuid(),
  event: z.enum(["aprovada", "alterada", "nova_versao", "incompleta"]),
  sheetId: z.string().uuid().optional(),
  sheetCode: z.string().max(80).optional(),
  version: z.string().max(30).optional(),
  link: z.string().max(500).optional(),
  comment: z.string().max(500).optional(),
});

type TechSheetNotifyInput = z.infer<typeof TECH_SHEET_NOTIFY_SCHEMA>;

const EVENT_META: Record<
  TechSheetNotifyInput["event"],
  {
    title: (i: TechSheetNotifyInput) => string;
    body: (i: TechSheetNotifyInput) => string;
    kind: string;
    severity: "alta" | "media" | "baixa";
  }
> = {
  aprovada: {
    title: () => "Ficha técnica aprovada",
    body: (i) => `A ficha ${i.sheetCode ?? ""} foi aprovada${i.comment ? ` — ${i.comment}` : ""}.`,
    kind: "control_tower",
    severity: "alta",
  },
  alterada: {
    title: () => "Ficha técnica alterada",
    body: (i) =>
      `A ficha ${i.sheetCode ?? ""} foi alterada após a aprovação.${
        i.comment ? ` ${i.comment}` : ""
      }`,
    kind: "control_tower",
    severity: "media",
  },
  nova_versao: {
    title: () => "Nova versão da ficha técnica",
    body: (i) => `Foi criada a versão ${i.version ?? ""} da ficha ${i.sheetCode ?? ""}.`,
    kind: "control_tower",
    severity: "media",
  },
  incompleta: {
    title: () => "Ficha técnica incompleta",
    body: (i) =>
      `A ficha ${i.sheetCode ?? ""} está incompleta há mais de 7 dias. Revise os blocos pendentes.`,
    kind: "control_tower",
    severity: "baixa",
  },
};

/**
 * Server function que notifica um destinatário sobre eventos da ficha técnica.
 * Usada pelos pontos de integração (aprovação, decisão, nova versão, rascunho antigo).
 */
export const notifyTechSheetEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TECH_SHEET_NOTIFY_SCHEMA.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const meta = EVENT_META[data.event];

    const { error } = await supabase.from("push_notifications").insert({
      owner_id: data.recipientId,
      device_id: null,
      title: meta.title(data),
      body: meta.body(data),
      link: data.link ?? null,
      kind: meta.kind,
      severity: meta.severity,
      payload: { event: data.event, sheetId: data.sheetId ?? null } as never,
      delivered_at: new Date().toISOString(),
      error: null,
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });
