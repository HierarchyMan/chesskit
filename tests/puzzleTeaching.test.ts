import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { OFFLINE_PUZZLES } from "@/lib/offlinePuzzles";
import {
  PUZZLE_PACE,
  formatLine,
  MOVE_TIMES,
  isMoveTime,
  lineFromGame,
  pacedMs,
} from "@/lib/puzzleFlow";
import { buildHints } from "@/lib/puzzleHints";
import {
  displayThemes,
  mateDepth,
  prettifyTheme,
  puzzleMotifs,
  themeInfo,
} from "@/lib/puzzleThemes";
import { Puzzle, puzzleFromLichess, puzzleSetup } from "@/lib/puzzles";
import { extractMistakes } from "@/lib/mistakes";
import { Game } from "@/types/game";

const fork: Puzzle = {
  id: "fork",
  fen: "r3k3/8/8/8/3N4/8/8/4K3 w - - 0 1",
  solution: ["d4c6", "e8d7", "c6a7"],
  themes: ["fork", "short", "middlegame"],
  source: "offline",
};

describe("the setup move", () => {
  it("is bundled with every offline puzzle and leads to its position", () => {
    for (const puzzle of OFFLINE_PUZZLES) {
      const setup = puzzleSetup(puzzle);
      assert.ok(setup, `${puzzle.id} lost its setup move`);

      const game = new Chess(setup.fen);
      game.move({
        from: setup.uci.slice(0, 2),
        to: setup.uci.slice(2, 4),
        promotion: setup.uci.slice(4, 5) || undefined,
      });
      assert.equal(game.fen().split(" ")[0], puzzle.fen.split(" ")[0]);
      assert.equal(game.turn(), new Chess(puzzle.fen).turn());
    }
  });

  it("is dropped when the move does not lead to the puzzle", () => {
    const puzzle = OFFLINE_PUZZLES[0];
    assert.equal(puzzleSetup({ ...puzzle, lastMove: "a2a3" }), undefined);
    assert.equal(puzzleSetup({ ...puzzle, setupFen: undefined }), undefined);
    assert.equal(puzzleSetup({ ...puzzle, lastMove: undefined }), undefined);
    assert.equal(puzzleSetup({ ...puzzle, setupFen: "not a fen" }), undefined);
  });

  it("is rebuilt from the game a Lichess puzzle came from", () => {
    const puzzle = puzzleFromLichess({
      game: { pgn: "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6" },
      puzzle: {
        id: "x",
        rating: 1500,
        solution: ["f3e5"],
        themes: ["short"],
        initialPly: 7,
      },
    });

    assert.equal(puzzle.lastMove, "d7c6");
    const setup = puzzleSetup(puzzle);
    assert.ok(setup);
    assert.equal(
      setup.fen,
      "r1bqkbnr/1ppp1ppp/p1B5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4"
    );
    assert.equal(setup.uci, "d7c6");
  });

  it("stays absent when the game cannot be replayed but the position is known", () => {
    const puzzle = puzzleFromLichess({
      game: { pgn: "this is not a game" },
      puzzle: {
        id: "y",
        rating: 1200,
        solution: ["e2e4"],
        themes: [],
        initialPly: 3,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        lastMove: "e7e5",
      },
    });

    assert.equal(puzzleSetup(puzzle), undefined);
    assert.equal(puzzle.lastMove, "e7e5");
  });

  it("carries the move before a mistake into its puzzle", () => {
    const game = {
      id: 1,
      white: { name: "You" },
      black: { name: "Bot" },
      pgn: "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6",
      eval: {
        positions: Array.from({ length: 7 }, (_, index) => ({
          lines: [{ pv: ["e2e4"], cp: index === 6 ? 900 : 0, depth: 10 }],
          moveClassification: index === 6 ? "blunder" : "okay",
        })),
      },
    } as unknown as Game;

    const [entry] = extractMistakes(game, ["blunder" as never]);
    assert.ok(entry);
    assert.equal(entry.previousUci, "f1c4");
    assert.equal(
      entry.previousFen,
      "r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3"
    );
  });
});

