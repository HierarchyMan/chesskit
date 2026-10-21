import { detectInput, parseGames, loadGameFromText } from "@/lib/pgn";
import { formatGameToDatabase } from "@/lib/chess";
import { collectMistakes } from "@/lib/mistakes";
import type { ProcessingTasks } from "@/lib/processing";

self.onmessage = (
  event: MessageEvent<{
    task: keyof ProcessingTasks;
    input: string | string[] | ProcessingTasks["mistakes"]["input"];
  }>
) => {
  try {
    const { task, input } = event.data;
    const result =
      task === "detect"
        ? detectInput(input as string)
        : task === "parse"
          ? parseGames(input as string)
          : task === "records"
            ? (input as string[]).map((pgn) =>
                formatGameToDatabase(loadGameFromText(pgn))
              )
            : collectMistakes(input as ProcessingTasks["mistakes"]["input"]);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Background processing failed",
    });
  }
};
