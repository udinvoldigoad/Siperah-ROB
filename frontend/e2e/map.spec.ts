import { expect, test } from "@playwright/test";

// P2 6.2: peta publik — filter kabupaten, horizon prediksi, klik wilayah
// (badge risiko di peta), dan toggle layer. Halaman publik, tanpa login.
test.describe("peta publik", () => {
  test.beforeEach(async ({ page }) => {
    const mapResponse = page.waitForResponse((response) => response.url().includes("/api/public/map"));
    await page.goto("/#/map");
    await mapResponse;
    await expect(page.locator(".map-risk-badge").first()).toBeVisible();
  });

  test("filter kabupaten menyaring wilayah di peta dan sidebar", async ({ page }) => {
    const filtered = page.waitForResponse((response) =>
      response.url().includes("/api/public/map") && response.url().includes("regency="),
    );
    await page
      .locator('label:has-text("Kabupaten/Kota") select')
      .selectOption("Kota Bandar Lampung");
    await filtered;

    // Sidebar "Wilayah terpilih" otomatis menampilkan wilayah dari kabupaten terpilih.
    await expect(page.getByText("Wilayah terpilih")).toBeVisible();
    await expect(page.getByText("Kota Bandar Lampung").first()).toBeVisible();
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
    expect(await page.locator(".map-risk-badge").count()).toBeGreaterThan(0);
  });

  test("klik wilayah di peta menampilkan detail di sidebar", async ({ page }) => {
    // force: marker maplibre di-reposisi tiap frame render sehingga tidak
    // pernah dianggap "stabil" oleh actionability check Playwright.
    await page.locator(".map-risk-badge").first().click({ force: true });

    await expect(page.getByText("Probabilitas")).toBeVisible();
    await expect(page.getByRole("link", { name: /Lapor Kejadian di Sini/ })).toBeVisible();
  });

  test("toggle layer Bahaya Rob menyembunyikan dan memunculkan badge risiko", async ({ page }) => {
    const layerToggle = page.locator('label:has-text("Bahaya Rob") input[type="checkbox"]');

    await layerToggle.uncheck();
    await expect(page.locator(".map-risk-badge")).toHaveCount(0);

    await layerToggle.check();
    await expect(page.locator(".map-risk-badge").first()).toBeVisible();
  });
});
