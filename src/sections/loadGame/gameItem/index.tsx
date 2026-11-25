import type React from "react";
import {
  Box,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { LoadedGame } from "@/types/game";
import TimeControlChip from "./timeControlChip";
import MovesNbChip from "./movesNbChip";
import DateChip from "./dateChip";
import GameResultChip from "./gameResultChip";

interface Props {
  game: LoadedGame;
  onClick: () => void;
  perspectiveUserColor: "white" | "black";
}

export const GameItem: React.FC<Props> = ({
  game,
  onClick,
  perspectiveUserColor,
}) => {
  const { white, black, result, timeControl, date, movesNb } = game;

  const whiteWon = result === "1-0";
  const blackWon = result === "0-1";

  return (
    <ListItem disablePadding sx={{ mb: 1 }}>
      <ListItemButton
        onClick={onClick}
        sx={{
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
          px: 1.75,
          py: 1.25,
          alignItems: "flex-start",
          "&:hover": {
            bgcolor: "action.hover",
            borderColor: "text.secondary",
          },
        }}
      >
        <ListItemText
          disableTypography
          primary={
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
              mb={0.85}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 0.75,
                  minWidth: 0,
                }}
              >
                <Typography
                  variant="body2"
                  component="span"
                  noWrap
                  sx={{
                    fontWeight: whiteWon ? 700 : 500,
                    color: blackWon ? "text.secondary" : "text.primary",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatPlayer(white)}
                </Typography>

                <Typography
                  variant="caption"
                  component="span"
                  color="text.secondary"
                >
                  vs
                </Typography>

                <Typography
                  variant="body2"
                  component="span"
                  noWrap
                  sx={{
                    fontWeight: blackWon ? 700 : 500,
                    color: whiteWon ? "text.secondary" : "text.primary",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatPlayer(black)}
                </Typography>
              </Box>

              <GameResultChip
                result={result}
                perspectiveUserColor={perspectiveUserColor}
              />
            </Stack>
          }
          secondary={
            <Stack
              direction="row"
              gap={0.75}
              alignItems="center"
              flexWrap="wrap"
            >
              <TimeControlChip timeControl={timeControl} />
              <MovesNbChip movesNb={movesNb} />
              <DateChip date={date} />
            </Stack>
          }
        />
      </ListItemButton>
    </ListItem>
  );
};

const formatPlayer = (player: LoadedGame["white"]) => {
  const base = player.title ? `${player.title} ${player.name}` : player.name;
  return player.rating != null ? `${base} (${player.rating})` : base;
};
