import { useWorkspaceLayout } from "@/components/boardWorkspace";
import { IconButton, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Icon } from "@iconify/react";

interface Props {
  tooltip: string;
  icon: string;
  onClick?: () => void;
  disabled?: boolean;
  iconHeight?: number;
  /** A toggle that is on: shown in the primary colour and announced as pressed. */
  active?: boolean;
  /** Destructive action: stays muted until hovered, then shifts to error styling. */
  danger?: boolean;
}

export const ToolbarButton = ({
  tooltip,
  icon,
  onClick,
  disabled = false,
  iconHeight = 20,
  active,
  danger = false,
}: Props) => {
  const { sideBySide } = useWorkspaceLayout();
  const touchSize = sideBySide ? 36 : 40;
  return (
    <Tooltip title={tooltip} disableInteractive>
      <span>
        <IconButton
          onClick={onClick}
          disabled={disabled}
          aria-label={tooltip}
          aria-pressed={active}
          color={active ? "primary" : "default"}
          sx={(theme) => ({
            padding: "6px",
            borderRadius: 1,
            width: touchSize,
            height: touchSize,
            flexShrink: 0,
            userSelect: "none",
            color: danger
              ? theme.palette.text.secondary
              : active
                ? theme.palette.primary.main
                : undefined,
            bgcolor: active
              ? alpha(theme.palette.primary.main, 0.14)
              : "transparent",
            // A toggle that is off reads slightly dimmed, so its state is clear at a glance.
            opacity: active === false ? 0.6 : 1,
            transition:
              "background-color 140ms ease, color 140ms ease, opacity 140ms ease",
            "&:hover": {
              opacity: 1,
              color: danger ? theme.palette.error.main : undefined,
              bgcolor: danger
                ? alpha(theme.palette.error.main, 0.12)
                : active
                  ? alpha(theme.palette.primary.main, 0.22)
                  : theme.palette.action.hover,
            },
          })}
        >
          <Icon icon={icon} height={iconHeight} />
        </IconButton>
      </span>
    </Tooltip>
  );
};
