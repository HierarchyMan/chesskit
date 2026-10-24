import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BOARD_THEMES } from "@/components/board/states";
import {
  OTHER_HUE,
  TO_MOVE_HUE,
  checkerTint,
  rankedStyle,
} from "@/lib/arrows/style";

const luminance = (hex: string) => {
  const value = parseInt(hex.slice(1), 16);
  const [red, green, blue] = [value >> 16, (value >> 8) & 255, value & 255].map(
    (channel) => {
      const unit = channel / 255;
      return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
    }
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

// WCAG 2.1 contrast ratio, as used for non-text contrast (1.4.11).
const contrast = (a: string, b: string) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

const parseRgb = (css: string) =>
  css
    .slice(css.indexOf("(") + 1, -1)
    .split(",")
    .map((channel) => Number(channel.trim()));

describe("arrow palette", () => {
  it("keeps the two sides distinct from each other", () => {
    assert.notEqual(TO_MOVE_HUE, OTHER_HUE);
    assert.ok(contrast(TO_MOVE_HUE, OTHER_HUE) >= 1.5);
  });

  it("keeps the owner colours readable on the lighter square of every theme", () => {
    // Without a casing, the colour alone carries the arrow on light squares.
    for (const [theme, { light }] of Object.entries(BOARD_THEMES)) {
      for (const [name, color] of [
        ["blue", TO_MOVE_HUE],
        ["orange", OTHER_HUE],
      ]) {
        assert.ok(
          contrast(color, light) >= 2.3,
          `${name} ${color} on ${theme} light ${light}`
        );
      }
    }
  });

  it("gives a missed move's checker a second tone that is visibly lighter", () => {
    for (const color of [TO_MOVE_HUE, OTHER_HUE]) {
      const [r, g, b] = parseRgb(checkerTint(color));
      const tint = `#${[r, g, b]
        .map((channel) => channel.toString(16).padStart(2, "0"))
        .join("")}`;
      assert.ok(luminance(tint) > luminance(color));
    }
  });
});

describe("arrow emphasis", () => {
  it("makes the best move fully opaque and steps every other candidate down", () => {
    const best = rankedStyle(1, TO_MOVE_HUE).opacity;
    const second = rankedStyle(2, TO_MOVE_HUE).opacity;
    const third = rankedStyle(3, TO_MOVE_HUE).opacity;
    const fifth = rankedStyle(5, TO_MOVE_HUE).opacity;

    assert.equal(best, 1);
    // A clear gap from the best move, then a steady step between ranks.
    assert.ok(best - second >= 0.35, `best ${best} vs second ${second}`);
    assert.ok(second > third && third > fifth);
    assert.ok(fifth >= 0.3);
  });

  it("keeps the best move widest, and narrows the candidates with rank", () => {
    const widths = [1, 2, 3, 4, 5].map(
      (rank) => rankedStyle(rank, "#000").width
    );
    assert.ok(widths[0] > widths[1]);
    for (let i = 1; i < widths.length; i++) {
      assert.ok(widths[i] <= widths[i - 1]);
    }
  });
});
