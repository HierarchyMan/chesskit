import MiniBoard from "@/components/board/miniBoard";
import { useGameDatabase } from "@/hooks/useGameDatabase";
import { setHandoff } from "@/lib/handoff";
import { fetchLichessGame } from "@/lib/lichess";
import {
  DetectedInput,
  ParsedGame,
  detectInput,
  fenToPgn,
  loadGameFromText,
} from "@/lib/pgn";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAtom } from "jotai";
import Image from "next/image";
import { useRouter } from "next/router";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { importDialogAtom } from "../layout/states";
import PgnGameList from "../loadGame/pgnGameList";

interface LichessState {
  status: "idle" | "loading" | "done" | "error";
  pgn?: string;
  error?: string;
}

export default function SmartImportDialog() {
  const [dialog, setDialog] = useAtom(importDialogAtom);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);
  const [lichess, setLichess] = useState<LichessState>({ status: "idle" });
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { addGame } = useGameDatabase();

  useEffect(() => {
    if (!dialog.open) return;

    setText(dialog.initialText ?? "");
    setImage(dialog.initialImage);
    setLichess({ status: "idle" });
    setNotice("");
  }, [dialog]);

  const deferredText = useDeferredValue(text);
  const detected: DetectedInput = useMemo(
    () => (image ? { kind: "unknown" } : detectInput(deferredText)),
    [deferredText, image]
  );

  const lichessId = detected.kind === "lichess" ? detected.id : undefined;

  useEffect(() => {
    if (!lichessId) {
      setLichess({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setLichess({ status: "loading" });

    fetchLichessGame(lichessId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;

      if (typeof result === "string") {
        setLichess({ status: "done", pgn: result });
      } else {
        setLichess({ status: "error", error: result.error });
      }
    });

    return () => controller.abort();
  }, [lichessId]);

  const close = () => setDialog({ open: false });

  const go = (path: string) => {
    close();
    router.push(path);
  };

  const openPgn = (pgn: string, path: string) => {
    setHandoff({
      kind: "pgn",
      pgn,
      orientation:
        detected.kind === "lichess" ? detected.orientation : undefined,
    });
    go(path);
  };

  const openFen = (fen: string, path: string) => {
    setHandoff({ kind: "fen", fen });
    go(path);
  };

  const saveGames = async (games: ParsedGame[]) => {
    let saved = 0;
    for (const game of games) {
      if (game.error) continue;
      try {
        await addGame(loadGameFromText(game.pgn));
        saved++;
      } catch (error) {
        console.error(error);
      }
    }
    setNotice(`Saved ${saved} game${saved === 1 ? "" : "s"} to your database.`);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();

    if (file.type.startsWith("image/")) {
      reader.onload = () => {
        setImage(String(reader.result));
        setText("");
      };
      reader.readAsDataURL(file);
      return;
    }

    reader.onload = () => {
      setImage(undefined);
      setText(String(reader.result));
    };
    reader.readAsText(file);
  };

  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          readFile(new File([blob], "clipboard", { type: imageType }));
          return;
        }
      }
      setImage(undefined);
      setText(await navigator.clipboard.readText());
    } catch {
      setNotice("Your browser blocked clipboard access. Press Ctrl+V instead.");
    }
  };

  const pgnGames: ParsedGame[] | undefined =
    detected.kind === "pgn"
      ? detected.games
      : lichess.status === "done" && lichess.pgn
        ? detectInputGames(lichess.pgn)
        : undefined;

  return (
    <Dialog
      open={dialog.open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      scroll="paper"
    >
      <DialogTitle>Import</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={0.5}>
          <TextField
            autoFocus
            multiline
            minRows={4}
            maxRows={9}
            value={text}
            onChange={(event) => {
              setImage(undefined);
              setText(event.target.value);
            }}
            placeholder="Paste a PGN, a FEN, or a Lichess game link. You can also drop a PGN file or a picture of a board anywhere."
            slotProps={{ htmlInput: { "aria-label": "Text to import" } }}
          />

          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button
              size="small"
              variant="outlined"
              startIcon={<Icon icon="mdi:content-paste" height={18} />}
              onClick={pasteFromClipboard}
            >
              Paste from clipboard
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Icon icon="mdi:upload" height={18} />}
              onClick={() => fileInput.current?.click()}
            >
              Choose a file
            </Button>
            <input
              ref={fileInput}
              type="file"
              hidden
              accept=".pgn,.txt,image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) readFile(file);
                event.target.value = "";
              }}
            />
          </Stack>

          {notice && (
            <Alert severity="info" onClose={() => setNotice("")}>
              {notice}
            </Alert>
          )}

          {image && (
            <Stack spacing={1.5} alignItems="center">
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  height: 220,
                  borderRadius: 2,
                  overflow: "hidden",
                  border: 1,
                  borderColor: "divider",
                }}
              >
                <Image
                  src={image}
                  alt="Board to scan"
                  fill
                  style={{ objectFit: "contain" }}
                  unoptimized
                />
              </Box>
              <Button
                variant="contained"
                startIcon={<Icon icon="mdi:image-search-outline" height={20} />}
                onClick={() => {
                  setHandoff({ kind: "image", dataUrl: image });
                  go("/scan");
                }}
              >
                Scan this board
              </Button>
            </Stack>
          )}

          {detected.kind === "fen" && (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems="center"
            >
              <MiniBoard fen={detected.fen} size={170} animationDuration={0} />
              <Stack spacing={1} width="100%">
                <Chip
                  label="Position (FEN)"
                  color="primary"
                  size="small"
                  sx={{ alignSelf: "flex-start" }}
                />
                <Button
                  variant="contained"
                  onClick={() => openFen(detected.fen, "/editor")}
                >
                  Edit on the board
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => openPgn(fenToPgn(detected.fen), "/analysis")}
                >
                  Analyze this position
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => openFen(detected.fen, "/play")}
                >
                  Play it against a bot
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => openFen(detected.fen, "/arena")}
                >
                  Watch engines play it
                </Button>
              </Stack>
            </Stack>
          )}

          {lichess.status === "loading" && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <CircularProgress size={18} />
              <Typography>Fetching the game from Lichess…</Typography>
            </Stack>
          )}
          {lichess.status === "error" && (
            <Alert severity="error">
              Could not fetch that Lichess game ({lichess.error}).
            </Alert>
          )}

          {pgnGames && (
            <PgnChoices
              games={pgnGames}
              onAnalyze={(game) => openPgn(game.pgn, "/analysis")}
              onReview={(game) => openPgn(game.pgn, "/learn")}
              onSave={saveGames}
            />
          )}

          {!image &&
            detected.kind === "unknown" &&
            lichess.status === "idle" &&
            text.trim().length > 0 && (
              <Alert severity="warning">
                That doesn&apos;t look like a PGN, FEN or Lichess link. Check
                that you copied the whole text.
              </Alert>
            )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ m: 1 }}>
        <Button onClick={close}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function PgnChoices({
  games,
  onAnalyze,
  onReview,
  onSave,
}: {
  games: ParsedGame[];
  onAnalyze: (game: ParsedGame) => void;
  onReview: (game: ParsedGame) => void;
  onSave: (games: ParsedGame[]) => void;
}) {
  const readable = games.filter((game) => !game.error);

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Chip
          size="small"
          color="primary"
          label={
            games.length === 1 ? "Game (PGN)" : `${games.length} games (PGN)`
          }
        />
        <Button
          size="small"
          startIcon={<Icon icon="mdi:database-plus-outline" height={18} />}
          disabled={!readable.length}
          onClick={() => onSave(readable)}
        >
          {readable.length === 1
            ? "Save to database"
            : `Save all ${readable.length} to database`}
        </Button>
      </Stack>

      <PgnGameList
        games={games}
        actionsWidth={170}
        renderActions={(game) => (
          <Stack direction="row" gap={0.5}>
            <Button
              size="small"
              variant="contained"
              onClick={() => onAnalyze(game)}
            >
              Analyze
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => onReview(game)}
            >
              Learn
            </Button>
          </Stack>
        )}
      />
    </Stack>
  );
}

const detectInputGames = (pgn: string): ParsedGame[] | undefined => {
  const detected = detectInput(pgn);
  return detected.kind === "pgn" ? detected.games : undefined;
};
