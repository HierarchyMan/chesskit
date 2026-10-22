# Analysis preservation — current plan and evidence

Initial work 2026-10-21; current Remember policy updated 2026-10-22. User reports lost analysis work/branches and arranged positions that
do not become the analyzed board, and authorizes adjacent fixes in this category.
Current contract: **Remember** explicitly enables recording and is off by default.
Turning it off only stops new recording, including mainline appends; stored lines,
selected board/cursor, replay and complete backups stay available. This supersedes
the original hide/switch/export policy described in historical evidence below.
See analysis-remember-review.md for the current audit and proof.

## Intended behavior and models

1. **Intent.** Durable, reopenable analysis sessions retain the loaded game,
   replay position and analysis. Existing interactive exploration stays usable.
   New moves and alternatives are opt-in; disabling only stops recording,
   without implicitly deleting prior saved work. Clear is a separate action.
2. **Data.** Keep existing `games` records and IDs intact. Add an IndexedDB store
   for analysis sessions, each with original/main PGN, optional recorded lines,
   selected line/cursor, title, timestamps, matching evaluation and editor draft.
   A branch contains its complete legal path from the same root (including FEN,
   side, counters, promotion and comments). Original database games are separate.
3. **Scope.** Autosave sessions, save status/retry, library/reopen, rename/new,
   branch option/list/clear, replay with existing navigation, session backup and
   validated restore, correct arranged-position commit and destination handoffs.
   Fix stale URL/evaluation races, unsavable zero-move positions, and ID-based
   database copy. Do not invent branches from bot play or rewrite source games.
4. **Network.** Every analysis board write → active session capture → serialized
   IndexedDB commit → status/library. Board exploration off the mainline while
   storage is off remains transient and is never included in the autosave.
   Enable Remember → subsequent analysis moves are captured; choose a saved line →
   existing previous/next/start/end/autoplay replay it; clear → stored alternatives
   removed, main game retained. Off → same board and saved-line access. Complete
   backups preserve every stored line regardless of the toggle. New/load/arrange
   → new session preserves the old.
5. **Mechanisms.** Analysis-only writable board atom captures actual legal paths;
   other boards are unchanged. Shared database open promise migrates additively.
   A single mounted persistence controller hydrates before saving, serializes
   writes and flushes transitions. Source loads and engine completions use stable
   request/session identities. Targeted handoffs cannot be consumed by the sender.
6. **Journeys/states.** Fresh analysis; reload; navigate away/back; named reopen;
   imported saved game; ordinary append; alternative move off/on; nested branches;
   clear; turn off/on; custom root with zero moves; draft arrange/reload/commit;
   same FEN explicitly requested after exploring; stale source URL; late engine
   result; failed/quota storage and Retry; download/restore malformed backup.
7. **UX.** A compact session strip outside arrange/play panels owns name, saved
   status, library/backup and options. Remember is directly visible in Play moves.
   Saved branch controls remain available while recording is off.
   Existing board/navigation remain the replay controls. Storage failure stays
   visible with pending work and Retry. Explain browser-local storage and backup.
8. **Specification.** Remember defaults false and retains the existing validated
   stored preference. Off preserves selection and replay, and does not record new
   moves. Transient explorations remain visible/copyable. Sessions preserve the main
   game. Clear cannot remove the main game. Editor analysis commits the effective
   FEN draft, not an earlier React state or URL game. Restore validates before any
   write and imports as a new session, never overwriting a colliding record.
9. **Ownership/risk.** New pure session model, additive DB module, analysis state
   actions, persistence hook and session UI. Existing loader, toolbar, graph,
   evaluation, editor and generic handoffs consume these owners. Selected risks:
   preservation/fidelity, async source identity, disabled-option enforcement,
   failure/recovery, keyboard/narrow layout and shared-consumer regressions.
10. **Proof.** Pure and Jotai-store tests for persisted/off behavior and exact
    replay; database tests where feasible; real browser save/reload/library,
    branch-off/on/clear and editor handoff on a separate in-app browser profile.
    Export/restore comparisons prove archival fidelity; visual captures prove
    controls/fit, not durability. Lint/types/build and existing tests remain gates.

## Historical investigation and design review (2026-10-21)

- [x] I1 Clean branch `expansion/hub-and-modes`; inspect actual state/database/
  loader/editor/toolbar/evaluation consumers before selecting the mechanism.
  Evidence: `useGameDatabase`, `useLoadAnalysisGame`, `useArrangeMode`, SaveButton,
  `useChessActions`, `useCurrentPosition`, handoff callers and classification UI.
