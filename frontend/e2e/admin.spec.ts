import { expect, test, type Page } from "@playwright/test";
import { SEED_PASSWORD, SEED_USERS } from "./helpers";

// P2 6.2: admin menyetujui, menolak, dan menonaktifkan user. Semua target aksi
// adalah user BARU (bukan user seed) supaya spec lain dalam run yang sama tidak
// terganggu.
//
// Sejak pendaftaran mandiri langsung aktif, akun berstatus "menunggu" hanya
// lahir dari admin yang SENGAJA membuatnya begitu — jadi fixture-nya dibuat
// lewat POST /admin/users, bukan lewat /auth/register seperti dulu.
/**
 * Login admin SATU KALI lalu pakai tokennya untuk dua hal: memanggil API
 * fixture dan menyuntik sesi ke browser. Limiter login dibatasi 10/menit per
 * (email + IP) dan dipakai bersama seluruh spec dalam satu run — login admin
 * kedua di file ini pernah membuat login.spec ikut kena 429.
 */
async function loginAdminOnce(page: Page): Promise<string> {
  const response = await page.request.post("/api/auth/login", {
    data: { email: SEED_USERS.admin, password: SEED_PASSWORD },
  });
  expect(response.ok(), "login admin harus 200").toBeTruthy();
  const body = await response.json();

  await page.goto("/#/login");
  await page.evaluate(
    ([token, user]) => {
      localStorage.setItem("siperah-token", token);
      localStorage.setItem("siperah-user", user);
    },
    [body.access_token as string, JSON.stringify(body.user)],
  );

  return body.access_token as string;
}

async function createPendingUser(page: Page, token: string, label: string): Promise<{ name: string; email: string }> {
  const name = `E2E ${label} ${Date.now()}`;
  const email = `e2e-${label.toLowerCase()}-${Date.now()}@example.test`;
  const response = await page.request.post("/api/admin/users", {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, email, password: "password123", role: "warga", status: "menunggu" },
  });
  expect(response.status(), `pembuatan user ${label} oleh admin harus 201`).toBe(201);
  return { name, email };
}

test("registrasi mandiri langsung aktif dan bisa login tanpa approval", async ({ page }) => {
  const email = `e2e-selfreg-${Date.now()}@example.test`;
  const register = await page.request.post("/api/auth/register", {
    data: { name: `E2E SelfReg ${Date.now()}`, email, password: "password123" },
  });
  expect(register.status()).toBe(201);
  expect((await register.json()).user.status).toBe("aktif");

  const login = await page.request.post("/api/auth/login", {
    data: { email, password: "password123" },
  });
  expect(login.status(), "akun hasil registrasi harus langsung bisa login").toBe(200);
  expect((await login.json()).user.role).toBe("warga");
});

test("admin approve, reject, dan nonaktifkan user", async ({ page }) => {
  const token = await loginAdminOnce(page);
  const { name: approveName, email: approveEmail } = await createPendingUser(page, token, "Approve");
  const { name: rejectName } = await createPendingUser(page, token, "Reject");

  await page.goto("/#/admin");
  await page.reload();

  // ── Approve: user menunggu -> aktif ─────────────────────────────
  // Badge memakai label berkapitalisasi dari shared/constants/userStatus.ts
  // (dulu menampilkan enum mentah huruf kecil).
  const approveRow = page.locator("tr", { hasText: approveName });
  await expect(approveRow).toBeVisible();
  await approveRow.getByRole("button", { name: "Setujui" }).click();
  await expect(approveRow.getByText("Aktif", { exact: true })).toBeVisible();

  // ── Reject: user menunggu -> ditolak (lewat modal konfirmasi) ───
  const rejectRow = page.locator("tr", { hasText: rejectName });
  await rejectRow.getByRole("button", { name: "Tolak" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ya, tolak akun" }).click();
  await expect(rejectRow.getByText("Ditolak", { exact: true })).toBeVisible();

  // ── Nonaktifkan: user aktif tadi -> nonaktif ────────────────────
  await approveRow.getByRole("button", { name: "Nonaktifkan" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ya, nonaktifkan" }).click();
  await expect(approveRow.getByText("Nonaktif", { exact: true })).toBeVisible();

  // User yang dinonaktifkan tidak bisa login lagi (403 + status akun).
  const blockedLogin = await page.request.post("/api/auth/login", {
    data: { email: approveEmail, password: "password123" },
  });
  expect(blockedLogin.status()).toBe(403);
  expect((await blockedLogin.json()).account_status).toBe("nonaktif");
});
