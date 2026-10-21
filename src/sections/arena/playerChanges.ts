export type PlayerChangeEffect = "none" | "rebuild-start" | "note-position";

export interface MatchProgress {
  started: boolean;
  over: boolean;
  moveCount: number;
}

// Changing who plays never restarts a match. Only a match with no moves yet is
// rebuilt, so its headers name the players who actually begin it. Once moves
// exist, the change is noted on the current position. A finished match keeps
// its record, because its players only matter again for the next match.
export const playerChangeEffect = ({
  started,
  over,
  moveCount,
}: MatchProgress): PlayerChangeEffect => {
  if (!started || over) return "none";
  return moveCount === 0 ? "rebuild-start" : "note-position";
};

export const playerChangeNote = (white: string, black: string): string =>
  `From here: White is ${white}, Black is ${black}.`;
