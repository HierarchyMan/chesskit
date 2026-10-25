import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BOARD_THEMES } from "@/components/board/states";
import { readableArrowColor, arrowContrast } from "@/lib/arrows/contrast";
import { mergeArrows } from "@/lib/arrows/merge";
import { legendFor } from "@/lib/arrows/legend";
import {
  ARROW_HUE_PRESETS,
  ARROW_PALETTE_DEFAULTS,
  isArrowPalette,
} from "@/lib/arrows/palette";
import {
  arrowStyle,
  checkerTint,
  ownerColor,
  rankedStyle,
} from "@/lib/arrows/style";

const TO_MOVE_HUE = ARROW_PALETTE_DEFAULTS.toMove;
const OTHER_HUE = ARROW_PALETTE_DEFAULTS.other;
const PALETTE = ARROW_PALETTE_DEFAULTS;

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

describe("arrow colour settings", () => {
  const custom = { toMove: "#009E73", other: "#7B3FA0" };

  it("keeps blue and orange as the defaults", () => {
    assert.deepEqual(ARROW_PALETTE_DEFAULTS, {
      toMove: "#0067B4",
      other: "#CE6400",
    });
    assert.equal(ARROW_HUE_PRESETS[0].hex, ARROW_PALETTE_DEFAULTS.toMove);
    assert.equal(ARROW_HUE_PRESETS[1].hex, ARROW_PALETTE_DEFAULTS.other);
  });

  it("gives the side to move the first hue and the other side the second", () => {
    assert.equal(ownerColor("w", "w", custom), custom.toMove);
    assert.equal(ownerColor("b", "w", custom), custom.other);
    assert.equal(ownerColor(undefined, "b", custom), custom.toMove);
  });

  it("draws every engine arrow kind in the chosen hues", () => {
    for (const kind of [
      "best",
      "candidate",
      "line",
      "missed",
      "threat",
    ] as const) {
      const arrow = { from: "e2", to: "e4", kind, rank: 2 } as const;
      assert.equal(
        arrowStyle({ ...arrow, side: "w" }, "w", custom).color,
        custom.toMove
      );
      assert.equal(
        arrowStyle({ ...arrow, side: "b" }, "w", custom).color,
        custom.other
      );
    }
  });

  it("accepts only two six-digit hex colours from storage", () => {
    assert.ok(isArrowPalette(custom));
    assert.ok(!isArrowPalette({ toMove: "blue", other: "#CE6400" }));
    assert.ok(!isArrowPalette({ toMove: "#fff", other: "#CE6400" }));
    assert.ok(!isArrowPalette({ toMove: "#0067B4" }));
    assert.ok(!isArrowPalette(null));
  });

  it("keeps every preset readable on every board square", () => {
    for (const { hex } of ARROW_HUE_PRESETS)
      for (const theme of Object.values(BOARD_THEMES))
        for (const square of [theme.light, theme.dark])
          assert.ok(
            arrowContrast(readableArrowColor(hex, square), square) >= 2.3
          );
  });
});

describe("arrow emphasis", () => {
  it("preserves chosen and best roles while ranking a non-best choice by its actual rank", () => {
    const chosen = {
      from: "e2",
      to: "e4",
      kind: "planned",
      side: "w",
      rank: 3,
    } as const;
    assert.ok(
      arrowStyle(chosen, "w", PALETTE).opacity <
        arrowStyle({ ...chosen, kind: "best" }, "w", PALETTE).opacity
    );
    const merged = mergeArrows([chosen, { ...chosen, kind: "best", rank: 1 }]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].roles?.length, 2);
    assert.equal(arrowStyle(merged[0], "w", PALETTE).opacity, 1);
    assert.deepEqual(
      legendFor(merged, () => "White's").map((entry) => entry.kind),
      ["best", "planned"]
    );
  });
  it("keeps a continuous arrow readable on both square colours without an outline", () => {
    for (const theme of Object.values(BOARD_THEMES))
      for (const square of [theme.light, theme.dark])
        for (const color of [TO_MOVE_HUE, OTHER_HUE]) {
          assert.ok(
            arrowContrast(readableArrowColor(color, square), square) >= 2.3
          );
        }
  });
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
