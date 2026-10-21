export interface EngineWorker {
  isReady: boolean;
  // True from a "go" command until that search prints its "bestmove".
  searching: boolean;
  uci(command: string): void;
  listen: (data: string) => void;
  terminate: () => void;
  failed?: Error;
  onFailure?: (error: Error) => void;
  cancelPending?: () => void;
}

export interface WorkerJob {
  commands: string[];
  finalMessage: string;
  onNewMessage?: (messages: string[]) => void;
  resolve: (messages: string[]) => void;
  reject: (error: Error) => void;
}
