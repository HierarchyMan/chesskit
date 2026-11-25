import { Chip, Theme, Tooltip, alpha, useTheme } from "@mui/material";

interface Props {
  result?: string;
  perspectiveUserColor: "white" | "black";
}

export default function GameResultChip({
  result,
  perspectiveUserColor,
}: Props) {
  const theme = useTheme();

  const { label, shortLabel, color, bgColor } = getResultSpecs(
    theme,
    perspectiveUserColor,
    result
  );

  return (
    <Tooltip title={label}>
      <Chip
        label={shortLabel}
        size="small"
        sx={{
          color,
          backgroundColor: bgColor,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          minWidth: 44,
          border: `1px solid ${alpha(color, 0.25)}`,
          "& .MuiChip-icon": {
            color,
          },
        }}
      />
    </Tooltip>
  );
}

const getResultSpecs = (
  theme: Theme,
  perspectiveUserColor: "white" | "black",
  result?: string
) => {
  if (
    (result === "1-0" && perspectiveUserColor === "white") ||
    (result === "0-1" && perspectiveUserColor === "black")
  ) {
    return {
      label: result === "1-0" ? "Win (White won)" : "Win (Black won)",
      shortLabel: result,
      color: theme.palette.success.main,
      bgColor: alpha(theme.palette.success.main, 0.12),
    };
  }

  if (
    (result === "1-0" && perspectiveUserColor === "black") ||
    (result === "0-1" && perspectiveUserColor === "white")
  ) {
    return {
      label: result === "1-0" ? "Loss (White won)" : "Loss (Black won)",
      shortLabel: result,
      color: theme.palette.error.main,
      bgColor: alpha(theme.palette.error.main, 0.12),
    };
  }

  if (result === "1/2-1/2") {
    return {
      label: "Draw",
      shortLabel: "½–½",
      color: theme.palette.info.main,
      bgColor: alpha(theme.palette.info.main, 0.12),
    };
  }

  return {
    label: "Game in progress",
    shortLabel: result ?? "*",
    color: theme.palette.text.secondary,
    bgColor: theme.palette.action.hover,
  };
};
