import { expect, test, type Page } from "@playwright/test";
import { SEED_USERS, loginViaApi } from "./helpers";

// P2 6.2: admin menyetujui, menolak, dan menonaktifkan user. Semua target
// aksi adalah user BARU hasil registrasi (bukan user seed) supaya spec lain
// dalam run yang sama tidak terganggu.
async function registerPendingUser(page: Page, label: string): Promise<{ name: string; email: string }> {
  const name = `E2E ${label} ${Date.now()}`;
  const email = `e2e-${label.toLowerCase()}-${Date.now()}@example.test`;
  const response = await page.request.post("/api/auth/register", {
    data: { name, email, password: "password123" },
  });
  expect(response.status(), `registrasi user ${label} harus 201`).toBe(201);
  return { name, email };
}

test("admin approve, reject, dan nonaktifkan user", async ({ page }) => {
  const { name: approveName, email: approveEmail } = await registerPendingUser(page, "Approve");
  const { name: rejectName } = await registerPendingUser(page, "Reject");

  await loginViaApi(page, SEED_USERS.admin, "#/admin");

  // ── Approve: user menunggu -> aktif ─────────────────────────────
  const approveRow = page.locator("tr", { hasText: approveName });
  await expect(approveRow).toBeVisible();
  await approveRow.getByRole("button", { name: "Setujui" }).click();
  await expect(approveRow.getByText("aktif", { exact: true })).toBeVisible();

  // ── Reject: user menunggu -> ditolak (lewat modal konfirmasi) ───
  const rejectRow = page.locator("tr", { hasText: rejectName });
  await rejectRow.getByRole("button", { name: "Tolak" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ya, tolak akun" }).click();
  await expect(rejectRow.getByText("ditolak", { exact: true })).toBeVisible();

  // ── Nonaktifkan: user aktif tadi -> nonaktif ────────────────────
  await approveRow.getByRole("button", { name: "Nonaktifkan" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ya, nonaktifkan" }).click();
  await expect(approveRow.getByText("nonaktif", { exact: true })).toBeVisible();

  // User yang dinonaktifkan tidak bisa login lagi (403 + status akun).
  const blockedLogin = await page.request.post("/api/auth/login", {
    data: { email: approveEmail, password: "password123" },
  });
  expect(blockedLogin.status()).toBe(403);
  expect((await blockedLogin.json()).account_status).toBe("nonaktif");
});
