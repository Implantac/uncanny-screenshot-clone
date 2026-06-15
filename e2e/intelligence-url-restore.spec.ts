import { test, expect, type Page } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

test.skip(!EMAIL || !PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD to run this test");

async function login(page: Page) {
  await page.goto("/auth");
  await page.locator("#si-email").fill(EMAIL);
  await page.locator("#si-pass").fill(PASSWORD);
  await page.getByRole("button", { name: /^Entrar$/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 15_000 });
}

const QUERY = "vestido";
const TABS = ["production", "kanban", "dev", "score", "restock", "sales"] as const;

/**
 * For each tab, assert that:
 *  1) The active tab matches the URL `tab` param
 *  2) The global search input is hydrated with `q`
 *  3) Every visible [data-testid="intel-item"] contains the query (case-insensitive)
 *     — i.e. the rendered list equals the filtered result and contains nothing else.
 */
test.describe("Intelligence URL restore — filtered lists", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const tab of TABS) {
    test(`/intelligence?tab=${tab}&q=${QUERY} → list matches filter`, async ({ page }) => {
      await page.goto(`/intelligence?tab=${tab}&q=${QUERY}`);

      // Search input + tab restored from URL
      await expect(page.getByPlaceholder(/buscar em todas as abas/i)).toHaveValue(QUERY);
      const activeTab = page.getByRole("tab", { selected: true });
      await expect(activeTab).toBeVisible();

      // Wait for either rendered items or the empty-state row.
      const items = page.locator('[data-testid="intel-item"]:visible');
      await page.waitForLoadState("networkidle");

      const count = await items.count();
      const texts: string[] = [];
      for (let i = 0; i < count; i++) {
        texts.push(((await items.nth(i).innerText()) || "").toLowerCase());
      }

      // Every visible list item must match the query. Empty list is acceptable
      // (means the dataset has no "vestido" rows for that tab) — what we forbid
      // is an item that does NOT contain the query slipping through the filter.
      const offenders = texts.filter((t) => !t.includes(QUERY));
      expect(offenders, `Tab "${tab}" rendered ${offenders.length} non-matching items`).toEqual([]);
    });
  }
});
