import {
  newAnalysisSession,
  sameAnalysisContent,
  AnalysisSession,
  validateAnalysisSession,
} from "@/lib/analysisSession";
import {
  getAnalysisSession,
  listAnalysisSessions,
  saveAnalysisSession,
} from "@/lib/gameDatabase";
import { useAtom, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import {
  analysisReadyAtom,
  analysisSourceErrorAtom,
  analysisSessionAtom,
  analysisSaveRequestAtom,
  analysisSaveStateAtom,
  analysisSessionsRevisionAtom,
  restoreAnalysisSessionAtom,
} from "../sessionAtoms";
import {
  arrangeModeAtom,
  boardOrientationAtom,
  editablePositionAtom,
  arrangeFenDraftAtom,
} from "../states";

const ACTIVE_SESSION_KEY = "analysis-active-session";

export function useAnalysisPersistence() {
  const [session, setSession] = useAtom(analysisSessionAtom);
  const [ready, setReady] = useAtom(analysisReadyAtom);
  const [state, setState] = useAtom(analysisSaveStateAtom);
  const [request, setRequest] = useAtom(analysisSaveRequestAtom);
  const restore = useSetAtom(restoreAnalysisSessionAtom);
  const setSourceError = useSetAtom(analysisSourceErrorAtom);
  const setRevision = useSetAtom(analysisSessionsRevisionAtom);
  const [orientation] = useAtom(boardOrientationAtom);
  const [arrange] = useAtom(arrangeModeAtom);
  const [position] = useAtom(editablePositionAtom);
  const [draftInput] = useAtom(arrangeFenDraftAtom);
  const latest = useRef(session);
  const queued = useRef<
    { session: AnalysisSession; contentToken: string } | undefined
  >(undefined);
  latest.current = session;

  useEffect(() => {
    let current = true;
    if (latest.current) {
      setReady(true);
      return;
    }
    setState({ status: "loading" });
    void (async () => {
      let activeId: string | null = null;
      try {
        activeId = localStorage.getItem(ACTIVE_SESSION_KEY);
      } catch {
        /* IndexedDB remains authoritative. */
      }
      const saved = activeId
        ? await getAnalysisSession(activeId).catch((reason) => {
            if (current)
              setSourceError(
                `The last session could not be opened. Its stored backup remains available under Sessions. ${reason instanceof Error ? reason.message : String(reason)}`
              );
            return undefined;
          })
        : undefined;
      const recovered =
        saved ?? (await listAnalysisSessions())[0] ?? newAnalysisSession();
      validateAnalysisSession(recovered);
      if (!current || latest.current) return;
      restore(recovered);
      setReady(true);
    })().catch((error) => {
      if (current)
        setState({
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Unable to open analysis storage.",
        });
    });
    return () => {
      current = false;
    };
  }, [request, restore, setReady, setState, setSourceError]);

  useEffect(() => {
    if (!ready || !session) return;
    const draft = arrange ? position : undefined;
    if (
      session.orientation === orientation &&
      JSON.stringify(session.draft) === JSON.stringify(draft) &&
      session.draftInput === (arrange ? (draftInput ?? undefined) : undefined)
    )
      return;
    setSession({
      ...session,
      orientation,
      draft,
      draftInput: arrange ? (draftInput ?? undefined) : undefined,
      updatedAt: new Date().toISOString(),
    });
  }, [ready, session, orientation, arrange, position, draftInput, setSession]);

  useEffect(() => {
    if (!ready || !session) return;
    let current = true;
    setState({ status: "saving" });
    const previous = queued.current;
    const stateOnly =
      !!previous && sameAnalysisContent(previous.session, session);
    const contentToken = stateOnly
      ? previous!.contentToken
      : crypto.randomUUID();
    queued.current = { session, contentToken };
    void saveAnalysisSession(session, { contentToken, stateOnly })
      .then(() => {
        if (!current) return;
        try {
          localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
        } catch {
          /* Reopen via the session library. */
        }
        setState({ status: "saved" });
        setRevision((value) => value + 1);
      })
      .catch((error) => {
        if (current)
          setState({
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Unable to save analysis.",
          });
      });
    return () => {
      current = false;
    };
  }, [session, ready, request, setState, setRevision]);

  return {
    ready,
    state,
    retry: () => setRequest((value) => value + 1),
    continueUnsaved: () => {
      restore(newAnalysisSession());
      setReady(true);
    },
  };
}
