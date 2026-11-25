import { Icon } from "@iconify/react";
import {
  Box,
  Button,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { CascadeBoardProjection, CascadeBranch } from "@/lib/coachCascade";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

interface Props {
  cascade: CascadeBoardProjection;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReplay: () => void;
  onSwitchBranch: (branch: CascadeBranch) => void;
  onExit: () => void;
  onTryAgain?: () => void;
  /** In Analysis, show the step narration right inside the compact bar; in Play, the Coach Stage narrates it. */
  showCaption?: boolean;
}

export default function CascadeBar({
  cascade,
  onTogglePlay,
  onPrev,
  onNext,
  onReplay,
  onSwitchBranch,
  onExit,
  onTryAgain,
  showCaption = false,
}: Props) {
  useKeyboardShortcut(
    "ArrowLeft",
    (event) => {
      event.preventDefault();
      if (cascade.stepIndex > 0) onPrev();
    },
    cascade.active
  );
  useKeyboardShortcut(
    "ArrowRight",
    (event) => {
      event.preventDefault();
      if (cascade.stepIndex < cascade.maxStep) onNext();
    },
    cascade.active
  );
  useKeyboardShortcut(
    " ",
    (event) => {
      event.preventDefault();
      onTogglePlay();
    },
    cascade.active
  );
  useKeyboardShortcut(
    "Escape",
    (event) => {
      event.preventDefault();
      onExit();
    },
    cascade.active
  );

  if (!cascade.active) return null;

  const transportButtonSx = {
    width: 28,
    height: 28,
    borderRadius: 1,
    p: 0,
  };

  return (
    <Box
      data-cascade-bar
      sx={(theme) => ({
        width: "100%",
        minHeight: 44,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        px: 1.25,
        py: showCaption ? 0.75 : 0.45,
        borderRadius: 1,
        border: "1px solid",
        borderColor: alpha(theme.palette.warning.main, 0.42),
        bgcolor: alpha(
          theme.palette.warning.main,
          theme.palette.mode === "dark" ? 0.1 : 0.12
        ),
      })}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        rowGap={0.75}
        columnGap={1}
        flexWrap="wrap"
        sx={{ minWidth: 0 }}
      >
        <Stack
          direction="row"
          alignItems="center"
          gap={0.75}
          minWidth={0}
          flexWrap="wrap"
        >
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              color: "warning.main",
              flexShrink: 0,
            }}
          >
            <Icon icon="mdi:movie-open-outline" width={17} />
          </Box>
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ letterSpacing: 0.2, whiteSpace: "nowrap" }}
          >
            {cascade.branch === "better" ? "Better line" : "Showing why"}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            · {cascade.stepIndex}/{cascade.maxStep}
          </Typography>
          {cascade.hasBetterBranch && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={cascade.branch}
              onChange={(_, val: CascadeBranch | null) => {
                if (val) onSwitchBranch(val);
              }}
              sx={{
                ml: 0.25,
                flexShrink: 0,
                "& .MuiToggleButton-root": {
                  py: 0.2,
                  px: 0.85,
                  fontSize: "0.72rem",
                  lineHeight: 1.35,
                  whiteSpace: "nowrap",
                },
              }}
            >
              <ToggleButton value="played">Refutation</ToggleButton>
              <ToggleButton value="better">Best line</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Stack>

        <Stack
          direction="row"
          alignItems="center"
          gap={0.25}
          flexWrap="wrap"
          sx={{ ml: "auto" }}
        >
          <Tooltip title="Previous step (←)">
            <span>
              <IconButton
                size="small"
                onClick={onPrev}
                disabled={cascade.stepIndex <= 0}
                aria-label="Previous step"
                sx={transportButtonSx}
              >
                <Icon icon="mdi:chevron-left" width={18} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={cascade.playing ? "Pause (Space)" : "Play (Space)"}>
            <IconButton
              size="small"
              onClick={onTogglePlay}
              aria-label={cascade.playing ? "Pause cascade" : "Play cascade"}
              sx={transportButtonSx}
            >
              <Icon
                icon={cascade.playing ? "mdi:pause" : "mdi:play"}
                width={18}
              />
            </IconButton>
          </Tooltip>
          <Tooltip title="Next step (→)">
            <span>
              <IconButton
                size="small"
                onClick={onNext}
                disabled={cascade.stepIndex >= cascade.maxStep}
                aria-label="Next step"
                sx={transportButtonSx}
              >
                <Icon icon="mdi:chevron-right" width={18} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Replay">
            <IconButton
              size="small"
              onClick={onReplay}
              aria-label="Replay cascade"
              sx={transportButtonSx}
            >
              <Icon icon="mdi:replay" width={16} />
            </IconButton>
          </Tooltip>

          {cascade.canTryAgain && onTryAgain && (
            <Button
              size="small"
              variant="contained"
              onClick={onTryAgain}
              sx={{
                ml: 0.5,
                py: 0.25,
                px: 1.1,
                minHeight: 28,
                fontSize: "0.75rem",
                whiteSpace: "nowrap",
              }}
            >
              Try again
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={onExit}
            sx={{
              ml: 0.5,
              py: 0.25,
              px: 1.1,
              minHeight: 28,
              fontSize: "0.75rem",
              whiteSpace: "nowrap",
            }}
          >
            {cascade.exitLabel}
          </Button>
        </Stack>
      </Stack>

      {showCaption && cascade.caption && (
        <Typography
          variant="caption"
          aria-live="polite"
          sx={{
            display: "block",
            mt: 0.5,
            maxHeight: 52,
            overflowY: "auto",
            overflowWrap: "anywhere",
            color: "text.secondary",
            lineHeight: 1.4,
          }}
        >
          {cascade.san ? <strong>{cascade.san}: </strong> : null}
          {cascade.caption}
        </Typography>
      )}
    </Box>
  );
}
