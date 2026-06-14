import assert from "node:assert/strict";
import { parseDatFiles } from "../src/dsl.js";
import { scenarioText, spotText } from "../src/exporter.js";

globalThis.crypto ??= { randomUUID: () => Math.random().toString(36) };

const scenario = `// このコメントは残す
scenario sc
{
\tname = テストシナリオ
\tworld = world01
\tpower = red, blue
\tspot = spot1, spot2;

\tshowSpot(spot1)
\tshowSpot(spot2)
\tlinkSpot(spot2, spot1)
\tlinkEscape(spot1, spot2, route_esc, 128)

\tevent = opening_event
\tif (flag) {
\t\tshowSpot(hidden_spot)
\t\tlinkSpot(hidden_spot, hidden_spot2)
\t}
}

story other_data
{
\ttext = 変更しない
}`;
const spots = `
spot spot1
{
\tname = 港町
\tx = 181
\ty = 81
\timage = spot
\tgain = 100
}

spot spot2 : base_spot
{
\tname = 城
\tx = 468
\ty = 88
\timage = castle
}`;

const loaded = parseDatFiles([
  { name: "my_scenario.dat", text: scenario },
  { name: "my_spot.dat", text: spots },
]);

assert.equal(loaded.project.scenarioId, "sc");
assert.match(loaded.project.scenarioExtra, /name = テストシナリオ/);
assert.match(loaded.project.scenarioExtra, /event = opening_event/);
assert.equal(loaded.project.spots.length, 2);
assert.equal(loaded.project.routes.length, 2);
assert.equal(loaded.project.spots[0].name, "港町");
assert.equal(loaded.project.spots[0].extra, "gain = 100");
assert.equal(loaded.project.spots[1].inherits, "base_spot");
assert.equal(loaded.project.routes[1].image, "route_esc");
assert.equal(loaded.project.routes[1].alpha, 128);
assert.equal(loaded.scenarioFilename, "my_scenario.dat");
assert.equal(loaded.spotFilename, "my_spot.dat");
assert.match(scenarioText(loaded.project), /linkSpot\(spot2, spot1\)/);
assert.match(scenarioText(loaded.project), /name = テストシナリオ/);
assert.match(scenarioText(loaded.project), /world = world01/);
assert.match(scenarioText(loaded.project), /power = red, blue/);
assert.match(scenarioText(loaded.project), /event = opening_event/);
assert.match(scenarioText(loaded.project), /story other_data/);
assert.match(scenarioText(loaded.project), /text = 変更しない/);
assert.match(scenarioText(loaded.project), /\/\/ このコメントは残す/);
assert.match(spotText(loaded.project), /gain = 100/);

loaded.project.spots.push({
  uid: "third",
  id: "spot3",
  name: "村",
  image: "spot",
  inherits: "",
  x: 300,
  y: 300,
  width: 32,
  height: 32,
  extra: "",
});
const changed = scenarioText(loaded.project);
assert.match(changed, /spot = spot1, spot2, spot3;/);
assert.match(changed, /showSpot\(spot3\)/);
assert.match(changed, /showSpot\(hidden_spot\)/);
assert.doesNotMatch(changed, /spot = spot1, spot2;/);

console.log("OK: scenario and spot DAT parsing");
