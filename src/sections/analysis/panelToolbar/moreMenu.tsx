import { setHandoff } from "@/lib/handoff";
import { ToolbarButton } from "@/components/ToolbarButton";
import { Icon } from "@iconify/react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { useAtomValue } from "jotai";
import { useRouter } from "next/router";
import { useRef, useState } from "react";
import { boardAtom, gameAtom } from "../states";
import { displayedAnalysisPgnAtom, analysisSessionAtom } from "../sessionAtoms";
import { exportAnalysisStudy } from "@/lib/analysisSession";
import { useCopyText } from "@/hooks/useCopyText";
import { useArrangeMode } from "../arrange/useArrangeMode";
import { useLoadAnalysisGame } from "../hooks/useLoadAnalysisGame";

export default function MoreMenu() {
  const pgn = useAtomValue(displayedAnalysisPgnAtom);
  const board = useAtomValue(boardAtom);
  const game = useAtomValue(gameAtom);
  const session = useAtomValue(analysisSessionAtom);
  const { copy, feedback } = useCopyText();
  const { enterArrange } = useArrangeMode();
  const { clearMoves } = useLoadAnalysisGame();
  const router = useRouter();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const close = () => setOpen(false);
  const hasMoves = game.history().length > 0 || board.history().length > 0;

  const openWithFen = (path: string) => {
    close();
    setHandoff({ kind: "fen", fen: board.fen(), source: "Analysis" }, path);
    void router.push(path);
  };

  const downloadPgn = () => {
    close();
    const blob = new Blob([pgn], {
      type: "application/x-chess-pgn",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "chesskit-game.pgn";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportItems: { icon: string; label: string; onClick: () => void }[] = [
    {
      icon: "mdi:content-copy",
      label: "Copy position (FEN)",
      onClick: () => {
        close();
        void copy(board.fen(), "Position FEN");
      },
    },
    { icon: "mdi:download", label: "Download line PGN", onClick: downloadPgn },
    ...(session
      ? [
          {
            icon: "mdi:file-tree",
            label: "Copy study PGN (all variations)",
            onClick: () => {
              close();
              void copy(exportAnalysisStudy(session), "Study PGN");
            },
          },
        ]
      : []),
  ];

  const modeItems: { icon: string; label: string; onClick: () => void }[] = [
    {
      icon: "mdi:pencil-ruler",
      label: "Arrange this position",
      onClick: () => {
        close();
        enterArrange();
      },
    },
    {
      icon: "mdi:chess-pawn",
      label: "Play this position against a bot",
      onClick: () => openWithFen("/play"),
    },
    {
      icon: "mdi:sword-cross",
      label: "Watch engines play from here",
      onClick: () => openWithFen("/arena"),
    },
  ];

  const subheaderSx = {
    bgcolor: "transparent",
    lineHeight: "24px",
    pt: 0.5,
    fontSize: "0.66rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "text.secondary",
  } as const;

  return (
    <>
      <Box ref={anchorRef} component="span" sx={{ display: "inline-flex" }}>
        <ToolbarButton
          tooltip="More actions"
          icon="mdi:dots-horizontal"
          onClick={() => setOpen(true)}
        />
      </Box>
      <Menu
        anchorEl={anchorRef.current}
        open={open}
        onClose={close}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 236,
              borderRadius: 1.5,
              border: 1,
              borderColor: "divider",
              mb: 0.5,
            },
          },
        }}
      >
        <ListSubheader disableSticky sx={subheaderSx}>
          Export
        </ListSubheader>
        {exportItems.map((item) => (
          <MenuItem key={item.label} dense onClick={item.onClick}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Icon icon={item.icon} height={18} />
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              slotProps={{ primary: { fontSize: "0.84rem" } }}
            />
          </MenuItem>
        ))}
        <Divider sx={{ my: 0.5 }} />
        <ListSubheader disableSticky sx={subheaderSx}>
          Open position in
        </ListSubheader>
        {modeItems.map((item) => (
          <MenuItem key={item.label} dense onClick={item.onClick}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Icon icon={item.icon} height={18} />
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              slotProps={{ primary: { fontSize: "0.84rem" } }}
            />
          </MenuItem>
        ))}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          dense
          disabled={!hasMoves}
          onClick={() => {
            close();
            setConfirmReset(true);
          }}
          sx={{
            color: hasMoves ? "error.main" : undefined,
          }}
        >
          <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
            <Icon icon="mdi:eraser" height={18} />
          </ListItemIcon>
          <ListItemText
            primary="Reset from this position"
            slotProps={{ primary: { fontSize: "0.84rem" } }}
          />
        </MenuItem>
      </Menu>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Reset from this position?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This clears the move history and game evaluation, starting a fresh
            analysis session from the current board position.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setConfirmReset(false);
              clearMoves();
            }}
          >
            Reset position
          </Button>
        </DialogActions>
      </Dialog>

      {feedback}
    </>
  );
}
