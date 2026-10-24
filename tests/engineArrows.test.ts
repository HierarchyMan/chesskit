import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import { buildEngineArrows } from "@/lib/arrows/engineArrows";
import { applyFocus, colorNamer, legendFor } from "@/lib/arrows/legend";
import { ARROW_DEFAULTS, ArrowPrefs, effectivePrefs } from "@/lib/arrows/prefs";
import { ARROW_CAPABILITIES, FORMAL_CAPABILITIES } from "@/lib/arrows/prefs";
import { ARROW_TUNING_DEFAULTS, ArrowTuning } from "@/lib/arrows/tuning";
import { MoveClassification } from "@/types/enums";
import { CurrentPosition, LineEval } from "@/types/eval";

const line = (pv: string[], multiPv: number, depth = 12): LineEval => ({
  pv,
  multiPv,
  depth,
  cp: 40 - multiPv * 10,
});

const tuning = ARROW_TUNING_DEFAULTS;

const arrowsFor = (
  position: CurrentPosition,
  fen: string,
  chosen: ArrowPrefs,
  how: ArrowTuning = tuning
) => buildEngineArrows(position, fen, chosen, how);

const prefs = (change: Partial<ArrowPrefs> = {}): ArrowPrefs => ({
  enabled: true,
  moves: 3,
  ahead: 0,
  missed: false,
  threats: false,
  ...change,
});

const start = new Chess();
const startSnapshot = (lines: LineEval[]): CurrentPosition => ({
  fen: start.fen(),
  eval: { lines },
});

const LINES = [
  line(["e2e4", "e7e5", "g1f3", "b8c6"], 1),
  line(["d2d4", "d7d5"], 2),
  line(["g1f3", "g8f6"], 3),
];

describe("engine arrows", () => {
  it("draws as many of the engine's moves as were asked for, best first", () => {
    const arrows = arrowsFor(
      startSnapshot(LINES),
      start.fen(),
      prefs({ moves: 2 })
    );
    assert.deepEqual(
      arrows.map(({ from, to, kind, rank, side }) => [
        from + to,
        kind,
        rank,
        side,
      ]),
      [
        ["e2e4", "best", 1, "w"],
        ["d2d4", "candidate", 2, "w"],
      ]
    );
  });

  it("draws nothing until the search is deep enough to have settled", () => {
    const shallow = LINES.map((entry) => ({
      ...entry,
      depth: tuning.settleDepth - 1,
    }));
    assert.deepEqual(
      arrowsFor(startSnapshot(shallow), start.fen(), prefs()),
      []
    );
  });

  it("waits for the depth the user chose, however shallow or deep", () => {
    const shallow = LINES.map((entry) => ({ ...entry, depth: 5 }));
    const snapshot = startSnapshot(shallow);
    assert.equal(arrowsFor(snapshot, start.fen(), prefs()).length, 0);
    assert.equal(
      arrowsFor(snapshot, start.fen(), prefs(), { ...tuning, settleDepth: 5 })
        .length,
      3
    );
  });

  it("draws nothing when switched off, or when no moves are asked for", () => {
    const snapshot = startSnapshot(LINES);
    assert.deepEqual(
      arrowsFor(snapshot, start.fen(), prefs({ enabled: false })),
      []
    );
    assert.deepEqual(arrowsFor(snapshot, start.fen(), prefs({ moves: 0 })), []);
  });

  it("continues the best line with numbered arrows that alternate sides", () => {
    const arrows = arrowsFor(
      startSnapshot(LINES),
      start.fen(),
      prefs({ moves: 1, ahead: 2 })
    );
    assert.deepEqual(
      arrows.map(({ from, to, kind, side, label }) => [
        from + to,
        kind,
        side,
        label,
      ]),
      [
        ["e2e4", "best", "w", undefined],
        ["e7e5", "line", "b", "2"],
        ["g1f3", "line", "w", "3"],
      ]
    );
  });

  it("never puts the previous board's moves on this one", () => {
    const afterE4 = new Chess();
    afterE4.move("e4");
    // The snapshot still describes the starting position, with White's moves.
    assert.deepEqual(
      arrowsFor(startSnapshot(LINES), afterE4.fen(), prefs()),
      []
    );
  });

  it("draws the better move only for a move that deserved one", () => {
    const game = new Chess();
    game.move("a3");
    const played = game.history({ verbose: true })[0];
    const snapshot = (classification: MoveClassification): CurrentPosition => ({
      fen: game.fen(),
      lastMove: played,
      lastEval: { bestMove: "e2e4", lines: [line(["e2e4"], 1)] },
      eval: { moveClassification: classification, lines: [] },
    });

    const arrows = arrowsFor(
      snapshot(MoveClassification.Mistake),
      game.fen(),
      prefs({ moves: 0, missed: true })
    );
    assert.deepEqual(
      arrows.map(({ from, to, kind, side }) => [from + to, kind, side]),
      [["e2e4", "missed", "w"]]
    );

    // A stricter floor leaves a mistake without a better move drawn.
    assert.deepEqual(
      arrowsFor(
        snapshot(MoveClassification.Mistake),
        game.fen(),
        prefs({ moves: 0, missed: true }),
        { ...tuning, missedFrom: "blunder" }
      ),
      []
    );

    for (const silent of [
      MoveClassification.Best,
      MoveClassification.Excellent,
      MoveClassification.Splendid,
    ]) {
      assert.deepEqual(
        arrowsFor(
          snapshot(silent),
          game.fen(),
          prefs({ moves: 0, missed: true })
        ),
        []
      );
    }
  });
});

