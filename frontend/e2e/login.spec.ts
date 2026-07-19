import { expect, test } from "@playwright/test";
import { SEED_USERS, loginViaUi } from "./helpers";

// P1 6.2: login semua role lewat UI -> redirect ke dashboard yang benar.
const REDIRECTS: Array<{ role: keyof typeof SEED_USERS; hash: string }> = [
  { role: "warga", hash: "#/" },
  { role: "operator", hash: "#/operator" },
  { role: "provinsi", hash: "#/province" },
  { role: "peneliti", hash: "#/research" },
  { role: "admin", hash: "#/admin" },
];

for (const { role, hash } of REDIRECTS) {
  test(`login ${role} diarahkan ke ${hash}`, async ({ page }) => {
    await loginViaUi(page, SEED_USERS[role]);

    await page.waitForURL(`**/${hash}`);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
}

test("password salah tetap di halaman login", async ({ page }) => {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill(SEED_USERS.warga);
  await page.locator('input[type="password"]').fill("password-salah");

  const loginResponse = page.waitForResponse((response) => response.url().includes("/api/auth/login"));
  await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();
  expect((await loginResponse).status()).toBe(401);

  // Tetap di halaman login, tidak ada redirect, form masih tampil.
  await page.waitForTimeout(1000);
  expect(page.url()).toContain("#/login");
  await expect(page.locator('input[type="password"]')).toBeVisible();
});
