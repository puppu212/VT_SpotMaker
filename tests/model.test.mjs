import assert from "node:assert/strict";
import { addRoute, createProject, distanceToSegment, removeSpot } from "../src/model.js";
import { scenarioText, spotText } from "../src/exporter.js";

globalThis.crypto ??= { randomUUID: () => Math.random().toString(36) };

const project = createProject();
project.scenarioId = "sc1";
project.spots.push(
  { uid: "a", id: "s1", name: "港町", image: "town", inherits: "", x: 100, y: 200, width: 32, height: 32, extra: "gain = 100" },
  { uid: "b", id: "s2", name: "城", image: "castle", inherits: "base_spot", x: 300, y: 240, width: 40, height: 48, extra: "" },
);

assert.equal(addRoute(project, "a", "b", "link"), true);
assert.equal(addRoute(project, "b", "a", "link"), false);
assert.equal(addRoute(project, "a", "b", "escape"), true);
assert.match(scenarioText(project), /spot = s1, s2;/);
assert.match(scenarioText(project), /showSpot\(s1\)/);
assert.match(scenarioText(project), /showSpot\(s2\)/);
assert.match(scenarioText(project), /linkSpot\(s1, s2\)/);
assert.match(scenarioText(project), /linkEscape\(s1, s2\)/);
assert.match(spotText(project), /spot s1/);
assert.match(spotText(project), /name = 港町/);
assert.ok(spotText(project).indexOf("\tx = 100") < spotText(project).indexOf("\timage = town"));
assert.match(spotText(project), /gain = 100/);
assert.match(spotText(project), /spot s2 : base_spot/);
assert.match(spotText(project), /\tw = 40/);

assert.equal(removeSpot(project, "a"), true);
assert.equal(project.routes.length, 0);
assert.match(scenarioText(project), /\r\n/);
assert.equal(distanceToSegment({ x: 5, y: 2 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 2);
assert.equal(distanceToSegment({ x: 12, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 2);

console.log("OK: spot model, routes, and DAT export");
