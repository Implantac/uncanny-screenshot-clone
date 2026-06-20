import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type PublicTable = keyof Database["public"]["Tables"];
type CountableBuilder = ReturnType<
  ReturnType<typeof supabase.from<PublicTable>>["select"]
>;

export type PlmStageStatus = "completa" | "parcial" | "ausente";

export type PlmStageReadiness = {
  id: string;
  title: string;
  subtitle: string;
  status: PlmStageStatus;
  score: number;
  metrics: Array<{ label: string; value: string; tone?: "good" | "warn" | "bad" }>;
  gaps: string[];
  nextActions: string[];
};

export type PlmEnterpriseReadiness = {
  score: number;
  status: PlmStageStatus;
  coverage: {
    complete: number;
    partial: number;
    absent: number;
  };
  stages: PlmStageReadiness[];
};

type CountResult = { count: number | null };

async function countRows(
  table: PublicTable,
  query?: (q: CountableBuilder) => CountableBuilder,
): Promise<number> {
  const base = supabase.from(table).select("id", { count: "exact", head: true }) as CountableBuilder;
  const { count } = (await (query ? query(base) : base)) as CountResult;
  return count ?? 0;
}


function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function classify(score: number): PlmStageStatus {
  if (score >= 75) return "completa";
  if (score > 0) return "parcial";
  return "ausente";
}

function stage(input: Omit<PlmStageReadiness, "status">): PlmStageReadiness {
  return { ...input, status: classify(input.score) };
}

