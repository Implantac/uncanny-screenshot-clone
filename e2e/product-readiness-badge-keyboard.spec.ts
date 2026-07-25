import { test, expect, type Page, type Locator } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

test.skip(!EMAIL || !PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD to run this test");

async function login(page: Page) {
  await page.goto("/auth");
  await page.locator("#si-email").fill(EMAIL);
  await page.locator("#si-pass").fill(PASSWORD);
  await page.getByRole("button", { name: /^Entrar$/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 15_000 });
}

const TRIGGER = 'button[aria-label^="Prontidão para produção"]';

async function openTooltipContent(page: Page, trigger: Locator) {
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  const tip = page
    .locator('[role="tooltip"]')
    .filter({ hasText: /Pronto para produção|Gates críticos/ })
    .first();
  await expect(tip).toBeVisible({ timeout: 5_000 });
  return tip;
}

/**
 * Locate one ready and one pending ProductReadinessBadge in the product list
 * so we can exercise keyboard flow against both variants in real DOM.
 */
async function findVariants(page: Page) {
  await page.goto("/produtos");
  await page.waitForLoadState("networkidle");

  const all = page.locator(TRIGGER);
  await expect
    .poll(async () => await all.count(), { timeout: 15_000 })
    .toBeGreaterThan(0);

  const count = await all.count();
  let ready: Locator | null = null;
  let pending: Locator | null = null;
  for (let i = 0; i < count; i++) {
    const el = all.nth(i);
    const label = (await el.getAttribute("aria-label")) ?? "";
    if (!ready && /todos os gates críticos passaram/i.test(label)) ready = el;
    else if (!pending && /gates críticos pendentes/i.test(label)) pending = el;
    if (ready && pending) break;
  }
  return { ready, pending };
}

test.describe("ProductReadinessBadge — teclado (E2E)", () => {
  let variants: { ready: Locator | null; pending: Locator | null };

  test.beforeEach(async ({ page }) => {
    await login(page);
    variants = await findVariants(page);
    test.skip(
      !variants.ready && !variants.pending,
      "No ProductReadinessBadge rendered on /produtos for this dataset",
    );
  });

  for (const state of ["ready", "pending"] as const) {
    test(`[${state}] Tab foca no trigger e abre o tooltip`, async ({ page }) => {
      const trigger = variants[state];
      test.skip(!trigger, `no ${state} badge in dataset`);

      // Focus a neighbour first, then Tab into the badge to prove Tab-navigation
      // (not just programmatic focus) reveals the tooltip.
      const anchor = page.locator("body");
      await anchor.click({ position: { x: 5, y: 5 } });
      await trigger!.scrollIntoViewIfNeeded();

      // Walk Tab up to N times until the badge takes focus.
      let focused = false;
      for (let i = 0; i < 80 && !focused; i++) {
        await page.keyboard.press("Tab");
        focused = await trigger!.evaluate((el) => el === document.activeElement);
      }
      expect(focused, "Tab navigation reached the badge trigger").toBe(true);

      const tip = page
        .locator('[role="tooltip"]')
        .filter({ hasText: /Pronto para produção|Gates críticos/ })
        .first();
      await expect(tip).toBeVisible({ timeout: 5_000 });
    });

    test(`[${state}] Shift+Tab tira o foco do trigger e fecha o tooltip`, async ({
      page,
    }) => {
      const trigger = variants[state];
      test.skip(!trigger, `no ${state} badge in dataset`);

      const tip = await openTooltipContent(page, trigger!);
      await page.keyboard.press("Shift+Tab");

      await expect
        .poll(async () => await trigger!.evaluate((el) => el === document.activeElement))
        .toBe(false);
      await expect(tip).toBeHidden({ timeout: 5_000 });
    });

    test(`[${state}] Escape fecha o tooltip mantendo o foco no trigger`, async ({
      page,
    }) => {
      const trigger = variants[state];
      test.skip(!trigger, `no ${state} badge in dataset`);

      const tip = await openTooltipContent(page, trigger!);
      await page.keyboard.press("Escape");

      await expect(tip).toBeHidden({ timeout: 5_000 });
      expect(await trigger!.evaluate((el) => el === document.activeElement)).toBe(true);
    });
  }
});
