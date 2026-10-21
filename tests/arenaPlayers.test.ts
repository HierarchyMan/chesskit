import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { setGameHeaders } from "@/lib/chess";
import { loadGameFromText } from "@/lib/pgn";
import {
  playerChangeEffect,
  playerChangeNote,
} from "@/sections/arena/playerChanges";

describe("arena player changes", () => {
  it("never touches a match that has not begun", () => {
    assert.equal(
      playerChangeEffect({ started: false, over: false, moveCount: 0 }),
      "none"
    );
  });

  it("never touches a finished match, so its record and board stay", () => {
    assert.equal(
      playerChangeEffect({ started: true, over: true, moveCount: 12 }),
      "none"
    );
  });

  it("rebuilds the start of a match that has no moves yet", () => {
    assert.equal(
      playerChangeEffect({ started: true, over: false, moveCount: 0 }),
      "rebuild-start"
    );
  });

  it("keeps a running match and notes the change once moves exist", () => {
    assert.equal(
      playerChangeEffect({ started: true, over: false, moveCount: 1 }),
      "note-position"
    );
    assert.equal(
      playerChangeEffect({ started: true, over: false, moveCount: 40 }),
      "note-position"
    );
  });

  it("describes both sides in the note", () => {
    assert.equal(
      playerChangeNote("Reckless (2500)", "Stockfish 18 Lite (max)"),
      "From here: White is Reckless (2500), Black is Stockfish 18 Lite (max)."
    );
  });
});

describe("arena game record across a player change", () => {
  // Mirrors useArena: the match begins with its headers, moves are played,
  // a change is noted on the current position, and the match is finished.
  const beginMatch = () => {
    const game = new Chess();
    setGameHeaders(game, {
      white: { name: "Stockfish 18 Lite (max)" },
      black: { name: "Reckless (2500)" },
    });
    return game;
  };

  const finish = (game: Chess) => {
    const copy = new Chess();
    copy.loadPgn(game.pgn());
    setGameHeaders(copy, {});
    return copy;
  };

  it("keeps the starting headers after a player change mid-match", () => {
    const game = beginMatch();
    game.move("e4");
    game.move("e5");
    game.setComment(playerChangeNote("Reckless (1800)", "Reckless (2500)"));

    const saved = finish(game);
    assert.equal(saved.getHeaders().White, "Stockfish 18 Lite (max)");
    assert.equal(saved.getHeaders().Black, "Reckless (2500)");
  });

  it("writes the note on the position where the change happened", () => {
    const game = beginMatch();
    game.move("e4");
    game.setComment(playerChangeNote("A", "B"));
    game.move("e5");

    const reloaded = loadGameFromText(game.pgn());
    assert.equal(reloaded.history().length, 2);
    assert.match(reloaded.pgn(), /e4 \{From here: White is A, Black is B\.\}/);
    assert.doesNotMatch(reloaded.pgn(), /e5 \{/);
  });

  it("keeps the note when a takeback copy is reloaded from PGN", () => {
    const game = beginMatch();
    game.move("e4");
    game.setComment(playerChangeNote("A", "B"));
    game.move("e5");
    game.undo();

    const reloaded = loadGameFromText(game.pgn());
    assert.equal(reloaded.getComment(), playerChangeNote("A", "B"));
  });
});
