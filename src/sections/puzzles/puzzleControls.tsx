import { MOVE_TIMES, MoveTime } from "@/lib/puzzleFlow";
import { Icon } from "@iconify/react";
import {
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { PuzzleTrainer } from "./usePuzzleTrainer";

interface Props {
  trainer: PuzzleTrainer;
}

/**
 * How fast the puzzle moves, and whether it moves by itself. These are
 * preferences, so they live with the other settings below the puzzle; the
 * Next move button they lead to is in the puzzle's action row.
 */
export default function PuzzleControls({ trainer }: Props) {
  const { moveTime, autoNext } = trainer;

  return (
    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
      <Typography variant="body2" sx={{ opacity: 0.75 }}>
        Replies
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={moveTime}
        aria-label="Move time"
        onChange={(_, value: MoveTime | null) =>
          value && trainer.setMoveTime(value)
        }
      >
        {MOVE_TIMES.map(({ id, label }) => (
          <ToggleButton key={id} value={id} sx={{ px: 1.5, py: 0.5 }}>
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <ToggleButton
        size="small"
        value="auto"
        selected={autoNext}
        aria-label="Opponent moves automatically"
        title="When off, press Next move to see each reply"
        onChange={() => trainer.setAutoNext(!autoNext)}
        sx={{ gap: 0.75, px: 1.5, py: 0.5 }}
      >
        <Icon icon="mdi:play" height={16} />
        Auto
      </ToggleButton>
    </Stack>
  );
}
