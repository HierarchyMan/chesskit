// Measures from which search depth the engine's best move can be drawn.
//
//   node --import ./tests/register.mjs scripts/measure-arrow-depth.mjs
//
// The first iterations of a search jump between moves, so an arrow drawn from
// them could flicker or mislead. For every engine the app offers, on the
// positions of the bundled opening lines and a few plies off them, this measures
// for each depth d:
//
//   stable   the best move at d is the final best move and never changes again
//   sound    the best move at d is a move the final search rates within
//            SOUND_CP of its best, so the arrow is not wrong even when it later
//            gives way to a near-equal move
//
// "Wait for search depth" in Settings should sit where "sound" is high on every
// engine. ENGINE (see scripts/lib/uciProcess.mjs), FINAL (the depth taken as the
// answer), SOUND_CP and LIMIT change what is measured.
import { buildCorpus } from "./lib/corpus.mjs";
import { requestedEngines, startEngine } from "./lib/uciProcess.mjs";

const FINAL = Number(process.env.FINAL ?? 16);
const LIMIT = Number(process.env.LIMIT ?? 80);
const SOUND_CP = Number(process.env.SOUND_CP ?? 30);
const LINES = 5;
const DEPTHS = [2, 4, 6, 8, 9, 10, 12, 14];

const MATE_CP = 10000;
const INFO =
  /^info depth (\d+) .*?multipv (\d+) score (cp|mate) (-?\d+) .*?pv (\S+)/;

const percent = (hits, total) =>
  `${((hits / total) * 100).toFixed(0).padStart(3)}%`;

// Each engine is reported as soon as it is done, since the slowest take minutes.
const report = (name, rows) => {
  console.log(
    `
=== ${name}: ${rows.length} positions, answer at depth ${FINAL} ===`
  );
  console.log(`depth  stable  sound (within ${SOUND_CP} cp)`);
  for (const depth of DEPTHS) {
    const stable = rows.filter((row) => row.stableFrom <= depth).length;
    const sound = rows.filter((row) => row.sound(depth)).length;
    console.log(
      `${String(depth).padStart(5)}  ${percent(stable, rows.length)}    ${percent(sound, rows.length)}`
    );
  }
};

for (const name of requestedEngines()) {
  const engine = await startEngine(name);
  if (!engine) continue;

  const rows = [];
  for (const [, fen] of buildCorpus(LIMIT)) {
    engine.newGame();
    const output = await engine.search(fen, FINAL, LINES);

    // best[d] is the best move after depth d; final[move] its score at FINAL.
    const best = new Map();
    const final = new Map();
    for (const line of output) {
      const match = INFO.exec(line);
      if (!match) continue;
      const [, depth, multiPv, kind, value, move] = match;
      const score =
        kind === "cp"
          ? Number(value)
          : Math.sign(Number(value)) * (MATE_CP - Math.abs(Number(value)));
      if (multiPv === "1") best.set(Number(depth), move);
      if (Number(depth) === FINAL) final.set(move, score);
    }

    const answer = best.get(FINAL);
    if (!answer) continue;
    const top = final.get(answer);

    let stableFrom = FINAL;
    for (let depth = FINAL; depth >= 1; depth--) {
      if (!best.has(depth)) continue;
      if (best.get(depth) !== answer) break;
      stableFrom = depth;
    }

    // A move outside the final top lines has no score, so it counts as unsound.
    const sound = (depth) => {
      const move = best.get(depth);
      return (
        move !== undefined &&
        final.has(move) &&
        top - final.get(move) <= SOUND_CP
      );
    };

    rows.push({ stableFrom, sound });
  }
  engine.close();
  report(name, rows);
}
