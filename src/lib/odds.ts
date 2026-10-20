import { Chess, DEFAULT_POSITION, Square } from "chess.js";

export type Odds = "none" | "pawn" | "knight" | "bishop" | "rook" | "queen";

export const ODDS_OPTIONS: { value: Odds; label: string; hint: string }[] = [
  { value: "none", label: "Equal game", hint: "Standard starting position" },
  { value: "pawn", label: "Pawn odds", hint: "Bot starts without its f-pawn" },
  {
    value: "knight",
    label: "Knight odds",
    hint: "Bot starts without its queen's knight",
  },
  {
    value: "bishop",
    label: "Bishop odds",
    hint: "Bot starts without its king's bishop",
  },
  {
    value: "rook",
    label: "Rook odds",
    hint: "Bot starts without its queen's rook",
  },
  { value: "queen", label: "Queen odds", hint: "Bot starts without its queen" },
];

const ODDS_FILES: Record<Exclude<Odds, "none">, string> = {
  pawn: "f",
  knight: "b",
  bishop: "f",
  rook: "a",
  queen: "d",
};

export const getOddsFen = (odds: Odds, botColor: "w" | "b"): string => {
  if (odds === "none") return DEFAULT_POSITION;

  const game = new Chess();
  const rank =
    odds === "pawn" ? (botColor === "w" ? 2 : 7) : botColor === "w" ? 1 : 8;
  game.remove(`${ODDS_FILES[odds]}${rank}` as Square);

  const fields = game.fen().split(" ");
  if (odds === "rook") {
    const lostRight = botColor === "w" ? "Q" : "q";
    const rights = fields[2].replace(lostRight, "");
    fields[2] = rights || "-";
  }

  return fields.join(" ");
};
