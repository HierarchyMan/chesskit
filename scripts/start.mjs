import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const hash = createHash("sha256");
function visit(directory, content) {
  for (const item of readdirSync(directory).sort()) {
    const file = path.join(directory, item); const stat = statSync(file);
    if (stat.isDirectory()) visit(file, content);
    else { hash.update(file); hash.update(content ? readFileSync(file) : `${stat.size}:${stat.mtimeMs}`); }
  }
}
visit("src", true); visit("public", false);
for (const file of ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "sentry.client.config.ts", ".env", ".env.local", ".env.production", ".env.production.local"])
  if (existsSync(file)) hash.update(readFileSync(file));
for (const key of Object.keys(process.env).filter((key) => key.startsWith("NEXT_PUBLIC_")).sort()) hash.update(`${key}=${process.env[key]}`);
// Public files are copied by Next, so a changed asset invalidates the local export too.
const fingerprint = hash.digest("hex");
const stamp = path.join(root, ".next/local-export-fingerprint");
if (!existsSync("out/index.html") || !existsSync(stamp) || readFileSync(stamp, "utf8") !== fingerprint) {
  const require = createRequire(import.meta.url);
  const build = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], { stdio: "inherit", windowsHide: true });
  if (build.status !== 0) process.exit(build.status ?? 1);
  writeFileSync(stamp, fingerprint);
}
await import("./serve.mjs").then(({ createStaticServer }) => {
  const port = Number(process.env.PORT ?? 3000);
  const server = createStaticServer();
  server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, "127.0.0.1", () => console.log(`Chesskit: http://localhost:${port}`));
});
