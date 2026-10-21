import { EngineState, useEngineState } from "@/hooks/useEngine";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { PropsWithChildren, createContext, useContext, useEffect } from "react";
import { useCurrentPosition } from "./hooks/useCurrentPosition";
import { engineNameAtom, evaluationProgressAtom, gameAtom } from "./states";
import {
  analysisFullRequestAtom,
  analysisSessionAtom,
  analysisTargetKey,
} from "./sessionAtoms";

const FALLBACK: EngineState = {
  engine: null,
  status: "idle",
  retry: () => undefined,
};

const AnalysisEngineContext = createContext<EngineState>(FALLBACK);

export function AnalysisEngineProvider({ children }: PropsWithChildren) {
  const engineName = useAtomValue(engineNameAtom);
  const engineState = useEngineState(engineName);
  const session = useAtomValue(analysisSessionAtom);
  const game = useAtomValue(gameAtom);
  const [request, setRequest] = useAtom(analysisFullRequestAtom);
  const setProgress = useSetAtom(evaluationProgressAtom);
  const target = analysisTargetKey(session, game);
  const retry = engineState.retry;

  useEffect(() => {
    if (request && request.target !== target) {
      setRequest(null);
      setProgress(0);
      // A game-wide search marks its instance busy. Replace that instance when
      // its target changes, so the new board can immediately start analysis.
      retry();
    }
  }, [request, target, retry, setRequest, setProgress]);
  useEffect(
    () => () => {
      setRequest(null);
      setProgress(0);
    },
    [setRequest, setProgress]
  );

  useCurrentPosition(engineState.engine);

  return (
    <AnalysisEngineContext.Provider value={engineState}>
      {children}
    </AnalysisEngineContext.Provider>
  );
}

export const useAnalysisEngine = () => useContext(AnalysisEngineContext);
