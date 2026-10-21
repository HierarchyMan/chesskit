import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStore } from "jotai";
import {
  ANALYSIS_OPTIONS,
  createAnalysisOptionAtoms,
} from "@/lib/analysisOptions";

describe("analysis options", () => {
  it("lists the three shared switches in display order", () => {
    assert.deepEqual(
      [...ANALYSIS_OPTIONS],
      ["evaluation", "annotations", "bestMove"]
    );
  });

  it("starts each switch at the default its mode supplies", () => {
    const atoms = createAnalysisOptionAtoms(
      {
        evaluation: "test-evaluation",
        annotations: "test-annotations",
        bestMove: "test-best-move",
      },
      { evaluation: true, annotations: false, bestMove: true }
    );
    const store = createStore();

    assert.equal(store.get(atoms.evaluation), true);
    assert.equal(store.get(atoms.annotations), false);
    assert.equal(store.get(atoms.bestMove), true);

    store.set(atoms.annotations, true);
    assert.equal(store.get(atoms.annotations), true);
    assert.equal(store.get(atoms.evaluation), true);
  });
});
