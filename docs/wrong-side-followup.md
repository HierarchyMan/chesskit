# Wrong-side suggestions: final review and verification

2026-10-22. Repository: `C:\Users\cystol\Projects\chess\chesskit`.
Branch verified: `expansion/hub-and-modes`. Changes remain uncommitted and unstaged;
no commit or push was performed.

## Review outcome

Reviewed the existing shared-tree implementation against the requested behavior
and all three subagents' returned changes. Kept their changes. The initial 12
modified files and two new files were preserved before this follow-up under the
ignored `.performance/wrong-side-followup/initial-*` snapshots. The original
`currentPosition.ts` and `wrongSideSuggestions.test.ts` still match those snapshots
byte for byte. Existing tests were retained; retrospective best-move tests now
exercise the explicitly historical helper.

Current-turn suggestions belong to the displayed position and current mover.
Opponent top moves remain available as an explicit what-if on the position where
they were requested. Previous-move coaching remains available with player/move
context. Both Analysis and Arena keep the best-move toggle on by default.
Remember off stops new recording and keeps all stored lines and evaluations.

## Bugs, causes and fixes

| Area | Root cause | Final behavior and regression proof | Status |
| --- | --- | --- | --- |
| Best-move arrow and Arena recommendation | Shared helper read `lastEval.bestMove`, which is the previous turn's alternative, and drew it on the current board. | Shared current-turn helper reads the current evaluation/PV, validates legality against its FEN, and returns no stale, illegal, wrong-side or terminal suggestion. Arena text names the current mover. `currentTurnBestMove.test.ts` covers White/Black, initial position, grades, PV fallback, malformed output, promotion and stale snapshots. | Fixed |
| Historical move coaching | The retrospective recommendation looked like current advice; Analysis also gated grade/Visualize behind the previous `bestMove`. | Historical text names the player and numbered played move, using muted history styling in Analysis and explicit previous-move context in Arena. Grades and Visualize remain available without `bestMove`. Existing `bestMoveHint.test.ts` preserves retrospective coverage; `currentTurnBestMove.test.ts` covers the missing-bestmove gate. | Fixed |
| Play and Analysis opponent top moves | A bare relative `opponent` selection survived position changes and could silently change color or revive on undo. FEN alone cannot distinguish paths or new games. | Choices bind to FEN plus full root/move path and session/game identity. Leaving a position retires the relative choice, including while the panel is closed. Explicit opponent what-if is retained. `playHintSide.test.ts` covers moves, return/takeback, another path at the same FEN and new games/sessions. | Fixed |
| Stale top-move lists and candidate arrows, including Arena | Effect-driven refresh left old results/arrows visible for a new board; delayed callbacks or cleanup could publish with no source identity. Illegal first PV moves were displayed as raw UCI. | Request snapshots include immutable query context and are rejected at render time and on partial/final/error publication. Arrow atoms enforce source path identity on reads and writes, including cleanup. Illegal first moves are discarded before ranking/limiting; later invalid PV suffixes still retain valid prefixes. `playHintSide.test.ts` covers request lifetime and Play/Analysis arrows; `currentTurnBestMove.test.ts` covers actual Arena arrow atoms. | Fixed |
| Live-to-full engine evaluation | `evaluateGame` reconfigured a live worker and replaced its listener without waiting for the old search's `bestmove`. UCI `readyok` may arrive while searching. A late cloud result could also revive when the engine became ready again. | Invalidate live generation, await pending live setup, then stop/drain live searches before full-game setup or FEN dispatch. Failed drains reject without dispatching new positions. `fullGameSearchIsolation.test.ts` covers early-ready fake engines, two workers, pending setup, delayed cloud and stop failure. | Fixed |
| Remember continuation preservation | Extension updated the first matching stored prefix in place and set its evaluation to undefined, overwriting main or evaluated branches. | Preserve every nonempty main and evaluated branch; create a separate continuation. Grow the most specific unevaluated continuation without a branch per ply. A pristine empty main may seed an invented game. `rememberExtension.test.ts` covers source PGN/metadata, evaluation, sequential invented moves, evaluated empty roots, branch selection, navigation, off/on and backup/reload. | Fixed |
| Existing snapshot/history fixes | Effect-owned current-position snapshots could be one render behind; raw FEN header roots differed from normalized chess.js replay roots. | Kept FEN-stamped snapshots and `positionFor` consumers, plus normalized `chessPath` roots. Existing `wrongSideSuggestions.test.ts` verifies wrong-turn suppression and custom-root start/next navigation. | Preserved and passing |

## Independent review record

The primary agent inspected the subagent source diffs and tests before accepting
them. Arrow/Arena ownership, Play/shared top-move ownership and engine/Remember
ownership were reviewed separately. Directed consumers were checked from engine
output through snapshots, text, arrows, board state and navigation. Counterexample
reviews included same-FEN transpositions, returning to an earlier position,
old-callback cleanup after a new publication, pending setup, early readyok,
late cloud completion and evaluated-source extension.

Feature checks retained candidate/manual moves and arrows, explicit opponent
what-if, retrospective coaching, move grades, Visualize, independent option
preferences, navigation, session backup/reload and source evaluations. The smaller
alternative of patching a single Black suggestion would leave these ownership
boundaries inconsistent. Product copy and preservation documentation now agree
with the implemented current-versus-historical distinction.

## Final automated results

All commands ran after the final source/test edits in this follow-up.

