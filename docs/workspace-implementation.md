# Workspace implementation: live plan and evidence

Authorized 2026-10-24 after the investigation in [workspace-design.md](workspace-design.md). Start: `c6cbf0f`. Preserve existing work and preferences. No commits or pushes. Source work is now authorized; the earlier read-only boundary has ended.

## Current state

The first implementation pass closed W1–W9, but its Play acceptance missed the coach-enabled board-grading journey. The user found a real functional gap after that closure; the earlier blanket completion claim was too broad. The 2026-10-25 follow-up below records the reopened checks, correction and targeted closure. The pass-1/2 notes remain historical: their fixed inspector width, schema number, intermediate failures, and pending checks do **not** describe the delivered source.

Baseline browser recovered on isolated origin `http://127.0.0.3:3000`, using synthetic browser-local data. At 1280×720: board 263×263, document 1134px high, main 1048px high. Screenshot: external thread artifact `workspace-before.png`. The user's port-3000 server has not been stopped by this work; its process was replaced during the session. Current verification uses a separate static server on port 8038, serving `.next-workspace`.

The design document owns intent, models, rival compositions, interactions, migration, connections, and acceptance. This file tracks actual execution; a source change is not a browser or persistence pass.

| ID / state | Why; prerequisites | State to inspect; rival; action | Expected evidence and closure; next |
|---|---|---|---|
| W0 complete | Establish scope and current snapshot; user authorization | Clean `c6cbf0f`, approved plan, current preservation/performance contracts; rival: newer work changed premises; inspect status/source/browser | Snapshot unchanged; clean before own docs; live browser baseline measured; unlock W1 |
| W1 complete locally | Stable workspace geometry; W0 | Board remains left and height-fitted; inspector gets remaining width; measured chrome/gutter and evaluation bar share the square's actual size | Desktop/portrait/phone and short-window measurements below; fixed-width first attempt rejected and corrected |
| W2 complete locally | Consistent usable Analysis tools; W1 | Session → saved line/reports → Game analysis → mode → overlay disclosure → retained tabs → common footer | Native controls, keyboard replay/select ownership, retained Game details, independent Visualize/report replay and focus return |
| W3 complete locally | Shared fitting across destinations; W1 | Analysis, Editor, Play, Arena, Puzzles, Openings and Vision use shared geometry; overlays no longer reserve an empty row | Named consumer checks below, including formal Play and local Arena; native Reckless remains an environment boundary |
| W4 complete locally | One growing variation with preserved reports; W0/W2 | Shared tree, growing alternative endpoints, immutable reports; compact v2 records and recoverable legacy migration | Repeated browser evaluate/extend/reload; exact-record/archive/conflict/failure tests; small indexed view-state saves |
| W5 complete locally | Full, truthful import/export; W4 | Recursive variations/comments/NAGs and explicit line/study/FEN scopes; awaited clipboard and text fallback; compact backup/restore | Native line/study clipboard, native backup download/read/restore; structural edge cases and migration tested automatically |
| W6 complete locally | Immediate coherent editor actions; W1/W4 | Immediate logical position, independent motion presentation, raw-input-aware undo/redo and explicit apply/return distinction | Native add/undo/redo/FEN/promotion; real-frame motion fixture catches and closes interrupted capture/promotion bugs |
| W7 complete locally | Setup fields visibly control setup; W6 | One parsed draft supplies preview/Start/editor handoff; active match remains separate | Both setup clears; invalid/valid previews; exact custom-root handoffs; active/completed formal Play and active Arena |
| W8 complete locally | Explain arrow rank and move consequences consistently; W4/W6 | Turn-relative blue/orange, independent rank/choice, source silhouette masks, top-layer annotations and shared Visualize | Native Arena best vs chosen rank2 opacity; independent preview; actual moving mask assets/poses; stale-owner regression suite |
| W9 complete locally | Delivery evidence and reconciliation; W1–W8 | Full tests, clean lint/types, isolated production export, current browser and direct-storage evidence | 523/523 tests, clean lint/types/diff check, 15-route build and final screenshots; no production/cross-device claim |

Each discovered consumer/counterexample is added below before its checks. Full case definitions remain in workspace-design section 15; its parent rows do not stand in for executed cases.

## Named initial cases

