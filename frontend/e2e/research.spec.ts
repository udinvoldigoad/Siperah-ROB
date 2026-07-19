import { expect, test } from "@playwright/test";
import { SEED_USERS, loginViaApi } from "./helpers";

// P2 6.2: portal peneliti — unduh dataset (CSV) dan buat/regenerasi API key.
test("peneliti mengunduh dataset CSV", async ({ page }) => {
  await loginViaApi(page, SEED_USERS.peneliti, "#/research");

  // Katalog dataset seed tampil.
  await expect(page.getByText("Data Historis Pasang Surut Teluk Lampung", { exact: false })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^CSV$/i }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
});

test("peneliti membuat API key baru dan kunci penuh tampil sekali", async ({ page }) => {
  await loginViaApi(page, SEED_USERS.peneliti, "#/research");

  const regenerateResponse = page.waitForResponse(
    (response) => response.url().includes("/api/research/api-keys") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Buat Kunci|Regenerasi/ }).click();
  expect((await regenerateResponse).status()).toBe(201);

  // Raw key spr_... tampil di layar beserta tombol salin.
  await expect(page.getByText(/spr_[A-Za-z0-9]{10,}/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Salin Kunci/ })).toBeVisible();
});
