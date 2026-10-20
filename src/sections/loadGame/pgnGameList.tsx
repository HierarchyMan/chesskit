import { ParsedGame } from "@/lib/pgn";
import { List, ListItem, ListItemText } from "@mui/material";
import { ReactNode } from "react";

interface Props {
  games: ParsedGame[];
  renderActions: (game: ParsedGame) => ReactNode;
  actionsWidth?: number;
  maxHeight?: number;
}

export default function PgnGameList({
  games,
  renderActions,
  actionsWidth = 120,
  maxHeight = 280,
}: Props) {
  return (
    <List
      dense
      disablePadding
      sx={{
        maxHeight,
        overflowY: "auto",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        width: "100%",
      }}
    >
      {games.map((game) => (
        <ListItem
          key={game.index}
          divider
          secondaryAction={game.error ? undefined : renderActions(game)}
          sx={{ pr: game.error ? 2 : `${actionsWidth + 16}px` }}
        >
          <ListItemText
            primary={
              game.error
                ? `Game ${game.index + 1} could not be read`
                : `${game.white} vs ${game.black}`
            }
            secondary={
              game.error
                ? game.error
                : [
                    game.result,
                    `${Math.ceil(game.movesNb / 2)} moves`,
                    game.date,
                    game.event,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
            slotProps={{
              primary: { noWrap: true },
              secondary: { noWrap: true },
            }}
          />
        </ListItem>
      ))}
    </List>
  );
}
