import { Chess } from "chess.js";
import { writeFileSync } from "node:fs";

const OUTPUT = "src/data/offlinePuzzles.json";
const ANGLES = [
  "mateIn1",
  "mateIn1",
  "mateIn2",
  "mateIn2",
  "mateIn3",
  "fork",
  "fork",
  "pin",
  "skewer",
  "discoveredAttack",
  "hangingPiece",
  "hangingPiece",
  "backRankMate",
  "sacrifice",
  "endgame",
  "endgame",
  "opening",
  "short",
  "short",
  "middlegame",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildPuzzle = (data) => {
  const { puzzle, game } = data;
  let fen = puzzle.fen;

  if (!fen) {
    const replay = new Chess();
    const moves = game.pgn.split(" ").filter(Boolean).slice(0, puzzle.initialPly + 1);
    for (const move of moves) replay.move(move);
    fen = replay.fen();
  }

  return {
    id: puzzle.id,
    fen,
    solution: puzzle.solution,
    rating: puzzle.rating,
    themes: puzzle.themes,
  };
};

const puzzles = new Map();

for (const angle of ANGLES) {
  try {
    const response = await fetch(`https://lichess.org/api/puzzle/next?angle=${angle}`);
    if (!response.ok) throw new Error(`status ${response.status}`);

    const puzzle = buildPuzzle(await response.json());
    new Chess(puzzle.fen);
    puzzles.set(puzzle.id, puzzle);
    console.log(`${angle}: ${puzzle.id} rated ${puzzle.rating}`);
  } catch (error) {
    console.warn(`${angle}: skipped (${error.message})`);
  }

  await sleep(600);
}

writeFileSync(OUTPUT, JSON.stringify([...puzzles.values()], null, 1));
console.log(`Wrote ${puzzles.size} puzzles to ${OUTPUT}`);
