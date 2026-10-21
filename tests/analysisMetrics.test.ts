import assert from "node:assert/strict";
import { it } from "node:test";
import { Chess } from "chess.js";
import { computeAccuracy } from "@/lib/engine/helpers/accuracy";
import { computeEstimatedElo } from "@/lib/engine/helpers/estimateElo";
import { PositionEval } from "@/types/eval";
import { EngineName } from "@/types/enums";
import {
  analysisSessionBackup,
  newAnalysisSession,
  parseAnalysisSessionBackup,
} from "@/lib/analysisSession";

const positions = (...scores: number[]): PositionEval[] =>
  scores.map((cp) => ({ lines: [{ cp, depth: 12, multiPv: 1, pv: [] }] }));

it("represents a player with no analyzed moves as null, never NaN", () => {
  assert.deepEqual(computeAccuracy(positions(0)), { white: null, black: null });
  const accuracy = computeAccuracy(positions(0, -300));
  assert.ok(accuracy.white! < 100);
  assert.equal(accuracy.black, null);
  const elo = computeEstimatedElo(positions(0, -300))!;
  assert.ok(Number.isFinite(elo.white));
  assert.equal(elo.black, null);
});

it("attributes losses and sample counts to Black when the arranged root starts with Black", () => {
  const accuracy = computeAccuracy(positions(0, 300), true);
  assert.equal(accuracy.white, null);
  assert.ok(accuracy.black! < 100);
  assert.equal(computeAccuracy(positions(0, -300), true).black, 100);
  const elo = computeEstimatedElo(
    positions(0, 300),
    undefined,
    undefined,
    true
  )!;
  assert.equal(elo.white, null);
  assert.ok(Number.isFinite(elo.black));
});

it("archives a one-move Black-root evaluation without losing the evaluation or inventing a White score", () => {
  const game = new Chess("4k3/8/8/8/8/8/1R6/4K3 b - - 0 42");
  game.move("Kd7");
  const values = positions(430, 425);
  const session = newAnalysisSession(game);
  session.main.evaluation = {
    positions: values,
    accuracy: computeAccuracy(values, true),
    estimatedElo: computeEstimatedElo(values, undefined, undefined, true),
    settings: {
      engine: EngineName.Stockfish18Lite,
      depth: 12,
      multiPv: 1,
      date: new Date().toISOString(),
    },
  };
  const restored = parseAnalysisSessionBackup(analysisSessionBackup(session));
  assert.deepEqual(restored.main.evaluation, session.main.evaluation);
  assert.equal(restored.main.evaluation!.accuracy.white, null);
});
