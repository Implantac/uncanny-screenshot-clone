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

async function findVariants(page: Page) {
  await page.goto("/produtos");
  await page.waitForLoadState("networkidle");

  const all = page.locator(TRIGGER);
  await expect.poll(async () => await all.count(), { timeout: 15_000 }).toBeGreaterThan(0);

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

test.describe("ProductReadinessBadge — hover aria-describedby (E2E)", () => {
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
    test(`[${state}] hover define aria-describedby e mouseleave remove`, async ({ page }) => {
      const trigger = variants[state];
      test.skip(!trigger, `no ${state} badge in dataset`);

      await trigger!.scrollIntoViewIfNeeded();

      // Baseline: nenhum aria-describedby antes do hover.
      expect((await trigger!.getAttribute("aria-describedby")) ?? "").toBe("");

      // Hover no trigger → tooltip abre e aria-describedby aponta pro role="tooltip".
      await trigger!.hover();

      await expect
        .poll(async () => (await trigger!.getAttribute("aria-describedby")) ?? "", {
          timeout: 5_000,
        })
        .not.toBe("");

      const id = (await trigger!.getAttribute("aria-describedby"))!;
      const tip = page.locator(`#${CSS.escape(id)}`);
      await expect(tip).toBeVisible({ timeout: 5_000 });
      await expect(tip).toHaveAttribute("role", "tooltip");
      await expect(tip).toContainText(/Pronto para produção|Gates críticos/);

      // Move o mouse para fora (e para longe do tooltip) e blur pra evitar reabrir por foco.
      await page.mouse.move(0, 0);
      await trigger!.evaluate((el) => (el as HTMLElement).blur());

      await expect(tip).toBeHidden({ timeout: 5_000 });
      await expect
        .poll(async () => (await trigger!.getAttribute("aria-describedby")) ?? "", {
          timeout: 2_000,
        })
        .toBe("");
    });
  }
});