- G1: Analysis 1280×720 empty and loaded session, expanded/collapsed overlays, evaluation visibility, tabs, move/progress changes.
- G2: Analysis 1366×768, 1440×900, 1920×1080 and expanded/collapsed application rail.
- G3: 1024×768, portrait 768×1024, 390×844, short landscape and enlarged content: deliberate fitting fallback and all controls reachable.
- G4: Editor entered from Analysis and direct route; palette/header/error changes cannot resize the board.
- G5: Play setup/active/completed; Arena setup/active/paused/completed; visible previews and independently scrollable side content.
- N1: Arrow replay shortcuts outside controls vs input/select/tab/menu/dialog ownership; focus return and browser scroll.
- H1: One alternative continued, evaluated, continued again; repeated existing edges, sibling and nested forks.
- H2: Legacy prefix snapshots with distinct reports/comments, selected cursor, raw source and custom root; migrate/reload/backup/restore/failure.
- E1: Active line, full study, current FEN; native clipboard success/rejection and text/download fallback; recursive PGN round trip and results.
- M1: Place/remove/drag/capture/castle/promote/undo/redo/rapid input; arrows and visible piece poses; reduced motion.

## Evidence log

- Entry baseline: fresh browser measurement above; investigation Node fixtures and 24 focused tests establish prior ownership behavior, not current delivered performance.
- Existing full-suite baseline: 499/502, with two palette failures and one old Analysis-default assertion. Distinguish intentional preference alignment from product defects.
- Design-to-build gate: approved connected direction and explicit data-preservation boundaries are retained. W1 is the representative rendered slice; inspect its actual fit and interactions before spreading the shell. W4/W6 must prove migration/renderer feasibility before their consumers expand.

### Implementation pass 1 and 2 (not yet delivery closure)

- W1 representative rendered slice: production build passed. At 1280×720, board is 483×483 at x329/y121; inspector x873/y69, 380×639; document height 720. Evaluation bar is aligned with the board. Overlay disclosure opens without moving the board. At 390×844, deliberate stacked layout: board about321px, document1229px, no horizontal overflow. Reset temporary viewport afterward. G1 empty-state and G3 phone evidence only; loaded-game, additional sizes and motion checks remain.
- W2/W3 source in progress: compact session row; saved-line selector; Game analysis above mode/overlays; standard switches/selects inside a disclosure; visited tab views retained through React Activity; common board toolbar; bounded Play/Arena inspectors. Mobile brand links Home. These are not blanket browser passes.
- W4 feasibility/source in progress: variation endpoints grow across evaluations; immutable report targets are retained separately. Version-2 durable records store one shared move tree and path handles rather than duplicate branch PGNs. The runtime PGN projection bridges existing consumers. Schema5 preserves the exact version-1 record in an archive in the same atomic transaction as its first compact save. Compatible legacy prefixes collapse into the deepest unambiguous continuation with report snapshots and identity aliases; ambiguous forks/comment conflicts stay separate. Original backup recovery is available for migrated records.
- W5 source in progress: recursive PGN parser/writer validates every variation; selected-line and full-study scopes; NAGs/comments, escaped headers, Black roots/promotion, zero roots; unfinished alternative results reset. Clipboard writes are awaited, with success feedback and a selectable-text fallback. Browser-native permission and download checks remain.
- W6 source in progress: shared motion presentation commits the logical placement immediately; moving/reappearing pieces animate from their visible pose, removed/added pieces fade/scale, native drag and promotion remain with the rules board. Library external-position animation delay is zero; the separate presentation keeps 120ms editor / 200ms Board / 250ms MiniBoard durations and ease. Reduced-motion uses immediate poses. Editor state has bounded undo/redo, immediate valid-FEN preview, stale-draft clearing on board actions and exact unfinished-input restoration. Motion/browser proof is still required before accepting this shared-renderer change.
- W7 source in progress: one parsed setup result supplies preview and Start for Play/Arena. Clear returns to standard; invalid input has an explicit standard-board fallback and blocks Start. Active match state is separate from pending setup input. Random Play colour is chosen when setup opens/selects Random, so odds preview and Start use the same colour. Need live both-mode checks.
- W8 source in progress: chosen-move rank is independent of its role; merged arrows keep semantic roles; theme-aware continuous fills adapt contrast without a casing; source masks follow motion CSS poses and only the dragged source loses its mask. Analysis now offers current-continuation preview plus played-move visualization across grades. Preview runs independently of recording. These require rendered QA and stale-owner regression checks.
- User steering during implementation: display **Brilliant** for legacy `splendid` and **Great** for legacy `perfect`, across recaps, feedback, badges, reports and accessibility text. Stable saved keys and icon asset names are retained.
- Focused data checks: 63/63 before the latest arrow/label pass. New scenarios include repeated evaluate/extend with one branch and one durable edge per occurrence; recursive PGN round trips; transpositions; legacy report/comment migration; editor history; setup parse/clear/invalid. Latest expanded focused pass also passes (see `.performance/workspace/focused-pass-two.log`).
- Earlier whole-suite pass was 509/514: two pre-existing contrast failures and an old Analysis-default assertion, plus schema-version expectation and new icons. Palette/default/schema expectations and bundled icons have since been addressed; a new full run is still required. Earlier lint found formatting/duplicate-import issues while source was changing, not a clean final pass. The second isolated production build is running.

