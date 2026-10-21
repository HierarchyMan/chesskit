# Chesskit performance audit

The sluggishness has several concrete causes: a JavaScript-dependent blank startup, a large shared bundle, development mode in the normal launcher, synchronous PGN/image processing, and repeated reconstruction and storage of whole games. In the isolated production build, a 200-game import produced a **2,952 ms main-thread task**, reopening a 200-ply session produced a **464 ms task**, and scanning a sample produced an **836 ms task at 4× CPU slowdown**. The strongest improvements are to render the initial shell immediately, move expensive processing off the UI thread, eliminate repeated replay/database work, and optimise animation rendering while preserving its appearance.

**All fixes below are proposals. No application features, animations, source code, commits, pushes, or deployments were changed.** Findings are ranked by expected user impact, combining frequency, reach, and measured severity. A specialised workflow can have a larger individual stall than a higher-ranked site-wide problem.

## Findings ranked by impact

### 1. High — Every route waits for JavaScript before displaying any application content

**Evidence:** [layout/index.tsx:52](C:/Users/cystol/Projects/chess/chesskit/src/sections/layout/index.tsx:52) returns `null` while the theme preference is unresolved. [useLocalStorage.ts:9](C:/Users/cystol/Projects/chess/chesskit/src/hooks/useLocalStorage.ts:9) starts that preference at `null`; its effect at line 11 reads storage after mounting. The production export's `#__next` was empty, and a browser with JavaScript disabled displayed no application content. In the constrained page-load run, first contentful paint was 3,540 ms on Home, 4,372 ms on Analysis, and 3,796 ms on Play.

**Root cause:** Static export generates the page wrapper, but the layout gate prevents the application from being prerendered. HTML arrival cannot deliver the navigation or primary content; JavaScript download, evaluation, hydration, and a storage-driven render must happen first. The shared bundle in finding 2 magnifies this delay.

**Proposed fix:** Render the same shell and initial page structure during export. Resolve the existing light/dark preference in a small, early script and use matching theme CSS variables or colour-scheme initialisation so the first visible frame already has the correct colours. Hydrate private browser data inside the appropriate widgets rather than withholding the whole app. Preserve the existing preference, default, layout, and controls; do not introduce a light-theme flash or hydration mismatch.

**Validate:** Inspect exported HTML, compare first-frame screenshots for both themes and saved preferences, and remeasure cold startup under the same constrained profile. Rendering a placeholder alone does not establish that the primary content is ready.

### 2. High — Closed global dialogs and broad route prefetching make the initial download expensive

**Evidence:** [layout/index.tsx:9](C:/Users/cystol/Projects/chess/chesskit/src/sections/layout/index.tsx:9) statically imports Settings, Smart Import, and Move Story, and lines 74–78 mount them globally. Their imports bring in the board stack even when closed: [settingsDialog.tsx:2](C:/Users/cystol/Projects/chess/chesskit/src/sections/settings/settingsDialog.tsx:2), [smartImportDialog.tsx:1](C:/Users/cystol/Projects/chess/chesskit/src/sections/importDialog/smartImportDialog.tsx:1), and [moveStoryDialog.tsx:1](C:/Users/cystol/Projects/chess/chesskit/src/components/moveStoryDialog.tsx:1). Navigation links use default prefetching at [NavMenu.tsx:53](C:/Users/cystol/Projects/chess/chesskit/src/sections/layout/NavMenu.tsx:53) and [hub.tsx:154](C:/Users/cystol/Projects/chess/chesskit/src/sections/hub/hub.tsx:154).

The measured production `_app` chunk was **1,371,795 bytes raw / 375,367 bytes gzip** and contained board/DnD code and opening data. Home's required JavaScript total was **488,762 bytes gzip**; Analysis/editor required **667,857 bytes gzip**. On Home, another **386,570 encoded JavaScript bytes actually crossed the network** for resources outside Home's required manifest, including chart and database chunks. This excludes cache-only duplicate timing entries.

**Root cause:** The global dependency graph pays for occasional interactions on every page. Visible navigation/card links then fetch much of the rest of the application immediately after startup. “Dialog closed” does not prevent its statically imported code from entering the bundle.

