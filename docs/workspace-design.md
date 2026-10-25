# Chesskit: a stable analysis workspace, coherent history, and responsive editing

Investigation and proposed implementation plan, 24 October 2026.

Reviewed checkout: `C:/Users/cystol/Projects/chess/chesskit`, commit `c6cbf0f25f8648f3ab57e289223bc595346e2768`. Application files were not modified. The probe script and results are alongside this document. This is a design and engineering plan, not a claim that the proposed application has been built or visually verified.

## 1. The intended outcome

The board should feel like a stable instrument. A move changes the position; an engine update changes its advice; opening a setting changes a setting. None of these should unnecessarily move the board, displace replay controls, lose navigation context, manufacture variations, or make basic work wait for unrelated work.

The requested transformation has five connected owners:

1. A workspace that owns geometry, scroll, density, and focus.
2. A study/history model that owns moves, alternatives, analysis results, replay, and export.
3. A board presentation layer that owns immediate response and continuous motion.
4. Shared position-input and arrow semantics across Analysis, Editor, Play, and Arena.
5. A small interaction vocabulary that gives settings, commands, navigation, and status predictable forms.

The Home page's content and composition remain outside the redesign. Shared brand navigation, chrome selection behavior, and necessary shared-component corrections apply there. Existing engine choices, preferences, completed evaluations, game records, comments, backups, and the formal-game advice restrictions must survive.

The user has delegated design judgment. The latest request asks for investigation and a plan; it does not authorize implementing these changes. Previous aesthetic opinions are evidence of intent, not a demand to reproduce every proposed placement literally.

## 2. What the investigation establishes

Evidence labels: **source** means the current code or installed dependency establishes the mechanism; **probe** means an executed synthetic Node experiment; **reported** means the user's observation; **prior browser** means the desktop rendering seen earlier in this chat. These are deliberately different from a fresh production-browser measurement.

| Finding | Evidence and mechanism | Consequence | Scope of confidence |
|---|---|---|---|
| There is no bounded workspace owner | The application uses `minHeight:100vh` and a naturally growing `main`. Analysis adds a minimum-height panel, an expanded inspector, and a content maximum that does not account for all preceding rows. | The document becomes the scroll container even when only side content needs more space. | Source; earlier desktop overflow was observed. |
| Board sizing is separate from its actual slot | Analysis measures a generic `.MuiGrid2-root` and subtracts 700 pixels; other modes measure `main` and subtract different estimates. Width and height use different heuristics. | Board space is wasted; side content, scrollbar changes, and mode differences can influence geometry. | Source. Exact contributors to each reported shuffle require a geometry trace. |
| Dynamic content can change the layout skeleton | Progress appears/disappears; the Analyze control disappears during progress; metadata and legends wrap; views mount conditionally. | Content updates can change height, scroll position, and available width. | Source; not a measured attribution of every visible movement. |
| A normal continuation does not inherently make a branch per move | A 16-ply alternative produced branch counts `0,1,1,...,1`; back/forward retained its identity. | The ordinary continuation rule is already partly correct. A blanket claim of exponential growth would be unsupported. | Executed atom-level probe. |
| Analysis preservation can manufacture continuation snapshots | A line with any completed evaluation is ineligible for extension. Repeatedly attaching an analysis result before the next extension produced 15 branch records over the same 16-ply sequence. | “Keep my analysis” and “continue this variation” are represented as conflicting operations. | Executed probe using synthetic completed-evaluation data. This does not establish the user's exact trigger. |
| Export has ambiguous scope and weak transport feedback | `displayedAnalysisGameAtom` correctly selects a saved or transient active line in the exercised cases. Copy calls `clipboard.writeText` without awaiting, success, error, or fallback. Zero-move positions disable the button. | A branch export can seem broken through scope confusion or clipboard failure; a custom root cannot be copied through that button. | Source plus active-line selection probes; native clipboard failure not reproduced. |
| Alternative-line result metadata can be stale | A probe diverged from a source tagged `Result:1-0`, `Termination:Normal`. Its unfinished `e4 c5` alternative still exported those headers although the position was not terminal. | Keeping source metadata and describing a newly explored line need separate ownership. | Executed atom-level probe; the correct exported result depends on the explicit line/study scope. |
| Variation PGNs do not round-trip | Importing `1. e4 e5 (1... c5 2. Nf3) 2. Nf3 Nc6 *` and exporting through the installed loader lost `c5`. | A future “all variations” exporter is insufficient without the matching importer and structural ownership. | Executed installed-code probe. |
| The editor has an actual presentation delay mechanism | Editor changes are external position snapshots with a 120 ms animation setting. The installed chessboard library waits for that duration before committing its internal displayed position. Pure additions/removals lack the matching source/destination needed for its slide animation. | Click placement/removal can wait and then appear/disappear without an animation explaining the wait. | Installed dependency source; not a measured 120 ms end-to-end UI latency. |
| Fast undo has an interruption mechanism | The library explicitly cancels an in-flight animation and snaps to the incoming position if another external position arrives. | Rapid navigation can look discontinuous even when logical state is correct. | Source; exact visual severity needs a recording. |
| Editor validation is not presently proven to be the bottleneck | Initial-position validation measured about 0.055 ms median and 0.232 ms maximum over 101 local samples in the final probe run. | Removing validation would target an unproved cause and weaken correctness. | Node microbenchmark only; React, SVG, storage, and paint are excluded. |
| A typed editor FEN and board edits can have different authority | ArrangePanel resolves actions from a non-null raw draft, while ArrangeBoard edits the stored piece position without clearing or reconciling that draft. | A visible piece edit can differ from the position used by Analyze or a handoff. | Source-level event sequence; no fresh live reproduction. |
| Replay is work proportional to history length | At 40/100/200/400 plies, capture/navigation medians were about 1.85/4.40/8.77/16.92 ms; replay alone 0.66/1.69/3.39/6.43 ms in the final probe run. | A long history can consume a frame's budget before React and paint. Rebuilding complete PGNs should not sit on the critical response path. | Local Node fixtures; not browser interaction percentiles. |
| Tab switching reconstructs views | Analysis conditionally renders Position/Analysis, Moves, and Graph. Earlier retained-view infrastructure still exists, but these views are now unmounted when inactive. | Scroll, local selection, chart construction, and subscriptions must be rebuilt. | Source. Warm-tab latency is not yet measured. |
| FEN setup and the visible board are separate states | Play input updates `startingPositionAtom`, while its board renders `gameAtom`. Arena input updates `startFen`, while its board renders the match game. Neither board is a derived setup preview. | Entering or clearing a position need not immediately change the visible board before Start. | Source. |
| Arena conflates “chosen” with “best” | Arena emits the chosen move as `planned`; styles give every `planned` move rank-one width and opacity. A probe gave a planned rank-four move the same width/opacity as rank-one best. | The strongest visual arrow can describe a weaker move the bot intends to play. | Source and style probe. |
| Visualize exists but is poorly exposed | Analysis renders it inside MoveInfo, gated on a small set of classifications and before/after evaluation data. | A useful existing feature can effectively be absent from the user's journey. | Source. |
| Keyboard ownership is incomplete | Arrow-key replay handlers do not prevent the browser's scrolling default. Some overlay controls blur themselves to escape key conflicts. | Navigation and document scrolling can compete; focus is discarded as a workaround. | Source. |
| Branch selection is a disruptive navigation action | Selecting a saved line always restores `cursorPly:0`. Labels concatenate the entire move sequence. | A local comparison becomes a jump to the root; long labels make the chooser increasingly unwieldy. | Source. |
| Top moves has no opener | The surviving panel is gated by an atom initialized false, with no remaining action setting it true. | Opponent comparison and its play action are unreachable unless removal was intentional. | Source; preserve as a capability in the proposed Position view. |
| Contrast and motion masking remain unfinished | Colors are fixed hue values without the documented theme adaptation. Source masks are globally disabled during dragging/settling. | Some boards have very weak arrow contrast; stationary origin pieces lose protection during unrelated motion. | Source and earlier tests. |

