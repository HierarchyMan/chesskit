import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";
import { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const pieceHash = createHash("sha256");
function hashPieces(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name)
  )) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) hashPieces(file);
    else {
      pieceHash.update(file);
      pieceHash.update(readFileSync(file));
    }
  }
}
hashPieces("public/piece");
const pieceVersion = pieceHash.digest("hex");
const nextConfig = (phase: string): NextConfig => ({
  // Keep an isolated verification build from replacing a running dev server's output.
  distDir: process.env.CHESSKIT_DIST_DIR || ".next",
  output: phase === PHASE_PRODUCTION_BUILD ? "export" : undefined,
  trailingSlash: false,
  reactStrictMode: true,
  env: { NEXT_PUBLIC_PIECE_VERSION: pieceVersion },
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
  headers:
    phase === PHASE_PRODUCTION_BUILD
      ? undefined
      : async () => [
          {
            source: "/engines/:blob*",
            headers: [
              {
                key: "Cache-Control",
                value: "public, max-age=31536000, immutable",
              },
              {
                key: "Age",
                value: "181921",
              },
            ],
          },
        ],
});

export default withSentryConfig(nextConfig, {
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
  org: process.env.SENTRY_ORG,
  project: "javascript-nextjs",
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    reactComponentAnnotation: {
      enabled: true,
    },
  },
});
