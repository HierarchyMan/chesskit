import Panel from "@/components/panel";
import { ENDGAMES, Endgame, challengeGoalText } from "@/lib/endgames";
import { Icon } from "@iconify/react";
import {
  Alert,
  Button,
  Chip,
  Collapse,
  Stack,
  Typography,
} from "@mui/material";
import { useAtomValue } from "jotai";
import { useRouter } from "next/router";
import { useState } from "react";
import { challengeStatusAtom } from "./states";
import { useStartGame } from "./useStartGame";

interface Props {
  endgame: Endgame;
}

export default function ChallengeCard({ endgame }: Props) {
  const router = useRouter();
  const status = useAtomValue(challengeStatusAtom);
  const { startChallenge } = useStartGame();
  const [showTips, setShowTips] = useState(false);

  const next = ENDGAMES[ENDGAMES.findIndex(({ id }) => id === endgame.id) + 1];

  return (
    <Panel
      title={
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Icon icon="mdi:chess-king" height={20} />
          <Typography fontWeight={600}>{endgame.title}</Typography>
          <Chip size="small" variant="outlined" label={endgame.level} />
        </Stack>
      }
    >
      <Stack spacing={1.25}>
        <Typography variant="body2">
          <b>Goal.</b> {challengeGoalText(endgame)}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.85 }}>
          {endgame.idea}
        </Typography>

        <Button
          size="small"
          color="inherit"
          sx={{ alignSelf: "flex-start" }}
          endIcon={
            <Icon
              icon={showTips ? "mdi:chevron-up" : "mdi:chevron-down"}
              height={18}
            />
          }
          onClick={() => setShowTips(!showTips)}
        >
          {showTips ? "Hide technique" : "Show technique"}
        </Button>
        <Collapse in={showTips}>
          <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
            {endgame.tips.map((tip) => (
              <Typography key={tip} component="li" variant="body2">
                {tip}
              </Typography>
            ))}
          </Stack>
        </Collapse>

        {status === "complete" && (
          <Alert severity="success">
            {endgame.goal === "win"
              ? "Checkmate. You converted the ending."
              : "You held the draw."}
          </Alert>
        )}
        {status === "failed" && (
          <Alert severity="warning">
            {endgame.goal === "win"
              ? "The game did not end in your win. Study the technique and try again."
              : "The draw slipped away. Study the technique and try again."}
          </Alert>
        )}

        {status !== "active" && (
          <Stack direction="row" gap={1} flexWrap="wrap">
            {status === "complete" && next && (
              <Button
                size="small"
                variant="contained"
                startIcon={<Icon icon="mdi:skip-next" height={18} />}
                onClick={() => startChallenge(next.id)}
              >
                Next: {next.title}
              </Button>
            )}
            <Button
              size="small"
              variant={status === "failed" ? "contained" : "outlined"}
              startIcon={<Icon icon="mdi:refresh" height={18} />}
              onClick={() => startChallenge(endgame.id)}
            >
              {status === "failed" ? "Try again" : "Play again"}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => router.push("/endgames")}
            >
              All endgames
            </Button>
          </Stack>
        )}
      </Stack>
    </Panel>
  );
}
