import { EngineWorker } from "@/types/engine";
import { isIosDevice, isMobileDevice } from "./shared";

export const getEngineWorker = (enginePath: string): EngineWorker => {
  console.log(`Creating worker from ${enginePath}`);

  if (enginePath.startsWith("ws://") || enginePath.startsWith("wss://")) {
    return getSocketEngineWorker(enginePath);
  }

  const worker = new window.Worker(enginePath);

  const engineWorker: EngineWorker = {
    isReady: false,
    searching: false,
    uci: (command: string) => {
      trackSearch(engineWorker, command);
      worker.postMessage(command);
    },
    listen: () => null,
    terminate: () => worker.terminate(),
  };

  worker.onerror = (event) =>
    failWorker(
      engineWorker,
      new Error(event.message || "Engine worker failed")
    );
  worker.onmessageerror = () =>
    failWorker(engineWorker, new Error("Engine message could not be read"));
  worker.onmessage = (event) => {
    trackBestMove(engineWorker, event.data);
    engineWorker.listen(event.data);
  };

  return engineWorker;
};

const trackSearch = (worker: EngineWorker, command: string) => {
  if (command === "go" || command.startsWith("go ")) worker.searching = true;
};

const trackBestMove = (worker: EngineWorker, data: unknown) => {
  if (typeof data === "string" && data.startsWith("bestmove")) {
    worker.searching = false;
  }
};

const getSocketEngineWorker = (url: string): EngineWorker => {
  const socket = new WebSocket(url);
  const pendingCommands: string[] = [];

  const engineWorker: EngineWorker = {
    isReady: false,
    searching: false,
    uci: (command: string) => {
      trackSearch(engineWorker, command);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(command);
      } else {
        pendingCommands.push(command);
      }
    },
    listen: () => null,
    terminate: () => socket.close(),
  };

  socket.onerror = () =>
    failWorker(engineWorker, new Error("Engine connection failed"));
  socket.onclose = () =>
    failWorker(engineWorker, new Error("Engine connection closed"));
  socket.onopen = () => {
    for (const command of pendingCommands.splice(0)) {
      socket.send(command);
    }
  };

  socket.onmessage = (event) => {
    trackBestMove(engineWorker, event.data);
    engineWorker.listen(event.data);
  };

  return engineWorker;
};

const failWorker = (worker: EngineWorker, error: Error) => {
  worker.failed = error;
  worker.isReady = false;
  worker.onFailure?.(error);
};

export const sendCommandsToWorker = (
  worker: EngineWorker,
  commands: string[],
  finalMessage: string,
  onNewMessage?: (messages: string[]) => void
): Promise<string[]> =>
  new Promise((resolve, reject) => {
    if (worker.failed) {
      reject(worker.failed);
      return;
    }
    worker.cancelPending?.();
    const messages: string[] = [];
    // Searches may intentionally run for a long time; handshakes and stop drains may not hang forever.
    const timer =
      finalMessage !== "bestmove" || commands.includes("stop")
        ? setTimeout(
            () =>
              failWorker(
                worker,
                new Error(`Engine timed out waiting for ${finalMessage}`)
              ),
            finalMessage === "uciok" ? 600_000 : 30_000
          )
        : undefined;
    const cleanup = () => {
      clearTimeout(timer);
      worker.listen = () => null;
      worker.cancelPending = undefined;
      worker.onFailure = undefined;
    };
    worker.cancelPending = () => {
      cleanup();
      resolve([]);
    };
    worker.onFailure = (error) => {
      cleanup();
      reject(error);
    };
    worker.listen = (data) => {
      messages.push(data);
      onNewMessage?.(messages);
      if (data.startsWith(finalMessage)) {
        cleanup();
        resolve(messages);
      }
    };
    try {
      for (const command of commands) worker.uci(command);
    } catch (error) {
      failWorker(
        worker,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  });

export const getRecommendedWorkersNb = (): number => {
  if (typeof navigator === "undefined") return 1;
  const maxWorkersNbFromThreads = Math.max(
    1,
    Math.round(navigator.hardwareConcurrency - 4),
    Math.floor((navigator.hardwareConcurrency * 2) / 3)
  );

  const maxWorkersNbFromMemory =
    "deviceMemory" in navigator && typeof navigator.deviceMemory === "number"
      ? Math.max(1, Math.round(navigator.deviceMemory))
      : 4;

  const maxWorkersNbFromDevice = isIosDevice() ? 2 : isMobileDevice() ? 4 : 8;

  return Math.min(
    maxWorkersNbFromThreads,
    maxWorkersNbFromMemory,
    maxWorkersNbFromDevice
  );
};