Historical next step at the end of pass2: inspect the fresh production renderer, complete shared consumer and viewport checks, resolve source/runtime regressions, then run final lint/test/build and document claim boundaries. The final pass below records that work.

## Final implementation and evidence — 2026-10-24

### Layout and interaction decisions corrected during review

The first fixed-380px inspector composition was the wrong constraint. The final grid is a height-fitted board stage at the left, followed by `minmax(0, 1fr)` for the inspector. The minimum inspector width decides when to stack; it is not a maximum. Play/Arena overlay controls now live in the inspector rather than reserving an empty 44px row above the board. The board, headers and replay toolbar own their rectangle independently of side content.

Other removed constraints were tiny viewport-relative engine-line text, clipped line widths, an indefinite unknown-opening placeholder, duplicate visualization entries, and unrelated pill styles. Position/Moves/Graph retain visited content through React Activity, which suspends hidden effects. The Analysis overlay entry opens a single disclosure with standard switches and native count selects. Game analysis is immediately below the saved-line/report context. The shared footer and board replay use consistent targets.

Returning from Arrange with the Analyze mode switch leaves the study intact, even if the draft is invalid. Applying is the distinct **Analyze from here** action, which starts a new custom-root study and retains the old session. Undo snapshots include unfinished raw input as well as the board position; a later board action clears that raw input, and Undo restores it exactly.

The final short-window check found an evaluation-bar height read from a stale DOM ref. The board was already 243px but the bar remained 483px and made the document 604px high. The bar now consumes the same observed square width as the board/arrow presentation. Fresh built-app verification gives a 243px board **and** bar and a 480px document at 1280×480.

### Browser layout evidence

All browser runs use synthetic data on isolated origin `http://127.0.0.1:8038`. Coordinates are CSS pixels. The inspector scrolls locally in bounded compositions. Portrait/phone intentionally stack and permit document scrolling.

| Viewport | Square board | Inspector | Document height | Observed result |
|---|---:|---:|---:|---|
| 1280×720 | 483×483, x288/y121 | 462×639, x791/y69 | 720 | Loaded session, reports, analysis progress, tabs, overlay/display controls do not move the board |
| 1366×768 | 531×531 | 500×687 | 768 | Expanded rail, bounded layout |
| 1440×900 | 663×663 | 442×819 | 900 | Board remains height-fitted at the left |
| 1920×1080 | 843×843 | 742×999 | 1080 | Inspector takes remaining width |
| 1024×768 | 469×469 | 380×687 | 768 | Settled collapsed-rail layout; measurements during the rail transition were discarded |
| 1280×480 | 243×243, x288/y121 | 702×399, x551/y69 | 480 | Final evaluation-bar correction verified; both board and replay remain in the viewport |
| 768×1024 | 681×681 | Stacked | 1650 | No horizontal overflow |
| 390×844 | About 321×321 | Stacked | 1412 with loaded report context | No horizontal overflow; tools remain reachable |

