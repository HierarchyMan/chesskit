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
import { boardAtom, gameAtom } from "../states";

export default function MoreMenu() {
  const game = useAtomValue(gameAtom);
  const board = useAtomValue(boardAtom);
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const close = () => setAnchorEl(null);

  const sourceGame = game.history().length ? game : board;

  const openWithFen = (path: string) => {
    close();
    setHandoff({ kind: "fen", fen: board.fen() });
    router.push(path);
  };

  const downloadPgn = () => {
    close();
    const blob = new Blob([sourceGame.pgn()], {
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
        navigator.clipboard?.writeText?.(board.fen());
      },
    },
    { icon: "mdi:download", label: "Download PGN", onClick: downloadPgn },
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
      <Tooltip title="More actions">
        <IconButton
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-label="More actions"
          sx={{ paddingX: "20px", borderRadius: "8px", height: "46px" }}
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
    </>
  );
}
