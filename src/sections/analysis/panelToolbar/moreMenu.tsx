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
    setHandoff({ kind: "fen", fen: board.fen() }, path);
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

  const items: { icon: string; label: string; onClick: () => void }[] = [
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
      >
        {items.map((item) => (
          <MenuItem key={item.label} onClick={item.onClick}>
            <ListItemIcon>
              <Icon icon={item.icon} height={20} />
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          disabled={!hasMoves}
          onClick={() => {
            close();
            setConfirmReset(true);
          }}
          sx={{
            color: hasMoves ? "error.main" : undefined,
          }}
        >
          <ListItemIcon sx={{ color: "inherit" }}>
            <Icon icon="mdi:eraser" height={20} />
          </ListItemIcon>
          <ListItemText primary="Reset from this position" />
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
