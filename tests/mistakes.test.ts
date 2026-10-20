import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MoveClassification } from "@/types/enums";
import { Game } from "@/types/game";
import { LineEval, PositionEval } from "@/types/eval";
import { collectMistakes, extractMistakes } from "@/lib/mistakes";

const line = (cp: number, pv: string[] = ["e2e4"]): LineEval => ({
  pv,
  cp,
  depth: 14,
  multiPv: 1,
});

const position = (
  cp: number,
  classification?: MoveClassification,
  bestMove = "e2e4"
): PositionEval => ({
  bestMove,
  moveClassification: classification,
  lines: [line(cp, [bestMove])],
});

const SCHOLAR = "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0";

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: 7,
  pgn: `[White "You"]\n[Black "Bot"]\n[Result "1-0"]\n\n${SCHOLAR}`,
  white: { name: "You" },
  black: { name: "Bot" },
  eval: {
    accuracy: { white: 90, black: 40 },
    settings: {
      engine: "stockfish_18_lite" as never,
      depth: 14,
      multiPv: 1,
      date: "",
    },
    positions: [
      position(20),
      position(30, MoveClassification.Best),
      position(25, MoveClassification.Best),
      position(40, MoveClassification.Excellent),
      position(35, MoveClassification.Okay),
      position(50, MoveClassification.Best, "d7d6"),
      position(900, MoveClassification.Blunder),
      position(30000, MoveClassification.Best),
    ],
  },
  ...overrides,
});

describe("extractMistakes", () => {
  it("finds the blunder with its position and moves", () => {
    const [mistake] = extractMistakes(makeGame());

    assert.equal(mistake.san, "Nf6");
    assert.equal(mistake.color, "b");
    assert.equal(mistake.ply, 6);
    assert.equal(mistake.moveNumber, 3);
    assert.equal(mistake.playedUci, "g8f6");
    assert.equal(mistake.bestUci, "d7d6");
    assert.equal(mistake.classification, MoveClassification.Blunder);
    assert.ok(mistake.fenBefore.startsWith("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3"));
    assert.ok(mistake.lostPercentage > 30);
  });

  it("only flags mistakes and blunders by default", () => {
    assert.equal(extractMistakes(makeGame()).length, 1);
    assert.equal(
      extractMistakes(makeGame(), [MoveClassification.Okay]).length,
      1
    );
  });

  it("marks which side is yours", () => {
    assert.equal(extractMistakes(makeGame())[0].mine, false);

    const asBlack = makeGame({
      white: { name: "Bot" },
      black: { name: "You" },
    });
    assert.equal(extractMistakes(asBlack)[0].mine, true);
  });

  it("skips games without a matching analysis", () => {
    assert.deepEqual(extractMistakes(makeGame({ eval: undefined })), []);

    const broken = makeGame();
    broken.eval!.positions = broken.eval!.positions.slice(0, 4);
    assert.deepEqual(extractMistakes(broken), []);
  });
});

describe("collectMistakes", () => {
  it("sorts by how much was lost and can keep only your own", () => {
    const mine = makeGame({ white: { name: "Bot" }, black: { name: "You" } });
    const theirs = makeGame({ id: 8 });

    const all = collectMistakes([theirs, mine]);
    assert.equal(all.length, 2);

    const onlyMine = collectMistakes([theirs, mine], { onlyMine: true });
    assert.deepEqual(
      onlyMine.map((entry) => entry.gameId),
      [7]
    );
    assert.equal(collectMistakes([theirs, mine], { limit: 1 }).length, 1);
  });
});
