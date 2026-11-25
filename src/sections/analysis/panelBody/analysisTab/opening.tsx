import { useAtom, useAtomValue } from "jotai";
import { Box, ButtonBase, Collapse, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import {
  currentPositionAtom,
  gameAtom,
  gameDetailsOpenAtom,
} from "../../states";
import GameDetails from "../../panelHeader/gamePanel";

export default function Opening() {
  const position = useAtomValue(currentPositionAtom);
  const game = useAtomValue(gameAtom);
  const [detailsOpen, setDetailsOpen] = useAtom(gameDetailsOpenAtom);

  const lastMove = position?.lastMove;
  const opening = lastMove ? position?.eval?.opening || position.opening : "";
  const headers = game.getHeaders();
  const hasGameDetails = !!headers.White && headers.White !== "?";

  if (!opening && !hasGameDetails) return null;

  return (
    <Box
      sx={{
        px: 1,
        py: 0.5,
        borderRadius: 1,
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? "rgba(255, 255, 255, 0.025)"
            : "rgba(0, 0, 0, 0.02)",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          title={opening || undefined}
          sx={{ minWidth: 0, flex: 1, fontWeight: 500 }}
        >
          {opening || "Game info"}
        </Typography>

        {hasGameDetails && (
          <ButtonBase
            onClick={() => setDetailsOpen((value) => !value)}
            aria-expanded={detailsOpen}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.25,
              px: 0.5,
              py: 0.15,
              borderRadius: 0.5,
              color: "text.secondary",
              fontSize: "0.75rem",
              flexShrink: 0,
              "&:hover": { color: "text.primary", bgcolor: "action.hover" },
            }}
          >
            <span>Details</span>
            <Icon
              icon={detailsOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
              height={14}
            />
          </ButtonBase>
        )}
      </Stack>

      {hasGameDetails && (
        <Collapse in={detailsOpen}>
          <GameDetails />
        </Collapse>
      )}
    </Box>
  );
}
