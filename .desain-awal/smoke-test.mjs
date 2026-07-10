import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const js = readFileSync("app.js", "utf8");
const css = readFileSync("styles.css", "utf8");

assert.match(html, /<div id="app"><\/div>/);
assert.match(css, /\.app-shell/);

for (const route of [
  "portal",
  "login",
  "map",
  "community",
  "awam",
  "report",
  "onboarding",
  "operator",
  "province",
  "notifications",
  "admin",
  "audit",
  "research"
]) {
  assert.match(js, new RegExp(`${route}:`));
}

const bannedDashes = /[\u2014\u2013]/;
assert.doesNotMatch(js, bannedDashes);
assert.doesNotMatch(html, bannedDashes);
assert.doesNotMatch(css, bannedDashes);

console.log("smoke ok");
