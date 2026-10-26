import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { parseEvaluationResults } from "@/lib/engine/helpers/parseResults";
import {
  JOKE_STRATEGIES,
  isJokeEngineName,
} from "@/lib/engine/jokes/strategies";
import {
  ENGINE_MODELS,
  engineMaxElo,
  getEngineModel,
  isAnalysisEngineId,
  isReliableEngineId,
  isEngineId,
  nativeModelFromInfo,
  setNativeEngines,
} from "@/lib/engine/models";
import {
  parseUciOption,
  parseUciOptions,
  setSpinOption,
} from "@/lib/engine/uciOptions";
import { DEFAULT_ENGINE } from "@/constants";
import {
  isEngineChoice,
  resolveEngineChoice,
} from "@/lib/engine/featureEngines";
import { EngineName } from "@/types/enums";

const START = new Chess().fen();

describe("engine registry", () => {
  it("lets joke engines run analysis but never trusts their evaluations", () => {
    for (const model of Object.values(ENGINE_MODELS)) {
      if (model.source !== "builtin") continue;
      assert.ok(isJokeEngineName(model.name), model.name);
      assert.equal(model.roles.analysis, true, model.name);
      assert.equal(model.reliableEval, false, model.name);
      assert.equal(model.playsOwnMoves, true, model.name);
      assert.equal(isAnalysisEngineId(model.name), true, model.name);
      assert.equal(isReliableEngineId(model.name), false, model.name);
    }
    assert.equal(
      Object.keys(JOKE_STRATEGIES).length,
      Object.values(ENGINE_MODELS).filter((model) => model.source === "builtin")
        .length
    );
  });

  it("raises the Elo ceiling to each engine's rating", () => {
    assert.equal(engineMaxElo(EngineName.Reckless), 3766);
    assert.equal(engineMaxElo(EngineName.Stockfish19), 3792);
    assert.equal(engineMaxElo(EngineName.LozzaMat), 2050);
    // No published rating: the old default ceiling.
    assert.equal(engineMaxElo(EngineName.Stockfish18Lite), 3200);
  });

  it("accepts native engine ids and describes them from the bridge listing", () => {
    assert.equal(isEngineId("native:berserk"), true);
    assert.equal(isEngineId("native:"), false);
    assert.equal(isEngineId("berserk"), false);

    setNativeEngines([
      {
        id: "berserk",
        name: "Berserk 13",
        elo: 3700,
        options: [
          { name: "MultiPV", min: 1, max: 218 },
          { name: "UCI_Elo", min: 1500, max: 3000 },
        ],
      },
      { id: "reckless", name: "Reckless" },
    ]);
    const model = getEngineModel("native:berserk");
    assert.equal(model.label.small, "Berserk 13");
    assert.equal(model.source, "bridge");
    assert.equal(model.maxMultiPv, 218);
    assert.deepEqual(model.nativeElo, { min: 1500, max: 3000 });
    assert.equal(engineMaxElo("native:berserk"), 3700);
    // Reckless stays the built-in entry rather than turning up twice.
    assert.equal(
      getEngineModel("native:reckless").description,
      "Not reported by the bridge right now."
    );
    setNativeEngines([]);
  });

  it("reads a native engine without MultiPV as one line", () => {
    assert.equal(nativeModelFromInfo({ id: "x", name: "X" }).maxMultiPv, 1);
  });
});

describe("feature engine choice", () => {
  it("falls back to the default engine when the analysis engine is a joke", () => {
    assert.equal(
      resolveEngineChoice("analysis", EngineName.Drawfish),
      DEFAULT_ENGINE
    );
    assert.equal(
      resolveEngineChoice("analysis", EngineName.LozzaBeal),
      DEFAULT_ENGINE
    );
    assert.equal(
      resolveEngineChoice("analysis", EngineName.Reckless),
      EngineName.Reckless
    );
    // An explicit choice is respected; the picker only offers real engines.
    assert.equal(
      resolveEngineChoice(EngineName.Stockfish19, EngineName.Drawfish),
      EngineName.Stockfish19
    );
  });

  it("accepts only real-evaluation engines as a feature's own choice", () => {
    assert.equal(isEngineChoice(EngineName.Drawfish), false);
    assert.equal(isEngineChoice(EngineName.LozzaBeal), false);
    assert.equal(isEngineChoice(EngineName.LozzaMat), true);
    assert.equal(isEngineChoice("analysis"), true);
  });
});

describe("UCI options", () => {
  it("parses names with spaces and numeric ranges", () => {
    assert.deepEqual(parseUciOption("option name Clear Hash type button"), {
      name: "Clear Hash",
      type: "button",
    });
    assert.deepEqual(
      parseUciOption(
        "option name UCI_Elo type spin default 1320 min 1320 max 3190"
      ),
      { name: "UCI_Elo", type: "spin", default: "1320", min: 1320, max: 3190 }
    );
    assert.equal(parseUciOption("id name Lozza"), undefined);
  });

  it("clamps setoption values and skips options the engine lacks", () => {
    const options = parseUciOptions([
      "option name Hash type spin default 32 min 1 max 256",
      "option name Threads type spin default 1 min 1 max 1",
    ]);
    assert.equal(
      setSpinOption(options, "Hash", 1024),
      "setoption name Hash value 256"
    );
    assert.equal(
      setSpinOption(options, "threads", 8),
      "setoption name Threads value 1"
    );
    assert.equal(setSpinOption(options, "MultiPV", 3), undefined);
  });
});

