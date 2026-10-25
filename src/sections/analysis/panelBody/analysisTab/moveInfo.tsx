import { Skeleton, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { boardAtom, currentPositionAtom } from "../../states";
import { useMemo } from "react";
import { getMoveFeedback } from "@/lib/bestMoveHint";
import Image from "next/image";
import PrettyMoveSan from "@/components/prettyMoveSan";
import { positionFor } from "@/lib/currentPosition";
import { CLASSIFICATION_PHRASES } from "@/lib/classificationLabels";

export default function MoveInfo() {
  const board = useAtomValue(boardAtom);
  const position = positionFor(useAtomValue(currentPositionAtom), board.fen());

  const { classification: moveClassification, previousBestMove } = useMemo(
    () => getMoveFeedback(position),
    [position]
  );

  if (board.history().length === 0) return null;

  if (!position.eval) {
    return (
      <Stack direction="row" alignItems="center" columnGap={5} marginTop={0.8}>
        <Skeleton
          variant="rounded"
          animation="wave"
          width={220}
          sx={{ color: "transparent", maxWidth: "100%" }}
        >
          <Typography align="center" fontSize="0.9rem">
            placeholder
          </Typography>
        </Skeleton>
      </Stack>
    );
  }

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="flex-start"
      columnGap={2}
      rowGap={1}
      marginTop={0.5}
      flexWrap="wrap"
    >
      {moveClassification && (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Image
            src={`/icons/${moveClassification}.png`}
            alt="move-icon"
            width={16}
            height={16}
          />

          <PrettyMoveSan
            typographyProps={{
              fontSize: "0.9rem",
            }}
            san={position.lastMove?.san ?? ""}
            color={position.lastMove?.color ?? "w"}
            additionalText={" is " + CLASSIFICATION_PHRASES[moveClassification]}
          />
        </Stack>
      )}

      {previousBestMove && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          flexWrap="wrap"
          sx={{ color: "text.secondary" }}
        >
          <Icon icon="mdi:history" height={16} />
          <Typography variant="caption">{previousBestMove.context},</Typography>
          <PrettyMoveSan
            typographyProps={{
              variant: "caption",
            }}
            san={previousBestMove.alternative.san}
            color={previousBestMove.alternative.color}
            additionalText=" was the best move"
          />
        </Stack>
      )}
    </Stack>
  );
}
