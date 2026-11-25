import { usePlayersData } from "@/hooks/usePlayersData";
import { Box, Stack, Typography } from "@mui/material";
import { gameAtom, gameEvalAtom } from "../../../states";
import { MoveClassification } from "@/types/enums";
import ClassificationRow from "./classificationRow";
import { useAtomValue } from "jotai";

export default function MovesClassificationsRecap() {
  const { white, black } = usePlayersData(gameAtom);
  const gameEval = useAtomValue(gameEvalAtom);

  if (!gameEval?.positions.length) return null;

  return (
    <Stack
      spacing={0.45}
      sx={{
        minWidth: 0,
        width: "100%",
        p: 1,
        borderRadius: 1.5,
        border: 1,
        borderColor: "divider",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 8.5rem minmax(0, 1fr)",
          alignItems: "center",
          columnGap: 1,
          pb: 0.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography
          variant="caption"
          fontWeight={600}
          align="center"
          noWrap
          title={white.name}
        >
          {white.name}
        </Typography>

        <Typography
          variant="caption"
          color="text.secondary"
          align="center"
          fontWeight={600}
        >
          Classification
        </Typography>

        <Typography
          variant="caption"
          fontWeight={600}
          align="center"
          noWrap
          title={black.name}
        >
          {black.name}
        </Typography>
      </Box>

      {sortedMoveClassfications.map((classification) => (
        <ClassificationRow
          key={classification}
          classification={classification}
        />
      ))}
    </Stack>
  );
}

export const sortedMoveClassfications = [
  MoveClassification.Splendid,
  MoveClassification.Perfect,
  MoveClassification.Best,
  MoveClassification.Excellent,
  MoveClassification.Okay,
  MoveClassification.Opening,
  MoveClassification.Inaccuracy,
  MoveClassification.Mistake,
  MoveClassification.Blunder,
];
