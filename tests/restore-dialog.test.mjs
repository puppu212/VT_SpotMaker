import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("restore dialog uses the shared wording and behavior", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const css = await readFile(new URL("styles.css", root), "utf8");
  const app = await readFile(new URL("src/app.js", root), "utf8");
  const dialog = html.match(/<dialog id="autosave-dialog"[\s\S]*?<\/dialog>/)?.[0] ?? "";

  assert.match(dialog, /前回の作業を復元しますか？/);
  assert.match(dialog, /このブラウザに自動保存された作業があります。/);
  assert.match(dialog, /破棄して開始/);
  assert.match(dialog, /復元する/);
  assert.ok(dialog.indexOf("破棄して開始") < dialog.indexOf("復元する"));
  assert.match(css, /\.autosave-dialog\s*\{\s*width:\s*min\(440px/);
  assert.match(app, /`自動保存: \$\{formatAutosaveDate\(savedAt\)\}`/);
  assert.match(app, /event\.key !== "Enter"/);
  assert.match(app, /oncancel = event => event\.preventDefault\(\)/);
});
