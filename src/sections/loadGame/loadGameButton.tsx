import { Icon } from "@iconify/react";
import { Button } from "@mui/material";
import { ReactNode, useState } from "react";
import NewGameDialog from "./loadGameDialog";
import { Chess } from "chess.js";

interface Props {
  setGame?: (game: Chess, pgn?: string) => Promise<void>;
  label?: string;
  size?: "small" | "medium" | "large";
  variant?: "text" | "outlined" | "contained";
  startIcon?: ReactNode;
}

export default function LoadGameButton({
  setGame,
  label,
  size,
  variant = "contained",
  startIcon,
}: Props) {
  const [openDialog, setOpenDialog] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        onClick={() => setOpenDialog(true)}
        size={size}
        startIcon={
          startIcon === undefined ? (
            <Icon icon="mdi:folder-open-outline" height={18} />
          ) : (
            startIcon
          )
        }
        sx={{
          minHeight: size === "small" ? 34 : 36,
          borderRadius: 1,
          whiteSpace: "nowrap",
        }}
      >
        {label || "Add game"}
      </Button>

      <NewGameDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        setGame={setGame}
      />
    </>
  );
}
