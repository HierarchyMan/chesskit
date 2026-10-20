import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasNativeEloLimit } from "@/constants";
import { EngineName } from "@/types/enums";

describe("hasNativeEloLimit", () => {
  it("is false for engines that expose no UCI_Elo", () => {
    assert.equal(hasNativeEloLimit(EngineName.Reckless), false);
    assert.equal(hasNativeEloLimit(EngineName.Stockfish11), false);
  });

  it("is true for the Stockfish builds that expose UCI_Elo", () => {
    for (const engine of Object.values(EngineName)) {
      if (engine === EngineName.Reckless || engine === EngineName.Stockfish11) {
        continue;
      }
      assert.equal(hasNativeEloLimit(engine), true, engine);
    }
  });
});
