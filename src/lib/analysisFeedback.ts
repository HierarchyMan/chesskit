import { Chess, Square } from "chess.js";
import { MoveClassification } from "@/types/enums";
import { CurrentPosition } from "@/types/eval";
import { SquareHighlight } from "@/components/board/cues";
import { describeMove, MoveDescription } from "@/lib/visualize/explain";
import { buildMoveStory, MoveStory } from "@/lib/visualize/moveStory";

export interface AnalysisMoveCommentary {
  /** Calm 1–2 sentence editorial explanation in natural human voice. */
  sentence: string;
  /** Optional concise motif tag label (e.g. "Fork", "Pin", "Book Theory"). */
  motifLabel?: string;
  /** Restrained square highlight(s) synced to this explanation. */
  highlights: SquareHighlight[];
  /** Present when an in-board "Show why" cascade can be played. */
  story?: MoveStory;
}

const OPENING_NOTES: Array<{ match: RegExp; lines: string[] }> = [
  {
    match: /sicilian/i,
    lines: [
      "Sharp Sicilian theory — fighting asymmetrically for central counterplay.",
      "Standard Sicilian play, trading symmetry for active piece prospects.",
    ],
  },
  {
    match: /french/i,
    lines: [
      "Solid French Defense structure, preparing to challenge the white center.",
      "Classic French Defense theory — resilient now, with counterplay on the queenside later.",
    ],
  },
  {
    match: /caro-kann/i,
    lines: [
      "The Caro-Kann keeps the pawn structure rock-solid while challenging the center.",
      "Trusted Caro-Kann theory — calm, healthy structure with an easy endgame plan.",
    ],
  },
  {
    match: /queen'?s gambit/i,
    lines: [
      "Queen's Gambit theory, putting immediate pressure on the central d5 pawn.",
      "Classic Queen's Gambit play — fighting for central space and smooth development.",
    ],
  },
  {
    match: /italian|giuoco/i,
    lines: [
      "Italian Game theory — aiming straight at the sensitive f7 square while preparing to castle.",
      "Classical Italian development, claiming clean diagonals and quick king safety.",
    ],
  },
  {
    match: /ruy lopez|spanish/i,
    lines: [
      "Ruy Lopez theory, building long-term pressure against the center and e5.",
      "Timeless Spanish opening play — subtle pressure that pays off in the middlegame.",
    ],
  },
  {
    match: /indian/i,
    lines: [
      "Hypermodern Indian setup — letting the center take shape before striking back.",
      "Flexible Indian Defense theory, keeping dynamic piece tension.",
    ],
  },
  {
    match: /english/i,
    lines: [
      "Positional English Opening play, clamping down on the d5 square from the flank.",
      "Flexible English theory that can transpose into several rich structures.",
    ],
  },
  {
    match: /london/i,
    lines: [
      "Steady London System setup — harmonious development and a safe central pyramid.",
    ],
  },
  {
    match: /scandinavian/i,
    lines: ["Direct Scandinavian play, challenging the center on move one."],
  },
];

const FIRST_MOVE_NOTES: Record<string, string> = {
  e4: "A principled central push — opening lines for both the queen and king's bishop.",
  d4: "A solid claim on the center, immediately supported by the queen.",
  c4: "The positional English Opening, staking an early claim on the d5 square.",
  Nf3: "A flexible developing move that keeps all central pawn structures open.",
};

const pick = <T>(items: readonly T[], seed: number): T =>
  items[Math.abs(seed) % items.length];

const hashSeed = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const motifTitleFromTags = (desc: MoveDescription): string | undefined => {
  if (desc.tags.includes("mate")) return "Checkmate";
  if (desc.tags.includes("back_rank")) return "Back Rank";
  if (desc.tags.includes("fork")) return "Fork";
  if (desc.tags.includes("pin")) return "Pin";
  if (desc.tags.includes("skewer")) return "Skewer";
  if (desc.tags.includes("discovered")) return "Discovered Attack";
  if (desc.tags.includes("promotion")) return "Promotion";
  if (desc.tags.includes("hanging")) return "Hanging Piece";
  if (desc.tags.includes("passed_pawn")) return "Passed Pawn";
  if (desc.tags.includes("open_file")) return "Open File";
  if (desc.tags.includes("castle")) return "King Safety";
  if (desc.tags.includes("develop")) return "Development";
  return undefined;
};

