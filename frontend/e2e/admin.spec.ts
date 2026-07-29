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

/**
 * Aksi per baris kini berada di menu titik tiga, bukan tombol berjajar.
 * Panelnya di-render lewat portal ke <body>, jadi menuitem-nya TIDAK bisa
 * dicari dari dalam `tr` — dicari di level halaman.
 */
async function openRowMenu(page: Page, name: string) {
  await page.locator("tr", { hasText: name }).getByRole("button", { name: `Aksi untuk ${name}` }).click();
  return page.getByRole("menu");
}

async function runRowAction(page: Page, name: string, action: string) {
  const menu = await openRowMenu(page, name);
  await menu.getByRole("menuitem", { name: action }).click();
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

test("registrasi mandiri tak butuh approval admin, tapi wajib verifikasi email", async ({ page }) => {
  const email = `e2e-selfreg-${Date.now()}@example.test`;
  const register = await page.request.post("/api/auth/register", {
    data: { name: `E2E SelfReg ${Date.now()}`, email, password: "password123" },
  });
  expect(register.status()).toBe(201);

  const body = await register.json();
  // Tak ada antrean admin: statusnya langsung 'aktif'...
  expect(body.user.status).toBe("aktif");
  expect(body.user.role).toBe("warga");
  // ...tapi login tetap tertahan sampai kepemilikan email dibuktikan.
  expect(body.requires_email_verification).toBe(true);

  const login = await page.request.post("/api/auth/login", {
    data: { email, password: "password123" },
  });
  expect(login.status()).toBe(403);
  expect((await login.json()).requires_email_verification).toBe(true);
});

test("permohonan akun peneliti tertahan dan alasannya terbaca admin", async ({ page }) => {
  const purpose = "Penelitian skripsi pola banjir rob pesisir Bandar Lampung memakai laporan tervalidasi.";
  const name = `E2E Peneliti ${Date.now()}`;
  const email = `e2e-peneliti-${Date.now()}@example.test`;

  const register = await page.request.post("/api/auth/register", {
    data: {
      account_type: "peneliti",
      name,
      email,
      password: "password123",
      institution: "Universitas Lampung",
      research_purpose: purpose,
    },
  });
  expect(register.status()).toBe(201);
  const body = await register.json();
  // Beda dengan warga: peneliti BERHENTI di antrean admin.
  expect(body.user.role).toBe("peneliti");
  expect(body.user.status).toBe("menunggu");
  expect(body.requires_admin_approval).toBe(true);

  await loginAdminOnce(page);
  await page.goto("/#/admin");
  await page.reload();

  // Menu baris peneliti menunggu TIDAK memuat "Setujui" — admin harus membuka
  // permohonannya lebih dulu.
  const row = page.locator("tr", { hasText: name });
  await expect(row).toBeVisible();
  const menu = await openRowMenu(page, name);
  await expect(menu.getByRole("menuitem", { name: "Setujui" })).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "Tinjau Permohonan" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(purpose)).toBeVisible();
  await expect(dialog.getByText("Universitas Lampung")).toBeVisible();
  await expect(dialog.getByText("Email belum diverifikasi.")).toBeVisible();

  await dialog.getByRole("button", { name: "Setujui Akun Peneliti" }).click();
  await expect(row.getByText("Aktif", { exact: true })).toBeVisible();
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
  await runRowAction(page, approveName, "Setujui");
  await expect(approveRow.getByText("Aktif", { exact: true })).toBeVisible();

  // ── Reject: user menunggu -> ditolak (lewat modal konfirmasi) ───
  const rejectRow = page.locator("tr", { hasText: rejectName });
  await runRowAction(page, rejectName, "Tolak");
  await page.getByRole("dialog").getByRole("button", { name: "Ya, tolak akun" }).click();
  await expect(rejectRow.getByText("Ditolak", { exact: true })).toBeVisible();

  // ── Nonaktifkan: user aktif tadi -> nonaktif ────────────────────
  await runRowAction(page, approveName, "Nonaktifkan");
  await page.getByRole("dialog").getByRole("button", { name: "Ya, nonaktifkan" }).click();
  await expect(approveRow.getByText("Nonaktif", { exact: true })).toBeVisible();

  // User yang dinonaktifkan tidak bisa login lagi (403 + status akun).
  const blockedLogin = await page.request.post("/api/auth/login", {
    data: { email: approveEmail, password: "password123" },
  });
  expect(blockedLogin.status()).toBe(403);
  expect((await blockedLogin.json()).account_status).toBe("nonaktif");
});
