import { useEffect, useState } from "react";
import type { DetectedInput } from "@/lib/pgn";
import { detectInputAsync, processOffThread } from "@/lib/processing";

export function useParsedInput(
  text: string,
  enabled = true,
  task: "detect" | "parse" = "detect"
) {
  const [result, setResult] = useState<{ text: string; value: DetectedInput }>({
    text: "",
    value: { kind: "unknown" },
  });
  const [error, setError] = useState<string>();
  useEffect(() => {
    setError(undefined);
    if (!enabled || !text.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const work =
        task === "detect"
          ? detectInputAsync(text, controller.signal)
          : processOffThread("parse", text, controller.signal).then(
              (games): DetectedInput => ({ kind: "pgn", games })
            );
      void work
        .then((value) => {
          if (!controller.signal.aborted) setResult({ text, value });
        })
        .catch((reason) => {
          if (!controller.signal.aborted) setError(String(reason));
        });
    }, 100);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, enabled, task]);
  return {
    detected:
      result.text === text
        ? result.value
        : ({ kind: "unknown" } as DetectedInput),
    loading: enabled && !!text.trim() && result.text !== text && !error,
    error,
  };
}
