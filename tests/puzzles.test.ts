import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MoveClassification } from "@/types/enums";
import { MistakeEntry } from "@/lib/mistakes";
import {
  Puzzle,
  checkPuzzleMove,
  mistakeToPuzzle,
  puzzleFromLichess,
  solverColor,
} from "@/lib/puzzles";

const DAILY = {
  game: {
    id: "zITLWL0Y",
    pgn: "e4 c6 d4 d5 exd5 cxd5 Bd3 Nf6 Bf4 Qb6 Nf3 Qxb2 Nbd2 e6 O-O Be7 Nb3 O-O Ng5 Nbd7 Qd2 Qa3 Rfe1 Bd6 Be5 a5 Re3 a4 Na5 Bb4 Bxh7+ Nxh7 c3 Bxa5 Nxh7 Kxh7",
  },
  puzzle: {
    id: "85dvN",
    rating: 1842,
    solution: ["e3h3", "h7g8", "h3h8", "g8h8", "d2h6", "h8g8", "h6g7"],
    themes: ["veryLong", "middlegame", "mateIn4"],
    initialPly: 35,
    fen: "r1b2r2/1p1n1ppk/4p3/b2pB3/p2P4/q1P1R3/P2Q1PPP/R5K1 w - - 0 1",
    lastMove: "g8h7",
  },
};

describe("puzzleFromLichess", () => {
  it("uses the position the service provides", () => {
    const puzzle = puzzleFromLichess(DAILY);
    assert.equal(puzzle.fen, DAILY.puzzle.fen);
    assert.equal(puzzle.url, "https://lichess.org/training/85dvN");
    assert.equal(puzzle.source, "lichess");
  });

  it("rebuilds the position from the game when it is missing", () => {
    const { fen, lastMove, ...rest } = DAILY.puzzle;
    void lastMove;
    const puzzle = puzzleFromLichess({ ...DAILY, puzzle: rest });

    assert.equal(puzzle.fen.split(" ")[0], fen.split(" ")[0]);
    assert.equal(puzzle.lastMove, "g8h7");
    assert.equal(solverColor(puzzle), "w");
  });
});

describe("checkPuzzleMove", () => {
  const puzzle: Puzzle = {
    id: "t",
    fen: "6k1/5ppp/8/8/8/8/5PPP/R2R2K1 w - - 0 1",
    solution: ["a1a8"],
    themes: [],
    source: "offline",
  };

  it("accepts the solution move", () => {
    assert.equal(checkPuzzleMove(puzzle, 0, puzzle.fen, "a1a8"), "correct");
  });

  it("accepts a different move that also mates", () => {
    assert.equal(checkPuzzleMove(puzzle, 0, puzzle.fen, "d1d8"), "mate");
  });

  it("rejects other moves and illegal moves", () => {
    assert.equal(checkPuzzleMove(puzzle, 0, puzzle.fen, "a1a2"), "wrong");
    assert.equal(checkPuzzleMove(puzzle, 0, puzzle.fen, "a1h8"), "wrong");
  });
});

describe("mistakeToPuzzle", () => {
  const entry = {
    gameId: 3,
    gameLabel: "You vs Bot",
    ply: 6,
    moveNumber: 3,
    color: "b",
    san: "Nf6",
    classification: MoveClassification.Blunder,
    fenBefore:
      "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
    playedUci: "g8f6",
    bestUci: "d7d6",
    beforeLines: [],
    afterLines: [],
    lostPercentage: 60,
    mine: true,
  } as MistakeEntry;

  it("turns the missed best move into the solution", () => {
    const puzzle = mistakeToPuzzle(entry);
    assert.deepEqual(puzzle?.solution, ["d7d6"]);
    assert.equal(puzzle?.source, "mistake");
    assert.match(puzzle?.description ?? "", /Nf6/);
  });

  it("returns nothing when no better move is known", () => {
    assert.equal(mistakeToPuzzle({ ...entry, bestUci: undefined }), undefined);
  });
});
