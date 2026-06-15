import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("shared VT layout and terminology are applied", () => {
  assert.match(css, /\.app-header\s*\{[\s\S]*?height:\s*56px;/);
  assert.match(css, /\.panel-section\s*\{\s*padding:\s*13px;/);
  assert.match(css, /\.panel-section h2\s*\{[\s\S]*?font-size:\s*10px;/);
  assert.match(css, /dialog\s*\{[\s\S]*?padding:\s*20px;[\s\S]*?border-radius:\s*11px;/);
  assert.match(css, /--success:\s*#80c995;/);
  assert.match(html, /id="load-dat-files"[^>]*>開く</);
  assert.match(app, /document\.title = "VT SpotMaker";/);
  assert.doesNotMatch(app, /document\.title\s*=\s*`[^`]*●/);
  assert.match(css, /\.app-brand-icon\s*\{[^}]*width:\s*28px;/);
  assert.match(html, /class="app-brand"[\s\S]*?src="\.\/icons\/icon\.svg"/);
});