export async function loadPlmEnterpriseReadiness(): Promise<PlmEnterpriseReadiness> {
  const [
    collections,
    collectionsWithLaunch,
    moodboardItems,
    products,
    productsApproved,
    prototypes,
    prototypeAdjustments,
    techSheets,
    techSheetMaterials,
    techSheetOperations,
    techSheetVersions,
    bomTemplates,
    variants,
    batches,
    productionOrders,
    stageLogs,
    occurrences,
    inspections,
    capas,
    materials,
    suppliers,
    campaigns,
    salesRes,
  ] = await Promise.all([
    countRows("collections"),
    countRows("collections", (q) => q.not("launch_date", "is", null)),
    countRows("collection_moodboard"),
    countRows("products"),
    countRows("products", (q) => q.in("status", ["aprovado", "producao"])),
    countRows("prototypes"),
    countRows("prototype_adjustments"),
    countRows("tech_sheets"),
    countRows("tech_sheet_materials"),
    countRows("tech_sheet_operations"),
    countRows("tech_sheet_versions"),
    countRows("bom_templates"),
    countRows("product_variants"),
    countRows("production_batches"),
    countRows("production_orders"),
    countRows("production_stage_log"),
    countRows("production_occurrences"),
    countRows("quality_inspections"),
    countRows("quality_capa"),
    countRows("material_library"),
    countRows("suppliers"),
    countRows("marketing_campaigns"),
    supabase.from("sales").select("total, quantity").limit(2000),
  ]);

  const sales = (salesRes.data ?? []) as Array<{ total: number | null; quantity: number | null }>;
  const revenue = sales.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const soldQty = sales.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);

  const developmentScore = Math.min(
    100,
    Math.round(
      pct(productsApproved, Math.max(products, 1)) * 0.35 +
        Math.min(100, prototypes * 12) * 0.25 +
        Math.min(100, prototypeAdjustments * 8) * 0.2 +
        Math.min(100, variants * 5) * 0.2,
    ),
  );

  const collectionScore = Math.min(
    100,
    Math.round(
      Math.min(100, collections * 18) * 0.35 +
        pct(collectionsWithLaunch, Math.max(collections, 1)) * 0.25 +
        Math.min(100, moodboardItems * 10) * 0.2 +
        (sales.length > 0 ? 100 : 0) * 0.2,
    ),
  );

  const techSheetScore = Math.min(
    100,
    Math.round(
      Math.min(100, techSheets * 14) * 0.25 +
        Math.min(100, techSheetMaterials * 6) * 0.25 +
        Math.min(100, techSheetOperations * 8) * 0.2 +
        Math.min(100, techSheetVersions * 10) * 0.2 +
        Math.min(100, bomTemplates * 20) * 0.1,
    ),
  );

  const productionScore = Math.min(
    100,
    Math.round(
      Math.min(100, productionOrders * 8) * 0.3 +
        Math.min(100, batches * 12) * 0.25 +
        Math.min(100, stageLogs * 4) * 0.25 +
        Math.min(100, occurrences * 10) * 0.2,
    ),
  );

  const qualityScore = Math.min(
    100,
    Math.round(
      Math.min(100, inspections * 12) * 0.45 +
        Math.min(100, capas * 18) * 0.35 +
        Math.min(100, suppliers * 6) * 0.2,
    ),
  );

  const supplyScore = Math.min(
    100,
    Math.round(
      Math.min(100, materials * 8) * 0.4 +
        Math.min(100, suppliers * 8) * 0.3 +
        Math.min(100, bomTemplates * 20) * 0.3,
    ),
  );

  const marketingScore = Math.min(
    100,
    Math.round(
      Math.min(100, campaigns * 16) * 0.35 +
        (sales.length > 0 ? 100 : 0) * 0.35 +
        Math.min(100, collections * 18) * 0.15 +
        Math.min(100, products * 5) * 0.15,
    ),
  );

  const stages = [
    stage({
      id: "development",
      title: "Desenvolvimento de Produto",
      subtitle: "Ideia, pesquisa, protótipo, ajuste e aprovação.",
      score: developmentScore,
      metrics: [
        { label: "Produtos", value: products.toLocaleString("pt-BR") },
        { label: "Aprovados/produção", value: productsApproved.toLocaleString("pt-BR") },
        { label: "Protótipos", value: prototypes.toLocaleString("pt-BR") },
        { label: "Ajustes", value: prototypeAdjustments.toLocaleString("pt-BR") },
      ],
      gaps: [
        ...(prototypes === 0 ? ["Sem protótipos registrados para fechar o ciclo de prova."] : []),
        ...(prototypeAdjustments === 0
          ? ["Histórico de ajustes ainda não alimentado de forma consistente."]
          : []),
        ...(variants === 0 ? ["Variantes/SKUs ainda não conectados à grade de produto."] : []),
      ],
      nextActions: [
        "Usar Kanban de Desenvolvimento como fluxo mestre do produto.",
        "Registrar SLA e responsáveis nos pontos de aprovação.",
      ],
    }),
    stage({
      id: "collections",
      title: "Coleções",
      subtitle: "Temporada, mix, metas, lançamento e leitura de sell-through.",
      score: collectionScore,
      metrics: [
        { label: "Coleções", value: collections.toLocaleString("pt-BR") },
        { label: "Com lançamento", value: collectionsWithLaunch.toLocaleString("pt-BR") },
        { label: "Moodboard", value: moodboardItems.toLocaleString("pt-BR") },
        { label: "Receita lida", value: money(revenue) },
      ],
      gaps: [
        ...(collectionsWithLaunch < collections
          ? ["Há coleções sem data de lançamento planejada."]
          : []),
        ...(moodboardItems === 0 ? ["Moodboard inteligente ainda pouco alimentado."] : []),
        ...(sales.length === 0
          ? ["Sem leitura comercial para responder se a coleção valeu o investimento."]
          : []),
      ],
      nextActions: [
        "Amarrar campanha, produto e coleção antes do lançamento.",
        "Exibir ROI esperado versus realizado por coleção.",
      ],
    }),
    stage({
      id: "tech-sheet",
      title: "Ficha Técnica, BOM e BOP",
      subtitle: "Materiais, operações, medidas, versionamento e estrutura produtiva.",
      score: techSheetScore,
      metrics: [
        { label: "Fichas", value: techSheets.toLocaleString("pt-BR") },
        { label: "Materiais BOM", value: techSheetMaterials.toLocaleString("pt-BR") },
        { label: "Operações BOP", value: techSheetOperations.toLocaleString("pt-BR") },
        { label: "Versões", value: techSheetVersions.toLocaleString("pt-BR") },
      ],
      gaps: [
        ...(techSheetMaterials === 0 ? ["BOM sem materiais técnicos reutilizáveis."] : []),
        ...(techSheetOperations === 0 ? ["BOP sem sequência produtiva estruturada."] : []),
        ...(techSheetVersions === 0 ? ["Versionamento da ficha técnica ainda sem histórico."] : []),
      ],
      nextActions: [
        "Tratar ficha técnica como fonte única para custo, consumo e processo.",
        "Comparar versões antes de liberar produção.",
      ],
    }),
    stage({
      id: "production",
      title: "PCP, Lotes e Produção",
      subtitle: "Prioridade, capacidade, passagem, gargalo e previsão de conclusão.",
      score: productionScore,
      metrics: [
        { label: "OPs", value: productionOrders.toLocaleString("pt-BR") },
        { label: "Lotes", value: batches.toLocaleString("pt-BR") },
        { label: "Passagens", value: stageLogs.toLocaleString("pt-BR") },
        { label: "Ocorrências", value: occurrences.toLocaleString("pt-BR") },
      ],
      gaps: [
        ...(batches === 0 ? ["Kanban por lote ainda sem lote produtivo alimentado."] : []),
        ...(stageLogs === 0 ? ["Produção em tempo real sem passagens registradas."] : []),
        ...(occurrences === 0
          ? ["Ocorrências não registradas reduzem previsibilidade do PCP."]
          : []),
      ],
      nextActions: [
        "Usar passagem por setor como telemetria operacional.",
        "Medir tempo parado e previsão de conclusão por lote.",
      ],
    }),
    stage({
      id: "quality",
      title: "Qualidade e CAPA",
      subtitle: "Defeitos, retrabalho, perdas, fornecedores e ações preventivas.",
      score: qualityScore,
      metrics: [
        { label: "Inspeções", value: inspections.toLocaleString("pt-BR") },
        { label: "CAPAs", value: capas.toLocaleString("pt-BR") },
        { label: "Fornecedores", value: suppliers.toLocaleString("pt-BR") },
      ],
      gaps: [
        ...(inspections === 0 ? ["Sem inspeções para ranking de defeitos."] : []),
        ...(capas === 0 ? ["CAPA ainda não conectado ao aprendizado operacional."] : []),
      ],
      nextActions: [
        "Classificar defeitos por setor, fornecedor e produto.",
        "Transformar não conformidades recorrentes em ação preventiva.",
      ],
    }),
    stage({
      id: "supply",
      title: "Materiais e Fornecedores",
      subtitle: "Biblioteca técnica, consumo previsto/real, sourcing e score.",
      score: supplyScore,
      metrics: [
        { label: "Materiais", value: materials.toLocaleString("pt-BR") },
        { label: "Fornecedores", value: suppliers.toLocaleString("pt-BR") },
        { label: "Templates BOM", value: bomTemplates.toLocaleString("pt-BR") },
      ],
      gaps: [
        ...(materials === 0 ? ["Biblioteca de materiais ainda ausente ou vazia."] : []),
        ...(suppliers === 0 ? ["Fornecedores sem base para score técnico."] : []),
      ],
      nextActions: [
        "Conectar material aprovado à ficha técnica e ao fornecedor preferencial.",
        "Comparar consumo previsto versus real por lote.",
      ],
    }),
    stage({
      id: "commercial-loop",
      title: "Venda, Marketing e Rentabilidade",
      subtitle: "Sell-through, margem, ROAS, ROI e decisão de repetir/descontinuar.",
      score: marketingScore,
      metrics: [
        { label: "Campanhas", value: campaigns.toLocaleString("pt-BR") },
        { label: "Vendas lidas", value: sales.length.toLocaleString("pt-BR") },
        { label: "Peças vendidas", value: soldQty.toLocaleString("pt-BR") },
        { label: "Receita", value: money(revenue) },
      ],
      gaps: [
        ...(campaigns === 0 ? ["Campanhas ainda não ligadas ao produto/coleção."] : []),
        ...(sales.length === 0 ? ["Sem vendas para curva ABC, sell-through e ROI real."] : []),
      ],
      nextActions: [
        "Ligar cada campanha a produto e coleção.",
        "Usar venda real para repetir, repaginar ou cortar produto.",
      ],
    }),
  ];

  const score = Math.round(stages.reduce((sum, item) => sum + item.score, 0) / stages.length);
  const coverage = {
    complete: stages.filter((item) => item.status === "completa").length,
    partial: stages.filter((item) => item.status === "parcial").length,
    absent: stages.filter((item) => item.status === "ausente").length,
  };

  return { score, status: classify(score), coverage, stages };
}
