import Panel from "@/components/panel";
import TopMovesPanel from "@/components/topMovesPanel";
import { useChessActions } from "@/hooks/useChessActions";
import { useEngineState } from "@/hooks/useEngine";
import { uciMoveParams } from "@/lib/chess";
import { effectiveMoveSide } from "@/lib/engine/topMoves";
import { useCallback } from "react";
import { BoardArrow } from "@/lib/arrows/types";
import { Icon } from "@iconify/react";
import { IconButton, Tooltip, Typography } from "@mui/material";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  boardArrowsAtom,
  analysisBoardKeyAtom,
  boardAtom,
  engineDepthAtom,
  engineMultiPvAtom,
  engineNameAtom,
  topMovesOpenAtom,
  topMovesSideAtom,
} from "../states";

export default function TopMovesSection() {
  const [open, setOpen] = useAtom(topMovesOpenAtom);

  if (!open) return null;

  return <TopMovesBody onClose={() => setOpen(false)} />;
}

function TopMovesBody({ onClose }: { onClose: () => void }) {
  const board = useAtomValue(boardAtom);
  const engineName = useAtomValue(engineNameAtom);
  const depth = useAtomValue(engineDepthAtom);
  const count = useAtomValue(engineMultiPvAtom);
  const [sideChoice, setSideChoice] = useAtom(topMovesSideAtom);
  const fen = board.fen();
  const positionKey = useAtomValue(analysisBoardKeyAtom);
  const side = effectiveMoveSide(sideChoice, fen, positionKey);
  const setArrows = useSetAtom(boardArrowsAtom);
  const publishArrows = useCallback(
    (arrows: BoardArrow[]) => setArrows({ positionKey, arrows }),
    [setArrows, positionKey]
  );
  const { playMove } = useChessActions(boardAtom);
  const engine = useEngineState(engineName, "Top moves");

  return (
    <Panel
      sx={{ width: "100%", maxWidth: 560, boxShadow: "none" }}
      title={<Typography fontWeight={600}>Top moves</Typography>}
      actions={
        <Tooltip title="Close">
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Close top moves"
          >
            <Icon icon="mdi:close" height={18} />
          </IconButton>
        </Tooltip>
      }
    >
      <TopMovesPanel
        fen={fen}
        positionKey={positionKey}
        engine={engine.engine}
        engineState={engine}
        side={side}
        onSideChange={(value) => {
          setArrows([]);
          setSideChoice({ side: value, fen, positionKey });
        }}
        count={count}
        depth={depth}
        onArrows={publishArrows}
        onPlay={
          side === "mover"
            ? (move) => playMove(uciMoveParams(move.uci), board)
            : undefined
        }
        playLabel="Play on board"
      />
    </Panel>
  );
}
