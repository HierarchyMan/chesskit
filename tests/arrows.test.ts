import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  QUALITY_CORNER,
  arrowOutline,
  isKnightStep,
  placeBadges,
  squareAtPoint,
  squareCenter,
} from "@/lib/arrows/geometry";
import { mergeArrows } from "@/lib/arrows/merge";
import { BoardArrow } from "@/lib/arrows/types";
import { INK_COLORS, inkColor } from "@/components/board/useInkArrows";

describe("board geometry", () => {
  it("maps squares to points and back for both orientations", () => {
    for (const orientation of ["white", "black"] as const) {
      for (const square of ["a1", "h1", "a8", "h8", "e4", "g1"]) {
        const { x, y } = squareCenter(square, orientation);
        assert.equal(squareAtPoint(x, y, orientation), square);
      }
    }
    assert.equal(squareAtPoint(-0.1, 3, "white"), undefined);
    assert.equal(squareAtPoint(3, 8, "black"), undefined);
  });

  it("puts a1 at the bottom left for White and the top right for Black", () => {
    assert.deepEqual(squareCenter("a1", "white"), { x: 0.5, y: 7.5 });
    assert.deepEqual(squareCenter("a1", "black"), { x: 7.5, y: 0.5 });
  });
});

const SHAPE = { width: 0.2, headLength: 0.44, headHalfWidth: 0.3 };

describe("arrow outline", () => {
  it("recognises knight steps by their squares alone", () => {
    assert.ok(isKnightStep("g1", "f3"));
    assert.ok(isKnightStep("b8", "a6"));
    assert.ok(!isKnightStep("g1", "g3"));
    assert.ok(!isKnightStep("a1", "c3"));
  });

  it("goes two squares along the long side, then turns, for a knight", () => {
    const white = arrowOutline("g1", "f3", "white", SHAPE);
    assert.ok(white);
    // g1 -> g3 straight up, then one square left onto f3.
    assert.deepEqual(white.origin, { x: 6.5, y: 7.5 });
    assert.deepEqual(white.legStart, { x: 6.5, y: 5.5 });
    assert.deepEqual(white.direction, { x: -1, y: 0 });

    // Seen from Black's side the same move is the same L, turned around.
    const black = arrowOutline("g1", "f3", "black", SHAPE);
    assert.ok(black);
    assert.deepEqual(black.legStart, { x: 1.5, y: 2.5 });
    assert.deepEqual(black.direction, { x: 1, y: 0 });
  });

  it("starts a horizontal knight move along the file direction", () => {
    const shape = arrowOutline("b1", "d2", "white", SHAPE);
    assert.ok(shape);
    // b1 -> d1 along the rank, then one square up onto d2.
    assert.deepEqual(shape.legStart, { x: 3.5, y: 7.5 });
    assert.deepEqual(shape.direction, { x: 0, y: -1 });
  });

  it("draws every other move straight, and never a move to itself", () => {
    const straight = arrowOutline("e2", "e4", "white", SHAPE);
    assert.ok(straight);
    assert.deepEqual(straight.legStart, straight.origin);
    assert.equal(arrowOutline("a1", "h8", "white", SHAPE) !== undefined, true);
    assert.equal(arrowOutline("e4", "e4", "white", SHAPE), undefined);
  });

  it("ends the tip inside the destination square, short of its centre", () => {
    const shape = arrowOutline("e2", "e4", "white", SHAPE);
    assert.ok(shape);
    // e4's centre is y 4.5 on the board; the tip sits a little toward e2.
    assert.ok(Math.abs(shape.tip.y - 4.62) < 1e-9);
    assert.ok(shape.base.y > shape.tip.y);
  });

  it("moves an arrow to its right, so that opposite arrows part", () => {
    const there = arrowOutline("e2", "e4", "white", { ...SHAPE, offset: 0.14 });
    const back = arrowOutline("e4", "e2", "white", { ...SHAPE, offset: 0.14 });
    const plain = arrowOutline("e2", "e4", "white", SHAPE);
    assert.ok(there && back && plain);
    // Pointing up the board, the right is the east; coming back it is the west.
    assert.ok(Math.abs(there.origin.x - plain.origin.x - 0.14) < 1e-9);
    assert.ok(Math.abs(back.origin.x - plain.origin.x + 0.14) < 1e-9);
    assert.ok(Math.abs(there.origin.x - back.origin.x - 0.28) < 1e-9);
  });

  it("does not move a knight's arrow, which already turns away", () => {
    const moved = arrowOutline("g1", "f3", "white", { ...SHAPE, offset: 0.14 });
    const plain = arrowOutline("g1", "f3", "white", SHAPE);
    assert.deepEqual(moved?.outline, plain?.outline);
  });

  it("is one closed silhouette, so the head and shaft share every edge", () => {
    const shape = arrowOutline("g1", "f3", "white", SHAPE);
    assert.ok(shape);
    // Shaft in and out at the elbow, the head's two wings and its tip.
    assert.ok(shape.outline.length >= 8);
    assert.ok(
      shape.outline.some(
        (point) =>
          Math.abs(point.x - shape.tip.x) < 1e-9 &&
          Math.abs(point.y - shape.tip.y) < 1e-9
      )
    );
  });

  it("shortens the head on a one-square arrow instead of folding it back", () => {
    const shape = arrowOutline("e2", "e3", "white", {
      ...SHAPE,
      headLength: 2,
    });
    assert.ok(shape);
    const length = Math.hypot(
      shape.base.x - shape.origin.x,
      shape.base.y - shape.origin.y
    );
    // The head is at most this share of the one-square leg, so the shaft keeps its length.
    assert.ok(length > 0 && length < 0.9);
    assert.ok(shape.base.y > shape.tip.y - 1e-9);
  });
});

