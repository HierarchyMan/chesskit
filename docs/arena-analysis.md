# Arena analysis: live plan and behavior

Request: optional side toggles for an evaluation bar and visible analysis on each
move, integrated with Engine Arena's existing features. Work started 2026-10-21.
Baseline checkout was clean. The existing 297 tests and lint/typecheck pass.

## Owners and design

This is an addition to the existing arena, not a replacement application. This
document owns the feature models and development evidence; README owns usage.

### Intent and constraints (M1)

Keep watching, stepping, nudging and manually playing engine games. Add separate,
remembered switches for evaluation, annotations and the previous move's better
alternative. Toggles must remain accessible before, during and after a match.
The narrower rival (only expose the existing proposal evaluation) cannot rate
played moves or provide a stable independent assessment of two weakened bots.
The user has authorized implementation; routine presentation decisions are
delegated by the request for integration with the existing arena.

### Domain and data (M2)

Chess owns the actual move history and terminal result. Stored boolean atoms own
arena preferences, independently of Analysis/Play preferences. An independent
instance of the engine selected in the top bar owns evaluation, at depth 12 and
three lines, without cloud lookups or Elo limiting. Cached results use complete
FENs. Annotations derive from adjacent positions and the actual UCI move using
the existing classifier. Scores are already normalized to White by parseResults.
Only current-history entries are projected to the UI. Historical selection keys
now include the complete root/UCI path, so transposed move orders cannot reuse a
different history's selected explanation (2026-10-22 audit; see
analysis-remember-review.md). Cache hits may survive
takeback/replay, but abandoned branches cannot appear in the move list.

### Feature inventory (M3)

- Evaluation bar: default on, matching the existing arena; independent evaluation.
- Move annotations: default off; board badge/highlight, named move-list grades,
  evaluation after each move, selected move summary and existing Visualize dialog.
- Best-move arrow: default on (changed by the follow-up below); previous position's alternative, integrated with
  existing proposal/hover arrows and arrow deduplication.
- Evaluator loading/error/progress and Retry; no fabricated scores while pending.
- Catch up existing history if annotations are enabled partway through a game.

### Network (M4) and mechanisms (M5)

| Trigger | State/mechanism | Next responding feature and failure policy |
|---|---|---|
| Side switch | validated stored atom | Board visibility changes immediately; refresh remembers it |
| Any actual move | Chess history → analysis session | Current score and all requested history grades catch up asynchronously |
| Top-bar engine change | separate useEngineState instance | Cache/session replaced; playing bots are untouched |
| Current evaluation completes | FEN-matched projection → arenaDataAtom | Shared EvaluationBar and square renderer show this position only |
| Grade completes | shared classifier → history entry | Move list/summary and Visualize use the same move and evaluations |
| Takeback/restart/new match | new current history | Old annotations/arrow removed; reusable cached raw scores remain safe |
| Change players mid-match | same history; later moves use the new engine | Nothing is removed; the change is noted as a PGN comment on the current position |
| All switches off/unmount | dispose evaluator session | No new searches and no late UI writes; bots continue |
| Evaluator failure | visible error + Retry | Only evaluator restarts; game/proposal/running state preserved |

### Journeys and states (M6)

Normal: set switches → start → Next/Auto-play/nudge/drag → score/grade → optionally
inspect a historical move's explanation. Enable annotations later to backfill.
Fast auto-play may outrun analysis; pending moves remain explicitly pending and
completed evaluations must not be discarded every time another move arrives.
Pause stops auto-play while analysis can finish. Takeback and alternate moves
project the new branch. Restart and new match remove previous game summaries; changing players keeps them.
Checkmate and every draw use chess.js' terminal result, including repetition from
the full game, rather than searching a finished position. Disabling and retrying
must prevent old engine callbacks from modifying the visible evaluator state.

### UX and layout (M7)

Use an always-visible Analysis options card alongside the existing arena cards.
Keep independent named switches, short explanations and a compact progress row.
Move-list annotations have text and icons rather than relying on color. Clicking
an annotated history entry selects its explanation without changing the live
board or the bots' game. Opening Visualize pauses auto-play so the context stays
usable. Preserve the existing board flip, colors, candidate hover and manual
arrows. At narrow widths the panel stacks below the board and labels wrap.

