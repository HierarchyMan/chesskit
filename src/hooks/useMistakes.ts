import { useEffect, useState } from "react";
import type { Game } from "@/types/game";
import type { MistakeEntry } from "@/lib/mistakes";
import { processOffThread } from "@/lib/processing";

// Records are replaced on every database mutation. Identity includes PGN, names and eval.
const index = new WeakMap<Game, MistakeEntry[]>();
const EMPTY: MistakeEntry[] = [];
export function useMistakes(games: Game[], enabled = true, limit?: number) {
  const [result, setResult] = useState<{
    games: Game[];
    entries: MistakeEntry[];
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setError("");
    const update = async () => {
      const missing = games.filter((game) => !index.has(game));
      if (missing.length) {
        const entries = await processOffThread(
          "mistakes",
          missing,
          controller.signal
        );
        if (controller.signal.aborted) return;
        const grouped = new Map<number, MistakeEntry[]>();
        for (const entry of entries) {
          const group = grouped.get(entry.gameId) ?? [];
          group.push(entry);
          grouped.set(entry.gameId, group);
        }
        for (const game of missing)
          index.set(game, grouped.get(game.id) ?? EMPTY);
      }
      const entries = games
        .flatMap((game) => index.get(game) ?? EMPTY)
        .filter((entry) => entry.mine)
        .sort((a, b) => b.lostPercentage - a.lostPercentage);
      if (!controller.signal.aborted)
        setResult({
          games,
          entries: limit ? entries.slice(0, limit) : entries,
        });
    };
    void update().catch((reason) => {
      if (!controller.signal.aborted) setError(String(reason));
    });
    return () => controller.abort();
  }, [games, enabled, limit]);
  return {
    entries: enabled ? (result?.entries ?? EMPTY) : EMPTY,
    loading: enabled && result?.games !== games && !error,
    error,
  };
}
