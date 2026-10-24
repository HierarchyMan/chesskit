// Writes src/lib/arrows/glyphs.ts: the outlines of the characters that appear in
// an arrow's badge (the digits of a line and the "!" of a threat), taken from the
// Roboto Bold the app ships, each centred on the middle of its ink.
//
//   node scripts/build-badge-glyphs.mjs
//
// A badge drawn from text is centred by the browser by the font's metrics, which
// differ between browsers, sizes and hinting, so a digit lands a little off the
// middle of its circle. A badge drawn from these outlines is centred by
// construction. Roboto is licensed under the Apache License 2.0.
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const FONT =
  "node_modules/@fontsource/roboto/files/roboto-latin-700-normal.woff";
const OUTPUT = "src/lib/arrows/glyphs.ts";
const CHARACTERS = "123456789!";

const font = readFileSync(FONT);

// A WOFF file holds the font's tables, each compressed on its own.
const tables = {};
for (let index = 0; index < font.readUInt16BE(12); index++) {
  const entry = 44 + index * 20;
  const offset = font.readUInt32BE(entry + 4);
  const compressed = font.readUInt32BE(entry + 8);
  const original = font.readUInt32BE(entry + 12);
  const bytes = font.subarray(offset, offset + compressed);
  tables[font.toString("latin1", entry, entry + 4)] =
    compressed < original ? inflateSync(bytes) : bytes;
}

const unitsPerEm = tables.head.readUInt16BE(18);
const longOffsets = tables.head.readInt16BE(50) === 1;

const glyphOffset = (id) =>
  longOffsets
    ? tables.loca.readUInt32BE(id * 4)
    : tables.loca.readUInt16BE(id * 2) * 2;

// The glyph for a character, from the cmap's format 4 subtable (Windows, Unicode).
const glyphFor = (character) => {
  const cmap = tables.cmap;
  let subtable;
  for (let index = 0; index < cmap.readUInt16BE(2); index++) {
    const record = 4 + index * 8;
    if (
      cmap.readUInt16BE(record) === 3 &&
      cmap.readUInt16BE(record + 2) === 1
    ) {
      subtable = cmap.readUInt32BE(record + 4);
    }
  }
  const segments = cmap.readUInt16BE(subtable + 6) / 2;
  const code = character.charCodeAt(0);
  const ends = subtable + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const ranges = deltas + segments * 2;

  for (let segment = 0; segment < segments; segment++) {
    if (cmap.readUInt16BE(ends + segment * 2) < code) continue;
    if (cmap.readUInt16BE(starts + segment * 2) > code) break;

    const delta = cmap.readInt16BE(deltas + segment * 2);
    const range = cmap.readUInt16BE(ranges + segment * 2);
    if (range === 0) return (code + delta) & 0xffff;

    const id = cmap.readUInt16BE(
      ranges +
        segment * 2 +
        range +
        (code - cmap.readUInt16BE(starts + segment * 2)) * 2
    );
    return id === 0 ? 0 : (id + delta) & 0xffff;
  }
  return 0;
};

// The points of a simple glyph, as contours of { x, y, on }, and its ink box.
const outline = (id) => {
  const glyf = tables.glyf;
  let at = glyphOffset(id);
  const contours = glyf.readInt16BE(at);
  if (contours < 0) throw new Error("composite glyphs are not supported");

  const box = {
    xMin: glyf.readInt16BE(at + 2),
    yMin: glyf.readInt16BE(at + 4),
    xMax: glyf.readInt16BE(at + 6),
    yMax: glyf.readInt16BE(at + 8),
  };
  at += 10;

  const ends = Array.from({ length: contours }, (_, index) =>
    glyf.readUInt16BE(at + index * 2)
  );
  at += contours * 2;
  at += 2 + glyf.readUInt16BE(at);

  const count = ends[ends.length - 1] + 1;
  const flags = [];
  while (flags.length < count) {
    const flag = glyf[at++];
    flags.push(flag);
    if (flag & 8)
      for (let times = glyf[at++]; times > 0; times--) flags.push(flag);
  }

  const read = (short, same) => {
    const values = [];
    let value = 0;
    for (const flag of flags) {
      if (flag & short) {
        const step = glyf[at++];
        value += flag & same ? step : -step;
      } else if (!(flag & same)) {
        value += glyf.readInt16BE(at);
        at += 2;
      }
      values.push(value);
    }
    return values;
  };
  const xs = read(2, 16);
  const ys = read(4, 32);

  let from = 0;
  const shapes = ends.map((end) => {
    const points = [];
    for (let index = from; index <= end; index++) {
      points.push({ x: xs[index], y: ys[index], on: !!(flags[index] & 1) });
    }
    from = end + 1;
    return points;
  });
  return { shapes, box };
};

const middle = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true });

// TrueType contours are quadratic curves whose on-curve points may be implied.
const contourPath = (points, place) => {
  const start = points.findIndex((point) => point.on);
  const ring =
    start >= 0 ? [...points.slice(start), ...points.slice(0, start)] : [];
  if (start < 0)
    ring.push(middle(points[0], points[points.length - 1]), ...points);
  ring.push(ring[0]);

  const at = (point) => `${place(point.x, point.y).join(" ")}`;
  let path = `M${at(ring[0])}`;
  for (let index = 1; index < ring.length; index++) {
    const point = ring[index];
    if (point.on) {
      path += `L${at(point)}`;
      continue;
    }
    const next = ring[index + 1];
    if (next.on) {
      path += `Q${at(point)} ${at(next)}`;
      index++;
    } else {
      path += `Q${at(point)} ${at(middle(point, next))}`;
    }
  }
  return `${path}Z`;
};

const glyphs = {};
for (const character of CHARACTERS) {
  const { shapes, box } = outline(glyphFor(character));
  const centerX = (box.xMin + box.xMax) / 2;
  const centerY = (box.yMin + box.yMax) / 2;
  // In em, with y growing downwards, and the middle of the ink at the origin.
  const place = (x, y) => [
    +((x - centerX) / unitsPerEm).toFixed(4),
    +(-(y - centerY) / unitsPerEm).toFixed(4),
  ];
  glyphs[character] = shapes.map((shape) => contourPath(shape, place)).join("");
}

const lines = Object.entries(glyphs).map(
  ([character, path]) => `  "${character}": "${path}",`
);
writeFileSync(
  OUTPUT,
  `// Generated by scripts/build-badge-glyphs.mjs from Roboto Bold (Apache License
// 2.0). Do not edit by hand.

/**
 * The outlines of the characters in an arrow's badge, in em, with y growing
 * downwards and the middle of each one's ink at the origin, so a badge needs no
 * font to be centred.
 */
export const BADGE_GLYPHS: Readonly<Record<string, string>> = {
${lines.join("\n")}
};
`
);
console.log(`Wrote ${Object.keys(glyphs).length} glyphs to ${OUTPUT}`);
