import { expect, type Page } from "@playwright/test";

// Kredensial user seed DemoUserSeeder (DB test di-reset global-setup).
export const SEED_PASSWORD = "password";
export const SEED_USERS = {
  warga: "warga@siperah.local",
  operator: "operator@siperah.local",
  provinsi: "provinsi@siperah.local",
  peneliti: "peneliti@siperah.local",
  admin: "admin@siperah.local",
} as const;

export async function loginViaUi(page: Page, email: string): Promise<void> {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();
}

/**
 * Login cepat tanpa UI untuk spec non-login: ambil token via API (lewat proxy
 * vite yang sama dengan aplikasi), suntik ke localStorage, lalu buka rute
 * tujuan. Alur login-nya sendiri diuji terpisah di login.spec.ts.
 */
export async function loginViaApi(page: Page, email: string, targetHash: string): Promise<void> {
  const response = await page.request.post("/api/auth/login", {
    data: { email, password: SEED_PASSWORD },
  });
  expect(response.ok(), `Login API untuk ${email} harus 200`).toBeTruthy();
  const body = await response.json();

  await page.goto("/#/login");
  await page.evaluate(
    ([token, user]) => {
      localStorage.setItem("siperah-token", token);
      localStorage.setItem("siperah-user", user);
    },
    [body.access_token as string, JSON.stringify(body.user)],
  );
  await page.goto(`/${targetHash}`);
  await page.reload();
}

/** PNG 1x1 piksel untuk lampiran foto laporan (dikompres jadi WebP oleh wizard). */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
