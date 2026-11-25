import { PageTitle } from "@/components/pageTitle";
import BoardWorkspace from "@/components/boardWorkspace";
import { usePlayOverlay } from "@/sections/play/usePlayOverlay";
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
import { usePlayRecovery } from "@/sections/play/usePlayRecovery";
import { useStartGame } from "@/sections/play/useStartGame";
import { Box } from "@mui/material";
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";

export default function Play() {
  const engineName = useAtomValue(enginePlayNameAtom);
  const botEngine = useEngineState(engineName, "Bot opponent");
  const isInProgress = useAtomValue(isGameInProgressAtom);
  const game = useAtomValue(gameAtom);
  const end = useAtomValue(gameEndAtom);
  const setStartingPosition = useSetAtom(startingPositionAtom);
  const { startChallenge } = useStartGame();
  const overlay = usePlayOverlay(botEngine.engine);
  const [coachSlot, setCoachSlot] = useState<HTMLDivElement | null>(null);

  const recoveryReady = usePlayRecovery();
  useGameLifecycle(overlay.interactiveCoach.choices.length > 0, recoveryReady);

  useHandoff(["fen", "challenge"], (handoff) => {
    if (handoff.kind === "challenge") startChallenge(handoff.id);
    else setStartingPosition(handoff.fen);
  });

  const hasGame = isInProgress || game.history().length > 0 || !!end;

  return (
    <>
      <PageTitle title="Chesskit Play" />
      <BoardWorkspace
        inspectorMinWidth={400}
        inspectorLabel="Play controls"
        board={
          <Board
            engine={botEngine.engine}
            setup={!hasGame}
            overlay={overlay}
            coachSlot={coachSlot}
          />
        }
        inspector={
          !recoveryReady ? null : hasGame ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
              }}
            >
              <GamePanel
                botEngine={botEngine}
                overlay={overlay}
                coach={overlay.coach}
                interactive={overlay.interactiveCoach}
                coachSlotRef={setCoachSlot}
              />
            </Box>
          ) : (
            <Box
              data-inspector-scroller
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                overscrollBehavior: "contain",
                scrollbarGutter: "stable",
              }}
            >
              <NewGamePanel botEngine={botEngine} />
            </Box>
          )
        }
      />
    </>
  );
}
