import { useInBoardInspector } from "@/components/boardWorkspace";
import { ENDGAMES, Endgame, challengeGoalText } from "@/lib/endgames";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  LinearProgress,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import { useAtomValue } from "jotai";
import { useRouter } from "next/router";
import { useState } from "react";
import { challengeStatusAtom, gameAtom } from "./states";
import { useStartGame } from "./useStartGame";

interface Props {
  endgame: Endgame;
}

export default function ChallengeCard({ endgame }: Props) {
  const router = useRouter();
  const inInspector = useInBoardInspector();
  const status = useAtomValue(challengeStatusAtom);
  const game = useAtomValue(gameAtom);
  const { startChallenge } = useStartGame();
  const [showTips, setShowTips] = useState(false);

  const next = ENDGAMES[ENDGAMES.findIndex(({ id }) => id === endgame.id) + 1];

  const isDrawHold = endgame.goal === "draw";
  const targetMoves = endgame.holdMoves ?? 20;
  const movesHeld = Math.min(
    targetMoves,
    Math.floor(game.history().length / 2)
  );
  const holdProgress = Math.min(100, (movesHeld / targetMoves) * 100);

  return (
    <Box
      sx={(theme) => ({
        px: 1.5,
        py: 1.15,
        flexShrink: 0,
        ...(inInspector
          ? {
              borderBottom: 1,
              borderColor: "divider",
              bgcolor:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.common.white, 0.018)
                  : alpha(theme.palette.common.black, 0.015),
            }
          : {
              border: 1,
              borderColor: "divider",
              borderRadius: 1.5,
              bgcolor: "background.paper",
            }),
      })}
    >
      <Stack spacing={1}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          flexWrap="wrap"
        >
          <Stack direction="row" alignItems="center" gap={0.75} minWidth={0}>
            <Icon icon="mdi:chess-king" height={18} />
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {endgame.title}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={endgame.level}
              sx={{ height: 20, fontSize: "0.68rem" }}
            />
          </Stack>

          {isDrawHold && (
            <Chip
              size="small"
              color={status === "complete" ? "success" : "primary"}
              variant={status === "complete" ? "filled" : "outlined"}
              label={`${movesHeld} / ${targetMoves} moves held`}
              sx={{
                height: 21,
                fontSize: "0.7rem",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            />
          )}
        </Stack>

        {isDrawHold && status === "active" && (
          <LinearProgress
            variant="determinate"
            value={holdProgress}
            aria-label={`${movesHeld} of ${targetMoves} moves held`}
            sx={{ height: 5, borderRadius: 999 }}
          />
        )}

        <Stack spacing={0.4}>
          <Typography
            variant="body2"
            sx={{ fontSize: "0.82rem", lineHeight: 1.4 }}
          >
            <strong>Goal:</strong> {challengeGoalText(endgame)}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: "0.8rem", lineHeight: 1.4 }}
          >
            {endgame.idea}
          </Typography>
        </Stack>

        <Box>
          <Button
            size="small"
            color="inherit"
            sx={{
              px: 0.75,
              ml: -0.75,
              minHeight: 26,
              fontSize: "0.76rem",
              color: "text.secondary",
              borderRadius: 1,
              textTransform: "none",
            }}
            endIcon={
              <Icon
                icon={showTips ? "mdi:chevron-up" : "mdi:chevron-down"}
                height={16}
              />
            }
            onClick={() => setShowTips(!showTips)}
          >
            {showTips ? "Hide technique" : "Show technique"}
          </Button>
          <Collapse in={showTips}>
            <Stack
              component="ul"
              spacing={0.5}
              sx={{ m: 0, mt: 0.5, pl: 2.25 }}
            >
              {endgame.tips.map((tip) => (
                <Typography
                  key={tip}
                  component="li"
                  variant="body2"
                  sx={{ fontSize: "0.8rem", lineHeight: 1.4 }}
                >
                  {tip}
                </Typography>
              ))}
            </Stack>
          </Collapse>
        </Box>

        {status === "complete" && (
          <Alert severity="success" sx={{ py: 0.25 }}>
            {endgame.goal === "win"
              ? "Checkmate. You converted the ending."
              : "You held the draw."}
          </Alert>
        )}
        {status === "failed" && (
          <Alert severity="warning" sx={{ py: 0.25 }}>
            {endgame.goal === "win"
              ? "The game did not end in your win. Study the technique and try again."
              : "The draw slipped away. Study the technique and try again."}
          </Alert>
        )}

        {status !== "active" && (
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            {status === "complete" && next && (
              <Button
                size="small"
                variant="contained"
                startIcon={<Icon icon="mdi:skip-next" height={17} />}
                onClick={() => startChallenge(next.id)}
                sx={{ borderRadius: 1 }}
              >
                Next: {next.title}
              </Button>
            )}
            <Button
              size="small"
              variant={status === "failed" ? "contained" : "outlined"}
              startIcon={<Icon icon="mdi:refresh" height={17} />}
              onClick={() => startChallenge(endgame.id)}
              sx={{ borderRadius: 1 }}
            >
              {status === "failed" ? "Try again" : "Play again"}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => router.push("/endgames")}
              sx={{ borderRadius: 1 }}
            >
              All endgames
            </Button>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
