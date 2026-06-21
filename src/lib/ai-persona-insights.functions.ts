import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export type PersonaKey = "coord-dev" | "pcp" | "marketing" | "qualidade";

export type PersonaInsight = {
  signal: string;
  evidence: string;
  why: string;
  nextAction: string;
  severity: "info" | "warn" | "critical";
  link?: string | null;
};

const PERSONA_META: Record<
  PersonaKey,
  { label: string; system: string; defaultLink: string }
> = {
  "coord-dev": {
    label: "Coordenador de Desenvolvimento",
    system:
      "Você é coordenador sênior de desenvolvimento de coleções de moda. Olhe o contexto e produza sinais cruzados (não números soltos): conecte protótipos travados, gargalos por etapa e taxa de aprovação. Explique POR QUE importa e qual a próxima ação concreta.",
    defaultLink: "/prototipos",
  },
  pcp: {
    label: "PCP Sênior",
    system:
      "Você é PCP sênior. Cruze OPs atrasadas, OPs paradas e fila por setor. Identifique gargalo real (não a etapa com mais peças, mas a com pior fluxo). Para cada sinal explique POR QUE e a próxima ação.",
    defaultLink: "/pcp-kanban",
  },
  marketing: {
    label: "Marketing Intelligence",
    system:
      "Você é marketing de produto de moda. Cruze receita 7d vs 30d, top produtos, canais e influencers. Aponte oportunidade ou risco. POR QUE importa + próxima ação.",
    defaultLink: "/marketing",
  },
  qualidade: {
    label: "Qualidade Sênior",
    system:
      "Você é gerente de qualidade. Cruze FPY, defeitos críticos, CAPAs abertas e ocorrências por produto. Indique risco sistêmico vs pontual. POR QUE importa + próxima ação.",
    defaultLink: "/quality",
  },
};

