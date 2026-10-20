import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const PREFIXES = ["mdi", "ri", "eva", "streamline", "material-symbols"];
const BUNDLE = join("src", "lib", "icons", "iconData.json");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (path === BUNDLE) return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

describe("icon bundle", () => {
  it("contains every icon the source uses", () => {
    const bundle = JSON.parse(readFileSync(BUNDLE, "utf8")) as {
      prefix: string;
      icons: Record<string, unknown>;
      aliases?: Record<string, unknown>;
    }[];

    const available = new Set(
      bundle.flatMap((collection) => [
        ...Object.keys(collection.icons).map((name) => `${collection.prefix}:${name}`),
        ...Object.keys(collection.aliases ?? {}).map((name) => `${collection.prefix}:${name}`),
      ])
    );

    const missing = new Set<string>();
    for (const file of walk("src").filter((path) => /\.(ts|tsx)$/.test(path))) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/["'`]([a-z0-9-]+):([a-z0-9-]+)["'`]/g)) {
        const name = `${match[1]}:${match[2]}`;
        if (PREFIXES.includes(match[1]) && !available.has(name)) missing.add(name);
      }
    }

    assert.deepEqual([...missing], [], "run `npm run icons` to add the missing icons");
  });
});
