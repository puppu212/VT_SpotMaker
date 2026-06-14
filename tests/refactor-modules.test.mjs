import assert from "node:assert/strict";
import { createAutosaveManager } from "../src/autosave-manager.js";
import { dataUrlToBlob } from "../src/media.js";
import { createMaterialStore, MATERIAL_TYPES } from "../src/materials.js";
import { renderMap } from "../src/map-renderer.js";

const saved = [];
const errors = [];
let value = 1;
const autosave = createAutosaveManager({
  capture: () => ({ value }),
  save: async state => saved.push(state),
  onError: error => errors.push(error),
  delay: 5,
});

autosave.schedule();
assert.equal(saved.length, 0);
autosave.enable();
autosave.schedule();
value = 2;
await new Promise(resolve => setTimeout(resolve, 15));
assert.deepEqual(saved, [{ value: 2 }]);
assert.equal(errors.length, 0);

const blob = dataUrlToBlob("data:text/plain;base64,SGVsbG8=");
assert.equal(blob.type, "text/plain");
assert.equal(await blob.text(), "Hello");
assert.equal(dataUrlToBlob("./image.png"), null);

const defaults = {
  spot: "./spot.png",
  route: "./route.png",
  escape: "./escape.png",
};
const materials = createMaterialStore(defaults);
assert.deepEqual(MATERIAL_TYPES, ["spot", "route", "escape"]);
assert.equal(materials.url("spot"), "./spot.png");
assert.equal(materials.name("route"), "標準画像");
assert.equal(materials.snapshot().escape.url, "./escape.png");
assert.throws(() => materials.url("unknown"), /不明な素材種別/);

const calls = [];
const ctx = new Proxy({}, {
  get(target, property) {
    if (!(property in target)) target[property] = (...args) => calls.push([property, ...args]);
    return target[property];
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  },
});
const routeImage = { type: "route" };
const spotImage = { type: "spot" };
renderMap({
  ctx,
  canvas: { width: 320, height: 240 },
  project: {
    spots: [
      { uid: "a", id: "a", name: "A", image: "spot", x: 20, y: 30, width: 32, height: 32 },
      { uid: "b", id: "b", name: "B", image: "spot", x: 80, y: 90, width: 32, height: 32 },
    ],
    routes: [{ uid: "r", from: "a", to: "b", type: "link", alpha: 255 }],
  },
  worldImage: null,
  imageMap: new Map(),
  materials: { image: type => type === "spot" ? spotImage : routeImage },
  selectedSpot: null,
  selectedRoute: null,
  routeWidth: 4,
});
assert.equal(calls[0][0], "clearRect");
assert.equal(calls.filter(call => call[0] === "drawImage").length, 3);

console.log("OK: refactored autosave, media, and material modules");
