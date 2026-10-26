import { createEngine } from "@/lib/engine/createEngine";
import {
  engineHashMbAtom,
  jokeAdvisorDepthAtom,
  nativeThreadsAtom,
} from "@/lib/engine/engineSettings";
import { getEngineModel } from "@/lib/engine/models";
import {
  EngineNotDownloadedError,
  MissingReason,
  downloadStateOf,
} from "@/lib/engine/modelStorage";
import { isEngineSupported } from "@/lib/engine/shared";
import { UciEngine } from "@/lib/engine/uciEngine";
import { markEngineRunningAtom, storedFilesAtom } from "./useModels";
import { useFeatureEngineName } from "./useFeatureEngineName";
import { EngineId } from "@/types/enums";
import { useCallback, useEffect, useId, useState } from "react";
import { atom, useAtomValue, useSetAtom } from "jotai";

export type EngineStatus = "idle" | "loading" | "ready" | "error";

export interface EngineState {
  // The engine asked for. `engine` is that engine once it runs, and null until then.
  wanted: EngineId | undefined;
  engine: UciEngine | null;
  status: EngineStatus;
  error?: string;
  // Set when the engine cannot start because the user has not downloaded it (or the copy is old).
  missing?: MissingReason;
  retry: () => void;
}

/** One engine a part of the app asked for: what it wants and what is running for it. */
export interface EngineUsage {
  purpose: string;
  wanted: EngineId;
  status: EngineStatus;
  missing?: MissingReason;
  error?: string;
}

const engineUsageAtom = atom<Record<string, EngineUsage>>({});

/** Every engine the open pages asked for, keyed by the asking hook. */
export const useEngineUsage = () => useAtomValue(engineUsageAtom);

/**
 * Starts the engine `engineName` and keeps it running while the caller is
 * mounted. `purpose` names what it is for ("Analysis", "Threats"), so Settings
 * can show which engine each part of the app wants and whether it runs.
 */
export const useEngineState = (
  engineName: EngineId | undefined,
  purpose?: string
): EngineState => {
  const [engine, setEngine] = useState<UciEngine | null>(null);
  const [status, setStatus] = useState<EngineStatus>("idle");
  const [error, setError] = useState<string | undefined>(undefined);
  const [missing, setMissing] = useState<MissingReason | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const markRunning = useSetAtom(markEngineRunningAtom);
  const hashMb = useAtomValue(engineHashMbAtom);
  const threads = useAtomValue(nativeThreadsAtom);
  const advisorName = useFeatureEngineName("jokes");
  const advisorDepth = useAtomValue(jokeAdvisorDepthAtom);
  const stored = useAtomValue(storedFilesAtom);
  // Only joke engines that judge moves restart when the advisor changes.
  const advisorKey =
    engineName && getEngineModel(engineName).needsAdvisor
      ? `${advisorName}@${advisorDepth}`
      : "";

  useEffect(() => {
    setEngine(null);
    setError(undefined);
    setMissing(undefined);

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
            markRunning({ name: engineName, delta: 1 });
            setEngine(newEngine);
            setStatus("ready");
          })
          .catch((reason) => {
            if (!isCurrent) return;

            if (reason instanceof EngineNotDownloadedError) {
              setMissing(reason.reason);
            } else {
              console.error(reason);
            }
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
        markRunning({ name: engineName, delta: -1 });
        created.shutdown();
      }
    };
    // advisorName and advisorDepth only matter through advisorKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineName, attempt, markRunning, hashMb, threads, advisorKey]);

  // An engine that waits for its download starts as soon as the download is complete.
  const downloadedNow =
    !!engineName &&
    !!missing &&
    missing !== "unsupported" &&
    downloadStateOf(getEngineModel(engineName), stored) === "downloaded";
  useEffect(() => {
    if (downloadedNow) setAttempt((value) => value + 1);
  }, [downloadedNow]);

  const id = useId();
  const setUsage = useSetAtom(engineUsageAtom);
  useEffect(() => {
    if (!purpose || !engineName) return;
    setUsage((usage) => ({
      ...usage,
      [id]: { purpose, wanted: engineName, status, missing, error },
    }));
    return () =>
      setUsage((usage) => {
        const next = { ...usage };
        delete next[id];
        return next;
      });
  }, [id, purpose, engineName, status, missing, error, setUsage]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { wanted: engineName, engine, status, error, missing, retry };
};

export const useEngine = (engineName: EngineId | undefined, purpose?: string) =>
  useEngineState(engineName, purpose).engine;
