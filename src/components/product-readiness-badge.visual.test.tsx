import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductReadinessBadge } from "./product-readiness-badge";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpcMock(...a) },
}));

const READY_ROWS = [
  { requirement: "Ficha técnica aprovada", ok: true, detail: null },
  { requirement: "BOM (materiais)", ok: true, detail: null },
  { requirement: "Custo definido", ok: true, detail: null },
  { requirement: "Protótipo aprovado", ok: true, detail: null },
];

const PENDING_ROWS = [
  { requirement: "Ficha técnica aprovada", ok: false, detail: "sem versão aprovada" },
  { requirement: "BOM (materiais)", ok: true, detail: null },
  { requirement: "Custo definido", ok: false, detail: null },
  { requirement: "Protótipo aprovado", ok: true, detail: null },
];

// Simulated device sizes for visual-regression via structural snapshots.
// jsdom does not paint pixels, so we snapshot the rendered DOM (classes,
// aria attributes, tooltip structure) at each viewport — a regression on
// visual structure (added classes, changed layout, broken tooltip) fails.
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 667 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  window.dispatchEvent(new Event("resize"));
}

function renderBadge() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProductReadinessBadge productId="p1" />
    </QueryClientProvider>,
  );
}

function normalize(html: string): string {
  return html
    .replace(/id="[^"]*"/g, 'id="__id__"')
    .replace(/aria-describedby="[^"]*"/g, 'aria-describedby="__id__"')
    .replace(/aria-labelledby="[^"]*"/g, 'aria-labelledby="__id__"')
    .replace(/aria-controls="[^"]*"/g, 'aria-controls="__id__"')
    .replace(/data-radix-[^=]*="[^"]*"/g, 'data-radix="__id__"')
    .replace(/style="[^"]*"/g, 'style="__style__"');
}

beforeEach(() => {
  rpcMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("ProductReadinessBadge — regressão visual (DOM snapshot)", () => {
  for (const vp of VIEWPORTS) {
    it(`estado pronto @ ${vp.name} (${vp.width}x${vp.height})`, async () => {
      setViewport(vp.width, vp.height);
      rpcMock.mockResolvedValue({ data: READY_ROWS, error: null });
      const { container } = renderBadge();
      await screen.findByRole("button", { name: /Prontidão para produção/i });
      expect(normalize(container.innerHTML)).toMatchSnapshot(
        `ready-${vp.name}-trigger`,
      );
    });

    it(`estado pronto @ ${vp.name} — tooltip aberto`, async () => {
      setViewport(vp.width, vp.height);
      rpcMock.mockResolvedValue({ data: READY_ROWS, error: null });
      renderBadge();
      const trigger = await screen.findByRole("button", {
        name: /Prontidão para produção/i,
      });
      trigger.focus();
      await waitFor(() => {
        const tip = screen
          .getAllByRole("tooltip")
          .find((t) => t.textContent?.includes("Pronto para produção"));
        expect(tip).toBeTruthy();
      });
      const tip = screen
        .getAllByRole("tooltip")
        .find((t) => t.textContent?.includes("Pronto para produção"))!;
      expect(normalize(tip.outerHTML)).toMatchSnapshot(`ready-${vp.name}-tooltip`);
    });

    it(`estado pendente @ ${vp.name} (${vp.width}x${vp.height})`, async () => {
      setViewport(vp.width, vp.height);
      rpcMock.mockResolvedValue({ data: PENDING_ROWS, error: null });
      const { container } = renderBadge();
      await screen.findByRole("button", { name: /Prontidão para produção/i });
      expect(normalize(container.innerHTML)).toMatchSnapshot(
        `pending-${vp.name}-trigger`,
      );
    });

    it(`estado pendente @ ${vp.name} — tooltip aberto`, async () => {
      setViewport(vp.width, vp.height);
      rpcMock.mockResolvedValue({ data: PENDING_ROWS, error: null });
      renderBadge();
      const trigger = await screen.findByRole("button", {
        name: /Prontidão para produção/i,
      });
      trigger.focus();
      await waitFor(() => {
        const tip = screen
          .getAllByRole("tooltip")
          .find((t) => t.textContent?.includes("Gates críticos"));
        expect(tip).toBeTruthy();
      });
      const tip = screen
        .getAllByRole("tooltip")
        .find((t) => t.textContent?.includes("Gates críticos"))!;
      expect(normalize(tip.outerHTML)).toMatchSnapshot(
        `pending-${vp.name}-tooltip`,
      );
    });
  }
});
