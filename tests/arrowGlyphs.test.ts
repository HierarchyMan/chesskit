import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BADGE_GLYPHS } from "@/lib/arrows/glyphs";

// The points of a path made only of M, L and Q commands with absolute coordinates.
const points = (path: string) =>
  [...path.matchAll(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));

describe("badge glyphs", () => {
  it("has every character an arrow's badge shows", () => {
    // The numbers of a line of up to four further moves, and a threat's mark.
    for (const character of ["2", "3", "4", "5", "!"]) {
      assert.ok(BADGE_GLYPHS[character], `glyph for ${character}`);
    }
  });

  it("centres each one on the middle of its ink", () => {
    for (const [character, path] of Object.entries(BADGE_GLYPHS)) {
      const all = points(path);
      const xs = all.map((point) => point.x);
      const ys = all.map((point) => point.y);
      const middleX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const middleY = (Math.min(...ys) + Math.max(...ys)) / 2;
      assert.ok(
        Math.abs(middleX) < 0.01,
        `${character} is ${middleX} em off across`
      );
      assert.ok(
        Math.abs(middleY) < 0.01,
        `${character} is ${middleY} em off down`
      );
    }
  });

  it("keeps each one the height of a capital, so every badge reads the same size", () => {
    for (const [character, path] of Object.entries(BADGE_GLYPHS)) {
      const ys = points(path).map((point) => point.y);
      const height = Math.max(...ys) - Math.min(...ys);
      assert.ok(
        height > 0.69 && height < 0.74,
        `${character} is ${height} em tall`
      );
    }
  });
});
