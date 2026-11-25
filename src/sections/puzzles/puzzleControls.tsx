import { MOVE_TIMES, MoveTime } from "@/lib/puzzleFlow";
import { Icon } from "@iconify/react";
import {
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { PuzzleTrainer } from "./usePuzzleTrainer";

interface Props {
  trainer: PuzzleTrainer;
}

/**
 * Pace and automation preferences for puzzle replies and advancing after solve.
 */
export default function PuzzleControls({ trainer }: Props) {
  const { moveTime, autoNext, autoJump } = trainer;

  return (
    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
      <Typography variant="body2" color="text.secondary">
        Pace
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={moveTime}
        aria-label="Move pace"
        onChange={(_, value: MoveTime | null) =>
          value && trainer.setMoveTime(value)
        }
      >
        {MOVE_TIMES.map(({ id, label }) => (
          <ToggleButton key={id} value={id} sx={{ px: 1.25, py: 0.5 }}>
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Tooltip title="When off, press Next move to play each opponent reply">
        <ToggleButton
          size="small"
          value="auto-reply"
          selected={autoNext}
          aria-label="Opponent replies automatically"
          onChange={() => trainer.setAutoNext(!autoNext)}
          sx={{ gap: 0.5, px: 1.25, py: 0.5 }}
        >
          <Icon icon="mdi:play" height={16} />
          Auto-reply
        </ToggleButton>
      </Tooltip>

      <Tooltip title="Automatically load the next puzzle after a clean solve">
        <ToggleButton
          size="small"
          value="auto-jump"
          selected={autoJump}
          aria-label="Auto-next puzzle on solve"
          onChange={() => trainer.setAutoJump(!autoJump)}
          sx={{ gap: 0.5, px: 1.25, py: 0.5 }}
        >
          <Icon icon="mdi:skip-next" height={16} />
          Auto-next
        </ToggleButton>
      </Tooltip>
    </Stack>
  );
}