Observed internal examples: /arena has proposal/candidate actions, /analysis
groups board playback separately from analysis detail, /play offers optional
coach feedback. Transfer their shared classification/icons/Visualize and MUI
controls. Do not transplant the human-only coach queue: Arena needs both sides
and every move. A rival full analysis workspace would displace the arena's live
controls and duplicate existing Analysis navigation; the compact optional card
fits the requested side toggles. No distinctive visual redesign was requested.

### Feature specifications (M8)

The bar and annotations work independently. The arrow can independently request
before/after evaluation. With annotations off, remove grades and colored move
highlights while retaining ordinary last-move highlighting. With the bar off,
remove its width. With all three off, release the extra engine. Pending data is
shown as unknown, not as the previous position's score. Complete classifications
must use the shared rules (opening, forced, brilliant/great, best, loss bands).
Visualize consumes the existing story/dialog contract. Game saving and the
post-match Analyze action retain the original Chess game and headers.

### Implementation and risk (M9)

New pure analysis session module owns serialized searches, latest-game priority,
cached raw results, terminal scores and history projection. New hook owns engine
lifecycle. New analysis card owns toggles/status/explanations. Arena useArena
publishes only analysis-owned board data; proposal remains owned by bot choice.
MovesList gets optional annotation/selection presentation without changing its
other consumers. Reuse existing classifier, story, board and icons. Central
risks: cancellation/branch identity, engine contention, misleading stale scores,
terminal outcomes, keyboard/narrow fit and background search cost. Test these
independently; tests with a fake evaluator prove scheduling, not WASM execution.

### Verification and delivery (M10)

Use the fresh in-app browser's localhost session (separate from the user's normal
browser) and synthetic matches/FENs; no saved games are modified. Existing dev
server listens on port 3000. Browser checks operate the real UI and real WASM
engine. Unit tests discriminate stale completion, backfill, branch replacement,
terminal scoring, independent options and failures. Lint/typecheck and production
build cover integration. Actual screenshot inspection covers fit/visible badges;
fake evaluator tests cannot close those claims.

## Live tasks

Every task below uses its model section above as the why/target/rival/expected
result. Prerequisites and evidence are explicit. A result remains pending until
the named source or observation supports it. Corrections update the model owner
before unlocking dependent work.

- [x] E1 Inspect request, clean checkout, launcher, state owners and baseline tests.
  Evidence: src/pages/arena.tsx, sections/arena, useEngine, board; 297/297 baseline,
  npm run lint exit 0. Next E2.
- [x] E2 Observe arena, analysis and play in isolated browser; settle integrated
  optional-card direction. Evidence: browser AX states from these three routes;
  Reckless bridge unavailable in this profile, so use two browser engines in QA.
  Prerequisite E1. Next models/reviews.
- [x] M1 Intent and constraints documented above; prerequisite E2.
- [x] M2 Domain and data checked against Chess, PositionEval and parseResults; prerequisite M1.
- [x] M3 Feature inventory includes toggles, backlog and retry; prerequisite M2.
- [x] M4 Directed network includes bots, board, history, explanation and return; prerequisite M3.
- [x] M5 Mechanisms identify independent engine and FEN projection; prerequisite M4.
- [x] M6 Journeys name fast-play, branches, terminals and cancellation; prerequisite M5.
- [x] M7 UX uses observed existing patterns and rival comparison; prerequisite M6.
- [x] M8 Specs separate visibility from computation and game state; prerequisite M7.
- [x] M9 Risks and responsibility boundaries documented; prerequisite M8.
- [x] M10 Proof methods and isolation documented; prerequisite M9.
- [x] D1 Outward/individual model review, three general reviews, UX/logic reviews
  and selected timing, score integrity, accessibility/performance risk reviews.
  Target each M1–M10 separately; evidence in Design review below. Prerequisite M10.
- [x] G1 Close design gate after D1; each accepted edge has implementation/proof.
- [x] B1 Implement raw evaluator session and history projection; prerequisite G1.
- [x] B2 Connect hook/atoms/board, including independent switches; prerequisite B1.
- [x] B3 Connect history annotations and Visualize summaries; prerequisite B2.
- [x] T1 Score/classification: both colors, openings, bad move, custom black FEN,
  promotion, checkmate, draws/repetition; prerequisite B1; tests/arenaAnalysis.test.ts.
