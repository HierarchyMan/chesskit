import { EngineName } from "@/types/enums";
import {
  EvaluateGameParams,
  EvaluatePositionWithUpdateParams,
  GameEval,
  PositionEval,
} from "@/types/eval";
import {
  EvaluationParser,
  getResultProperty,
  parseEvaluationResults,
} from "./helpers/parseResults";
import { computeAccuracy } from "./helpers/accuracy";
import { getIsStalemate, getWhoIsCheckmated } from "../chess";
import { getLichessEval } from "../lichess";
import { getMovesClassification } from "./helpers/moveClassification";
import { computeEstimatedElo } from "./helpers/estimateElo";
import { hasNativeEloLimit } from "@/constants";
import { NATIVE_MAX_ELO, NATIVE_MIN_ELO } from "./strength";
import { EngineWorker, WorkerJob } from "@/types/engine";
import { getEngineWorker, sendCommandsToWorker } from "./worker";
import { logMessageIfLocalhost } from "../helpers";

export class UciEngine {
  public readonly name: EngineName;
  private workers: EngineWorker[] = [];
  private pendingWorkers = new Set<EngineWorker>();
  private closed = false;
  private workerQueue: WorkerJob[] = [];
  private isReady = false;
  private positionGeneration = 0;
  private positionSetup: Promise<unknown> = Promise.resolve();
  private enginePath: string;
  private customEngineInit?:
    | ((worker: EngineWorker) => Promise<void>)
    | undefined = undefined;
  private multiPv = 3;
  private elo: number | undefined = undefined;
  private stopInFlight: Promise<void> | undefined = undefined;

  private constructor(
    engineName: EngineName,
    enginePath: string,
    customEngineInit: UciEngine["customEngineInit"]
  ) {
    this.name = engineName;
    this.enginePath = enginePath;
    this.customEngineInit = customEngineInit;
  }

