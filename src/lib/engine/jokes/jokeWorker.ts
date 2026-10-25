import { EngineWorker } from "@/types/engine";
import { Chess } from "chess.js";
import { scoreFromLine } from "../strength";
import { UciEngine } from "../uciEngine";
import { JOKE_STRATEGIES, JokeEngineName, moveToUci } from "./strategies";

/**
 * A joke engine that speaks UCI in the page, so the rest of the app drives it
 * exactly like Stockfish in a Web Worker. Strategies that judge moves ask an
 * advisor (a real engine of the user's choice) to score every legal move.
 */

export interface JokeWorkerOptions {
  // Started on the first search that needs it, shut down with the worker.
  startAdvisor?: () => Promise<UciEngine>;
  advisorDepth: number;
  random?: () => number;
}

const MAX_LINES = 6;
// Reported when a search names no depth (a movetime search).
const DEFAULT_REPORTED_DEPTH = 12;

const scoreText = (score: number): string => {
  if (Math.abs(score) < 50_000) return `cp ${Math.round(score)}`;
  const plies = 100_000 - Math.abs(score);
  return `mate ${Math.sign(score) * Math.max(1, Math.ceil(plies))}`;
};

export const createJokeWorker = (
  name: JokeEngineName,
  { startAdvisor, advisorDepth, random = Math.random }: JokeWorkerOptions
): EngineWorker => {
  const strategy = JOKE_STRATEGIES[name];
  let fen = new Chess().fen();
  let multiPv = 1;
  let search = 0;
  let closed = false;
  let advisor: Promise<UciEngine> | undefined;

  // Answers are delivered asynchronously, as a real worker's are. A line that
  // belongs to a search (searchId) is dropped when another search or a "stop"
  // took its place, so a search is never answered twice.
  const send = (line: string, searchId?: number) => {
    queueMicrotask(() => {
      if (closed || (searchId !== undefined && searchId !== search)) return;
      if (line.startsWith("bestmove")) worker.searching = false;
      worker.listen(line);
    });
  };

  const getAdvisor = () => {
    advisor ??= startAdvisor?.();
    return advisor;
  };

  // Every legal move's score for the mover. One MultiPV search when the advisor
  // can list every move at once, otherwise one search per resulting position.
  const scoreMoves = async (
    engine: UciEngine,
    position: Chess,
    current: () => boolean
  ): Promise<Map<string, number>> => {
    const moves = position.moves({ verbose: true });
    const turn = position.turn();
    const scores = new Map<string, number>();

    if (engine.capabilities.maxMultiPv >= moves.length) {
      const result = await engine.evaluatePositionWithUpdate({
        fen: position.fen(),
        depth: advisorDepth,
        multiPv: moves.length,
        useCloudEval: false,
      });
      for (const line of result.lines) {
        if (line.pv[0]) scores.set(line.pv[0], scoreFromLine(line, turn));
      }
      if (scores.size === moves.length || !current()) return scores;
    }

    for (const move of moves) {
      const uci = moveToUci(move);
      if (scores.has(uci) || !current()) continue;
      const next = new Chess(position.fen());
      next.move(move);
      if (next.isCheckmate()) {
        scores.set(uci, 100_000 - 1);
        continue;
      }
      if (next.isDraw()) {
        scores.set(uci, 0);
        continue;
      }
      const result = await engine.evaluatePositionWithUpdate({
        fen: next.fen(),
        depth: Math.max(1, advisorDepth - 1),
        multiPv: 1,
        useCloudEval: false,
      });
      const line = result.lines[0];
      // The line is scored for the opponent, who moves next.
      if (line) scores.set(uci, -scoreFromLine(line, next.turn()));
    }
    return scores;
  };

  // A joke engine's answer is complete when it replies, so its lines report the
  // depth that was asked for. The app shows lines under depth 6 as unfinished.
  const go = async (requestedDepth: number) => {
    const id = ++search;
    const current = () => id === search && !closed;
    const position = new Chess(fen);
    const moves = position.moves({ verbose: true });
    if (!moves.length) {
      send("bestmove (none)", id);
      return;
    }

    let scores: Map<string, number> | undefined;
    const needsScores = !!startAdvisor;
    if (needsScores) {
      try {
        const engine = await getAdvisor();
        if (engine && current())
          scores = await scoreMoves(engine, position, current);
      } catch (error) {
        if (current()) {
          send(
            `info string advisor failed: ${error instanceof Error ? error.message : String(error)}`,
            id
          );
        }
      }
    }
    if (!current()) return;

    const ranked = strategy({ fen, moves, scores, random });
    ranked.slice(0, Math.min(multiPv, MAX_LINES)).forEach((uci, index) => {
      const score = scores?.get(uci) ?? 0;
      send(
        `info depth ${requestedDepth} multipv ${index + 1} score ${scoreText(score)} pv ${uci}`,
        id
      );
    });
    send(`bestmove ${ranked[0]}`, id);
  };

  const handle = (command: string) => {
    const tokens = command.trim().split(/\s+/);
    switch (tokens[0]) {
      case "uci":
        send(`id name ${name}`);
        send("id author Chesskit");
        send(`option name MultiPV type spin default 1 min 1 max ${MAX_LINES}`);
        send("uciok");
        break;
      case "isready":
        send("readyok");
        break;
      case "setoption": {
        const valueIndex = tokens.indexOf("value");
        const optionName = tokens.slice(2, valueIndex).join(" ").toLowerCase();
        if (optionName === "multipv")
          multiPv = Number(tokens[valueIndex + 1]) || 1;
        break;
      }
      case "position": {
        const movesIndex = tokens.indexOf("moves");
        const end = movesIndex < 0 ? tokens.length : movesIndex;
        const game =
          tokens[1] === "startpos"
            ? new Chess()
            : new Chess(tokens.slice(2, end).join(" "));
        if (movesIndex >= 0) {
          for (const uci of tokens.slice(movesIndex + 1)) {
            game.move({
              from: uci.slice(0, 2),
              to: uci.slice(2, 4),
              promotion: uci[4],
            });
          }
        }
        fen = game.fen();
        break;
      }
      case "go":
        worker.searching = true;
        void go(
          Number(tokens[tokens.indexOf("depth") + 1]) || DEFAULT_REPORTED_DEPTH
        );
        break;
      case "stop":
        if (worker.searching) {
          // A stopped search must still answer with a move.
          search++;
          void advisor
            ?.then((engine) => engine.stopAllCurrentJobs())
            .catch(() => undefined);
          const moves = new Chess(fen).moves({ verbose: true });
          send(
            `bestmove ${moves.length ? moveToUci(moves[0]) : "(none)"}`,
            search
          );
        }
        break;
      case "quit":
        worker.terminate();
        break;
    }
  };

  const worker: EngineWorker = {
    isReady: false,
    searching: false,
    uci: (command) => {
      if (!closed) handle(command);
    },
    listen: () => null,
    terminate: () => {
      if (closed) return;
      closed = true;
      search++;
      void advisor?.then((engine) => engine.shutdown()).catch(() => undefined);
    },
  };

  return worker;
};