- [x] I2 Clarifications incorporated above. Rival "implement branching" rejected:
  actual board already explores alternatives; persistence is the missing edge.
- [x] D1 Outward and individual models 1–10 reviewed against actual consumers.
  IndexedDB sessions keep preservation independent of optional alternatives.
  Rival overwriting source PGN loses the source and conflicts with off semantics.
- [x] D2 First general return: Save is disabled once a URL game exists and for
  zero-move FENs. Include explicit session save and automatic durable sessions.
  Existing games survive migration; session library provides the return path.
- [x] D3 Second general return: a generic autosaved board would secretly store
  branches while off. Persist only mainline-prefix cursor/off data; recording is
  gated in the shared analysis write owner, not just by hiding a dropdown.
- [x] D4 Third general return: copying/exporting original `gameAtom` alone loses
  explored lines. Session backups preserve optional lines, source, cursor, draft
  and evaluations; imported RAV ingestion is outside the clarified recording
  contract and is not silently claimed. Copy PGN follows the selected replay line.
- [x] D5 UX reviews: named session/status above mode panels; options off by
  default; branch list/clear only when on; existing replay and non-destructive
  disabling. Keyboard, failure status and narrow fit require actual observation.
- [x] D6 Logic reviews: hydrate before autosave, serialize writes, stable IDs for
  URL loading and engine completion, validate restore before mutation, explicit
  destination for synchronous handoffs. Preserve stored alternatives on disabling
  but never select them or record new ones until re-enabled.
- [x] D7 Risk returns: preservation tests compare complete paths and metadata;
  stale callback tests must distinguish equal SAN from different roots; storage
  denial must retain pending work. Use actual browser input rather than synthetic
  callbacks for editor draft and route-transition checks.
- [x] G1 Design gate: accepted edges have owners/proof routes; no implementation
  has been treated as evidence. Proceed with connected session/storage slice.

## Historical implementation and proof (2026-10-21)

Each item targets its numbered model above; rival is an absent/stale/incorrectly
gated persistence edge. Prerequisites precede execution. Results and corrections
are recorded below with actual source/test/browser observations.

- [x] B1 Pure session capture/replay/validation and additive database store (G1).
- [x] B2 Analysis write owner, opt-in branch policy and session lifecycle (B1).
- [x] B3 Autosave/hydration/library/save/retry and backup/restore UI (B2).
- [x] B4 Editor effective-FEN commit, stale URL isolation, targeted handoffs (B2).
- [x] B5 Matching eval persistence, metadata/copy/replay consumers (B2).
- [x] T1 Default-off, enabled/nested alternatives, clear/off/on and mainline
  preservation tests (B1,B2).
- [x] T2 Metadata/FEN/counter/promotion/comment/backup validation/replay tests (B1).
- [x] T3 Storage ordering/conflict/failure tests, source identity store tests,
  one-move evaluation round-trip, handoff tests; browser hydration below (B3–B5).
- [x] R1 First runtime sweep: save/reload and real branch off/on/new/clear/replay
  and arranged FEN/URL carryover (B3–B5,T1–T3).
- [x] R2 Second runtime sweep: composed source changes, library return, backup
  restore, pending-save navigation and option transitions after corrections (R1).
- [x] R3 Third runtime sweep: final narrow/keyboard/error visibility, zero-move
  FEN, unchanged Play/Arena/database routes and final source/network audit (R2).
- [x] C1 Tests/lint/build, reconcile usage/evidence, commit and push current branch
  under the user's continuing delivery instruction (R3).

## Historical findings and evidence (2026-10-21)

Baseline source confirms: in-memory Chess atoms are not durable; saved-game Save
is disabled; `getGameToSave` selects original PGN over an explored board;
`loadPgn` can skip explicit same-signature resets; LoadGame's URL effect depends
on a callback recreated from the current game; untargeted handoffs dispatch
synchronously and may be consumed on the source analysis/editor page. Database
copy indexes `games[id-1]`, which fails after deletions. All are in accepted scope.

### Implementation returns and corrections

- The main game and analysis sessions have separate ownership. The toolbar Save
  now saves the current session, including zero-move roots; Database links to the
  session library. Loading a source game reuses its associated session while the
  source PGN matches, without changing the source game or its IDs.
