import { expect, test } from "@playwright/test";
import { SEED_USERS, loginViaApi } from "./helpers";

// P2 6.2: dashboard BPBD provinsi — ringkasan termuat dan export CSV terunduh.
test("provinsi melihat ringkasan lalu mengekspor CSV", async ({ page }) => {
  const summaryResponse = page.waitForResponse((response) =>
    response.url().includes("/api/dashboard/province/summary"),
  );
  await loginViaApi(page, SEED_USERS.provinsi, "#/province");
  expect((await summaryResponse).status()).toBe(200);

  await expect(page.getByText("Dashboard BPBD Provinsi Lampung").first()).toBeVisible();
  const exportButton = page.getByRole("button", { name: /Ekspor CSV Data Utama/ });
  await expect(exportButton).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
});
