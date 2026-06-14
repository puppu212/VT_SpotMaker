import assert from "node:assert/strict";
import { loadAutosave, supportsAutosave } from "../src/autosave.js";

assert.equal(supportsAutosave(), false);
await assert.rejects(loadAutosave(), /IndexedDB/);

console.log("OK: autosave capability detection");
