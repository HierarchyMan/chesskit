import { useWorkspaceLayout } from "@/components/boardWorkspace";
import { Box, BoxProps, Stack, alpha } from "@mui/material";
import { ReactNode } from "react";

/**
 * [1] Locked 38–40px context strip above the board in vertical workspaces.
 * Keeps identity, score/turn status, and primary mode toggles visible without
 * shifting the board below it.
 */
export function VerticalContextStrip({
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
      gap={0.75}
      data-vertical-context
      sx={[
        {
          height: 40,
          minHeight: 40,
          maxHeight: 40,
          px: 0.75,
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          flexShrink: 0,
          overflow: "hidden",
          userSelect: "none",
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Stack
        direction="row"
        alignItems="center"
        gap={0.6}
        minWidth={0}
        flexWrap="nowrap"
        sx={{ overflow: "hidden", flex: 1 }}
      >
        {left}
      </Stack>
      {right && (
        <Stack
          direction="row"
          alignItems="center"
          gap={0.45}
          sx={{ flexShrink: 0 }}
        >
          {right}
        </Stack>
      )}
    </Stack>
  );
}

/**
 * [3] Bounded live feedback / active input strip directly beneath the board.
 * Reserves a stable minHeight so step-by-step commentary never causes jarring jumps.
 */
export function VerticalLiveStrip({
  children,
  minHeight = 64,
  sx,
  ...rest
}: BoxProps & { minHeight?: number }) {
  return (
    <Box
      data-vertical-live
      sx={[
        {
          minHeight,
          px: 1.25,
          py: 0.9,
          borderRadius: 1.25,
          border: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          flexShrink: 0,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    >
      {children}
    </Box>
  );
}

/**
 * [4] Single-row 52px thumb action bar for vertical workspaces.
 * On phones (< 600px), sits inside BoardWorkspace's sticky bottom dock with
 * safe-area padding; on wider portrait viewports (>= 600px), rests directly
 * beneath the live feedback strip.
 */
export function WorkspaceActionBar({
  left,
  right,
  children,
  sx,
}: {
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  sx?: BoxProps["sx"];
}) {
  const { isCompactPhone } = useWorkspaceLayout();

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap={0.5}
      flexWrap="nowrap"
      data-vertical-action-bar
      sx={[
        (theme) => ({
          minHeight: 52,
          px: isCompactPhone ? 1 : 1.25,
          py: 0.65,
          borderTop: 1,
          borderColor: "divider",
          ...(isCompactPhone
            ? {
                bgcolor: alpha(theme.palette.background.paper, 0.94),
                backdropFilter: "blur(12px)",
                pb: "calc(6px + env(safe-area-inset-bottom, 0px))",
              }
            : {
                border: 1,
                borderColor: "divider",
                borderRadius: 1.25,
                bgcolor:
                  theme.palette.mode === "dark"
                    ? alpha(theme.palette.common.white, 0.025)
                    : alpha(theme.palette.common.black, 0.018),
              }),
          userSelect: "none",
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children ?? (
        <>
          <Stack
            direction="row"
            alignItems="center"
            gap={0.35}
            flexWrap="nowrap"
            sx={{ minWidth: 0, flexShrink: 0 }}
          >
            {left}
          </Stack>
          {right && (
            <Stack
              direction="row"
              alignItems="center"
              gap={0.35}
              flexWrap="nowrap"
              sx={{ ml: "auto", flexShrink: 0 }}
            >
              {right}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
