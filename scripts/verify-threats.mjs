// Calibrates the threat sensitivities against the app's engines.
//
//   node --import ./tests/register.mjs scripts/verify-threats.mjs
//
// A threat is what the opponent gains by moving first (src/lib/engine/threats.ts).
// This measures that gain on positions sorted by a static check that does not
// use the engine, so the two can be compared:
//
//   real   a piece worth a knight or more could be taken for less than it costs
//   pseudo a piece is attacked, but adequately defended
//   quiet  nothing of the mover's is attacked
//
// A sensitivity is good when it flags nearly all "real" positions and few of the
// others, on every engine the user can choose, so nothing is measured on one
// engine alone (see scripts/lib/uciProcess.mjs for ENGINE). The static check is
// crude (it cannot see a pinned defender or an overloaded one), so some of the
// "false alarms" are threats the engine is right about; read them as a trend
// between sensitivities, not as an error rate. What must hold on every engine
// is that the sanity threats, which certainly cost material, are all kept.
// DEPTH is the depth of the position itself, LIMIT how many positions each
// engine searches.
import { Chess } from "chess.js";
import { parseEvaluationResults } from "../src/lib/engine/helpers/parseResults.ts";
import { findThreats, positionForThreats } from "../src/lib/engine/threats.ts";
import {
  ARROW_TUNING_DEFAULTS,
  THREAT_GAIN,
} from "../src/lib/arrows/tuning.ts";
import { vulnerablePieces } from "../src/lib/visualize/explain.ts";
import { buildCorpus } from "./lib/corpus.mjs";
import { requestedEngines, startEngine } from "./lib/uciProcess.mjs";

const DEPTH = Number(process.env.DEPTH ?? 14);
const LIMIT = Number(process.env.LIMIT ?? 80);
const THRESHOLDS = [4, 6, 8, 10, 12, 15, 20, 25, 30];

// Threats whose cost is certain, in positions where neither side is already winning.
const SANITY = [
  ["mate in one", "r5k1/5ppp/8/7R/8/8/5PPP/6K1 w - - 0 1"],
  [
    "queen attacked by a pawn",
    "rnbqkbnr/pppp1ppp/8/4p3/3QP3/8/PPP2PPP/RNB1KBNR w KQkq - 0 3",
  ],
  [
    "knight attacked by a pawn, undefended",
    "r3k3/pp3ppp/8/3p4/4N3/8/PP3PPP/R3K3 w - - 0 1",
  ],
];

const classify = (fen) => {
  const game = new Chess(fen);
  if (game.inCheck() || game.isGameOver()) return undefined;

  const mover = game.turn();
  const vulnerable = [...vulnerablePieces(game, mover)].filter(
    (square) => game.get(square)?.type !== "p"
  );
  if (vulnerable.length) return "real";

  const attacked = game
    .board()
    .flat()
    .some(
      (cell) =>
        cell &&
        cell.color === mover &&
        cell.type !== "k" &&
        game.attackers(cell.square, mover === "w" ? "b" : "w").length > 0
    );
  return attacked ? "pseudo" : "quiet";
};

/** The opponent's best gain from moving first, in points of winning chances. */
const measure = async (engine, fen) => {
  const handedOver = positionForThreats(fen);
  if (!handedOver) return undefined;

  engine.newGame();
  const main = parseEvaluationResults(await engine.search(fen, DEPTH, 1), fen);
  const passed = parseEvaluationResults(
    await engine.search(handedOver, ARROW_TUNING_DEFAULTS.threatDepth, 2),
    handedOver
  );
  const [top] = findThreats(fen, main, passed, {
    minimumGain: -Infinity,
    limit: 1,
  });
  return top?.gain ?? 0;
};

const share = (gains, threshold) =>
  gains.length
    ? (100 * gains.filter((gain) => gain >= threshold).length) / gains.length
    : NaN;

const pad = (value, width = 5) =>
  (Number.isNaN(value) ? "-" : value.toFixed(0)).padStart(width);

let failures = 0;

for (const name of requestedEngines()) {
  const engine = await startEngine(name);
  if (!engine) continue;

  console.log(`\n=== ${name} ===`);

  const sanity = [];
  for (const [label, fen] of SANITY) {
    const gain = await measure(engine, fen);
    sanity.push(gain ?? 0);
    console.log(`${(gain ?? 0).toFixed(1).padStart(6)}  ${label}`);
  }

  const classes = { real: [], pseudo: [], quiet: [] };
  for (const [, fen] of buildCorpus(LIMIT)) {
    const kind = classify(fen);
    const gain = kind && (await measure(engine, fen));
    if (gain !== undefined && kind) classes[kind].push(gain);
  }
  engine.close();

  console.log(
    `\nShare of positions flagged at each threshold (n: ${Object.entries(
      classes
    )
      .map(([kind, gains]) => `${kind} ${gains.length}`)
      .join(", ")})`
  );
  console.log(
    "points".padEnd(8) +
      THRESHOLDS.map((value) => String(value).padStart(5)).join("")
  );
  for (const [kind, gains] of Object.entries(classes)) {
    console.log(
      `${kind.padEnd(8)}${THRESHOLDS.map((value) => pad(share(gains, value))).join("")}`
    );
  }

  console.log("\nThe three sensitivities on this engine");
  for (const [sensitivity, gain] of Object.entries(THREAT_GAIN)) {
    const recall = share(classes.real, gain);
    const falseAlarms = share([...classes.pseudo, ...classes.quiet], gain);
    const sanityMet = sanity.every((value) => value >= gain);
    console.log(
      `${sensitivity.padEnd(9)} ${String(gain).padStart(2)} points: ` +
        `${pad(recall, 3)}% of real flagged, ${pad(falseAlarms, 3)}% false alarms, ` +
        `sanity threats ${sanityMet ? "all kept" : "some dropped"}`
    );
    if (sensitivity === ARROW_TUNING_DEFAULTS.threatSensitivity && !sanityMet) {
      failures++;
    }
  }
}

process.exit(failures ? 1 : 0);
