import { expect, test } from "@playwright/test";
import { SEED_USERS, TINY_PNG, loginViaApi } from "./helpers";

// P1 6.2: alur inti warga -> operator -> publik dalam satu rangkaian:
// warga submit laporan (koordinat default wizard ada di wilayah pantauan seed
// Bandar Lampung) -> muncul di riwayat -> operator memvalidasi -> laporan
// tampil di data peta publik.
test("warga submit laporan, operator validasi, laporan tampil di peta publik", async ({ page }) => {
  const uniqueDescription = `Uji E2E genangan rob otomatis ${Date.now()}`;

  // ── 1. Warga mengisi wizard laporan ─────────────────────────────
  await loginViaApi(page, SEED_USERS.warga, "#/reports");
  await expect(page.locator("#water_height_cm")).toBeVisible();
  await page.locator("#water_height_cm").fill("45");

  await page.locator('input[type="file"]').setInputFiles({
    name: "dokumentasi.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
  // Tunggu kompresi WebP selesai (thumbnail foto muncul), baru isi deskripsi —
  // textarea-nya uncontrolled sehingga diisi terakhir agar tidak ter-reset.
  await expect(page.getByText("dokumentasi", { exact: false }).first()).toBeVisible();
  await page.locator('textarea[name="description"]').fill(uniqueDescription);
  await expect(page.locator('textarea[name="description"]')).toHaveValue(uniqueDescription);
  await page.getByLabel("Setujui pernyataan kebenaran laporan").check();

  const submitResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/reports") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Kirim laporan/ }).click();
  const submitResponse = await submitResponsePromise;
  expect(submitResponse.status(), `Submit laporan gagal: ${await submitResponse.text()}`).toBe(201);

  const confirmation = page.getByRole("dialog").getByText(/Kode verifikasi:/);
  await expect(confirmation).toBeVisible();
  const reportCode = (await confirmation.textContent())?.match(/GT-[A-Z]+-[A-Z0-9]+/)?.[0];
  expect(reportCode, "kode laporan harus tampil di dialog konfirmasi").toBeTruthy();

  // ── 2. Muncul di riwayat laporan warga ──────────────────────────
  await page.goto("/#/history");
  await page.reload();
  await expect(page.getByText(`KODE: ${reportCode}`)).toBeVisible();
  await expect(page.getByText(uniqueDescription)).toBeVisible();

  // ── 3. Operator memvalidasi dari antrean ────────────────────────
  await loginViaApi(page, SEED_USERS.operator, "#/operator");
  const reportCard = page.locator(".report-row", { hasText: uniqueDescription });
  await expect(reportCard).toBeVisible();
  await reportCard.getByRole("button", { name: "Validasi" }).click();
  await expect(reportCard).toHaveCount(0);

  // ── 4. Tampil di data peta publik ───────────────────────────────
  const mapResponse = page.waitForResponse((response) => response.url().includes("/api/public/map"));
  await page.goto("/#/map");
  await page.reload();
  const mapBody = await (await mapResponse).text();
  expect(mapBody).toContain(reportCode as string);
});
