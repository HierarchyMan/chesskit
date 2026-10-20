import { PageTitle } from "@/components/pageTitle";
import { useBoardLayout } from "@/hooks/useBoardLayout";
import { useEngineState } from "@/hooks/useEngine";
import { useHandoff } from "@/hooks/useHandoff";
import Board from "@/sections/play/board";
import GamePanel from "@/sections/play/gamePanel";
import NewGamePanel from "@/sections/play/newGamePanel";
import {
  enginePlayNameAtom,
  gameAtom,
  gameEndAtom,
  isGameInProgressAtom,
  startingPositionAtom,
} from "@/sections/play/states";
import { useGameLifecycle } from "@/sections/play/useGameLifecycle";
import { useStartGame } from "@/sections/play/useStartGame";
import { Box } from "@mui/material";
import { useAtomValue, useSetAtom } from "jotai";

const SIDE_PANEL_WIDTH = 440;

export default function Play() {
  const engineName = useAtomValue(enginePlayNameAtom);
  const botEngine = useEngineState(engineName);
  const isInProgress = useAtomValue(isGameInProgressAtom);
  const game = useAtomValue(gameAtom);
  const end = useAtomValue(gameEndAtom);
  const setStartingPosition = useSetAtom(startingPositionAtom);
  const { startChallenge } = useStartGame();
  const { boardSize, sideBySide } = useBoardLayout({
    sidePanelWidth: SIDE_PANEL_WIDTH,
  });

  useGameLifecycle();

  useHandoff(["fen", "challenge"], (handoff) => {
    if (handoff.kind === "challenge") startChallenge(handoff.id);
    else setStartingPosition(handoff.fen);
  });

  const hasGame = isInProgress || game.history().length > 0 || !!end;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: sideBySide ? "row" : "column",
        justifyContent: "center",
        alignItems: sideBySide ? "flex-start" : "center",
        gap: 4,
      }}
    >
      <PageTitle title="Chesskit Play" />

      <Board engine={botEngine.engine} boardSize={boardSize} />

      <Box
        sx={{
          width: sideBySide ? SIDE_PANEL_WIDTH : "100%",
          maxWidth: "100%",
          mt: sideBySide ? "3.2rem" : 0,
        }}
      >
        {hasGame ? (
          <GamePanel botEngine={botEngine} />
        ) : (
          <NewGamePanel botEngine={botEngine} />
        )}
      </Box>
    </Box>
  );
}
