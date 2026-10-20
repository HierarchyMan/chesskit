import { EngineState, useEngineState } from "@/hooks/useEngine";
import { useAtomValue } from "jotai";
import { PropsWithChildren, createContext, useContext } from "react";
import { useCurrentPosition } from "./hooks/useCurrentPosition";
import { engineNameAtom } from "./states";

const FALLBACK: EngineState = {
  engine: null,
  status: "idle",
  retry: () => undefined,
};

const AnalysisEngineContext = createContext<EngineState>(FALLBACK);

export function AnalysisEngineProvider({ children }: PropsWithChildren) {
  const engineName = useAtomValue(engineNameAtom);
  const engineState = useEngineState(engineName);

  useCurrentPosition(engineState.engine);

  return (
    <AnalysisEngineContext.Provider value={engineState}>
      {children}
    </AnalysisEngineContext.Provider>
  );
}

export const useAnalysisEngine = () => useContext(AnalysisEngineContext);
