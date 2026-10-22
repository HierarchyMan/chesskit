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
- Casual games offer hints, takebacks and an optional coach. Formal games have none.
- Odds, clocks, resign and draw offers.

**Analyse**
- One board for analysis and the board editor: arrange any position, then play moves on it.
- Live engine evaluation with top moves for either side, custom arrows and an evaluation graph.
- **Analysis options** on the Analysis tab toggle the evaluation bar, move annotations and the best-move arrow. Choices are remembered in this browser.
- Move classification (Brilliant, Great, Good, Mistake, Blunder, ...).
- Load games from [chess.com](https://chess.com) and [lichess.org](https://lichess.org), or paste a PGN, a FEN, a Lichess link or a screenshot of a board (`Ctrl+V` on any page).
- **Scan Image** turns a photo or screenshot of a board into a position, entirely in your browser.
- **Visualize**: for any move that is not best or excellent, a pop-up walks through the moves that follow (2 to 10 plies, depending on the evaluation).

**Engine Arena**
- Pit two engines, or two strengths of one engine, against each other. Step through with *Next*, nudge a move by clicking a candidate or dragging a piece, or let them auto-play.
- Use **Analysis options** in the side panel to independently toggle the evaluation bar, move annotations, and a best-move arrow. Choices are remembered in this browser. With annotations on, the panel also shows the opening and each side's accuracy; with the arrow on, it names the better alternative.
- An independent instance of the top-bar analysis engine checks moves at depth 12. Annotations grade both players' moves on the board and in the move list; select any move for its explanation and **Visualize move**. Enabling annotations mid-game also checks earlier moves. Analysis can catch up during fast auto-play; it does not control the players' moves.

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
and replay stay available. Clear branches keeps the main game and offers Undo.
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

Chesskit was created by [Guillaume Sanchez-Dumont](https://github.com/GuillaumeSD) and is maintained with its contributors. The Stockfish builds in `public/engines` are the work of the Stockfish team and are distributed under their own licences. Puzzles come from the [Lichess](https://lichess.org) API.

## License

Chesskit is free software licensed under the GNU Affero General Public License v3.0. See [LICENCE](LICENCE) and [COPYING.md](COPYING.md).
