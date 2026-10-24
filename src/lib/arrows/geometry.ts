import type { Square } from "chess.js";

export type Orientation = "white" | "black";

export interface Point {
  x: number;
  y: number;
}

const FILES = "abcdefgh";

/**
 * Arrows are laid out in board units: the board is 8 wide and 8 tall, a square
 * is 1, and y grows downwards, so the same numbers fit a board of any pixel size.
 */
export const squareCenter = (
  square: string,
  orientation: Orientation
): Point => {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  return orientation === "white"
    ? { x: file + 0.5, y: 7 - rank + 0.5 }
    : { x: 7 - file + 0.5, y: rank + 0.5 };
};

export const squareAtPoint = (
  x: number,
  y: number,
  orientation: Orientation
): Square | undefined => {
  const column = Math.floor(x);
  const row = Math.floor(y);
  if (column < 0 || column > 7 || row < 0 || row > 7) return undefined;

  const file = orientation === "white" ? column : 7 - column;
  const rank = orientation === "white" ? 7 - row : row;
  return `${FILES[file]}${rank + 1}` as Square;
};

/**
 * A displacement of one square by two is only ever a knight move, so the
 * shape of an arrow follows from its two squares alone and also holds for
 * moves in positions the board is not showing, such as a line of moves.
 */
export const isKnightStep = (from: string, to: string): boolean => {
  const files = FILES.indexOf(to[0]) - FILES.indexOf(from[0]);
  const ranks = Number(to[1]) - Number(from[1]);
  return files * files + ranks * ranks === 5;
};

export interface ArrowOutline {
  /**
   * One closed silhouette for the shaft, its elbow and the head. It is filled
   * once, so no join or overlap can show as a seam.
   */
  outline: Point[];
  /** The centre of the origin square, where the shaft starts. */
  origin: Point;
  /** Where the arrowhead ends, a little short of the destination's centre. */
  tip: Point;
  /** Where the head begins, on the final leg. */
  base: Point;
  /** Unit vector of the final leg. */
  direction: Point;
  /** Where the final leg starts: the origin, or the corner of a knight's L. */
  legStart: Point;
}

export interface ArrowOptions {
  /** Full width of the shaft. */
  width: number;
  /** How far the head reaches back from the tip. */
  headLength: number;
  /** Half the width of the head at its base. */
  headHalfWidth: number;
  tipInset?: number;
  /** Moves a straight arrow to its right, so that opposite arrows part. */
  offset?: number;
}

const DEFAULT_TIP_INSET = 0.12;
/** The head never takes more than this share of the leg it sits on. */
const MAX_HEAD_SHARE = 0.6;
/** Points along an outer elbow, so the bend is a smooth arc, not a corner. */
const ELBOW_STEPS = 4;

const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const unit = (a: Point): Point => {
  const length = Math.hypot(a.x, a.y);
  return { x: a.x / length, y: a.y / length };
};
/** The unit normal of a direction, turned a quarter to the left on screen. */
const normalOf = (direction: Point): Point => ({
  x: -direction.y,
  y: direction.x,
});

/**
 * One side of a polyline, pushed out by `half` to `side` (1 or -1). On an
 * elbow the inside is a mitred corner and the outside a short arc, so the bend
 * reads as one smooth stroke.
 */
const offsetSide = (points: Point[], half: number, side: 1 | -1): Point[] => {
  const directions = points
    .slice(1)
    .map((point, index) =>
      unit({ x: point.x - points[index].x, y: point.y - points[index].y })
    );
  const result: Point[] = [
    add(points[0], scale(normalOf(directions[0]), side * half)),
  ];

  for (let i = 1; i < points.length - 1; i++) {
    const before = normalOf(directions[i - 1]);
    const after = normalOf(directions[i]);
    if (Math.sign(cross(directions[i - 1], directions[i])) === side) {
      // The inside of the bend: where the two offset lines meet.
      const miter = half / (1 + dot(before, after));
      result.push(add(points[i], scale(add(before, after), side * miter)));
    } else {
      for (let step = 0; step <= ELBOW_STEPS; step++) {
        const t = step / ELBOW_STEPS;
        const arc = unit({
          x: (1 - t) * before.x + t * after.x,
          y: (1 - t) * before.y + t * after.y,
        });
        result.push(add(points[i], scale(arc, side * half)));
      }
    }
  }

  const last = points.length - 1;
  result.push(
    add(
      points[last],
      scale(normalOf(directions[directions.length - 1]), side * half)
    )
  );
  return result;
};

