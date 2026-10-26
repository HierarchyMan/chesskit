# Engines

Every engine the app knows is one entry in `src/lib/engine/models.ts`. Labels, the picker, support checks, downloads, Elo ceilings and the code that starts an engine all read that entry, so adding an engine is one entry plus its files in `src/lib/engine/engineFiles.json`.

## Kinds

| Source    | Runs                                              | Examples                                     |
| --------- | ------------------------------------------------- | -------------------------------------------- |
| `browser` | A Web Worker: bundled, or downloaded by the user  | Stockfish 11 to 19, Lozza, tomitankChess     |
| `bridge`  | A native program the user runs through the bridge | Reckless, anything in `engines/engines.json` |
| `builtin` | In the page (`src/lib/engine/jokes/`)             | Drawfish, Worstfish and the other jokes      |

Entries carry: label, group, rating (with its source), `roles` (analysis, play), `needsWasm`, `maxMultiPv`, `nativeElo`, `init` commands and tags. Size and `bundled` come from `engineFiles.json`.

## Who serves what

- **The app serves one engine: Stockfish 19 Lite** (`bundled` in `engineFiles.json`, the only engine files in `public/engines/`). It is `DEFAULT_ENGINE`, so the app always works without any download. A test fails if anything else appears in `public/engines/`.
- **Every other browser engine is the user's download.** The Download button fetches its files from the pinned public URL in `engineFiles.json` (unpkg for Stockfish 19, the upstream Chesskit commit for Stockfish 11 to 18, the Lozza and tomitankChess repositories at their release commits), checks size and SHA-256, and stores them in the browser's Cache Storage (`chesskit-engine-models-v2`) under their `/engines/` path. `public/engine-cache-sw.js` serves them from there to the engine's worker. Nothing downloads on its own.
- **An engine that is not downloaded does not run.** `createEngine` checks the stored copy first (`requireDownloadedEngine`); it is never fetched from the app's server. The part of the app that asked for it shows the download prompt (`EngineDownloadAlert`) with a button to switch to the bundled engine, and starts the engine by itself once the download completes. A stored copy whose hash no longer matches the registry is "out of date" and must be downloaded again.
- **Bridge engines are the user's to host.** The app always looks for the bridge at `127.0.0.1:8787` on the user's own computer, never on the server that hosts the app.
- **Wanted versus running.** Every `useEngineState(name, purpose)` call reports what it asked for and whether that engine runs; Settings → Models → "In use now" lists them. Each engine's own status line says "Comes with the app", "Downloaded", "Not downloaded" or "out of date", plus "In use" while an instance runs in the tab.

Downloads need a secure context (HTTPS or localhost) with Cache Storage and service workers. Elsewhere only the bundled engine, the joke engines and bridge engines run. Downloads made before v2 (copies of the app's own files) are carried over once when they match the registry's hashes.
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

The user runs the bridge and the engines on their own computer. Put the program in `engines/` and add it to `engines/engines.json` (`id`, `name`, `path`, optional `args`, `elo`, `description`). Press Check bridge in Settings → Models. The bridge starts only programs named in that file and binds `127.0.0.1` only. It answers pages from `localhost:3000` and `127.0.0.1:3000`, plus any origin listed in `allowedOrigins` in the same file or in the `BRIDGE_ORIGINS` environment variable (comma list): that is how a copy of the app hosted elsewhere reaches the user's own bridge. It answers the browser's private-network preflight for those origins only. It reports each program's options from its own `uci` reply.

## Engine files

`src/lib/engine/engineFiles.json` lists every browser engine file with its size, SHA-256 and a pinned public URL that sends CORS headers, so browsers can download it. `bundled` names the files the app serves. The app reads it for downloads; `scripts/fetch-engines.mjs` reads it to restore files on disk:

- the bundled files go to `public/engines/` (git holds the loader, not the `.wasm`);
- every other engine goes to `engine-files/` (ignored by git, never served), only for the Node scripts.

The script checks size and hash and moves a file into place only when it matches, so an interrupted download never leaves a half file behind. It runs before `npm run dev`, `build` and `start` (bundled files only).

```bash
npm run engines                    # restore the bundled engine
npm run engines -- --all           # also restore every other engine into engine-files/
npm run engines -- --verify        # hash every file on disk and replace any that differ
npm run engines -- --check         # report only; also fails when public/engines holds anything else
```

Sources: Stockfish 19 from unpkg (`stockfish@19.0.1`, the npm build of [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js); GitHub release downloads send no CORS headers), Stockfish 11 to 18 from the upstream Chesskit repository at commit `9622d50`, Lozza 12.0 and tomitankChess 7.0 from their repositories at the release commits. To add or update an engine, add an entry with the file's byte size, SHA-256 and a URL that will not change (a commit or an exact version, never a branch) and that a browser may fetch (CORS). To change which engine is bundled, change `bundled`, move its files into `public/engines/` and point `DEFAULT_ENGINE` at it.

## Checking engines

```bash
npm test
ENGINE=lozza_nnue,tomitank_7,stockfish_19_lite node --import ./tests/register.mjs scripts/measure-arrow-depth.mjs
```

`scripts/lib/uciProcess.mjs` runs any real engine of the registry under Node (Lozza through `scripts/lib/workerShim.cjs`): the bundled one from `public/`, the others from `engine-files/`, so run `npm run engines -- --all` once first.
