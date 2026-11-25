import { useGameDatabase } from "@/hooks/useGameDatabase";
import { getGameFromPgn } from "@/lib/chess";
import { useParsedInput } from "@/hooks/useParsedInput";
import { GameOrigin } from "@/types/enums";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { setContext as setSentryContext } from "@sentry/react";
import { Chess } from "chess.js";
import { useState } from "react";
import GamePgnInput from "./gamePgnInput";
import ChessComInput from "./chessComInput";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import LichessInput from "./lichessInput";
import { useSetAtom } from "jotai";
import { boardOrientationAtom } from "../analysis/states";

interface Props {
  open: boolean;
  onClose: () => void;
  setGame?: (game: Chess, pgn?: string) => Promise<void>;
}

const ORIGIN_OPTIONS: { value: GameOrigin; label: string }[] = [
  { value: GameOrigin.ChessCom, label: "Chess.com" },
  { value: GameOrigin.Lichess, label: "Lichess" },
  { value: GameOrigin.Pgn, label: "PGN" },
];

export default function NewGameDialog({ open, onClose, setGame }: Props) {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const [pgn, setPgn] = useState("");
  const [gameOrigin, setGameOrigin] = useLocalStorage(
    "preferred-game-origin",
    GameOrigin.ChessCom
  );
  const [parsingError, setParsingError] = useState("");
  const setBoardOrientation = useSetAtom(boardOrientationAtom);
  const { addGame, addGames } = useGameDatabase();

  const { detected, error: inputError } = useParsedInput(pgn, open, "parse");
  const parsedGames = detected.kind === "pgn" ? detected.games : [];
  const readableGames = parsedGames.filter((game) => !game.error);

  const handleAddGame = async (rawPgn: string, boardOrientation?: boolean) => {
    if (!rawPgn) return;

    try {
      const gameToAdd = getGameFromPgn(rawPgn);
      setSentryContext("loadedGame", { pgn: rawPgn });

      if (setGame) {
        await setGame(gameToAdd, rawPgn);
      } else {
        await addGame(gameToAdd, rawPgn);
      }

      setBoardOrientation(boardOrientation ?? true);
      handleClose();
    } catch (error) {
      console.error(error);
      setParsingError(
        error instanceof Error ? error.message : "Invalid PGN: unknown error."
      );
    }
  };

  const handleAddAll = async () => {
    try {
      const result = await addGames(readableGames.map((game) => game.pgn));
      if (result.errors.length) {
        setParsingError(result.errors.join("; "));
        return;
      }
      handleClose();
    } catch (error) {
      setParsingError(String(error));
    }
  };

  const handleClose = () => {
    setPgn("");
    setParsingError("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={isSmall}
      fullWidth
      maxWidth="sm"
      scroll="paper"
    >
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", gap: 1, pr: 2 }}
      >
        <Icon icon="mdi:folder-open-outline" height={22} />
        <Box sx={{ flexGrow: 1 }}>
          {setGame ? "Load a game" : "Add a game to your database"}
        </Box>
        <IconButton
          onClick={handleClose}
          aria-label="Close"
          edge="end"
          size="small"
        >
          <Icon icon="mdi:close" height={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={gameOrigin ?? GameOrigin.ChessCom}
            aria-label="Game source"
            onChange={(_, next: GameOrigin | null) => {
              if (!next) return;
              setGameOrigin(next);
              setParsingError("");
            }}
          >
            {ORIGIN_OPTIONS.map((option) => (
              <ToggleButton key={option.value} value={option.value}>
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {inputError && <Alert severity="error">{inputError}</Alert>}
          {parsingError && (
            <Alert severity="error" onClose={() => setParsingError("")}>
              {parsingError}
            </Alert>
          )}

          {gameOrigin === GameOrigin.Pgn && (
            <GamePgnInput
              pgn={pgn}
              setPgn={setPgn}
              games={parsedGames}
              actionLabel={setGame ? "Analyze" : "Add"}
              onSelectGame={(selected) => handleAddGame(selected)}
            />
          )}

          {gameOrigin === GameOrigin.ChessCom && (
            <ChessComInput onSelect={handleAddGame} />
          )}

          {gameOrigin === GameOrigin.Lichess && (
            <LichessInput onSelect={handleAddGame} />
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button onClick={handleClose}>Cancel</Button>
        {gameOrigin === GameOrigin.Pgn && readableGames.length <= 1 && (
          <Button
            variant="contained"
            disabled={readableGames.length === 0}
            onClick={() => {
              handleAddGame(readableGames[0]?.pgn ?? pgn);
            }}
          >
            {setGame ? "Analyze" : "Add"}
          </Button>
        )}
        {gameOrigin === GameOrigin.Pgn &&
          !setGame &&
          readableGames.length > 1 && (
            <Button variant="contained" onClick={handleAddAll}>
              Add all {readableGames.length} games
            </Button>
          )}
      </DialogActions>
    </Dialog>
  );
}
