import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasNativeEloLimit } from "@/constants";
import { ENGINE_MODELS } from "@/lib/engine/models";
import { EngineName } from "@/types/enums";

describe("hasNativeEloLimit", () => {
  it("is false for engines that expose no UCI_Elo", () => {
    assert.equal(hasNativeEloLimit(EngineName.Reckless), false);
    assert.equal(hasNativeEloLimit(EngineName.Stockfish11), false);
  });

  it("is true for the Stockfish builds that expose UCI_Elo", () => {
    for (const model of Object.values(ENGINE_MODELS)) {
      if (
        model.family !== "Stockfish" ||
        model.name === EngineName.Stockfish11
      ) {
        continue;
      }
      assert.equal(hasNativeEloLimit(model.name), true, model.name);
    }
  });

  it("is false for Lozza, tomitankChess and the joke engines", () => {
    // Their "uci" replies list no UCI_Elo (checked against each build).
    for (const model of Object.values(ENGINE_MODELS)) {
      if (model.family === "Stockfish" || model.family === "Reckless") continue;
      assert.equal(hasNativeEloLimit(model.name), false, model.name);
    }
  });
});
