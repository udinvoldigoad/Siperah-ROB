import { execSync } from "node:child_process";
import path from "node:path";

// Reset DB test (siperah_rob_test) ke state seed sebelum seluruh suite jalan,
// supaya E2E deterministik: tidak ada laporan/user sisa run sebelumnya dan
// deteksi duplikat laporan tidak menolak submit ulang.
export default function globalSetup(): void {
  execSync("php artisan migrate:fresh --seed --env=testing --force", {
    cwd: path.resolve(process.cwd(), "../backend"),
    stdio: "inherit",
  });
}
