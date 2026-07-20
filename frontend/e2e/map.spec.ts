import { expect, test, type Page } from "@playwright/test";

// P2 6.2: peta publik — filter kabupaten, horizon prediksi, klik wilayah
// (badge risiko di peta), dan toggle layer. Halaman publik, tanpa login.
//
// Catatan clustering: pada zoom awal (se-provinsi) badge risiko sengaja
// disembunyikan dan digantikan gelembung cluster, supaya ~311 wilayah tidak
// saling menumpuk. Badge baru dirender setelah zoom >= CLUSTER_MAX_ZOOM.
// Karena itu test yang butuh badge harus memfokuskan peta ke satu kabupaten
// dulu — memilih kabupaten memicu fitBounds ke bbox yang jauh lebih rapat.
const REGENCY = "Kota Bandar Lampung";

/** Fokuskan peta ke satu kabupaten sampai badge risiko benar-benar dirender. */
async function focusRegency(page: Page) {
  const filtered = page.waitForResponse((response) =>
    response.url().includes("/api/public/map") && response.url().includes("regency="),
  );
  await page.locator('label:has-text("Kabupaten/Kota") select').selectOption(REGENCY);
  await filtered;
  await expect(page.locator(".map-risk-badge").first()).toBeVisible();
}

/** Buka dropdown "Pilihan Layer" — checkbox layer ada di dalamnya. */
async function openLayerMenu(page: Page) {
  await page.getByRole("button", { name: /layer aktif/ }).click();
}

test.describe("peta publik", () => {
  test.beforeEach(async ({ page }) => {
    const mapResponse = page.waitForResponse((response) => response.url().includes("/api/public/map"));
    await page.goto("/#/map");
    await mapResponse;
    await expect(page.locator(".map-canvas canvas")).toBeVisible();
  });

  test("filter kabupaten menyaring wilayah di peta dan sidebar", async ({ page }) => {
    await focusRegency(page);

    // Sidebar "Wilayah terpilih" otomatis menampilkan wilayah dari kabupaten terpilih.
    // Discoped ke panel sidebar: nama kabupaten juga muncul di dalam badge
    // marker peta (yang bisa berada di luar viewport, jadi hidden).
    const selectedPanel = page.locator(".panel").filter({ hasText: "Wilayah terpilih" });
    await expect(selectedPanel).toBeVisible();
    await expect(selectedPanel.getByText(REGENCY).first()).toBeVisible();
    expect(await page.locator(".map-risk-badge").count()).toBeGreaterThan(0);
  });

  test("horizon prediksi mengubah tanggal yang diminta ke API", async ({ page }) => {
    const horizonSelect = page.locator('label:has-text("Horizon prediksi") select');
    const optionValue = await horizonSelect.locator("option").nth(1).getAttribute("value");
    expect(optionValue, "opsi horizon pertama harus punya tanggal").toBeTruthy();

    const dated = page.waitForResponse((response) =>
      response.url().includes("/api/public/map") && response.url().includes(`date=${optionValue}`),
    );
    await horizonSelect.selectOption(optionValue as string);
    await dated;

    // Toolbar peta tidak lagi menampilkan "Prediksi terbaru".
    await expect(page.locator(".map-toolbar strong")).not.toHaveText("Prediksi terbaru");

    await focusRegency(page);
    expect(await page.locator(".map-risk-badge").count()).toBeGreaterThan(0);
  });

  test("klik wilayah di peta menampilkan detail di sidebar", async ({ page }) => {
    await focusRegency(page);

    // force: marker maplibre di-reposisi tiap frame render sehingga tidak
    // pernah dianggap "stabil" oleh actionability check Playwright.
    await page.locator(".map-risk-badge").first().click({ force: true });

    await expect(page.getByText("Probabilitas")).toBeVisible();
    await expect(page.getByRole("link", { name: /Lapor Kejadian di Sini/ })).toBeVisible();
  });

  test("toggle layer Bahaya Rob menyembunyikan dan memunculkan badge risiko", async ({ page }) => {
    await focusRegency(page);
    await openLayerMenu(page);
    const layerToggle = page.locator('label:has-text("Bahaya Rob") input[type="checkbox"]');

    await layerToggle.uncheck();
    await expect(page.locator(".map-risk-badge")).toHaveCount(0);

    await layerToggle.check();
    await expect(page.locator(".map-risk-badge").first()).toBeVisible();
  });
});
