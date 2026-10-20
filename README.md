<div align="center">
  <a href="https://github.com/GuillaumeSD/Chesskit">
    <img width="120" height="120" src="https://github.com/GuillaumeSD/Chesskit/blob/main/public/android-chrome-192x192.png" alt="Logo">
  </a>

<h3 align="center">Chesskit</h3>
  <p align="center">
    The Ultimate Chess Web App
    <br />
    <a href="https://chesskit.org/" target="_blank" rel="noopener noreferrer"><strong>chesskit.org</strong></a>
    <br />
    <a href="https://discord.com/invite/Yr99abAcUr" target="_blank" rel="noopener noreferrer">Discord Server</a>
    ·
    <a href="https://chesskit.notion.site/4cf7823836724432b71aa8932ba7d5bb" target="_blank" rel="noopener noreferrer">Features Backlog</a>
  </p>
</div>
<br />

Chesskit is an open-source chess website to play, view, analyze and review your chess games for free on any device with Stockfish !

## Mission

Chesskit aims to offer all the chess related features it can, while being free and open-source. It is designed to be easy to use, fast, and reliable.

## Features

- Load and review games from [chess.com](https://chess.com) and [lichess.org](https://lichess.org)
- Analysis board with live engine evaluation, custom arrows, evaluation graph, ...
- Moves classification (Brilliant, Great, Good, Mistake, Blunder, ...)
- Chess960 and Puzzles support
- Play against Stockfish at any elo
- Store your games in your browser database

<img src="https://github.com/GuillaumeSD/Chesskit/blob/main/assets/showcase.png" />

## What this fork adds

- **A hub** with quick actions, recent games and your progress, plus a collapsible menu and a command palette (`Ctrl+K`).
- **Paste anything** (`Ctrl+V` on any page): a PGN (several games at once), a FEN, a Lichess link or a screenshot of a board.
- **Play** against any engine at an Elo from 400 to 3200, at a fixed depth or at full strength. Casual games have hints, takebacks and an optional coach; formal games have none. Odds, clocks, resign and draw offers are included.
- **Engine Arena**: two engines, or two strengths of one engine, play each other. Step with Next, or nudge a move by clicking a candidate or dragging a piece.
- **Analysis and Board Editor** share one board. Arrange any position, switch to playing moves on it, change the engine at any moment, and ask for the top moves of either side (what the opponent would answer, or what they would play if it were their turn).
- **Visualize**: for any move that is not best or excellent, a pop-up steps through the moves that follow. The length follows the engine's evaluation (2 to 10 plies) and you can close it at any time.
- **Scan Image** turns a screenshot or photo of a board into a position, entirely in your browser.
- **Learn** collects the training tools: **Puzzles** (Lichess, the daily puzzle, an offline set, and puzzles built from your own mistakes), **Openings** (twelve lines with the idea behind each move, and a drill), **Endgames** (nine positions checked with an engine, played out against it) and **Board Vision** (square names, colours and knight routes).
- **Reckless** (a native UCI engine) through a local bridge. See below.

### Running with Reckless

Run `start-chess.bat` from the folder above this one. It starts the bridge (`engine-bridge`, bound to `127.0.0.1` and limited to `localhost:3000`) and the dev server. The bridge needs the Reckless binary in `engines/`.

### Tests and scripts

```bash
npm test                                                    # unit tests
npm run lint                                                # eslint and tsc
npm run icons                                               # rebuild the offline icon bundle after using a new icon
node --import ./tests/register.mjs scripts/verify-endgames.mjs   # check the endgames with a UCI engine
node scripts/fetch-offline-puzzles.mjs                      # refresh the offline puzzle set
```

## Stack

Built with [Next.js](https://nextjs.org/docs), [React](https://react.dev/learn/describing-the-ui), [Material UI](https://mui.com/material-ui/getting-started/overview/), and [TypeScript](https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html).

Deployed on AWS with [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/home.html), see it live [here](https://chesskit.org).

## Running the app in dev mode

#### Using Node.js

> [!IMPORTANT]  
> At least [Node.js](https://nodejs.org) 22.11 is required.

Install the dependencies :

```bash
npm i
```

Run the development server :

```bash
npm run dev
```

#### Using Docker

Run the development server :

```bash
HOST_UID=$(id -u) HOST_GID=$(id -g) COMMAND=dev docker compose -f ./docker/docker-compose-dev.yml up
```

Open [http://localhost:3000](http://localhost:3000) in the browser to see the app running.

The app will automatically refresh on any source file change.

## Lint

Run it with :

```bash
npm run lint
```

or with docker :

```bash
HOST_UID=$(id -u) HOST_GID=$(id -g) COMMAND=lint docker compose -f ./docker/docker-compose-dev.yml up
```

## Contribute

See [contributing](CONTRIBUTING.md) for details on how to contribute to the project.

## Deploy

To deploy the app, install [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and [authenticate](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-quickstart.html), then run :

```bash
npm run deploy
```

## License

Chesskit is licensed under the GNU Affero General Public License 3. See [copying](COPYING.md) for
details.

## Growing thanks to you ❤️

[![Stargazers over time](https://starchart.cc/GuillaumeSD/Chesskit.svg?variant=adaptive)](https://starchart.cc/GuillaumeSD/Chesskit)

## Self-hosting

To run the project locally in production mode, you can use docker and the following command :

```bash
docker compose -f ./docker/docker-compose-prod.yml up
```
