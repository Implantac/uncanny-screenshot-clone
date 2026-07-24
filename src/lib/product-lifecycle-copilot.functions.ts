/**
 * Onda 20 — AI Copilot do ciclo do produto
 * Dado o estado do workflow + gates + custo, sugere próximas ações concretas.
 * Usa Lovable AI Gateway.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";
import { z } from "zod";

export type LifecycleSuggestion = {
  title: string;
  detail: string;
  priority: "alta" | "media" | "baixa";
  action?: { label: string; href?: string };
};

export type LifecycleCopilotResult = {
  currentStep: string | null;
  blockers: string[];
  summary: string;
  suggestions: LifecycleSuggestion[];
};

export const getProductLifecycleCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<LifecycleCopilotResult> => {
    const sb = context.supabase;
    const { productId } = data;

    const [{ data: product }, { data: steps }, { data: gates }, { data: sheet }, { data: target }, { data: costHist }] =
      await Promise.all([
        sb.from("products").select("id, name, sku, status").eq("id", productId).maybeSingle(),
        sb
          .from("product_workflow_steps")
          .select("step, step_order, status, blocker_reason, started_at, completed_at")
          .eq("product_id", productId)
          .order("step_order", { ascending: true }),
        sb.rpc("product_gate_status", { _product_id: productId }),
        sb
          .from("tech_sheets")
          .select("status, cost_price, materials_cost, labor_cost")
          .eq("product_id", productId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb
          .from("product_target_costs")
          .select("target_cost, target_margin_pct, target_retail_price")
          .eq("product_id", productId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb
          .from("product_cost_history")
          .select("total_cost, created_at")
          .eq("product_id", productId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    if (!product) throw new Error("Produto não encontrado");

    const current = (steps ?? []).find((s) => s.status === "em_andamento") ??
      (steps ?? []).find((s) => s.status === "bloqueado");
    const blockers = ((gates ?? []) as Array<{ requirement: string; ok: boolean; detail: string | null }>)
      .filter((g) => !g.ok)
      .map((g) => `${g.requirement}${g.detail ? " — " + g.detail : ""}`);

    const contextBlock = [
      `PRODUTO: ${product.name} (${product.sku ?? "sem sku"}) status=${product.status}`,
      `ETAPA ATUAL: ${current ? current.step + " (" + current.status + ")" : "nenhuma"}`,
      current?.blocker_reason ? `BLOQUEIO: ${current.blocker_reason}` : "",
      `WORKFLOW: ${(steps ?? []).map((s) => `${s.step_order}.${s.step}=${s.status}`).join(" | ")}`,
      `GATES PENDENTES (${blockers.length}):\n${blockers.map((b) => "- " + b).join("\n") || "- nenhum"}`,
      sheet
        ? `FICHA: status=${sheet.status} custo=R$${Number(sheet.cost_price ?? 0).toFixed(2)} materiais=R$${Number(sheet.materials_cost ?? 0).toFixed(2)} MOD=R$${Number(sheet.labor_cost ?? 0).toFixed(2)}`
        : "FICHA: não cadastrada",
      target?.target_cost != null
        ? `META CUSTO: R$${Number(target.target_cost).toFixed(2)} margem=${target.target_margin_pct ?? "-"}%`
        : "META CUSTO: não definida",
      (costHist ?? []).length > 1
        ? `TENDÊNCIA CUSTO últimos snapshots: ${(costHist ?? []).map((h) => Number(h.total_cost).toFixed(2)).join(" → ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      // Fallback determinístico sem IA
      const suggestions: LifecycleSuggestion[] = blockers.slice(0, 4).map((b) => ({
        title: b.split(" — ")[0]!,
        detail: b.split(" — ")[1] ?? "Resolva este gate para avançar a etapa.",
        priority: "alta",
      }));
      return {
        currentStep: current?.step ?? null,
        blockers,
        summary: blockers.length
          ? `Existem ${blockers.length} gate(s) pendente(s) antes de avançar.`
          : "Nenhum bloqueio ativo — produto pronto para próxima etapa.",
        suggestions,
      };
    }

    const provider = createLovableAiGatewayProvider(apiKey);
    const system = `Você é o Copiloto do ciclo de vida de produto de moda em um PLM.
Recebe o estado real (etapa, gates, custo, meta). Devolve SOMENTE JSON válido no formato:
{"summary":"...","suggestions":[{"title":"...","detail":"...","priority":"alta|media|baixa"}]}
- Máx. 4 sugestões, priorizadas pelo que destrava a próxima etapa.
- Foco em ação concreta ("Preencher grade de tamanhos", "Aprovar ficha", "Renegociar tecido X").
- Nunca invente números. Use apenas o contexto.
- Português. Sem markdown fora do JSON.`;

    let parsed: { summary: string; suggestions: LifecycleSuggestion[] } | null = null;
    try {
      const { text } = await generateText({
        model: provider("google/gemini-2.5-flash"),
        system,
        prompt: contextBlock,
        temperature: 0.3,
      });
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch {
      parsed = null;
    }

    return {
      currentStep: current?.step ?? null,
      blockers,
      summary:
        parsed?.summary ??
        (blockers.length
          ? `${blockers.length} gate(s) pendente(s) para avançar.`
          : "Produto pronto para próxima etapa."),
      suggestions: (parsed?.suggestions ?? []).slice(0, 4),
    };
  });