async function buildSignalsCtx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  persona: PersonaKey,
): Promise<string> {
  const now = Date.now();
  const iso30 = new Date(now - 30 * 86400000).toISOString();
  const iso7 = new Date(now - 7 * 86400000).toISOString();

  if (persona === "coord-dev") {
    const [{ data: protos }, { data: sheets }, { data: products }] = await Promise.all([
      sb.from("prototypes").select("code, stage, stage_updated_at, due_date").limit(200),
      sb.from("tech_sheets").select("product_id, status").limit(300),
      sb.from("products").select("id, sku, status").limit(300),
    ]);
    const P = (protos ?? []) as Array<{
      code: string;
      stage: string;
      stage_updated_at: string | null;
      due_date: string | null;
    }>;
    const stuck = P.filter(
      (p) =>
        p.stage !== "aprovado" &&
        p.stage !== "reprovado" &&
        p.stage_updated_at &&
        now - new Date(p.stage_updated_at).getTime() > 7 * 86400000,
    );
    const overdue = P.filter(
      (p) =>
        p.stage !== "aprovado" &&
        p.stage !== "reprovado" &&
        p.due_date &&
        new Date(p.due_date).getTime() < now,
    );
    const semFicha = (products ?? []).filter((pr: { id: string; status: string }) => {
      const aprov = (sheets ?? []).some(
        (s: { product_id: string | null; status: string }) =>
          s.product_id === pr.id && s.status === "aprovada",
      );
      return pr.status === "aprovado" && !aprov;
    });
    const stageMap = new Map<string, number>();
    P.filter((p) => p.stage !== "aprovado" && p.stage !== "reprovado").forEach((p) =>
      stageMap.set(p.stage, (stageMap.get(p.stage) ?? 0) + 1),
    );
    return `Pilotos parados (>7d): ${stuck.length}
Pilotos atrasados (vencidos): ${overdue.length}
Produtos aprovados SEM ficha técnica: ${semFicha.length}
Fila por etapa: ${[...stageMap.entries()].map(([s, q]) => `${s}=${q}`).join(", ") || "—"}
Top travados: ${stuck.slice(0, 5).map((p) => `${p.code}/${p.stage}`).join(" | ") || "—"}`;
  }

  if (persona === "pcp") {
    const { data: orders } = await sb
      .from("production_orders")
      .select("code, stage, status, quantity, due_date, stage_updated_at")
      .neq("status", "cancelada")
      .limit(400);
    const O = (orders ?? []) as Array<{
      code: string;
      stage: string;
      quantity: number | null;
      due_date: string | null;
      stage_updated_at: string | null;
    }>;
    const ativas = O.filter((o) => o.stage !== "entregue");
    const atrasadas = ativas.filter(
      (o) => o.due_date && new Date(o.due_date).getTime() < now,
    );
    const paradas = ativas.filter(
      (o) =>
        o.stage_updated_at &&
        now - new Date(o.stage_updated_at).getTime() > 5 * 86400000,
    );
    const fila = new Map<string, number>();
    ativas.forEach((o) =>
      fila.set(o.stage, (fila.get(o.stage) ?? 0) + (o.quantity ?? 0)),
    );
    return `OPs ativas: ${ativas.length}
OPs atrasadas: ${atrasadas.length}
OPs paradas >5d: ${paradas.length}
Fila por setor (peças): ${[...fila.entries()].map(([s, q]) => `${s}=${q}`).join(", ") || "—"}
Top atrasadas: ${atrasadas.slice(0, 5).map((o) => `${o.code}/${o.stage}`).join(" | ") || "—"}
Top paradas: ${paradas.slice(0, 5).map((o) => `${o.code}/${o.stage}`).join(" | ") || "—"}`;
  }

  if (persona === "marketing") {
    const [{ data: s30 }, { data: s7 }] = await Promise.all([
      sb
        .from("erp_sales_mirror")
        .select("sku, channel, quantity, total_value, influencer_code")
        .gte("sold_at", iso30)
        .limit(2000),
      sb
        .from("erp_sales_mirror")
        .select("sku, quantity, total_value")
        .gte("sold_at", iso7)
        .limit(2000),
    ]);
    const S30 = (s30 ?? []) as Array<{
      sku: string | null;
      channel: string | null;
      quantity: number | null;
      total_value: number | string | null;
      influencer_code: string | null;
    }>;
    const S7 = (s7 ?? []) as Array<{
      total_value: number | string | null;
    }>;
    const rev30 = S30.reduce((a, x) => a + Number(x.total_value ?? 0), 0);
    const rev7 = S7.reduce((a, x) => a + Number(x.total_value ?? 0), 0);
    const byProd = new Map<string, number>();
    S30.forEach((s) =>
      byProd.set(s.sku ?? "—", (byProd.get(s.sku ?? "—") ?? 0) + Number(s.total_value ?? 0)),
    );
    const byChan = new Map<string, number>();
    S30.forEach((s) =>
      byChan.set(
        s.channel ?? "—",
        (byChan.get(s.channel ?? "—") ?? 0) + Number(s.total_value ?? 0),
      ),
    );
    const top = [...byProd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const chans = [...byChan.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const fmt = (n: number) => `R$${Math.round(n).toLocaleString("pt-BR")}`;
    const ritmoSemanal = rev30 / 4.3;
    const tendencia = rev7 > ritmoSemanal ? "acelerando" : "desacelerando";
    return `Receita 7d: ${fmt(rev7)} | 30d: ${fmt(rev30)} (média semanal=${fmt(ritmoSemanal)}, tendência=${tendencia})
Top produtos: ${top.map(([k, v]) => `${k}=${fmt(v)}`).join(", ") || "—"}
Canais: ${chans.map(([k, v]) => `${k}=${fmt(v)}`).join(", ") || "—"}`;
  }

  // qualidade
  const [{ data: insps }, { data: capas }, { data: occs }] = await Promise.all([
    sb
      .from("quality_inspections")
      .select("result, critical_defects, major_defects, created_at")
      .gte("created_at", iso30)
      .limit(500),
    sb
      .from("quality_capa")
      .select("severity, status, due_date, created_at")
      .limit(200),
    sb
      .from("production_occurrences")
      .select("severity, created_at")
      .gte("created_at", iso30)
      .limit(500),
  ]);
  const I = (insps ?? []) as Array<{
    result: string | null;
    critical_defects: number | null;
    major_defects: number | null;
  }>;
  const aprov = I.filter((x) =>
    ["aprovado", "aprovada"].includes(String(x.result)),
  ).length;
  const fpy = I.length ? Math.round((aprov / I.length) * 100) : 100;
  const crit = I.reduce((a, x) => a + (x.critical_defects ?? 0), 0);
  const major = I.reduce((a, x) => a + (x.major_defects ?? 0), 0);
  const C = (capas ?? []) as Array<{
    severity: string;
    status: string;
    due_date: string | null;
  }>;
  const abertas = C.filter((c) => c.status === "aberta");
  const vencidas = abertas.filter(
    (c) => c.due_date && new Date(c.due_date).getTime() < now,
  );
  const critOpen = abertas.filter((c) => c.severity === "critica");
  return `FPY 30d: ${fpy}% em ${I.length} inspeções
Defeitos críticos: ${crit} | maiores: ${major}
CAPAs abertas: ${abertas.length} (críticas=${critOpen.length}, vencidas=${vencidas.length})
Ocorrências 30d: ${(occs ?? []).length}`;
}

const SCHEMA_HINT = `Retorne APENAS JSON válido neste formato exato, sem markdown, sem comentário:
{"insights":[{"signal":"...","evidence":"...","why":"...","nextAction":"...","severity":"info|warn|critical"}]}
- 3 a 5 itens
- "signal": título curto (máx 60 caracteres)
- "evidence": números concretos do contexto (máx 100 caracteres)
- "why": por que importa em 1 frase (máx 140 caracteres)
- "nextAction": ação executável em imperativo (máx 100 caracteres)
- "severity": "critical" só quando bloqueia entrega/qualidade; "warn" tendência ruim; "info" oportunidade`;

export const getPersonaInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { persona: PersonaKey }) =>
    z
      .object({
        persona: z.enum(["coord-dev", "pcp", "marketing", "qualidade"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ persona: string; items: PersonaInsight[]; error?: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    const meta = PERSONA_META[data.persona];
    const ctx = await buildSignalsCtx(context.supabase, data.persona);

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    try {
      const res = await generateText({
        model,
        system: `${meta.system}\n\n${SCHEMA_HINT}`,
        prompt: `Contexto real (use apenas estes números, não invente):\n${ctx}`,
        temperature: 0.2,
      });
      const raw = res.text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
      let parsed: { insights?: PersonaInsight[] };
      try {
        parsed = JSON.parse(raw);
      } catch {
        // tenta extrair primeiro objeto JSON
        const match = raw.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { insights: [] };
      }
      const items = (parsed.insights ?? []).slice(0, 5).map((i) => ({
        signal: String(i.signal ?? "").slice(0, 80),
        evidence: String(i.evidence ?? "").slice(0, 140),
        why: String(i.why ?? "").slice(0, 200),
        nextAction: String(i.nextAction ?? "").slice(0, 140),
        severity: (["info", "warn", "critical"].includes(i.severity)
          ? i.severity
          : "info") as PersonaInsight["severity"],
        link: meta.defaultLink,
      }));
      return { persona: meta.label, items };
    } catch (err: unknown) {
      const e = err as { statusCode?: number; lastError?: { statusCode?: number }; message?: string };
      const status = e?.statusCode ?? e?.lastError?.statusCode;
      if (status === 429) return { persona: meta.label, items: [], error: "rate_limited" };
      if (status === 402) return { persona: meta.label, items: [], error: "credits_exhausted" };
      throw err;
    }
  });
