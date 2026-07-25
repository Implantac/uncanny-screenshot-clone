import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductReadinessBadge } from "./product-readiness-badge";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpcMock(...a) },
}));

type Row = { requirement: string; ok: boolean; detail: string | null };

const READY_ROWS: Row[] = [
  { requirement: "Ficha técnica aprovada", ok: true, detail: null },
  { requirement: "BOM (materiais)", ok: true, detail: null },
  { requirement: "Custo definido", ok: true, detail: null },
  { requirement: "Protótipo aprovado", ok: true, detail: null },
];

const PENDING_ROWS: Row[] = [
  { requirement: "Ficha técnica aprovada", ok: false, detail: "sem versão aprovada" },
  { requirement: "BOM (materiais)", ok: true, detail: null },
  { requirement: "Custo definido", ok: false, detail: null },
  { requirement: "Protótipo aprovado", ok: true, detail: null },
];

function renderScenario(rows: typeof READY_ROWS) {
  rpcMock.mockResolvedValue({ data: rows, error: null });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      {/* Sentinels around the badge to prove Tab/Shift+Tab pass THROUGH the
          tooltip trigger — the tooltip must not steal or trap focus. */}
      <button data-testid="before">before</button>
      <ProductReadinessBadge productId="p1" />
      <button data-testid="after">after</button>
    </QueryClientProvider>,
  );
}

async function findTrigger() {
  return screen.findByRole("button", { name: /Prontidão para produção/i });
}

function findOpenTooltip(match: RegExp) {
  const tips = screen.queryAllByRole("tooltip");
  return tips.find((t) => match.test(t.textContent ?? ""));
}

beforeEach(() => rpcMock.mockReset());
afterEach(() => cleanup());

describe("ProductReadinessBadge — navegação por teclado no tooltip", () => {
  for (const [label, rows, tipMatch] of [
    ["pronto", READY_ROWS, /Pronto para produção/],
    ["pendente", PENDING_ROWS, /Gates críticos/],
  ] as const) {
    it(`[${label}] Tab entra no trigger, abre o tooltip e Tab sai (sem trap)`, async () => {
      const user = userEvent.setup();
      renderScenario(rows);
      const trigger = await findTrigger();
      const before = screen.getByTestId("before");
      const after = screen.getByTestId("after");

      before.focus();
      expect(before).toHaveFocus();

      // Tab → trigger, tooltip abre
      await user.tab();
      expect(trigger).toHaveFocus();
      await waitFor(() => expect(findOpenTooltip(tipMatch)).toBeTruthy());

      // Tab novamente → foco sai para o próximo botão (não fica preso)
      await user.tab();
      expect(after).toHaveFocus();
    });

    it(`[${label}] Shift+Tab volta do trigger para o elemento anterior`, async () => {
      const user = userEvent.setup();
      renderScenario(rows);
      const trigger = await findTrigger();
      const before = screen.getByTestId("before");

      trigger.focus();
      expect(trigger).toHaveFocus();
      await waitFor(() => expect(findOpenTooltip(tipMatch)).toBeTruthy());

      await user.tab({ shift: true });
      expect(before).toHaveFocus();
    });

    it(`[${label}] Escape fecha o tooltip mantendo o foco no trigger`, async () => {
      const user = userEvent.setup();
      renderScenario(rows);
      const trigger = await findTrigger();

      trigger.focus();
      await waitFor(() => expect(findOpenTooltip(tipMatch)).toBeTruthy());

      await user.keyboard("{Escape}");
      await waitFor(() => expect(findOpenTooltip(tipMatch)).toBeFalsy());
      expect(trigger).toHaveFocus();
    });

    it(`[${label}] tooltip não introduz elementos focáveis próprios`, async () => {
      renderScenario(rows);
      const trigger = await findTrigger();
      trigger.focus();
      await waitFor(() => expect(findOpenTooltip(tipMatch)).toBeTruthy());

      const tip = findOpenTooltip(tipMatch)!;
      // Radix TooltipContent é aria-only: nada dentro dele deve ser tabulável.
      const focusables = tip.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      expect(focusables.length).toBe(0);
    });
  }
});
