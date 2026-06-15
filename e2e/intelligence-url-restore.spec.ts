import { test, expect, type Page } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

test.skip(!EMAIL || !PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD to run this test");

async function login(page: Page) {
  await page.goto("/auth");
  await page.getByLabel("Email").first().fill(EMAIL);
  await page.locator("#si-pass").fill(PASSWORD);
  await page.getByRole("button", { name: /^Entrar$/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 15_000 });
}

const QUERY = "vestido";

// Each tab + an assertion about the filtered list it must render.
const TABS: Array<{
  tab: string;
  trigger: RegExp;
  // A selector or text we expect to be visible after the filter applies.
  expect: (page: Page) => Promise<void>;
}> = [
  {
    tab: "score",
    trigger: /score/i,
    expect: async (page) => {
      // Product Score list rows should all match the query (case-insensitive).
      const rows = page.getByRole("row");
      await expect(rows.first()).toBeVisible();
      const texts = await rows.allInnerTexts();
      expect(texts.slice(1).every((t) => t.toLowerCase().includes(QUERY))).toBeTruthy();
    },
  },
  {
    tab: "production",
    trigger: /produ(c|ç)/i,
    expect: async (page) => {
      await expect(page.getByRole("tab", { selected: true })).toHaveText(/produ/i);
    },
  },
  {
    tab: "kanban",
    trigger: /kanban|pcp/i,
    expect: async (page) => {
      await expect(page.getByRole("tab", { selected: true })).toBeVisible();
    },
  },
  {
    tab: "dev",
    trigger: /desenv/i,
    expect: async (page) => {
      await expect(page.getByRole("tab", { selected: true })).toBeVisible();
    },
  },
  {
    tab: "restock",
    trigger: /restock|repos/i,
    expect: async (page) => {
      await expect(page.getByRole("tab", { selected: true })).toBeVisible();
    },
  },
  {
    tab: "sales",
    trigger: /sales|vendas/i,
    expect: async (page) => {
      await expect(page.getByRole("tab", { selected: true })).toBeVisible();
    },
  },
];

test.describe("Intelligence URL restore", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("opens /intelligence?tab=score&q=vestido and restores tab + filter", async ({ page }) => {
    await page.goto(`/intelligence?tab=score&q=${QUERY}`);
    // Search input reflects q
    const search = page.getByPlaceholder(/buscar em todas as abas/i);
    await expect(search).toHaveValue(QUERY);
    // Score tab is the active one
    await expect(page.getByRole("tab", { selected: true })).toHaveText(/score/i);
  });

  for (const t of TABS) {
    test(`tab="${t.tab}" with q=${QUERY} restores filter`, async ({ page }) => {
      await page.goto(`/intelligence?tab=${t.tab}&q=${QUERY}`);
      const search = page.getByPlaceholder(/buscar em todas as abas/i);
      await expect(search).toHaveValue(QUERY);
      await expect(page.getByRole("tab", { selected: true })).toHaveText(t.trigger);
      await t.expect(page);
    });
  }
});
