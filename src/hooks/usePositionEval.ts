import { engineDepthAtom } from "@/sections/analysis/states";
import { EngineFeature } from "@/lib/engine/featureEngines";
import { CurrentPosition } from "@/types/eval";
import { Chess } from "chess.js";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useEngineState } from "./useEngine";
import { useFeatureEngineName } from "./useFeatureEngineName";

const isOver = (fen: string): boolean => {
  try {
    return new Chess(fen).isGameOver();
  } catch {
    return true;
  }
};

/**
 * The engine's evaluation of one position, on the engine chosen for `feature`,
 * to the depth set for analysis. The snapshot names the position it describes,
 * so a board that has moved on can tell it is out of date (see `positionFor`).
 * The engine is loaded while `enabled`, which should follow the user's
 * choice and not the turn, and it searches only while `active`. No engine is
 * loaded, and nothing runs, while `enabled` is false.
 */
export const usePositionEval = ({
  feature,
  fen,
  enabled,
  active,
  lines,
}: {
  feature: EngineFeature;
  fen: string;
  enabled: boolean;
  active: boolean;
  lines: number;
}): CurrentPosition => {
  const engineName = useFeatureEngineName(feature);
  const depth = useAtomValue(engineDepthAtom);
  const engine = useEngineState(enabled ? engineName : undefined).engine;
  const [snapshot, setSnapshot] = useState<CurrentPosition>({});

  useEffect(() => {
    if (!enabled || !active || !engine || isOver(fen)) return;

    let current = true;
    engine
      .evaluatePositionWithUpdate({
        fen,
        depth,
        multiPv: lines,
        useCloudEval: false,
        setPartialEval: (partial) => {
          if (current) setSnapshot({ fen, eval: partial });
        },
      })
      .then((final) => {
        // An empty answer means a newer search took this one's place.
        if (current && final.lines.length) setSnapshot({ fen, eval: final });
      })
      .catch(() => undefined);

    return () => {
      current = false;
      void engine.stopAllCurrentJobs().catch(() => undefined);
    };
  }, [enabled, active, engine, fen, depth, lines]);

  return snapshot;
};
