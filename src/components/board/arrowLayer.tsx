import {
  Orientation,
  Point,
  arrowOutline,
  placeBadges,
  squareCenter,
} from "@/lib/arrows/geometry";
import { BADGE_GLYPHS } from "@/lib/arrows/glyphs";
import { mergeArrows } from "@/lib/arrows/merge";
import { withSources } from "@/lib/arrows/source";
import { ArrowPalette } from "@/lib/arrows/palette";
import { arrowPaletteAtom } from "@/lib/arrows/paletteAtom";
import { ArrowStyle, arrowStyle, checkerTint } from "@/lib/arrows/style";
import { ArrowSide, BoardArrow } from "@/lib/arrows/types";
import { useAtomValue } from "jotai";
import {
  CSSProperties,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useState,
} from "react";
import {
  pieceSetAtom,
  boardThemeAtom,
  boardHueAtom,
  BOARD_THEMES,
} from "./states";
import { readableArrowColor } from "@/lib/arrows/contrast";
import tinycolor from "tinycolor2";

interface Props {
  arrows: readonly BoardArrow[];
  /** The user's own drawings sit above every engine arrow. */
  ink?: readonly BoardArrow[];
  draft?: BoardArrow;
  orientation: Orientation;
  /** The side to move on the displayed board. Its arrows take the palette's first hue; the other side's take its second. */
  turn: ArrowSide;
  /** The displayed position. Without it, no arrow passes behind a piece. */
  fen?: string;
  /** Pixel size for boards that have one; otherwise the layer fills its parent. */
  size?: number;
  /** Off while a piece is moving or being dragged, so no arrow is cut where no piece stands. */
  masking?: boolean;
  /** The square whose top-right corner holds the move-quality mark, which the labels keep off. */
  qualityMarkedSquare?: string;
}

const FADE_IN =
  "@media (prefers-reduced-motion: no-preference){@keyframes chesskit-arrow-in{from{opacity:0}to{opacity:1}}}";

const layerStyle = (size?: number): CSSProperties => ({
  position: "absolute",
  top: 0,
  left: 0,
  width: size ?? "100%",
  height: size ?? "100%",
  pointerEvents: "none",
  userSelect: "none",
  zIndex: 10,
});

const fixed = (value: number) => Number(value.toFixed(3));

const toPoints = (points: Point[]) =>
  points.map((point) => `${fixed(point.x)},${fixed(point.y)}`).join(" ");

/** How far two arrows in opposite directions between the same squares part. */
const OPPOSITE_OFFSET = 0.14;
/** The size of a badge's character, in board units, for the usual badge. */
const BADGE_EM = 0.2;
/** A badge's radius, in board units, when the board has no pixel size. */
const BADGE_RADIUS = 0.17;
/** A badge is never smaller than this many pixels across, however small the board. */
const MIN_BADGE_PIXELS = 18;
/** A checker cell is an eighth of a square, so a head shows several cells. */
const CHECKER_CELL = 0.125;
/** The origin cue of an arrow whose piece is not on the board. */
const ORIGIN_CUE = 0.09;

/** An id that may be used inside a url(#…) reference. */
const safeId = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, "");

/**
 * Whether arrows may be cut around pieces right now. A piece slides for a
 * moment after the position changes, and the cut would not follow it, so the
 * cuts wait until the slide has finished.
 */
export const useMaskSettling = (fen: string, settleMs: number) => {
  const [sliding, setSliding] = useState(false);
  useEffect(() => {
    setSliding(true);
    const timer = window.setTimeout(() => setSliding(false), settleMs);
    return () => window.clearTimeout(timer);
  }, [fen, settleMs]);
  return !sliding;
};

/** Images already loaded or failed, so each piece asset is fetched once. */
const settledImages = new Set<string>();

/**
 * Waits for the piece images that masks use. An arrow is not drawn until its
 * image has settled, so it is never drawn over a piece its mask has not cut.
 * A failed image counts as settled: the arrow is then drawn unmasked, rather
 * than never.
 */
const useSettledImages = (urls: readonly string[]) => {
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const key = urls.join("|");

  useEffect(() => {
    let current = true;
    for (const url of key ? key.split("|") : []) {
      if (settledImages.has(url)) continue;
      const image = new Image();
      const settle = () => {
        settledImages.add(url);
        if (current) refresh();
      };
      image.onload = settle;
      image.onerror = settle;
      image.src = url;
    }
    return () => {
      current = false;
    };
  }, [key]);

  return settledImages;
};

