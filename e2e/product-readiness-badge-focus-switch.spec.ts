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

async function describedTip(page: Page, trigger: Locator) {
  const id = await trigger.getAttribute("aria-describedby");
  if (!id) return null;
  return page.locator(`#${CSS.escape(id)}`);
}

test.describe("ProductReadinessBadge — foco rápido entre triggers (E2E)", () => {
  test("focus pronto → pendente troca aria-describedby e tooltip", async ({ page }) => {
    await login(page);
    const { ready, pending } = await findVariants(page);
    test.skip(!ready || !pending, "Precisa de pelo menos 1 badge pronto e 1 pendente no dataset");

    await ready!.scrollIntoViewIfNeeded();
    await pending!.scrollIntoViewIfNeeded();

    // Baseline: nenhum aria-describedby.
    expect((await ready!.getAttribute("aria-describedby")) ?? "").toBe("");
    expect((await pending!.getAttribute("aria-describedby")) ?? "").toBe("");

    // 1) Foco no PRONTO — aria-describedby aparece apontando pro tooltip "Pronto".
    await ready!.focus();
    expect(await ready!.evaluate((el) => el === document.activeElement)).toBe(true);
    await expect
      .poll(async () => (await ready!.getAttribute("aria-describedby")) ?? "", {
        timeout: 5_000,
      })
      .not.toBe("");
    const readyTip = await describedTip(page, ready!);
    expect(readyTip).not.toBeNull();
    await expect(readyTip!).toBeVisible({ timeout: 5_000 });
    await expect(readyTip!).toHaveAttribute("role", "tooltip");
    await expect(readyTip!).toContainText(/Pronto para produção/);
    expect((await pending!.getAttribute("aria-describedby")) ?? "").toBe("");

    // 2) Foco muda pro PENDENTE — pronto perde describedby+tooltip, pendente ganha.
    await pending!.focus();
    expect(await pending!.evaluate((el) => el === document.activeElement)).toBe(true);

    await expect
      .poll(async () => (await pending!.getAttribute("aria-describedby")) ?? "", {
        timeout: 5_000,
      })
      .not.toBe("");
    await expect
      .poll(async () => (await ready!.getAttribute("aria-describedby")) ?? "", {
        timeout: 5_000,
      })
      .toBe("");
    await expect(readyTip!).toBeHidden({ timeout: 5_000 });

    const pendingTip = await describedTip(page, pending!);
    expect(pendingTip).not.toBeNull();
    await expect(pendingTip!).toBeVisible({ timeout: 5_000 });
    await expect(pendingTip!).toHaveAttribute("role", "tooltip");
    await expect(pendingTip!).toContainText(/Gates críticos/);

    const readyId = (await ready!.getAttribute("aria-describedby")) ?? "";
    const pendingId = (await pending!.getAttribute("aria-describedby")) ?? "";
    expect(pendingId).not.toBe(readyId);

    // 3) Volta rápido pro PRONTO — troca inversa.
    await ready!.focus();
    await expect
      .poll(async () => (await ready!.getAttribute("aria-describedby")) ?? "", {
        timeout: 5_000,
      })
      .not.toBe("");
    await expect
      .poll(async () => (await pending!.getAttribute("aria-describedby")) ?? "", {
        timeout: 5_000,
      })
      .toBe("");
    await expect(pendingTip!).toBeHidden({ timeout: 5_000 });
    const readyTip2 = await describedTip(page, ready!);
    await expect(readyTip2!).toBeVisible({ timeout: 5_000 });
    await expect(readyTip2!).toContainText(/Pronto para produção/);
  });
});
