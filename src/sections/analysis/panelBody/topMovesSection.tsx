import Panel from "@/components/panel";
import TopMovesPanel from "@/components/topMovesPanel";
import { useChessActions } from "@/hooks/useChessActions";
import { useEngineState } from "@/hooks/useEngine";
import { uciMoveParams } from "@/lib/chess";
import { Icon } from "@iconify/react";
import { IconButton, Tooltip, Typography } from "@mui/material";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  boardArrowsAtom,
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
  const [side, setSide] = useAtom(topMovesSideAtom);
  const setArrows = useSetAtom(boardArrowsAtom);
  const { playMove } = useChessActions(boardAtom);
  const engine = useEngineState(engineName);

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
        fen={board.fen()}
        engine={engine.engine}
        engineStatus={engine.status}
        engineError={engine.error}
        onRetryEngine={engine.retry}
        side={side}
        onSideChange={setSide}
        count={count}
        depth={depth}
        onArrows={setArrows}
        onPlay={
          side === "mover"
            ? (move) => playMove(uciMoveParams(move.uci))
            : undefined
        }
        playLabel="Play on board"
      />
    </Panel>
  );
}
