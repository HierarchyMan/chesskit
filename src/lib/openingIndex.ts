import { openings } from "@/data/openings";
const byPlacement = new Map<string, (typeof openings)[number]>();
for (const opening of openings)
  if (!byPlacement.has(opening.fen)) byPlacement.set(opening.fen, opening);
export const openingForPlacement = (fen: string) => byPlacement.get(fen);
