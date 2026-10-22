# Analysis Remember and correctness review

Active work, 2026-10-22. No commit or push is authorized.

## Contract and connected model

Remember records subsequent legal Analysis moves into the existing local session,
including invented games and alternatives. Default remains off, using the existing
`analysis-store-branches` preference so prior choices survive. Off stops recording;
it never deletes, hides, switches, or exports away remembered lines. Existing
source games, sessions, editor, backup/restore, clear/undo, analysis, graph, move
list, engine lines, hints, autoplay and Arena live play remain available.

The session owns full replay lines and their cursor. The board owns the currently
displayed legal path. A replay target must include its root FEN and exact UCI path,
including promotion; SAN text or move count alone cannot identify it. Navigation
reads current state when invoked. Arena retains its live game separately from
historical explanations; its post-game Analyze action enters the same Analysis
session flow. No additional Arena replay mode is assumed by that existing UI.

Rival: add another independent undo stack. Rejected because it would leave graph,
move list, full analysis, saved branches and backup using conflicting histories.
Reuse and repair the existing session owner instead. New/cloud synchronization is
outside this browser-local feature; backup remains the portability mechanism.

## Live plan and execution bindings

Every item below matters to the requested Remember feature or full Analysis audit.
Prerequisites are explicit. Targets are actual source/docs/tests; competing premise
is that a symptom is local instead of shared. Perform the named action, record the
actual result here, correct the owner, and unlock the next dependent item only on
the stated evidence. Source checks establish reach; automated tests establish
state transitions; browser operations establish actual controls and rendering.
Runtime uses synthetic games in a separate localhost browser profile and no live
game database. Logs/captures are external task artifacts.

- [x] I1 Read current protocol, user request, clean Git status, package commands,
  analysis-preservation.md and arena-analysis.md. No AGENTS.md found in ancestry
  or source/test/docs tree. Unlock I2/I3.
- [x] I2 Trace normal Analysis session, board writes, next/final/start/previous,
  autoplay, graph/list/classification jumps, source loads, evaluation lifecycle,
  persistence, editor, backup and option consumers. Close on named causes/cases.
- [x] I3 Trace Arena game/proposals/evaluator, historical selection, stories,
  takeback/reset/player changes/results and Analyze handoff. Close on causes/cases.
- [x] D1 Review intent/data/scope/network/mechanisms/journeys/UX/specification/
  ownership/proof individually against existing owning docs and source (I2/I3).
- [x] D2 General review: missing routes; then consequences; then apparent
  completeness, each with outward/detail/return findings (D1).
- [x] D3 UX reviews: discoverability; composed navigation/option changes;
  narrow/keyboard. Logic reviews: ownership; failure; changed event order (D2).
- [x] D4 Risk reviews, first and second each: history fidelity, asynchronous
  evaluation/source identity, data preservation, shared-consumer regressions (D3).
- [x] G1 Close design gate with named consumers, cases and feasible proof (D4).
- [x] B1 Implement recording-only Remember and nondestructive stored-line access,
  export and replay (G1). Close on connected tests and source.
- [x] B2 Repair shared history/action/evaluation causes in both modes (G1).
- [x] T1 Regression cases: fresh invented line; back/forward/start/end/autoplay;
  alternatives and nested paths; off/on; reload; backup; clear/undo (B1).
- [x] T2 Identity/action cases: different roots with same SAN, promotion, Black
  roots/counters, rapid input, comments/headers, graph/list and source changes (B2).
- [x] T3 Arena evaluator/selection/takeback/reset/terminal/story audit cases (B2).
- [x] R1 Browser sweep: normal Remember, invented line, branch, toggle off and
  replay; Arena manual/takeback/history/story; inspect rendering (T1/T2/T3).
- [x] V1 Review and repair shared Visualize replay lifetime/identity and rapid
  relative steps (I2/I3); inspect moveStoryDialog.tsx, MiniBoard, moveStoryState,
  buildMoveStory and existing moveStory tests. Rival: board controls alone cause
  the history symptom. Close on independent story branch/start/end/reopen and
  normal/Arena return observations; keep the existing cascade/expand/play features.
- [x] N1 Repair shared header fit (R3): actual Arena at 390px has 398px content
  width and clips the theme action. Rival: board width causes overflow. DOM/source
  identify nonshrinking title flex group; allow title elision with full title text
  available, preserve every action. Close on 390px/320px and normal-width renders
  and actual theme/settings operation in both Analysis/Arena.
