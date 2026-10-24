import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStore } from "jotai";
import {
  ANALYSIS_OPTIONS,
  createAnalysisOptionAtoms,
} from "@/lib/analysisOptions";

describe("analysis options", () => {
  it("lists the shared switches in display order", () => {
    assert.deepEqual([...ANALYSIS_OPTIONS], ["evaluation", "annotations"]);
  });

  it("starts each switch at the default its mode supplies", () => {
    const atoms = createAnalysisOptionAtoms(
      { evaluation: "test-evaluation", annotations: "test-annotations" },
      { evaluation: true, annotations: false }
    );
    const store = createStore();

    assert.equal(store.get(atoms.evaluation), true);
    assert.equal(store.get(atoms.annotations), false);

    store.set(atoms.annotations, true);
    assert.equal(store.get(atoms.annotations), true);
    assert.equal(store.get(atoms.evaluation), true);
  });
});
