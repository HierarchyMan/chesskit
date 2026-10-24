// Positions for the scripts that measure the app against a real engine: every
// position of the bundled opening lines, plus a few plies off the book from each,
// which makes pieces hang. Every call returns the same positions, so every run
// and every engine is measured on the same ones.
import { Chess } from "chess.js";
import { OPENING_LINES } from "../../src/data/openingLines.ts";

// Mulberry32.
const generator = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const buildCorpus = (limit = Infinity) => {
  const random = generator(12345);
  const positions = new Map();
  const add = (label, fen) => {
    const key = fen.split(" ").slice(0, 4).join(" ");
    if (!positions.has(key)) positions.set(key, [label, fen]);
  };

  for (const line of OPENING_LINES) {
    const game = new Chess();
    for (const san of line.moves.split(" ")) {
      game.move(san);
      add(`${line.id} ${game.history().length}`, game.fen());
    }

    for (let branch = 0; branch < 3; branch++) {
      const wander = new Chess(game.fen());
      for (let ply = 0; ply < 2 + branch && !wander.isGameOver(); ply++) {
        const moves = wander.moves();
        wander.move(moves[Math.floor(random() * moves.length)]);
        add(`${line.id} wander ${ply + 1}`, wander.fen());
      }
    }
  }

  // Taking the first positions would cover only the first few openings, so a
  // smaller sample is spread evenly over all of them.
  const all = [...positions.values()];
  if (all.length <= limit) return all;
  return Array.from(
    { length: limit },
    (_, index) => all[Math.floor((index * all.length) / limit)]
  );
};