- [x] R2 Browser sweep: changed order, reload, backup, sources, engine changes,
  evaluation during navigation, repeat controls; inspect failure/return (R1).
- [x] R3 Browser sweep: final keyboard/narrow fit, preserved editor/Play/Arena,
  connected source audit and documentation reconciliation (R2).
- [x] C1 Run final npm test, npm run lint, npm run build, inspect diff/status,
  report each finding/cause/fix and evidence limits, leave uncommitted (R3).

## Findings and review evidence

I2/I3 source inventory completed: sessionAtoms/captureAnalysisBoard own recording;
toolbar next/final compare SAN independently; generic useChessActions closes over
render-time Chess objects; graph/list/recap call goToMove; current-position live
analysis skips terminal positions and catches failures only in console. Arena
uses its own game plus FEN-cached raw evaluator and path-selected explanations.
Its selection key includes only index/before-FEN/last-UCI, allowing transposed
histories to share identity. No Arena board replay buttons exist; its Take back is
a live-game mutation and Next accepts a fresh engine proposal. Analysis handoff
uses the shared source/session loader.

Baseline: npm test passes 391/391. Separate static server on 127.0.0.1:3011
(session 24963) uses existing out; existing dev server PID 22508 is left alone.
Browser tab 2 has synthetic e4 e5 and e4 c5. Actual disabling selected branch
returned board to root and move list to e4 e5, reproducing the complaint.

Design inspections (2026-10-22, before product edits):
- D1 intent: preserve recording and replay independently. Data: existing complete
  PGN lines retain root/counters/comments/evaluation. Inventory: keep every
  existing control. Network: toggle -> recording gate, selection -> every replay
  consumer, backup -> all stored lines. Mechanisms: single session owner plus
  shared exact-path helper, event-time actions. Journeys: toggling never restores
  or deletes; explicit clear/undo remains. UX: visible Remember beside session,
  existing options dialog shares it, line selector stays accessible off. Specs:
  off never appends even mainline, navigation can still save cursor. Ownership:
  use existing preference key. Proof: Jotai/pure tests plus static-browser journeys.
- D2 first outward/detail/return: rival local button patch misses export/restore
  loss; include full backup regardless toggle. Second: replay must not record a
  navigation step as a new branch, and common prefixes retain selected line.
  Third: root and promotion are part of identity, including Arena explanations.
- D3 UX first: direct toggle avoids a hidden primary capability. Second: same
  toggle in options uses same atom; off keeps selection. Third: wrapping labels
  and existing selector support keyboard/narrow rendering. Logic first: source
  line and cursor are separate owners. Second: rejected illegal moves publish
  nothing; live errors need visible retry. Third: event-time reads prevent rapid
  actions overwriting a newer path; full-analysis callbacks need request identity.
- D4 history fidelity first/second: SAN is display, root/UCI is identity; enforce
  through next/end and selected Arena keys. Async first/second: current effects
  already reject stale completions; full-game progress/error/finally must additionally
  match request ID, and terminal score must be derived from full history. Data
  first/second: off must retain stored evaluations/lines/cursor through restore and
  backup; comments on unchanged paths must not disappear. Shared regression
  first/second: event-time chess actions serve Play/Arena too; test sequential
  actions plus legal replay/metadata and existing suites, preserve live Arena role.
- G1 closed: no unresolved user-owned design choice; no visual redesign; all named
  consumers have code ownership and automated/browser proof routes. Implement B1/B2.

Existing documentation records prior behavior, not current runtime proof. The new
off contract supersedes its prior hide/switch/export policy; other features stay.

V1 pre-edit finding/review: StoryBody's key used only FEN + played SAN, although
engine continuations can change. A new shorter story could reuse an out-of-range
old cursor. Closing left the replay/timer/keyboard listener mounted through the
dialog transition. Relative keys/buttons used rendered step rather than functional
updates. Correct identity at the story owner, mount only while open, and use bounded
functional relative steps. This preserves both alternatives, cascade expansion,
autoplay, absolute jumps and the unchanged live board. Browser story checks are
separate from session replay; earlier session proof remains valid.

## Bug register

All entries below are fixed in the working tree. "Source" identifies a causal
code path; it does not claim the scenario was reproduced in a real browser.