Additional observed consumers: Editor 613px square; Play/Arena 535px; Puzzles 525px; Openings 505px; Vision 573px at 1280×720. Play retained the same geometry through setup, active play and resignation/result. Arena inspector scrolling (612px offset, 1268px content) left its 535px board and 720px document unchanged. Puzzle hints, opening replay and Vision start/hop/undo retained their rectangles.

Keyboard checks: board-toolbar ArrowLeft advances replay without document scrolling; native Moves ArrowDown changes 2→3 without changing the study position; menus/dialogs own their keys. Current-continuation visualization advances its MiniBoard independently and returns focus to Visualize. Past-report replay leaves the current study untouched. Opening Game details, visiting Graph and returning to Position preserves its expanded state and the board rectangle.

### Tree, report, export and persistence evidence

The synthetic import is a six-ply main game plus two nested Sicilian alternatives. Selecting an alternative opens at its fork. Native line-copy contains the complete selected path and an unfinished `*` result. Native full-study copy retains the main result and recursive RAVs. No asynchronous clipboard success is reported before the write resolves; an unavailable/rejected write has selectable-text recovery.

Native acceptance sequence: select the four-ply alternative → play Bb5 → run Stockfish depth14 analysis → play e6 and O-O → reload. There are still **two variations**, the selected one now has **seven plies**, and its earlier **five-ply report** remains in Past reports. A second seven-ply analysis enables Graph and keeps that earlier report. Saved replay at the five-ply position survived reload. Brilliant/Great labels are visible in the Moves recap.

The browser downloaded `chesskit-analysis-session.json` through the native download event. The resulting 34,316-character file was read from disk: format `chesskit-analysis-session`, session version2, shared tree, branches and reports present. Restoring that exact file through the native chooser created a new session identity with both alternatives and the previous report. The original session remained available. The ignored evidence copy is `.performance/workspace/native-session-backup.json`.

Current IndexedDB schema is **7**, not the earlier schema5 noted above. Compact v2 study content is separate from small view state. Cursor/orientation/title/editor-draft updates use a compound identity/revision index and a content token: they do not clone, replay, serialize or rewrite the tree and reports. A state-only update is allowed only after the token proves the preceding content save committed; otherwise it falls back to a full save. Global save ordering and cross-tab revision rejection remain in place.

Automatic direct-storage checks cover physical content records staying unchanged on view updates, view-state reread, cross-tab conflicts including state-only changes, a failed content save followed by recovery, quota/transaction rollback, exact v1 archival before compact migration, malformed-list-row isolation and unreadable-session recovery. The runtime bridge and backups retain legacy support. Recursive parsing/writing covers comments, NAGs, escaping, Black roots, promotion, zero-ply paths, result metadata and transposition identity. Continuing/forking preserves common-prefix annotations without copying annotations from the replaced move.

### Editor, setup and motion evidence

Native editor checks cover placement, Undo/Redo, valid FEN changes, move metadata, invalid input blocking apply/copy, and palette actions becoming authoritative. A final test typed `unfinished QA input`, placed a queen, and undid: the exact unfinished string returned and invalid-input actions remained blocked. Analyze returned to the original seven-ply study without applying that draft.

Play and Arena setup clear immediately to 32 pieces. Invalid input explicitly displays the standard-board fallback and blocks Start. The valid three-piece custom FEN `4k3/8/8/8/8/8/1R6/4K3 b - - 17 42` is shared by preview, editor handoff and Start. Play→Editor→Arena retained that exact position, Black to move and move42. Formal 3+0 Play retained advice restrictions and takeback restrictions; a dragged e2–e4 and bot reply, running clock and resignation/result were exercised locally.

Native promotion works through both click and drag, with the picker centred over the board and dimming/piece layering correct. The in-app browser prefers reduced motion, so normal animation was additionally verified with an ignored local fixture importing the **actual production MotionChessboard and ArrowLayer unchanged**. Its only environment adapter controls the reduced-motion media query. It records visible DOM poses/opacity and source-mask asset/transform over real animation frames, rather than asserting a timer completed.

