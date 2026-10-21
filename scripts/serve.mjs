import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".wasm": "application/wasm", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".mp3": "audio/mpeg",
};

export function createStaticServer(root = path.join(project, "out")) {
  root = path.resolve(root);
  return http.createServer((request, response) => {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD" }); response.end(); return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
    catch { response.writeHead(400); response.end(); return; }
    if (pathname.includes("\0") || pathname.includes("\\")) { response.writeHead(400); response.end(); return; }
    let file = path.resolve(root, "." + pathname);
    if (!file.startsWith(root + path.sep) && file !== root) { response.writeHead(403); response.end(); return; }
    if (pathname.endsWith("/")) file = path.join(file, "index.html");
    else if (!path.extname(file)) file += ".html";
    let status = 200;
    if (!existsSync(file) || !statSync(file).isFile()) { file = path.join(root, "404.html"); status = 404; }
    if (!existsSync(file)) { response.writeHead(404); response.end("Not found"); return; }
    const extension = path.extname(file);
    const compress = /\bgzip\b/.test(request.headers["accept-encoding"] ?? "") && /\.(html|js|css|json|svg|wasm)$/.test(file);
    response.writeHead(status, {
      "Content-Type": types[extension] ?? "application/octet-stream",
      "Cache-Control": /\/(?:_next\/static|engines)\//.test(pathname) ? "public, max-age=31536000, immutable" : "no-cache",
      "X-Content-Type-Options": "nosniff",
      ...(compress ? { "Content-Encoding": "gzip", Vary: "Accept-Encoding" } : { "Content-Length": statSync(file).size }),
    });
    if (request.method === "HEAD") { response.end(); return; }
    const done = (error) => { if (error) response.destroy(error); };
    if (compress) pipeline(createReadStream(file), createGzip(), response, done);
    else pipeline(createReadStream(file), response, done);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  const server = createStaticServer();
  server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, "127.0.0.1", () => console.log(`Chesskit: http://localhost:${port}`));
}
