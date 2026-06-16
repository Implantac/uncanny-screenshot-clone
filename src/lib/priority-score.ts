/**
 * Score de Prioridade de Produção (0-100) — puro, sem I/O.
 *
 * Combina velocidade de vendas, margem, risco de ruptura, ABC e sazonalidade.
 * Retorna pontuação + lista de motivos (as 3 maiores contribuições).
 */

export type PriorityInput = {
  sku: string;
  /** vendas dos últimos 7/30/90 dias (unidades) */
  sold7: number;
  sold30: number;
  sold90: number;
  /** saldo de estoque atual (livre) */
  stock: number;
  /** unidades já em OPs em andamento (não entregue) */
  wip: number;
  /** custo e preço de venda — para margem */
  cost: number | null;
  price: number | null;
  /** lead time médio de produção em dias (default 30) */
  leadTimeDays?: number;
  /** posição ABC no faturamento (1=A, 2=B, 3=C) */
  abc?: 1 | 2 | 3;
  /** flag de sazonalidade (mês de pico) */
  seasonal?: boolean;
};

export type PriorityResult = {
  sku: string;
  score: number; // 0–100
  reasons: string[]; // top 3 motivos legíveis
  suggestion: number; // unidades sugeridas para 45d de cobertura
  daysCover: number; // dias de cobertura (stock + wip) / velocidade
  margin: number; // 0–1
  velocity: number; // un/dia (média 30d)
  /** Veredito do "Coordenador de PCP" — diz claramente o que fazer. */
  verdict: "produzir-ja" | "programar" | "monitorar" | "nao-produzir";
  verdictLabel: string; // texto curto para UI
  verdictReason: string; // motivo em linguagem natural
  /** Dias até estoque zerar (stock+wip / velocidade). 999 = sem giro. */
  daysToStockout: number;
  /** Janela ideal para iniciar a produção (dias a partir de hoje). 0 = começar já. */
  startInDays: number;
};



const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function computePriority(i: PriorityInput): PriorityResult {

  const lead = i.leadTimeDays ?? 30;
  const daily30 = i.sold30 / 30;
  const daily7 = i.sold7 / 7;
  const daily90 = i.sold90 / 90;
  const velocity = daily30;

  // Componente 1: velocidade de venda (sell-out) — sat. em 10 un/dia
  const sellOut = clamp01(velocity / 10);

  // Componente 2: margem
  const margin = i.price && i.cost && i.price > 0 ? clamp01((i.price - i.cost) / i.price) : 0;

  // Componente 3: risco de ruptura — cobertura < lead time = risco alto
  const total = Math.max(0, i.stock + i.wip);
  const daysCover = velocity > 0 ? total / velocity : 999;
  const ruptureRisk = velocity > 0 ? clamp01(1 - daysCover / Math.max(lead, 1)) : 0;

  // Componente 4: ABC (peso para A)
  const abcWeight = i.abc === 1 ? 1 : i.abc === 2 ? 0.6 : 0.25;

  // Componente 5: aceleração recente (7d > 30d > 90d)
  const accel = daily30 > 0 ? clamp01(((daily7 - daily30) / daily30 + 1) / 2) : 0;

  // Componente 6: sazonalidade
  const seasonality = i.seasonal ? 1 : 0.4;

  const parts: { label: string; value: number; weight: number }[] = [
    { label: `giro alto (${velocity.toFixed(1)} un/dia)`, value: sellOut, weight: 0.30 },
    { label: `margem ${Math.round(margin * 100)}%`, value: margin, weight: 0.20 },
    { label: ruptureRisk > 0.5 ? `ruptura em ${Math.round(daysCover)}d` : `cobertura ${Math.round(daysCover)}d`, value: ruptureRisk, weight: 0.20 },
    { label: i.abc === 1 ? "curva A" : i.abc === 2 ? "curva B" : "curva C", value: abcWeight, weight: 0.15 },
    { label: daily7 > daily30 ? `vendas subindo ${Math.round(((daily7 - daily30) / Math.max(daily30, 0.01)) * 100)}%` : "vendas estáveis", value: accel, weight: 0.10 },
    { label: i.seasonal ? "estação de pico" : "fora do pico", value: seasonality, weight: 0.05 },
  ];

  const score = Math.round(parts.reduce((s, p) => s + p.value * p.weight, 0) * 100);

  const reasons = [...parts]
    .map((p) => ({ ...p, contrib: p.value * p.weight }))
    .sort((a, b) => b.contrib - a.contrib)
    .slice(0, 3)
    .map((p) => p.label);

  // Sugestão: cobrir lead time + 15 dias de buffer, descontando WIP
  const target = Math.ceil(velocity * (lead + 15));
  const suggestion = Math.max(0, target - i.stock - i.wip);

  return {
    sku: i.sku,
    score,
    reasons,
    suggestion,
    daysCover: Math.min(daysCover, 999),
    margin,
    velocity,
  };
}

/** Classifica produtos em ABC pelo faturamento dos últimos 30 dias (80/15/5). */
export function classifyABC(revenues: { sku: string; revenue: number }[]): Map<string, 1 | 2 | 3> {
  const sorted = [...revenues].sort((a, b) => b.revenue - a.revenue);
  const total = sorted.reduce((s, x) => s + x.revenue, 0);
  if (total <= 0) return new Map();
  const out = new Map<string, 1 | 2 | 3>();
  let acc = 0;
  for (const r of sorted) {
    acc += r.revenue;
    const share = acc / total;
    out.set(r.sku, share <= 0.8 ? 1 : share <= 0.95 ? 2 : 3);
  }
  return out;
}
