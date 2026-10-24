import { Button, Skeleton, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useAtomValue, useSetAtom } from "jotai";
import { boardAtom, currentPositionAtom } from "../../states";
import { useMemo } from "react";
import { getMoveFeedback } from "@/lib/bestMoveHint";
import Image from "next/image";
import PrettyMoveSan from "@/components/prettyMoveSan";
import { moveStoryAtom } from "@/lib/moveStoryState";
import { positionFor } from "@/lib/currentPosition";
import { buildMoveStory } from "@/lib/visualize/moveStory";
import { CLASSIFICATION_PHRASES } from "@/lib/classificationLabels";

export default function MoveInfo() {
  const board = useAtomValue(boardAtom);
  const position = positionFor(useAtomValue(currentPositionAtom), board.fen());
  const setMoveStory = useSetAtom(moveStoryAtom);

  const {
    classification: moveClassification,
    previousBestMove,
    canVisualize,
  } = useMemo(() => getMoveFeedback(position), [position]);

  if (board.history().length === 0) return null;

  if (!position.eval) {
    return (
      <Stack direction="row" alignItems="center" columnGap={5} marginTop={0.8}>
        <Skeleton
          variant="rounded"
          animation="wave"
          width={"12em"}
          sx={{ color: "transparent", maxWidth: "7vw" }}
        >
          <Typography align="center" fontSize="0.9rem">
            placeholder
          </Typography>
        </Skeleton>
      </Stack>
    );
  }

  const handleVisualize = () => {
    const move = position.lastMove;
    if (!move || !position.lastEval || !position.eval) return;

    setMoveStory({
      open: true,
      classification: moveClassification,
      story: buildMoveStory({
        fenBefore: move.before,
        playedUci: move.from + move.to + (move.promotion ?? ""),
        beforeLines: position.lastEval.lines,
        afterLines: position.eval.lines,
      }),
    });
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="center"
      columnGap={4}
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
            style={{
              maxWidth: "3.5vw",
              maxHeight: "3.5vw",
            }}
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

      {canVisualize && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<Icon icon="mdi:eye-outline" height={18} />}
          onClick={handleVisualize}
        >
          Visualize
        </Button>
      )}
    </Stack>
  );
}