describe("arrow choices", () => {
  it("limits a mode to what it offers", () => {
    const wanted = prefs({ moves: 5, ahead: 4, missed: true, threats: true });
    assert.deepEqual(effectivePrefs(wanted, ARROW_CAPABILITIES.arena), {
      enabled: true,
      moves: 3,
      ahead: 0,
      missed: false,
      threats: false,
    });
    // A formal game offers no advice before a move, only feedback after it.
    assert.deepEqual(effectivePrefs(wanted, FORMAL_CAPABILITIES), {
      enabled: true,
      moves: 0,
      ahead: 0,
      missed: true,
      threats: false,
    });
  });

  it("starts Play without suggestions and Analysis with the best move", () => {
    assert.equal(ARROW_DEFAULTS.play.moves, 0);
    assert.equal(ARROW_DEFAULTS.analysis.moves, 1);
  });
});

describe("arrow legend", () => {
  it("lists each kind of arrow on the board once, naming whose it is", () => {
    const arrows = arrowsFor(
      startSnapshot(LINES),
      start.fen(),
      prefs({ moves: 3, ahead: 2 })
    );
    assert.deepEqual(
      legendFor(arrows, colorNamer).map((entry) => entry.text),
      [
        "White's best move",
        "White's other candidates",
        "Black's move in the line",
        "White's move in the line",
      ]
    );
  });

  it("names the owner by the colour that moves, whoever is to move", () => {
    const afterE4 = new Chess();
    afterE4.move("e4");
    const blackLines: LineEval[] = [line(["e7e5", "g1f3"], 1)];
    const arrows = arrowsFor(
      { fen: afterE4.fen(), eval: { lines: blackLines } },
      afterE4.fen(),
      prefs({ moves: 1 })
    );
    assert.deepEqual(
      legendFor(arrows, colorNamer).map((entry) => entry.text),
      ["Black's best move"]
    );
  });

  it("focuses one role and owner, or one exact candidate, rather than a whole kind", () => {
    const arrows = arrowsFor(
      startSnapshot(LINES),
      start.fen(),
      prefs({ moves: 3 })
    );
    const focused = applyFocus(arrows, { kind: "candidate", rank: 3 });
    assert.deepEqual(
      focused.map(({ kind, rank, dimmed }) => [kind, rank, !!dimmed]),
      [
        ["best", 1, true],
        ["candidate", 2, true],
        ["candidate", 3, false],
      ]
    );
  });

  it("pushes every other kind into the background when one is in focus", () => {
    const arrows = arrowsFor(startSnapshot(LINES), start.fen(), prefs());
    const focused = applyFocus(arrows, { kind: "best" });
    assert.deepEqual(
      focused.map(({ kind, dimmed }) => [kind, !!dimmed]),
      [
        ["best", false],
        ["candidate", true],
        ["candidate", true],
      ]
    );
    assert.deepEqual(applyFocus(arrows, null), arrows);
  });
});
