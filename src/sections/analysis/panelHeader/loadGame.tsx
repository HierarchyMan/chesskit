import LoadGameButton from "../../loadGame/loadGameButton";
import { evaluationProgressAtom, gameAtom } from "../states";
import { useLoadAnalysisGame } from "../hooks/useLoadAnalysisGame";
import { useAtomValue } from "jotai";
import { useRouter } from "next/router";

export default function LoadGame() {
  const router = useRouter();
  const game = useAtomValue(gameAtom);
  const progress = useAtomValue(evaluationProgressAtom);
  const { loadPgn } = useLoadAnalysisGame();
  if (progress) return null;
  return (
    <LoadGameButton
      label={game.history().length ? "Load another game" : "Load game"}
      size="small"
      setGame={async (game) => {
        await router.replace(
          { pathname: router.pathname, query: {} },
          undefined,
          { shallow: true, scroll: false }
        );
        loadPgn(game.pgn());
      }}
    />
  );
}
