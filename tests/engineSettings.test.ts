import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_ENGINE } from "@/constants";
import {
  COACH_DIALOGUE_DEPTH_RANGE,
  COACH_GRADING_DEPTH_RANGE,
  COACH_GRADING_MULTIPV_RANGE,
  getBotEffectiveSearch,
  isCoachDialogueMovetimeMs,
  resolveCoachDialogueSearch,
  resolveInheritedDepth,
  resolveInheritedMultiPv,
} from "@/lib/engine/engineSettings";
import {
  ENGINE_FEATURES,
  ENGINE_INHERIT_SOURCES,
  featureEngineAtoms,
  isEngineChoice,
  resolveEngineChoice,
} from "@/lib/engine/featureEngines";
import { EngineName } from "@/types/enums";

describe("feature engine inheritance", () => {
  it("exposes an atom and inherit sources for every declared feature", () => {
    for (const feature of ENGINE_FEATURES) {
      assert.ok(feature.id in featureEngineAtoms, feature.id);
      assert.ok(feature.id in ENGINE_INHERIT_SOURCES, feature.id);
      assert.ok(ENGINE_INHERIT_SOURCES[feature.id].includes("analysis"));
    }
    assert.ok(ENGINE_INHERIT_SOURCES.coachDialogue.includes("coach"));
    assert.ok(ENGINE_INHERIT_SOURCES.coachDialogue.includes("bot"));
  });

  it("accepts inherit sources and reliable engines as valid choices", () => {
    assert.equal(isEngineChoice("analysis"), true);
    assert.equal(isEngineChoice("coach"), true);
    assert.equal(isEngineChoice("bot"), true);
    assert.equal(isEngineChoice(EngineName.Stockfish19), true);
    assert.equal(isEngineChoice(EngineName.Drawfish), false);
    assert.equal(isEngineChoice("unknown-source"), false);
  });

  it("resolves bot and coach inheritance with joke-engine safety", () => {
    assert.equal(
      resolveEngineChoice("bot", EngineName.Stockfish19, {
        botEngine: EngineName.Reckless,
      }),
      EngineName.Reckless
    );
    // Joke bot falls back safely to the analysis engine (or DEFAULT_ENGINE).
    assert.equal(
      resolveEngineChoice("bot", EngineName.Stockfish19, {
        botEngine: EngineName.Drawfish,
      }),
      EngineName.Stockfish19
    );
    assert.equal(
      resolveEngineChoice("bot", EngineName.Drawfish, {
        botEngine: EngineName.Worstfish,
      }),
      DEFAULT_ENGINE
    );
    // Dialogue inheriting from Coach Grading follows Coach Grading's own target.
    assert.equal(
      resolveEngineChoice("coach", EngineName.Stockfish19Lite, {
        coachChoice: EngineName.Stockfish19,
        botEngine: EngineName.Reckless,
      }),
      EngineName.Stockfish19
    );
    assert.equal(
      resolveEngineChoice("coach", EngineName.Stockfish19Lite, {
        coachChoice: "bot",
        botEngine: EngineName.Reckless,
      }),
      EngineName.Reckless
    );
  });
});

describe("engine search settings & inheritance", () => {
  it("validates coach dialogue movetimeMs (0 for depth mode, or 50..3000 ms)", () => {
    assert.equal(isCoachDialogueMovetimeMs(0), true);
    assert.equal(isCoachDialogueMovetimeMs(50), true);
    assert.equal(isCoachDialogueMovetimeMs(180), true);
    assert.equal(isCoachDialogueMovetimeMs(3000), true);
    assert.equal(isCoachDialogueMovetimeMs(10), false);
    assert.equal(isCoachDialogueMovetimeMs(49), false);
    assert.equal(isCoachDialogueMovetimeMs(3001), false);
    assert.equal(isCoachDialogueMovetimeMs(180.5), false);
    assert.equal(isCoachDialogueMovetimeMs("180"), false);
  });

  it("derives effective search parameters from bot strength", () => {
    assert.deepEqual(
      getBotEffectiveSearch({ mode: "depth", elo: 1500, depth: 16 }, 3000),
      { depth: 16, movetimeMs: 0 }
    );
    assert.deepEqual(
      getBotEffectiveSearch({ mode: "max", elo: 3200, depth: 8 }, 2500),
      { depth: 16, movetimeMs: 2500 }
    );
    const eloBot = getBotEffectiveSearch(
      { mode: "elo", elo: 1500, depth: 8 },
      3000
    );
    assert.ok(eloBot.depth >= 4 && eloBot.depth <= 30);
    assert.equal(eloBot.movetimeMs, 0);
  });

  it("resolves and clamps inherited depth and MultiPV across modes", () => {
    assert.equal(
      resolveInheritedDepth("custom", 11, COACH_GRADING_DEPTH_RANGE, {
        analysisDepth: 22,
        botDepth: 16,
      }),
      11
    );
    assert.equal(
      resolveInheritedDepth("analysis", 11, COACH_GRADING_DEPTH_RANGE, {
        analysisDepth: 30, // exceeds max 24 -> clamped
        botDepth: 16,
      }),
      COACH_GRADING_DEPTH_RANGE.max
    );
    assert.equal(
      resolveInheritedDepth("bot", 11, COACH_GRADING_DEPTH_RANGE, {
        analysisDepth: 22,
        botDepth: 16,
      }),
      16
    );
    assert.equal(
      resolveInheritedMultiPv("analysis", 2, COACH_GRADING_MULTIPV_RANGE, {
        analysisMultiPv: 5,
      }),
      5
    );
  });

  it("resolves coach dialogue settings across custom, analysis, coach, and bot", () => {
    const custom = { depth: 7, multiPv: 2, movetimeMs: 180 };
    const sources = {
      analysisDepth: 26, // clamps to COACH_DIALOGUE_DEPTH_RANGE.max (20)
      analysisMultiPv: 4,
      coachDepth: 12,
      coachMultiPv: 3,
      botDepth: 16,
      botMovetimeMs: 0,
    };

    assert.deepEqual(resolveCoachDialogueSearch("custom", custom, sources), custom);
    assert.deepEqual(resolveCoachDialogueSearch("analysis", custom, sources), {
      depth: COACH_DIALOGUE_DEPTH_RANGE.max,
      multiPv: 4,
      movetimeMs: 0,
    });
    assert.deepEqual(resolveCoachDialogueSearch("coach", custom, sources), {
      depth: 12,
      multiPv: 3,
      movetimeMs: 0,
    });
    assert.deepEqual(resolveCoachDialogueSearch("bot", custom, sources), {
      depth: 16,
      multiPv: 2,
      movetimeMs: 0,
    });
    assert.deepEqual(
      resolveCoachDialogueSearch("bot", custom, {
        ...sources,
        botMovetimeMs: 2000,
      }),
      {
        depth: 16,
        multiPv: 2,
        movetimeMs: 2000,
      }
    );
  });
});
