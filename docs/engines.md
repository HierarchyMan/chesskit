# Engines

Every engine the app knows is one entry in `src/lib/engine/models.ts`. Labels, the picker, support checks, downloads, Elo ceilings and the code that starts an engine all read that entry, so adding an engine is one entry plus its files.

## Kinds

| Source    | Runs                                   | Examples                                   |
| --------- | -------------------------------------- | ------------------------------------------ |
| `browser` | A Web Worker from `public/engines/`    | Stockfish 11 to 19, Lozza, tomitankChess   |
| `bridge`  | A native program through the bridge    | Reckless, anything in `engines/engines.json` |
| `builtin` | In the page (`src/lib/engine/jokes/`)  | Drawfish, Worstfish and the other jokes    |

Entries carry: label, group, rating (with its source), size, `roles` (analysis, play), `needsWasm`, `maxMultiPv`, `nativeElo`, `init` commands and tags.
`needsWasm: false` engines (Stockfish 11, Stockfish 19 asm.js, Lozza, tomitankChess) run without WebAssembly.

## What each engine can do

`UciEngine` reads the engine's own `uci` reply (`uciOptions.ts`) and clamps MultiPV, `UCI_Elo`, Hash and Threads to what the engine advertises. An option an engine lacks is skipped, never sent.
Engines that print no `multipv` (tomitankChess) are read as one line.

## Strength

`planMove` (`strength.ts`) takes a `StrengthProfile`: the engine's native Elo range, its rating (`maxElo`) and the full-strength think time.

- The top of the Elo slider is the engine's rating, and that value means full strength.
- Below it, an engine with `UCI_Elo` uses it; others get depth-limited, sampled play.
- Full strength thinks for `fullStrengthMsAtom` per move (3 s by default), shortened by a game clock.
- Joke engines (`playsOwnMoves`) ignore strength settings.

Ratings are CCRL Blitz (24 Oct 2026, native single-CPU builds) or the author's estimate, and say so in the picker. They are engine-versus-engine numbers, not human ratings. The in-app guide ("How to get maximum strength") lists the settings that matter: engine, full strength, think time, hash, threads, depth.

## Joke engines

`jokes/strategies.ts` ranks the legal moves; `jokes/jokeWorker.ts` wraps a strategy as a UCI worker so the rest of the app treats it like any engine.
Drawfish, Worstfish, Pacifist and Bongcloud judge moves with an advisor, a real engine chosen in Settings → Engine ("Joke engines' advisor", the analysis engine by default). The advisor's depth is a setting too.
Joke engines never appear as analysis, threats, coach or evaluator engines.

## Native engines

Put the program in `engines/` and add it to `engines/engines.json` (`id`, `name`, `path`, optional `args`, `elo`, `description`). Press Check bridge in Settings → Models. The bridge starts only programs named in that file, binds `127.0.0.1` and accepts only the app's origin. It reports each program's options from its own `uci` reply.

## Engine binaries

Git holds each browser engine's JavaScript loader, not its `.wasm` and `.nnue` files (about 480 MB, ignored through `.gitignore`). `scripts/engine-binaries.json` lists every file with its size, SHA-256 and a pinned public URL. `scripts/fetch-engines.mjs` downloads the ones that are missing, checks size and hash, and moves a file into place only when it matches, so an interrupted download never leaves a half file behind. It runs before `npm run dev`, `build` and `start`; a fresh clone needs only `npm install` and one of those.

```bash
npm run engines                # download what is missing
npm run engines -- --verify    # hash every file on disk and replace any that differ
npm run engines -- --check     # report only, never download
```

Sources: the Stockfish 16, 17, 17.1 and 18 files come from the upstream Chesskit repository at commit `9622d50`, and the Stockfish 19 files from the `v19.0.1` release of [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js). Both URLs are immutable. To add or update an engine, put the files in `public/engines/` and add an entry with the file's byte size, SHA-256 and a URL that will not change (a commit or a release, never a branch).

## Checking engines

```bash
npm test
ENGINE=lozza_nnue,tomitank_7,stockfish_19_lite node --import ./tests/register.mjs scripts/measure-arrow-depth.mjs
```

`scripts/lib/uciProcess.mjs` runs any real engine of the registry under Node (Lozza through `scripts/lib/workerShim.cjs`).
