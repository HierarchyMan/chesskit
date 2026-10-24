# Engine arrows

How the arrows on the Analysis, Play and Arena boards are decided, drawn and
tuned, and where the numbers in the code come from.

## Principle

Everything that changes what the engine's arrows show belongs to the user, so
none of it is fixed in the code that uses it. There are three layers:

| Layer                 | Where                    | What                                                                                                                  |
| --------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| What is on            | the board overlay        | master switch, **Moves**, **Ahead**, **Missed**, **Threats**, one set per mode. Beside the Analysis board it is the inspector; elsewhere a summary above the board opens the same controls |
| How the arrows decide | Settings → Arrows        | wait-for depth, which grade earns a better-move arrow, threat sensitivity, threats shown, threat search depth         |
| Which engine          | Settings → Engine        | one engine for threats, Play suggestions, the Play coach and Arena evaluation, each defaulting to the analysis engine |

The defaults live in one place each (`lib/arrows/prefs.ts`, `lib/arrows/tuning.ts`,
`lib/engine/featureEngines.ts`), and the functions that need a value take it as
a parameter.

## Modules

- `lib/arrows/` is pure and has no React: `types` (the arrow, its kind and its
  focus), `geometry` (board units, one silhouette per arrow, knight elbows,
  opposite arrows parting, badge corners), `style` (hue, width, checker, and the
  per-theme owner tones), `contrast` (the tone adaptation), `source` (the piece
  an arrow starts from), `merge` (one arrow per pair of squares, carrying every
  ply number), `engineArrows` (arrows from an evaluation), `legend`, `prefs`
  and `tuning`.
- `components/board/arrowLayer.tsx` draws them as one SVG over the board, outside
  the chessboard library's element, so the board-hue filter never touches them.
  Each arrow is one filled silhouette; a missed move is a checker of two tones of
  its hue; an arrow whose piece stands on its origin passes behind that piece
  only (a per-arrow mask of that piece's silhouette). Labels are painted after
  every body. The move-quality mark is a board-level overlay above them
  (`moveQuality.tsx`), not part of a square.
  `useInkArrows` is the user's own drawing; `useEngineArrows` composes
  everything a board shows; `arrowOverlay` is the controls and legend, either
  the Analysis inspector or the compact popover.
- `hooks/useThreats` and `hooks/usePositionEval` each run on their own engine
  instance (`useFeatureEngineName`), so one feature can never cancel another's
  search.

## What an arrow says

Three questions, three channels. Who moves is the hue: blue is the side to move
on the displayed position, orange the other side. Flipping the board never
changes it, and neither does which colour you play. When is the line style (solid
for a move to play now, numbered for a later move of the line, checkered for the
move that should have been played). How strong is the width, which falls with
rank. A threat carries a "!".

There is no outline. A saturated hue alone cannot reach 3:1 against both squares
of every board theme, so each theme darkens the blue and orange just far enough
to reach 2:1 against its own darker square (`contrast.ts`, `style.ts`). The hue
is kept; the tone is the only thing that changes. The user's own colours are
adapted the same way, while the page's rgba training colours are left exactly
as authored. `tests/arrowContrast.test.ts` keeps each theme honest.

An arrow is drawn behind its own piece and above every other piece. The cut is
the piece's silhouette only, and only when the piece is the one making the move
on the displayed board: a line move from a square a piece left earlier in the
line, or a missed move whose origin the played move vacated, is never cut.

## Threats

A threat is what the opponent gains by moving first. The source is the one
Lichess and ChessBase use: hand the turn to the opponent (swap the side to move,
clear the en passant square) and search. Like Lichess, nothing is searched when
the mover is in check, or the game is over.

Lichess then draws the opponent's best move whatever it is. Here a move is kept
only if it gains the opponent enough winning chances over the position as it
stands (`THREAT_GAIN`), which is the filter the references do not publish and
the part that is ours. The evaluation already counts recaptures, pins and mates,
so a defended piece is not flagged and no static rule is needed. Further lines
are kept only when about as strong as the first (within 10 points, as Lichess
draws alternative lines within 0.2 of its winning-chances scale) and when they
do not merely keep the first threat alive.

`scripts/verify-threats.mjs` measures the sensitivities on every engine the app
offers. Positions are sorted by a static check that does not use the engine
(a piece worth a knight or more that can be taken for less than it costs;
attacked but adequately defended; nothing attacked), on the bundled opening
lines and a few plies off them. The check is crude, so read the false alarms as a
trend; some are threats the engine is right about.

| Sensitivity | Points | Real threats flagged | Others flagged |
| ----------- | ------ | -------------------- | -------------- |
| Cautious    | 25     | 79–89%               | 7–10%          |
| Balanced    | 15     | 89%                  | 13–17%         |
| Alert       | 8      | 96–100%              | 27–38%         |

The sample is the same for every engine: 47 real, 208 attacked-but-defended and
40 quiet positions. Ranges are across nine engines: Reckless and eight Stockfish
builds (18, 17.1, 17 and 16.1, each full and lite). The three sanity positions,
whose threat certainly costs material (a mate in one, a queen attacked by a pawn,
an undefended knight attacked by a pawn), gain 39–52 points on every engine.
Stockfish 16, 16 NNUE and 11 do not start under Node and were not measured. The 16.1
Lite and 17 Lite builds give the same search output node for node, so they are
one result counted twice, not two.

## Waiting for depth

The first iterations of a search jump between moves. `scripts/measure-arrow-depth.mjs`
measures, per engine, how often the best move at depth d is a move the final
search rates within 30 centipawns of its best ("sound"), and how often it is the
final move and never changes again ("stable"). Stable stays low even deep, since
many positions have near-equal moves, so waiting alone cannot stop every swap;
sound is what keeps an arrow from being wrong.

The default is 9. It is the lowest depth at which the drawn move is sound in at
least 92% of positions on every engine, measured on 60 positions spread over the
bundled opening lines, with the answer taken at depth 16:

| Depth | Best move is sound | Never changes again |
| ----- | ------------------ | ------------------- |
| 6     | 78–90%             | 20–27%              |
| 8     | 88–95%             | 23–32%              |
| 9     | 92–93%             | 28–35%              |
| 10    | 90–98%             | 28–38%              |
| 12    | 97–98%             | 33–52%              |
| 14    | 97–100%            | 50–67%              |

Because the depth to wait for is set in Settings, a user who prefers steadier
arrows can raise it, and one who wants them sooner can lower it.

## Play

Suggestions and threats are advice about a move you have yet to make, so they
are searched only on your turn, on the engines chosen for them, and a formal game
offers none (its bar has only **Missed**). The coach grades your move; its better
move stays on the board through the bot's reply, while you decide again.
Nothing is loaded until you switch a feature on, and an engine stays loaded for
as long as the setting does, not for as long as it is your turn.

## Running the checks

```
node --import ./tests/register.mjs scripts/verify-threats.mjs
node --import ./tests/register.mjs scripts/measure-arrow-depth.mjs
```

Both run on every engine by default; `ENGINE=stockfish_17_lite,reckless` narrows
them (`scripts/lib/uciProcess.mjs`), and `LIMIT`, `DEPTH` and `FINAL` change the
sample and the depths.