  public static async create(
    engineName: EngineName,
    enginePath: string,
    customEngineInit?: UciEngine["customEngineInit"],
    signal?: AbortSignal
  ): Promise<UciEngine> {
    const engine = new UciEngine(engineName, enginePath, customEngineInit);

    const abort = () => engine.shutdown();
    signal?.addEventListener("abort", abort, { once: true });
    try {
      if (signal?.aborted)
        throw new DOMException("Engine startup cancelled", "AbortError");
      await engine.addNewWorker();
      if (engine.closed)
        throw new DOMException("Engine startup cancelled", "AbortError");
      engine.isReady = true;
      return engine;
    } catch (error) {
      engine.shutdown();
      throw error;
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  }

  private acquireWorker(): EngineWorker | undefined {
    for (const worker of this.workers) {
      if (!worker.isReady) continue;

      worker.isReady = false;
      return worker;
    }

    return undefined;
  }

  private async releaseWorker(worker: EngineWorker) {
    if (this.stopInFlight || worker.failed || !this.workers.includes(worker))
      return;
    const nextJob = this.workerQueue.shift();
    if (!nextJob) {
      worker.isReady = true;
      return;
    }

    try {
      const res = await sendCommandsToWorker(
        worker,
        nextJob.commands,
        nextJob.finalMessage,
        nextJob.onNewMessage
      );
      nextJob.resolve(res);
    } catch (error) {
      nextJob.reject(error as Error);
    } finally {
      void this.releaseWorker(worker);
    }
  }

  private async setMultiPv(multiPv: number) {
    if (multiPv === this.multiPv) return;

    if (multiPv < 2 || multiPv > 6) {
      throw new Error(`Invalid MultiPV value : ${multiPv}`);
    }

    await this.sendCommandsToEachWorker(
      [`setoption name MultiPV value ${multiPv}`, "isready"],
      "readyok"
    );

    this.multiPv = multiPv;
  }

  private async setElo(elo: number | undefined) {
    if (!hasNativeEloLimit(this.name)) return;
    if (elo === this.elo) return;

    if (elo === undefined) {
      await this.sendCommandsToEachWorker(
        ["setoption name UCI_LimitStrength value false", "isready"],
        "readyok"
      );
      this.elo = undefined;
      return;
    }

    if (elo < NATIVE_MIN_ELO || elo > NATIVE_MAX_ELO) {
      throw new Error(`Invalid Elo value : ${elo}`);
    }

    await this.sendCommandsToEachWorker(
      ["setoption name UCI_LimitStrength value true", "isready"],
      "readyok"
    );

    await this.sendCommandsToEachWorker(
      [`setoption name UCI_Elo value ${elo}`, "isready"],
      "readyok"
    );

    this.elo = elo;
  }

  public getIsReady(): boolean {
    return this.isReady;
  }

  private throwErrorIfNotReady() {
    if (!this.isReady) {
      throw new Error(`${this.name} is not ready`);
    }
  }

  public shutdown(): void {
    this.isReady = false;
    this.closed = true;
    this.positionGeneration++;
    for (const job of this.workerQueue) job.resolve([]);
    this.workerQueue = [];

    for (const worker of [...this.workers, ...this.pendingWorkers]) {
      this.terminateWorker(worker);
    }
    this.workers = [];
    this.pendingWorkers.clear();
  }

  private terminateWorker(worker: EngineWorker) {
    console.log(`Terminating worker from ${this.enginePath}`);
    worker.isReady = false;
    worker.cancelPending?.();
    try {
      worker.uci("quit");
    } catch {
      /* Failed transport is already closed. */
    }
    worker.terminate();
  }

  public stopAllCurrentJobs(): Promise<void> {
    this.positionGeneration++;
    return this.stopCurrentJobs();
  }

  private stopCurrentJobs(): Promise<void> {
    const abandonedJobs = [...this.workerQueue];
    this.workerQueue = [];

    for (const job of abandonedJobs) {
      job.resolve([]);
    }

    if (!this.stopInFlight) {
      this.stopInFlight = this.stopWorkers().finally(() => {
        this.stopInFlight = undefined;
        for (const worker of this.workers) void this.releaseWorker(worker);
      });
    }

    return this.stopInFlight;
  }

  private async stopWorkers(): Promise<void> {
    for (const worker of this.workers) {
      worker.cancelPending?.();
      worker.listen = () => null;
    }

    // A stopped search still prints its last info lines and "bestmove", and
    // that can arrive after "readyok". Wait for it here, or the next job would
    // read those lines as its own and score the wrong position.
    await Promise.all(
      this.workers.map(async (worker) => {
        if (worker.searching) {
          await sendCommandsToWorker(worker, ["stop"], "bestmove");
        }
        await sendCommandsToWorker(worker, ["isready"], "readyok");
      })
    );

    for (const worker of this.workers) {
      this.releaseWorker(worker);
    }
  }

  private async sendCommands(
    commands: string[],
    finalMessage: string,
    onNewMessage?: (messages: string[]) => void
  ): Promise<string[]> {
    const worker = this.acquireWorker();

    if (!worker) {
      return new Promise((resolve, reject) => {
        this.workerQueue.push({
          commands,
          finalMessage,
          onNewMessage,
          resolve,
          reject,
        });
      });
    }

    try {
      return await sendCommandsToWorker(
        worker,
        commands,
        finalMessage,
        onNewMessage
      );
    } catch (error) {
      for (const job of this.workerQueue.splice(0)) job.reject(error as Error);
      this.shutdown();
      throw error;
    } finally {
      void this.releaseWorker(worker);
    }
  }

  private async sendCommandsToEachWorker(
    commands: string[],
    finalMessage: string,
    onNewMessage?: (messages: string[]) => void
  ): Promise<void> {
    await Promise.all(
      this.workers.map(async (worker) => {
        await sendCommandsToWorker(
          worker,
          commands,
          finalMessage,
          onNewMessage
        );
        this.releaseWorker(worker);
      })
    );
  }

  private async addNewWorker() {
    if (this.closed) throw new DOMException("Engine closed", "AbortError");
    const worker = getEngineWorker(this.enginePath);
    this.pendingWorkers.add(worker);
    try {
      const check = () => {
        if (this.closed) throw new DOMException("Engine closed", "AbortError");
      };
      await sendCommandsToWorker(worker, ["uci"], "uciok");
      check();
      await sendCommandsToWorker(
        worker,
        [`setoption name MultiPV value ${this.multiPv}`, "isready"],
        "readyok"
      );
      check();
      await this.customEngineInit?.(worker);
      check();
      await sendCommandsToWorker(worker, ["ucinewgame", "isready"], "readyok");
      check();
      this.workers.push(worker);
      void this.releaseWorker(worker);
    } catch (error) {
      this.terminateWorker(worker);
      throw error;
    } finally {
      this.pendingWorkers.delete(worker);
    }
  }

  private async setWorkersNb(workersNb: number) {
    if (workersNb === this.workers.length) return;

    if (workersNb < 1) {
      throw new Error(
        `Number of workers must be greater than 0, got ${workersNb} instead`
      );
    }

    if (workersNb < this.workers.length) {
      const workersToRemove = this.workers.slice(workersNb);
      this.workers = this.workers.slice(0, workersNb);

      for (const worker of workersToRemove) {
        this.terminateWorker(worker);
      }
      return;
    }

    const workersNbToCreate = workersNb - this.workers.length;

    await Promise.all(
      new Array(workersNbToCreate).fill(0).map(() => this.addNewWorker())
    );
  }

  public async evaluateGame({
    fens,
    uciMoves,
    depth = 16,
    multiPv = this.multiPv,
    setEvaluationProgress,
    playersRatings,
    workersNb = 1,
  }: EvaluateGameParams): Promise<GameEval> {
    this.throwErrorIfNotReady();
    this.isReady = false;
    setEvaluationProgress?.(1);

    await this.setMultiPv(multiPv);
    await this.setElo(undefined);
    await this.sendCommandsToEachWorker(["ucinewgame", "isready"], "readyok");
    await this.setWorkersNb(workersNb);

    const positions: PositionEval[] = new Array(fens.length);
    let completed = 0;

    const updateEval = (index: number, positionEval: PositionEval) => {
      completed++;
      positions[index] = positionEval;
      const progress = completed / fens.length;
      setEvaluationProgress?.(99 - Math.exp(-4 * progress) * 99);
    };

    await Promise.all(
      fens.map(async (fen, i) => {
        const whoIsCheckmated = getWhoIsCheckmated(fen);
        if (whoIsCheckmated) {
          updateEval(i, {
            lines: [
              {
                pv: [],
                depth: 0,
                multiPv: 1,
                mate: whoIsCheckmated === "w" ? -1 : 1,
              },
            ],
          });
          return;
        }

        const isStalemate = getIsStalemate(fen);
        if (isStalemate) {
          updateEval(i, {
            lines: [
              {
                pv: [],
                depth: 0,
                multiPv: 1,
                cp: 0,
              },
            ],
          });
          return;
        }

        const result = await this.evaluatePosition(fen, depth);
        updateEval(i, result);
      })
    );

    await this.setWorkersNb(1);
    this.isReady = true;

    const positionsWithClassification = getMovesClassification(
      positions,
      uciMoves,
      fens
    );
    const startsWithBlack = fens[0].split(" ")[1] === "b";
    const accuracy = computeAccuracy(positions, startsWithBlack);
    const estimatedElo = computeEstimatedElo(
      positions,
      playersRatings?.white,
      playersRatings?.black,
      startsWithBlack
    );

    return {
      positions: positionsWithClassification,
      estimatedElo,
      accuracy,
      settings: {
        engine: this.name,
        date: new Date().toISOString(),
        depth,
        multiPv,
      },
    };
  }

  private async evaluatePosition(
    fen: string,
    depth = 16
  ): Promise<PositionEval> {
    const results = await this.sendCommands(
      [`position fen ${fen}`, `go depth ${depth}`],
      "bestmove"
    );

    return parseEvaluationResults(results, fen);
  }

  public async evaluatePositionWithUpdate({
    fen,
    depth = 16,
    multiPv = this.multiPv,
    setPartialEval,
    useCloudEval = true,
    movetimeMs,
    elo,
  }: EvaluatePositionWithUpdateParams): Promise<PositionEval> {
    this.throwErrorIfNotReady();
    const generation = ++this.positionGeneration;
    const current = () =>
      generation === this.positionGeneration && this.isReady;
    const cloudPromise = useCloudEval
      ? getLichessEval(fen, multiPv)
      : undefined;
    const prepare = this.positionSetup
      .catch(() => undefined)
      .then(async () => {
        if (!current()) return;
        await this.stopCurrentJobs();
        if (!current()) return;
        await this.setMultiPv(multiPv);
        if (!current()) return;
        await this.setElo(elo);
      });
    this.positionSetup = prepare;
    await prepare;
    if (!current()) return { lines: [] };

    const parser = new EvaluationParser(fen);
    let publishLocal = !useCloudEval;
    let buffered: PositionEval | undefined;
    let lastUpdate = -Infinity;
    const onNewMessage = (messages: string[]) => {
      if (!current() || performance.now() < lastUpdate + 60) return;
      lastUpdate = performance.now();
      buffered = parser.update(messages);
      if (publishLocal) setPartialEval?.(buffered);
    };
    const go = movetimeMs
      ? `go movetime ${Math.round(movetimeMs)}`
      : `go depth ${depth}`;
    // Begin immediately, but retain cloud preference and keep speculative updates private.
    const local = this.sendCommands(
      [`position fen ${fen}`, go],
      "bestmove",
      onNewMessage
    );
    // Attach a rejection handler immediately while the independent cloud request is pending.
    void local.catch(() => undefined);
    const cloud = await cloudPromise;
    if (!current()) return { lines: [] };
    if (
      cloud &&
      cloud.lines.length >= multiPv &&
      cloud.lines[0].depth >= depth
    ) {
      await this.stopCurrentJobs();
      if (!current()) return { lines: [] };
      setPartialEval?.(cloud);
      return cloud;
    }
    publishLocal = true;
    if (buffered) setPartialEval?.(buffered);
    const results = await local;
    if (!current()) return { lines: [] };
    const finalEval = parser.update(results);
    setPartialEval?.(finalEval);
    return finalEval;
  }

  public async getEngineNextMove(
    fen: string,
    elo: number | undefined,
    depth = 16
  ): Promise<string | undefined> {
    this.throwErrorIfNotReady();

    await this.stopAllCurrentJobs();
    await this.setElo(elo);

    logMessageIfLocalhost(`Evaluating position: ${fen}`);

    const results = await this.sendCommands(
      [`position fen ${fen}`, `go depth ${depth}`],
      "bestmove"
    );

    const moveResult = results.find((result) => result.startsWith("bestmove"));
    const move = getResultProperty(moveResult ?? "", "bestmove");
    if (!move) {
      throw new Error("No move found");
    }

    return move === "(none)" ? undefined : move;
  }
}
