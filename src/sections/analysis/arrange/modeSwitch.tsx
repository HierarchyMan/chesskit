import { Icon } from "@iconify/react";
import {
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useArrangeMode } from "./useArrangeMode";

export default function ModeSwitch() {
  const { arrange, enterArrange, finishArrange, validation } = useArrangeMode();

  const handleChange = (_: unknown, value: "play" | "arrange" | null) => {
    if (!value) return;
    if (value === "arrange" && !arrange) enterArrange();
    if (value === "play" && arrange) finishArrange();
  };

  const playBlocked = arrange && !validation.ok;

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="center"
      gap={1.5}
      width="100%"
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={arrange ? "arrange" : "play"}
        onChange={handleChange}
        aria-label="Board mode"
      >
        <ToggleButton value="play" disabled={playBlocked} sx={{ px: 2 }}>
          <Icon icon="mdi:chess-pawn" height={18} />
          &nbsp;Play moves
        </ToggleButton>
        <ToggleButton value="arrange" sx={{ px: 2 }}>
          <Icon icon="mdi:pencil-ruler" height={18} />
          &nbsp;Arrange pieces
        </ToggleButton>
      </ToggleButtonGroup>

      {playBlocked && (
        <Tooltip title={validation.problems.join(" ")}>
          <Typography variant="caption" color="error">
            Fix the position to continue
          </Typography>
        </Tooltip>
      )}
    </Stack>
  );
}
