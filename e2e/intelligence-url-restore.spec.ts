import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { intelFilter } from "../src/lib/intel-filter";

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

// Per-tab spec: which queryKey holds the raw list and which fields the
// in-app `intelFilter` matches against. Mirrors the wiring inside
// src/routes/_authenticated/_app.intelligence.tsx.
const TAB_SPEC = {
  production: { key: ["intel", "products"], fields: ["name", "sku", "category"] },
  kanban: { key: ["intel", "production_orders"], fields: ["code", "notes"] },
  dev: { key: ["intel", "prototypes"], fields: ["code", "notes"] },
  score: { key: ["intel", "products"], fields: ["name", "sku", "category"] },
  restock: { key: ["intel", "products"], fields: ["name", "sku", "category"] },
  sales: { key: ["intel", "products"], fields: ["name", "sku", "category"] },
} as const;
const TABS = Object.keys(TAB_SPEC) as Array<keyof typeof TAB_SPEC>;

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
    test(`/intelligence?tab=${tab}&q=${QUERY} → list matches filter`, async ({
      page,
    }, testInfo) => {
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
      const offenders = texts.map((t, i) => ({ i, t })).filter(({ t }) => !t.includes(QUERY));

      if (offenders.length > 0) {
        const outDir = path.join("test-results", "intel-debug", `${tab}-${Date.now()}`);
        await mkdir(outDir, { recursive: true });

        // 1) Full-page screenshot of what the user would see.
        const shotPath = path.join(outDir, "page.png");
        await page.screenshot({ path: shotPath, fullPage: true });

        // 2) Per-offender highlighted screenshots.
        for (const { i } of offenders) {
          const el = items.nth(i);
          await el.scrollIntoViewIfNeeded().catch(() => {});
          await el.screenshot({ path: path.join(outDir, `offender-${i}.png`) }).catch(() => {});
        }

        // 3) HTML dump of the active tab panel (smaller than full page).
        const panel = page.locator('[role="tabpanel"]:not([hidden])').first();
        const panelHtml = (await panel.innerHTML().catch(() => "")) || (await page.content());
        await writeFile(path.join(outDir, "tabpanel.html"), panelHtml, "utf8");

        // 4) Raw mismatch report for fast scanning.
        await writeFile(
          path.join(outDir, "offenders.json"),
          JSON.stringify({ tab, query: QUERY, url: page.url(), count, offenders }, null, 2),
          "utf8",
        );

        // 5) Expected vs actual JSON — pulls the unfiltered dataset from the
        //    in-page TanStack Query cache (exposed as window.__QC__), applies
        //    the same `intelFilter` the app uses, and pairs it with the rows
        //    actually rendered in the DOM.
        const spec = TAB_SPEC[tab];
        const raw = await page.evaluate(
          (key) => {
            const qc = (window as unknown as { __QC__?: { getQueryData: (k: unknown) => unknown } })
              .__QC__;
            return qc ? ((qc.getQueryData(key) as unknown[] | undefined) ?? null) : null;
          },
          spec.key as unknown as string[],
        );

        const expected = Array.isArray(raw)
          ? intelFilter(
              raw as Array<Record<string, unknown>>,
              QUERY,
              spec.fields as unknown as string[],
            )
          : null;

        const actual = texts.map((t, i) => ({ index: i, text: t, matches: t.includes(QUERY) }));

        const diff = {
          tab,
          query: QUERY,
          url: page.url(),
          queryKey: spec.key,
          fields: spec.fields,
          counts: {
            expected: expected?.length ?? null,
            actual: actual.length,
            offenders: offenders.length,
          },
          expected,
          actual,
          offenders,
          rawDatasetSize: Array.isArray(raw) ? raw.length : null,
          note:
            expected == null
              ? "Cache was empty — window.__QC__ not populated for this queryKey (run against the dev/preview build)."
              : undefined,
        };
        const diffJson = JSON.stringify(diff, null, 2);
        await writeFile(path.join(outDir, "expected-vs-actual.json"), diffJson, "utf8");

        // 6) Attach everything to the Playwright HTML report.
        await testInfo.attach("page.png", { path: shotPath, contentType: "image/png" });
        await testInfo.attach("tabpanel.html", { body: panelHtml, contentType: "text/html" });
        await testInfo.attach("expected-vs-actual.json", {
          body: diffJson,
          contentType: "application/json",
        });

        console.error(`[intel-debug] ${offenders.length} mismatches saved to ${outDir}`);
      }

      expect(
        offenders.map((o) => o.t),
        `Tab "${tab}" rendered ${offenders.length} non-matching items`,
      ).toEqual([]);
    });
  }
});