interface Drawn {
  key: string;
  arrow: BoardArrow;
  style: ArrowStyle;
  shape: NonNullable<ReturnType<typeof arrowOutline>>;
  /** The piece's image when the arrow passes behind it. */
  maskUrl?: string;
  /** The square the mask cuts, so one mask serves every arrow from it. */
  maskSquare?: string;
  /** The ply numbers the arrow carries, the first and any merged in after it. */
  labels: string[];
}

const pieceUrl = (set: string, code: string) => `/piece/${set}/${code}.svg`;

interface Shared {
  orientation: Orientation;
  turn: ArrowSide;
  pieceSet: string;
  masking: boolean;
  palette: ArrowPalette;
}

const drawnArrow = (
  arrow: BoardArrow,
  key: string,
  { orientation, turn, pieceSet, masking, palette }: Shared,
  offset = 0
): Drawn | undefined => {
  const style = arrowStyle(arrow, turn, palette);
  const shape = arrowOutline(arrow.from, arrow.to, orientation, {
    width: style.width,
    headLength: style.headLength,
    headHalfWidth: style.headHalfWidth,
    offset,
  });
  if (!shape) return undefined;

  const masked = masking && !!arrow.sourcePiece;
  return {
    key,
    arrow,
    style,
    shape,
    maskUrl: masked ? pieceUrl(pieceSet, arrow.sourcePiece ?? "") : undefined,
    maskSquare: masked ? arrow.from : undefined,
    labels: [arrow.label, ...(arrow.alsoLabels ?? [])].filter(
      (label): label is string => label !== undefined
    ),
  };
};

function Badge({
  text,
  at,
  color,
  radius,
}: {
  text: string;
  at: Point;
  color: string;
  radius: number;
}) {
  const glyph = BADGE_GLYPHS[text];
  const em = BADGE_EM * (radius / BADGE_RADIUS);
  return (
    <>
      <circle
        cx={fixed(at.x)}
        cy={fixed(at.y)}
        r={radius}
        fill={color}
        stroke="#ffffff"
        strokeWidth={radius * 0.18}
      />
      {/* A character is drawn from its outline, centred on the middle of its
          ink, not set as text: a browser centres text by the font's metrics,
          which leaves a digit a little off the middle of its circle. */}
      {glyph ? (
        <path
          d={glyph}
          transform={`translate(${fixed(at.x)} ${fixed(at.y)}) scale(${em})`}
          fill="#ffffff"
        />
      ) : (
        <text
          x={fixed(at.x)}
          y={fixed(at.y)}
          dy="0.355em"
          textAnchor="middle"
          fontSize={em}
          fontWeight={600}
          fill="#ffffff"
        >
          {text}
        </text>
      )}
    </>
  );
}

/**
 * An arrow's silhouette, filled once. A missed move is then checkered by a
 * second tone of the same hue laid over that silhouette, so there are no gaps.
 */
function ArrowBody({
  drawn,
  uid,
  masked,
  faded,
}: {
  drawn: Drawn;
  uid: string;
  masked: boolean;
  faded: boolean;
}) {
  const { arrow, style, shape } = drawn;
  const polygon = toPoints(shape.outline);
  const checker = style.checkered
    ? `url(#${uid}-checker-${style.color.slice(1)})`
    : undefined;
  // Without a piece to pass behind, the arrow shows where it starts instead.
  const showOrigin = !arrow.sourcePiece && arrow.kind !== "content";

  return (
    <g
      opacity={style.opacity * (faded ? 0.6 : 1)}
      mask={
        masked && drawn.maskSquare
          ? `url(#${uid}-src-${drawn.maskSquare})`
          : undefined
      }
      style={{ animation: "chesskit-arrow-in 140ms ease-out" }}
    >
      <polygon
        points={polygon}
        fill={
          arrow.kind === "content" || arrow.kind === "ink"
            ? style.color
            : `url(#${uid}-tone-${style.color.slice(1)})`
        }
      />
      {checker && <polygon points={polygon} fill={checker} />}
      {showOrigin && (
        <circle
          cx={fixed(shape.origin.x)}
          cy={fixed(shape.origin.y)}
          r={ORIGIN_CUE}
          fill={style.color}
        />
      )}
    </g>
  );
}

