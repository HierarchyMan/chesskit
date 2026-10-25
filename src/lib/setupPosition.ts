import { Chess } from "chess.js";
import { loadGameFromText, normalizeFen } from "./pgn";
import { getOddsFen, Odds } from "./odds";
import { Color } from "@/types/enums";

export const setupPosition = (text = ""): { fen: string; error?: string } => {
  if (!text.trim()) return { fen: new Chess().fen() };
  try {
    const fen = normalizeFen(text) ?? loadGameFromText(text).fen();
    if (new Chess(fen).isGameOver())
      return { fen, error: "That position is already finished." };
    return { fen };
  } catch {
    return {
      fen: new Chess().fen(),
      error:
        "Enter a valid FEN or PGN. The board shows the standard position until this input is valid.",
    };
  }
};
export const playSetupPosition = (text: string, odds: Odds, botColor: Color) =>
  setupPosition(odds === "none" ? text : getOddsFen(odds, botColor));
