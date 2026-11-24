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
import type { CascadeBoardProjection, CascadeBranch } from "@/lib/coachCascade";

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
  if (!cascade.active) return null;

  return (
    <Box
      data-cascade-bar
      sx={{
        width: "100%",
        height: showCaption ? undefined : 44,
        minHeight: 44,
        maxHeight: showCaption ? undefined : 44,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        px: 1.25,
        py: showCaption ? 1 : 0,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "rgba(245, 184, 46, 0.45)",
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? "rgba(245, 184, 46, 0.09)"
            : "rgba(245, 184, 46, 0.12)",
        overflowX: showCaption ? undefined : "auto",
        overflowY: "hidden",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        flexWrap={showCaption ? "wrap" : "nowrap"}
        sx={{ minWidth: 0 }}
      >
        <Stack
          direction="row"
          alignItems="center"
          gap={0.75}
          minWidth={0}
          sx={{ flexShrink: 0 }}
        >
          <Icon
            icon="mdi:movie-open-outline"
            width={17}
            style={{ color: "#f5b82e", flexShrink: 0 }}
          />
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ letterSpacing: 0.2, whiteSpace: "nowrap" }}
          >
            {cascade.branch === "better" ? "Better line" : "Showing why"}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              opacity: 0.72,
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
                ml: 0.5,
                flexShrink: 0,
                "& .MuiToggleButton-root": {
                  py: 0.15,
                  px: 0.85,
                  fontSize: "0.7rem",
                  lineHeight: 1.4,
                  textTransform: "none",
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
          sx={{ flexShrink: 0 }}
        >
          <Tooltip title="Previous step">
            <span>
              <IconButton
                size="small"
                onClick={onPrev}
                disabled={cascade.stepIndex <= 0}
                aria-label="Previous step"
              >
                <Icon icon="mdi:chevron-left" width={18} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={cascade.playing ? "Pause" : "Play"}>
            <IconButton
              size="small"
              onClick={onTogglePlay}
              aria-label={cascade.playing ? "Pause cascade" : "Play cascade"}
            >
              <Icon
                icon={cascade.playing ? "mdi:pause" : "mdi:play"}
                width={18}
              />
            </IconButton>
          </Tooltip>
          <Tooltip title="Next step">
            <span>
              <IconButton
                size="small"
                onClick={onNext}
                disabled={cascade.stepIndex >= cascade.maxStep}
                aria-label="Next step"
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
            onClick={onExit}
            sx={{
              ml: 0.5,
              py: 0.25,
              px: 1.1,
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
          sx={{
            display: "block",
            mt: 0.5,
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
