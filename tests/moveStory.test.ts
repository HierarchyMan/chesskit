import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMoveStory, findCascadeEnd } from "@/lib/visualize/moveStory";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("buildMoveStory", () => {
  it("explains a dropped queen", () => {
    const story = buildMoveStory({
      fenBefore: "4k3/8/4p3/3p4/8/8/3Q4/4K3 w - - 0 1",
      playedUci: "d2d5",
      beforeLines: [{ pv: ["d2d3"], cp: 700, depth: 14, multiPv: 1 }],
      afterLines: [{ pv: ["e6d5"], cp: -800, depth: 14, multiPv: 1 }],
    });

    assert.equal(story.playedSan, "Qxd5");
    assert.deepEqual(
      story.played.steps.map((step) => step.san),
      [undefined, "Qxd5", "exd5"]
    );
    assert.equal(story.bestSan, "Qd3");
    assert.match(story.summary.join(" "), /ends up a queen down/);
    assert.match(story.summary.join(" "), /Better was Qd3/);
  });

  it("runs the cascade to the checkmate when mate is allowed", () => {
    const story = buildMoveStory({
      fenBefore: START,
      playedUci: "f2f3",
      beforeLines: [{ pv: ["e2e4"], cp: 30, depth: 14, multiPv: 1 }],
      afterLines: [
        { pv: ["e7e5", "g2g4", "d8h4"], mate: -2, depth: 14, multiPv: 1 },
      ],
    });

    assert.equal(story.played.endReason, "mate");
    assert.equal(story.played.autoEnd, 4);
    assert.equal(story.played.steps[4].san, "Qh4#");
    assert.match(story.summary.join(" "), /force checkmate in 2/);
  });

  it("stops early when a small positional loss settles", () => {
    const story = buildMoveStory({
      fenBefore: START,
      playedUci: "b1c3",
      beforeLines: [{ pv: ["e2e4"], cp: 50, depth: 14, multiPv: 1 }],
      afterLines: [
        { pv: ["e7e5", "e2e4", "b8c6", "g1f3"], cp: 10, depth: 14, multiPv: 1 },
      ],
    });

    assert.equal(story.played.endReason, "settled");
    assert.equal(story.played.autoEnd, 3);
  });

  it("lets a large positional loss run a little longer", () => {
    const story = buildMoveStory({
      fenBefore: START,
      playedUci: "b1c3",
      beforeLines: [{ pv: ["e2e4"], cp: 200, depth: 14, multiPv: 1 }],
      afterLines: [
        {
          pv: ["e7e5", "e2e4", "b8c6", "g1f3", "g8f6"],
          cp: 20,
          depth: 14,
          multiPv: 1,
        },
      ],
    });

    assert.equal(story.played.endReason, "settled");
    assert.equal(story.played.autoEnd, 5);
  });

  it("never shows more than ten moves after the played one", () => {
    const quiet = [
      "e7e5", "g1f3", "b8c6", "f1b5", "g8f6", "e1g1", "f6e4", "d2d4", "e5d4", "f1e1", "d7d5", "c3e4",
    ];
    const story = buildMoveStory({
      fenBefore: START,
      playedUci: "e2e4",
      beforeLines: [{ pv: ["d2d4"], cp: 30, depth: 14, multiPv: 1 }],
      afterLines: [{ pv: quiet, cp: 10, depth: 14, multiPv: 1 }],
    });

    assert.ok(story.played.steps.length <= 12);
  });

  it("says so when the played move was the engine's choice", () => {
    const story = buildMoveStory({
      fenBefore: START,
      playedUci: "e2e4",
      beforeLines: [{ pv: ["e2e4", "e7e5"], cp: 30, depth: 14, multiPv: 1 }],
      afterLines: [{ pv: ["e7e5"], cp: 30, depth: 14, multiPv: 1 }],
    });

    assert.equal(story.better, undefined);
    assert.match(story.summary[0], /top choice/);
  });

  it("reports a missed forced mate", () => {
    const story = buildMoveStory({
      fenBefore: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
      playedUci: "a1a7",
      beforeLines: [{ pv: ["a1a8"], mate: 1, depth: 14, multiPv: 1 }],
      afterLines: [{ pv: ["g8f8"], cp: 600, depth: 14, multiPv: 1 }],
    });

    assert.match(story.summary.join(" "), /forced checkmate in 1 slip away/);
  });
});

describe("findCascadeEnd", () => {
  it("handles a line that only contains the played move", () => {
    const story = buildMoveStory({
      fenBefore: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
      playedUci: "a1a8",
      beforeLines: [{ pv: ["a1a8"], mate: 1, depth: 14, multiPv: 1 }],
      afterLines: [],
    });

    const end = findCascadeEnd(story.played.steps, { lossPawns: 0 });
    assert.equal(end.autoEnd, 1);
  });
});
