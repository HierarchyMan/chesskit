import { LineEval } from "@/types/eval";
import { ButtonBase, ListItem, Skeleton, Typography } from "@mui/material";
import { useAtomValue } from "jotai";
import { boardAtom } from "../../../states";
import { getLineEvalLabel, moveLineUciToSan } from "@/lib/chess";
import { useChessActions } from "@/hooks/useChessActions";
import PrettyMoveSan from "@/components/prettyMoveSan";

interface Props {
  line: LineEval;
}

export default function LineEvaluation({ line }: Props) {
  const board = useAtomValue(boardAtom);
  const { addMoves } = useChessActions(boardAtom);
  const lineLabel = getLineEvalLabel(line);

  const isBlackCp =
    (line.cp !== undefined && line.cp < 0) ||
    (line.mate !== undefined && line.mate < 0);

  const showSkeleton = line.depth < 6;

  const uciToSan = moveLineUciToSan(board.fen());
  const turn = board.turn();

  const getColorFromMoveIdx = (moveIdx: number): "w" | "b" => {
    const moveColor = moveIdx % 2 === 0 ? turn : turn === "w" ? "b" : "w";
    return moveColor;
  };

  return (
    <ListItem disablePadding sx={{ alignItems: "flex-start", py: 0.5, gap: 1 }}>
      <Typography
        marginY={0.3}
        paddingY={0.2}
        noWrap
        overflow="visible"
        width="3.5em"
        minWidth="3.5em"
        textAlign="center"
        fontSize="0.85rem"
        sx={{
          flexShrink: 0,
          backgroundColor: isBlackCp ? "black" : "white",
          color: isBlackCp ? "white" : "black",
        }}
        borderRadius="5px"
        border="1px solid #424242"
        fontWeight="500"
      >
        {showSkeleton ? (
          <Skeleton
            variant="rounded"
            animation="wave"
            sx={{ color: "transparent" }}
          >
            placeholder
          </Skeleton>
        ) : (
          lineLabel
        )}
      </Typography>

      <Typography
        component="div"
        fontSize="0.95rem"
        lineHeight={1.8}
        sx={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}
      >
        {showSkeleton ? (
          <Skeleton variant="rounded" animation="wave" width="20em" />
        ) : (
          line.pv.map((uci, i) => {
            const san = uciToSan(uci);
            const moveColor = getColorFromMoveIdx(i);

            return (
              <PrettyMoveSan
                key={i}
                san={san}
                color={moveColor}
                additionalText={i < line.pv.length - 1 ? "," : ""}
                boxProps={{
                  component: ButtonBase,
                  onClick: () => {
                    addMoves(line.pv.slice(0, i + 1), board);
                  },
                  sx: {
                    cursor: "pointer",
                    border: 0,
                    background: "none",
                    color: "inherit",
                    font: "inherit",
                    p: 0,
                    borderRadius: "3px",
                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "primary.main",
                    },
                    ml: i ? 0.5 : 0,
                    transition: "opacity 0.2s ease-in-out",
                    "&:hover": {
                      opacity: 0.5,
                    },
                  },
                }}
              />
            );
          })
        )}
      </Typography>
    </ListItem>
  );
}
