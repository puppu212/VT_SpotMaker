import assert from "node:assert/strict";
import { createHistory } from "../src/history.js";
import { validateDatInputs, validateProject } from "../src/validation.js";

const history = createHistory(2);
history.checkpoint({ value: 1 });
history.checkpoint({ value: 2 });
assert.deepEqual(history.undo({ value: 3 }), { value: 2 });
assert.deepEqual(history.redo({ value: 2 }), { value: 3 });
assert.equal(history.canUndo, true);

const invalid = validateProject({
  spots: [
    { uid: "a", id: "same", x: 1, y: 2, width: 32, height: 32 },
    { uid: "b", id: "same", x: -1, y: 2, width: 0, height: 32 },
  ],
  routes: [{ from: "a", to: "missing", alpha: 300 }],
});
assert.equal(invalid.errors.some(message => message.includes("重複")), true);
assert.equal(invalid.errors.some(message => message.includes("接続先")), true);
assert.equal(invalid.warnings.some(message => message.includes("マップ外")), true);

assert.equal(validateDatInputs("scenario sc {}", "spot a {}").errors.length, 0);
assert.equal(validateDatInputs("spot a {}", "scenario sc {}").errors.length, 2);

console.log("OK: history and DAT validation");
