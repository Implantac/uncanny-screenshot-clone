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

/**
 * Inject a non-focusable "outside" element pinned to a corner of the viewport.
 * Clicking a non-focusable target does not shift DOM focus in browsers, so we
 * can assert that Radix dismisses the tooltip on pointerdown-outside AND the
 * trigger keeps keyboard focus (i.e. focus "returns" to the trigger, since it
 * was never stolen by the click target).
 */
async function addOutsideTarget(page: Page) {
  await page.evaluate(() => {
    const prev = document.getElementById("__e2e_outside__");
    if (prev) prev.remove();
    const el = document.createElement("div");
    el.id = "__e2e_outside__";
    el.setAttribute("data-testid", "outside-target");
    el.style.cssText =
      "position:fixed;top:8px;right:8px;width:120px;height:40px;" +
      "background:transparent;z-index:2147483647;pointer-events:auto;";
    document.body.appendChild(el);
  });
  return page.locator('[data-testid="outside-target"]');
}

test.describe("ProductReadinessBadge — clique fora (E2E)", () => {
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
    test(`[${state}] clicar fora fecha o tooltip e mantém o foco no trigger`, async ({
      page,
    }) => {
      const trigger = variants[state];
      test.skip(!trigger, `no ${state} badge in dataset`);

      const tip = await openTooltipContent(page, trigger!);
      const outside = await addOutsideTarget(page);

      // Sanity: trigger is focused before clicking outside.
      expect(
        await trigger!.evaluate((el) => el === document.activeElement),
        "trigger should own focus before outside click",
      ).toBe(true);

      await outside.click();

      // Tooltip dismisses on pointerdown-outside.
      await expect(tip).toBeHidden({ timeout: 5_000 });

      // Focus stayed on the trigger (target is non-focusable).
      await expect
        .poll(
          async () => await trigger!.evaluate((el) => el === document.activeElement),
          { timeout: 2_000 },
        )
        .toBe(true);
    });
  }
});
