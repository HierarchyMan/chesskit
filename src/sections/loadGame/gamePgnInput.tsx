import {
  FormControl,
  TextField,
  Button,
  Alert,
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
      <TextField
        label="Paste your PGN here (one game or many)"
        variant="outlined"
        multiline
        value={pgn}
        onChange={(e) => setPgn(e.target.value)}
        rows={8}
        sx={{ mb: 2 }}
      />
      <Button
        variant="contained"
        component="label"
        startIcon={<Icon icon="material-symbols:upload" />}
      >
        Upload PGN File
        <input
          type="file"
          hidden
          accept=".pgn,.txt"
          onChange={handleFileChange}
        />
      </Button>

      {games.length === 1 && single.error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {single.error}
        </Alert>
      )}

      {games.length === 1 && !single.error && (
        <Typography variant="body2" sx={{ mt: 2, opacity: 0.8 }}>
          {single.white} vs {single.black} · {single.result} ·{" "}
          {Math.ceil(single.movesNb / 2)} moves
        </Typography>
      )}

      {games.length > 1 && (
        <>
          <Typography variant="body2" sx={{ mt: 2, mb: 1, opacity: 0.8 }}>
            Found {games.length} games. Pick the one you want.
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
        </>
      )}
    </FormControl>
  );
}
