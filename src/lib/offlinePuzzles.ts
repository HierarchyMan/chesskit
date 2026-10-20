import { Puzzle } from "./puzzles";
import data from "@/data/offlinePuzzles.json";

export const OFFLINE_PUZZLES: Puzzle[] = (
  data as {
    id: string;
    fen: string;
    solution: string[];
    rating: number;
    themes: string[];
  }[]
).map((puzzle) => ({ ...puzzle, source: "offline" as const }));
