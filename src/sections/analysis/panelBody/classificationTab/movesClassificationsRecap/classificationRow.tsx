import { Color, MoveClassification } from "@/types/enums";
import { Box, ButtonBase, Stack, Tooltip, Typography } from "@mui/material";
import { useAtomValue } from "jotai";
import { boardAtom, gameAtom, gameEvalAtom } from "../../../states";
import Image from "next/image";
import { classificationName } from "@/lib/classificationLabels";
import { useChessActions } from "@/hooks/useChessActions";
import { CLASSIFICATION_COLORS } from "@/constants";

interface Props {
  classification: MoveClassification;
}

export default function ClassificationRow({ classification }: Props) {
  const gameEval = useAtomValue(gameEvalAtom);
  const board = useAtomValue(boardAtom);
  const game = useAtomValue(gameAtom);
  const { goToMove } = useChessActions(boardAtom);
  const moves = game.history({ verbose: true });
  const label = classificationName(classification);
  const colorHex = CLASSIFICATION_COLORS[classification];

  const whiteNb =
    gameEval?.positions.filter(
      (position, idx) =>
        moves[idx - 1]?.color === "w" &&
        position.moveClassification === classification
    ).length ?? 0;

  const blackNb =
    gameEval?.positions.filter(
      (position, idx) =>
        moves[idx - 1]?.color === "b" &&
        position.moveClassification === classification
    ).length ?? 0;

  const handleClick = (color: Color) => {
    if (
      !gameEval ||
      (color === Color.White && !whiteNb) ||
      (color === Color.Black && !blackNb)
    ) {
      return;
    }

    const filterColor = (idx: number) => moves[idx - 1]?.color === color;
    const moveIdx = board.history().length;

    const nextPositionIdx = gameEval.positions.findIndex(
      (position, idx) =>
        filterColor(idx) &&
        position.moveClassification === classification &&
        idx > moveIdx
    );

    if (nextPositionIdx > 0) {
      goToMove(nextPositionIdx, game);
    } else {
      const firstPositionIdx = gameEval.positions.findIndex(
        (position, idx) =>
          filterColor(idx) && position.moveClassification === classification
      );
      if (firstPositionIdx > 0 && firstPositionIdx !== moveIdx) {
        goToMove(firstPositionIdx, game);
      }
    }
  };

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 8.5rem minmax(0, 1fr)",
        alignItems: "center",
        columnGap: 1,
        py: 0.2,
      }}
    >
      <CountPill
        count={whiteNb}
        colorHex={colorHex}
        tooltip={whiteNb ? `Jump to next White ${label}` : `No White ${label}`}
        onClick={() => handleClick(Color.White)}
      />

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="flex-start"
        gap={0.85}
        sx={{ minWidth: 0 }}
      >
        <Image
          src={`/icons/${classification}.png`}
          alt=""
          width={18}
          height={18}
          style={{ flexShrink: 0 }}
        />
        <Typography
          variant="body2"
          fontWeight={500}
          noWrap
          sx={{ color: colorHex, fontSize: "0.84rem" }}
        >
          {label}
        </Typography>
      </Stack>

      <CountPill
        count={blackNb}
        colorHex={colorHex}
        tooltip={blackNb ? `Jump to next Black ${label}` : `No Black ${label}`}
        onClick={() => handleClick(Color.Black)}
      />
    </Box>
  );
}

function CountPill({
  count,
  colorHex,
  tooltip,
  onClick,
}: {
  count: number;
  colorHex: string;
  tooltip: string;
  onClick: () => void;
}) {
  const disabled = count === 0;
  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <Tooltip title={tooltip} disableInteractive>
        <span>
          <ButtonBase
            disabled={disabled}
            onClick={onClick}
            aria-label={tooltip}
            sx={{
              minWidth: 36,
              height: 26,
              px: 1,
              borderRadius: 1,
              fontSize: "0.84rem",
              fontWeight: disabled ? 400 : 700,
              fontVariantNumeric: "tabular-nums",
              color: disabled ? "text.disabled" : colorHex,
              bgcolor: disabled ? "transparent" : "action.hover",
              transition: "background-color 120ms ease",
              "&:hover": disabled ? undefined : { bgcolor: "action.selected" },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.main",
              },
            }}
          >
            {count}
          </ButtonBase>
        </span>
      </Tooltip>
    </Box>
  );
}