describe("badge placement", () => {
  const request = (
    key: string,
    to: "e4" | "d4",
    legStart: { x: number; y: number }
  ) => ({
    key,
    to,
    legStart,
  });

  it("gives two labels on one square different corners", () => {
    const placed = placeBadges(
      [
        request("a", "e4", { x: 4.5, y: 6.5 }),
        request("b", "e4", { x: 4.5, y: 6.5 }),
      ],
      "white",
      new Set()
    );
    assert.notDeepEqual(placed.get("a"), placed.get("b"));
  });

  it("keeps a label off the corner that the move-quality mark holds", () => {
    const center = squareCenter("e4", "white");
    const quality = { x: center.x + 0.3, y: center.y - 0.3 };
    const placed = placeBadges(
      [request("a", "e4", { x: 0, y: 4.5 })],
      "white",
      new Set(["e4"])
    );
    assert.notDeepEqual(placed.get("a"), quality);
    assert.equal(QUALITY_CORNER, 0);
  });

  it("places a label on the corner farthest from where its arrow came from", () => {
    const placed = placeBadges(
      [request("a", "e4", { x: 0.5, y: 7.5 })],
      "white",
      new Set()
    );
    const center = squareCenter("e4", "white");
    assert.ok((placed.get("a")?.x ?? 0) > center.x);
  });
});

describe("mergeArrows", () => {
  const arrow = (
    kind: BoardArrow["kind"],
    from: BoardArrow["from"],
    to: BoardArrow["to"]
  ): BoardArrow => ({ from, to, kind });

  it("keeps the more important of two arrows between the same squares", () => {
    const merged = mergeArrows([
      arrow("candidate", "e2", "e4"),
      arrow("best", "e2", "e4"),
    ]);
    assert.deepEqual(
      merged.map((entry) => entry.kind),
      ["best"]
    );
  });

  it("keeps the first of two equally important arrows", () => {
    const first: BoardArrow = { ...arrow("content", "e1", "f3"), color: "red" };
    const second: BoardArrow = {
      ...arrow("content", "e1", "f3"),
      color: "green",
    };
    assert.deepEqual(mergeArrows([first, second]), [first]);
  });

  it("carries the ply numbers of a losing arrow, so a revisited square keeps every move", () => {
    const merged = mergeArrows([
      { ...arrow("line", "e2", "e4"), label: "3" },
      { ...arrow("best", "e2", "e4") },
      { ...arrow("line", "e2", "e4"), label: "5" },
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].kind, "best");
    assert.deepEqual(
      [merged[0].label, ...(merged[0].alsoLabels ?? [])],
      ["3", "5"]
    );
  });

  it("treats opposite directions as different arrows and draws the best last", () => {
    const merged = mergeArrows([
      arrow("best", "e2", "e4"),
      arrow("candidate", "e4", "e2"),
    ]);
    assert.deepEqual(
      merged.map((entry) => entry.kind),
      ["candidate", "best"]
    );
  });

  it("leaves an empty list alone", () => {
    assert.deepEqual(mergeArrows([]), []);
  });
});

describe("drawing colours", () => {
  const keys = {
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
  };

  it("draws green, red with Shift or Ctrl, blue with Alt or Meta, and yellow with both", () => {
    assert.equal(inkColor(keys), INK_COLORS.green);
    assert.equal(inkColor({ ...keys, shiftKey: true }), INK_COLORS.red);
    assert.equal(inkColor({ ...keys, ctrlKey: true }), INK_COLORS.red);
    assert.equal(inkColor({ ...keys, altKey: true }), INK_COLORS.blue);
    assert.equal(inkColor({ ...keys, metaKey: true }), INK_COLORS.blue);
    assert.equal(
      inkColor({ ...keys, shiftKey: true, altKey: true }),
      INK_COLORS.yellow
    );
  });
});