| Command | Result |
| --- | --- |
| `npm test` | 439 tests passed, 0 failed; 98 suites; 0 cancelled, skipped or todo. Baseline was 407 passed, 0 failed. |
| `npm run lint` | Exit 0. ESLint and `tsc --noEmit` passed; 0 reported errors or warnings. |
| `npm run build` | Exit 0. Compilation and TypeScript passed; 15/15 static pages generated and exported; 0 build errors. |
| `git diff --check` | Exit 0; no whitespace errors. Git reports local LF/CRLF conversion notices. |

Build emitted two nonfatal Sentry warnings: no auth token for release creation or
source-map upload. No token or publication configuration was changed. Logs are in
`.performance/wrong-side-followup/final-{tests,lint,build}.log` (ignored scratch
output). The five requested regression files contain 37 tests; 32 were added by
this follow-up and five belonged to the preserved initial audit.

## Production browser verification

Served the completed production export from `out` using `scripts/serve.mjs` at
`http://127.0.0.1:3012`. Used a temporary in-app browser tab and fresh localhost
origin. This was the built application, not the user's development server.

- Analysis: invented `1. e4 c5` with Remember on. White-to-move top moves were
  Nf3/Nc3/Ne2, with arrows originating from White pieces. Both current-side engine
  lines and the explicit Black what-if worked. Previous/next navigation retired
  the Black what-if; returning showed White's current-turn list again.
- Analysis navigation/Remember: remembered branch survived previous/next and
  start/final. With Remember off, a new Nf3 was not stored; Previous returned to
  the saved endpoint and Next was disabled there. Existing saved lines stayed.
- Full analysis/extension: full-game analysis completed with real Stockfish.
  Evaluated the main `e4` line, extended it to `e4 e5` with Remember on, and saw a
  separate Branch 2. Selecting main and reloading retained the `e4` main line,
  96.6% White accuracy, 2777 rating and Analyze again state. The earlier `e4 c5`
  branch also remained available.
- Arena: with browser Stockfish engines, manually played `1. e4 c5`. The option
  text read White to move: Nf3 and the green arrow originated at White's g1 knight.
  Take back correctly returned to Black's turn and Black's proposal; Next played
  the current Black proposal and restored White's recommendation. Candidate
  arrows, annotations, opening, accuracy and best-move toggle off/on remained.
- Play: started a casual game, opened hints and saw White's moves. Explicit Black
  what-if remained labeled. After e4, hints became Black-to-move; after the bot's
  d6 reply they became White-to-move (d4/Nf3/Ne2) with White arrows. Selecting the
  what-if again and taking back reset to White's starting-position hints.

Four screenshots were captured, visually inspected, then deleted as requested:
Analysis current turn, retained main evaluation, Arena current turn and Play hints.
The task-owned `wrong-side-qa` scratch directory was verified empty. The temporary
QA tab was closed and its port-3012 server stopped. The pre-existing development
server was left running.

Not verified: deployed production, other browser/device layouts, mobile/keyboard
journeys, real Reckless integration (its local bridge was unavailable), or forcing
real Stockfish to emit the adversarial early-ready timing. That scheduler timing,
evaluated-branch continuation and same-FEN race permutations have deterministic
automated coverage, not separate exhaustive browser reproduction. The only
captured browser console error was the unavailable Reckless bridge on Arena setup;
subsequent verification used browser Stockfish engines.

## Changed-file inventory

Paths below are relative to this repository and include the preserved initial
changes as well as this follow-up.

- Shared board/snapshot/history: `src/components/board/evaluationBar.tsx`,
  `src/components/board/index.tsx`, `src/hooks/useGameData.ts`,
  `src/lib/currentPosition.ts`, `src/lib/chessHistory.ts`, `src/types/eval.ts`.
- Arrow/coaching: `src/lib/bestMoveHint.ts`,
  `src/sections/analysis/panelBody/analysisTab/moveInfo.tsx`,
  `src/sections/analysis/panelBody/analysisTab/analysisOptionsCard.tsx`.
- Shared top moves: `src/components/topMovesPanel.tsx`, `src/hooks/useTopMoves.ts`,
  `src/lib/engine/topMoves.ts`, `src/lib/engine/topMovesRequest.ts`.
- Analysis consumers/state: `src/sections/analysis/hooks/useCurrentPosition.ts`,
  `src/sections/analysis/panelBody/analysisTab/engineLines/index.tsx`,
  `src/sections/analysis/panelBody/topMovesSection.tsx`,
  `src/sections/analysis/sessionAtoms.ts`, `src/sections/analysis/states.ts`.
- Arena: `src/pages/arena.tsx`, `src/lib/engine/arenaAnalysis.ts`,
  `src/sections/arena/analysisCard.tsx`, `src/sections/arena/sidePanel.tsx`,
  `src/sections/arena/states.ts`, `src/sections/arena/useArenaAnalysis.ts`.
- Play: `src/sections/play/gamePanel.tsx`, `src/sections/play/states.ts`.
- Engine/session: `src/lib/engine/uciEngine.ts`, `src/lib/analysisSession.ts`.
- Tests: `tests/bestMoveHint.test.ts`, `tests/currentTurnBestMove.test.ts`,
  `tests/playHintSide.test.ts`, `tests/fullGameSearchIsolation.test.ts`,
  `tests/rememberExtension.test.ts`, `tests/wrongSideSuggestions.test.ts`.
- Documentation: `README.md`, `docs/analysis-preservation.md`,
  `docs/arena-analysis.md`, `docs/wrong-side-followup.md`.
