import assert from "node:assert/strict";
import { createZip, crc32 } from "../src/zip-export.js";

const scenario = new TextEncoder().encode("scenario data");
const spot = new TextEncoder().encode("spot data");
const zip = createZip([
  { name: "scenario.dat", bytes: scenario },
  { name: "spot.dat", bytes: spot },
]);
const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

assert.equal(view.getUint32(0, true), 0x04034b50);
assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50);
assert.equal(view.getUint16(zip.length - 14, true), 2);
assert.equal(view.getUint16(zip.length - 12, true), 2);
assert.equal(crc32(new Uint8Array([1, 2, 3, 4])), 0xb63cfbcd);

assert.deepEqual(readStoredEntries(zip), {
  "scenario.dat": "scenario data",
  "spot.dat": "spot data",
});

console.log("OK: DAT files are bundled into a ZIP archive");

function readStoredEntries(bytes) {
  const decoder = new TextDecoder();
  const entries = {};
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    const data = decoder.decode(bytes.slice(dataStart, dataStart + compressedSize));
    entries[name] = data;
    offset = dataStart + compressedSize;
  }
  return entries;
}