- [x] T2 Timing: fast updates, latest-first/backfill, takeback/branch/reset,
  disable/dispose, failure/retry; prerequisite B1; tests/arenaAnalysis.test.ts.
- [x] R1 First runtime sweep: discover gaps in normal toggle/step/nudge/manual,
  annotations/list/story, flip and pending/terminal behavior; prerequisites B3,T1,T2.
- [x] R2 Second runtime sweep: attack composed autoplay/pause/takeback/restart,
  toggle-during-search, branch/history, engine changes, retry; prerequisite R1.
- [x] R3 Third runtime sweep: final connected journey, narrow/keyboard fit,
  persistence, shared Analysis/Play regression and delivered launch; prerequisite R2.
- [x] C1 Final tests/lint/build, reconcile README and this evidence; prerequisite R3.

## Design review

Acquired 2026-10-21 before implementation. Outward: retain the arena's live game
as primary task; a second independent evaluation route is essential because
evaluatePositionWithUpdate stops all jobs on its instance (uciEngine.ts:393).
The rival reuse of a playing engine would interrupt its proposal search.

Individual keen-eye findings: M1 preserves independent optionality; M2 full FEN
and current history own identity; M3 includes backfill/retry; M4 has the next
consumer for every switch; M5 requires a serialized session; M6 preserves
analysis across normal move arrivals but disposes across engine lifetime; M7
must distinguish selected historical explanation from live board position; M8
must show unknown rather than sticky bar values; M9 changes only optional
MovesList props and an opt-in pending-bar behavior; M10 separates fake scheduling
proof from real WASM/browser observations. These corrections are incorporated.

General review 1 (missing routes): each M1, M2, M3, M4, M5, M6, M7, M8, M9 and
M10 rechecked. Enabling after a game started needs historical backfill, and
threefold draws require the full Chess instance. Added both, keeping the card
direction because it preserves controls and includes all actual move paths.
General review 2 (consequences): each model rechecked again. A backlog must not
hold the current bar hostage; choose the latest position first, then missing
historical positions. Normal advances must not cancel all searches. Optional
annotation rendering must not change Play's MovesList interaction contract.
General review 3 (apparent completeness): each model rechecked again. Restart
can reuse a FEN but cannot resurrect the previous selected explanation; project
only entries from the current history. Error retry replaces the evaluator, not
the game. No adoption of a separate export/database workflow: the existing
post-match Analyze action already owns that journey and receives unchanged PGN.

UX review 1: named switches in a permanent card satisfy discoverability before
start and after results; historical selection stays in Moves. UX review 2:
Visualize pauses auto-play, returns to the same match, and labels pending grades.
UX review 3: wrapping labels and independent bar width must be observed in the
stacked layout; no unrelated visual transformation or new platform surface.
Logic review 1: one independent engine/session and raw cache are owners; shared
classification is derived. Logic review 2: terminal synthetic scores bypass UCI,
failure is visible, session disposal suppresses late callbacks. Logic review 3:
replace latest target while one search runs, then select from the new history;
never publish a captured obsolete game projection.

Timing risk reviews 1/2: latest-first queue and disposal need deferred-promise
tests with changed update order. Score-integrity reviews 1/2: White perspective
is normalized by parseResults, raw results must have a score, and terminal mate
uses the existing signed sentinel compatible with win-percentage helpers.
Accessibility/performance reviews 1/2: use labeled MUI switches, text grade plus
icon, keyboard-selectable history and one worker only while requested. Real
narrow/keyboard behavior remains runtime work, not a design-pass claim.

Returned whole judgment: models M1–M10 and every named edge have a feasible
mechanism and a separate proof route. G1 is closed; implementation can begin.

## Runtime evidence

