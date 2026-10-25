import { setHandoff } from "@/lib/handoff";
import { Icon } from "@iconify/react";
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import { useAtomValue } from "jotai";
import { useRouter } from "next/router";
import { useState } from "react";
import { boardAtom } from "../states";
import { displayedAnalysisPgnAtom, analysisSessionAtom } from "../sessionAtoms";
import { exportAnalysisStudy } from "@/lib/analysisSession";
import { useCopyText } from "@/hooks/useCopyText";

export default function MoreMenu() {
  const pgn = useAtomValue(displayedAnalysisPgnAtom);
  const board = useAtomValue(boardAtom);
  const session = useAtomValue(analysisSessionAtom);
  const { copy, feedback } = useCopyText();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const close = () => setAnchorEl(null);

  const openWithFen = (path: string) => {
    close();
    setHandoff({ kind: "fen", fen: board.fen() }, path);
    router.push(path);
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
      label: "Edit this position",
      onClick: () => openWithFen("/editor"),
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
      <Tooltip title="More actions" disableInteractive>
        <IconButton
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-label="More actions"
          sx={{
            padding: "8px",
            borderRadius: "6px",
            width: "40px",
            height: "40px",
          }}
        >
          <Icon icon="mdi:dots-horizontal" height={24} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={close}>
        {items.map((item) => (
          <MenuItem key={item.label} onClick={item.onClick}>
            <ListItemIcon>
              <Icon icon={item.icon} height={20} />
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </MenuItem>
        ))}
      </Menu>
      {feedback}
    </>
  );
}
