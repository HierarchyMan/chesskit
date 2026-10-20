import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const OUTPUT = join("src", "lib", "icons", "iconData.json");
const PREFIXES = ["mdi", "ri", "eva", "streamline", "material-symbols"];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (path === OUTPUT) return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const used = new Set();
for (const file of walk("src").filter((file) => /\.(ts|tsx)$/.test(file))) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/["'`]([a-z0-9-]+):([a-z0-9-]+)["'`]/g)) {
    if (PREFIXES.includes(match[1])) used.add(`${match[1]}:${match[2]}`);
  }
}

const byPrefix = new Map();
for (const name of [...used].sort()) {
  const [prefix, icon] = name.split(":");
  byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), icon]);
}

const collections = [];
let missing = 0;

for (const [prefix, icons] of byPrefix) {
  const response = await fetch(`https://api.iconify.design/${prefix}.json?icons=${icons.join(",")}`);
  if (!response.ok) throw new Error(`Iconify API answered ${response.status} for ${prefix}`);

  const data = await response.json();
  const found = new Set([...Object.keys(data.icons ?? {}), ...Object.keys(data.aliases ?? {})]);

  for (const icon of icons) {
    if (!found.has(icon)) {
      missing++;
      console.error(`MISSING ${prefix}:${icon}`);
    }
  }

  collections.push({
    prefix,
    icons: data.icons ?? {},
    aliases: data.aliases ?? {},
    width: data.width,
    height: data.height,
  });
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(collections));
console.log(`Wrote ${used.size} icons (${missing} missing) to ${OUTPUT}`);
process.exit(missing ? 1 : 0);
