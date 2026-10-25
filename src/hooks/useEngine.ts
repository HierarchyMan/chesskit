import { createEngine } from "@/lib/engine/createEngine";
import {
  engineHashMbAtom,
  jokeAdvisorDepthAtom,
  nativeThreadsAtom,
} from "@/lib/engine/engineSettings";
import { getEngineModel } from "@/lib/engine/models";
import { isEngineSupported } from "@/lib/engine/shared";
import { UciEngine } from "@/lib/engine/uciEngine";
import { markEngineLoadedAtom } from "./useModels";
import { useFeatureEngineName } from "./useFeatureEngineName";
import { EngineId } from "@/types/enums";
import { useCallback, useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";

export type EngineStatus = "idle" | "loading" | "ready" | "error";

export interface EngineState {
  engine: UciEngine | null;
  status: EngineStatus;
  error?: string;
  retry: () => void;
}

export const useEngineState = (
  engineName: EngineId | undefined
): EngineState => {
  const [engine, setEngine] = useState<UciEngine | null>(null);
  const [status, setStatus] = useState<EngineStatus>("idle");
  const [error, setError] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const markLoaded = useSetAtom(markEngineLoadedAtom);
  const hashMb = useAtomValue(engineHashMbAtom);
  const threads = useAtomValue(nativeThreadsAtom);
  const advisorName = useFeatureEngineName("jokes");
  const advisorDepth = useAtomValue(jokeAdvisorDepthAtom);
  // Only joke engines that judge moves restart when the advisor changes.
  const advisorKey =
    engineName && getEngineModel(engineName).needsAdvisor
      ? `${advisorName}@${advisorDepth}`
      : "";

  useEffect(() => {
    setEngine(null);
    setError(undefined);

    if (!engineName) {
      setStatus("idle");
      return;
    }

    if (!isEngineSupported(engineName)) {
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
        void createEngine(engineName, {
          signal: controller.signal,
          settings: { hashMb, threads },
          advisor: advisorKey
            ? { name: advisorName, depth: advisorDepth }
            : undefined,
        })
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
    // advisorName and advisorDepth only matter through advisorKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineName, attempt, markLoaded, hashMb, threads, advisorKey]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { engine, status, error, retry };
};

export const useEngine = (engineName: EngineId | undefined) =>
  useEngineState(engineName).engine;