Eight normal-motion cases pass: move, interrupted move/undo/redo, add, remove, castling, promotion, interrupted promotion undo and interrupted capture undo. Reduced motion moves immediately with zero in-flight frames. Fixture inspection exposed two real defects that were corrected: a restored captured sprite retained an exit flag, and a JavaScript cleanup timer could finish before the browser animation timeline, leaving a promotion mask on the old asset/offset. Cleanup now follows `animation.finished` with effect-local ownership; interrupted runs cannot publish old cleanup. The final critical rerun recorded 84/86/84 frames for move-interruption/promotion-undo/capture-undo, all settled correctly with identity/opacity/mask restored. Evidence is under `.performance/workspace/motion-*-release.json`; earlier complete-case evidence is `motion-*.json`.

Logical positions commit immediately; animation duration/easing remain 120ms Editor, 200ms Board, 250ms MiniBoard and 150ms Vision. Native drag/promotion remain owned by the rules board. Arrow source masks follow the visible source sprite while every other piece is overdrawn by the arrow. Quality marks remain above arrows. Missed arrows use a continuous checker fill; turn-relative blue/orange and adaptive contrast do not reintroduce the white casing.

Native Arena proof used a chosen rank2 Kd8 alongside rank1 Kd7: arrow opacity was **0.6 vs 1**, respectively, while both were blue because Black was to move. Candidate cards separately labelled #1/Best and engine choice; keyboard focus previews candidates too. Screenshot: `.performance/workspace/arena-rank-proof.png`.

### Checks, deviations and boundaries

- `npm test`: **523 passed, 0 failed, 117 suites**, `.performance/workspace/test-verified.log`.
- `npm run lint`: ESLint and TypeScript completed cleanly for the final source, `.performance/workspace/lint-final.log`.
- `$env:CHESSKIT_DIST_DIR='.next-workspace'; npm run build`: final source compiled, typechecked and exported all **15 routes**, `.performance/workspace/build-final.log`.
- `git diff --check` passed after the source and documentation reconciliation. No commits or pushes.

The export surface intentionally uses **Copy study PGN (all variations)** plus a full JSON backup, alongside line PGN download; it does not add a second separate full-study-PGN download button. Invalid setup input deliberately shows a clearly stated standard-board fallback rather than silently treating a previous valid draft as the effective input. These choices preserve scope/data and make the current effective state explicit.

These are local built-app/automatic-test claims. Native Reckless was unavailable in this environment; browser Arena proof used Stockfish 18 Lite. No production deployment, cross-device storage guarantee, OS/browser zoom matrix, latency benchmark, or forced native clipboard-permission rejection is claimed. Clipboard recovery is implemented and inspected, but native denial was not forced. The normal-motion fixture proves production renderer behavior under a controlled media preference; full-app native interactions were separately checked with the browser's reduced-motion preference. User data and the user's port3000 server were not altered by synthetic QA.

Final screenshots: `.performance/workspace/analysis-final.png`, `.performance/workspace/analysis-short-window.png` and `.performance/workspace/arena-rank-proof.png`. Browser warnings/errors were empty in the final Analysis tab. Temporary viewport overrides were reset and the motion fixture tab was closed. The retained Analysis preview is the restored synthetic session on port8038. The verification server serves `.next-workspace` separately from the user's development output.

## Play feedback follow-up — 2026-10-25

### Reopened obligation and cause

The user's screenshot showed a neutral move-grading marker that never became a grade. Native reproduction on the prior built app confirmed the mismatch: after e4 and the bot's reply, the Coach card said **Opening**, while the board had no grade image and still exposed **Grading the move**. The previous formal-game check had intentionally disabled coaching, so it could not validate this feature. The acceptance set was incomplete.

Play's `useGameData` published only FEN and last-move metadata to the Board. A separately mounted Coach card evaluated the human's move and published feedback for missed arrows, but never gave its grade to that board snapshot. The shared Board consequently rendered a permanent pending marker. Disabling coaching did not disable the marker, and bot moves had no grading producer at all. The former coach cache/queue also lacked game/engine ownership in its feedback identity.

### Connected correction

