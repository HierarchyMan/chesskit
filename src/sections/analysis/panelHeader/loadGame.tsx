import LoadGameButton from "../../loadGame/loadGameButton";
import { useEffect } from "react";
import { evaluationProgressAtom, gameAtom } from "../states";
import { useLoadAnalysisGame } from "../hooks/useLoadAnalysisGame";
import { useGameDatabase } from "@/hooks/useGameDatabase";
import { useAtomValue } from "jotai";
import { useRouter } from "next/router";
import { fetchLichessGame } from "@/lib/lichess";
import { useHandoff } from "@/hooks/useHandoff";

export default function LoadGame() {
  const router = useRouter();
  const game = useAtomValue(gameAtom);
  const { gameFromUrl } = useGameDatabase();
  const evaluationProgress = useAtomValue(evaluationProgressAtom);
  const { loadPgn: resetAndSetGamePgn } = useLoadAnalysisGame();

  const { lichessGameId, orientation: orientationParam } = router.query;

  useEffect(() => {
    const handleLichess = async (id: string) => {
      const res = await fetchLichessGame(id);
      if (typeof res === "string") {
        resetAndSetGamePgn(res, orientationParam !== "black");
      }
    };

    if (gameFromUrl) {
      const orientation = !(
        gameFromUrl.site === "Chesskit.org" && gameFromUrl.black.name === "You"
      );
      resetAndSetGamePgn(gameFromUrl.pgn, orientation, gameFromUrl.eval);
    } else if (typeof lichessGameId === "string" && !!lichessGameId) {
      handleLichess(lichessGameId);
    }
  }, [gameFromUrl, lichessGameId, orientationParam, resetAndSetGamePgn]);

  useHandoff(["pgn"], ({ pgn, orientation }) => {
    resetAndSetGamePgn(pgn, orientation !== "black");
  });

  useEffect(() => {
    const eventHandler = (event: MessageEvent) => {
      try {
        if (!event?.data?.pgn) return;
        const { pgn, orientation } = event.data as {
          pgn: string;
          orientation?: "white" | "black";
        };
        resetAndSetGamePgn(pgn, orientation !== "black");
      } catch (error) {
        console.error("Error processing message event:", error);
      }
    };
    window.addEventListener("message", eventHandler);

    return () => {
      window.removeEventListener("message", eventHandler);
    };
  }, [resetAndSetGamePgn]);

  const isGameLoaded =
    gameFromUrl !== undefined ||
    (!!game.getHeaders().White && game.getHeaders().White !== "?") ||
    game.history().length > 0;

  if (evaluationProgress) return null;

  return (
    <LoadGameButton
      label={isGameLoaded ? "Load another game" : "Load game"}
      size="small"
      setGame={async (game) => {
        await router.replace(
          {
            query: {},
            pathname: router.pathname,
          },
          undefined,
          { shallow: true, scroll: false }
        );
        resetAndSetGamePgn(game.pgn());
      }}
    />
  );
}
