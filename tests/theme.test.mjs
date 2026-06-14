import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared VT color theme is applied", async () => {
  const root = new URL("../", import.meta.url);
  const css = await readFile(new URL("styles.css", root), "utf8");
  const manifest = JSON.parse(await readFile(new URL("manifest.webmanifest", root), "utf8"));
  const expected = {
    bg: "#101319",
    panel: "#171b22",
    "panel-2": "#1d222b",
    line: "#2c3440",
    text: "#e8edf4",
    muted: "#929eae",
    accent: "#ef9f43",
    "accent-2": "#ffc46f",
    danger: "#e26969",
  };

  for (const [name, value] of Object.entries(expected)) {
    assert.match(css, new RegExp(`--${name}:\\s*${value}`));
  }
  assert.match(css, /\.button\.primary[^}]*background:\s*var\(--accent\)/s);
  assert.match(css, /background:\s*var\(--selected-bg\)/);
  assert.equal(manifest.background_color, expected.bg);
  assert.equal(manifest.theme_color, expected.panel);
});
