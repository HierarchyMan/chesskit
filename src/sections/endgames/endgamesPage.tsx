import MiniBoard from "@/components/board/miniBoard";
import {
  ENDGAMES,
  ENDGAME_LEVELS,
  Endgame,
  challengeGoalText,
} from "@/lib/endgames";
import { setHandoff } from "@/lib/handoff";
import { statsAtom } from "@/lib/stats";
import { isGameInProgressAtom } from "@/sections/play/states";
import { hasPersistedPlayDraft } from "@/sections/play/usePlayRecovery";
import { Color } from "@/types/enums";
import { Icon } from "@iconify/react";
import {
  Box,
  Button,
  Card,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid2 as Grid,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useAtomValue } from "jotai";
import { useRouter } from "next/router";
import { useState } from "react";

const BOARD_SIZE = 168;

export default function EndgamesPage() {
  const router = useRouter();
  const completed = useAtomValue(statsAtom).endgames.completed;
  const gameInProgress = useAtomValue(isGameInProgressAtom);
  const [pending, setPending] = useState<Endgame | null>(null);

  const done = ENDGAMES.filter(({ id }) => completed.includes(id)).length;

  const launch = (endgame: Endgame) => {
    setHandoff(
      { kind: "challenge", id: endgame.id, source: "Endgames" },
      "/play"
    );
    router.push("/play");
  };

  const practice = (endgame: Endgame) => {
    if (gameInProgress || hasPersistedPlayDraft()) setPending(endgame);
    else launch(endgame);
  };

  return (
    <Stack spacing={3} sx={{ maxWidth: 1100, mx: "auto", py: 1 }}>
      <Box>
        <Typography variant="h4" fontWeight={700}>
          Endgames
        </Typography>
        <Typography color="text.secondary">
          Practice essential winning and drawing techniques against a
          full-strength opponent, with hints and takebacks available.
        </Typography>
      </Box>

      <Stack spacing={0.75}>
        <Stack direction="row" justifyContent="space-between">
          <Typography
            variant="body2"
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {done} of {ENDGAMES.length} completed
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={(done / ENDGAMES.length) * 100}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Stack>

      {ENDGAME_LEVELS.map((level) => {
        const items = ENDGAMES.filter((endgame) => endgame.level === level);
        if (items.length === 0) return null;

        return (
          <Box key={level}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ letterSpacing: "0.1em" }}
            >
              {level}
            </Typography>
            <Grid container spacing={2} mt={0} alignItems="flex-start">
              {items.map((endgame) => (
                <Grid key={endgame.id} size={{ xs: 12, md: 6 }}>
                  <EndgameCard
                    endgame={endgame}
                    completed={completed.includes(endgame.id)}
                    onPractice={() => practice(endgame)}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        );
      })}

      <Dialog open={!!pending} onClose={() => setPending(null)}>
        <DialogTitle>Leave your current game?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have a game in progress on the Play page. Starting this endgame
            will replace it.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>Keep my game</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              if (pending) launch(pending);
              setPending(null);
            }}
          >
            Leave current game
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function EndgameCard({
  endgame,
  completed,
  onPractice,
}: {
  endgame: Endgame;
  completed: boolean;
  onPractice: () => void;
}) {
  const [open, setOpen] = useState(false);
  const turn = endgame.fen.split(" ")[1] === "b" ? "b" : "w";

  return (
    <Card
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 1.5,
        borderColor: completed ? "success.main" : "divider",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        gap={2}
        alignItems={{ xs: "center", sm: "stretch" }}
      >
        <MiniBoard
          fen={endgame.fen}
          size={BOARD_SIZE}
          orientation={endgame.player === "w" ? Color.White : Color.Black}
          showCoordinates={true}
        />

        <Stack spacing={1} minWidth={0} flexGrow={1} width="100%">
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Typography fontWeight={600}>{endgame.title}</Typography>
            {completed && (
              <Box
                component="span"
                sx={{
                  color: "success.main",
                  display: "inline-flex",
                  flexShrink: 0,
                }}
              >
                <Icon icon="mdi:check-circle" height={20} />
              </Box>
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {endgame.summary}
          </Typography>

          <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
            <Chip
              size="small"
              color={endgame.goal === "win" ? "primary" : "default"}
              label={endgame.goal === "win" ? "Win" : "Draw"}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`You play ${endgame.player === "w" ? "White" : "Black"}`}
            />
            <Chip
              size="small"
              variant="outlined"
              icon={
                <Box
                  component="span"
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    border: 1,
                    borderColor: "divider",
                    bgcolor: turn === "w" ? "#f2f2f2" : "#1d1d1d",
                    ml: "6px !important",
                  }}
                />
              }
              label={`${turn === "w" ? "White" : "Black"} to move`}
            />
          </Stack>

          <Stack
            direction="row"
            gap={1}
            flexWrap="wrap"
            mt="auto !important"
            pt={0.5}
          >
            <Button
              size="small"
              variant="contained"
              startIcon={<Icon icon="mdi:play" height={18} />}
              onClick={onPractice}
            >
              {completed ? "Play again" : "Practice"}
            </Button>
            <Button
              size="small"
              color="inherit"
              endIcon={
                <Icon
                  icon={open ? "mdi:chevron-up" : "mdi:chevron-down"}
                  height={18}
                />
              }
              onClick={() => setOpen(!open)}
            >
              {open ? "Hide idea" : "Idea"}
            </Button>
          </Stack>
        </Stack>
      </Stack>

      <Collapse in={open}>
        <Stack spacing={1} mt={2}>
          <Typography variant="body2">
            <b>Goal.</b> {challengeGoalText(endgame)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {endgame.idea}
          </Typography>
          <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
            {endgame.tips.map((tip) => (
              <Typography key={tip} component="li" variant="body2">
                {tip}
              </Typography>
            ))}
          </Stack>
        </Stack>
      </Collapse>
    </Card>
  );
}
