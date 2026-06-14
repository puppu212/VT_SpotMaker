import { replaceManagedScenarioData } from "./scenario-source.js";

export function scenarioText(project) {
  const routes = project.routes.map(route => routeFunction(project, route)).filter(Boolean);
  if (project.scenarioSource) {
    const replaced = replaceManagedScenarioData(project.scenarioSource, project, routes);
    if (replaced) return replaced;
  }
  const id = cleanIdentifier(project.scenarioId) || "sc";
  const spotIds = project.spots.map(spot => cleanIdentifier(spot.id)).filter(Boolean);
  const lines = [
    `scenario ${id}`,
    "{",
  ];
  const extra = project.scenarioExtra?.trim();
  if (extra) lines.push(...extra.split(/\r?\n/), "");
  lines.push(`\tspot = ${spotIds.join(", ")};`, "");
  for (const spotId of spotIds) lines.push(`\tshowSpot(${spotId})`);
  if (spotIds.length && project.routes.length) lines.push("");
  for (const route of routes) lines.push(`\t${route}`);
  lines.push("", "}", "");
  return withWindowsLines(lines.join("\n"));
}

export function spotText(project) {
  const text = project.spots.map(spot => {
    const id = cleanIdentifier(spot.id) || "spot";
    const declaration = `spot ${id}${spot.inherits.trim() ? ` : ${spot.inherits.trim()}` : ""}`;
    const lines = [declaration];
    lines.push("{");
    if (spot.name.trim()) lines.push(`\tname = ${spot.name.trim()}`);
    lines.push(`\tx = ${Math.round(spot.x)}`);
    lines.push(`\ty = ${Math.round(spot.y)}`);
    if (Number(spot.width) !== 32) lines.push(`\tw = ${Math.max(1, Math.round(spot.width))}`);
    if (Number(spot.height) !== 32) lines.push(`\th = ${Math.max(1, Math.round(spot.height))}`);
    if (spot.image.trim()) lines.push(`\timage = ${spot.image.trim()}`);
    const extra = spot.extra.trim();
    if (extra) lines.push("", ...extra.split(/\r?\n/).map(line => `\t${line}`));
    lines.push("}", "");
    return lines.join("\n");
  }).join("\n");
  return withWindowsLines(text ? `\n${text}` : "");
}

function routeFunction(project, route) {
  const ids = new Map(project.spots.map(spot => [spot.uid, cleanIdentifier(spot.id)]));
  const from = ids.get(route.from);
  const to = ids.get(route.to);
  if (!from || !to) return "";
  const fn = route.type === "escape" ? "linkEscape" : "linkSpot";
  const args = [from, to];
  if (route.image?.trim()) args.push(route.image.trim());
  if (Number(route.alpha) !== 255) {
    if (args.length === 2) args.push(String(Math.max(0, Math.min(255, Number(route.alpha)))));
    else args.push(String(Math.max(0, Math.min(255, Number(route.alpha)))));
  }
  return `${fn}(${args.join(", ")})`;
}

function cleanIdentifier(value) {
  return String(value ?? "").trim().replace(/[^\w\u0080-\uFFFF]/g, "_");
}

function withWindowsLines(text) {
  return text.replace(/\r?\n/g, "\r\n");
}
