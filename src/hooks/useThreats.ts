import { THREAT_GAIN } from "@/lib/arrows/tuning";
import { arrowTuningAtom } from "@/lib/arrows/tuningAtom";
import { BoardArrow } from "@/lib/arrows/types";
import { engineFeatureLabel } from "@/lib/engine/featureEngines";
import {
  findThreats,
  positionForThreats,
  threatArrows,
} from "@/lib/engine/threats";
import { PositionEval } from "@/types/eval";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEngineState } from "./useEngine";
import { useFeatureEngineName } from "./useFeatureEngineName";

const NO_ARROWS: BoardArrow[] = [];

interface Options {
  fen: string;
  /** The evaluation of the real position, which a threat is measured against. */
  main: PositionEval | undefined;
  enabled: boolean;
}

/**
 * The threats on the board showing `fen`: what the opponent would do if it were
 * their move, kept only when it would gain them enough over the position as it
 * stands. The search runs on the engine chosen for threats, an instance of its
 * own, so it never interrupts another search. Its raw result is kept per
 * position, which makes a change of sensitivity or of how many threats to show
 * free of any new search.
 */
export const useThreats = ({ fen, main, enabled }: Options): BoardArrow[] => {
  const engineName = useFeatureEngineName("threats");
  const tuning = useAtomValue(arrowTuningAtom);
  const handedOver = useMemo(() => positionForThreats(fen), [fen]);
  // Without an evaluation of the position there is nothing to measure against,
  // such as on a bot's turn, so no search is started for it.
  const hasMain = main !== undefined;
  const engine = useEngineState(
    enabled ? engineName : undefined,
    engineFeatureLabel("threats")
  ).engine;

  const cache = useRef(new Map<string, PositionEval>());
  const [result, setResult] = useState<{ key: string; passed: PositionEval }>();
  const { threatDepth, threatsShown } = tuning;
  const key = `${engineName}|${threatDepth}|${threatsShown}|${handedOver}`;

  useEffect(() => {
    if (!enabled || !engine || !handedOver || !hasMain) return;

    const known = cache.current.get(key);
    if (known) {
      setResult({ key, passed: known });
      return;
    }

    let current = true;
    engine
      .evaluatePositionWithUpdate({
        fen: handedOver,
        depth: threatDepth,
        multiPv: threatsShown,
        useCloudEval: false,
      })
      .then((passed) => {
        // An empty answer means a newer search took this one's place.
        if (!current || !passed.lines.length) return;
        cache.current.set(key, passed);
        setResult({ key, passed });
      })
      .catch(() => undefined);

    return () => {
      current = false;
      void engine.stopAllCurrentJobs().catch(() => undefined);
    };
  }, [enabled, engine, handedOver, hasMain, key, threatDepth, threatsShown]);

  return useMemo(() => {
    if (!enabled || !main || !handedOver || result?.key !== key) {
      return NO_ARROWS;
    }
    // Measured against a shallow evaluation, a threat would be noise.
    if ((main.lines[0]?.depth ?? 0) < tuning.settleDepth) return NO_ARROWS;

    return threatArrows(
      findThreats(fen, main, result.passed, {
        minimumGain: THREAT_GAIN[tuning.threatSensitivity],
        limit: tuning.threatsShown,
      })
    );
  }, [enabled, main, handedOver, result, key, fen, tuning]);
};
