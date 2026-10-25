import {
  ArrowFocus,
  ArrowKind,
  ArrowSide,
  BoardArrow,
  isArrowFocused,
} from "./types";

/** Names a side in the legend, such as "White's" or "Your". */
export type SideNamer = (side: ArrowSide) => string;

/** Chess colours, for boards where every side has its colour's name. */
export const colorNamer: SideNamer = (side) =>
  side === "w" ? "White's" : "Black's";

/** Boards where one side is the user: Play, which names the user's side "Your". */
export const playerNamer =
  (player: ArrowSide): SideNamer =>
  (side) =>
    side === player ? "Your" : "Opponent's";

export interface LegendEntry {
  key: string;
  kind: ArrowKind;
  /** An arrow of this kind as it is on the board, to draw the sample from. */
  arrow: BoardArrow;
  text: string;
  /** What hovering, or focusing, the entry puts in the foreground. */
  focus: ArrowFocus;
}

const ORDER: ArrowKind[] = [
  "best",
  "planned",
  "candidate",
  "line",
  "missed",
  "threat",
];

/** Kinds whose meaning depends on whose move it is, so each side is listed. */
const PER_OWNER: ArrowKind[] = [
  "best",
  "planned",
  "candidate",
  "line",
  "threat",
];

const describe = (kind: ArrowKind, who: string): string => {
  switch (kind) {
    case "best":
      return `${who} best move`;
    case "planned":
      return `${who} chosen move`;
    case "candidate":
      return `${who} other candidates`;
    case "line":
      return `${who} move in the line`;
    case "threat":
      return `${who} threat`;
    case "missed":
      return "Missed: better than the move played";
    default:
      return "";
  }
};

/** One entry for each kind of arrow that is on the board right now. */
export const legendFor = (
  arrows: readonly BoardArrow[],
  nameOf: SideNamer
): LegendEntry[] => {
  const entries = new Map<string, LegendEntry>();

  for (const arrow of arrows.flatMap((drawn) => [
    drawn,
    ...(drawn.roles ?? []).map((role) => ({ ...drawn, ...role })),
  ])) {
    if (!ORDER.includes(arrow.kind)) continue;

    const owned = PER_OWNER.includes(arrow.kind);
    const side = owned ? arrow.side : undefined;
    const key = owned ? `${arrow.kind}:${side ?? "-"}` : arrow.kind;

    if (!entries.has(key)) {
      entries.set(key, {
        key,
        kind: arrow.kind,
        arrow,
        text: describe(arrow.kind, side ? nameOf(side) : ""),
        focus: owned ? { kind: arrow.kind, side } : { kind: arrow.kind },
      });
    }
  }

  // Kinds in their order of meaning; within a kind, in the order they appear,
  // so a line reads in the sequence it is played.
  return [...entries.values()].sort(
    (a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)
  );
};

/**
 * Push every arrow outside the focus into the background. The focus names a
 * role and an owner, or one exact candidate, so a shared kind is not lit whole.
 */
export const applyFocus = (
  arrows: readonly BoardArrow[],
  focus: ArrowFocus | null
): BoardArrow[] =>
  focus
    ? arrows.map((arrow) =>
        isArrowFocused(arrow, focus) ? arrow : { ...arrow, dimmed: true }
      )
    : [...arrows];
