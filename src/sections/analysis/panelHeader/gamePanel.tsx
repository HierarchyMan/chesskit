import { Stack, Typography } from "@mui/material";
import { useAtomValue } from "jotai";
import { gameAtom } from "../states";

export default function GamePanel() {
  const game = useAtomValue(gameAtom);
  const gameHeaders = game.getHeaders();

  const hasGameInfo = !!gameHeaders.White && gameHeaders.White !== "?";

  if (!hasGameInfo) return null;

  const termination = gameHeaders.Termination || "";
  const result =
    termination.split(" ").length > 2 ? termination : gameHeaders.Result || "?";

  const entries = [
    { label: "Event", value: gameHeaders.Event },
    { label: "Site", value: gameHeaders.Site },
    { label: "Date", value: gameHeaders.Date },
    { label: "Result", value: result },
  ].filter((entry) => entry.value && entry.value !== "?");

  if (!entries.length) return null;

  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      columnGap={2}
      rowGap={0.5}
      sx={{ pt: 0.75 }}
    >
      {entries.map((entry) => (
        <Typography
          key={entry.label}
          variant="caption"
          color="text.secondary"
          noWrap
        >
          <strong style={{ fontWeight: 600 }}>{entry.label}: </strong>
          {entry.value}
        </Typography>
      ))}
    </Stack>
  );
}
