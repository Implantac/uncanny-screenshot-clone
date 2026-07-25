import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductReadinessBadge } from "./product-readiness-badge";

expect.extend(toHaveNoViolations);

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpcMock(...a) },
}));

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

beforeEach(() => {
  rpcMock.mockReset();
});

describe("ProductReadinessBadge — acessibilidade", () => {
  it("expõe aria-label descritivo quando pronto para produção", async () => {
    rpcMock.mockResolvedValue({ data: READY_ROWS, error: null });
    renderBadge();
    const trigger = await screen.findByRole("button", {
      name: /Prontidão para produção/i,
    });
    expect(trigger).toHaveAttribute(
      "aria-label",
      expect.stringContaining("todos os gates críticos passaram"),
    );
    expect(trigger).toHaveAttribute("tabindex", "0");
  });

  it("lista gates pendentes no aria-label quando incompleto", async () => {
    rpcMock.mockResolvedValue({ data: PENDING_ROWS, error: null });
    renderBadge();
    const trigger = await screen.findByRole("button", {
      name: /Prontidão para produção/i,
    });
    const label = trigger.getAttribute("aria-label") ?? "";
    expect(label).toContain("2 de 4 gates críticos pendentes");
    expect(label).toContain("Ficha técnica aprovada");
    expect(label).toContain("Custo definido");
  });

  it("é focável e abre o tooltip via teclado", async () => {
    rpcMock.mockResolvedValue({ data: PENDING_ROWS, error: null });
    const user = userEvent.setup();
    renderBadge();
    const trigger = await screen.findByRole("button", {
      name: /Prontidão para produção/i,
    });

    await user.tab();
    expect(trigger).toHaveFocus();

    await waitFor(() => {
      const tips = screen.getAllByRole("tooltip");
      expect(tips.length).toBeGreaterThan(0);
      const tip = tips.find((t) => t.textContent?.includes("Gates críticos"));
      expect(tip).toBeTruthy();
      expect(tip!.textContent).toContain("Ficha técnica aprovada");
      expect(tip!.textContent).toContain("Pendente:");
      expect(tip!.textContent).toContain("Aprovado:");
    });
  });

  it("não tem violações axe no estado pronto", async () => {
    rpcMock.mockResolvedValue({ data: READY_ROWS, error: null });
    const { container } = renderBadge();
    await screen.findByRole("button", { name: /Prontidão para produção/i });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("não tem violações axe no estado pendente", async () => {
    rpcMock.mockResolvedValue({ data: PENDING_ROWS, error: null });
    const { container } = renderBadge();
    await screen.findByRole("button", { name: /Prontidão para produção/i });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
