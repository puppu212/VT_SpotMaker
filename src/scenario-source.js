export function findScenarioBlock(source) {
  const match = /\bscenario\s+([^\s{]+)\s*\{/i.exec(source);
  if (!match) return null;
  const openBrace = match.index + match[0].lastIndexOf("{");
  let depth = 0;
  for (let index = openBrace; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] !== "}") continue;
    depth--;
    if (depth === 0) {
      const idOffset = match[0].indexOf(match[1]);
      return {
        id: match[1],
        idStart: match.index + idOffset,
        idEnd: match.index + idOffset + match[1].length,
        bodyStart: openBrace + 1,
        bodyEnd: index,
      };
    }
  }
  return null;
}

export function replaceManagedScenarioData(source, project, routeLines) {
  const normalized = source.replace(/\r\n?/g, "\n");
  const block = findScenarioBlock(normalized);
  if (!block) return null;

  const body = normalized.slice(block.bodyStart, block.bodyEnd);
  const lines = body.split("\n");
  const removed = new Set();
  let firstManaged = -1;
  let spotList = false;
  let indent = "\t";
  let depth = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (spotList) {
      removed.add(index);
      if (line.includes(";")) spotList = false;
      continue;
    }
    if (depth === 0 && /^\s*spot\s*=/.test(line)) {
      firstManaged = firstManaged < 0 ? index : firstManaged;
      indent = line.match(/^\s*/)?.[0] || indent;
      removed.add(index);
      spotList = !line.includes(";");
      continue;
    }
    if (depth === 0 && /^\s*(showSpot|linkSpot|linkEscape)\s*\([^)]*\)\s*$/.test(line)) {
      firstManaged = firstManaged < 0 ? index : firstManaged;
      indent = line.match(/^\s*/)?.[0] || indent;
      removed.add(index);
    }
    depth += braceDelta(line);
  }

  const managed = managedLines(project, routeLines, indent);
  const anchor = firstManaged < 0 ? Math.max(0, lines.length - 1) : firstManaged;
  const output = [];
  for (let index = 0; index < lines.length; index++) {
    if (index === anchor) output.push(...managed);
    if (!removed.has(index)) output.push(lines[index]);
  }
  if (anchor >= lines.length) output.push(...managed);

  const id = cleanIdentifier(project.scenarioId) || block.id;
  const withId = normalized.slice(0, block.idStart) + id + normalized.slice(block.idEnd);
  const idDelta = id.length - (block.idEnd - block.idStart);
  const adjustedBodyStart = block.bodyStart + idDelta;
  const adjustedBodyEnd = block.bodyEnd + idDelta;
  return withWindowsLines(
    withId.slice(0, adjustedBodyStart) +
    output.join("\n") +
    withId.slice(adjustedBodyEnd)
  );
}

function managedLines(project, routeLines, indent) {
  const ids = project.spots.map(spot => cleanIdentifier(spot.id)).filter(Boolean);
  const lines = [`${indent}spot = ${ids.join(", ")};`, ""];
  for (const id of ids) lines.push(`${indent}showSpot(${id})`);
  if (ids.length && routeLines.length) lines.push("");
  for (const route of routeLines) lines.push(`${indent}${route}`);
  return lines;
}

function cleanIdentifier(value) {
  return String(value ?? "").trim().replace(/[^\w\u0080-\uFFFF]/g, "_");
}

function withWindowsLines(text) {
  return text.replace(/\r?\n/g, "\r\n");
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
