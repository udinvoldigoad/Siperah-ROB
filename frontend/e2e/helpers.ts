import { expect, type Page } from "@playwright/test";

// Kredensial user seed DatabaseSeeder::seedUsers (DB test di-reset global-setup).
export const SEED_PASSWORD = "password";
// Satu akun per peran yang benar-benar ada sejak penyederhanaan 5â†’3, plus
// `admin2`. `admin2` BUKAN peran lain â€” ia hanya email admin kedua, supaya
// limiter login (10 percobaan/menit per email + IP) tidak tertabrak ketika
// beberapa spec dalam satu run sama-sama butuh sesi admin.
export const SEED_USERS = {
  warga: "warga@saibar.local",
  peneliti: "peneliti@saibar.local",
  admin: "admin@saibar.local",
  admin2: "demo@saibar.local",
} as const;

export async function loginViaUi(page: Page, email: string): Promise<void> {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(SEED_PASSWORD);
  // exact: true wajib â€” tanpa itu "Masuk" juga cocok dengan "Masuk dengan
  // Google" dan tombol "Masuk ke Dashboard" di form register.
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

/**
 * Login cepat tanpa UI untuk spec non-login: ambil token via API (lewat proxy
 * vite yang sama dengan aplikasi), suntik sebagai cookie sesi httpOnly (nama
 * sama dengan yang dipasang server saat login), set cache pengguna, lalu buka
 * rute tujuan. Alur login-nya sendiri diuji terpisah di login.spec.ts.
 */
export async function loginViaApi(page: Page, email: string, targetHash: string): Promise<void> {
  const response = await page.request.post("/api/auth/login", {
    data: { email, password: SEED_PASSWORD },
  });
  expect(response.ok(), `Login API untuk ${email} harus 200`).toBeTruthy();
  const body = await response.json();

  await page.goto("/#/login");
  await page.context().addCookies([
    {
      name: "saibar_session",
      value: body.access_token as string,
      url: new URL(page.url()).origin,
    },
  ]);
  await page.evaluate((user) => {
    localStorage.setItem("saibar-user", user);
  }, JSON.stringify(body.user));
  await page.goto(`/${targetHash}`);
  await page.reload();
}

/** PNG 1x1 piksel untuk lampiran foto laporan (dikompres jadi WebP oleh wizard). */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

