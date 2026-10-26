import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Restores engine files from src/lib/engine/engineFiles.json, which lists each one with its
// size, SHA-256 and pinned public URL. The app serves only the bundled engine, so only its
// files go to public/engines; every other engine lives in engine-files/ for the Node scripts.
//
//   npm run engines                 restore the bundled engine (runs before dev, build, start)
//   npm run engines -- --all        also restore every other engine into engine-files/
//   npm run engines -- --verify     also hash every file on disk and replace any that differ
//   npm run engines -- --check      report only, never download (exit code 1 when anything is off)
//   --root <dir>                    restore into <dir> instead of this project

const CONCURRENCY = 4;
const ATTEMPTS = 3;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const all = args.includes("--all");
const verify = args.includes("--verify");
const checkOnly = args.includes("--check");
const rootIndex = args.indexOf("--root");
const root = path.resolve(
  rootIndex >= 0 ? args[rootIndex + 1] : path.join(scriptDirectory, "..")
);

const manifest = JSON.parse(
  readFileSync(
    path.join(scriptDirectory, "../src/lib/engine/engineFiles.json"),
    "utf8"
  )
);
const bundled = new Set(manifest.bundled);

/** Where a file lives on disk: served files under public/, the rest under engine-files/. */
export const localEngineFile = (projectRoot, file) =>
  path.join(projectRoot, bundled.has(file) ? "public" : "engine-files", file);

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

const restore = async ([name, entry]) => {
  const file = localEngineFile(root, name);
  if (await isPresent(entry, file)) return "present";
  if (checkOnly) {
    console.error(`missing or different: ${name}`);
    return "failed";
  }

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      await download(entry, file);
      console.log(`downloaded ${name} (${megabytes(entry.bytes)})`);
      return "downloaded";
    } catch (error) {
      console.error(
        `${name}: attempt ${attempt}/${ATTEMPTS} failed: ${error.message}`
      );
    }
  }
  return "failed";
};

// Anything else under public/engines would be served by the app, against the bundled-only rule.
const LICENSE_FILE = /(^|\/)(LICENSE|Copying\.txt)$/;
const strayServedFiles = () => {
  const servedRoot = path.join(root, "public");
  const walk = (directory) =>
    existsSync(directory)
      ? readdirSync(directory).flatMap((item) => {
          const file = path.join(directory, item);
          return statSync(file).isDirectory() ? walk(file) : [file];
        })
      : [];
  return walk(path.join(servedRoot, "engines"))
    .map((file) => path.relative(servedRoot, file).split(path.sep).join("/"))
    .filter((file) => !bundled.has(file) && !LICENSE_FILE.test(file));
};

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const entries = Object.entries(manifest.files).filter(
    ([name]) => all || bundled.has(name)
  );
  const results = [];
  const queue = [...entries];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift())
        results.push(await restore(entry));
    })
  );

  const stray = strayServedFiles();
  for (const file of stray) {
    console.error(
      `public/${file} is not a bundled engine file, so the app would serve it. Move it to engine-files/.`
    );
  }

  const count = (status) =>
    results.filter((result) => result === status).length;
  const failed = count("failed");
  console.log(
    `Engine files${all ? "" : " (bundled)"}: ${count("present")} present, ${count("downloaded")} downloaded, ${failed} failed`
  );
  process.exit(failed > 0 || (checkOnly && stray.length > 0) ? 1 : 0);
}