const describePositiveMotif = (
  desc: MoveDescription,
  san: string,
  seed: number
): string => {
  if (desc.tags.includes("mate")) {
    return `${san} finishes the game on the spot with checkmate.`;
  }
  if (desc.tags.includes("back_rank")) {
    return `${san} exploits the weak back rank with a decisive check.`;
  }
  if (desc.tags.includes("fork")) {
    return desc.text;
  }
  if (desc.tags.includes("pin")) {
    return desc.text;
  }
  if (desc.tags.includes("skewer")) {
    return desc.text;
  }
  if (desc.tags.includes("discovered")) {
    return desc.text;
  }
  if (desc.tags.includes("promotion")) {
    return `${san} crowns the pawn and transforms the position.`;
  }
  if (desc.tags.includes("castle")) {
    return pick(
      [
        "Tucks the king to safety and brings the rook into the game.",
        "Good timing to castle — the king is sheltered and the rook connects.",
      ],
      seed
    );
  }
  if (desc.tags.includes("passed_pawn")) {
    return pick(
      [
        `${san} pushes a dangerous passed pawn that forces the opponent onto the defense.`,
        `Advancing the passed pawn with ${san} steadily increases the pressure.`,
      ],
      seed
    );
  }
  if (desc.tags.includes("open_file")) {
    return `${san} seizes the open file, giving the rook active scope.`;
  }
  if (desc.tags.includes("develop")) {
    return pick(
      [
        `${san} develops smoothly and fights for control of the center.`,
        "Healthy development — getting pieces active before launching an attack.",
      ],
      seed
    );
  }
  if (desc.tags.includes("threat")) {
    return desc.text;
  }
  if (desc.tags.includes("capture")) {
    return pick(
      [
        `${san} makes a clean capture that improves the position.`,
        `${san} wins material cleanly without giving up counterplay.`,
      ],
      seed
    );
  }
  if (desc.tags.includes("check")) {
    return `${san} keeps the initiative with a well-timed check.`;
  }
  return pick(
    [
      `${san} keeps the pieces well coordinated and holds the initiative.`,
      "A composed, accurate choice that improves piece harmony.",
      `${san} maintains control and asks tough questions of the opponent.`,
    ],
    seed
  );
};

const safeBestSan = (
  fenBefore: string,
  bestUci?: string
): string | undefined => {
  if (!bestUci || bestUci.length < 4) return undefined;
  try {
    const g = new Chess(fenBefore);
    const m = g.move({
      from: bestUci.slice(0, 2),
      to: bestUci.slice(2, 4),
      promotion: bestUci.slice(4, 5) || undefined,
    });
    return m?.san;
  } catch {
    return undefined;
  }
};

/**
 * Generates calm, editorial human-voice move feedback for Analysis mode,
 * completely separate in tone and presentation from Play Coaching.
 */
