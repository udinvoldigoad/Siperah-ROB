import { defineConfig } from "@playwright/test";

// E2E smoke test per role (checklist Tahap 6.2).
//
// Kedua server dijalankan otomatis di port khusus E2E (bukan 8000/5173) agar
// tidak pernah menyasar server dev yang menghadap DB dev: backend artisan serve
// --env=testing membaca .env.testing -> DB siperah_rob_test, vite dev di 5273
// dengan proxy /api ke backend E2E. globalSetup me-reset DB test (migrate:fresh
// --seed) sehingga tiap run mulai dari state seed yang sama.
export const E2E_BACKEND_PORT = 8123;
export const E2E_FRONTEND_PORT = 5273;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // DB dipakai bersama oleh semua spec (operator memvalidasi laporan warga),
  // jadi jalankan serial agar deterministik.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup",
  use: {
    baseURL: `http://localhost:${E2E_FRONTEND_PORT}`,
    trace: "retain-on-failure",
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
  },
  webServer: [
    {
      command: `php artisan serve --env=testing --port=${E2E_BACKEND_PORT}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${E2E_BACKEND_PORT}/up`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npm run dev -- --port ${E2E_FRONTEND_PORT} --strictPort`,
      cwd: ".",
      url: `http://localhost:${E2E_FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_PROXY_TARGET: `http://127.0.0.1:${E2E_BACKEND_PORT}` },
    },
  ],
});