Key source locations:

- [Application shell](C:/Users/cystol/Projects/chess/chesskit/src/sections/layout/index.tsx:33), [viewport measurement](C:/Users/cystol/Projects/chess/chesskit/src/hooks/useViewport.ts:15), [Analysis sizing](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/hooks/useAnalysisBoardSize.ts:16), [other board sizing](C:/Users/cystol/Projects/chess/chesskit/src/hooks/useBoardLayout.ts:10).
- [Analysis composition](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/analysisPage.tsx:151), [conditional views](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/analysisPage.tsx:252), [progress layout](C:/Users/cystol/Projects/chess/chesskit/src/components/LinearProgressBar.tsx:15).
- [Branch preservation policy](C:/Users/cystol/Projects/chess/chesskit/src/lib/analysisSession.ts:156), [board/history synchronization](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/sessionAtoms.ts:110), [line selection](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/sessionPanel.tsx:207).
- [Copy PGN](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/panelToolbar/copyPgnButton.tsx:7), [download and handoffs](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/panelToolbar/moreMenu.tsx:36), [PGN loader](C:/Users/cystol/Projects/chess/chesskit/src/lib/pgn.ts).
- [Editor board](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/arrange/arrangeBoard.tsx:60), [installed animation implementation](C:/Users/cystol/Projects/chess/chesskit/node_modules/react-chessboard/dist/index.js:537), [piece matching](C:/Users/cystol/Projects/chess/chesskit/node_modules/react-chessboard/dist/index.js:4643).
- [Arena proposal](C:/Users/cystol/Projects/chess/chesskit/src/sections/arena/sidePanel.tsx:431), [style conflation](C:/Users/cystol/Projects/chess/chesskit/src/lib/arrows/style.ts:86), [Play setup input](C:/Users/cystol/Projects/chess/chesskit/src/sections/play/newGamePanel.tsx:262).
- [Visualize gate](C:/Users/cystol/Projects/chess/chesskit/src/lib/bestMoveHint.ts:75), [Analysis action](C:/Users/cystol/Projects/chess/chesskit/src/sections/analysis/panelBody/analysisTab/moveInfo.tsx:113), [keyboard dispatch](C:/Users/cystol/Projects/chess/chesskit/src/hooks/useKeyboardShortcut.ts:39).

## 3. Why the symptoms reinforce each other

The system currently asks presentation components to infer domain intent from complete board snapshots and asks separate sizing hooks to infer workspace geometry from content containers. That couples things which should have different lifetimes.

```text
more line snapshots -> larger lists and full-session payloads
                    -> more parsing/serialization/render work
                    -> longer input-to-paint time

more side content -> document overflow / wrapping
                  -> changed measured width
                  -> board recalculation and changed wrapping
                  -> visible movement during otherwise ordinary work

snapshot changes -> library guesses which pieces moved
                 -> delayed internal commit / interrupted slide
                 -> logical position, arrows, and visible pieces can be in different phases
```

These are causal models to test, not a claim that a single trace has already attributed every delay. Making buttons smaller would leave all three chains alive.

The evaluated-extension fixture contained **141 serialized move occurrences for 21 distinct move edges**. Branch count grew linearly in this experiment; repeated full prefixes make stored move occurrences grow quadratically as this pattern continues. This explains fast growth without incorrectly calling the measured behavior exponential.

## 4. Recommended shape and serious alternatives

### Selected direction: board with a bounded contextual inspector

The board, player rows, and replay row occupy a stable stage. The inspector is a separate bounded region whose content can scroll. Session identity and the selected line anchor it; task controls follow; detailed position work gets most remaining space. Settings use disclosure instead of permanently competing with the task.

This direction supports repeated moves and comparisons with little eye travel and fits the user's existing preference for an integrated side panel. It also keeps editor tools beside the position instead of making editing a completely unrelated workflow.

### Rival: a three-pane study workbench

A permanent variation tree, central board, and right analysis inspector would make large studies easier to scan. It is a credible direction for a study-first desktop product. At the current range of laptop/split-window sizes, however, it spends too much width before the board and forces more layout mode switches. Use the tree as a view inside the inspector first, with an optional future wide-screen expansion only after the shared state model exists. Do not build a full docking system for this request.

