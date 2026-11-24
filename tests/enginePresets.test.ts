import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ARROW_TUNING_DEFAULTS } from "@/lib/arrows/tuning";
import {
  ENGINE_PRESETS,
  ENGINE_PRESET_IDS,
  ENGINE_PRESET_KEYS,
  ENGINE_PRESET_RANGES,
  EnginePresetValues,
  matchEnginePreset,
} from "@/lib/engine/enginePresets";
import {
  DEFAULT_ADVICE_DEPTH,
  DEFAULT_ADVICE_MULTIPV,
  DEFAULT_ARENA_EVAL_DEPTH,
  DEFAULT_ARENA_EVAL_MULTIPV,
  DEFAULT_BOT_DRAW_EVAL_DEPTH,
  DEFAULT_COACH_DIALOGUE_DEPTH,
  DEFAULT_COACH_DIALOGUE_MOVETIME_MS,
  DEFAULT_COACH_DIALOGUE_MULTIPV,
  DEFAULT_COACH_GRADING_DEPTH,
  DEFAULT_COACH_GRADING_MULTIPV,
} from "@/lib/engine/engineSettings";

describe("engine presets", () => {
  it("keeps every value of every preset inside its setting's range", () => {
    for (const id of ENGINE_PRESET_IDS) {
      for (const key of ENGINE_PRESET_KEYS) {
        const value = ENGINE_PRESETS[id][key];
        const { min, max } = ENGINE_PRESET_RANGES[key];
        assert.ok(Number.isInteger(value), `${id}.${key} is an integer`);
        assert.ok(
          value >= min && value <= max,
          `${id}.${key}=${value} is outside ${min}..${max}`
        );
      }
    }
  });

  it("covers every key of the values with a range", () => {
    assert.deepEqual(
      [...ENGINE_PRESET_KEYS].sort(),
      Object.keys(ENGINE_PRESETS.balanced).sort()
    );
  });

  it("makes balanced equal the app's defaults", () => {
    assert.deepEqual(ENGINE_PRESETS.balanced, {
      analysisDepth: 14,
      analysisMultiPv: 3,
      coachGradingDepth: DEFAULT_COACH_GRADING_DEPTH,
      coachGradingMultiPv: DEFAULT_COACH_GRADING_MULTIPV,
      coachDialogueDepth: DEFAULT_COACH_DIALOGUE_DEPTH,
      coachDialogueMultiPv: DEFAULT_COACH_DIALOGUE_MULTIPV,
      coachDialogueMovetimeMs: DEFAULT_COACH_DIALOGUE_MOVETIME_MS,
      adviceDepth: DEFAULT_ADVICE_DEPTH,
      adviceMultiPv: DEFAULT_ADVICE_MULTIPV,
      threatDepth: ARROW_TUNING_DEFAULTS.threatDepth,
      arenaEvalDepth: DEFAULT_ARENA_EVAL_DEPTH,
      arenaEvalMultiPv: DEFAULT_ARENA_EVAL_MULTIPV,
      botDrawEvalDepth: DEFAULT_BOT_DRAW_EVAL_DEPTH,
    });
  });

  it("orders fast <= balanced <= deep for every setting", () => {
    for (const key of ENGINE_PRESET_KEYS) {
      assert.ok(ENGINE_PRESETS.fast[key] <= ENGINE_PRESETS.balanced[key], key);
      assert.ok(ENGINE_PRESETS.balanced[key] <= ENGINE_PRESETS.deep[key], key);
    }
  });

  it("makes the presets distinct from one another", () => {
    const [fast, balanced, deep] = ENGINE_PRESET_IDS.map(
      (id) => ENGINE_PRESETS[id]
    );
    assert.notDeepEqual(fast, balanced);
    assert.notDeepEqual(balanced, deep);
    assert.notDeepEqual(fast, deep);
  });

  it("recognizes each preset from its own values", () => {
    for (const id of ENGINE_PRESET_IDS) {
      assert.equal(matchEnginePreset({ ...ENGINE_PRESETS[id] }), id);
    }
  });

  it("returns custom as soon as one value differs", () => {
    for (const id of ENGINE_PRESET_IDS) {
      for (const key of ENGINE_PRESET_KEYS) {
        const { min, max } = ENGINE_PRESET_RANGES[key];
        const base = ENGINE_PRESETS[id];
        const changed: EnginePresetValues = {
          ...base,
          [key]: base[key] + 1 <= max ? base[key] + 1 : base[key] - 1,
        };
        assert.ok(changed[key] >= min && changed[key] !== base[key]);
        assert.equal(matchEnginePreset(changed), "custom", `${id}.${key}`);
      }
    }
  });
});
