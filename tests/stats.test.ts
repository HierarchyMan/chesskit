import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_STATS,
  markEndgameCompleted,
  markOpeningLearned,
  recordGame,
  recordPuzzle,
  recordVision,
} from "@/lib/stats";

describe("recordPuzzle", () => {
  it("raises the rating and streak after a solve", () => {
    const stats = recordPuzzle(DEFAULT_STATS, 1200, true);
    assert.equal(stats.puzzles.rating, 1216);
    assert.equal(stats.puzzles.streak, 1);
    assert.equal(stats.puzzles.solved, 1);
  });

  it("lowers the rating and resets the streak after a failure", () => {
    const solved = recordPuzzle(DEFAULT_STATS, 1200, true);
    const failed = recordPuzzle(solved, 1200, false);
    assert.ok(failed.puzzles.rating < solved.puzzles.rating);
    assert.equal(failed.puzzles.streak, 0);
    assert.equal(failed.puzzles.bestStreak, 1);
    assert.equal(failed.puzzles.failed, 1);
  });

  it("rewards beating a much harder puzzle more", () => {
    const hard = recordPuzzle(DEFAULT_STATS, 1800, true).puzzles.rating;
    const easy = recordPuzzle(DEFAULT_STATS, 800, true).puzzles.rating;
    assert.ok(hard > easy);
  });

  it("never drops below the floor", () => {
    let stats = { ...DEFAULT_STATS, puzzles: { ...DEFAULT_STATS.puzzles, rating: 105 } };
    for (let i = 0; i < 20; i++) stats = recordPuzzle(stats, 2500, false);
    assert.ok(stats.puzzles.rating >= 100);
  });
});

describe("other records", () => {
  it("counts games by outcome", () => {
    let stats = recordGame(DEFAULT_STATS, "won");
    stats = recordGame(stats, "drawn");
    stats = recordGame(stats, "lost");
    assert.deepEqual(stats.games, { played: 3, won: 1, drawn: 1, lost: 1 });
  });

  it("keeps the best vision score", () => {
    let stats = recordVision(DEFAULT_STATS, 30);
    stats = recordVision(stats, 22);
    assert.equal(stats.vision.bestScore, 30);
    assert.equal(stats.vision.sessions, 2);
  });

  it("does not duplicate learned openings or finished endgames", () => {
    let stats = markOpeningLearned(DEFAULT_STATS, "italian");
    stats = markOpeningLearned(stats, "italian");
    stats = markEndgameCompleted(stats, "lucena");
    stats = markEndgameCompleted(stats, "lucena");
    assert.deepEqual(stats.openings.learned, ["italian"]);
    assert.deepEqual(stats.endgames.completed, ["lucena"]);
  });
});