| ID | Bug and cause | Correction and evidence |
|---|---|---|
| F1 | Off reset the selected branch to main/root, hid saved lines, and still recorded mainline extensions. Recording policy also owned selection. | Recording-only Remember, default off, compatible preference key; session tests plus actual on/off/replay/reload. |
| F2 | Off-mode backup/export and restore explicitly filtered out stored branches. | Always archive/restore complete session. Actual downloaded JSON includes main `a3 h6 b3 g6`, branch `a3 h6 b3 g5`, cursor 4, selected branch; restored with Remember off to a fresh ID. |
| F3 | Next/final compared SAN and count, omitting root FEN and exact UCI; final was also disabled for an empty saved root while on a different transient path. | Shared root/UCI replay state and event-time navigation. Different-root/same-SAN, Black roots/counters/underpromotion, start/previous/next/end tests; actual invented-game replay/autoplay. |
| F4 | Generic chess actions copied the render-time board. Rapid moves/undos could overwrite newer history; legal stale candidates could apply to another position. | Read current atom at invocation; source-dependent board/PV/top-move/Arena proposal actions verify the expected full path. Hook callbacks tested without a render between actions; stale candidates rejected. Board navigation also clears stale square/promotion selection. |
| F5 | Engine-line playback threw on illegal/stale continuation with no UI handling. | Validate on a private copy, reject atomically with existing illegal-move feedback; invalid continuation regression and later valid continuation. |
| F6 | Same-path comment writes were treated only as cursor changes and discarded; game publication compared only moves. | Merge changed comments into complete stored line, preserve future comments/headers/moves, publish changed PGN. Exact comment/preservation regression. |
| F7 | Transient board, move list, Copy PGN and Download PGN used inconsistent source choices. | Shared displayed path uses remembered complete line for replay, current exploration when divergent. Stored grades never annotate a different transient path. Store tests and an actual transient PGN download prove path selection; a browser clipboard read returned empty and is not counted as clipboard proof. |
| F8 | Normal live analysis skipped checkmate/stalemate and searched other draws; zero-move finished roots lacked terminal text and draws still showed engine-line placeholders. | Shared full-history terminal evaluation in both modes, including repetition; terminal text and no impossible continuation list. Unit tests and actual mate/stalemate/custom-root browser checks. |
| F9 | Evaluation parameters dereferenced the last move for empty histories. | Zero-move roots produce one FEN and no UCI moves; direct regression. |
| F10 | Full-analysis progress/error/finally guards lacked request identity; same-session old work could alter a newer search, and engine replacement was not a cancellation boundary. | Guard every publication by request/session/path/engine; cancel on engine instance or target change; don't start competing live searches during full evaluation. Actual depth-30 search observed in progress, switched SF18 Lite to SF11: old progress cleared, source retained, no stale error. Restored SF18 Lite/depth 14. |
| F11 | Live-position errors appeared only in console; empty results could enter cache and classification. | Reject empty current results, show visible error and Retry analysis. Final browser review also exposed an expected engine-shutdown empty response logged as an error during cross-tab engine changes; suppress canceled/disposed engine results before classification/error publication. Source review, engine failure tests and engine-replacement browser checks; no artificial transport outage claimed. |
| F12 | Arena selection key used only ply, before-FEN and last-UCI, colliding after transposed paths. | Complete root/UCI prefix keys; transposition regression with identical final FEN, plus actual takeback/alternate `h5` projection and retained valid `g4` explanation. |
| F13 | Visualize keyed only by FEN/SAN, retained playback/listeners during closing, and stepped from render-time values. | Full-story identity, unmount while closed, bounded functional relative steps. Actual played/better/start/end/expand/reopen and keyboard checks from Arena and normal Analysis. |
| F14 | A whitespace-only session title passed UI saving but failed session validation on reopen. | UI falls back to a valid session name; validation contract/source review. |
| F15 | Arena's unshrinkable shared header title pushed actions beyond a 390px viewport (actual width 398px). | Shrink/elide title with complete title available; preserve all controls. Final responsive proof recorded below. |
| F16 | Full-game evaluation discarded history when reducing a game to FENs, so repetition and other terminal draws could be reevaluated as non-draws. | Carry the known terminal result through EvaluateGameParams into the UCI scheduler. Fake-worker regression proves no terminal search; actual repetition PGN analysis and downloaded raw backup confirm the final cp is zero. |

## Runtime reviews and evidence

R1 outward question: can an invented line actually be recorded and replayed, or
are only imported games supported? Details: actual `a3 h6 b3 g6`, two Previous
presses, final, branch `g5`, on/off without a position change, and restored branch
access while off all worked. The unrecorded `c4` disappeared after Previous/reload
without altering either saved line. Main/branch controls and narrow toolbar were
inspected. Return: recording policy and replay ownership agree in the assembled UI.