**Proposed fix:** Split heavy dialog bodies with `next/dynamic`; keep their lightweight state, keyboard shortcuts, and global paste/drop listeners immediately available. Prefetch dialog code on intent or idle, and prioritise likely navigation destinations instead of fetching every tool during startup. Split chart and specialised analysis/editor code at their actual feature boundaries. Keep every route, dialog, shortcut, icon, and transition. Maintain a fast first-open experience with intent preloading rather than replacing the dialog animation with a visibly different loader. [Next.js documents this loading mechanism](https://nextjs.org/docs/pages/guides/lazy-loading).

**Validate:** Compare route manifests and actual transferred bytes, then exercise Import/Ctrl+V, Ctrl+K, Settings, and Visualize from a cold page. Measure both startup and first-open latency; do not move all the delay into the first click.

### 3. High for the supplied local setup — The normal launcher runs the development server

**Evidence:** [start-chesskit.bat:11](C:/Users/cystol/Projects/chess/start-chesskit.bat:11) executes `npm run dev`; [package.json:7](C:/Users/cystol/Projects/chess/chesskit/package.json:7) maps that to `next dev`. On this machine, three fresh-context Home loads through the existing development server painted at **1,216 / 540 / 508 ms**; the isolated production export painted at **168 / 172 / 168 ms**. Network-transferred JavaScript during the observation window was approximately **1.84 MiB in development versus 855 KiB in production**, including production prefetches.

**Root cause:** The everyday launcher selects on-demand compilation, development instrumentation, and unoptimised code delivery. Its first request can also incur compilation. The measurements include that operational difference; they are not an isolated experiment on React Strict Mode alone.

**Proposed fix:** Add a normal-use launcher that builds when necessary and serves the existing static export, keeping development launch as a separate supported command. Preserve the `localhost:3000` origin expected by the Reckless bridge, correct WASM/SVG MIME types, extensionless route handling, asset caching, and all existing features. Because [next.config.ts:6](C:/Users/cystol/Projects/chess/chesskit/next.config.ts:6) uses `output: "export"` for production, serve `out`; do not assume `next start` is the appropriate server for this build. [Next.js distinguishes its development, build, and production commands](https://nextjs.org/docs/app/api-reference/cli/next).

**Validate:** Launch using the revised normal entry point, reopen every route directly, exercise the bridge from the preserved origin, and compare cold/warm performance. This finding applies to local launch; it does not establish how any public deployment is served.

### 4. High — Bulk PGN import blocks the UI, then renders every game row

**Evidence:** [pgn.ts:182](C:/Users/cystol/Projects/chess/chesskit/src/lib/pgn.ts:182) synchronously maps the entire import through `parseSingleGame`; [pgn.ts:154](C:/Users/cystol/Projects/chess/chesskit/src/lib/pgn.ts:154) loads each PGN, and lines 159–165 regenerate PGN and history. [smartImportDialog.tsx:59](C:/Users/cystol/Projects/chess/chesskit/src/sections/importDialog/smartImportDialog.tsx:59) calls detection from a deferred render. [globalListeners.tsx:46](C:/Users/cystol/Projects/chess/chesskit/src/sections/importDialog/globalListeners.tsx:46) also fully detects pasted text before opening the dialog. [pgnGameList.tsx:31](C:/Users/cystol/Projects/chess/chesskit/src/sections/loadGame/pgnGameList.tsx:31) renders every result inside a height-limited list.

A 137,398-character fixture containing **200 games × 100 plies** produced browser long tasks of **438 ms and 2,952 ms**, with 2,150 DOM elements present afterward. The source-only parser benchmark had a 499 ms median for this fixture; therefore parsing alone does not explain the entire browser stall. List rendering and the rest of the UI update also matter.

**Root cause:** `useDeferredValue` changes scheduling priority but does not turn a synchronous parser into interruptible or parallel work. A scroll container limits visible height, not the number of rendered rows. Global paste can additionally parse the same input before the dialog parses it again. [React describes deferred rendering as interruptible between rendering work](https://react.dev/reference/react/useDeferredValue); a long synchronous function still occupies its executing thread.

**Proposed fix:** Parse/normalise in a dedicated worker, tag jobs with input versions, and ignore obsolete results. Reuse detection results across paste and dialog entry. Process results incrementally and virtualise the PGN result viewport with identical row sizes, labels, buttons, scrolling, and keyboard access. Keep the complete imported source and all results available for selection, saving, and export; introduce no game-count reduction.

**Validate:** Repeat file, paste, and typed imports with valid/invalid mixed games; check every row/action remains reachable and complete saves match the source. Measure parsing and React rendering separately.

### 5. High — Analysis replay has quadratic work and repeats it during validation and restoration

**Evidence:** [analysisSession.ts:78](C:/Users/cystol/Projects/chess/chesskit/src/lib/analysisSession.ts:78) loads the full PGN, then line 84 repeatedly evaluates `game.history().length` while undoing toward the requested ply. Validation replays the root at [analysisSession.ts:231](C:/Users/cystol/Projects/chess/chesskit/src/lib/analysisSession.ts:231) and the selected cursor at line 249. [useAnalysisPersistence.ts:63](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/hooks/useAnalysisPersistence.ts:63) validates before restoring the session. Branch capture also reparses candidate lines at [analysisSession.ts:99](C:/Users/cystol/Projects/chess/chesskit/src/lib/analysisSession.ts:99).

Source benchmark medians:

| Fixture length | Replay to ply 0 | Validate session at ply 0 |
|---|---:|---:|
| 100 plies | 48 ms | 96 ms |
| 200 plies | 180 ms | 366 ms |
| 400 plies | 706 ms | 1,421 ms |

Reopening a 200-ply fixture in the production browser produced a **464 ms long task**. Finding a new branch against 40 stored alternatives took **465 ms at 200 plies** and **1,279 ms at 400 plies** in source benchmarks.

**Root cause:** `history()` reconstructs history rather than returning an O(1) counter. Calling it after every undo creates a quadratic replay path. Validation, restoration, prefix checks, and branch search then repeat related work.

**Proposed fix:** Compute the move count once and use a numeric undo loop. Cache immutable move sequences/prefix keys by complete line PGN or revision, and reuse validated replay data within one load. Index branch paths rather than reparsing every alternative for each move. Preserve headers, comments, root FEN, repetition history, counters, castling rights, promotions, cursor position, and branch-storage-off semantics; replacing games with FEN-only snapshots would lose features.

**Validate:** Compare complete replay/backup results before and after, including Black-to-move roots and underpromotion. Repeat the scaling benchmark; a counter-only loop should remove the observed quadratic growth without weakening validation.

### 6. High — Image detection and recognition run synchronously on the main thread

**Evidence:** [scanPage.tsx:83](C:/Users/cystol/Projects/chess/chesskit/src/sections/scan/scanPage.tsx:83) calls `detectBoardGrid` directly after image loading; the rerun action at line 328 does the same. [scanPage.tsx:135](C:/Users/cystol/Projects/chess/chesskit/src/sections/scan/scanPage.tsx:135) calls `scanBoard` synchronously in a render memo. [scanBoard.ts:27](C:/Users/cystol/Projects/chess/chesskit/src/lib/scan/scanBoard.ts:27) analyses all 64 cells; [gridDetect.ts:22](C:/Users/cystol/Projects/chess/chesskit/src/lib/scan/gridDetect.ts:22) and the subsequent search/refinement code traverse image data on the calling thread.

The production sample operation produced a **180 ms long task** on desktop and an **836 ms task at 4× CPU slowdown**. Separate synthetic 640×640 and 1600×1600 checkerboard detection benchmarks took approximately **491 ms and 458 ms** respectively; these are different fixtures from the browser sample, not predictions that detection scales monotonically with pixel count.

**Root cause:** Both detection and classification occupy the UI thread. Deferring the grid state does not make the body of `scanBoard` yield once started. Pointer input, progress updates, and animations must wait behind that work.

**Proposed fix:** Transfer image pixels once to a recognition worker, then send grid/orientation jobs with sequence IDs. Keep the same algorithms, search limits, all templates, confidence values, and output. Discard stale jobs/results and prioritise the newest crop; preserve the final classification for the exact final frame position. Keep the crop overlay tracking the pointer independently, and coalesce pointer updates to actual display frames without changing its visible trajectory or handles.

**Validate:** Compare FENs, confidences, orientation and grid coordinates on the same images; rapidly drag, resize, change orientation and load another picture. Verify progress animations and input remain responsive. The existing 20-step desktop drag had no >50 ms tasks; the measured severe stall was image processing, not proof that every drag stutters.

### 7. High at collection scale — Every added game refreshes the entire database

**Evidence:** [useGameDatabase.ts:40](C:/Users/cystol/Projects/chess/chesskit/src/hooks/useGameDatabase.ts:40) executes `db.getAll("games")`. Each addition calls it again at line 58. [smartImportDialog.tsx:114](C:/Users/cystol/Projects/chess/chesskit/src/sections/importDialog/smartImportDialog.tsx:114) and [loadGameDialog.tsx:88](C:/Users/cystol/Projects/chess/chesskit/src/sections/loadGame/loadGameDialog.tsx:88) add imported games individually. The globally mounted importer also owns a `useGameDatabase` hook, while page hooks independently load the same shared game list.

Saving **50 games into 100 existing games** caused **50 `getAll` requests and 6,275 returned records**: `101 + 102 + … + 150`. Navigating to Database with 200 analysed games produced three full reads, returning 600 records during that observation. Home's recent-game panel also starts from the complete collection before selecting its few recent entries at [hub.tsx:288](C:/Users/cystol/Projects/chess/chesskit/src/sections/hub/hub.tsx:288).

**Root cause:** Mutation and refresh are coupled per row; refresh ownership is duplicated across mounted hooks. IndexedDB is asynchronous, but reading/cloning full PGNs and evaluations and publishing replacement arrays still costs CPU and memory. Bulk import grows toward quadratic record traffic.

**Proposed fix:** Add a batch insertion path with explicit per-game failure semantics and one invalidation at completion. Centralise/deduplicate collection queries; update known records incrementally. Give Home a recent-record cursor query and Database a metadata/paged query, fetching full PGN/evaluation only when needed. Keep all games, sort/filter/copy actions, evaluation data and IDs; database pagination must not limit search or export completeness.

**Validate:** The same bulk save should preserve all accepted games while issuing one final collection refresh, not 50. Verify failures, updates, deletes and cross-route freshness, and compare complete stored records.

### 8. Medium–high — A slow cloud lookup delays local analysis even after the engine is ready

**Evidence:** [uciEngine.ts:406](C:/Users/cystol/Projects/chess/chesskit/src/lib/engine/uciEngine.ts:406) starts the cloud request; line 430 awaits it before the local `go` command at line 445. [lichess.ts:88](C:/Users/cystol/Projects/chess/chesskit/src/lib/lichess.ts:88) gives the request a 500 ms timeout. Cloud evaluation defaults on at [states.ts:71](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/states.ts:71).

In three controlled slow-cloud/miss runs, the interval from the worker's first `readyok` to local `go` was **513–515 ms**. With the same engine and cloud disabled for comparison, it was **10–12 ms**. This demonstrates the fallback delay; it does not imply that every cloud request is slow or that the cloud feature should be disabled.

**Root cause:** The supposedly helpful lookup sits on the critical path before local computation. Slow misses add roughly half a second to fresh positions even though the selected engine could already work.

**Proposed fix:** Cache successful and recent negative cloud results by full FEN/line requirements, deduplicate in-flight requests, and start a speculative local search while awaiting cloud. Preserve the existing rule that a qualifying cloud result is preferred: buffer local updates until that decision is made, stop/drain the speculative search safely if cloud wins, and publish only results belonging to the current position. Keep the timeout, toggle and source semantics.

**Validate:** Compare cloud hit, insufficient-depth hit, miss, timeout and rapid board changes. Check that results and source labels remain correct and stale `bestmove` messages cannot contaminate the next search.

### 9. Medium–high at collection scale — Learn and Puzzles rebuild mistake data from every analysed PGN

**Evidence:** [mistakes.ts:52](C:/Users/cystol/Projects/chess/chesskit/src/lib/mistakes.ts:52) loads each analysed game's PGN; line 57 obtains verbose history. [mistakes.ts:102](C:/Users/cystol/Projects/chess/chesskit/src/lib/mistakes.ts:102) extracts and sorts the full collection before applying the result limit. Learn requests only 12 results at [learnPage.tsx:91](C:/Users/cystol/Projects/chess/chesskit/src/sections/learn/learnPage.tsx:91), but the limit does not bound extraction work. [usePuzzleTrainer.ts:116](C:/Users/cystol/Projects/chess/chesskit/src/sections/puzzles/usePuzzleTrainer.ts:116) derives mistake puzzles regardless of the currently selected puzzle source.

Loading Learn with **200 analysed 100-ply fixtures** produced long tasks of **299 ms and 289 ms**. The same observation contained two full database reads. The combined cost includes the shared reload behaviour in finding 7; it is not a separately attributable parser-only measurement.

**Root cause:** Small visible output is derived from a full-library parse and sort. Replacing the shared games array invalidates that derivation, and ordinary Lichess/offline puzzle users can pay for mistake preparation too.

**Proposed fix:** Maintain derived mistake records keyed by game ID plus PGN/evaluation revision, updating only changed games. Perform initial extraction/indexing in a worker. Query the highest-ranked entries for Learn and prepare the complete mistake puzzle collection on demand or at idle. Keep rankings, ownership filtering, all mistakes, deep links, and Visualize data intact.

**Validate:** Compare ranked results and puzzle positions against a full recomputation after add, analysis update and delete. Measure a large existing library and a one-game change; an array replacement should not trigger a complete reparsing pass.

### 10. Medium — Sidebar animation causes React-driven board reconstruction during resize

**Evidence:** [NavMenu.tsx:202](C:/Users/cystol/Projects/chess/chesskit/src/sections/layout/NavMenu.tsx:202) and line 209 animate drawer width. [useScreenSize.ts:13](C:/Users/cystol/Projects/chess/chesskit/src/hooks/useScreenSize.ts:13) publishes every observed width, while [useBoardLayout.ts:22](C:/Users/cystol/Projects/chess/chesskit/src/hooks/useBoardLayout.ts:22) creates fresh dimension state from observer/window events. At [board/index.tsx:252](C:/Users/cystol/Projects/chess/chesskit/src/components/board/index.tsx:252), a changed `boardSize` creates a new square component type through [squareRenderer.tsx:35](C:/Users/cystol/Projects/chess/chesskit/src/components/board/squareRenderer.tsx:35).

Collapsing the sidebar on a loaded 200-ply analysis page caused **30 layouts, 51 style recalculations, 108 ms of script time, and 246 ms of total task time** over the approximately 400 ms measurement window. Those totals include the collapse interaction and its consequences, not just CSS animation execution.

**Root cause:** A necessary visual resize is amplified into repeated React state updates and replacement square component identities, rebuilding subscriptions and rendering work while the board changes size. This is more than the unavoidable geometry change of the sidebar itself.

**Proposed fix:** Keep square component types stable, pass changing icon geometry through CSS variables or context, publish dimension updates at most once per frame, and skip identical measurements. Let CSS own layout where possible. Preserve the exact width curve, duration, board resizing, responsive breakpoints, label appearance and hit targets. Changing only the drawer to a transform while leaving content at its old width would not preserve this animation.

**Validate:** Record collapse/expand and manual resizing at both layouts. Compare intermediate frames, board/piece geometry and focus, and remeasure component mounts, layouts and scripting during the transition.

### 11. Medium — The evaluation bar animates layout properties on every frame

**Evidence:** Both segments at [evaluationBar.tsx:60](C:/Users/cystol/Projects/chess/chesskit/src/components/board/evaluationBar.tsx:60) and line 93 use `transition: "height 1s"`; percentage heights are assigned at lines 62 and 95. Engine partial updates can publish approximately every 60 ms at [uciEngine.ts:415](C:/Users/cystol/Projects/chess/chesskit/src/lib/engine/uciEngine.ts:415). This finding is source-confirmed; isolated evaluation-bar frame cost was not measured separately from the rest of the page.

**Root cause:** Repeated targets keep retargeting two one-second layout animations. The effect has a predictable layout cost even when piece movement itself uses efficient transforms. Its contribution is more likely to matter alongside analysis/rendering work than on an otherwise idle desktop.

**Proposed fix:** Use fixed-size clipped layers and a composited moving boundary or transformed fill. Render labels in separate, unscaled layers so text size and its top/bottom anchoring remain identical. Preserve the exact one-second duration, existing easing, interrupted-transition behaviour, colours, orientation, corner treatment and label-switch rules. Do not simply apply `scaleY` to the existing text-containing segments. [The browser rendering guidance recommends avoiding layout/paint animation work where a matching transform can be used](https://web.dev/articles/animations-guide).

**Validate:** Compare full frame sequences for rising, falling, rapidly reversing and mate evaluations in both orientations. Confirm the optimised implementation reduces layout work without altering the visible animation.

### 12. Medium — Every session edit writes the whole session and refreshes the session library

**Evidence:** [useAnalysisPersistence.ts:111](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/hooks/useAnalysisPersistence.ts:111) saves on every session identity change, and line 124 increments the library revision after each save. [sessionPanel.tsx:68](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/sessionPanel.tsx:68) reloads the library on that revision while open. [gameDatabase.ts:78](C:/Users/cystol/Projects/chess/chesskit/src/lib/gameDatabase.ts:78) loads and sorts complete sessions, including branches/evaluations. [sessionPanel.tsx:197](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/sessionPanel.tsx:197) also replays branch PGNs to generate labels.

Typing an 18-character session-name suffix at 35 ms per key caused **18 full session-library reads** in the one-session fixture. This was not a >50 ms stall in that small library, but the amount of cloned data grows with session and branch count.

**Root cause:** Small metadata changes trigger whole-object persistence, full-library refreshes, and dependent replay work. The serial save queue preserves ordering but does not coalesce obsolete work.

**Proposed fix:** Update the known library metadata incrementally after a committed save and read full session payloads only when opening/exporting them. Cache branch labels by line content. Coalesce pending writes where the preservation contract allows it, flushing explicitly before navigation, session changes and backup operations. Keep revision/conflict checks, truthful save status, retry, draft preservation, and the durable save guarantees; a plain debounce that loses recent work is not acceptable.

**Validate:** Rename and navigate rapidly in a large library, reload after saves, create a second-tab conflict, and verify exact restored branches/evaluations. A successful local edit should not require rereading unrelated session payloads.

### 13. Medium, conditional on a load failure — A failed engine download can remain “Loading” indefinitely

**Evidence:** [worker.ts:11](C:/Users/cystol/Projects/chess/chesskit/src/lib/engine/worker.ts:11) constructs the worker; the wrapper handles messages but does not propagate worker startup/error failures. [worker.ts:80](C:/Users/cystol/Projects/chess/chesskit/src/lib/engine/worker.ts:80) creates resolve-only command promises without a deadline. [uciEngine.ts:249](C:/Users/cystol/Projects/chess/chesskit/src/lib/engine/uciEngine.ts:249) awaits UCI readiness. [useEngine.ts:55](C:/Users/cystol/Projects/chess/chesskit/src/hooks/useEngine.ts:55) can display its error state only if engine creation rejects.

With the WASM request deliberately aborted, Play still displayed **“Loading engine…” after five seconds**, with no worker messages. The failure was repeated with service workers blocked to rule out cache interception. The UI remained operable; this was a stuck prerequisite, not proof of a frozen event loop.

**Root cause:** Worker failure never settles the pending readiness promise, so the existing error/retry UI cannot activate. Navigation during pending creation also cannot promptly terminate a worker that has not yet been handed to the hook.

**Proposed fix:** Propagate `error`/`messageerror` and connection failure into rejectable jobs, add suitable startup deadlines/cancellation, and track workers from construction through readiness. Reject queued jobs and terminate abandoned initialisation resources on cancellation. Use the existing error/Retry UI and preserve the selected engine and position; do not silently substitute a weaker engine or discard the game.

**Validate:** Abort/corrupt model loads, disconnect the bridge, switch models while loading, navigate away, and retry. Verify bounded failure time and resource cleanup. Differentiate an actual slow large download from an engine that has failed.

### 14. Medium — Engines initialise or search before their results are needed

**Evidence:** [engineContext.tsx:22](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/engineContext.tsx:22) creates an engine, and line 47 starts current-position evaluation without checking arrange mode. A fresh `/editor` visit issued **`go depth 14` while “Arrange the board” was visible**. [useArena.ts:58](C:/Users/cystol/Projects/chess/chesskit/src/sections/arena/useArena.ts:58) and line 59 initialise both players before the match starts. A same-engine arena setup created two workers; starting added its independent analysis worker. [play.tsx:24](C:/Users/cystol/Projects/chess/chesskit/src/pages/play.tsx:24) also initialises the bot during setup.

**Root cause:** Page mounting acts as the demand signal, even when editing a draft or configuring a match. Each instance loads/instantiates its own model state. Multiple instances are legitimate for independent bot/evaluator options, but unnecessary speculative work increases startup and memory pressure.

**Proposed fix:** Separate preparation from active search: stop evaluation of the old board while arranging a draft, start searches when their results are required, and schedule preparation after the primary UI is ready. Reuse compiled model preparation where the engine build supports it while keeping separate worker state/hash/options for players and evaluator. Preserve ready indicators, all models, exact configured strength/depth, coach feedback and independent arena analysis. Do not combine logically independent engines into one mutable search instance.

**Validate:** Observe setup, editor mode changes, match start, coach/hints, engine changes and navigation. Ready arena workers did terminate on Home navigation in this audit; this finding is avoidable work, **not a demonstrated general worker leak**.

### 15. Medium–low — Initial board geometry is provisional and visibly shifts on mobile

**Evidence:** [useBoardLayout.ts:17](C:/Users/cystol/Projects/chess/chesskit/src/hooks/useBoardLayout.ts:17) initially assumes 900×800, then replaces it after mounting. [useScreenSize.ts:4](C:/Users/cystol/Projects/chess/chesskit/src/hooks/useScreenSize.ts:4) uses provisional dimensions, with a different height offset on resize at line 27. Mobile startup recorded layout-shift totals of **0.381 on Play** and **0.212 on Analysis** over the sampled window; the largest individual shifts were 0.380 and 0.208 respectively. These are lab observations, not field Core Web Vitals. Fonts and content changes can also contribute; the totals are not solely attributed to the sizing hooks.

**Root cause:** Initial layout and post-measurement layout can choose different board sizes and side-by-side/stacked placement. The browser can paint a provisional arrangement before observer and responsive state settle, making startup feel unfinished even after first paint.

**Proposed fix:** Reserve the final board area using CSS aspect ratio and the existing breakpoint rules, align initial geometry with the viewport, and avoid publishing unchanged measurements. Reconcile the height offsets so resize does not change the sizing rule unexpectedly. Preserve the final sizes, stacking, content, and all deliberate transitions; this concerns unintended startup movement.

**Validate:** Capture cold-load filmstrips at narrow/wide viewports, both themes and saved sidebar preferences. Attribute remaining shifts to elements rather than assuming a single cause from the aggregate score.

### 16. Low–medium — Opening lookups scan the full catalogue repeatedly

**Evidence:** [useCurrentPosition.ts:66](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/hooks/useCurrentPosition.ts:66) walks backward through history, running `openings.find` for each placement at line 68. [moveClassification.ts:22](C:/Users/cystol/Projects/chess/chesskit/src/lib/engine/helpers/moveClassification.ts:22) repeats linear lookup for classified positions. The catalogue contains **3,401 entries**. For 200 absent placements, the source benchmark median was **5.23 ms** using linear scans versus **0.012 ms** using an indexed lookup. This is a source benchmark, not a measured 5 ms cost on every UI interaction.

**Root cause:** A stable catalogue is searched as an array inside repeated position/history operations. Long games outside the book maximise failed scans. Related opening data already has an indexed implementation at [arenaAnalysis.ts:95](C:/Users/cystol/Projects/chess/chesskit/src/lib/engine/arenaAnalysis.ts:95).

**Proposed fix:** Share a placement-to-opening index across consumers and cache the latest recognised opening per immutable history/revision. Preserve the existing first-match rule for duplicate placements and the rule that the last named position remains the opening after leaving the book. Keep every opening and label.

**Validate:** Compare all catalogue placements, duplicate entries, non-book games and transpositions against the current results. This is a supporting optimisation after the larger blocking work above.

## Measurement method and boundaries

- **Date and baseline:** 21 October 2026; `C:\Users\cystol\Projects\chess\chesskit`, commit `ac9eb32b886b0f184f98e6058bab9836196c0442`. The tracked working tree was clean at entry and remained unchanged throughout investigation.
- **Environment:** Windows, Intel Core i7-14650HX, 24 logical processors, Node 24.14.1, installed Next.js 16.2.3 / React 19.2.5, headless Chromium 156.0.8078.4. Desktop viewport: 1440×900. Constrained viewport: 390×844, DPR 1, page-target CPU slowdown 4×, network 1.6 Mib/s down / approximately 750 Kib/s up with 150 ms configured latency. This is emulation on a fast desktop, not a physical mobile device. Page-target network emulation does not establish identical network throttling inside engine workers.
- **Isolation:** Synthetic games/sessions lived in fresh, disposable browser contexts on `http://127.0.0.1:8031`; personal browser data was not used. Production source was copied to a temporary directory. An existing build lock in the workspace was respected. The first isolated Turbopack attempt rejected the external `node_modules` junction, so the successful export used `npm run build -- --webpack`. This is an audit build with the same application source; its chunk numbers and timings are not a guarantee of the default Turbopack output or a deployed build.
- **Serving:** The isolated export was served with correct static MIME types, gzip for JS/CSS/HTML/SVG, and long-lived asset caching. Local serving removes real CDN/origin variability. The existing development server on port 3000 was measured separately without changing its configuration.
- **Instrumentation:** Browser PerformanceObserver for paint, long tasks and layout shifts; Resource Timing and build manifests for bytes; CDP performance counters for resize; worker command/lifecycle and IndexedDB request instrumentation for mechanism checks. Resource Timing's buffer was expanded for the 492-template scan measurement. Earlier capped scan resource totals were excluded. Transfer totals exclude cache-only entries; required-route gzip sizes come from compressing manifest assets once each.
- **Samples:** Route table values are single fresh-context observations. The development/production Home comparison and controlled cloud comparison each used three runs. Source benchmarks report warmed medians of three runs, except small parser/history/lookup cases, which used seven. The long-game scaling fixture repeats legal knight moves; it isolates length-dependent replay cost and is not representative of every real game. No test-suite count is used as a performance result.
- **Coverage:** Every application route was loaded from the export: Home, Analysis, Editor, Play, Arena, Database, Learn, Puzzles, Openings, Endgames, Vision, Scan, and the developer scan-lab route. The exported 404 page was also opened and painted at 144 ms; serving that file directly does not verify production error-response status handling. Additional journeys exercised PGN import/save, a large analysed library, saved-session reopening/renaming, sidebar collapse, scan preparation/sample/crop drag, arena setup/start/step/navigation cleanup, opening study, a timed vision round, and a timed human/bot move with coach feedback. The developer scan lab intentionally renders no lab content in production at [scan-lab.tsx:57](C:/Users/cystol/Projects/chess/chesskit/src/pages/dev/scan-lab.tsx:57). Source review also covered engine/cache/model handling, API loaders, graph/move rendering, persistence, shared controls, sound loading, telemetry configuration, and CDK hosting/cache configuration.
- **Limits:** No public deployment URL or real-user dataset was supplied. CDN response times, actual production compression/cache effectiveness, field LCP/INP/CLS percentiles, physical mobile GPU behaviour, and prolonged memory growth are unverified. This was not a Lighthouse run; task totals below are sums of `max(0, task duration − 50 ms)` over each observation window, not Lighthouse TBT or INP. A collapsed-menu locator timeout was an automation-path failure; independent remaining journeys were resumed with the correct route and it was not reported as a product defect.

### Production route baseline

Required gzip JavaScript includes shared `_app` assets and route dependencies; it excludes speculative prefetches, fonts, images and engine WASM. FCP means first contentful paint; LCP is the latest largest-contentful-paint entry observed in the window.

| Route | Required JS, gzip KiB | Desktop FCP, ms | Observed desktop LCP, ms | Observed long-task excess, ms |
|---|---:|---:|---:|---:|
| `/` | 477 | 200 | 200 | 0 |
| `/analysis` | 652 | 168 | 944 | 0 |
| `/editor` | 652 | 168 | 236 | 0 |
| `/play` | 513 | 188 | 188 | 36 |
| `/arena` | 498 | 184 | 232 | 28 |
| `/database` | 582 | 184 | 184 | 20 |
| `/learn` | 469 | 156 | 156 | 0 |
| `/puzzles` | 489 | 168 | 212 | 17 |
| `/openings` | 492 | 176 | 176 | 0 |
| `/endgames` | 474 | 204 | 204 | 41 |
| `/vision` | 474 | 156 | 156 | 9 |
| `/scan` | 477 | 144 | 144 | 0 |
| `/dev/scan-lab` | 470 | 140 | 140 | 0 |

| Constrained route | FCP, ms | Observed LCP, ms | Long-task excess, ms | Largest task, ms |
|---|---:|---:|---:|---:|
| `/` | 3,540 | 3,540 | 389 | 224 |
| `/analysis` | 4,372 | 4,632 | 436 | 214 |
| `/play` | 3,796 | 3,796 | 479 | 345 |
| `/scan` | 3,380 | 3,380 | 259 | 206 |

Fast empty-library desktop loads do not contradict the slow bulk/long-session paths: they exercise different amounts of main-thread work.

## Additional optimisation and preservation checks

These are lower-priority opportunities or boundaries, not additional measured high-impact findings:

- **Scan preparation:** [templates.ts:59](C:/Users/cystol/Projects/chess/chesskit/src/lib/scan/templates.ts:59) prepares 41 piece sets × 2 colours × 6 types. The uncapped capture recorded **492 SVG requests, 627,291 encoded body bytes and 1,489,166 decoded bytes**, finishing in roughly 959 ms on the local desktop run. Consider versioned, precomputed descriptors generated by the same rasterisation pipeline, retaining all sets and a runtime compatibility fallback. Recognition equivalence across browsers must be demonstrated before substituting them. The existing promise cache already avoids rebuilding on every remount within the same document.
- **Streaming engine messages:** [worker.ts:85](C:/Users/cystol/Projects/chess/chesskit/src/lib/engine/worker.ts:85) accumulates messages; [parseResults.ts:13](C:/Users/cystol/Projects/chess/chesskit/src/lib/engine/helpers/parseResults.ts:13) rescans the history and repeatedly splits strings. At 60/300/1,000 synthetic UCI lines the medians were only **0.25/1.03/3.52 ms** on this machine. The existing 60 ms publication throttle matters. An incremental per-MultiPV parser can bound deep-search work while preserving depth ordering, score perspective, castling conversion and final publication, but the evidence does not make this the leading cause of current sluggishness.
- **Hidden tabs:** [analysisPage.tsx:240](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/analysisPage.tsx:240) mounts Graph, Analysis and Moves even when CSS hides a tab. Long move lists at [movesList.tsx:133](C:/Users/cystol/Projects/chess/chesskit/src/components/movesList.tsx:133) are fully rendered. Consider suspending presentation-only subscriptions or virtualising long viewports while retaining analysis, selection, scroll restoration, all data and the same appearance on reveal. No isolated hidden-tab saving was measured here.
- **Telemetry:** [sentry.client.config.ts:10](C:/Users/cystol/Projects/chess/chesskit/sentry.client.config.ts:10) enables replay integration and line 17 samples traces at 100% when the production-host/DSN guard passes. That guard did not pass locally. If production telemetry is material, lazy-load its heavy integration and use a deliberate sampling policy; retain error capture and required replay behaviour. Local measurements cannot assign a runtime cost to a disabled integration.
- **Existing safeguards worth retaining:** Stockfish searches run in workers, engine files load by selected model, explicit offline model storage exists, network queries use cancellation/debouncing in several loaders, board squares already have selective atom subscriptions, React Compiler is enabled, and the database grid already virtualises its viewport. Approximately 402 MB of engine assets on disk is not evidence that every visitor downloads all of them. Blanket memoisation, removing engines, disabling the coach, truncating saved games, or shortening animations would be inappropriate fixes.

## Proposed order of work and acceptance

1. Remove the blank startup dependency and split the shared loading graph; provide a production normal-use launcher. Repeat both startup and first-dialog/route-open measurements.
2. Move import and scan processing off the UI thread, and remove quadratic replay. Preserve complete data and compare actual results against the current algorithms.
3. Batch database work, index mistake data, and remove the cloud fallback wait from the local computation path while preserving cloud preference semantics.
4. Stabilise resize/component ownership, optimise the evaluation-bar layers, and reduce full-session refreshes. Preserve all animation timing, easing, paths, colours, labels and intermediate-frame composition.
5. Add bounded engine startup failure/cancellation and demand-aware preparation, then recheck large collections, long sessions, rapid navigation and concurrent saves.

Use the fixtures and hardware/profile settings above for before/after comparisons. Target no >50 ms UI-thread processing tasks for worker-based import/scan updates, near-linear replay growth, one bulk-save invalidation, and no unrelated session-library reread per keystroke. Those are acceptance targets, not claims already achieved. For every animation change, compare recordings/frame sequences at matched timestamps and use performance traces to establish a rendering improvement; a lower frame rate, shorter duration, missing effect, or reduced data is not an acceptable optimisation.

Raw measurements, scripts, build logs and selected captures were retained outside the repository in [the audit evidence directory](C:/Users/cystol/AppData/Local/Temp/chesskit-performance-audit-20261021). The report includes the essential evidence and remains usable without that temporary directory. No fixes were implemented, and no performance improvement or production delivery is claimed.