- Editor FEN input is session-owned draft state. Analyze and destination actions
  use the effective text directly, avoiding blur/state timing. The editor default
  mode effect runs before incoming handoffs. Explicit new roots/imports clear
  stale source URL parameters; source controls wait for the requested source to
  finish loading so late retrieval cannot overwrite edits to an earlier view.
- Completed engine work is accepted only for the initiating session/signature
  and engine. Changing a pending full-game target replaces the busy engine.
  Live position analysis remains automatic; full-line analysis is explicit.
- A real one-move Black-root analysis exposed NaN accuracy/rating for the player
  with no samples. Metrics now use JSON-stable null, rendered as “—”, and attribute
  moves using the actual root side. Classification totals/replay use actual move
  colors; move numbering respects custom FEN counters.
- Saves use serialized read/write transactions plus revision checks. Stale tabs
  show an error and can save as a new identity. Failed writes leave the preceding
  committed record intact and do not poison the queue. Restore validates every
  line before writing and assigns a fresh identity/revision.
- Clear has immediate Undo. Undo merges the cleared branches back without
  reverting subsequent mainline edits/new branches. Turning off is nondestructive
  but excludes branches from the visible board, recording, and exported backup.
- UI return: dropdown arrow keys initially also moved the board. Shared shortcuts
  now respect handled events and focused menus/dialogs. Mobile toolbar padding and
  separate navigation/action rows prevent clipping; desktop panel content can
  grow so saved-line controls do not collapse the move list.

### Recorded proof

- `npm test`: 331 passed, 0 failed. Added session/store tests cover default-off
  divergent exploration, enabled/nested paths, clear/off/on, exact cursor replay,
  headers/comments, Black roots, underpromotion, draft text, invalid restores and
  fresh restore identities. fake-indexeddb tests execute real idb transactions
  for v1→v2 preservation, write ordering, failed transaction recovery and stale
  revision refusal. Handoff tests cover synchronous source interception and kind
  mismatch. Metrics tests cover empty samples and Black-root JSON round-trips.
- Browser, isolated IAB profile on localhost: named main `e4 e5` survived reload;
  exploring `e4 c5` with storage off did not change it. After explicit enable,
  `e4 c5` and `e4 e6` survived reload alongside the main. Existing autoplay replayed
  the main. Clear left the main and Undo restored both alternatives. Disabling,
  exploring `e4 Nf6`, reloading and re-enabling left exactly the two saved branches.
- Actual backup download inspected on disk: main and both alternatives, cursor,
  title and format preserved. The actual file chooser restored a separate session
  and retained the original. Two actual browser tabs produced a visible conflict;
  Save as new session left both named versions visible in the library.
- Editor: typed `4k3/8/8/8/8/8/1R6/4K3 b - - 0 42` without Enter, then Analyze.
  Copy FEN returned that exact root, URL no longer referred to the old session,
  zero-move root saved. `42...Kd7` survived reload. Full analysis then survived
  another reload with its annotation, graph, Black metrics and empty White score.
  Draft text also survived navigation/reopening. Editor→Arena and editor→Play
  visibly populated the exact same FEN in their setup fields.
- Keyboard opened/selected a saved branch; after correction opening the dropdown
  from the final replay position no longer jumped to the root. At 390×844, options
  and backup controls are readable and scrollable; document width equals viewport
  width after toolbar correction. Normal viewport captures are saved externally:
  `analysis-options-mobile.png`, `analysis-saved-branches.png` in the task's
  visualization folder. Final console review found a Next.js development HMR
  manifest warning after the production build ran beside the dev server; no
  application save/analysis error was logged during the checked journeys.
- Boundaries: browser proof is local development, not deployed production or
  cross-device/cloud sync. Storage denial/quota and pending full-search target
  cancellation are covered by storage failure tests/source review respectively;
  no artificial quota denial or reliably in-flight cancellation was forced in UI.
  Original-game migration is proved by transaction tests; database copy was fixed
  by ID lookup and source review. No destructive user-data operation was used.
- Final gates: `npm run lint` passed (ESLint and TypeScript); `npm run build`
  passed, exporting all 15 pages. Sentry's existing build integration reported
  missing release-upload credentials; no release/source-map upload was claimed.
  Final desktop move button had nonzero dimensions (28×139px), document width
  equaled viewport width, and the branch preference was left off after QA.
  `analysis-session-options.png` captures the final default-off options.