describe("hints", () => {
  it("narrow from the idea to the piece to the move", () => {
    const hints = buildHints(fork, fork.fen, 0);
    assert.deepEqual(
      hints.map((hint) => hint.kind),
      ["motif", "piece", "move"]
    );
    assert.match(hints[0].text, /two things at once/);
    assert.deepEqual(hints[1], {
      kind: "piece",
      text: "Move your knight.",
      square: "d4",
    });
    assert.deepEqual(hints[2], {
      kind: "move",
      text: "Your knight goes to c6.",
      from: "d4",
      to: "c6",
    });
  });

  it("do not name the move before the last hint", () => {
    const [motif, piece] = buildHints(fork, fork.fen, 0);
    assert.doesNotMatch(motif.text + piece.text, /c6/);
  });

  it("start from a general nudge when the puzzle has no idea to name", () => {
    const [first] = buildHints({ ...fork, themes: ["short"] }, fork.fen, 0);
    assert.equal(first.kind, "motif");
    assert.match(first.text, /check, capture and threat/);
  });

  it("name the idea only once, then go straight to the piece", () => {
    const later = new Chess(fork.fen);
    later.move("Nc6");
    later.move("Kd7");
    const hints = buildHints(fork, later.fen(), 2);
    assert.deepEqual(
      hints.map((hint) => hint.kind),
      ["piece", "move"]
    );
  });

  it("are empty when there is no move left or no piece to move", () => {
    assert.deepEqual(buildHints(fork, fork.fen, 3), []);
    assert.deepEqual(
      buildHints({ ...fork, solution: ["a1a2"] }, fork.fen, 0),
      []
    );
  });
});

describe("themes", () => {
  it("make readable labels from Lichess ids", () => {
    assert.equal(prettifyTheme("kingsideAttack"), "Kingside attack");
    assert.equal(prettifyTheme("Your mistake"), "Your mistake");
    assert.equal(themeInfo("mateIn3").label, "Mate in 3");
    assert.equal(themeInfo("rookEndgame").label, "Rook endgame");
    assert.equal(themeInfo("somethingNew").label, "Something new");
  });

  it("explain the ideas a solver can act on", () => {
    for (const id of ["fork", "pin", "skewer", "backRankMate", "sacrifice"]) {
      assert.ok(themeInfo(id).explain, `${id} has no explanation`);
      assert.ok(themeInfo(id).hint, `${id} has no hint`);
    }
    assert.match(themeInfo("mateIn2").hint ?? "", /2/);
  });

  it("find the ideas among a puzzle's themes, and hide the rest from chips", () => {
    const themes = ["short", "mateIn2", "middlegame", "fork", "mix"];
    assert.deepEqual(
      puzzleMotifs(themes).map((theme) => theme.id),
      ["mateIn2", "fork"]
    );
    assert.deepEqual(
      displayThemes(themes).map((theme) => theme.id),
      ["mateIn2", "middlegame", "fork"]
    );
    assert.equal(mateDepth("mateIn4"), 4);
    assert.equal(mateDepth("mate"), undefined);
  });

  it("cover the ideas used by the bundled puzzles", () => {
    for (const puzzle of OFFLINE_PUZZLES) {
      for (const id of puzzle.themes) {
        assert.ok(themeInfo(id).label.length > 0);
      }
    }
  });
});

describe("pace", () => {
  it("scales with the animation speed but never collapses", () => {
    assert.equal(pacedMs(PUZZLE_PACE.reply, 1), PUZZLE_PACE.reply);
    assert.equal(
      pacedMs(PUZZLE_PACE.reply, 1.7),
      Math.round(PUZZLE_PACE.reply * 1.7)
    );
    assert.equal(pacedMs(PUZZLE_PACE.reply, 0), PUZZLE_PACE.reply / 2);
  });

  it("follows the move time the user picked", () => {
    assert.equal(pacedMs(PUZZLE_PACE.reply, 1, "slow"), PUZZLE_PACE.reply * 2);
    assert.equal(pacedMs(PUZZLE_PACE.reply, 1, "fast"), PUZZLE_PACE.reply / 2);
    assert.equal(pacedMs(PUZZLE_PACE.reply, 1, "medium"), PUZZLE_PACE.reply);
  });

  it("offers fast, medium and slow, in that order, and rejects anything else", () => {
    assert.deepEqual(
      MOVE_TIMES.map(({ id }) => id),
      ["fast", "medium", "slow"]
    );
    assert.ok(isMoveTime("slow"));
    assert.ok(!isMoveTime("2"));
    assert.ok(!isMoveTime(undefined));
  });

  it("gives about a second and a half before the opponent replies", () => {
    assert.ok(PUZZLE_PACE.reply >= 1500);
  });
});

describe("the line", () => {
  const played = new Chess(
    "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3"
  );
  played.move("Nf6");
  played.move("Qxf7#");

  it("leaves out the setup move and numbers the rest", () => {
    const line = lineFromGame(played, 0, "b");
    assert.deepEqual(
      line.map((move) => [move.ply, move.san, move.number, move.mine]),
      [
        [1, "Nf6", 3, true],
        [2, "Qxf7#", 4, false],
      ]
    );

    const withSetup = lineFromGame(played, 1, "w");
    assert.deepEqual(
      withSetup.map((move) => move.san),
      ["Qxf7#"]
    );
  });

  it("is written the way a score sheet writes it", () => {
    assert.equal(formatLine(lineFromGame(played, 0, "b")), "3... Nf6 4. Qxf7#");
  });
});
