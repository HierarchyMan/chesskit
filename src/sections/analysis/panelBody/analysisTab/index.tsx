import { Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { boardAtom } from "../../states";
import { getGameResult } from "@/lib/gameResult";
import MoveInfo from "./moveInfo";
import Opening from "./opening";
import MovesPanel from "../classificationTab/movesPanel";

export default function AnalysisTab({ hidden = false }: { hidden?: boolean }) {
  const board = useAtomValue(boardAtom);
  const isGameOver = board.isGameOver();
  const result = isGameOver ? getGameResult(board, null) : null;

  return (
    <Stack
      spacing={1}
      sx={{
        display: hidden ? "none" : "flex",
        minWidth: 0,
        width: "100%",
      }}
    >
      <MoveInfo />
      <Opening />
      <MovesPanel visible={!hidden} />
      {result && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          gap={0.75}
          sx={{
            py: 0.75,
            px: 1.25,
            borderRadius: 1,
            bgcolor: "action.hover",
          }}
        >
          <Icon icon="mdi:flag-checkered" height={16} />
          <Typography variant="body2" fontWeight={600}>
            {result.reason} ·{" "}
            {result.result === "1/2-1/2" ? "½-½" : result.result}
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
