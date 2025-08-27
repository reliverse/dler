// ===============================================
// experimental dler's rust binary
// To test, just run `bun npm/setup.ts`
// ===============================================

import fs from "node:fs";
import path from "node:path";
import { cliVersion } from "~/impl/config/constants";

const os = process.platform === "win32" ? "windows" : process.platform;
const ext = os === "windows" ? ".exe" : "";
const arch = process.arch === "arm64" ? "arm64" : "x64";
const binUrl = `https://github.com/reliverse/dler/releases/download/v${cliVersion}/dlerust-${os}-${arch}${ext}`;

const downloadTo = path.resolve("dlerust");

console.log("Downloading binary:", binUrl);
console.log("To:", downloadTo);

// TODO: Check SHA before redownloading the same binary.
const res = await fetch(binUrl);
if (!res.ok) {
  console.error(`Failed to download binary: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const bin = toBuffer(await res.arrayBuffer());
fs.writeFileSync(downloadTo, bin);
fs.chmodSync(downloadTo, 0o755);
console.log("Done!");

// HELPERS

function toBuffer(arrayBuffer: ArrayBuffer) {
  const buffer = Buffer.alloc(arrayBuffer.byteLength);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; ++i) {
    buffer[i] = view[i] ?? 0;
  }
  return buffer;
}
