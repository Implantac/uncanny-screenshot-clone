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

async function describedTip(page: Page, trigger: Locator) {
  const id = await trigger.getAttribute("aria-describedby");
  if (!id) return null;
  return page.locator(`#${CSS.escape(id)}`);
}

/** Descobre qual dos dois triggers vem depois na ordem do DOM. */
async function pickLater(a: Locator, b: Locator): Promise<{ later: Locator; earlier: Locator }> {
  const aFirst = await a.evaluate(
    (el, other) =>
      !!(el.compareDocumentPosition(other as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
    await b.elementHandle(),
  );
  return aFirst ? { earlier: a, later: b } : { earlier: b, later: a };
}

/** Shift+Tab até o trigger alvo pegar foco (limite de segurança). */
async function shiftTabUntilFocused(page: Page, target: Locator, maxSteps = 120) {
  for (let i = 0; i < maxSteps; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return true;
    await page.keyboard.press("Shift+Tab");
  }
  return await target.evaluate((el) => el === document.activeElement);
}

test.describe("ProductReadinessBadge — Shift+Tab entre triggers (E2E)", () => {
  test("Shift+Tab alterna aria-describedby e tooltip entre pronto e pendente", async ({
    page,
  }) => {
    await login(page);
    const { ready, pending } = await findVariants(page);
    test.skip(
      !ready || !pending,
      "Precisa de pelo menos 1 badge pronto e 1 pendente no dataset",
    );

    await ready!.scrollIntoViewIfNeeded();
    await pending!.scrollIntoViewIfNeeded();

    // Descobre ordem no DOM pra saber quem é "later" (ponto de partida do Shift+Tab).
    const { later, earlier } = await pickLater(ready!, pending!);

    // 1) Foca no later via clique (âncora de partida) e valida tooltip.
    await later.focus();
    expect(await later.evaluate((el) => el === document.activeElement)).toBe(true);
    await expect
      .poll(async () => (await later.getAttribute("aria-describedby")) ?? "", {
        timeout: 5_000,
      })
      .not.toBe("");
    const laterTip = await describedTip(page, later);
    expect(laterTip).not.toBeNull();
    await expect(laterTip!).toBeVisible({ timeout: 5_000 });
    await expect(laterTip!).toHaveAttribute("role", "tooltip");
    expect((await earlier.getAttribute("aria-describedby")) ?? "").toBe("");

    // 2) Shift+Tab até o earlier receber foco.
    const reached = await shiftTabUntilFocused(page, earlier);
    expect(reached, "Shift+Tab chegou no trigger anterior").toBe(true);

    // aria-describedby migra: earlier ganha, later perde. Tooltip anterior fecha.
    await expect
      .poll(async () => (await earlier.getAttribute("aria-describedby")) ?? "", {
        timeout: 5_000,
      })
      .not.toBe("");
    await expect
      .poll(async () => (await later.getAttribute("aria-describedby")) ?? "", {
        timeout: 5_000,
      })
      .toBe("");
    await expect(laterTip!).toBeHidden({ timeout: 5_000 });

    const earlierTip = await describedTip(page, earlier);
    expect(earlierTip).not.toBeNull();
    await expect(earlierTip!).toBeVisible({ timeout: 5_000 });
    await expect(earlierTip!).toHaveAttribute("role", "tooltip");

    const laterId = (await later.getAttribute("aria-describedby")) ?? "";
    const earlierId = (await earlier.getAttribute("aria-describedby")) ?? "";
    expect(earlierId).not.toBe(laterId);

    // Conteúdos coerentes com pronto/pendente independente da ordem no DOM.
    const readyRegex = /Pronto para produção/;
    const pendingRegex = /Gates críticos/;
    const earlierIsReady = earlier === ready;
    await expect(earlierTip!).toContainText(earlierIsReady ? readyRegex : pendingRegex);

    // 3) Shift+Tab de volta pra... na verdade agora precisamos Tab pra frente pro later.
    //    Usa Tab pra confirmar que voltar pro later restaura o tooltip dele.
    for (let i = 0; i < 120; i++) {
      if (await later.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    expect(await later.evaluate((el) => el === document.activeElement)).toBe(true);

    await expect
      .poll(async () => (await later.getAttribute("aria-describedby")) ?? "", {
        timeout: 5_000,
      })
      .not.toBe("");
    await expect
      .poll(async () => (await earlier.getAttribute("aria-describedby")) ?? "", {
        timeout: 5_000,
      })
      .toBe("");
    await expect(earlierTip!).toBeHidden({ timeout: 5_000 });

    const laterTip2 = await describedTip(page, later);
    await expect(laterTip2!).toBeVisible({ timeout: 5_000 });
    const laterIsReady = later === ready;
    await expect(laterTip2!).toContainText(laterIsReady ? readyRegex : pendingRegex);
  });
});
