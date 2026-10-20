import { GameResultInfo } from "./gameResult";

export type EndgameLevel = "Beginner" | "Intermediate" | "Advanced";
export type EndgameGoal = "win" | "draw";
export type ChallengeStatus = "active" | "complete" | "failed";

export interface Endgame {
  id: string;
  title: string;
  level: EndgameLevel;
  fen: string;
  player: "w" | "b";
  goal: EndgameGoal;
  holdMoves?: number;
  summary: string;
  idea: string;
  tips: string[];
}

export const ENDGAME_LEVELS: EndgameLevel[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
];

// Every position was checked with Reckless: the "win" ones are won for the
// player's side, the "draw" ones are theoretical draws (see
// scripts/verify-endgames.mjs).
export const ENDGAMES: Endgame[] = [
  {
    id: "queen-mate",
    title: "King and queen against king",
    level: "Beginner",
    fen: "8/8/8/3k4/8/8/2Q5/4K3 w - - 0 1",
    player: "w",
    goal: "win",
    summary: "Checkmate with a queen before the king can escape.",
    idea: "The queen shrinks the area the enemy king can use. Once it is near an edge, your own king walks up to help and the queen delivers mate.",
    tips: [
      "Keep the queen a knight's move away from the enemy king. She cannot be captured there and she still cuts off squares.",
      "Bring your king close once the enemy king is on the edge of the board.",
      "Before every queen move make sure the enemy king still has a legal move. If it has none and is not in check, the game is a stalemate draw.",
    ],
  },
  {
    id: "rook-mate",
    title: "King and rook against king",
    level: "Beginner",
    fen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1",
    player: "w",
    goal: "win",
    summary: "Drive the king to an edge with the rook and your king.",
    idea: "The rook cuts the enemy king off along a rank or file. Your king follows, and each time the kings face each other the rook gives a check that pushes the enemy king back one step.",
    tips: [
      "Cut the king off from a distance so the rook can never be attacked.",
      "Walk your king towards the enemy king. When they face each other with one square between, give a rook check along the rank to force it back.",
      "Mate always happens on the edge, with the rook checking along the edge and your king guarding the squares in front of the enemy king.",
    ],
  },
  {
    id: "king-pawn-front",
    title: "King and pawn: king in front",
    level: "Beginner",
    fen: "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1",
    player: "w",
    goal: "win",
    summary:
      "Escort the pawn to the queening square with your king ahead of it.",
    idea: "A king in front of its pawn, on the sixth rank, wins whoever is to move. The king clears the way and the pawn follows it up the board.",
    tips: [
      "Keep your king ahead of the pawn and push the pawn only when the king is already in place.",
      "On the seventh rank, check that your king is not blocking the queening square and that the enemy king still has a move, or it is stalemate.",
      "When the kings face each other, the side that must move has to give way.",
    ],
  },
  {
    id: "king-pawn-opposition",
    title: "King and pawn: take the opposition",
    level: "Intermediate",
    fen: "8/8/8/3k4/8/3K4/3P4/8 b - - 0 1",
    player: "w",
    goal: "win",
    summary: "The pawn is behind your king. Win by keeping the opposition.",
    idea: "The kings face each other with one square between them and Black has to move, so Black must give way. Advance your king past the enemy king before you push the pawn, and keep taking the opposition.",
    tips: [
      "Take the opposition: stand so that the enemy king has to step aside.",
      "Advance the king first, towards the squares in front of the pawn, and push the pawn later.",
      "If you push the pawn too early you hand the opposition back and the game can slip to a draw.",
    ],
  },
  {
    id: "lucena",
    title: "The Lucena position",
    level: "Intermediate",
    fen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1",
    player: "w",
    goal: "win",
    summary: "Rook and pawn against rook: build the bridge.",
    idea: "Your king stands on the queening square but the enemy rook keeps checking. Use your own rook as a bridge that blocks those checks, then walk the king out and queen the pawn.",
    tips: [
      "Start with a rook check to push the enemy king one file away: Rd1+.",
      "Slide your rook to the fourth rank with Rd4. That rook is the bridge.",
      "Step the king out of the corner. When the enemy rook checks, interpose your rook on the fourth rank.",
    ],
  },
  {
    id: "two-bishops",
    title: "King and two bishops against king",
    level: "Advanced",
    fen: "8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1",
    player: "w",
    goal: "win",
    summary: "Two bishops and a king can force mate, but it takes technique.",
    idea: "The two bishops cover squares of both colours. Keep them side by side on neighbouring diagonals as a wall, push the king to a corner with your own king helping, and mate there.",
    tips: [
      "Keep the bishops next to each other. Together they form a barrier the enemy king cannot cross.",
      "Your king must come up to help. The mate happens in a corner.",
      "From here the engine needs about 20 moves to mate, so there is time, but not for aimless bishop moves.",
    ],
  },
  {
    id: "philidor",
    title: "The Philidor position",
    level: "Intermediate",
    fen: "4k3/8/r7/3KP3/8/8/8/3R4 b - - 0 1",
    player: "b",
    goal: "draw",
    holdMoves: 20,
    summary: "Hold the draw in a rook ending a pawn down.",
    idea: "Keep your rook on the sixth rank so the white king cannot advance, and keep your king in front of the pawn. When the pawn reaches the sixth rank, switch to checking from behind.",
    tips: [
      "Your rook stays on the sixth rank (the third rank from your side) until the pawn moves forward.",
      "Keep your king on the back rank in front of the pawn.",
      "Once the pawn reaches the sixth rank, put the rook behind the pawn and give checks from a distance.",
    ],
  },
  {
    id: "wrong-bishop",
    title: "The wrong-coloured bishop",
    level: "Intermediate",
    fen: "7k/8/6KP/8/8/8/8/5B2 b - - 0 1",
    player: "b",
    goal: "draw",
    holdMoves: 20,
    summary: "Draw a position that looks lost by guarding the corner.",
    idea: "The bishop is on light squares but the pawn queens on the dark corner h8. If your king stays in that corner, White can never drive it out and the game is a draw.",
    tips: [
      "Stay in the corner. Your king must never leave g8 and h8.",
      "Watch for stalemate: if White pushes the pawn to h7 your king in the corner may have no move, which is a draw.",
      "The bishop can never attack a dark square like h8, so it cannot dislodge you.",
    ],
  },
  {
    id: "king-pawn-hold",
    title: "King and pawn: hold the draw",
    level: "Intermediate",
    fen: "8/8/3k4/8/3PK3/8/8/8 w - - 0 1",
    player: "b",
    goal: "draw",
    holdMoves: 20,
    summary: "Stay in front of the pawn and keep the opposition.",
    idea: "White's king and pawn look strong, but if you keep your king directly in front of the pawn and answer each king step with the matching one, White cannot make progress.",
    tips: [
      "Stay in front of the pawn with your king and keep the opposition whenever you can.",
      "When White's king steps aside, step to the matching square so the pawn cannot advance safely.",
      "Do not chase the pawn. Guard its path.",
    ],
  },
];

export const getEndgame = (id: string): Endgame | undefined =>
  ENDGAMES.find((endgame) => endgame.id === id);

export const evaluateChallenge = (
  endgame: Endgame,
  result: GameResultInfo,
  playerColor: "w" | "b",
  pliesPlayed: number
): ChallengeStatus => {
  if (result.over) {
    if (result.winner)
      return result.winner === playerColor ? "complete" : "failed";
    return endgame.goal === "draw" ? "complete" : "failed";
  }

  if (
    endgame.goal === "draw" &&
    endgame.holdMoves !== undefined &&
    pliesPlayed >= endgame.holdMoves * 2
  ) {
    return "complete";
  }

  return "active";
};

export const challengeGoalText = (endgame: Endgame): string =>
  endgame.goal === "win"
    ? "Win the game by checkmate."
    : `Draw: hold the position for ${endgame.holdMoves ?? 20} moves, or reach a stalemate or other drawn ending.`;
