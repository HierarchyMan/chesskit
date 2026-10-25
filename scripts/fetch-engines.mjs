import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Restores the engine binaries (.wasm, .nnue) that git does not hold. Each one is listed in
// scripts/engine-binaries.json with the size, SHA-256 and the pinned public URL it comes from.
//
//   npm run engines                 download whatever is missing (runs before dev, build, start)
//   npm run engines -- --verify     also hash every file on disk and replace any that differ
//   npm run engines -- --check      report only, never download (exit code 1 when anything is off)
//   --root <dir>                    restore into <dir>/public/engines instead of this project

const CONCURRENCY = 4;
const ATTEMPTS = 3;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const verify = args.includes("--verify");
const checkOnly = args.includes("--check");
const rootIndex = args.indexOf("--root");
const root = path.resolve(
  rootIndex >= 0 ? args[rootIndex + 1] : path.join(scriptDirectory, "..")
);

const manifest = JSON.parse(
  readFileSync(path.join(scriptDirectory, "engine-binaries.json"), "utf8")
);

const megabytes = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

const hashFile = async (file) => {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
};

const isPresent = async (entry, file) => {
  if (!existsSync(file) || statSync(file).size !== entry.bytes) return false;
  return !verify || (await hashFile(file)) === entry.sha256;
};

const download = async (entry, file) => {
  const partial = `${file}.part`;
  const hash = createHash("sha256");
  let received = 0;
  const counting = new Transform({
    transform(chunk, _encoding, done) {
      hash.update(chunk);
      received += chunk.length;
      done(null, chunk);
    },
  });

  try {
    const response = await fetch(entry.url);
    if (!response.ok) throw new Error(`status ${response.status}`);
    mkdirSync(path.dirname(file), { recursive: true });
    await pipeline(
      Readable.fromWeb(response.body),
      counting,
      createWriteStream(partial)
    );
    if (received !== entry.bytes)
      throw new Error(`got ${received} bytes, expected ${entry.bytes}`);
    if (hash.digest("hex") !== entry.sha256)
      throw new Error("SHA-256 does not match the manifest");
    renameSync(partial, file);
  } catch (error) {
    if (existsSync(partial)) unlinkSync(partial);
    throw error;
  }
};

const restore = async (entry) => {
  const file = path.join(root, "public", entry.path);
  if (await isPresent(entry, file)) return "present";
  if (checkOnly) {
    console.error(`missing or different: ${entry.path}`);
    return "failed";
  }

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      await download(entry, file);
      console.log(`downloaded ${entry.path} (${megabytes(entry.bytes)})`);
      return "downloaded";
    } catch (error) {
      console.error(
        `${entry.path}: attempt ${attempt}/${ATTEMPTS} failed: ${error.message}`
      );
    }
  }
  return "failed";
};

const results = [];
const queue = [...manifest];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift())
      results.push(await restore(entry));
  })
);

const count = (status) => results.filter((result) => result === status).length;
const failed = count("failed");
console.log(
  `Engine binaries: ${count("present")} present, ${count("downloaded")} downloaded, ${failed} failed`
);
process.exit(failed > 0 ? 1 : 0);