/**
 * An arrow from one square to another as a single silhouette. A knight's arrow
 * goes along the long side first and then turns onto the short one, the way the
 * piece moves; every other arrow is straight, and may be moved `offset` to its
 * right so that two arrows between the same squares in opposite directions do
 * not lie on top of each other.
 */
export const arrowOutline = (
  from: string,
  to: string,
  orientation: Orientation,
  {
    width,
    headLength,
    headHalfWidth,
    tipInset = DEFAULT_TIP_INSET,
    offset = 0,
  }: ArrowOptions
): ArrowOutline | undefined => {
  if (from === to) return undefined;

  const start = squareCenter(from, orientation);
  const end = squareCenter(to, orientation);
  const corner = isKnightStep(from, to)
    ? Math.abs(end.x - start.x) === 2
      ? { x: end.x, y: start.y }
      : { x: start.x, y: end.y }
    : undefined;

  const legStart = corner ?? start;
  const legLength = Math.hypot(end.x - legStart.x, end.y - legStart.y);
  const direction = unit({ x: end.x - legStart.x, y: end.y - legStart.y });

  // A head longer than its share of the leg would fold back over the corner.
  const head = Math.min(headLength, (legLength - tipInset) * MAX_HEAD_SHARE);
  const tipAt = add(end, scale(direction, -tipInset));
  const baseAt = add(tipAt, scale(direction, -head));

  // A straight arrow is moved as a whole; a knight's already turns away from its twin.
  const lane = corner ? { x: 0, y: 0 } : scale(normalOf(direction), offset);
  const shifted = (point: Point) => add(point, lane);
  const centre = (corner ? [start, corner, baseAt] : [start, baseAt]).map(
    shifted
  );
  const tip = shifted(tipAt);
  const base = shifted(baseAt);

  const half = width / 2;
  const left = offsetSide(centre, half, 1);
  const right = offsetSide(centre, half, -1);
  const outline = [
    ...left,
    add(base, scale(normalOf(direction), headHalfWidth)),
    tip,
    add(base, scale(normalOf(direction), -headHalfWidth)),
    ...right.reverse(),
  ];

  return {
    outline,
    origin: centre[0],
    tip,
    base,
    direction,
    legStart: shifted(legStart),
  };
};

/** Quarter-turn corners of a square, from the top right, as the badges sit on them. */
const BADGE_CORNER_OFFSET = 0.3;

const badgeCorners = (center: Point) => [
  { x: center.x + BADGE_CORNER_OFFSET, y: center.y - BADGE_CORNER_OFFSET },
  { x: center.x + BADGE_CORNER_OFFSET, y: center.y + BADGE_CORNER_OFFSET },
  { x: center.x - BADGE_CORNER_OFFSET, y: center.y - BADGE_CORNER_OFFSET },
  { x: center.x - BADGE_CORNER_OFFSET, y: center.y + BADGE_CORNER_OFFSET },
];

/** The corner that the move-quality mark occupies. */
export const QUALITY_CORNER = 0;

export interface BadgeRequest {
  key: string;
  to: string;
  /** Where the arrow's final leg starts, so a badge sits beside its head. */
  legStart: Point;
}

/**
 * A corner for each badge: the corner farthest from where its arrow came from,
 * taken in order, and never one that a badge or the move-quality mark already
 * holds on the same square. Badges that cannot be kept apart share the last
 * corner, which keeps placement deterministic.
 */
export const placeBadges = (
  requests: readonly BadgeRequest[],
  orientation: Orientation,
  qualityMarked: ReadonlySet<string>
): Map<string, Point> => {
  const taken = new Map<string, Set<number>>();
  const placed = new Map<string, Point>();

  for (const request of requests) {
    const center = squareCenter(request.to, orientation);
    const corners = badgeCorners(center);
    const holds = taken.get(request.to) ?? new Set<number>();
    if (qualityMarked.has(request.to)) holds.add(QUALITY_CORNER);

    const order = corners
      .map((corner, index) => ({
        index,
        corner,
        distance: Math.hypot(
          corner.x - request.legStart.x,
          corner.y - request.legStart.y
        ),
      }))
      .sort((a, b) => b.distance - a.distance || a.index - b.index);

    const choice = order.find((entry) => !holds.has(entry.index)) ?? order[0];
    holds.add(choice.index);
    taken.set(request.to, holds);
    placed.set(request.key, choice.corner);
  }

  return placed;
};
