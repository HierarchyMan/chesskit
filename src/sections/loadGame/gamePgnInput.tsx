import {
  Alert,
  Button,
  FormControl,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Icon } from "@iconify/react";
import React from "react";
import { ParsedGame } from "@/lib/pgn";
import PgnGameList from "./pgnGameList";

interface Props {
  pgn: string;
  setPgn: (pgn: string) => void;
  games: ParsedGame[];
  actionLabel: string;
  onSelectGame: (pgn: string) => void;
}

export default function GamePgnInput({
  pgn,
  setPgn,
  games,
  actionLabel,
  onSelectGame,
}: Props) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (e) => {
      const fileContent = e.target?.result as string;
      setPgn(fileContent);
    };

    reader.readAsText(file);
    event.target.value = "";
  };

  const [single] = games;

  return (
    <FormControl fullWidth>
      <Stack spacing={1.5}>
        <TextField
          label="Paste your PGN here (one game or many)"
          variant="outlined"
          multiline
          value={pgn}
          onChange={(e) => setPgn(e.target.value)}
          minRows={6}
          maxRows={10}
        />
        <BoxRow>
          <Button
            size="small"
            variant="outlined"
            component="label"
            startIcon={<Icon icon="mdi:upload" height={18} />}
          >
            Upload PGN file
            <input
              type="file"
              hidden
              accept=".pgn,.txt"
              onChange={handleFileChange}
            />
          </Button>
        </BoxRow>

        {games.length === 1 && single.error && (
          <Alert severity="error">{single.error}</Alert>
        )}

        {games.length === 1 && !single.error && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {single.white} vs {single.black} · {single.result} ·{" "}
            {Math.ceil(single.movesNb / 2)} moves
          </Typography>
        )}

        {games.length > 1 && (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Found {games.length} games. Pick one below.
            </Typography>
            <PgnGameList
              games={games}
              renderActions={(game) => (
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => onSelectGame(game.pgn)}
                >
                  {actionLabel}
                </Button>
              )}
            />
          </Stack>
        )}
      </Stack>
    </FormControl>
  );
}

function BoxRow({ children }: { children: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" gap={1}>
      {children}
    </Stack>
  );
}
