import { loadGameFromText } from "@/lib/pgn";
import { isEngineId } from "@/lib/engine/models";
import { isChessPrefix } from "@/lib/chessHistory";
import { Color } from "@/types/enums";
import { Chess } from "chess.js";
import { atom, useAtomValue, useStore } from "jotai";
import { useEffect, useState } from "react";
import {
  activeCoachAtom,
  activeGameModeAtom,
  activeTimeControlAtom,
  boardFlippedAtom,
  botStrengthAtom,
  challengeIdAtom,
  challengeStatusAtom,
  clocksAtom,
  enginePlayNameAtom,
  gameAtom,
  gameEndAtom,
  gameIdAtom,
  isGameInProgressAtom,
  playerColorAtom,
} from "./states";

const KEY = "play-draft-v1";
const snapshotAtom = atom((get) => ({
  active: get(isGameInProgressAtom),
  game: get(gameAtom),
  gameId: get(gameIdAtom),
  color: get(playerColorAtom),
  mode: get(activeGameModeAtom),
  time: get(activeTimeControlAtom),
  coach: get(activeCoachAtom),
  engine: get(enginePlayNameAtom),
  strength: get(botStrengthAtom),
  flipped: get(boardFlippedAtom),
  challenge: get(challengeIdAtom),
  challengeStatus: get(challengeStatusAtom),
}));

type Draft = Omit<ReturnType<typeof snapshotAtom.read>, "active" | "game"> & {
  pgn: string;
  clocks: { w: number; b: number } | null;
};

const restoreAtom = atom(null, (_get, set, draft: Draft, game: Chess) => {
  set(gameAtom, game);
  set(gameIdAtom, draft.gameId);
  set(playerColorAtom, draft.color);
  set(activeGameModeAtom, draft.mode);
  set(activeTimeControlAtom, draft.time);
  set(activeCoachAtom, draft.coach);
  set(enginePlayNameAtom, draft.engine);
  set(botStrengthAtom, draft.strength);
  set(boardFlippedAtom, draft.flipped);
  set(challengeIdAtom, draft.challenge);
  set(challengeStatusAtom, draft.challengeStatus);
  set(clocksAtom, draft.clocks);
  set(gameEndAtom, null);
  set(isGameInProgressAtom, true);
});

function readDraft() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const draft = JSON.parse(raw) as Draft;
  if (
    !draft ||
    !Number.isSafeInteger(draft.gameId) ||
    draft.gameId < 1 ||
    (draft.color !== Color.White && draft.color !== Color.Black) ||
    (draft.mode !== "formal" && draft.mode !== "casual") ||
    !draft.time ||
    !Number.isFinite(draft.time.minutes) ||
    draft.time.minutes < 0 ||
    !Number.isFinite(draft.time.increment) ||
    draft.time.increment < 0 ||
    !isEngineId(draft.engine) ||
    !draft.strength ||
    !["elo", "depth", "max"].includes(draft.strength.mode) ||
    !Number.isFinite(draft.strength.elo) ||
    !Number.isFinite(draft.strength.depth) ||
    typeof draft.coach !== "boolean" ||
    typeof draft.flipped !== "boolean" ||
    typeof draft.pgn !== "string" ||
    (draft.clocks &&
      (!Number.isFinite(draft.clocks.w) || !Number.isFinite(draft.clocks.b)))
  ) {
    return null;
  }
  return draft;
}

/** Persist the active game on moves and save the live clock at bounded intervals. */
export function usePlayRecovery() {
  const store = useStore();
  const state = useAtomValue(snapshotAtom);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      if (!store.get(isGameInProgressAtom) && store.get(gameIdAtom) === 0) {
        const draft = readDraft();
        if (draft) {
          const game = loadGameFromText(draft.pgn);
          if (
            !game.isGameOver() &&
            isChessPrefix(new Chess(game.getHeaders().FEN), game)
          ) {
            store.set(restoreAtom, draft, game);
          }
        }
      }
    } catch {
      // Private browsing, corrupt storage, or an older draft.
    }
    setReady(true);
  }, [store]);

  useEffect(() => {
    if (!ready) return;
    const save = () => {
      const { active, game, ...data } = store.get(snapshotAtom);
      try {
        if (active && !game.isGameOver()) {
          const draft: Draft = {
            ...data,
            pgn: game.pgn(),
            clocks: store.get(clocksAtom),
          };
          localStorage.setItem(KEY, JSON.stringify(draft));
        } else {
          localStorage.removeItem(KEY);
        }
      } catch {
        // Playing remains possible when storage is unavailable.
      }
    };
    save();
    if (!state.active) return;
    window.addEventListener("pagehide", save);
    const interval =
      state.time.minutes > 0 ? window.setInterval(save, 1000) : undefined;
    return () => {
      window.removeEventListener("pagehide", save);
      window.clearInterval(interval);
    };
  }, [ready, state, store]);
  return ready;
}
