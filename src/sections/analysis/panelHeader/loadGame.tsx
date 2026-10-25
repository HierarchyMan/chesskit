import LoadGameButton from "../../loadGame/loadGameButton";
import { useLoadAnalysisGame } from "../hooks/useLoadAnalysisGame";
import { useRouter } from "next/router";

export default function LoadGame() {
  const router = useRouter();
  const { loadPgn } = useLoadAnalysisGame();
  return (
    <LoadGameButton
      label="Load game"
      size="small"
      variant="outlined"
      setGame={async (game, pgn) => {
        await router.replace(
          { pathname: router.pathname, query: {} },
          undefined,
          { shallow: true, scroll: false }
        );
        loadPgn(pgn ?? game.pgn());
      }}
    />
  );
}