- `useMoveCoach` now owns one evaluator at the Play workspace level. It reuses the existing serial analysis scheduler, at the unchanged depth12/three-line coach settings, independently of bot and hint engines. Both colours' moves are evaluated; a fast bot reply does not cancel the human's pending grade.
- `projectPlayFeedback` gives the Board the latest move's grade, the move list the corresponding per-move annotations/scores, and the Coach its human-specific narrative/Visualize result. These are different presentations of the same before/after evaluations. Board snapshots are supplied synchronously through the shared overlay owner; the metadata-only writer is removed from Play.
- Game identity and engine-instance identity gate evaluations, errors and feedback. A fresh game/engine retires the scheduler. Takebacks project the current history rather than retaining a later move's marker. Coaching off produces no grading marker; failed grading produces a visible recoverable error instead of an endless pending circle. Finished games retain completed grades, and checkmate is evaluated without an impossible terminal search.
- Actual browser inspection also found the shared move list announcing the internal `perfect` key while displaying Great. Its accessible label now uses the same public terminology as the visible text.
- The custom-root check exposed another disconnected presentation: captured-piece strips subtracted pieces from a standard starting inventory, inventing many captures at an empty custom root and treating promotion as a lost pawn. They now use actual captures in the game's history, including en passant and captures of promoted pieces. Undo/replay follows that history. A pending setup preview has no known capture history; its material advantage still reflects the previewed FEN.

### Follow-up evidence and closure

- Automatic checks: **532/532 passed, 119 suites**, `.performance/workspace/play-feedback-final-tests.log`. New cases include both-colour grading, Black custom roots, coaching off/error, previous-game/engine rejection, takeback, checkmate, bot replies during an in-flight human evaluation, actual custom-root captures, en passant and promotion.
- Native corrected-app checks: e4 receives its board grade before the bot replies; after e5 both list entries are graded and the board's pending marker is gone. Taking back clears the old grade before d4 is played. Turning Engine arrows off leaves grading enabled. A new game with Coach off shows neither grades nor a pending circle after e4/e5. A completed casual game retains its finished grade.
- Native bad-move check: from `4k2r/8/8/8/8/8/8/3QK3 w - - 0 1`, Qh5+ is Blunder and Rxh5 is Great. The board labels the current bot move, the Coach continues to explain the player's blunder, and the continuous missed arrow points to Qa4+.
- Final native capture check: the custom setup preview has zero captured pieces and material +4 for White. Qxh8+ in a continuation adds exactly one black rook to White's capture strip; taking back removes it. In the deterministic depth8 Qh5+/Rxh5 test, Black's strip contains exactly the captured white queen, with +5 material, and no invented absent pieces.
- Native failure/recovery check: choosing the unavailable Reckless bridge for **Play coach** leaves the Stockfish bot functioning. The Coach shows the bridge error and Retry, both move-list entries say **Unavailable** (not Pending), and the board has no grading marker. Changing the coach back to the analysis engine re-evaluates the same game: Qh5+ becomes Blunder and Rxh5 becomes Great on the board, list and accessible labels. The existing game does not restart. Shared list failure-state support is also wired to Arena's evaluator error.
- A separate fresh formal game with the stored Coach preference on has no Coach card, hint action, move grade or grading marker after e4/e5; Take back remains disabled. Switching arrows off in casual Play does not disable grading. These are separate controls with separate producers.
- Board geometry remains 535×535 at x288/y121 and the document remains 720px high through grading, bot reply, takeback, error and recovery.
- Final source passes ESLint/TypeScript (`play-feedback-delivery-lint.log`), exports all 15 routes (`play-feedback-delivery-build.log`) and passes `git diff --check`. No commits or pushes. The 532-test run above includes the data/scheduler/capture changes; subsequent failure-label wiring is verified by final types/build and native error/recovery checks.
- Screenshots: `.performance/workspace/play-grading-before.png`, `play-grading-unavailable.png` and `play-grading-fixed.png`. The last is the final built app with a Great board grade, the player's Blunder feedback, the missed-move arrow and only the actual captured queen in the header. The temporary formal test tab was closed and the coach/mode preferences restored on the isolated QA origin.

This closes the reported Play grading defect and the connected cases listed here. It does not establish that every remaining feature or interaction in the earlier redesign is defect-free. These are local synthetic Stockfish checks on port8038, not user-data mutation or native Reckless success validation. The expected Reckless failure was deliberately exercised; earlier test/build records do not stand in for this follow-up's evidence.

## Draw result badges — 2026-10-25

The user's clarified scope is **all draws**, including the two-king insufficient-material position in their screenshot. Both kings receive grey circular stickers with their own colour's king SVG from the selected piece set, rotated sideways. The accessible label/title states the actual reason instead of calling every draw stalemate. Markers scale with the board (12px minimum in small previews), follow orientation, stay above arrows/pieces and replace an overlapping last-move grade on a king. They are terminal results, independent of advice/annotation switches.

