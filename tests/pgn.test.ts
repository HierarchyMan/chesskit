import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import {
  detectInput,
  loadGameFromText,
  normalizeFen,
  parseGames,
  parseLichessUrl,
  splitPgnGames,
} from "@/lib/pgn";

const TWO_GAMES = `[Event "A"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0

[Event "B"]
[White "Carol"]
[Black "Dave"]
[Result "0-1"]

1. d4 d5 0-1
`;

describe("splitPgnGames", () => {
  it("keeps a single game whole", () => {
    assert.equal(splitPgnGames("1. e4 e5 2. Nf3 Nc6").length, 1);
  });

  it("splits games separated by tag blocks", () => {
    const chunks = splitPgnGames(TWO_GAMES);
    assert.equal(chunks.length, 2);
    assert.match(chunks[0], /Alice/);
    assert.match(chunks[1], /Carol/);
  });

  it("handles windows line endings and a byte order mark", () => {
    const chunks = splitPgnGames("﻿" + TWO_GAMES.replace(/\n/g, "\r\n"));
    assert.equal(chunks.length, 2);
  });

  it("splits header-less games on their result tokens", () => {
    const chunks = splitPgnGames("1. e4 e5 1-0\n\n1. d4 d5 0-1");
    assert.equal(chunks.length, 2);
  });

  it("does not split on clock comments that look like tags", () => {
    const pgn = '[Event "x"]\n\n1. e4 {\n[%clk 0:03:00]\n} e5 *';
    assert.equal(splitPgnGames(pgn).length, 1);
  });
});

describe("parseGames", () => {
  it("returns every game with its players", () => {
    const games = parseGames(TWO_GAMES);
    assert.deepEqual(
      games.map((game) => [game.white, game.black, game.movesNb]),
      [
        ["Alice", "Bob", 7],
        ["Carol", "Dave", 2],
      ]
    );
  });

  it("reports unreadable games instead of dropping them", () => {
    const games = parseGames('[Event "x"]\n\n1. e4 e5 2. Ke7 *');
    assert.equal(games.length, 1);
    assert.ok(games[0].error);
  });
});

describe("loadGameFromText", () => {
  const cases: Record<string, [string, number]> = {
    "zero castling": [
      "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. 0-0 0-0",
      12,
    ],
    "long zero castling": [
      "1. d4 d5 2. Nc3 Nc6 3. Bf4 Bf5 4. Qd2 Qd7 5. 0-0-0 0-0-0",
      10,
    ],
    "figurine notation": ["1. e4 e5 2. ♘f3 ♞c6", 4],
    "en passant suffix": ["1. e4 a6 2. e5 d5 3. exd6 e.p. Nf6", 6],
    "unicode dashes": ["1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O–O Bc5", 8],
    "move annotations": ["1. e4! e5? 2. Nf3!! Nc6?! 3. Bb5 a6", 6],
    "clock comments": [
      "1. e4 {[%clk 0:03:00]} 1... e5 {[%clk 0:02:59]} 2. Nf3 *",
      3,
    ],
    "bare moves": ["e4 e5 Nf3 Nc6", 4],
    "variations": ["1. e4 e5 (1... c5 2. Nf3) 2. Nf3 Nc6 1-0", 4],
  };

  for (const [name, [pgn, plies]] of Object.entries(cases)) {
    it(`reads ${name}`, () => {
      assert.equal(loadGameFromText(pgn).history().length, plies);
    });
  }

  it("keeps castling zeros inside comments untouched", () => {
    const game = loadGameFromText("1. e4 {play 0-0 later} e5 *");
    assert.equal(game.history().length, 2);
  });

  it("reads back the pgn chess.js writes for a game without moves", () => {
    const fen = "r3k3/8/8/8/4P3/8/8/3QK3 w - - 0 1";

    assert.equal(loadGameFromText(new Chess(fen).pgn()).fen(), fen);
    assert.equal(
      loadGameFromText(new Chess().pgn()).fen(),
      new Chess().fen()
    );
  });

  it("reads a header-only game", () => {
    const game = loadGameFromText('[Event "x"]\n[White "a"]');
    assert.equal(game.history().length, 0);
  });

  it("does not turn results into castling", () => {
    const game = loadGameFromText("1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0");
    assert.equal(game.history().length, 7);
    assert.ok(game.isCheckmate());
  });

  it("throws a single-line message for illegal moves", () => {
    assert.throws(() => loadGameFromText("1. e4 e5 2. Ke7"), (error: Error) => {
      return !error.message.includes("\n");
    });
  });
});

describe("normalizeFen", () => {
  it("accepts a full FEN", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    assert.equal(normalizeFen(fen), fen);
  });

  it("completes a piece placement only", () => {
    assert.equal(
      normalizeFen("8/8/8/4k3/8/8/4K3/4R3"),
      "8/8/8/4k3/8/8/4K3/4R3 w - - 0 1"
    );
  });

  it("rejects non-positions", () => {
    assert.equal(normalizeFen("hello world"), undefined);
    assert.equal(normalizeFen("8/8/8/8/8/8/8/8 w - - 0 1"), undefined);
  });
});

describe("parseLichessUrl", () => {
  it("reads game urls with and without colour suffix", () => {
    assert.deepEqual(parseLichessUrl("https://lichess.org/AbCdEfGh"), {
      id: "AbCdEfGh",
      orientation: undefined,
    });
    assert.deepEqual(parseLichessUrl("lichess.org/AbCdEfGh/black"), {
      id: "AbCdEfGh",
      orientation: "black",
    });
    assert.equal(parseLichessUrl("https://lichess.org/AbCdEfGhIjKl")?.id, "AbCdEfGh");
  });

  it("ignores site pages that have eight letters", () => {
    assert.equal(parseLichessUrl("https://lichess.org/training"), undefined);
    assert.equal(parseLichessUrl("https://lichess.org/analysis"), undefined);
  });
});

describe("detectInput", () => {
  it("recognises each kind of paste", () => {
    assert.equal(detectInput(TWO_GAMES).kind, "pgn");
    assert.equal(detectInput("8/8/8/4k3/8/8/4K3/4R3 w - - 0 1").kind, "fen");
    assert.equal(detectInput("https://lichess.org/AbCdEfGh").kind, "lichess");
    assert.equal(detectInput("e4 e5 Nf3 Nc6").kind, "pgn");
    assert.equal(detectInput("just some words").kind, "unknown");
    assert.equal(detectInput("   ").kind, "unknown");
  });

  it("returns every game of a multi-game paste", () => {
    const detected = detectInput(TWO_GAMES);
    assert.equal(detected.kind === "pgn" && detected.games.length, 2);
  });
});
