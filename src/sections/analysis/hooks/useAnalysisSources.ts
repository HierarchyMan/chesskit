import { useHandoff } from "@/hooks/useHandoff";
import {
  newAnalysisSession,
  evaluationMatches,
  validateAnalysisSession,
} from "@/lib/analysisSession";
import { getGameDatabase, listAnalysisSessions } from "@/lib/gameDatabase";
import { fetchLichessGame } from "@/lib/lichess";
import { loadGameFromText } from "@/lib/pgn";
import { useSetAtom, useStore } from "jotai";
import { positionFromFen } from "@/lib/editorPosition";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  analysisSourceErrorAtom,
  restoreAnalysisSessionAtom,
} from "../sessionAtoms";
import {
  arrangeModeAtom,
  boardOrientationAtom,
  editablePositionAtom,
  boardAtom,
} from "../states";
import { useArrangeMode } from "../arrange/useArrangeMode";
import { useLoadAnalysisGame } from "./useLoadAnalysisGame";

export function useAnalysisSources(startInArrangeMode: boolean) {
  const store = useStore();
  const router = useRouter();
  const { loadPgn, loadFen } = useLoadAnalysisGame();
  const { enterArrange } = useArrangeMode();
  const restore = useSetAtom(restoreAnalysisSessionAtom);
  const setOrientation = useSetAtom(boardOrientationAtom);
  const setArrange = useSetAtom(arrangeModeAtom);
  const setPosition = useSetAtom(editablePositionAtom);
  const setSourceError = useSetAtom(analysisSourceErrorAtom);
  const { gameId, sessionId, lichessGameId, orientation } = router.query;
  const requestKey = JSON.stringify([
    router.isReady,
    gameId,
    sessionId,
    lichessGameId,
    orientation,
    startInArrangeMode,
  ]);
  const [settledKey, setSettledKey] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    let cancelled = false;
    setSourceError(null);
    void (async () => {
      let session;
      if (typeof sessionId === "string") {
        session = await (
          await getGameDatabase()
        ).get("analysisSessions", sessionId);
        if (!session) throw new Error("That analysis session was not found.");
      } else if (typeof gameId === "string" && /^\d+$/.test(gameId)) {
        const game = await (
          await getGameDatabase()
        ).get("games", Number(gameId));
        if (!game) throw new Error("That saved game was not found.");
        session = (await listAnalysisSessions()).find(
          (saved) =>
            saved.sourceGameId === game.id && saved.sourcePgn === game.pgn
        );
        if (!session) {
          session = newAnalysisSession(loadGameFromText(game.pgn), game.id);
          session.main.evaluation = evaluationMatches(
            game.eval,
            loadGameFromText(game.pgn)
          )
            ? game.eval
            : undefined;
          session.orientation = !(
            game.site === "Chesskit.org" && game.black.name === "You"
          );
        }
      } else if (typeof lichessGameId === "string") {
        const pgn = await fetchLichessGame(lichessGameId);
        if (!cancelled && typeof pgn === "string")
          loadPgn(pgn, orientation !== "black");
        return;
      }
      if (!session || cancelled) return;
      validateAnalysisSession(session);
      restore(session);
      setOrientation(session.orientation);
      setArrange(!!session.draft);
      if (session.draft) setPosition(session.draft);
      else if (startInArrangeMode) {
        setPosition(positionFromFen(store.get(boardAtom).fen()));
        setArrange(true);
      }
    })()
      .catch((error) => {
        if (!cancelled)
          setSourceError(
            error instanceof Error ? error.message : String(error)
          );
      })
      .finally(() => {
        if (!cancelled) setSettledKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [
    router.isReady,
    gameId,
    sessionId,
    lichessGameId,
    orientation,
    loadPgn,
    restore,
    setOrientation,
    setArrange,
    setPosition,
    setSourceError,
    startInArrangeMode,
    store,
    requestKey,
  ]);

  useHandoff(["fen", "pgn"], (handoff) => {
    if (handoff.kind === "pgn")
      loadPgn(handoff.pgn, handoff.orientation !== "black");
    else if (startInArrangeMode) enterArrange(handoff.fen);
    else loadFen(handoff.fen);
  });

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Only the established same-origin import channel can replace a session.
      if (
        event.origin !== window.location.origin ||
        typeof event.data?.pgn !== "string"
      )
        return;
      try {
        loadPgn(event.data.pgn, event.data.orientation !== "black");
      } catch (error) {
        console.error("Unable to import analysis game", error);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [loadPgn]);

  return !router.isReady || settledKey !== requestKey;
}
