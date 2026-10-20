import { OpeningLine } from "@/data/openingLines";
import { Chess } from "chess.js";

export interface LineStep {
  ply: number;
  san: string;
  uci: string;
  color: "w" | "b";
  fenBefore: string;
  fenAfter: string;
}

export const buildSteps = (line: OpeningLine): LineStep[] => {
  const game = new Chess();
  const steps: LineStep[] = [];

  line.moves.split(" ").forEach((san, ply) => {
    const move = game.move(san);
    steps.push({
      ply,
      san: move.san,
      uci: move.from + move.to + (move.promotion ?? ""),
      color: move.color,
      fenBefore: move.before,
      fenAfter: move.after,
    });
  });

  return steps;
};

export const fenAtPly = (steps: LineStep[], ply: number): string =>
  ply <= 0
    ? new Chess().fen()
    : steps[Math.min(ply, steps.length) - 1].fenAfter;

export const moveLabel = (step: LineStep): string =>
  `${Math.floor(step.ply / 2) + 1}${step.color === "w" ? "." : "..."} ${step.san}`;

export const lineToPgn = (line: OpeningLine, steps: LineStep[]): string => {
  const moves = steps
    .map((step) =>
      step.color === "w"
        ? `${Math.floor(step.ply / 2) + 1}. ${step.san}`
        : step.san
    )
    .join(" ");

  return `[Event "${line.name}"]\n[ECO "${line.eco}"]\n\n${moves} *`;
};

export const notePly = (line: OpeningLine, ply: number): string | undefined =>
  line.notes[ply];
