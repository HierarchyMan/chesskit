<div align="center">
  <img width="120" height="120" src="public/android-chrome-192x192.png" alt="Chesskit logo">

<h3 align="center">Chesskit</h3>
  <p align="center">
    A free, open-source chess trainer and analysis board that runs in the browser
    <br />
    <a href="https://chesskit.org/" target="_blank" rel="noopener noreferrer"><strong>chesskit.org</strong></a>
  </p>
</div>
<br />

Chesskit lets you play, study, analyse and review chess with Stockfish on any device. This fork extends the original [Chesskit](https://github.com/GuillaumeSD/Chesskit) with a hub, training tools and an engine arena. Everything runs locally in your browser.

<img src="assets/showcase.png" alt="Analysis board with engine evaluation" />

## Features

**Play**
- Play against Stockfish at any Elo from 400 to 3200, at a fixed depth, or at full strength.
- Casual games offer hints, takebacks and an optional coach. Formal games give no advice before a move; the coach can still grade a move after you make it.
- **Arrows** under the board show what the engine suggests while you play (off by default), a dashed arrow for the better move after one of yours, and the opponent's threats. See *Engine arrows* below.
- Odds, clocks, resign and draw offers.

**Analyse**
- One board for analysis and the board editor: arrange any position, then play moves on it.
- Live engine evaluation with top moves for either side, your own arrows and an evaluation graph.
- **Analysis options** on the Analysis tab toggle the evaluation bar and move annotations. Engine arrows have their own controls under the board (see *Engine arrows*). Choices are remembered in this browser.
- Move classification (Brilliant, Great, Good, Mistake, Blunder, ...).
- Load games from [chess.com](https://chess.com) and [lichess.org](https://lichess.org), or paste a PGN, a FEN, a Lichess link or a screenshot of a board (`Ctrl+V` on any page).
- **Scan Image** turns a photo or screenshot of a board into a position, entirely in your browser.
- **Visualize**: for any move that is not best or excellent, a pop-up walks through the moves that follow (2 to 10 plies, depending on the evaluation).

**Engine Arena**
- Pit two engines, or two strengths of one engine, against each other. Step through with *Next*, nudge a move by clicking a candidate or dragging a piece, or let them auto-play.
- Use **Analysis options** in the side panel to independently toggle the evaluation bar and move annotations, and the bar under the board for the engine's moves. Choices are remembered in this browser. With annotations on, the panel also shows the opening, each side's accuracy and explicitly labeled previous-move feedback. The arrow and its recommendation describe the side to move on the current board.
- An independent instance of the Arena evaluation engine (the analysis engine unless you choose another in Settings) checks moves at depth 12. Annotations grade both players' moves on the board and in the move list; select any move for its explanation and **Visualize move**. Enabling annotations mid-game also checks earlier moves. Analysis can catch up during fast auto-play; it does not control the players' moves.

**Engine arrows**
- A bar under the Analysis, Play and Arena boards: a master switch (`A`), **Moves** (how many of the engine's best moves to draw, `1`–`5`), **Ahead** (how many further moves of the engine's line to number), **Missed** (the better move after one of yours) and **Threats** (`X`). The bar lists only the kinds of arrow on the board; pointing at an entry puts the others in the background.
- The hue says who moves (blue for the side at the bottom, or you in Play; vermilion for the other), the line style says when (dashed for a move not made, numbered for a later one), and the width says how strong. A threat is marked with "!".
- **Threats** are what the opponent would do if it were their move, kept only when it would gain them enough over the position as it stands, so a defended piece or a developing move is not drawn. Passing the turn is not possible in check, so there are none then.
- Draw your own arrows by dragging with the right mouse button: green, red with Shift or Ctrl, blue with Alt, yellow with both. A left click clears them. They stay with their position.
- **Settings → Arrows** sets how the engine arrows decide: the search depth to wait for, which grade of move earns a better-move arrow, how sensitive threats are, how many are shown and how deep their search goes. **Settings → Engine** lets threats, Play suggestions, the Play coach and the Arena evaluation each run on their own engine; each follows the analysis engine until you choose otherwise.

**Learn**
- **Puzzles**: Lichess puzzles, the daily puzzle, an offline set, and puzzles built from your own mistakes.
- **Openings**: twelve main lines with the idea behind each move, plus a drill mode.
- **Endgames**: nine positions checked against an engine. Win or hold them against the engine.
- **Board Vision**: timed drills on square names, square colours and knight routes.

**Everywhere**
- A hub with quick actions, recent games and your progress.
- A command palette (`Ctrl+K`).
- Games and stats are stored in your browser. Nothing is uploaded.

## Preserving analysis

Analysis automatically saves named sessions on this device, including the main
game, replay position, completed analysis, board orientation and unfinished board
arrangements. Use **Sessions & options** to rename or reopen a session. The save
status confirms when storage has finished; failures offer Retry and Save as new
session. Conflicting edits from another tab cannot silently replace a session.

Turn on **Remember** beside the Analysis session name to record every new move,
including a game you invent and alternative lines. It is off by default. Choose
a saved line and use previous/next, start/final, keyboard arrows or autoplay to
replay it. Turning Remember off only stops new recording: your board, saved lines
and replay stay available. Continuing past a saved main game's end creates a
branch and preserves the main game and its completed evaluation. Evaluated
branches are preserved the same way; an unevaluated continuation grows as you
play. Clear branches keeps the main game and offers Undo.
Play and Arena keep their existing live-game histories; Arena's Analyze game
opens the same Analysis workspace with Remember available.

Download a session backup for preservation beyond this browser/device, then use
Restore session backup to import it as a separate session. All saved lines are
included even while Remember is off. Clearing browser data removes local games
and sessions. Analyze from here commits the editor's current FEN, including a
typed FEN that has not been submitted with Enter.

## Getting started

Requirements: [Node.js](https://nodejs.org) 22.11 or newer.

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). `npm start` builds a fresh static export when the source/configuration/assets change, then serves it on port 3000. On Windows, the repo's `start-chesskit.bat` installs missing dependencies and runs the same production path. Use `npm run dev` for hot-reload development.

Stockfish runs in the browser as WebAssembly, so no engine install is needed.

### Optional: the Reckless engine

[Reckless](https://github.com/codedeliveryservice/Reckless) is a native UCI engine. The app reaches it through a small WebSocket bridge on `127.0.0.1` that accepts only the `localhost:3000` origin. The bridge is not part of this repository. If you run your own bridge that speaks the same protocol, the app will pick up the native engine when it is connected.

## Scripts

```bash
npm test               # unit tests (Node test runner)
npm run lint           # eslint and tsc
npm run build          # production static export
npm start              # rebuild if needed, then serve for normal local use
npm run serve          # serve an already-built export
npm run dev            # hot-reload development server
npm run icons          # rebuild the offline icon bundle after adding an icon
node --import ./tests/register.mjs scripts/verify-endgames.mjs   # check endgame positions with a UCI engine
node scripts/fetch-offline-puzzles.mjs                          # refresh the offline puzzle set
```

## Stack

- [Next.js](https://nextjs.org/docs) (pages router, React Compiler) and [React](https://react.dev)
- [Material UI](https://mui.com/material-ui/getting-started/overview/) and `@mui/x-data-grid`
- [TypeScript](https://www.typescriptlang.org/), [chess.js](https://github.com/jhlywa/chess.js), [react-chessboard](https://github.com/Clariity/react-chessboard) and [Jotai](https://jotai.org)
- Stockfish 11 to 18 in WebAssembly, loaded per engine version

## Docker

```bash
HOST_UID=$(id -u) HOST_GID=$(id -g) COMMAND=dev docker compose -f ./docker/docker-compose-dev.yml up
```

For a production-style local run:

```bash
docker compose -f ./docker/docker-compose-prod.yml up
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

Chesskit was created by [Guillaume Sanchez-Dumont](https://github.com/GuillaumeSD) and is maintained with its contributors. The Stockfish builds in `public/engines` are the work of the Stockfish team and are distributed under their own licences. Puzzles come from the [Lichess](https://lichess.org) API. The Kaneo piece set in `public/piece/kaneo` is by [Kadagaden](https://github.com/Kadagaden/chess-pieces), inspired by chess.com's Neo pieces, and is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## License

Chesskit is free software licensed under the GNU Affero General Public License v3.0. See [LICENCE](LICENCE) and [COPYING.md](COPYING.md).
