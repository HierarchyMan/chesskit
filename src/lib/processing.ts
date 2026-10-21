import type { DetectedInput, ParsedGame } from "./pgn";
import type { Game } from "@/types/game";
import type { MistakeEntry } from "./mistakes";

export interface ProcessingTasks {
  detect: { input: string; output: DetectedInput };
  parse: { input: string; output: ParsedGame[] };
  records: { input: string[]; output: Omit<Game, "id">[] };
  mistakes: { input: Game[]; output: MistakeEntry[] };
}

export function processOffThread<K extends keyof ProcessingTasks>(
  task: K,
  input: ProcessingTasks[K]["input"],
  signal?: AbortSignal
): Promise<ProcessingTasks[K]["output"]> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    const worker = new Worker(
      new URL("../workers/processing.worker.ts", import.meta.url)
    );
    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || "Background processing failed"));
    };
    worker.onmessageerror = () => {
      cleanup();
      reject(new Error("Unable to read background result"));
    };
    worker.onmessage = (event) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.result);
    };
    try {
      worker.postMessage({ task, input });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

// Share a paste result with its dialog, without retaining an unbounded import history.
const detected = new Map<string, DetectedInput>();
export async function detectInputAsync(text: string, signal?: AbortSignal) {
  const cached = detected.get(text);
  if (cached) return cached;
  const result = await processOffThread("detect", text, signal);
  if (text.length <= 2_000_000) {
    detected.set(text, result);
    while (detected.size > 4) detected.delete(detected.keys().next().value!);
  }
  return result;
}
