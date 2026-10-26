import { Chessboard } from "react-chessboard";
import type {
  ChessboardProps,
  CustomPieces,
  BoardPosition,
} from "react-chessboard/dist/chessboard/types";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import { pieceMotionAtom, pieceSetAtom } from "./states";
import { parseFenLoose, START_FEN } from "@/lib/editorPosition";
import {
  matchMotionPieces,
  MotionPiece,
  pieceSquarePoint,
} from "@/lib/boardMotion";
import { PIECE_SLIDE_MS, scaledMotionMs } from "@/lib/pieceMotion";

interface DrawnPiece extends MotionPiece {
  element: HTMLDivElement;
  exiting?: boolean;
}

interface MotionProps extends Omit<ChessboardProps, "ref"> {
  /**
   * Names the position being shown. When it changes, the new position is a
   * different one rather than a move, so pieces appear where they are instead
   * of sliding there from the old position.
   */
  motionKey?: string;
}

/** The rules/drag board commits immediately. An independent presentation layer
 * retargets from the currently visible pose, including interrupted undo/redo. */
export default function MotionChessboard({ motionKey, ...props }: MotionProps) {
  const {
    position = "start",
    boardOrientation = "white",
    animationDuration = PIECE_SLIDE_MS,
    customPieces,
  } = props;
  const motionMode = useAtomValue(pieceMotionAtom);
  const previousKey = useRef(motionKey);
  const layer = useRef<HTMLDivElement>(null);
  const pieces = useRef<DrawnPiece[]>([]);
  const serial = useRef(0);
  const dragged = useRef<string | null>(null);
  const manualDrop = useRef<string | null>(null);
  const frame = useRef(0);
  const pieceSet = useAtomValue(pieceSetAtom);
  const initialized = useRef(false);
  const previousOrientation = useRef(boardOrientation);
  const placementText =
    typeof position === "string" ? position : JSON.stringify(position);
  const placement = useMemo<BoardPosition>(
    () =>
      placementText.startsWith("{")
        ? JSON.parse(placementText)
        : (parseFenLoose(placementText === "start" ? START_FEN : placementText)
            ?.pieces ?? {}),
    [placementText]
  );
  const previewPieces = useMemo<CustomPieces>(
    () =>
      Object.fromEntries(
        Object.entries(customPieces ?? {}).map(([code, render]) => [
          code,
          (args: Parameters<NonNullable<CustomPieces["wP"]>>[0]) => (
            <div
              data-static-piece={args.square ? "" : undefined}
              style={{ visibility: args.square ? "hidden" : "visible" }}
            >
              {render?.(args)}
            </div>
          ),
        ])
      ),
    [customPieces]
  );

  useLayoutEffect(() => {
    const host = layer.current;
    if (!host) return;
    let active = true;
    const animations: Animation[] = [];
    const parent = host.parentElement?.parentElement;
    const old = pieces.current;
    const poses = new Map(
      old.map((piece) => [piece.id, piece.element.getBoundingClientRect()])
    );
    const opacity = new Map(
      old.map((piece) => [piece.id, getComputedStyle(piece.element).opacity])
    );
    const images = new Map(
      old.map((piece) => [piece.id, piece.element.style.backgroundImage])
    );
    const matched = matchMotionPieces(
      old,
      placement,
      () => `piece-${++serial.current}`
    );
    const rect = host.getBoundingClientRect();
    const cell = rect.width / 8;
    const jumped = previousKey.current !== motionKey;
    const duration =
      previousOrientation.current !== boardOrientation || jumped
        ? 0
        : scaledMotionMs(
            animationDuration,
            motionMode,
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
          );
    previousOrientation.current = boardOrientation;
    previousKey.current = motionKey;
    const initial = !initialized.current;
    initialized.current = true;
    const moving: DrawnPiece[] = [];
    const next: DrawnPiece[] = matched.pieces.map((piece) => {
      const prior = old.find((entry) => entry.id === piece.id);
      const element = prior?.element ?? document.createElement("div");
      for (const animation of element.getAnimations()) animation.cancel();
      const at = pieceSquarePoint(piece.square, boardOrientation);
      element.dataset.visualPiece = piece.piece;
      element.dataset.motionSquare = piece.square;
      element.dataset.renderedPiece =
        duration && prior && prior.piece !== piece.piece
          ? (element.dataset.renderedPiece ?? prior.piece)
          : piece.piece;
      Object.assign(element.style, {
        position: "absolute",
        left: `${at.x * 12.5}%`,
        top: `${at.y * 12.5}%`,
        width: "12.5%",
        height: "12.5%",
        backgroundImage:
          duration && prior && prior.piece !== piece.piece
            ? images.get(piece.id)
            : `url(/piece/${pieceSet}/${piece.piece}.svg)`,
        backgroundSize: "contain",
        opacity: dragged.current === piece.square ? "0" : "1",
      });
      if (!prior) host.appendChild(element);
      // A captured piece can reappear before its exit animation finishes.
      // The reused identity is live again, regardless of its previous flag.
      const entry = { ...piece, element, exiting: false };
      if (duration && !initial) {
        const pose = poses.get(piece.id);
        const fromDrag = prior?.square === manualDrop.current;
        const scale = pose && !fromDrag && cell ? pose.width / cell : 1;
        const dx =
          pose && !fromDrag
            ? pose.left - (rect.left + at.x * cell) - (cell - pose.width) / 2
            : 0;
        const dy =
          pose && !fromDrag
            ? pose.top - (rect.top + at.y * cell) - (cell - pose.height) / 2
            : 0;
        if (
          !prior ||
          prior.exiting ||
          Math.abs(dx) > 0.1 ||
          Math.abs(dy) > 0.1 ||
          Number(opacity.get(piece.id) ?? 1) < 0.999
        ) {
          moving.push(entry);
          animations.push(
            element.animate(
              [
                {
                  transform: pose
                    ? `translate(${dx}px, ${dy}px) scale(${scale})`
                    : "scale(.85)",
                  opacity: prior ? Number(opacity.get(piece.id) ?? 1) : 0,
                },
                { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
              ],
              { duration, easing: "ease" }
            )
          );
        }
      }
      return entry;
    });
    for (const piece of matched.removed) {
      const prior = old.find((entry) => entry.id === piece.id)!;
      for (const animation of prior.element.getAnimations()) animation.cancel();
      const pose = poses.get(prior.id)!;
      Object.assign(prior.element.style, {
        left: `${pose.left - rect.left - (cell - pose.width) / 2}px`,
        top: `${pose.top - rect.top - (cell - pose.height) / 2}px`,
        opacity: "0",
      });
      if (duration)
        animations.push(
          prior.element.animate(
            [
              {
                opacity: Number(opacity.get(prior.id) ?? 1),
                transform: `scale(${cell ? pose.width / cell : 1})`,
              },
              { opacity: 0, transform: "scale(.85)" },
            ],
            { duration, easing: "ease" }
          )
        );
      const exiting = { ...prior, exiting: true };
      next.push(exiting);
      moving.push(exiting);
    }
    pieces.current = next;
    manualDrop.current = null;
    const finish = () => {
      if (!active || !host.isConnected) return;
      cancelAnimationFrame(frame.current);
      for (const piece of pieces.current.filter((entry) => entry.exiting))
        piece.element.remove();
      pieces.current = pieces.current.filter((entry) => !entry.exiting);
      for (const piece of pieces.current) {
        const asset = `/piece/${pieceSet}/${piece.piece}.svg`;
        piece.element.style.backgroundImage = `url(${asset})`;
        piece.element.dataset.renderedPiece = piece.piece;
        parent
          ?.querySelector(`[data-arrow-source="${piece.square}"]`)
          ?.setAttribute("href", asset);
        parent?.style.setProperty(`--piece-${piece.square}-x`, "0px");
        parent?.style.setProperty(`--piece-${piece.square}-y`, "0px");
      }
    };
    // WAAPI's timeline can start after the JS call. Finish on the actual
    // animation, so a promoted sprite and its source mask settle together.
    void Promise.allSettled(
      animations.map((animation) => animation.finished)
    ).then(finish);
    cancelAnimationFrame(frame.current);
    // Reset stationary masks once; per-frame work follows only moving pieces.
    for (const piece of next.filter((entry) => !entry.exiting)) {
      parent?.style.setProperty(`--piece-${piece.square}-x`, "0px");
      parent?.style.setProperty(`--piece-${piece.square}-y`, "0px");
      parent?.style.setProperty(
        `--piece-${piece.square}-opacity`,
        dragged.current === piece.square ? "0" : "1"
      );
    }
    const updateMasks = () => {
      // Batch all geometry reads before style writes to avoid layout thrashing.
      const currentRect = host.getBoundingClientRect();
      const currentCell = currentRect.width / 8;
      const readings = moving.map((piece) => ({
        piece,
        pose: piece.element.getBoundingClientRect(),
      }));
      for (const { piece, pose } of readings.filter(
        ({ piece }) => !piece.exiting
      )) {
        // Source masks share the visible sprite during promotion and its undo,
        // in addition to sharing its animated pose through the CSS variables.
        const sourceMask = parent?.querySelector(
          `[data-arrow-source="${piece.square}"]`
        );
        const asset = `/piece/${pieceSet}/${piece.element.dataset.renderedPiece ?? piece.piece}.svg`;
        if (sourceMask && sourceMask.getAttribute("href") !== asset)
          sourceMask.setAttribute("href", asset);
        const at = pieceSquarePoint(piece.square, boardOrientation);
        parent?.style.setProperty(
          `--piece-${piece.square}-x`,
          `${currentCell ? (pose.left - currentRect.left) / currentCell - at.x : 0}px`
        );
        parent?.style.setProperty(
          `--piece-${piece.square}-y`,
          `${currentCell ? (pose.top - currentRect.top) / currentCell - at.y : 0}px`
        );
        parent?.style.setProperty(
          `--piece-${piece.square}-opacity`,
          dragged.current === piece.square ? "0" : "1"
        );
      }
      if (
        animations.some(
          (animation) => animation.playState === "running" || animation.pending
        )
      )
        frame.current = requestAnimationFrame(updateMasks);
    };
    updateMasks();
    return () => {
      active = false;
      cancelAnimationFrame(frame.current);
    };
  }, [
    placement,
    boardOrientation,
    animationDuration,
    pieceSet,
    motionKey,
    motionMode,
  ]);

  useLayoutEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      for (const piece of pieces.current)
        for (const animation of piece.element.getAnimations())
          animation.cancel();
    },
    []
  );

  return (
    <div
      data-motion-board
      style={{ position: "relative", width: props.boardWidth ?? "100%" }}
    >
      <Chessboard
        {...props}
        animationDuration={0}
        customPieces={previewPieces}
        onPieceDragBegin={(piece, square) => {
          dragged.current = square;
          const visual = pieces.current.find(
            (entry) => entry.square === square && !entry.exiting
          );
          if (visual) {
            for (const animation of visual.element.getAnimations())
              animation.cancel();
            visual.element.style.opacity = "0";
          }
          layer.current?.parentElement?.parentElement?.style.setProperty(
            `--piece-${square}-opacity`,
            "0"
          );
          props.onPieceDragBegin?.(piece, square);
        }}
        onPieceDragEnd={(piece, square) => {
          dragged.current = null;
          const visual = pieces.current.find(
            (entry) => entry.square === square && !entry.exiting
          );
          if (visual) visual.element.style.opacity = "1";
          layer.current?.parentElement?.parentElement?.style.setProperty(
            `--piece-${square}-opacity`,
            "1"
          );
          props.onPieceDragEnd?.(piece, square);
        }}
        onPieceDrop={(source, target, piece) => {
          manualDrop.current = source;
          return props.onPieceDrop?.(source, target, piece) ?? true;
        }}
      />
      <div
        ref={layer}
        aria-hidden
        data-piece-presentation
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 7,
          filter: props.customBoardStyle?.filter
            ? String(props.customBoardStyle.filter)
            : undefined,
        }}
      />
    </div>
  );
}