The shared draw projection uses the existing game-result model: stalemate, insufficient material, threefold repetition, fifty-move rule, agreed draws and drawn timeouts. Full boards receive the real game/history; Play also supplies its recorded game-end state. Analysis and past-report playback recognize imported PGN draw results **only at the exact recorded endpoint**, not on an earlier replay position or a different path to the same FEN. Checkmate takes precedence over contradictory recorded-draw metadata. Shared full boards and MiniBoard previews use the same badge component. Invalid/incomplete Scan previews remain unmarked.

Nine focused king/result cases pass, including both king colours, all draw reasons above, history identity, endpoint replay and no false badges for live/checkmated/incomplete positions. The full suite passes **538/538 tests, 120 suites**, `draw-badge-delivery-tests.log`. Final lint/types and the 15-route production build pass (`draw-badge-delivery-lint.log`, `draw-badge-delivery-build.log`); `git diff --check` is clean.

Native rendered verification reproduced the user's position through `1... Kxb3`: no premature stickers before the capture, then two grey stickers at b3 and g7, with the overlapping move-grade badge suppressed. The selected set changed badge assets from Neo to Alpha and back; both badges follow flipped orientation. A separate imported four-ply game recorded as `1/2-1/2` has zero badges at its start, two at its endpoint, and zero again after stepping back. The retained QA tab shows the exact two-king insufficient-material position in Neo with Black's orientation. Screenshot: `.performance/workspace/draw-badges-insufficient.png`. No commits or pushes.

## Portrait flow and scroll ownership follow-up — 2026-10-25

The earlier narrow-window check missed a wider portrait viewport: the fit helper only considered available width/height, so 948×1026 could still show two columns. Stacked inspectors also retained `overflow: auto`, scroll containment, and a 75dvh child cap. Even without overflowing content, those containers could swallow wheel input instead of scrolling the document. Play/Arena move lists separately retained fixed height caps.

The shared workspace now measures actual viewport orientation independently of navigation/header space. Portrait windows always stack the inspector below the board. Stacked boards use available width and the document may exceed viewport height. In stacked mode the inspector and its explicitly marked content containers use visible overflow, automatic scroll chaining, and no height cap. Both overflow axes are restored together to avoid CSS turning visible Y back into auto when X is hidden. Arrange mode participates in this same contract. Move lists receive the shared page-flow context, expand naturally in stacked mode, and stop attempting automatic internal scrolling when moves change. Landscape retains the height-fitted board and locally scrolling inspector.

Built-app verification on the isolated port8038 origin:

- At 948×1026, the inspector follows the board by 20px and fills its column. A synthetic forty-move game renders its entire move list in document flow, with no sidebar scroll owner. Scrolling down over the panel changes document scrollTop from 639 to 1152 while inspector and tab scrollTop stay zero; scrolling up over the panel returns the document to 639.
- At 1024×1366 and 640×1000, the same long list stays stacked, has no nested sidebar scroller and causes no horizontal page overflow. At 1280×720 and 1280×480 the layout is bounded, document height equals viewport height, and the long list scrolls inside the inspector. Geometry is recorded in `.performance/workspace/portrait-scroll-matrix.json`.
- Arena setup and a started match with an actual c4 move have no sidebar scroll owner in portrait; the move list computes to max-height none / visible overflow. Play setup flows in the document; ordinary editable text controls retain their native input behavior. Analysis arrangement tools likewise use visible overflow with no nested scroll owner.
- Seven geometry regressions pass, including explicit viewport orientation, the reported wider portrait proportions, near-square portrait board sizing and short landscape preservation. The full current worktree passes **576 tests / 129 suites**, ESLint/TypeScript and the 15-route production export (`portrait-scroll-tests.log`, `portrait-scroll-lint.log`, `portrait-scroll-build.log`). The higher suite count includes independent engine work already present in the checkout.

Screenshot: `.performance/workspace/portrait-single-scroll.png`. Viewport overrides were reset. These are local built-app checks; no production or all-browser claim is made. Existing engine/palette work was preserved. No commits or pushes.
