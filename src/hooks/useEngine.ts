import { isWasmSupported } from "@/lib/engine/shared";
import { Reckless } from "@/lib/engine/reckless";
import { Stockfish11 } from "@/lib/engine/stockfish11";
import { Stockfish16 } from "@/lib/engine/stockfish16";
import { Stockfish16_1 } from "@/lib/engine/stockfish16_1";
import { Stockfish17 } from "@/lib/engine/stockfish17";
import { Stockfish17_1 } from "@/lib/engine/stockfish17_1";
import { Stockfish18 } from "@/lib/engine/stockfish18";
import { UciEngine } from "@/lib/engine/uciEngine";
import { markEngineLoadedAtom } from "./useModels";
import { EngineName } from "@/types/enums";
import { useCallback, useEffect, useState } from "react";
import { useSetAtom } from "jotai";

export type EngineStatus = "idle" | "loading" | "ready" | "error";

export interface EngineState {
  engine: UciEngine | null;
  status: EngineStatus;
  error?: string;
  retry: () => void;
}

export const useEngineState = (
  engineName: EngineName | undefined
): EngineState => {
  const [engine, setEngine] = useState<UciEngine | null>(null);
  const [status, setStatus] = useState<EngineStatus>("idle");
  const [error, setError] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const markLoaded = useSetAtom(markEngineLoadedAtom);

  useEffect(() => {
    setEngine(null);
    setError(undefined);

    if (!engineName) {
      setStatus("idle");
      return;
    }

    const needsWasm =
      engineName !== EngineName.Stockfish11 &&
      engineName !== EngineName.Reckless;
    if (needsWasm && !isWasmSupported()) {
      setStatus("error");
      setError("This browser does not support WebAssembly.");
      return;
    }

    let isCurrent = true;
    const controller = new AbortController();
    let created: UciEngine | undefined;
    setStatus("loading");

    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        void pickEngine(engineName, controller.signal)
          .then((newEngine) => {
            if (!isCurrent) {
              newEngine.shutdown();
              return;
            }

            created = newEngine;
            markLoaded({ name: engineName, delta: 1 });
            setEngine(newEngine);
            setStatus("ready");
          })
          .catch((reason) => {
            if (!isCurrent) return;

            console.error(reason);
            setStatus("error");
            setError(
              reason instanceof Error
                ? reason.message
                : "The engine did not start."
            );
          });
      });
    });

    return () => {
      isCurrent = false;
      cancelAnimationFrame(frame);
      controller.abort();
      if (created) {
        markLoaded({ name: engineName, delta: -1 });
        created.shutdown();
      }
    };
  }, [engineName, attempt, markLoaded]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { engine, status, error, retry };
};

export const useEngine = (engineName: EngineName | undefined) =>
  useEngineState(engineName).engine;

const pickEngine = (
  engine: EngineName,
  signal: AbortSignal
): Promise<UciEngine> => {
  switch (engine) {
    case EngineName.Reckless:
      return Reckless.create(signal);
    case EngineName.Stockfish18:
      return Stockfish18.create(false, signal);
    case EngineName.Stockfish18Lite:
      return Stockfish18.create(true, signal);
    case EngineName.Stockfish17_1:
      return Stockfish17_1.create(false, signal);
    case EngineName.Stockfish17_1Lite:
      return Stockfish17_1.create(true, signal);
    case EngineName.Stockfish17:
      return Stockfish17.create(false, signal);
    case EngineName.Stockfish17Lite:
      return Stockfish17.create(true, signal);
    case EngineName.Stockfish16_1:
      return Stockfish16_1.create(false, signal);
    case EngineName.Stockfish16_1Lite:
      return Stockfish16_1.create(true, signal);
    case EngineName.Stockfish16:
      return Stockfish16.create(false, signal);
    case EngineName.Stockfish16NNUE:
      return Stockfish16.create(true, signal);
    case EngineName.Stockfish11:
      return Stockfish11.create(signal);
  }
};
