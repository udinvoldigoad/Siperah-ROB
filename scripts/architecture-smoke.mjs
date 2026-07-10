import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "README.md",
  "docs/architecture.md",
  "docs/mockup-awal.md",
  "database/schema.sql",
  "backend/composer.json",
  "backend/routes/api.php",
  "backend/app/Http/Middleware/EnsureRole.php",
  "frontend/package.json",
  "frontend/src/app/App.tsx",
  "frontend/src/shared/types/domain.ts",
  "frontend/src/shared/api/client.ts",
  "frontend/src/shared/styles/tokens.css"
];

for (const file of requiredFiles) {
  assert.ok(existsSync(file), `missing ${file}`);
}

const routes = readFileSync("backend/routes/api.php", "utf8");
for (const endpoint of [
  "/auth/login",
  "prefix('public')",
  "/predictions",
  "/reports/{report}/validate",
  "/dashboard/operator/summary",
  "/dashboard/province/summary",
  "/admin/users",
  "/research/datasets",
  "/notifications/settings"
]) {
  assert.ok(routes.includes(endpoint), `missing route ${endpoint}`);
}

const tsconfig = JSON.parse(readFileSync("frontend/tsconfig.json", "utf8"));
assert.equal(tsconfig.compilerOptions.moduleResolution, "Bundler");

const schema = readFileSync("database/schema.sql", "utf8");
for (const table of [
  "users",
  "regions",
  "predictions",
  "ground_truth_reports",
  "report_photos",
  "datasets",
  "api_keys",
  "notification_settings",
  "audit_logs"
]) {
  assert.match(schema, new RegExp(`create table ${table}`), `missing table ${table}`);
}

assert.match(schema, /create extension if not exists postgis/);
const bannedDashes = new RegExp("[\\u2014\\u2013]");
assert.doesNotMatch(readFileSync("frontend/src/app/App.tsx", "utf8"), bannedDashes);

console.log("architecture ok");