2026-10-21, R1. Outward question: does the assembled arena actually explain both
players' moves without borrowing the proposal score? Rival: only proposal lines
or fake-test behavior appears. Details: real Stockfish 18 Lite players plus a
third analysis worker; step produced Nf3/e6 opening grades, scores and icons.
Manual f3, e5, g4 produced a blunder badge, -M1, 3/3 graded moves and the expected
e4 alternative arrow alongside Black's Qh4 proposal. Visualize g4 displayed the
actual Qh4# continuation and better e4 branch; return preserved the live match.
Next played Qh4#: Black wins/0-1, 4/4 grades, terminal score and no stale proposal.

R1 implementation/model detail: separate engine source is now tagged in the hook
so top-bar engine changes cannot temporarily publish the preceding engine's
cache. Historical identities include ply, before FEN and full promotion UCI.
R1 logic/timing detail: 13 new deferred/fixture tests pass, including concurrent
target changes, branch replacement, disposal and repetition-vs-FEN identity.
All 310 tests pass; lint/typecheck also pass after the integrated slice.
R1 UX/craft detail: the desktop viewport render shows separate board and card,
blunder badge, eval bar, optional switches and candidate actions; narrow baseline
stacks them. A full-page capture temporarily changes viewport-derived geometry
and produced misleading overlap, so it was rejected. Actual DOM measurements
(board right 913.5, panel left 946) and a normal viewport screenshot confirm the
32px gap. Screenshot: external artifact arena-analysis-desktop.png in this chat's
visualizations directory, not committed into the source tree.
R1 correction: shared weak-move stories described tiny score changes on opening
moves as losses. Arena now uses describeMove's factual summary for good/book
moves while retaining their playable lines; genuine errors retain the loss
explanation. Returned judgment: the main connected feature works; composed
timing, repeated controls, error recovery and persistence remain R2/R3 work.

2026-10-21, R2. Outward question: do optional analysis and live play remain
independent under composed transitions? Rival: disabling one display stops bots,
or changing engine leaves old grades. Details: took back Qh4# to g4, nudged Black
to h5, observed h5 graded as a blunder for missing mate. Fast auto-play advanced
the game; switched all three options off while it ran. The bar, grades and badge
disappeared while both bots continued. Paused and enabled annotations alone:
the bar stayed absent, all 20 existing plies backfilled, and current score did
not masquerade as a completed classification while its predecessor was pending.

R2 source/timing examination: changed the evaluator from SF18 Lite to SF11 in
the top-bar menu. The game and both SF18 Lite players were preserved; old grades
became Pending until SF11 recomputed them. Selected g4 from history, flipped the
board, restarted auto-play and opened Visualize g4: auto-play paused, the dialog
retained the historical g4/Qh4# story while the live game had advanced, and
closing preserved the selected explanation. The 21-ply move list completed.
R2 failure lens: real Reckless is explicitly unavailable/disabled in the engine
menu in this isolated profile; do not bypass that UI to simulate an outage.
Deferred-evaluator tests cover failure/empty response, truthful error and a fresh
session's successful recovery; this is scheduling proof rather than an observed
WebSocket outage/retry journey. Error UI consumes that state plus useEngineState.
Returned judgment: active game, annotations, source changes and optionality stay
coherent; final persistence, narrow keyboard and custom-position journeys remain.

R3 discovery/correction: after Next, its interactive tooltip overlapped Change
players and received the subsequent pointer clicks. This was reproduced twice;
DOM elementFromPoint at Change players' center identified the tooltip, rather
than a disabled button or callback error. Both arena control tooltips now use
disableInteractive so they cannot intercept adjacent controls. Reopen the R1/R2
control-return observations for a fresh Next → Change players test. The engine
scheduler and its unit evidence are unaffected by this pointer-only correction.

2026-10-21, R3 returned examinations. The corrected Next → Change players path
was operated successfully at desktop and narrow widths. Custom Black-to-move
FEN at move 42 produced a black 42… Kd7 row and the correct selected explanation.
A stalemate FEN immediately showed Draw/1/2-1/2 and 0.0; its empty move-list
message now explains that the starting position is already over. Reloading
preserved the independent switch values. Space on a focused evaluation/arrow
switch changed it successfully. At 390×844, labels/help and switches wrap and
remain reachable; the new panel and board fit. DOM inspection isolates an
existing 8px horizontal header overflow to the global theme button, outside the
arena additions; it is not evidence of an analysis-card fit failure.

