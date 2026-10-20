import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import {
  EMPTY_FEN,
  POSITION_PRESETS,
  START_FEN,
  getCastlingAvailability,
  getValidEnPassantSquares,
  mirrorColors,
  movePiece,
  parseFenLoose,
  placePiece,
  positionFromFen,
  positionToFen,
  sanitizePosition,
  validatePosition,
} from "@/lib/editorPosition";

describe("fen round trip", () => {
  it("reads and writes the starting position", () => {
    assert.equal(positionToFen(positionFromFen(START_FEN)), START_FEN);
  });

  it("keeps turn, castling, en passant and counters", () => {
    const fen =
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
    assert.equal(positionToFen(positionFromFen(fen)), fen);

    const withEp =
      "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3";
    assert.equal(positionToFen(positionFromFen(withEp)), withEp);
  });

  it("writes an empty board", () => {
    assert.equal(positionToFen(positionFromFen(EMPTY_FEN)), EMPTY_FEN);
  });
});

describe("castling", () => {
  it("only allows rights when king and rook stand on their squares", () => {
    const position = positionFromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    assert.deepEqual(getCastlingAvailability(position.pieces), {
      K: true,
      Q: true,
      k: true,
      q: true,
    });

    const moved = movePiece(position, "h1", "h2");
    assert.equal(moved.castling.K, false);
    assert.equal(moved.castling.Q, true);

    const kingMoved = movePiece(position, "e8", "d8");
    assert.equal(kingMoved.castling.k, false);
    assert.equal(kingMoved.castling.q, false);
  });
});

describe("en passant", () => {
  it("lists only squares where the capture is possible", () => {
    const position = positionFromFen(
      "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3"
    );
    assert.deepEqual(getValidEnPassantSquares(position), ["d6"]);

    const none = positionFromFen(
      "rnbqkbnr/ppp1pppp/8/3p4/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 3"
    );
    assert.deepEqual(getValidEnPassantSquares(none), []);
  });

  it("drops a stale en passant square when pieces move", () => {
    const position = positionFromFen(
      "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3"
    );
    const moved = movePiece(position, "e5", "e4");
    assert.equal(moved.enPassant, null);
  });
});

describe("validation", () => {
  it("accepts the starting position", () => {
    assert.equal(validatePosition(positionFromFen(START_FEN)).ok, true);
  });

  it("accepts every preset except the empty board", () => {
    for (const preset of POSITION_PRESETS.filter(
      (entry) => entry.id !== "empty"
    )) {
      const result = validatePosition(positionFromFen(preset.fen));
      assert.equal(
        result.ok,
        true,
        `${preset.label}: ${result.problems.join(" ")}`
      );
      assert.doesNotThrow(() => new Chess(preset.fen));
    }
  });

  it("rejects the empty board and missing kings", () => {
    assert.match(
      validatePosition(positionFromFen(EMPTY_FEN)).problems[0],
      /exactly one king/
    );
    assert.equal(
      validatePosition(placePiece(positionFromFen(START_FEN), "e1", null)).ok,
      false
    );
  });

  it("rejects pawns on the back ranks", () => {
    const result = validatePosition(
      placePiece(positionFromFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1"), "a8", "wP")
    );
    assert.match(result.problems.join(" "), /first or eighth rank/);
  });

  it("rejects touching kings", () => {
    const result = validatePosition(
      positionFromFen("8/8/8/3kK3/8/8/8/8 w - - 0 1")
    );
    assert.match(result.problems.join(" "), /next to each other/);
  });

  it("rejects a position where the side that just moved is in check", () => {
    const result = validatePosition(
      positionFromFen("4k3/8/8/8/8/8/4R3/4K3 w - - 0 1")
    );
    assert.match(
      result.problems.join(" "),
      /Black is in check, but it is White's turn/
    );
  });

  it("allows the side to move to be in check", () => {
    assert.equal(
      validatePosition(positionFromFen("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1")).ok,
      true
    );
  });

  it("warns about finished positions", () => {
    const mate = validatePosition(
      positionFromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1")
    );
    assert.equal(mate.ok, true);
    const finished = validatePosition(
      positionFromFen("R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1")
    );
    assert.match(finished.warnings.join(" "), /checkmate/);
  });
});

describe("editing helpers", () => {
  it("places and removes pieces", () => {
    let position = positionFromFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    position = placePiece(position, "d4", "wQ");
    assert.equal(positionToFen(position), "4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1");
    position = placePiece(position, "d4", null);
    assert.equal(positionToFen(position), "4k3/8/8/8/8/8/8/4K3 w - - 0 1");
  });

  it("mirrors colours across the board", () => {
    const mirrored = mirrorColors(
      positionFromFen(
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
      )
    );
    assert.equal(
      positionToFen(sanitizePosition(mirrored)),
      "rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
  });
});

describe("parseFenLoose", () => {
  it("accepts any well-formed placement, even without kings", () => {
    const position = parseFenLoose("8/8/8/3Q4/8/8/8/8");
    assert.ok(position);
    assert.equal(position.pieces.d5, "wQ");
    assert.equal(position.turn, "w");
  });

  it("accepts a complete fen", () => {
    assert.equal(positionToFen(parseFenLoose(START_FEN)!), START_FEN);
  });

  it("rejects malformed placements", () => {
    assert.equal(parseFenLoose(""), undefined);
    assert.equal(parseFenLoose("8/8/8/8/8/8/8"), undefined);
    assert.equal(parseFenLoose("9/8/8/8/8/8/8/8"), undefined);
    assert.equal(parseFenLoose("7/8/8/8/8/8/8/8"), undefined);
    assert.equal(parseFenLoose("hello world"), undefined);
  });
});
