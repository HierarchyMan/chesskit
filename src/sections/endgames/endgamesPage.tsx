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
    setHandoff({ kind: "challenge", id: endgame.id });
    router.push("/play");
  };

  const practise = (endgame: Endgame) => {
    if (gameInProgress) setPending(endgame);
    else launch(endgame);
  };

  return (
    <Stack spacing={3} sx={{ maxWidth: 1100, mx: "auto", py: 1 }}>
      <Box>
        <Typography variant="h4" fontWeight={700}>
          Endgames
        </Typography>
        <Typography sx={{ opacity: 0.75 }}>
          Each lesson starts from a position that has been checked with an
          engine. You play it out against the engine at full strength, with
          hints and takebacks available.
        </Typography>
      </Box>

      <Stack spacing={0.75}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2">
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
              sx={{ opacity: 0.7, letterSpacing: "0.1em" }}
            >
              {level}
            </Typography>
            <Grid container spacing={2} mt={0}>
              {items.map((endgame) => (
                <Grid key={endgame.id} size={{ xs: 12, md: 6 }}>
                  <EndgameCard
                    endgame={endgame}
                    completed={completed.includes(endgame.id)}
                    onPractise={() => practise(endgame)}
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
            onClick={() => {
              if (pending) launch(pending);
              setPending(null);
            }}
          >
            Start the endgame
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function EndgameCard({
  endgame,
  completed,
  onPractise,
}: {
  endgame: Endgame;
  completed: boolean;
  onPractise: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card
      variant="outlined"
      sx={{
        p: 2,
        height: "100%",
        borderColor: completed ? "success.main" : "divider",
      }}
    >
      <Stack direction="row" gap={2}>
        <MiniBoard
          fen={endgame.fen}
          size={BOARD_SIZE}
          orientation={endgame.player === "w" ? Color.White : Color.Black}
          showCoordinates={false}
        />

        <Stack spacing={1} minWidth={0} flexGrow={1}>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Typography fontWeight={600}>{endgame.title}</Typography>
            {completed && (
              <Icon icon="mdi:check-circle" height={20} color="#22ac38" />
            )}
          </Stack>

          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            {endgame.summary}
          </Typography>

          <Stack direction="row" gap={0.75} flexWrap="wrap">
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
          </Stack>

          <Stack direction="row" gap={1} mt="auto !important">
            <Button
              size="small"
              variant="contained"
              startIcon={<Icon icon="mdi:play" height={18} />}
              onClick={onPractise}
            >
              {completed ? "Play again" : "Practise"}
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
              Idea
            </Button>
          </Stack>
        </Stack>
      </Stack>

      <Collapse in={open}>
        <Stack spacing={1} mt={2}>
          <Typography variant="body2">
            <b>Goal.</b> {challengeGoalText(endgame)}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.85 }}>
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