export default function ArrowLayer({
  arrows,
  ink,
  draft,
  orientation,
  turn,
  fen,
  size,
  masking = true,
  qualityMarkedSquare,
}: Props) {
  const uid = safeId(useId());
  const pieceSet = useAtomValue(pieceSetAtom);
  const boardTheme = useAtomValue(boardThemeAtom);
  const boardHue = useAtomValue(boardHueAtom);
  const squares = useMemo(
    () => ({
      light: tinycolor(BOARD_THEMES[boardTheme].light)
        .spin(boardHue)
        .toHexString(),
      dark: tinycolor(BOARD_THEMES[boardTheme].dark)
        .spin(boardHue)
        .toHexString(),
    }),
    [boardTheme, boardHue]
  );
  const palette = useAtomValue(arrowPaletteAtom);
  const shared: Shared = { orientation, turn, pieceSet, masking, palette };

  const merged = useMemo(() => mergeArrows(arrows), [arrows]);
  const sourced = useMemo(() => withSources(merged, fen), [merged, fen]);
  const sourcedInk = useMemo(() => withSources(ink ?? [], fen), [ink, fen]);

  const opposed = useMemo(
    () => new Set(merged.map((arrow) => `${arrow.to}-${arrow.from}`)),
    [merged]
  );

  const bodies = sourced.flatMap((arrow) => {
    const drawn = drawnArrow(
      arrow,
      `${arrow.kind}:${arrow.from}${arrow.to}`,
      shared,
      opposed.has(`${arrow.from}-${arrow.to}`) ? OPPOSITE_OFFSET : 0
    );
    return drawn ? [drawn] : [];
  });
  const inkBodies = sourcedInk.flatMap((arrow) => {
    const drawn = drawnArrow(arrow, `ink:${arrow.from}${arrow.to}`, shared);
    return drawn ? [drawn] : [];
  });
  const draftBody = draft ? drawnArrow(draft, "draft", shared) : undefined;

  const settled = useSettledImages(
    masking
      ? [...sourced, ...sourcedInk]
          .filter((arrow) => arrow.sourcePiece)
          .map((arrow) => pieceUrl(pieceSet, arrow.sourcePiece ?? ""))
      : []
  );
  // An arrow waits for its piece image, so no body is drawn un-cut over a piece.
  const shown = bodies.filter(
    (drawn) => !drawn.maskUrl || settled.has(drawn.maskUrl)
  );
  const shownInk = inkBodies.filter(
    (drawn) => !drawn.maskUrl || settled.has(drawn.maskUrl)
  );

  const pxPerSquare = size ? size / 8 : undefined;
  const badgeRadius = pxPerSquare
    ? Math.max(BADGE_RADIUS, MIN_BADGE_PIXELS / 2 / pxPerSquare)
    : BADGE_RADIUS;

  // Labels are placed together, so that no two of them, nor one and the
  // move-quality mark, share a corner.
  const badges = useMemo(() => {
    const requests = shown.flatMap((drawn) =>
      drawn.labels.map((label, index) => ({
        key: `${drawn.key}#${index}`,
        to: drawn.arrow.to,
        legStart: drawn.shape.legStart,
        text: label,
        color: drawn.style.color,
      }))
    );
    const corners = placeBadges(
      requests,
      orientation,
      new Set(qualityMarkedSquare ? [qualityMarkedSquare] : [])
    );
    return requests.map((request) => ({
      ...request,
      at: corners.get(request.key) ?? squareCenter(request.to, orientation),
    }));
  }, [shown, orientation, qualityMarkedSquare]);

  const masks = useMemo(() => {
    const bySquare = new Map<string, string>();
    for (const drawn of [...shown, ...shownInk]) {
      if (drawn.maskUrl && drawn.maskSquare) {
        bySquare.set(drawn.maskSquare, drawn.maskUrl);
      }
    }
    return [...bySquare.entries()].map(([square, url]) => {
      const center = squareCenter(square, orientation);
      return { square, url, x: center.x - 0.5, y: center.y - 0.5 };
    });
  }, [shown, shownInk, orientation]);

  const checkerColors = [
    ...new Set(
      [...shown, ...shownInk, ...(draftBody ? [draftBody] : [])]
        .filter((drawn) => drawn.style.checkered)
        .map((drawn) => drawn.style.color)
    ),
  ];
  const bodyColors = [
    ...new Set(
      [...shown, ...shownInk, ...(draftBody ? [draftBody] : [])]
        .filter(
          (drawn) =>
            drawn.arrow.kind !== "content" && drawn.arrow.kind !== "ink"
        )
        .map((drawn) => drawn.style.color)
    ),
  ];

  return (
    <svg viewBox="0 0 8 8" aria-hidden style={layerStyle(size)}>
      <style>{FADE_IN}</style>
      <defs>
        {bodyColors.map((color) => {
          const tones = {
            light: readableArrowColor(color, squares.light),
            dark: readableArrowColor(color, squares.dark),
          };
          return (
            <pattern
              key={`tone-${color}`}
              id={`${uid}-tone-${color.slice(1)}`}
              patternUnits="userSpaceOnUse"
              width={8}
              height={8}
            >
              {Array.from({ length: 64 }, (_, index) => (
                <rect
                  key={index}
                  x={index % 8}
                  y={Math.floor(index / 8)}
                  width={1}
                  height={1}
                  fill={
                    ((index % 8) + Math.floor(index / 8)) % 2
                      ? tones.dark
                      : tones.light
                  }
                />
              ))}
            </pattern>
          );
        })}
        {masks.map((mask) => (
          <mask
            key={mask.square}
            id={`${uid}-src-${mask.square}`}
            maskUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={8}
            height={8}
          >
            <rect width={8} height={8} fill="#ffffff" />
            {/* The piece's own silhouette, in black, cuts the arrow away. */}
            <image
              data-arrow-source={mask.square}
              href={mask.url}
              x={fixed(mask.x)}
              y={fixed(mask.y)}
              width={1}
              height={1}
              style={{
                filter: "brightness(0)",
                transform: `translate(var(--piece-${mask.square}-x, 0px), var(--piece-${mask.square}-y, 0px))`,
                opacity: `var(--piece-${mask.square}-opacity, 1)`,
              }}
            />
          </mask>
        ))}
        {checkerColors.map((color) => (
          <pattern
            key={color}
            id={`${uid}-checker-${color.slice(1)}`}
            patternUnits="userSpaceOnUse"
            width={CHECKER_CELL * 2}
            height={CHECKER_CELL * 2}
          >
            <rect
              width={CHECKER_CELL}
              height={CHECKER_CELL}
              fill={checkerTint(color)}
            />
            <rect
              x={CHECKER_CELL}
              y={CHECKER_CELL}
              width={CHECKER_CELL}
              height={CHECKER_CELL}
              fill={checkerTint(color)}
            />
          </pattern>
        ))}
      </defs>

      {shown.map((drawn) => (
        <ArrowBody
          key={drawn.key}
          drawn={drawn}
          uid={uid}
          masked={!!drawn.maskUrl}
          faded={false}
        />
      ))}
      {shownInk.map((drawn) => (
        <ArrowBody
          key={drawn.key}
          drawn={drawn}
          uid={uid}
          masked={!!drawn.maskUrl}
          faded={false}
        />
      ))}
      {draftBody && (
        <ArrowBody drawn={draftBody} uid={uid} masked={false} faded />
      )}

      {/* Every label comes after every body, so no arrow can cover a number. */}
      {badges.map((badge) => (
        <Badge
          key={badge.key}
          text={badge.text}
          at={badge.at}
          color={badge.color}
          radius={badgeRadius}
        />
      ))}
    </svg>
  );
}