R3 regression details: Play started a casual fixture, accepted e4, rendered its
ordinary unannotated MovesList, and invoked its existing coach. Analysis accepted
e4, showed its evaluation bar and opening label; the opt-in arena pending-bar
behavior did not change these defaults. Returned to Arena and restored the
lightweight evaluator after testing SF11. No saved-game/database writes were
performed; synthetic games used only the in-app browser's transient state.
Viewport override was reset. The unavailable Reckless bridge remains an external
runtime dependency; browser-engine arena behavior was observed with real WASM.

Final source/network review: all three stored switches have consumers, raw
scores remain independent from playing strength, every current-history move
has a backfill route, selection preserves the live board, and disabling all
analysis disposes its engine without changing player state. Raw projection,
timing/error and terminal contracts have the 13 new unit checks; real rendering
and actions have the observations above. Final npm run lint and npm run build
exit 0 after the tooltip/empty-state changes. npm test: 310 passed, 0 failed.
Build emits existing non-blocking Sentry auth-token warnings; no release/source
map upload is configured. README usage matches the implemented controls.
The accepted feature scope is complete. The user also requested commit/push to
the existing branch; repository history and remote tracking provide that
delivery evidence after this pre-commit feature record.

## Follow-up: shared options, Analysis parity and live card details

Problem: the Analysis page always showed its evaluation bar, and its best-move
arrow and quality-icon switches sat in Settings under the Engine tab, so the
page lacked the card the arena has. The arena card showed no accuracy, opening
name or text naming the better move, though the Analysis page offers all three.

Logic: one definition serves both modes. `createAnalysisOptionAtoms` in
src/lib/analysisOptions.ts builds the three stored switches from per-mode keys
and defaults. src/components/analysisOptions/analysisOptionsPanel.tsx renders
them with per-mode copy; a detail row appears only while its switch is on.
Storage stays separate: the arena keeps its arena-* keys, and Analysis keeps
show-arrow-best-move and show-icon-player-move so saved choices survive, with
show-evaluation-bar added. Defaults: Analysis is all on, which matches its old
behavior. The arena is evaluation on, annotations off, best-move on. Best-move
default changed from off to on, as requested; existing saved choices are kept.

One rule decides when a better alternative exists: `getBestMoveHint` in
src/lib/bestMoveHint.ts. The board arrow and the arena text both use it. It
hides an alternative equal to the played move, and grades that already mean
best, book, forced or perfect (the board's existing rule; the played-move check
is new to the board and only matters when no grade exists).

Analysis page: the card sits in the Analysis tab
(src/sections/analysis/panelBody/analysisTab/analysisOptionsCard.tsx). The
evaluation switch only hides the bar; the analysis engine keeps running. The
annotations switch controls the board's quality icon, not the Moves or Graph
grades, which remain core analysis. The arrow and icon switches were removed
from Settings to avoid two controls for one setting.

Arena additions, each derived from data the card already computes:
- Accuracy per side, shown with annotations on. `getArenaAccuracy` uses the
  Analysis accuracy function over every position from the start to the current
  move. Any pending position shows a dash, never a partial score.
- Opening name, the most recent book position in the current history
  (`getArenaOpening`). The classifier's opening label only sees a three-position
  window, so it cannot name an opening reached many moves earlier.
- "Better alternative" text under the best-move switch, using the same rule as
  the arrow.

Not added: engine lines (the arena's proposal list already shows the mover's
candidates, and a second engine's lines would conflict with it), an Elo
estimate, an evaluation graph and board history navigation. The design keeps the
live board separate from selected history.

Evidence: npm test 383 passed, 0 failed (367 baseline plus 16 new in
tests/arenaInsights.test.ts, tests/bestMoveHint.test.ts and
tests/analysisOptions.test.ts). npm run lint and npm run build exit 0. Static
build checked in the browser: analysis options default, toggle and persist;
the best-move arrow draws with the switch on and disappears with it off;
Settings no longer lists the moved switches; arena defaults hold; accuracy
reaches numbers (91.3 % and 99.8 % in the final run) and the opening name and
better-alternative line appear; no page errors.
