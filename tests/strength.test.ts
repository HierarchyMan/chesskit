import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MovePlan,
  maxDepthForTime,
  pickSampledMove,
  planMove,
  scoreFromLine,
} from "@/lib/engine/strength";

const sampledPlan = (
  overrides: Partial<Extract<MovePlan, { kind: "sampled" }>> = {}
): Extract<MovePlan, { kind: "sampled" }> => ({
  kind: "sampled",
  depth: 3,
  multiPv: 5,
  temperatureCp: 100,
  randomMoveChance: 0,
  ...overrides,
});

const seeded = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("planMove", () => {
  it("uses the native limit when the engine has one and Elo is in range", () => {
    const plan = planMove({ mode: "elo", elo: 1800, depth: 8 }, true);
    assert.deepEqual(plan, { kind: "native", elo: 1800, depth: 16 });
  });

  it("emulates strength below the native range", () => {
    const plan = planMove({ mode: "elo", elo: 800, depth: 8 }, true);
    assert.equal(plan.kind, "sampled");
  });

  it("emulates every Elo when the engine has no native limit", () => {
    const plan = planMove({ mode: "elo", elo: 1800, depth: 8 }, false);
    assert.equal(plan.kind, "sampled");
  });

  it("plays plain best moves above the emulated range", () => {
    assert.equal(planMove({ mode: "elo", elo: 3000, depth: 8 }, false).kind, "best");
  });

  it("gets weaker as Elo drops", () => {
    const low = planMove({ mode: "elo", elo: 600, depth: 8 }, false);
    const mid = planMove({ mode: "elo", elo: 1500, depth: 8 }, false);
    assert.ok(low.kind === "sampled" && mid.kind === "sampled");
    assert.ok(low.depth <= mid.depth);
    assert.ok(low.temperatureCp > mid.temperatureCp);
    assert.ok(low.randomMoveChance > mid.randomMoveChance);
  });

  it("honours the fixed depth and max modes", () => {
    assert.deepEqual(planMove({ mode: "depth", elo: 1500, depth: 5 }, true), {
      kind: "best",
      depth: 5,
    });
    assert.deepEqual(planMove({ mode: "max", elo: 1500, depth: 5 }, false), {
      kind: "best",
      depth: 16,
    });
  });

  it("clamps out-of-range inputs", () => {
    const plan = planMove({ mode: "depth", elo: 1500, depth: 99 }, true);
    assert.deepEqual(plan, { kind: "best", depth: 30 });
  });
});

describe("scoreFromLine", () => {
  it("scores from the mover's point of view", () => {
    assert.equal(scoreFromLine({ cp: 120 }, "w"), 120);
    assert.equal(scoreFromLine({ cp: 120 }, "b"), -120);
  });

  it("prefers faster mates", () => {
    assert.ok(scoreFromLine({ mate: 1 }, "w") > scoreFromLine({ mate: 3 }, "w"));
    assert.ok(scoreFromLine({ mate: -1 }, "w") < scoreFromLine({ mate: -3 }, "w"));
  });
});

describe("pickSampledMove", () => {
  const candidates = [
    { uci: "e2e4", cp: 50 },
    { uci: "d2d4", cp: 40 },
    { uci: "a2a3", cp: -300 },
  ];
  const legal = ["e2e4", "d2d4", "a2a3", "h2h3"];

  it("takes the best move when nothing pushes it away", () => {
    const move = pickSampledMove(candidates, legal, sampledPlan({ temperatureCp: 1 }), 1500, seeded([0.99]));
    assert.equal(move, "e2e4");
  });

  it("can pick a weaker candidate when the roll lands on it", () => {
    const move = pickSampledMove(candidates, legal, sampledPlan({ temperatureCp: 100 }), 1500, seeded([0.99, 0.6]));
    assert.equal(move, "d2d4");
  });

  it("plays a random legal move when the blunder roll hits", () => {
    const move = pickSampledMove(candidates, legal, sampledPlan({ randomMoveChance: 0.5 }), 600, seeded([0.1, 0.99]));
    assert.equal(move, "h2h3");
  });

  it("always plays a found mate above beginner level", () => {
    const withMate = [{ uci: "d1h5", cp: 99_999 }, { uci: "a2a3", cp: 0 }];
    const move = pickSampledMove(withMate, ["d1h5", "a2a3"], sampledPlan({ randomMoveChance: 1 }), 1200, seeded([0]));
    assert.equal(move, "d1h5");
  });

  it("falls back to a legal move when the engine gave nothing", () => {
    assert.equal(pickSampledMove([], legal, sampledPlan(), 1000, seeded([0])), "e2e4");
    assert.equal(pickSampledMove(candidates, [], sampledPlan(), 1000), undefined);
  });

  it("rarely chooses clearly losing moves at club level", () => {
    const plan = planMove({ mode: "elo", elo: 1800, depth: 8 }, false);
    assert.equal(plan.kind, "sampled");
    if (plan.kind !== "sampled") return;

    let blunders = 0;
    let state = 12345;
    const random = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    for (let i = 0; i < 2000; i++) {
      const move = pickSampledMove(candidates, legal, plan, 1800, random);
      if (move === "a2a3") blunders++;
    }
    assert.ok(blunders < 10, `blundered ${blunders} times`);
  });
});

describe("maxDepthForTime", () => {
  it("does not limit a bot with plenty of time or no clock", () => {
    assert.equal(maxDepthForTime(undefined), undefined);
    assert.equal(maxDepthForTime(120_000), undefined);
  });

  it("shortens the search as the clock runs down", () => {
    assert.equal(maxDepthForTime(20_000), 10);
    assert.equal(maxDepthForTime(8_000), 6);
    assert.equal(maxDepthForTime(1_000), 3);
  });
});
