import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertsPanel, type AlertsData } from "./alerts-panel";

const baseData: AlertsData = {
  critical: [
    { id: "i1", name: "Tecido jeans", balance: 2, minimum: 10, unit: "m" },
    { id: "i2", name: "Linha 60", balance: 0, minimum: 5, unit: "rl" },
  ],
  overdue: [{ id: "o1", code: "OP-100", due_date: "2025-01-01", progress: 30 }],
  stuck: [{ id: "s1", code: "OP-200", stage: "corte", stage_updated_at: new Date(Date.now() - 5 * 86_400_000).toISOString() }],
  oldProtos: [
    { id: "p1", code: "PT-1", name: "Camisa A", stage: "modelagem", updated_at: new Date(Date.now() - 10 * 86_400_000).toISOString() },
    { id: "p2", code: "PT-2", name: "Camisa B", stage: "piloto", updated_at: new Date(Date.now() - 15 * 86_400_000).toISOString() },
    { id: "p3", code: "PT-3", name: "Camisa C", stage: "piloto", updated_at: new Date(Date.now() - 20 * 86_400_000).toISOString() },
  ],
  comments: [{ id: "c1", kind: "proto", refCode: "PT-1", body: "Ajustar manga", when: new Date().toISOString() }],
  marketing: [{ id: "m1", title: "Campanha pronta", body: "Aprovar criativo" }],
};

describe("AlertsPanel · integração de chips", () => {
  it("renderiza contagens corretas em cada chip + total", () => {
    render(<AlertsPanel data={baseData} />);
    expect(screen.getByTestId("alerts-total")).toHaveTextContent("9 alertas no total");
    expect(screen.getByTestId("count-estoque")).toHaveTextContent("2");
    expect(screen.getByTestId("count-atraso")).toHaveTextContent("1");
    expect(screen.getByTestId("count-parado")).toHaveTextContent("1");
    expect(screen.getByTestId("count-proto")).toHaveTextContent("3");
    expect(screen.getByTestId("count-comentario")).toHaveTextContent("1");
    expect(screen.getByTestId("count-marketing")).toHaveTextContent("1");
    expect(screen.getByTestId("count-all")).toHaveTextContent("9");
  });

  it("'Tudo' mostra todas as 9 linhas, sem duplicar", () => {
    render(<AlertsPanel data={baseData} />);
    const list = screen.getByTestId("alerts-list");
    expect(within(list).queryAllByTestId(/^item-/)).toHaveLength(9);
  });

  it("alterna chip → renderiza apenas itens daquela categoria", async () => {
    const user = userEvent.setup();
    render(<AlertsPanel data={baseData} />);

    await user.click(screen.getByTestId("chip-estoque"));
    let items = within(screen.getByTestId("alerts-list")).queryAllByTestId(/^item-/);
    expect(items).toHaveLength(2);
    items.forEach((el) => expect(el).toHaveAttribute("data-testid", "item-estoque"));
    expect(screen.getByTestId("chip-estoque")).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByTestId("chip-proto"));
    items = within(screen.getByTestId("alerts-list")).queryAllByTestId(/^item-/);
    expect(items).toHaveLength(3);
    items.forEach((el) => expect(el).toHaveAttribute("data-testid", "item-proto"));

    await user.click(screen.getByTestId("chip-all"));
    expect(within(screen.getByTestId("alerts-list")).queryAllByTestId(/^item-/)).toHaveLength(9);
  });

  it("alternar chips repetidas vezes nunca duplica itens", async () => {
    const user = userEvent.setup();
    render(<AlertsPanel data={baseData} />);
    for (const k of ["estoque", "atraso", "parado", "proto", "comentario", "marketing", "all", "proto", "all"] as const) {
      await user.click(screen.getByTestId(`chip-${k}`));
      const items = within(screen.getByTestId("alerts-list")).queryAllByTestId(/^item-/);
      const ids = items.map((el) => el.getAttribute("data-testid"));
      expect(new Set(ids).size === 1 || k === "all").toBe(true);
      expect(items.length).toBeGreaterThan(0);
    }
  });

  it("categoria sem alertas mostra empty state específico", async () => {
    const user = userEvent.setup();
    const empty: AlertsData = { ...baseData, marketing: [] };
    render(<AlertsPanel data={empty} />);
    await user.click(screen.getByTestId("chip-marketing"));
    expect(screen.getByTestId("empty-state")).toHaveTextContent("Sem alertas em Marketing");
    expect(within(screen.getByTestId("alerts-list")).queryAllByTestId(/^item-/)).toHaveLength(0);
  });

  it("sem alertas em nenhuma categoria mostra 'Tudo sob controle'", () => {
    const zero: AlertsData = { critical: [], overdue: [], stuck: [], oldProtos: [], comments: [], marketing: [] };
    render(<AlertsPanel data={zero} />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent("Tudo sob controle");
    expect(screen.getByTestId("alerts-total")).toHaveTextContent("0 alertas no total");
  });
});
