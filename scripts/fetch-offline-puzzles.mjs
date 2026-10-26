import { Chess } from "chess.js";
import { readFileSync, writeFileSync } from "node:fs";

const OUTPUT = "src/data/offlinePuzzles.json";
// `--backfill` keeps the bundled puzzles and only fills in what an older run
// did not store: the opponent's setup move and the position before it.
const BACKFILL = process.argv.includes("--backfill");
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

const placement = (fen) => fen.split(" ")[0];

const buildPuzzle = (data) => {
  const { puzzle, game } = data;

  const replay = new Chess();
  const moves = game.pgn
    .split(" ")
    .filter(Boolean)
    .slice(0, puzzle.initialPly + 1);
  let setupFen;
  let lastMove;
  for (const san of moves) {
    setupFen = replay.fen();
    const played = replay.move(san);
    lastMove = played.from + played.to + (played.promotion ?? "");
  }

  const fen = puzzle.fen ?? replay.fen();
  // The setup position is only kept when replaying the game lands on the puzzle.
  const consistent = placement(replay.fen()) === placement(fen);

  return {
    id: puzzle.id,
    fen,
    solution: puzzle.solution,
    rating: puzzle.rating,
    themes: puzzle.themes,
    ...(consistent ? { setupFen, lastMove } : {}),
  };
};

if (BACKFILL) {
  const existing = JSON.parse(readFileSync(OUTPUT, "utf8"));
  const filled = [];

  for (const stored of existing) {
    if (stored.setupFen && stored.lastMove) {
      filled.push(stored);
      continue;
    }

    try {
      const response = await fetch(
        `https://lichess.org/api/puzzle/${stored.id}`
      );
      if (!response.ok) throw new Error(`status ${response.status}`);
      const rebuilt = buildPuzzle(await response.json());
      if (
        !rebuilt.setupFen ||
        placement(rebuilt.fen) !== placement(stored.fen)
      ) {
        throw new Error("the replayed game does not reach the stored position");
      }
      // Rating and themes stay as they were fetched; only the setup is added.
      filled.push({
        ...stored,
        setupFen: rebuilt.setupFen,
        lastMove: rebuilt.lastMove,
      });
      console.log(`${stored.id}: added ${rebuilt.lastMove}`);
    } catch (error) {
      filled.push(stored);
      console.warn(`${stored.id}: left as it was (${error.message})`);
    }

    await sleep(600);
  }

  writeFileSync(OUTPUT, JSON.stringify(filled, null, 1));
  console.log(`Wrote ${filled.length} puzzles to ${OUTPUT}`);
  process.exit(0);
}

const puzzles = new Map();

for (const angle of ANGLES) {
  try {
    const response = await fetch(
      `https://lichess.org/api/puzzle/next?angle=${angle}`
    );
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