R2 outward question: do preservation and concurrent operations compose? Details:
downloaded/read complete JSON with Remember off, restored a fresh session keeping
the selected branch, replayed it with autoplay, Clear/Undo retained the main and
restored the branch. Full analysis of Arena's synthetic Fool's Mate produced
accuracy, graph and grades; selected g4 Visualize, switched to better e4, expanded,
returned and reopened from its start. Actual depth-30 search was canceled by an
engine replacement; source/history and previous completed analysis stayed intact.
Return: backups, replay, analysis lifetime and story lifetime remain separate.

R3 observations: final code used real WASM SF18 Lite in both Arena player slots
and an independent evaluator. Manual Fool's Mate yielded 4/4 grades and Black
wins. Takeback + h5 replaced Qh4# and kept the valid selected g4 explanation.
Next and autoplay worked; with all analysis switches off, live history advanced
from 5 to 21 plies before pause. The final shared Visualize replay was exercised
in both modes; keyboard arrows moved the story to Qh4# while the underlying game
stayed at g4. Arena Analyze game loaded the exact source into normal Analysis.
Editor handoff carried the mate FEN, typed custom Black root at move 42 replayed
Kd7 with 42 numbering, and a zero-move stalemate settled at 0.0 with Game is over.
Remember was keyboard-toggled at 390px. The header overflow observation reopened
R3 and N1; final fit proof remains pending. Browser console has only the expected
unavailable Reckless bridge startup error from baseline selection; real Reckless
transport was not exercised. SF18 Lite/depth 14 were restored after the stress test.

Observation validity: fresh snapshots and exact controls guided interactions.
Several immediate clicks after menu transitions needed a fresh snapshot/retry;
pressing a nonfocusable dialog container was rejected by the driver, so keyboard
proof used its actual focusable Close button. An immediate score visibility read
preceded the effect; a proper visible-state wait confirmed the terminal score.
These failed observations were not counted as product failures or passing proof.

R3/N1 final return (2026-10-22): actual Arena at 390px has 375px document/client
width (15px scrollbar), and settled 320px has 305px document/client width; no
overflowing element. Analysis at 320px also has matching 305px widths. Theme and
Settings were operated through the formerly clipped controls. Full title remains
available as title text while it elides. The immediate post-resize width was stale;
the settled DOM and screenshot supported the fit judgment. Viewport reset.

Final source/network review: Remember is one existing stored preference, all
recording paths pass through the session board owner, source loads and stored-line
selection are independent, session backups preserve all lines, and every replay
consumer uses the correct full or transient path. Generic actions are tested from
unchanged hook closures and guarded at source-dependent callers in Board, engine
lines, top moves and Arena. Shared Visualize, terminal scoring and header ownership
now cover both Analysis surfaces. Legacy unused MovesLine/MoveItem components were
inspected; the active MovesPanel uses shared MovesList. No feature was removed.

Final terminal fidelity check: imported actual repetition PGN `Nf3 Nf6 Ng1 Ng8`
twice through the real import worker, ran full analysis, went to final position,
and saw 0.0/Game is over. The downloaded session backup contains 9 raw evaluation
positions and final cp 0. A first attempt used an older loaded page while out was
being rebuilt, yielding a removed-worker-chunk import error; reload of the finished
build and repeat import passed. That deployment/capture condition was not counted
as a code defect. Transient PGN download contains `a3 h6 b3 g5 c4` while saved line
stays `a3 h6 b3 g5`. Play launched a casual fixture, accepted e4 and invoked its
existing coach. Screenshot: external visualization artifact analysis-remember.png
shows Remember off with Branch 1 still selected and available.

C1 final gates: npm test **402 passed, 0 failed**, up from 391 baseline; npm run
lint **exit 0**, no warnings (ESLint and TypeScript); npm run build **exit 0**, all
15 static pages exported. Existing Sentry warnings only: release/source-map upload
credentials are absent. Logs: `.performance/analysis-remember-tests.log`,
`analysis-remember-lint.log`, `analysis-remember-build.log`. `git diff --check`
passes. All code, tests and docs are uncommitted; no commit/push was performed.
Local browser proof uses synthetic data and real browser Stockfish; it does not
claim production deployment, real Reckless transport, or native clipboard success.
All identified source defects above are fixed; external Reckless availability is
not a repository defect. The owned static QA server is stopped after verification;
the pre-existing development server was not stopped or reconfigured.
