import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PIECE_MOTION,
  PIECE_MOTION_CHOICES,
  isPieceMotion,
  motionScale,
  scaledMotionMs,
} from "@/lib/pieceMotion";

describe("piece motion", () => {
  it("animates by default, whatever the system asks for", () => {
    assert.equal(DEFAULT_PIECE_MOTION, "normal");
    assert.equal(scaledMotionMs(200, DEFAULT_PIECE_MOTION, true), 200);
    assert.equal(scaledMotionMs(200, DEFAULT_PIECE_MOTION, false), 200);
  });

  it("scales a board's own duration by the chosen speed", () => {
    assert.equal(scaledMotionMs(200, "fast", false), 120);
    assert.equal(scaledMotionMs(200, "slow", false), 340);
    assert.equal(scaledMotionMs(200, "off", false), 0);
  });

  it("only the system choice follows the reduced-motion preference", () => {
    assert.equal(motionScale("system", true), 0);
    assert.equal(motionScale("system", false), 1);
    assert.equal(motionScale("fast", true), 0.6);
    assert.equal(motionScale("slow", true), 1.7);
  });

  it("keeps a board that never animates still", () => {
    for (const { id } of PIECE_MOTION_CHOICES) {
      assert.equal(scaledMotionMs(0, id, false), 0);
    }
  });

  it("recognises exactly the offered choices", () => {
    for (const { id } of PIECE_MOTION_CHOICES) assert.ok(isPieceMotion(id));
    assert.equal(isPieceMotion("toString"), false);
    assert.equal(isPieceMotion(1), false);
    assert.equal(isPieceMotion(undefined), false);
  });
});