export function buildAnalysisFeedback(
  position: CurrentPosition,
  plyCount: number
): AnalysisMoveCommentary | null {
  const move = position.lastMove;
  const evalData = position.eval;
  const classification = evalData?.moveClassification;
  if (!move || !evalData || !classification) return null;

  const seed = hashSeed(`${move.before}|${move.lan}|${plyCount}`);
  let playedDesc: MoveDescription;
  try {
    playedDesc = describeMove(move.before, move.lan);
  } catch {
    return null;
  }

  const bestUci =
    position.lastEval?.bestMove ?? position.lastEval?.lines[0]?.pv[0];
  const bestSan =
    bestUci && bestUci !== move.lan
      ? safeBestSan(move.before, bestUci)
      : undefined;
  let bestDesc: MoveDescription | undefined;
  if (bestUci && bestUci !== move.lan) {
    try {
      bestDesc = describeMove(move.before, bestUci);
    } catch {
      bestDesc = undefined;
    }
  }

  const hasStoryLines =
    !!position.lastEval?.lines.length && !!evalData.lines.length;
  const story = hasStoryLines
    ? buildMoveStory({
        fenBefore: move.before,
        playedUci: move.lan,
        beforeLines: position.lastEval!.lines,
        afterLines: evalData.lines,
      })
    : undefined;

  const highlights: SquareHighlight[] = [];
  let motifLabel = motifTitleFromTags(playedDesc);
  let sentence = "";

  switch (classification) {
    case MoveClassification.Opening: {
      motifLabel = "Book Theory";
      if (plyCount === 1 && FIRST_MOVE_NOTES[move.san]) {
        sentence = FIRST_MOVE_NOTES[move.san];
      } else if (evalData.opening) {
        const matched = OPENING_NOTES.find((o) =>
          o.match.test(evalData.opening!)
        );
        sentence = matched
          ? pick(matched.lines, seed)
          : `Standard theory in the ${evalData.opening}, keeping development on track.`;
      } else {
        sentence = pick(
          [
            `${move.san} follows established opening theory.`,
            "A known book move that keeps the position balanced and active.",
          ],
          seed
        );
      }
      break;
    }

    case MoveClassification.Splendid: {
      motifLabel = playedDesc.tags.includes("hanging")
        ? "Brilliant Sacrifice"
        : (motifLabel ?? "Brilliant");
      if (
        playedDesc.tags.includes("hanging") ||
        playedDesc.tags.includes("fork") ||
        playedDesc.tags.includes("mate")
      ) {
        sentence = `A brilliant find — ${move.san} looks daring, yet every forcing reply works in your favor.`;
      } else {
        sentence = `Brilliant execution with ${move.san}, uncovering a deep tactical resource.`;
      }
      highlights.push({ square: move.to as Square, tone: "success" });
      if (playedDesc.targetSquare) {
        highlights.push({ square: playedDesc.targetSquare, tone: "bright" });
      }
      break;
    }

    case MoveClassification.Perfect: {
      motifLabel = motifLabel ?? "Great Move";
      const reason = describePositiveMotif(playedDesc, move.san, seed);
      sentence = `Crucial precision — ${reason.charAt(0).toLowerCase()}${reason.slice(1)}`;
      highlights.push({ square: move.to as Square, tone: "success" });
      break;
    }

    case MoveClassification.Best:
    case MoveClassification.Excellent: {
      sentence = describePositiveMotif(playedDesc, move.san, seed);
      if (playedDesc.targetSquare) {
        highlights.push({ square: playedDesc.targetSquare, tone: "bright" });
      }
      break;
    }

    case MoveClassification.Forced: {
      motifLabel = "Only Move";
      sentence = pick(
        [
          `${move.san} was the only playable response in this position.`,
          "A forced reply — no other legal move held the position together.",
        ],
        seed
      );
      break;
    }

    case MoveClassification.Okay: {
      if (bestSan) {
        sentence = `${move.san} is playable, though ${bestSan} kept slightly sharper pressure.`;
      } else {
        sentence = `${move.san} is a reasonable move that keeps the game steady.`;
      }
      break;
    }

    case MoveClassification.Inaccuracy:
    case MoveClassification.Mistake:
    case MoveClassification.Blunder: {
      const isSevere = classification === MoveClassification.Blunder;
      if (playedDesc.dangerSquare) {
        highlights.push({
          square: playedDesc.dangerSquare,
          tone: "danger",
          pulse: isSevere,
        });
      }

      const storyHeadline = story?.summary[0];
      if (storyHeadline) {
        sentence = storyHeadline;
        if (bestSan && !storyHeadline.includes(bestSan)) {
          sentence += ` ${bestSan} was stronger here.`;
        }
      } else if (
        playedDesc.tags.includes("hanging") &&
        playedDesc.dangerSquare
      ) {
        sentence = `${move.san} leaves the piece on ${playedDesc.dangerSquare} vulnerable.${bestSan ? ` ${bestSan} kept everything protected.` : ""}`;
      } else if (bestSan && bestDesc) {
        const bestTag = motifTitleFromTags(bestDesc);
        if (bestTag) motifLabel = `Missed ${bestTag}`;
        sentence = `${move.san} slips from the strongest path — ${bestSan} was better${bestTag ? ` (${bestTag.toLowerCase()})` : ""}.`;
      } else {
        sentence = isSevere
          ? `${move.san} gives away a decisive swing in the position.${bestSan ? ` ${bestSan} held the line.` : ""}`
          : `${move.san} lets some of the advantage slip.${bestSan ? ` ${bestSan} was more accurate.` : ""}`;
      }
      break;
    }
  }

  return {
    sentence,
    motifLabel,
    highlights,
    story,
  };
}
