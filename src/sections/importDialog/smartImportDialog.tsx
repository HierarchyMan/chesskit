import MiniBoard from "@/components/board/miniBoard";
import { useGameDatabase } from "@/hooks/useGameDatabase";
import { setHandoff } from "@/lib/handoff";
import { fetchLichessGame } from "@/lib/lichess";
import { ParsedGame, fenToPgn } from "@/lib/pgn";
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
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useAtom } from "jotai";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { importDialogAtom } from "../layout/states";
import { useParsedInput } from "@/hooks/useParsedInput";
import PgnGameList from "../loadGame/pgnGameList";
import ChessComInput from "../loadGame/chessComInput";
import LichessInput from "../loadGame/lichessInput";

type ImportTab = "paste" | "chesscom" | "lichess";
type SourceAction = "analysis" | "learn" | "save";

interface LichessState {
  status: "idle" | "loading" | "done" | "error";
  pgn?: string;
  error?: string;
}

interface NoticeState {
  severity: "success" | "info" | "error";
  text: string;
}

export default function SmartImportDialog() {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const [dialog, setDialog] = useAtom(importDialogAtom);
  const [tab, setTab] = useState<ImportTab>("paste");
  const [sourceAction, setSourceAction] = useState<SourceAction>("analysis");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);
  const [lichess, setLichess] = useState<LichessState>({ status: "idle" });
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { addGames } = useGameDatabase();

  useEffect(() => {
    if (!dialog.open) return;

    if (dialog.initialText || dialog.initialImage) {
      setTab("paste");
    }
    setText(dialog.initialText ?? "");
    setImage(dialog.initialImage);
    setLichess({ status: "idle" });
    setNotice(null);
  }, [dialog]);

  const {
    detected,
    loading: parsing,
    error: inputError,
  } = useParsedInput(
    tab === "paste" && !image ? text : "",
    dialog.open && tab === "paste"
  );
  const { detected: fetched } = useParsedInput(
    lichess.pgn ?? "",
    dialog.open && tab === "paste"
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

  const openPgn = (
    pgn: string,
    path: string,
    orientation?: "white" | "black",
    initialTab?: "moves" | "review"
  ) => {
    setHandoff(
      {
        kind: "pgn",
        pgn,
        orientation:
          orientation ??
          (detected.kind === "lichess" ? detected.orientation : undefined),
        initialTab,
        source: "Import",
      },
      path
    );
    go(path);
  };

  const openFen = (fen: string, path: string) => {
    setHandoff({ kind: "fen", fen, source: "Import" }, path);
    go(path);
  };

  const savePgnStrings = async (pgns: string[]) => {
    try {
      const { saved, errors } = await addGames(pgns);
      if (saved === 0 && errors.length > 0) {
        setNotice({
          severity: "error",
          text: `Could not save game${pgns.length === 1 ? "" : "s"}: ${errors[0]}`,
        });
        return;
      }
      setNotice({
        severity: errors.length > 0 ? "info" : "success",
        text: `Saved ${saved} game${saved === 1 ? "" : "s"} to your database.${errors.length ? ` ${errors.length} could not be saved.` : ""}`,
      });
    } catch (error) {
      setNotice({
        severity: "error",
        text: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const saveGames = async (games: ParsedGame[]) => {
    await savePgnStrings(
      games.filter((game) => !game.error).map((game) => game.pgn)
    );
  };

  const handleExternalGameSelect = async (
    pgn: string,
    boardOrientation?: boolean
  ) => {
    const orientation: "white" | "black" | undefined =
      boardOrientation === undefined
        ? undefined
        : boardOrientation
          ? "white"
          : "black";

    if (sourceAction === "save") {
      await savePgnStrings([pgn]);
      return;
    }

    openPgn(
      pgn,
      "/analysis",
      orientation,
      sourceAction === "learn" ? "review" : "moves"
    );
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
      setNotice({
        severity: "info",
        text: "Your browser blocked clipboard access. Press Ctrl/⌘+V instead.",
      });
    }
  };

  const pgnGames: ParsedGame[] | undefined =
    detected.kind === "pgn"
      ? detected.games
      : lichess.status === "done" && lichess.pgn
        ? fetched.kind === "pgn"
          ? fetched.games
          : undefined
        : undefined;

  return (
    <Dialog
      open={dialog.open}
      onClose={close}
      fullScreen={isSmall}
      fullWidth
      maxWidth="sm"
      scroll="paper"
    >
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1, pr: 2 }}
      >
        <Icon icon="mdi:clipboard-plus-outline" height={22} />
        <Box sx={{ flexGrow: 1 }}>Import</Box>
        <IconButton onClick={close} aria-label="Close" edge="end" size="small">
          <Icon icon="mdi:close" height={20} />
        </IconButton>
      </DialogTitle>

      <Tabs
        value={tab}
        onChange={(_, next: ImportTab) => {
          setTab(next);
          setNotice(null);
        }}
        variant="fullWidth"
        sx={{ px: 1, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}
      >
        <Tab
          value="paste"
          label="Paste / File / Image"
          icon={<Icon icon="mdi:content-paste" height={18} />}
          iconPosition="start"
          sx={{ minHeight: 44 }}
        />
        <Tab
          value="chesscom"
          label="Chess.com"
          icon={<Icon icon="mdi:chess-pawn" height={18} />}
          iconPosition="start"
          sx={{ minHeight: 44 }}
        />
        <Tab
          value="lichess"
          label="Lichess"
          icon={<Icon icon="mdi:chess-knight" height={18} />}
          iconPosition="start"
          sx={{ minHeight: 44 }}
        />
      </Tabs>

      <DialogContent dividers>
        <Stack spacing={2}>
          {notice && (
            <Alert severity={notice.severity} onClose={() => setNotice(null)}>
              {notice.text}
            </Alert>
          )}

          <Box sx={{ display: tab === "paste" ? "block" : "none" }}>
            <Stack spacing={2}>
              <TextField
                autoFocus={!isSmall}
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
                  accept=".pgn,.txt,.fen,image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) readFile(file);
                    event.target.value = "";
                  }}
                />
              </Stack>

              {inputError && <Alert severity="error">{inputError}</Alert>}

              {image && (
                <Stack spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      position: "relative",
                      width: "100%",
                      height: 220,
                      borderRadius: 1.5,
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
                    startIcon={
                      <Icon icon="mdi:image-search-outline" height={20} />
                    }
                    onClick={() => {
                      setHandoff({ kind: "image", dataUrl: image }, "/scan");
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
                  <MiniBoard
                    fen={detected.fen}
                    size={170}
                    animationDuration={0}
                  />
                  <Stack spacing={1} width="100%">
                    <Chip
                      label="Position (FEN)"
                      color="primary"
                      size="small"
                      sx={{ alignSelf: "flex-start" }}
                    />
                    <Button
                      variant="contained"
                      onClick={() =>
                        openPgn(fenToPgn(detected.fen), "/analysis")
                      }
                    >
                      Analyze this position
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => openFen(detected.fen, "/editor")}
                    >
                      Edit on board
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => openFen(detected.fen, "/play")}
                    >
                      Play against a bot
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => openFen(detected.fen, "/arena")}
                    >
                      Watch in Engine Arena
                    </Button>
                  </Stack>
                </Stack>
              )}

              {lichess.status === "loading" && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CircularProgress size={18} />
                  <Typography variant="body2">
                    Fetching the game from Lichess…
                  </Typography>
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
                  onAnalyze={(game) =>
                    openPgn(game.pgn, "/analysis", undefined, "moves")
                  }
                  onReview={(game) =>
                    openPgn(game.pgn, "/analysis", undefined, "review")
                  }
                  onSave={saveGames}
                />
              )}

              {!image &&
                detected.kind === "unknown" &&
                !parsing &&
                lichess.status === "idle" &&
                text.trim().length > 0 && (
                  <Alert severity="warning">
                    That doesn&apos;t look like a PGN, FEN, or Lichess link.
                    Check that you copied the whole text.
                  </Alert>
                )}
            </Stack>
          </Box>

          <Box
            sx={{
              display:
                tab === "chesscom" || tab === "lichess" ? "block" : "none",
            }}
          >
            <Stack spacing={2}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                flexWrap="wrap"
              >
                <Typography variant="caption" color="text.secondary">
                  Click a game to:
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={sourceAction}
                  aria-label="Action when selecting a game"
                  onChange={(_, next: SourceAction | null) =>
                    next && setSourceAction(next)
                  }
                  sx={{
                    "& .MuiToggleButton-root": {
                      py: 0.35,
                      px: 1.25,
                      fontSize: "0.78rem",
                    },
                  }}
                >
                  <ToggleButton value="analysis">Analyze</ToggleButton>
                  <ToggleButton value="learn">Coach review</ToggleButton>
                  <ToggleButton value="save">Save</ToggleButton>
                </ToggleButtonGroup>
              </Stack>

              <Box sx={{ display: tab === "chesscom" ? "block" : "none" }}>
                <ChessComInput onSelect={handleExternalGameSelect} />
              </Box>
              <Box sx={{ display: tab === "lichess" ? "block" : "none" }}>
                <LichessInput onSelect={handleExternalGameSelect} />
              </Box>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
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
        renderActions={(game) => (
          <Stack direction="row" gap={0.75}>
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
              Coach review
            </Button>
          </Stack>
        )}
      />
    </Stack>
  );
}
