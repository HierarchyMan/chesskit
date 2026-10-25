import { Button } from "@mui/material";
import { useState } from "react";
import NewGameDialog from "./loadGameDialog";
import { Chess } from "chess.js";

interface Props {
  setGame?: (game: Chess, pgn?: string) => Promise<void>;
  label?: string;
  size?: "small" | "medium" | "large";
  variant?: "text" | "outlined" | "contained";
}

export default function LoadGameButton({
  setGame,
  label,
  size,
  variant = "contained",
}: Props) {
  const [openDialog, setOpenDialog] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        onClick={() => setOpenDialog(true)}
        size={size}
        sx={{ minHeight: 36, borderRadius: "6px", whiteSpace: "nowrap" }}
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