/** A sample of an arrow's style, for the legend. */
export function ArrowGlyph({
  arrow,
  turn,
}: {
  arrow: BoardArrow;
  turn: ArrowSide;
}) {
  const uid = safeId(useId());
  const palette = useAtomValue(arrowPaletteAtom);
  const style = arrowStyle({ ...arrow, dimmed: false }, turn, palette);
  const sample = arrowOutline("a4", "c4", "white", {
    width: style.width,
    headLength: style.headLength,
    headHalfWidth: style.headHalfWidth,
  });
  const polygon = sample ? toPoints(sample.outline) : "";
  return (
    <svg viewBox="0 4 3.3 1" width={59} height={18} aria-hidden>
      {style.checkered && (
        <defs>
          <pattern
            id={`${uid}-checker`}
            patternUnits="userSpaceOnUse"
            width={CHECKER_CELL * 2}
            height={CHECKER_CELL * 2}
          >
            <rect
              width={CHECKER_CELL}
              height={CHECKER_CELL}
              fill={checkerTint(style.color)}
            />
            <rect
              x={CHECKER_CELL}
              y={CHECKER_CELL}
              width={CHECKER_CELL}
              height={CHECKER_CELL}
              fill={checkerTint(style.color)}
            />
          </pattern>
        </defs>
      )}
      {sample && (
        <g opacity={style.opacity}>
          <polygon points={polygon} fill={style.color} />
          {style.checkered && (
            <polygon points={polygon} fill={`url(#${uid}-checker)`} />
          )}
        </g>
      )}
      {arrow.label && (
        <Badge
          text={arrow.label}
          at={{ x: 2.86, y: 4.5 }}
          color={style.color}
          radius={0.45}
        />
      )}
    </svg>
  );
}
