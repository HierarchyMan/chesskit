import { PageTitle } from "@/components/pageTitle";
import BoardWorkspace from "@/components/boardWorkspace";
import { usePlayOverlay } from "@/sections/play/usePlayOverlay";
import { useEngineState } from "@/hooks/useEngine";
import { useHandoff } from "@/hooks/useHandoff";
import { Handoff } from "@/lib/handoff";
import Board from "@/sections/play/board";
import GamePanel from "@/sections/play/gamePanel";
import NewGamePanel from "@/sections/play/newGamePanel";
import {
  enginePlayNameAtom,
  gameAtom,
  gameEndAtom,
  isGameInProgressAtom,
  oddsAtom,
  queuedStartSourceAtom,
  startingPositionAtom,
} from "@/sections/play/states";
import { useGameLifecycle } from "@/sections/play/useGameLifecycle";
import { usePlayRecovery } from "@/sections/play/usePlayRecovery";
import { useStartGame } from "@/sections/play/useStartGame";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";

type PlayHandoff = Extract<Handoff, { kind: "fen" | "challenge" }>;

export default function Play() {
  const engineName = useAtomValue(enginePlayNameAtom);
  const botEngine = useEngineState(engineName, "Bot opponent");
  const isInProgress = useAtomValue(isGameInProgressAtom);
  const game = useAtomValue(gameAtom);
  const end = useAtomValue(gameEndAtom);
  const setStartingPosition = useSetAtom(startingPositionAtom);
  const setOdds = useSetAtom(oddsAtom);
  const setQueuedSource = useSetAtom(queuedStartSourceAtom);
  const { startChallenge, backToSetup } = useStartGame();
  const overlay = usePlayOverlay(botEngine.engine);
  const [coachSlot, setCoachSlot] = useState<HTMLDivElement | null>(null);
  const [pendingHandoff, setPendingHandoff] = useState<PlayHandoff | null>(
    null
  );

  const recoveryReady = usePlayRecovery();
  useGameLifecycle(overlay.interactiveCoach.choices.length > 0, recoveryReady);

  const hasGame = isInProgress || game.history().length > 0 || !!end;

  useHandoff(
    ["fen", "challenge"],
    (handoff) => {
      if (hasGame) {
        setPendingHandoff(handoff);
        return;
      }
      if (handoff.kind === "challenge") {
        setQueuedSource(null);
        startChallenge(handoff.id);
      } else {
        setOdds("none");
        setStartingPosition(handoff.fen);
        setQueuedSource(null);
      }
    },
    recoveryReady
  );

  const applyPendingNow = () => {
    if (!pendingHandoff) return;
    const handoff = pendingHandoff;
    setPendingHandoff(null);
    if (handoff.kind === "challenge") {
      setQueuedSource(null);
      startChallenge(handoff.id);
    } else {
      setOdds("none");
      setStartingPosition(handoff.fen);
      setQueuedSource(null);
      backToSetup();
    }
  };

  const queuePendingForNext = () => {
    if (!pendingHandoff || pendingHandoff.kind !== "fen") return;
    setOdds("none");
    setStartingPosition(pendingHandoff.fen);
    setQueuedSource(pendingHandoff.source ?? "another mode");
    setPendingHandoff(null);
  };

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
            <NewGamePanel botEngine={botEngine} />
          )
        }
      />

      <Dialog
        open={!!pendingHandoff}
        onClose={() => setPendingHandoff(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {isInProgress
            ? "Game already in progress"
            : "Finished game is still open"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingHandoff?.kind === "challenge"
              ? `You opened an endgame challenge from ${pendingHandoff.source ?? "Endgames"}. Starting it will replace your current game.`
              : `A custom board arrived from ${pendingHandoff?.source ?? "another page"}. You can replace your current game now, or queue this board so your next game inherits it.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 0.75, px: 2.5, pb: 2 }}>
          <Button onClick={() => setPendingHandoff(null)}>
            Keep current game
          </Button>
          {pendingHandoff?.kind === "fen" && (
            <Button variant="outlined" onClick={queuePendingForNext}>
              Use for next game
            </Button>
          )}
          <Button
            variant="contained"
            color={isInProgress ? "warning" : "primary"}
            onClick={applyPendingNow}
          >
            {pendingHandoff?.kind === "challenge"
              ? "Start challenge now"
              : "Start new game now"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
