import { IconButton, Tooltip } from "@mui/material";
import { Icon } from "@iconify/react";

interface Props {
  tooltip: string;
  icon: string;
  onClick?: () => void;
  disabled?: boolean;
  iconHeight?: number;
  /** A toggle that is on: shown in the primary colour and announced as pressed. */
  active?: boolean;
}

export const ToolbarButton = ({
  tooltip,
  icon,
  onClick,
  disabled = false,
  iconHeight = 24,
  active,
}: Props) => {
  return (
    <Tooltip title={tooltip} disableInteractive>
      <span>
        <IconButton
          onClick={onClick}
          disabled={disabled}
          aria-label={tooltip}
          aria-pressed={active}
          color={active ? "primary" : "default"}
          sx={{
            padding: "8px",
            borderRadius: "6px",
            width: "40px",
            height: "40px",
            flexShrink: 0,
            userSelect: "none",
            // A toggle that is off reads as dimmed, so its state is clear at a glance.
            opacity: active === false ? 0.5 : 1,
          }}
        >
          <Icon icon={icon} height={iconHeight} />
        </IconButton>
      </span>
    </Tooltip>
  );
};
