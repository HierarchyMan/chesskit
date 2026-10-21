import assert from "node:assert/strict";
import { it } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createStaticServer } from "../scripts/serve.mjs";

it("serves the production export with clean routes, MIME, compression, caching and safe paths", async () => {
  const root = path.resolve(".performance", "server-fixture");
  await mkdir(path.join(root, "_next/static"), { recursive: true });
  await mkdir(path.join(root, "engines"), { recursive: true });
  await Promise.all([writeFile(path.join(root, "index.html"), "<main>Chesskit</main>"), writeFile(path.join(root, "analysis.html"), "<main>Analysis</main>"), writeFile(path.join(root, "404.html"), "missing"), writeFile(path.join(root, "engines/test.wasm"), new Uint8Array([0, 97, 115, 109])), writeFile(path.join(root, "_next/static/test.js"), "console.log(1)")]);
  const server = createStaticServer(root);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const request = (route: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}${route}`, init);
  try {
    assert.equal(await (await request("/")).text(), "<main>Chesskit</main>");
    assert.equal(await (await request("/analysis?sessionId=abc")).text(), "<main>Analysis</main>");
    const script = await request("/_next/static/test.js");
    assert.match(script.headers.get("cache-control")!, /immutable/);
    assert.match(script.headers.get("content-type")!, /javascript/);
    assert.equal((await request("/engines/test.wasm")).headers.get("content-type"), "application/wasm");
    const head = await request("/analysis", { method: "HEAD" });
    assert.equal(await head.text(), "");
    const compressed = await request("/analysis", { headers: { "accept-encoding": "gzip" } });
    assert.equal(compressed.headers.get("content-encoding"), "gzip");
    assert.equal(await compressed.text(), "<main>Analysis</main>");
    assert.equal((await request("/unknown")).status, 404);
    assert.equal((await request("/analysis", { method: "POST" })).status, 405);
    assert.equal((await request("/%00")).status, 400);
    assert.equal((await request("/%5c..%5cpackage.json")).status, 400);
    assert.notEqual((await request("/..%2f..%2fpackage.json")).status, 200);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
