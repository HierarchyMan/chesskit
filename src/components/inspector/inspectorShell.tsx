import {
  useWorkspaceLayout,
  useWorkspacePageFlow,
} from "@/components/boardWorkspace";
import { Icon } from "@iconify/react";
import {
  Box,
  BoxProps,
  Button,
  ButtonBase,
  ButtonProps,
  Stack,
  Tooltip,
  alpha,
} from "@mui/material";
import { ReactNode } from "react";

/** Full-height column shell matching Play's GamePanel workspace geometry. */
export function InspectorShell({ children, sx, ...rest }: BoxProps) {
  const pageFlow = useWorkspacePageFlow();
  return (
    <Box
      sx={[
        {
          display: "flex",
          flexDirection: "column",
          height: pageFlow ? "auto" : "100%",
          flex: pageFlow ? undefined : 1,
          minHeight: 0,
          bgcolor: "background.paper",
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    >
      {children}
    </Box>
  );
}

/** Slim fixed-height context header (46px) for every board inspector. */
export function InspectorHeader({
  left,
  right,
  sx,
}: {
  left: ReactNode;
  right?: ReactNode;
  sx?: BoxProps["sx"];
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap={1}
      sx={[
        {
          px: 1.5,
          py: 0.9,
          minHeight: 46,
          flexShrink: 0,
          borderBottom: 1,
          borderColor: "divider",
          userSelect: "none",
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Stack
        direction="row"
        alignItems="center"
        gap={0.65}
        minWidth={0}
        flexWrap="nowrap"
        sx={{ overflow: "hidden" }}
      >
        {left}
      </Stack>
      {right && (
        <Stack
          direction="row"
          alignItems="center"
          gap={0.5}
          sx={{ flexShrink: 0 }}
        >
          {right}
        </Stack>
      )}
    </Stack>
  );
}

export type PillTone = "neutral" | "primary" | "success" | "warning" | "error";

/** Compact 20px metadata/status pill matching GamePanel's header pills. */
export function InspectorPill({
  label,
  icon,
  tone = "neutral",
  tooltip,
  onClick,
  ariaLabel,
}: {
  label: ReactNode;
  icon?: string;
  tone?: PillTone;
  tooltip?: string;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const content = (
    <Box
      component={onClick ? ButtonBase : "span"}
      onClick={onClick}
      aria-label={ariaLabel}
      sx={(theme) => {
        const paletteColor =
          tone === "neutral" ? undefined : theme.palette[tone].main;
        return {
          display: "inline-flex",
          alignItems: "center",
          gap: 0.35,
          px: 0.75,
          height: 20,
          borderRadius: 999,
          fontSize: "0.7rem",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          flexShrink: 0,
          border: "1px solid",
          borderColor: paletteColor ? alpha(paletteColor, 0.42) : "transparent",
          bgcolor: paletteColor
            ? alpha(paletteColor, 0.14)
            : theme.palette.action.hover,
          color: paletteColor ?? theme.palette.text.secondary,
          ...(onClick
            ? {
                cursor: "pointer",
                transition: "background-color 140ms ease, color 140ms ease",
                "&:hover": {
                  bgcolor: paletteColor
                    ? alpha(paletteColor, 0.22)
                    : theme.palette.action.selected,
                  color: paletteColor ?? theme.palette.text.primary,
                },
              }
            : {}),
        };
      }}
    >
      {icon && <Icon icon={icon} height={12} />}
      {label}
    </Box>
  );

  return tooltip ? <Tooltip title={tooltip}>{content}</Tooltip> : content;
}

/** Flexing center scroll region with stable scrollbar gutter. */
export function InspectorBody({ children, sx, ...rest }: BoxProps) {
  const pageFlow = useWorkspacePageFlow();
  return (
    <Box
      data-inspector-scroller
      sx={[
        {
          flex: pageFlow ? undefined : 1,
          minHeight: pageFlow ? 120 : 120,
          overflowY: pageFlow ? "visible" : "auto",
          overscrollBehavior: pageFlow ? "auto" : "contain",
          scrollbarGutter: pageFlow ? undefined : "stable",
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    >
      {children}
    </Box>
  );
}

/** Docked tinted bottom control deck matching GamePanel's Zone 5. */
export function InspectorDeck({ children, sx, ...rest }: BoxProps) {
  return (
    <Box
      sx={[
        (theme) => ({
          flexShrink: 0,
          borderTop: 1,
          borderColor: "divider",
          bgcolor:
            theme.palette.mode === "dark"
              ? alpha(theme.palette.common.white, 0.025)
              : alpha(theme.palette.common.black, 0.018),
          userSelect: "none",
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    >
      {children}
    </Box>
  );
}

/** Fixed single-row action strip inside InspectorDeck (never wraps or jumps height). */
export function InspectorDeckRow({
  children,
  dividerTop = false,
  sx,
}: {
  children: ReactNode;
  dividerTop?: boolean;
  sx?: BoxProps["sx"];
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap={0.5}
      flexWrap="nowrap"
      sx={[
        {
          px: 1,
          py: 0.6,
          minHeight: 42,
          ...(dividerTop ? { borderTop: 1, borderColor: "divider" } : {}),
          overflowX: "auto",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Stack>
  );
}

/** Compact pill/text deck button matching GamePanel's Row B controls. */
export function DeckButton({
  active = false,
  subtle = false,
  danger = false,
  icon,
  children,
  sx,
  ...rest
}: Omit<ButtonProps, "startIcon"> & {
  active?: boolean;
  subtle?: boolean;
  danger?: boolean;
  icon?: string;
}) {
  const { sideBySide } = useWorkspaceLayout();
  return (
    <Button
      size="small"
      variant="text"
      startIcon={
        icon ? <Icon icon={icon} height={sideBySide ? 15 : 17} /> : undefined
      }
      sx={[
        (theme) => ({
          minHeight: sideBySide ? 30 : 38,
          minWidth: 0,
          px: sideBySide ? (subtle ? 0.65 : 0.8) : subtle ? 0.85 : 1.05,
          borderRadius: 1,
          fontSize: sideBySide ? "0.75rem" : "0.78rem",
          fontWeight: subtle ? 500 : 600,
          textTransform: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
          border: "1px solid",
          borderColor: active
            ? alpha(theme.palette.primary.main, 0.4)
            : "transparent",
          bgcolor: active
            ? alpha(theme.palette.primary.main, 0.16)
            : subtle
              ? "transparent"
              : theme.palette.action.hover,
          color: active
            ? theme.palette.primary.main
            : subtle
              ? theme.palette.text.secondary
              : theme.palette.text.primary,
          "&:hover": {
            bgcolor: danger
              ? alpha(theme.palette.error.main, 0.12)
              : active
                ? alpha(theme.palette.primary.main, 0.24)
                : subtle
                  ? theme.palette.action.hover
                  : theme.palette.action.selected,
            color: danger
              ? theme.palette.error.main
              : active
                ? theme.palette.primary.main
                : theme.palette.text.primary,
          },
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    >
      {children}
    </Button>
  );
}
