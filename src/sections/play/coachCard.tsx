import { moveStoryAtom } from "@/lib/moveStoryState";
import Panel from "@/components/panel";
import { CLASSIFICATION_COLORS } from "@/constants";
import { useChessActions } from "@/hooks/useChessActions";
import {
  CLASSIFICATION_PHRASES,
  WORTH_VISUALIZING,
} from "@/lib/classificationLabels";
import { MoveClassification } from "@/types/enums";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useAtomValue, useSetAtom } from "jotai";
import Image from "next/image";
import { gameAtom } from "./states";
import { useMoveCoach } from "./useMoveCoach";

const GOOD_MOVES: MoveClassification[] = [
  MoveClassification.Best,
  MoveClassification.Excellent,
  MoveClassification.Perfect,
  MoveClassification.Splendid,
  MoveClassification.Opening,
  MoveClassification.Forced,
];

export default function CoachCard() {
  const { feedback, engineState, playerMoveIndex } = useMoveCoach(true);
  const game = useAtomValue(gameAtom);
  const setStory = useSetAtom(moveStoryAtom);
  const { goToMove } = useChessActions(gameAtom);

  const classification = feedback?.classification;
  const isGood = !!classification && GOOD_MOVES.includes(classification);
  const canVisualize =
    !!classification &&
    !!feedback?.story &&
    WORTH_VISUALIZING.includes(classification);
  const bestSan = feedback?.story?.bestSan;

  const visualize = () => {
    if (!feedback?.story) return;
    setStory({ open: true, story: feedback.story, classification });
  };

  return (
    <Panel
      title={
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon icon="mdi:school-outline" height={20} />
          <Typography fontWeight={600}>Coach</Typography>
        </Stack>
      }
    >
      <Stack spacing={1.25}>
        {engineState.status === "error" && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={engineState.retry}>
                Retry
              </Button>
            }
          >
            {engineState.error ?? "The coach's engine did not start."}
          </Alert>
        )}

        {!feedback && engineState.status !== "error" && (
          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            Make a move and I&apos;ll tell you how good it was.
          </Typography>
        )}

        {feedback?.status === "evaluating" && (
          <Stack direction="row" alignItems="center" gap={1}>
            <CircularProgress size={16} thickness={5} />
            <Typography variant="body2">
              Checking {feedback.playedSan}…
            </Typography>
          </Stack>
        )}

        {feedback?.status === "error" && (
          <Typography variant="body2" color="error">
            I couldn&apos;t check that move.
          </Typography>
        )}

        {feedback?.status === "done" && classification && (
          <>
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Chip
                size="small"
                label={classification}
                icon={
                  <Image
                    src={`/icons/${classification}.png`}
                    alt=""
                    width={16}
                    height={16}
                  />
                }
                sx={{
                  textTransform: "capitalize",
                  color: "#fff",
                  backgroundColor: CLASSIFICATION_COLORS[classification],
                }}
              />
              <Typography fontWeight={600}>
                {feedback.playedSan} is {CLASSIFICATION_PHRASES[classification]}
              </Typography>
            </Stack>

            {isGood && (
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Nicely done. Keep it up.
              </Typography>
            )}

            {!isGood && bestSan && (
              <Typography variant="body2">
                The engine preferred <b>{bestSan}</b>.{" "}
                {feedback.story?.summary[0]}
              </Typography>
            )}

            <Stack direction="row" gap={1} flexWrap="wrap">
              {canVisualize && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Icon icon="mdi:eye-outline" height={18} />}
                  onClick={visualize}
                >
                  Visualize
                </Button>
              )}
              {!isGood && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Icon icon="mdi:undo-variant" height={18} />}
                  disabled={playerMoveIndex < 0 || !game.history().length}
                  onClick={() => goToMove(playerMoveIndex, game)}
                >
                  Try again
                </Button>
              )}
            </Stack>
          </>
        )}

        <Box>
          <Typography variant="caption" sx={{ opacity: 0.6 }}>
            Coach checks each of your moves with the engine chosen for the coach
            in Settings, which is the analysis engine unless you change it.
          </Typography>
        </Box>
      </Stack>
    </Panel>
  );
}
