import { addRoute, createProject } from "./model.js";
import { findScenarioBlock } from "./scenario-source.js";

export function parseDatFiles(files) {
  const project = createProject();
  let scenarioFilename = "scenario.dat";
  let spotFilename = "spot.dat";
  const warnings = [];

  for (const file of files) {
    if (/\bscenario\s+[^{]+\{/i.test(file.text)) {
      parseScenario(project, file.text, warnings);
      scenarioFilename = ensureDatExtension(file.name);
    }
  }
  for (const file of files) {
    if (/^\s*spot\s+(?![=])[\w\u0080-\uFFFF]+/im.test(file.text)) {
      parseSpots(project, file.text, warnings);
      spotFilename = ensureDatExtension(file.name);
    }
  }

  resolveRoutes(project, warnings);
  if (!project.spots.length) {
    throw new Error("スポット構造体を読み取れませんでした");
  }
  return { project, scenarioFilename, spotFilename, warnings };
}

export function decodeDat(buffer) {
  const bytes = new Uint8Array(buffer);
  if (hasUtf8Bom(bytes)) return new TextDecoder("utf-8").decode(bytes);
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  try {
    return utf8.decode(bytes);
  } catch {
    return new TextDecoder("shift_jis").decode(bytes);
  }
}

function parseScenario(project, text, warnings) {
  const scenario = findScenarioBlock(text);
  if (!scenario) {
    warnings.push("シナリオ構造体を完全には読み取れませんでした");
    return;
  }
  const body = text.slice(scenario.bodyStart, scenario.bodyEnd);
  project.scenarioId = scenario.id.trim();
  project.scenarioSource = text;
  project.scenarioExtra = extractScenarioExtra(body);
  project.pendingRoutes = [];
  const routePattern = /\b(linkSpot|linkEscape)\s*\(\s*([^,\s)]+)\s*,\s*([^,\s)]+)(?:\s*,\s*([^,\s)]+))?(?:\s*,\s*(\d+))?\s*\)/i;
  for (const line of topLevelLines(body)) {
    const match = routePattern.exec(line);
    if (!match) continue;
    let image = "";
    let alpha = 255;
    if (match[4]) {
      if (/^\d+$/.test(match[4]) && !match[5]) alpha = Number(match[4]);
      else image = match[4];
    }
    if (match[5]) alpha = Number(match[5]);
    project.pendingRoutes.push({
      fromId: match[2],
      toId: match[3],
      type: match[1].toLowerCase() === "linkescape" ? "escape" : "link",
      image,
      alpha,
    });
  }
}

function topLevelLines(body) {
  const result = [];
  let depth = 0;
  for (const line of body.replace(/\r/g, "").split("\n")) {
    if (depth === 0) result.push(line);
    depth += braceDelta(line);
  }
  return result;
}

function extractScenarioExtra(body) {
  const lines = body.replace(/\r/g, "").split("\n");
  const extra = [];
  let skippingSpotList = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (skippingSpotList) {
      if (line.includes(";")) skippingSpotList = false;
      continue;
    }
    if (/^spot\s*=/.test(line)) {
      skippingSpotList = !line.includes(";");
      continue;
    }
    if (/^(showSpot|linkSpot|linkEscape)\s*\(/.test(line)) continue;
    extra.push(rawLine);
  }
  return trimBlankLines(extra).join("\n");
}

function parseSpots(project, text, warnings) {
  const pattern = /^\s*spot\s+([^\s:{]+)\s*(?::\s*([^{\r\n]+))?\s*\{([\s\S]*?)^\s*\}/gim;
  for (const match of text.matchAll(pattern)) {
    const fields = parseAssignments(match[3]);
    const id = match[1].trim();
    project.spots.push({
      uid: crypto.randomUUID(),
      id,
      name: fields.name ?? id,
      image: fields.image ?? "spot",
      inherits: match[2]?.trim() ?? "",
      x: numberValue(fields.x, -1),
      y: numberValue(fields.y, -1),
      width: numberValue(fields.w, 32),
      height: numberValue(fields.h, 32),
      extra: fields.extra.join("\n"),
    });
  }
  if (!project.spots.length) warnings.push("スポット構造体が見つかりませんでした");
}

function parseAssignments(body) {
  const known = new Set(["name", "image", "x", "y", "w", "h"]);
  const result = { extra: [] };
  for (const rawLine of body.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([^=]+?)\s*=\s*(.*)$/);
    if (!match) {
      result.extra.push(line);
      continue;
    }
    const key = match[1].trim();
    const value = match[2].trim();
    if (known.has(key)) result[key] = value;
    else result.extra.push(`${key} = ${value}`);
  }
  return result;
}

function resolveRoutes(project, warnings) {
  const byId = new Map(project.spots.map(spot => [spot.id, spot.uid]));
  for (const route of project.pendingRoutes ?? []) {
    const from = byId.get(route.fromId);
    const to = byId.get(route.toId);
    if (!from || !to) {
      warnings.push(`${route.fromId} と ${route.toId} の連絡を復元できませんでした`);
      continue;
    }
    if (addRoute(project, from, to, route.type)) {
      const added = project.routes.at(-1);
      added.image = route.image;
      added.alpha = route.alpha;
    }
  }
  delete project.pendingRoutes;
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hasUtf8Bom(bytes) {
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function ensureDatExtension(filename) {
  return /\.dat$/i.test(filename) ? filename : filename.replace(/\.[^.]*$/, "") + ".dat";
}

function trimBlankLines(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start++;
  while (end > start && !lines[end - 1].trim()) end--;
  return lines.slice(start, end);
}

function braceDelta(line) {
  let delta = 0;
  let quote = "";
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (!quote && char === "/" && line[index + 1] === "/") break;
    if (char === '"' || char === "'") {
      if (line[index - 1] !== "\\") quote = quote === char ? "" : quote || char;
      continue;
    }
    if (quote) continue;
    if (char === "{") delta++;
    if (char === "}") delta--;
  }
  return delta;
}
