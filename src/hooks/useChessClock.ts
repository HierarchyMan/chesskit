import { Color } from "@/types/enums";
import { Chess } from "chess.js";
import { PrimitiveAtom, useSetAtom, useStore } from "jotai";
import { useEffect, useRef } from "react";

type Times = { w: number; b: number };

interface Options {
  clocksAtom: PrimitiveAtom<Times | null>;
  game: Chess;
  running: boolean;
  ready: boolean;
  gameId: number;
  initialMs: number;
  incrementMs: number;
  onTimeout: (loser: Color) => void;
}

const FIRST_MOVES_FREE_PLIES = 2;

export const useChessClock = ({
  clocksAtom,
  game,
  running,
  ready,
  gameId,
  initialMs,
  incrementMs,
  onTimeout,
}: Options) => {
  const store = useStore();
  const setClocks = useSetAtom(clocksAtom);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const timer = useRef<
    | {
        gameId: number;
        clocks: Times | null;
        at: number;
        ply: number;
        side: "w" | "b";
        ticking: boolean;
        checkpoints: Map<number, Times>;
      }
    | undefined
  >(undefined);

  const ply = game.history().length;
  const side = game.turn();

  useEffect(() => {
    if (!ready) return;
    const now = performance.now();
    const previous = timer.current;
    const ticking = running && initialMs > 0 && ply >= FIRST_MOVES_FREE_PLIES;
    if (!previous || previous.gameId !== gameId || !previous.clocks) {
      const clocks =
        initialMs > 0
          ? (store.get(clocksAtom) ?? { w: initialMs, b: initialMs })
          : null;
      timer.current = {
        gameId,
        clocks,
        at: now,
        ply,
        side,
        ticking,
        checkpoints: clocks ? new Map([[ply, clocks]]) : new Map(),
      };
      setClocks(clocks);
      return;
    }

    let { clocks } = previous;
    if (previous.ticking) {
      const chargedSide = previous.side;
      clocks = {
        ...clocks,
        [chargedSide]: Math.max(0, clocks[chargedSide] - (now - previous.at)),
      };
    }

    if (ply < previous.ply) {
      // Restore the position's clock and forget checkpoints on the undone branch.
      clocks = previous.checkpoints.get(ply) ?? clocks;
      for (const index of previous.checkpoints.keys()) {
        if (index > ply) previous.checkpoints.delete(index);
      }
    } else if (ply > previous.ply) {
      if (previous.ply >= FIRST_MOVES_FREE_PLIES && clocks[previous.side] > 0) {
        clocks = {
          ...clocks,
          [previous.side]: clocks[previous.side] + incrementMs,
        };
      }
      previous.checkpoints.set(ply, clocks);
    }

    const expired = clocks[previous.side] === 0;
    const expiredSide = previous.side;
    Object.assign(previous, {
      clocks,
      side,
      ply,
      at: now,
      ticking: ticking && !expired,
    });
    setClocks(clocks);
    if (expired && running)
      onTimeoutRef.current(expiredSide === "w" ? Color.White : Color.Black);
  }, [
    clocksAtom,
    gameId,
    incrementMs,
    initialMs,
    ply,
    ready,
    running,
    setClocks,
    side,
    store,
  ]);

  useEffect(() => {
    if (!running || !initialMs) return;
    const interval = setInterval(() => {
      const current = timer.current;
      if (!current?.ticking || !current.clocks) return;
      const now = performance.now();
      const side = current.side;
      const ms = Math.max(0, current.clocks[side] - (now - current.at));
      current.clocks = { ...current.clocks, [side]: ms };
      current.at = now;
      setClocks(current.clocks);
      if (ms === 0) {
        current.ticking = false;
        onTimeoutRef.current(side === "w" ? Color.White : Color.Black);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [initialMs, running, setClocks]);
};