describe("evaluation parser across engines", () => {
  it("reads lines without multipv as the first line (tomitankChess)", () => {
    const result = parseEvaluationResults(
      [
        "info currmove e2e4 depth 7 score cp 31 nodes 1000 time 20 pv e2e4 e7e5",
        "bestmove e2e4",
      ],
      START
    );
    assert.equal(result.lines.length, 1);
    assert.equal(result.lines[0].cp, 31);
    assert.equal(result.lines[0].depth, 7);
    assert.equal(result.bestMove, "e2e4");
  });

  it("keeps the exact score over a bound at the same depth", () => {
    const result = parseEvaluationResults(
      [
        "info depth 10 multipv 1 score cp 20 pv e2e4",
        "info depth 10 multipv 1 score cp 90 lowerbound pv d2d4",
      ],
      START
    );
    assert.equal(result.lines[0].cp, 20);
  });

  it("never lets a bound from the next depth replace an exact line", () => {
    // Reckless prints these while it re-searches one move; the move in them is
    // a refuted one whose score is only the edge of the search window.
    const result = parseEvaluationResults(
      [
        "info depth 26 multipv 3 score cp -165 pv e7e6 f1e2",
        "info depth 27 multipv 3 score cp -181 upperbound pv c8a6 b5a6",
      ],
      "rnbqkb1r/p2ppppp/5n2/1Pp5/8/4PN2/PP1P1PPP/RNBQKB1R b KQkq - 0 4"
    );
    assert.equal(result.lines.length, 1);
    assert.equal(result.lines[0].pv[0], "e7e6");
    assert.equal(result.lines[0].bound, undefined);
  });

  it("marks a bound that fills an empty slot, and an exact line replaces it", () => {
    const bounded = parseEvaluationResults(
      ["info depth 5 multipv 1 score cp 40 lowerbound pv e2e4"],
      START
    );
    assert.equal(bounded.lines[0].bound, true);

    const exact = parseEvaluationResults(
      [
        "info depth 5 multipv 1 score cp 40 lowerbound pv e2e4",
        "info depth 4 multipv 1 score cp 25 pv d2d4",
      ],
      START
    );
    assert.equal(exact.lines[0].pv[0], "d2d4");
    assert.equal(exact.lines[0].bound, undefined);
  });
});

describe("joke strategies", () => {
  const context = (fen: string, scores?: Record<string, number>) => {
    const game = new Chess(fen);
    return {
      fen,
      moves: game.moves({ verbose: true }),
      scores: scores ? new Map(Object.entries(scores)) : undefined,
      random: () => 0.5,
    };
  };

  it("Drawfish keeps the score closest to zero, Worstfish takes the lowest", () => {
    // White can take a free queen (big plus), or play quieter moves.
    const fen = "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1";
    // Kd1 and Kd2 are illegal: the queen covers the d-file.
    const scores: Record<string, number> = {
      e4d5: 900,
      e4e5: -850,
      e1e2: -810,
      e1f1: -790,
      e1f2: -30,
    };
    assert.equal(
      JOKE_STRATEGIES[EngineName.Drawfish](context(fen, scores))[0],
      "e1f2"
    );
    assert.equal(
      JOKE_STRATEGIES[EngineName.Worstfish](context(fen, scores))[0],
      "e4e5"
    );
  });

  it("CCCP mates first, then checks, then captures", () => {
    // Back-rank mate in one with Ra8#.
    const fen = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1";
    assert.equal(JOKE_STRATEGIES[EngineName.Cccp](context(fen))[0], "a1a8");
  });

  it("Pacifist avoids captures and checks while it has a choice", () => {
    const fen = "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1";
    const ranked = JOKE_STRATEGIES[EngineName.Pacifist](
      context(fen, { e4d5: 900 })
    );
    assert.notEqual(ranked[0], "e4d5");
    assert.equal(ranked.at(-1), "e4d5");
  });

  it("Bongcloud moves the king when it can", () => {
    const ranked = JOKE_STRATEGIES[EngineName.Bongcloud](
      context("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2")
    );
    assert.equal(ranked[0], "e1e2");
  });

  it("Alphabetical sorts by notation, capitals first", () => {
    const ranked = JOKE_STRATEGIES[EngineName.Alphabetical](context(START));
    assert.equal(ranked[0], "b1a3"); // Na3
    assert.equal(ranked.at(-1), "h2h4");
  });

  it("every strategy returns each legal move exactly once", () => {
    const fen =
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    const legal = new Chess(fen).moves({ verbose: true }).length;
    for (const [name, strategy] of Object.entries(JOKE_STRATEGIES)) {
      const ranked = strategy(context(fen, {}));
      assert.equal(ranked.length, legal, name);
      assert.equal(new Set(ranked).size, legal, name);
    }
  });
});
