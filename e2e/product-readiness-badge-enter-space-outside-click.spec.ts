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

test.describe("ProductReadinessBadge — Enter/Espaço abre, clique fora fecha (E2E)", () => {
  let variants: { ready: Locator | null; pending: Locator | null };

  test.beforeEach(async ({ page }) => {
    await login(page);
    variants = await findVariants(page);
    test.skip(
      !variants.ready && !variants.pending,
      "No ProductReadinessBadge rendered on /produtos for this dataset",
    );

    // Injeta um alvo não-focável fora do componente para o clique de fora.
    await page.evaluate(() => {
      const id = "__outside_click_target__";
      if (document.getElementById(id)) return;
      const el = document.createElement("div");
      el.id = id;
      el.textContent = "outside";
      el.style.cssText =
        "position:fixed;left:8px;bottom:8px;width:120px;height:32px;" +
        "z-index:2147483647;background:#f5f5f5;border:1px solid #999;" +
        "font:12px sans-serif;display:flex;align-items:center;justify-content:center;";
      document.body.appendChild(el);
    });
  });

  for (const state of ["ready", "pending"] as const) {
    for (const key of ["Enter", "Space"] as const) {
      test(`[${state}] ${key} abre tooltip; clique fora remove aria-describedby e esconde tooltip`, async ({
        page,
      }) => {
        const trigger = variants[state];
        test.skip(!trigger, `no ${state} badge in dataset`);

        await trigger!.scrollIntoViewIfNeeded();

        // Baseline: sem aria-describedby.
        expect((await trigger!.getAttribute("aria-describedby")) ?? "").toBe("");

        // Foca e abre via teclado.
        await trigger!.focus();
        expect(await trigger!.evaluate((el) => el === document.activeElement)).toBe(true);
        await page.keyboard.press(key);

        // Tooltip aberto: aria-describedby aponta para role="tooltip" com conteúdo.
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

        // Clique fora do componente (alvo não-focável).
        await page.locator("#__outside_click_target__").click();

        // Tooltip fecha, aria-describedby removido.
        await expect(tip).toBeHidden({ timeout: 5_000 });
        await expect
          .poll(async () => (await trigger!.getAttribute("aria-describedby")) ?? "", {
            timeout: 2_000,
          })
          .toBe("");
      });
    }
  }
});
