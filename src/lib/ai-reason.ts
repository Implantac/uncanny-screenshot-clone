/**
 * AI Reason — Padrão universal de explicabilidade
 * =================================================
 *
 * Toda sugestão da IA do PLM (PCP, Qualidade, Almoxarifado, Coleções,
 * Marketing, Carry-over, etc.) DEVE expor um campo `reason: string` no formato:
 *
 *   "<sinal 1> · <sinal 2> · ... [→ <recomendação>]"
 *
 * Regras:
 *  - Separador entre sinais observáveis: " · " (AI_REASON_SEPARATOR)
 *  - Seta de recomendação: " → " (AI_REASON_ARROW), opcional
 *  - Sinais são fatos/medidas (números, taxas, contagens). Recomendação é a ação proposta.
 *  - Máximo 240 caracteres — render direto em chips/cards.
 *  - Sem markdown, sem emojis no corpo (chips/badges renderizam ícones por fora).
 *  - Em português, tom direto: "FPY 82% · 5 críticos em 90d → revisar processo".
 *
 * Use `buildAiReason()` para garantir o formato. Use `AiReason` (Zod) para
 * validar entradas vindas do gateway. Tudo que cria sugestão deve passar por
 * aqui — assim qualquer componente exibe explicação consistente.
 */

import { z } from "zod";

export const AI_REASON_SEPARATOR = " · ";
export const AI_REASON_ARROW = " → ";
export const AI_REASON_MAX_LEN = 240;

export type AiReasonParts = {
  /** Fatos observáveis: contagens, taxas, datas, médias. */
  signals?: Array<string | number | null | undefined | false>;
  /** Ação ou orientação proposta. Renderizada após " → ". */
  recommendation?: string | null;
  /** Mensagem de fallback quando não há sinais nem recomendação. */
  fallback?: string;
};

/**
 * Monta uma string `reason` no padrão universal de explicabilidade da IA.
 * Filtra sinais vazios/falsy, aplica separador padrão e trunca em 240 chars.
 */
export function buildAiReason(parts: AiReasonParts): string {
  const signals = (parts.signals ?? [])
    .filter((s): s is string | number => s !== null && s !== undefined && s !== false && s !== "")
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0);

  const base = signals.join(AI_REASON_SEPARATOR);
  const rec = parts.recommendation?.trim();

  let out =
    base.length > 0 && rec
      ? `${base}${AI_REASON_ARROW}${rec}`
      : base.length > 0
        ? base
        : rec
          ? rec
          : (parts.fallback ?? "");

  if (out.length > AI_REASON_MAX_LEN) {
    out = `${out.slice(0, AI_REASON_MAX_LEN - 1).trimEnd()}…`;
  }
  return out;
}

/** Schema Zod para validar `reason` recebido de chamadas IA externas. */
export const AiReasonSchema = z.string().max(AI_REASON_MAX_LEN);

/**
 * Faz parse reverso de uma string `reason` no padrão — útil para componentes
 * que querem renderizar sinais como chips e recomendação destacada.
 */
export function parseAiReason(reason: string): { signals: string[]; recommendation: string | null } {
  if (!reason) return { signals: [], recommendation: null };
  const [left, ...rest] = reason.split(AI_REASON_ARROW);
  const recommendation = rest.length > 0 ? rest.join(AI_REASON_ARROW).trim() : null;
  const signals = left
    .split(AI_REASON_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return { signals, recommendation };
}
