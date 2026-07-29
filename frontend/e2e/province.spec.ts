import { expect, test } from "@playwright/test";
import { SEED_USERS, loginViaApi } from "./helpers";

// P2 6.2: pantauan provinsi — ringkasan termuat dan export CSV terunduh.
//
// Halaman ini sempat kehilangan rutenya saat peran disederhanakan 5 -> 3
// (peran bpbd_provinsi dihapus), lalu dikembalikan sebagai menu ADMIN.
// Endpoint-nya memang sudah `role:admin` sejak penyederhanaan itu.
// Akun seed `provinsi@` kini berperan admin — dipakai di sini supaya limiter
// login (10/menit per email+IP) tidak tertabrak spec lain.
test("admin melihat pantauan provinsi lalu mengekspor CSV", async ({ page }) => {
  const summaryResponse = page.waitForResponse((response) =>
    response.url().includes("/api/dashboard/province/summary"),
  );
  await loginViaApi(page, SEED_USERS.provinsi, "#/province");
  expect((await summaryResponse).status()).toBe(200);

  await expect(page.getByText("Pantauan Provinsi Lampung").first()).toBeVisible();

  // Menunya harus benar-benar ada di navigasi, bukan hanya rutenya bisa
  // dibuka manual — itu yang hilang saat halaman ini "menghilang".
  await expect(page.getByRole("link", { name: "Pantauan Provinsi" }).first()).toBeVisible();

  const exportButton = page.getByRole("button", { name: /Ekspor CSV Data Utama/ });
  await expect(exportButton).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
});
