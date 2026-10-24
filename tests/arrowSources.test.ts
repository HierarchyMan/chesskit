import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { buildEngineArrows } from "@/lib/arrows/engineArrows";
import { sourcePieceFor, withSources } from "@/lib/arrows/source";
import { ARROW_TUNING_DEFAULTS } from "@/lib/arrows/tuning";
import { arrowFromUci } from "@/lib/arrows/uci";
import { BoardArrow } from "@/lib/arrows/types";
import { CurrentPosition, LineEval } from "@/types/eval";

const START = new Chess().fen();

/** The position after one move (in UCI) from the start. */
const after = (uci: string) => {
  const game = new Chess();
  game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
  return game.fen();
};

describe("the piece an arrow starts from", () => {
  it("is the mover on the board, so the arrow passes behind it", () => {
    const arrow = arrowFromUci("e2e4", { kind: "best", side: "w" });
    assert.equal(sourcePieceFor(START, arrow), "wP");
  });

  it("is never a piece of the other side that happens to stand there", () => {
    const arrow = arrowFromUci("e7e5", { kind: "best", side: "w" });
    assert.equal(sourcePieceFor(START, arrow), undefined);
  });

  it("is nothing when the origin is empty", () => {
    const arrow = arrowFromUci("e4e5", {
      kind: "candidate",
      side: "w",
      rank: 2,
    });
    assert.equal(sourcePieceFor(START, arrow), undefined);
  });

  it("is nothing for a missed move whose origin the move played vacated", () => {
    // Displayed after 1.e3: the pawn that would have played e4 is the one that moved.
    const afterE3 = after("e2e3");
    const arrow: BoardArrow = {
      ...arrowFromUci("e2e4", { kind: "missed", side: "w" }),
      history: ["e2e3"],
    };
    assert.equal(sourcePieceFor(afterE3, arrow), undefined);
  });

  it("is the mover for a missed move from a square the played move left alone", () => {
    // Displayed after 1.g4: the pawn on e2 is still there to play the better move.
    const afterG4 = after("g2g4");
    const arrow: BoardArrow = {
      ...arrowFromUci("e2e4", { kind: "missed", side: "w" }),
      history: ["g2g4"],
    };
    assert.equal(sourcePieceFor(afterG4, arrow), "wP");
  });

  it("is nothing for a missed move whose history is not known", () => {
    const arrow = arrowFromUci("e2e4", { kind: "missed", side: "w" });
    assert.equal(sourcePieceFor(START, arrow), undefined);
  });

  it("is any colour's piece for a drawn arrow, which has no side", () => {
    const ink = arrowFromUci("g1f3", { kind: "ink", color: "#3a9d5d" });
    assert.equal(sourcePieceFor(START, ink), "wN");
  });

  it("is still the piece for a later line move whose origin no earlier move touched", () => {
    const arrow: BoardArrow = {
      ...arrowFromUci("b1c3", { kind: "line", side: "w", label: "3" }),
      history: ["g1f3", "g8f6"],
    };
    assert.equal(sourcePieceFor(START, arrow), "wN");
  });

  it("is nothing once an earlier line move has taken the piece off its origin", () => {
    const arrow: BoardArrow = {
      ...arrowFromUci("g1h3", { kind: "line", side: "w", label: "3" }),
      history: ["g1f3"],
    };
    assert.equal(sourcePieceFor(START, arrow), undefined);
  });

  it("does not follow a rook that castling has moved", () => {
    const castled = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    const arrow: BoardArrow = {
      ...arrowFromUci("h1h2", { kind: "line", side: "w", label: "2" }),
      history: ["e1g1"],
    };
    // The rook on h1 moves to f1 when the king castles, so h1 is not its square.
    assert.equal(sourcePieceFor(castled, arrow), undefined);
  });

  it("is not given to a text-only teaching arrow", () => {
    const content = arrowFromUci("e2e4", { kind: "content", color: "#ff0000" });
    assert.equal(sourcePieceFor(START, content), undefined);
  });
});

describe("withSources", () => {
  it("returns the arrows unchanged when there is no position to read", () => {
    const arrow = arrowFromUci("e2e4", { kind: "best", side: "w" });
    assert.deepEqual(withSources([arrow], undefined), [arrow]);
  });

  it("marks each arrow once, keeping arrows that already agree", () => {
    const arrow = arrowFromUci("e2e4", { kind: "best", side: "w" });
    const [marked] = withSources([arrow], START);
    assert.equal(marked.sourcePiece, "wP");
    assert.equal(withSources([marked], START)[0], marked);
  });
});

describe("engine arrows carry their history", () => {
  const LINE: LineEval = {
    pv: ["e2e4", "e7e5", "g1f3", "b8c6"],
    multiPv: 1,
    depth: 12,
    cp: 30,
  };

  it("reads a line's knight from the two moves before it, and masks it", () => {
    const position: CurrentPosition = { fen: START, eval: { lines: [LINE] } };
    const arrows = buildEngineArrows(
      position,
      START,
      { enabled: true, moves: 1, ahead: 2, missed: false, threats: false },
      ARROW_TUNING_DEFAULTS
    );
    const knight = arrows.find((arrow) => arrow.from === "g1");
    assert.ok(knight);
    assert.deepEqual(knight.history, ["e2e4", "e7e5"]);
    // The knight still stands on g1 in the displayed position, so the arrow passes behind it.
    assert.equal(sourcePieceFor(START, knight), "wN");
  });
});