### Rival: board-first fullscreen with tools in a drawer

This maximizes board size and is appropriate as a narrow/short-window focus mode. As the default desktop design it would repeatedly hide moves, evaluations, and comparison context. Adopt it as a fit fallback, not the ordinary work pattern.

Reference research supports mechanisms rather than a copied skin. Lichess's documented study model connects variations, position annotations, and complete PGN output; Chess.com's documented Analysis flow separates interface settings from the analysis task; VS Code's documented workbench separates the primary document from persistent supporting views. These are documentation-based reference inspections, not three fresh live-product usability tests:

- [Lichess study](https://lichess.org/@/lichess/blog/study-chess-the-lichess-way/V0KrLSkA).
- [Chess.com Analysis controls](https://support.chess.com/en/articles/8583825-how-do-i-use-the-analysis-board).
- [VS Code workspace regions](https://code.visualstudio.com/docs/editing/getting-started/userinterface).

Before implementation's visual design gate, render the selected and rival compositions with identical long-game/branch fixtures and inspect them at the target sizes. The browser-control failure during this investigation does not count as that proof.

## 5. Layout contract

### Ownership and fit

Introduce a shared board-workspace owner with explicit board-stage and inspector slots. Give it the space below the actual application bar. Its desktop height is bounded by the viewport, not a minimum height that grows with children.

The board size is:

```text
min(board-column width minus reserved evaluation gutter,
    stage height minus actual player rows, replay controls, and gaps)
```

The measured objects must be explicit refs belonging to this workspace. Remove the generic Grid selector and the unrelated `700`, `150`, and `188` sizing guesses from the migrated routes. CSS should establish the slots before JavaScript measures; measurement should refine a stable reserved rectangle, not determine the entire page after first paint.

Keep `min-width:0` and `min-height:0` through the shrinking grid/flex chain. The inspector uses `auto / minmax(0,1fr)` rows; its active content owns overflow. Reserve scrollbar space where classic scrollbars would otherwise change width. MDN explicitly documents `scrollbar-gutter:stable` as preventing content-growth layout changes; it is one supporting mechanism, not a replacement for correct height ownership. [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-gutter)

### Stability rules

- Side-panel updates cannot change board x/y/width/height.
- Opening Board overlays consumes inspector space; it cannot shrink the board.
- Changing active views or receiving evaluation results cannot alter the surrounding workspace dimensions.
- Player headers have reserved heights; captured pieces and long names cannot add rows beneath the board.
- Keep the evaluation gutter reserved when the bar is hidden so toggling it does not move the chess squares.
- Progress, save status, engine readiness, and errors have defined places. Swap content inside stable status areas; detailed errors can expand within the inspector's scroller.
- Use tabular numerals and reserved score widths. Constrain long PVs, line labels, session names, and imported metadata locally.
- Permit reflow for actual window resize, browser zoom, explicit navigation-rail changes, or an explicit layout change. Avoid accidental resize from content.
- Promotion UI, annotations, and menus must remain correctly layered; do not solve overflow with indiscriminate clipping of the board stage.

### Scroll policy

| Situation | Board and replay controls | Scroll owner |
|---|---|---|
| Normal landscape desktop/laptop | Fully visible in a stable stage | Active inspector body |
| Short but viable landscape | Fit board using real available height; collapse secondary context into summaries | Inspector body |
| Portrait or narrow split window | Board/navigation first; inspector below, or an explicit board/analysis focus switch where it improves fit | Document in stacked mode, or active focused view |
| Enlarged text/zoom or on-screen keyboard | Preserve readable controls and access; choose a fitting composition | Deliberate reflow/scroll fallback |
| Modal, session library, full PGN preview | Underlying workspace stays still | Dialog body |

A literal “never scroll” promise at every imaginable viewport would force tiny controls or hide information. Use fit and usability, not orientation alone, to select fallback. W3C's reflow guidance supports retaining access as content enlarges; board geometry has two-dimensional meaning, surrounding controls still need usable reflow. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

### Proposed Analysis hierarchy

```text
BOARD STAGE                         CONTEXTUAL INSPECTOR
Opponent row                        Session title / save state / session menu
                                    Saved analysis line / variation context
Board + reserved evaluation lane    Game analysis: Load | Analyze line | status
                                    Analyze / Arrange pieces
                                    > Board overlays      2 moves · 1 ahead
Player row                          Position | Moves | Graph
Replay: start / back / play /        ---------------------------------------
        next / end / flip           Active view fills remaining height
                                    and owns scrolling
```

“Game analysis” becomes a compact functional section immediately beneath the saved-line context, above the overlay and mode controls as requested. Its selected-line target is explicit. Loading, analyzing, and completed-report states occupy the same structure. Remove the oversized decorative heading and duplicated large metadata presentation.

The pinned context must stay small. At shorter heights, compact the session metadata and secondary tools before sacrificing the active analysis area. Large optional descriptions belong behind help affordances. Do not make a 300-pixel immovable control header inside a 500-pixel inspector.

## 6. A consistent interaction vocabulary

Consistency means the same purpose gets the same interaction, not that every command and setting must look identical.

| Purpose | Control family | Examples |
|---|---|---|
| Primary operation | One clear rectangular primary action | Analyze line, Start match, Apply position |
| Ordinary command | Compact text/icon button or menu item | Import, Copy, Flip, Backup |
| Mutually exclusive mode | Consistent segmented control or tabs | Analyze/Arrange, White/Black to move |
| Boolean setting | Standard aligned switch/checkbox row | Engine arrows, Missed, Threats, annotations |
| Small number | Compact stepper or select with an explicit label | Moves, Ahead |
| Secondary group | Disclosure row with a readable summary | Board overlays, advanced engine options |
| Information | Plain text/status treatment | Saved, depth, score, report coverage |

Use a common radius, row height, icon size, typography, focus treatment, and spacing rhythm. Start around 36–40 pixels for ordinary desktop controls and larger touch targets where appropriate. Use one visual emphasis hierarchy; active settings should not all become bright pill-shaped calls to action.

Board overlays is collapsed by default. Its summary states the active behavior without opening it. Expansion is a deliberate preference of the view and does not reset on each move. Use compact rows for Moves/Ahead and aligned booleans for Missed/Threats/annotations. Keep a concise legend for the arrows actually displayed. On cramped layouts the same group can open in a fitted popover/sheet; there must be one settings state and one control implementation, not separate competing panels.

Session-wide operations live in the session menu; position operations live in the position menu; export actions have explicit scope. Avoid putting Save, game import, engine display, replay, and branch destruction into an undifferentiated icon row.

## 7. History model: one variation should remain one variation

### Replace snapshot identity with move identity

The durable study model should contain a root and an ordered move tree. A node's identity belongs to its parent and legal UCI move, within a study. Equal final FENs do not merge paths: transpositions can have different repetition history, annotations, and navigation ownership.

Suggested responsibilities:

- **Study/session:** identity, title, original imported source, root FEN, revision, settings references.
- **Move node:** stable ID, parent ID, UCI move, child order, main-child choice, position-derived data/cache references.
- **Annotations:** attached to the correct node/path, with provenance where migration finds conflicting old annotations.
- **Analysis run:** immutable request identity, engine/version/options, target node/path revision, per-position results, completion and coverage. It is not a branch.
- **View state:** current node/cursor, selected continuation, active tab, scroll/expansion/focus state. It is not the move tree itself.
- **Editor draft:** separate editable position and undo history; applying it creates a new root/session while retaining the previous study.

Example:

```text
e4
├─ e5 — Nf3 — Nc6          original main game
└─ c5 — Nf3 — d6 — d4     one alternative, extended in place
```

Adding `d4` to the second path adds a move node. It does not add a second complete `e4 c5 Nf3 d6 ...` branch object. An analysis completion adds results to that path's analysis history. It does not change its branch identity or make it ineligible for extension.

### Behavioral invariants

1. Replaying an existing edge reuses it.
2. Playing a different legal move from an earlier node adds one alternative child.
3. Continuing that child grows the same variation.
4. Analysis success, failure, cancellation, or a changed engine never creates variations.
5. Existing scores survive extension. Mark full-line aggregates with their coverage/revision; calculate new summaries when appropriate instead of deleting old results.
6. Main/source games are not overwritten when exploring alternatives. Keep imported source records independently recoverable.
7. Back/forward is cursor movement, not destructive Undo. Editor Undo is an edit operation. Deleting a variation is explicit and reversible.
8. Branch selection preserves useful position context: retain a corresponding cursor where possible or move to the fork, rather than always returning to the root.
9. Recording off preserves existing saved content. Transient exploration stays visible and exportable, and is clearly identified as not being recorded. Turning recording on captures the intended path once.
10. Async engines publish to immutable study/node/path/request identity. FEN may be a compute-cache key, never the sole publication owner.

### Migration and preservation

Introduce a versioned additive migration. First preserve the original version-one payload as a recoverable record. Build the new tree from each legal full path, map old line IDs to stable path endpoints, and map the selected cursor before switching the active reader. Preserve every distinct analysis run, comments, root metadata, orientation, draft, original PGN, and source identity.

Prefix snapshots are not automatically disposable duplicates. Two snapshots may contain different comments, evaluations, or metadata. Share the move structure while retaining distinct report/annotation provenance and aliases where needed. Do not silently discard conflicting data to make the branch count prettier.

Validate and reread the migrated record before selecting it. Migration must be idempotent and transactionally recoverable. A failed migration leaves the original readable and exportable. Large or malformed studies get an actionable diagnostic; never replace them with a blank session as apparent success.

Persist edit operations/node changes atomically with session revision and relevant summaries. Cursor and presentation updates should not require rewriting every move, PGN, and evaluation blob. Maintain the existing conflict protections. Coalescing view-state writes is acceptable when its durability is explicit; delaying durable move recording while displaying “Saved” is not.

## 8. PGN and clipboard are one export subsystem

Provide explicit operations:

- **Copy line PGN:** the full selected continuation, including its root and relevant headers/comments, regardless of replay cursor or visual truncation. A transient line is still copyable.
- **Copy study PGN / Download study PGN:** the move tree with recursive variations and supported annotations.
- **Copy position FEN:** exactly the visible logical position.
- **Session backup:** complete app-specific state, engine reports, drafts, and recovery metadata that ordinary PGN cannot express faithfully.

All entry points use one exporter per scope. Downloads and clipboard cannot disagree because one reads the main game and another reads the board. Display the scope in the action label or a compact export menu. Zero-move custom roots are legitimate exportable content.

Await clipboard completion, show confirmed success without changing button geometry, and handle rejection/unavailability. Provide a selectable text preview and download fallback. Optional chaining that silently does nothing is not a recovery path.

The importer must parse variation structure separately from chess.js's linear game object. Keep chess.js as the rules engine for validating each path; do not expect its existing load/export cycle to preserve a study tree. Specify comments, NAGs, tags, clocks, Black-root numbering, promotion, results, and unknown metadata deliberately. Preserve original source text where unsupported syntax cannot safely be reconstructed. Require full-fidelity backup for app-specific analysis records.

The earlier preservation scope explicitly excluded imported RAV ingestion. This plan deliberately adopts it as a companion to complete study export; it is expanded scope, not a claim that the earlier work violated its clarified contract. Separate a source game's result/termination from an unfinished alternative. Copying an active line should not imply that the original winner/result describes the newly explored continuation; exporting the complete study must still preserve the original main game's metadata.

Scope and transport are separate checks: the Node probes support selected-line ownership in the tested cases; they do not prove native clipboard success. The reported branch-copy failure remains a runtime reproduction item, with probes that log selected path, export scope, generated text, clipboard result, and focus/secure-context state independently.

## 9. Immediate editing with honest motion

Input should update authoritative draft state immediately. Visual animation should explain that change while storage, validation presentation, and engine work remain outside the first-response path.

Put a board-presentation adapter between domain commands and the rendering dependency. Its input is a semantic transition—move, capture, castle, promotion, add, remove, undo, redo, bulk replace—not merely a new FEN from which a library guesses intent.

For editor placement, the new piece appears immediately and can finish a short entrance animation. For removal, the logical square empties immediately while a noninteractive visual ghost exits. Drag/drop should stay attached to input. Undo/redo should use the inverse transition and retain piece identity through captures, promotions, and castling.

Rapid input needs an explicit interruption rule: finish from the current visual pose toward the latest authoritative state, or apply a deliberate short reconciliation for a large jump. Never queue stale gestures after the user has moved on, and do not use a hidden timer to postpone the logical result. Preserve ordinary move animation duration/easing unless a separate, demonstrated interaction correction requires a different policy. Reduced-motion users get immediate coherent state.

First prove whether a narrow adapter can control the existing board renderer. The installed dependency's timeout and matching logic are a real constraint. If the required add/remove and interrupted-transition behavior cannot be expressed cleanly through supported APIs, replace the presentation boundary while retaining rules, pieces, appearance, drag semantics, and feature data. Do not patch installed node_modules or rewrite the whole application around an untested renderer.

Validate editor positions once per effective draft revision and share the result. Keep permissive incomplete arrangements editable; block only operations requiring a legal game. Pure validation is cheap in the measured fixture, so profile painting, render subscriptions, persistence, and SVG work before adding workers or removing validation.

Add editor-local undo/redo for place, remove, relocate, clear, swap colors, and preset application. Bulk commands are one history step. Preserve raw invalid FEN drafts and restore them predictably; applying/canceling a draft must not silently discard the preceding board.

Resolve the competing FEN/board authority too. A board edit operates on the position actually previewed and regenerates the corresponding FEN in the same edit transaction. A stale raw draft cannot silently override that edit when Analyze/Play/Arena is clicked. If an incomplete text draft is superseded by a board operation, retain it in the editor's undo state and make the resulting field/board agreement visible. Validation, preview, copy, Apply, and handoff all consume the same effective-position contract.

## 10. FEN/PGN setup must drive a shared preview contract

Use the same conceptual position-input state in Play and Arena:

```text
raw text -> empty | valid parsed input | invalid draft
                         |
                         +-> preview position
                         +-> exact Start payload
```

- Empty input immediately means the standard starting position in both the preview and Start operation.
- Valid input immediately drives preview. PGN preview must use the same final/root-position semantics as Start, with an explicit label where needed.
- Invalid intermediate input keeps the raw text and a clearly identified last-valid preview, explains the problem, and prevents starting the wrong position. It must not look like accepted input.
- A handoff initializes the same draft; it cannot remain a hidden higher-priority position after the field is cleared.
- Setup preview is separate from a running match/game. Clearing a setup field cannot reset an active game.
- “Use current position,” “New game,” cancel, and editor handoff have explicit transitions and preserve outgoing work as appropriate.

Audit typed input, paste, clear, imported handoff, browser Back, new game after completion, invalid text, Black roots, and custom move counters in both destinations. Current handoff tests pass; this does not establish setup-preview behavior.

## 11. Arrow meaning across modes

Keep ownership, score rank, and intention independent:

| Channel | Meaning |
|---|---|
| Blue / orange | Side to move / other side on the displayed position |
| Width and opacity | Ranking within the named evaluation source |
| Small role marker / text | Chosen or will-play move, hovered preview, historical feedback |
| Checker and ply labels | Missed move / continuation chronology |

Arena's chosen move must carry its actual candidate rank or an explicit unknown-rank state. A lower-ranked chosen move cannot inherit rank-one styling. When the independent evaluator and bot disagree, label provenance rather than silently comparing incomparable ranks. If two roles use the same path, draw one body and retain both meanings in labels/legend; do not let winner-takes-all merge erase why it is present.

Apply this model to Analysis, Arena, Play hints/coach, and preview boards. Preserve formal-game restrictions and mode-specific preferences. Keep non-color rank cues and a minimum readable candidate strength; progressively reducing opacity cannot make an enabled arrow effectively invisible.

Complete theme-aware contrast handling without bringing back white casing. Test both square colors, composited candidate opacity, checker tones, badges, and each supported hue/theme choice. The previous contrast tests and documentation disagree and must be reconciled to the actual intended algorithm.

Stationary source masks remain active during unrelated motion. Moving-source masks follow the same presentation transaction/pose as the visible piece or use a proven equivalent layering mechanism. Keep annotation icons and all labels above arrow bodies, with an explicit promotion/dialog layer above board overlays. Exercise dragging, capture, promotion, castling, flipping, interrupted undo, and future-line origins; stable screenshots do not prove those cases.

## 12. Visualize as a position action

Expose Visualize in the Position view and the selected-move context menu, alongside a concise explanation of the selected move. It should have a stable location and a meaningful unavailable/loading/error state rather than appear only after a weak grade.

For an existing played move, pin the move and the evaluations immediately before/after it. For a root position with no previous move, offer an explicitly labeled line preview when a legal PV exists. Good and neutral moves need appropriate wording; generalizing access must not reuse “you lost material” framing from a mistake-only story.

Use the existing story player through one shared action that acquires any missing data, cancels obsolete requests, and preserves analysis context. Bind it to immutable study/node/request identity. Closing returns focus and inspector scroll. Playback occurs on a preview board and cannot record variations into the study. “Try this line on board” is a separate explicit command.

Audit the shared story action's Play, Arena, Learn, and Puzzle consumers so a new Analysis entry does not introduce inconsistent eligibility or stale stories. An active Arena pauses appropriately; opening a story in Analysis should not silently start a full-game search.

## 13. Navigation and application chrome

Give replay shortcuts a real owner. Prevent the browser's scrolling default only when replay actually handles the key. Inputs, selectors, menus, dialogs, and native tab interactions retain their keys. Remove blur-as-a-workaround; support visible focus, ordinary Tab traversal, and focus return after menus and stories. Arrow navigation should not compete with the window scroller.

Retain per-view scroll, selected move, tree expansion, and chart state. Lazily initialize expensive views once; pause hidden subscriptions/work rather than destroying every view on every tab switch or keeping every hidden subscription hot. Historical full-line reports should survive switching to live Position analysis.

Make the brand icon and wordmark one accessible Home link; mirror a clear brand destination in compact/mobile chrome. Apply nonselectable styling to navigation labels, icons, toolbars, section chrome, and board notation. Keep PGN/FEN, names where useful, explanations, errors, and exported text selectable. Avoid a global `user-select:none` rule that prevents useful copying.

Menus need individual content decisions:

- **Session:** new/open/rename, Save now, backup/restore, recording behavior, clear alternatives with Undo, session-level recovery.
- **Variation:** select/name, promote deliberately while preserving source, copy line, delete with Undo; show the fork rather than the whole game as its label.
- **Position:** copy FEN, visualize, edit, play from here, send to Arena, start a new analysis from this position while retaining the outgoing session.
- **Export:** line PGN, study PGN, complete session backup, confirmed copy/download outcomes.
- **Board overlays:** presentation preferences only.

## 14. Implementation boundaries and connected slices

Retain Next.js, React, Jotai, MUI, IndexedDB, and chess.js unless a focused feasibility result demonstrates a necessary boundary change. The substantive refactor is ownership and lifecycle. Proposed module names below are responsibilities, not a demand to create every file before a vertical slice works.

| Slice | Responsibility and likely owners | Dependencies | Closing evidence |
|---|---|---|---|
| S0: characterize and protect | Isolated production baseline; synthetic and large saved-session fixtures; existing launch/performance docs; geometry/input traces | Current checkout and known baseline | Reproductions separate app, development compilation, browser driver, and clipboard transport effects; original fixtures backed up |
| S1: workspace and interaction skeleton | Shared BoardWorkspace/BoardStage/Inspector; layout shell, board-size hooks, Analysis composition, control families | S0; comparative rendered directions | Board and replay remain visible; no page scroll in supported landscape fit; stable rectangles through inspector changes; keyboard works |
| S2: one coherent study journey | Study/history commands, node/path identity, result ownership, incremental persistence, versioned migration; adapt sessionAtoms/sessionPanel | S0; S1 slots and view state | Import -> diverge once -> extend -> analyze -> extend -> replay -> reload retains one logical variation and prior results |
| S3: complete export/import journey | Shared export service and clipboard feedback/fallback; tree-aware PGN reader/writer; preserve backup format semantics | S2 identities and migration | Selected line and all-variation scopes round-trip, native copy outcomes visible, zero-move roots retained |
| S4: editor and motion journey | Board presentation adapter, editor command history, shared validation result, immediate logical state; renderer feasibility slice | S1; S2 root/session boundary | Place/remove/move/undo/redo immediately responds; motion is continuous under rapid input; apply/handoff preserves state |
| S5: setup journey | Position-input parser/state/preview contract in Play and Arena; imported handoffs and active-game boundaries | S4 effective-position contract | Type/paste/clear/invalid/Start agree on the visible position in both modes |
| S6: explanation and arrow journey | Shared move-story action, score-rank/intention/provenance metadata, merge/legend/masks, restored Top moves access | S2 node identity; S4 presentation transaction | Analysis -> Visualize -> return; Arena weaker chosen move differs from best; interaction layering remains correct |
| S7: final connected QA and reconciliation | Performance traces, long-data tests, migration recovery, accessibility, source documentation | S1–S6 | Original complaints and neighboring consumers pass realistic journeys; evidence and docs match final behavior |

S1 should provide early visible improvement without waiting for the whole history migration. S2 and S3 must land as a connected capability so an attractive branch UI does not conceal incomplete exports. S4 must prove its presentation boundary before a renderer replacement spreads through shared boards. Each slice remains reviewable and reversible.

Shared-board consumers to name explicitly in regression work: Analysis, Arrange/Editor, Play, Arena, Puzzles, Openings. Shared layout additionally serves Vision. MiniBoard consumers include Move Story, Settings, Scan, Endgames, and Import. These do not all receive the full inspector redesign; each needs checks for the specific shared behavior it inherits.

### Consequential connections

| Trigger/source | Owner and required next response | Failure/recovery and proof |
|---|---|---|
| Play a move or accept a PV | Study command resolves/reuses node -> board transition, view cursor, independent engine request, durable edit transaction | Illegal/stale PV cannot partially mutate; failed save retains visible work and truthful status; test delayed callbacks and reread |
| Complete a line analysis | Analysis-run owner stores results against target path revision -> coverage, grades, graph, story eligibility | Cancellation/changed path cannot overwrite another line; previous results remain recoverable; no variation creation |
| Navigate or select a variation | Cursor/continuation owner -> position, selection, legal advice, annotation context, export target | Missing node falls back visibly without destroying data; Back/Forward preserves selected route; test transpositions and restore |
| Edit raw position text | Position-input owner -> effective preview, validity, copy payload, Apply/Start payload | Invalid text remains editable, previous preview is identified; clear uses standard setup root; test both destinations and editor |
| Change an overlay setting | Per-mode preference -> shared composition -> board and legend | Unsupported/formal advice stays unavailable; updates never resize board; test all shared consumers |
| Copy/download | Scoped exporter -> complete serialized content -> confirmed clipboard or downloadable/selected-text fallback | Failure never reports success; native transport and structural output tested separately |
| Open Visualize | Pinned move/path/request -> isolated story data/player -> explicit return or Try line command | Stale request cannot retarget story; preview creates no history; focus/cursor/scroll preserved |
| Apply edited root or cross-mode handoff | Effective position -> destination-owned handoff -> setup/session preview | Outgoing study retained; handoff cannot win over a subsequently cleared field; test exact FEN and counters |
| Reopen/migrate/save concurrently | Storage revision owner -> validated new reader state and summaries | Preserve old payload, conflict recovery, and interrupted-migration rollback; direct storage reread and second-tab checks |

### Documentation ownership

`docs/analysis-preservation.md` and README should own the revised recording, migration, backup, and export contract. `docs/engine-arrows.md` should own actual rank/intention/contrast semantics and must stop naming nonexistent implementations. `docs/arena-analysis.md` should cover evaluator-vs-proposal provenance. `docs/wrong-side-followup.md` remains historical evidence for the async ownership safeguards; update current contracts without erasing why those safeguards exist. The performance reports remain historical baselines, with a new dated measurement/reconciliation section for this work. This plan stays outside the repository until implementation/documentation editing is authorized.

## 15. Acceptance and measurement

These are proposed delivery gates, not measurements already achieved.

| Area | Required checks |
|---|---|
| Geometry | At representative 1280×720, 1366×768, 1440×900, and 1920×1080 landscape viewports, board and replay fit without window scrolling. Compare board rectangles before/after moves, captures, status changes, overlay expansion, tab changes, report completion, long labels, and errors; no content-driven delta beyond subpixel rounding, provisionally 0.5 CSS px. |
| Fit boundaries | Test 1024×768, portrait 768×1024, 390×844, narrow split windows, very short landscape, browser zoom and 200% text. Choose a deliberate fallback before controls become illegible or inaccessible; avoid resize breakpoint oscillation. |
| Scrolling/focus | Wheel over inspector scrolls its content; board stays fixed; no accidental scroll chaining into the document. Dialog scroll and focus are local; Escape returns to the opener. Keyboard replay does not scroll the page. |
| Variations | Existing child reuse, one alternative then many moves, repeated analysis between extensions, sibling and nested alternatives, transpositions, off/on recording, selected line change, comments, delete/Undo, fresh reopen. Count logical alternatives and move nodes separately. |
| Persistence | Reread complete records after save/reload. Validate source preservation, migration idempotence, duplicate/prefix snapshots with conflicting annotations, large studies, write refusal, stale cross-tab revision, interrupted migration, backup/restore. |
| Exports | Check generated content, actual clipboard success/failure, preview fallback, download, import round-trip, external PGN consumer, Black-root counters, underpromotion, comments/NAGs, zero-move FEN, all variations and transient selected lines. UI render caps never cap output. |
| Editor/motion | Pointer and keyboard placement, erase, drag, off-board removal, bulk presets, swap, orientation, undo/redo, rapid repeats, capture, castling, promotion, reduced motion. Observe frames; final-state assertions alone are insufficient. |
| Performance | Separate cold route compilation/download from warm tab switching. Record input dispatch -> authoritative state -> React commit -> first visible response, long tasks, render counts, storage payloads/queue, engine publications, and worker lifetimes. Profile production on isolated data. |
| Targets | Provisional warm local visual acknowledgement under 50 ms where feasible, visible response under 100 ms, warm inspector switching under 100 ms, no recurring >50 ms main-thread tasks for ordinary edits. Use enough repeated samples to report meaningful distributions and disclose hardware/fixture. Treat INP ≤200 ms as the broader responsiveness target, not proof that every action takes 200 ms or less. |
| Arrow semantics | Actual rank vs chosen move, equal-score ties, unknown rank, independent engines disagreeing, hover, master-off, mode restrictions, turn flip, board flip, both square colors, opacity composition, source masking during motion, annotation/badge collision, promotion UI. |
| Explanations | Weak/good/best/unclassified move; no previous move; missing/stale eval; engine error/retry; branch/session change while loading; playback never records study moves; return preserves cursor/tab/scroll. |

The INP threshold is grounded in [web.dev's guidance](https://web.dev/articles/optimize-inp). The tighter local acknowledgement and warm-tab figures above are design targets to calibrate on the actual baseline, not externally mandated thresholds or current performance claims.

Preserve engine quality and ordinary animations. If profiling finds CPU/memory oversubscription, coordinate budgets across independent engine jobs while retaining separate cancellation ownership. Do not merge features into one shared mutable search instance or disable features to make a benchmark pass. Do not repeat the earlier optimization work from historical reports without checking that its mechanism is still present and relevant.

## 16. Reviews and corrections made while forming this plan

These are direct reviews by the investigating agent, not independent-agent sign-offs.

### Outward and detail return

Question: would reorganizing the Analysis panel solve the actual complaint? Rival: most symptoms are independent small UI defects. Inspecting sizing, complete-line persistence, and the installed board renderer identified separate owners with reinforcing effects. Correction: split the plan into workspace, history, and presentation boundaries; keep a shared interaction vocabulary across them. Whole-product judgment: the selected inspector direction is useful only with stable geometry and correct history ownership.

### General review 1: missing routes

Counterexample: a new tree exports branches, but loading its PGN removes them. The installed importer probe demonstrated exactly that failure. Correction: bind tree-aware import and export in S3, preserve raw source and backup semantics, and test an external consumer. Add zero-move custom roots and clipboard failure paths. Returned judgment: export is now a full journey rather than a renamed Copy button.

### General review 2: consequences of preservation

Counterexample: deduplicating prefix snapshots makes a shorter branch list but loses an earlier completed report or conflicting comment. The evaluated-extension probe and existing preservation contracts show why the current code froze lines. Correction: retain immutable report/annotation provenance while sharing move structure; preserve migration aliases and original payloads. Returned judgment: the new model solves branch growth without undoing the previous data-preservation work.

### General review 3: limits of no-scroll and immediate response

Counterexample: a strict no-scroll desktop shell at high zoom clips controls; eliminating the editor timer by turning off all motion makes undo faster but worse. Correction: add fit-based stacked/focus modes and a semantic presentation transaction; distinguish immediate logical response from the duration of its explanation. Returned judgment: stability and animation quality reinforce each other instead of becoming competing shortcuts.

### UX detail return

The proposed hierarchy originally risked replacing one tall static inspector with another tall pinned header. Correction: cap context to compact identity/line/action rows, collapse secondary settings, and include a short-height context summary. A generic “nonselectable app” would break useful copying; scope selection policy to chrome. Removing focus would conceal shortcut ownership defects; retain native focus and fix dispatch. Actual comparative appearance and motion still require rendered inspection before implementation's visual gate.

### Logic and timing return

A node keyed only by FEN would merge transpositions. A Visualize preview that reuses active study commands would record playback as branches. A setup parser that mutates the match game would reset active play when text is cleared. Corrections: parent/path node identity, preview-only story state, and separate setup/game state. All async requests retain immutable owners through cancellation, error, cleanup, and return.

### Risk return

The most consequential risks are migration fidelity, interrupted motion, false performance attribution, and clipping at fit boundaries. Each has an explicit probe and delivery gate above. The local editor-validation benchmark defeats the easy assumption that validation is responsible for the reported slowness. The failed browser attach defeats any claim of a new live UI latency measurement. These boundaries are carried into S0/S4/S7 rather than written away as product defects.

## 17. Investigation ledger and evidence limits

The record below distinguishes completed investigation from planned implementation. Original reports describe historical outcomes; they are not current delivery proof. The current Followable Project Protocol informed the intent/domain/experience/ownership/recovery/proof sequence; existing project documents were treated as contracts to reconcile, not immutable architecture.

| ID / status | Question, reason, and prerequisite | Artifact, rival, and action | Observation/result; evidence; next item |
|---|---|---|---|
| R0 completed | Establish request and ownership before prescribing changes; prerequisite: full chat | Current git status/history, protocol, preservation/performance docs; rival: earlier arrow plan is sufficient | Scope expanded to workspace/history/editor consistency; read-only boundary retained; snapshot `c6cbf0f`; unlock R1–R5 |
| R1 completed at source level | Explain fit and shifting; prerequisite R0 | Shell, viewport hooks, Board, Analysis composition; rival: only a scrollbar style is wrong | Separate sizing and unbounded content mechanisms found; exact shuffle trace remains S0; Sections 2/5; unlock layout model |
| R2 completed with qualified reproduction | Explain branch growth and copy ownership; prerequisite R0 | Session model/atoms, clipboard/export, loader, existing tests; rival: ordinary append always duplicates | Ordinary line stayed one branch; evaluated extensions accumulated snapshots; active-line selection passed; RAV lost; JSON evidence; unlock Sections 7/8 |
| R3 completed at source/probe level | Explain editor delay and undo; prerequisite R0 | Installed library position effect/piece matching, editor validation; rival: validation dominates | Hidden wait and cancel/snap mechanism confirmed; pure validation cheap; live paint unmeasured; unlock presentation model |
| R4 completed at source/probe level | Explain Arena ranking and setup mismatch; prerequisite R0 | Proposal producer/styles and Play/Arena input/game owners; rival: colors alone are wrong | Planned rank-four equals best style; setup is not a board preview; JSON and source; unlock Sections 10/11 |
| R5 completed at source level | Find adjacent navigation/feature access gaps; prerequisite R0 | Visualize gate, key handlers, tab lifetimes, menus/chrome; rival: feature absent | Feature exists but constrained; replay default scroll not suppressed; root jumps and unmounted views found; unlock Sections 6/12/13 |
| R6 blocked for fresh browser observation | Obtain live geometry, clipboard, and paint evidence; prerequisite R1–R5 | Existing IAB browser and isolated loopback editor origin; rival: source defect vs automation failure | Browser webview failed to attach, as in earlier review; no live failure attribution made. Node/source routes used instead. Live checks remain explicit S0/S7 prerequisites |
| R7 completed as proposal | Connect owners, migration, recovery, consumers, and proof; prerequisite R1–R5 | This document and source/probe evidence; rival shapes in Section 4 | Selected stable-stage/inspector direction with bounded shared refactors, not UI-only patches; unlock R8–R10 |
| R8 completed as paper review | Attack missing routes; prerequisite R7 | Import/export scopes, actual RAV probe, zero-move/transport cases | Added two-way tree PGN and fallback; Section 16 review 1; unlock R9 |
| R9 completed as paper review | Attack consequences of preservation; prerequisite R8 | Evaluated-prefix growth and legacy backup policy | Added report/annotation provenance and recoverable migration; Section 16 review 2; unlock R10 |
| R10 completed as paper review | Attack fit, motion, and timing claims; prerequisite R9 | Extreme sizes, dependency interrupt behavior, unavailable live measurement | Added deliberate reflow, semantic motion and measurement boundaries; Section 16 review 3 and risk return; unlock proposed S0 |
| S0–S7 planned | Implement and prove the connected journeys only after implementation authorization | Named owners/dependencies and individual checks in Sections 14/15 | No source changes made; no implementation or production gate is being marked complete |

Executed evidence:

- `workspace-audit-probes.mjs` and `workspace-audit-evidence.json`: source-level branch, export-selection, PGN-import, validation, replay-scaling, and arrow-style experiments on synthetic in-memory data.
- `node --import ./tests/register.mjs --test tests/analysisSession.test.ts tests/rememberExtension.test.ts tests/handoff.test.ts`: **24 passed, 0 failed**, four suites, during this investigation.
- Earlier full run on this same checkout: **499 passed, 3 failed**. Two contrast assertions and the older one-move-default assertion remain distinct from the new findings. It was not rerun unnecessarily for this source-unchanged planning turn.
- An earlier lint/type-check run passed. The later full lint rerun did not produce a completed result in the captured log; do not report it as a pass. No new production build was run beside the user's active development server.
- Fresh browser geometry, native clipboard, paint timing, motion recordings, target-size screenshots, and independent native Reckless transport were not established here. These are execution proof requirements, not claims supported by the Node fixtures.

## 18. The first implementation milestone

The first reviewable result should be an isolated populated Analysis workspace with stable board/navigation geometry, compact ordered context, consistent controls, and local inspector scrolling. In parallel with that design slice's feasibility checks, settle the versioned history/export contract on synthetic sessions. Demonstrate one real journey: load a game, change one move, continue the alternative, analyze it, continue again, copy it, replay it, and reopen it—with the board staying in place and the variation remaining one logical variation.

That journey is the acceptance center of the redesign. Additional controls, the editor, Arena, setup previews, and Visualize must connect to those owners and retain their own proof; none should become another isolated patch bolted onto the panel.
