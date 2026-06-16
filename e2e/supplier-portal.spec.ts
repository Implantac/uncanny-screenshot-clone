import { test, expect } from "@playwright/test";

// Smoke checks for the public supplier portal endpoint. No auth required.
test.describe("supplier portal API", () => {
  test("rejects short/invalid token", async ({ request }) => {
    const res = await request.get("/api/public/supplier-portal/short");
    expect(res.status()).toBe(400);
  });

  test("returns 404 for unknown but well-formed token", async ({ request }) => {
    const fake = "00000000-0000-0000-0000-000000000000-not-real";
    const res = await request.get(`/api/public/supplier-portal/${fake}`);
    expect([404, 410]).toContain(res.status());
  });

  test("rejects invalid POST body", async ({ request }) => {
    const fake = "00000000-0000-0000-0000-000000000000-not-real";
    const res = await request.post(`/api/public/supplier-portal/${fake}`, {
      data: { rfq_id: "not-a-uuid", unit_price: -1 },
    });
    expect([400, 404, 410]).toContain(res.status());
  });
});
