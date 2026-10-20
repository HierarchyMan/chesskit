import { PieceSymbol, Square } from "chess.js";
import {
  EditablePosition,
  PieceCode,
  positionToFen,
  sanitizePosition,
} from "../editorPosition";
import { CellAnalysis, ShapeDescriptor } from "./cell";
import { assignByClusters } from "./cluster";

export interface ShapeTemplate extends ShapeDescriptor {
  type: PieceSymbol;
  set: string;
}

export interface TypeScore {
  type: PieceSymbol;
  distance: number;
}

export interface ClassifiedCell {
  piece: PieceCode | null;
  confidence: number;
}

export interface ScanPosition {
  pieces: EditablePosition["pieces"];
  confidences: Partial<Record<Square, number>>;
  whiteAtBottom: boolean;
  fen: string;
}

const PIECE_TYPES: PieceSymbol[] = ["p", "n", "b", "r", "q", "k"];
export const classifierSettings = {
  aspectWeight: 60,
  heightWeight: 300,
  closestTemplates: 3,
  useClusters: true,
  clusterDistance: 8,
  maxClusters: 9,
};
const FILES = "abcdefgh";

export const shapeDistance = (
  a: ShapeDescriptor,
  b: ShapeDescriptor
): number => {
  let sum = 0;
  for (let i = 0; i < a.shape.length; i++) {
    const diff = a.shape[i] - b.shape[i];
    sum += diff * diff;
  }

  const aspectDiff = a.aspect - b.aspect;
  const heightDiff = a.heightFraction - b.heightFraction;

  return (
    sum +
    classifierSettings.aspectWeight * aspectDiff * aspectDiff +
    classifierSettings.heightWeight * heightDiff * heightDiff
  );
};

export const scoreTypes = (
  descriptor: ShapeDescriptor,
  templates: ShapeTemplate[]
): TypeScore[] => {
  const distances = new Map<PieceSymbol, number[]>();

  for (const template of templates) {
    const list = distances.get(template.type) ?? [];
    list.push(shapeDistance(descriptor, template));
    distances.set(template.type, list);
  }

  return PIECE_TYPES.filter((type) => distances.has(type))
    .map((type) => {
      const closest = (distances.get(type) as number[])
        .sort((a, b) => a - b)
        .slice(0, classifierSettings.closestTemplates);

      return {
        type,
        distance:
          closest.reduce((sum, value) => sum + value, 0) / closest.length,
      };
    })
    .sort((a, b) => a.distance - b.distance);
};

export const normalizeTemplateHeights = (
  templates: ShapeTemplate[]
): ShapeTemplate[] => {
  const tallest = new Map<string, number>();

  for (const template of templates) {
    tallest.set(
      template.set,
      Math.max(tallest.get(template.set) ?? 0, template.heightFraction)
    );
  }

  return templates.map((template) => ({
    ...template,
    heightFraction:
      template.heightFraction / (tallest.get(template.set) as number),
  }));
};

const confidenceOf = (scores: TypeScore[]): number => {
  if (scores.length < 2) return 1;
  const [best, second] = scores;
  return Math.max(
    0,
    Math.min(1, (second.distance - best.distance) / (second.distance + 1e-6))
  );
};

const bestExcluding = (
  scores: TypeScore[],
  excluded: PieceSymbol[]
): TypeScore =>
  scores.find((score) => !excluded.includes(score.type)) ?? scores[0];

export const classifyCells = (
  cells: CellAnalysis[],
  templates: ShapeTemplate[]
): ClassifiedCell[] => {
  const tallest = Math.max(
    0.01,
    ...cells.map((cell) =>
      !cell.empty && cell.descriptor ? cell.descriptor.heightFraction : 0
    )
  );
  const descriptors = cells.map((cell) =>
    !cell.empty && cell.descriptor
      ? {
          ...cell.descriptor,
          heightFraction: cell.descriptor.heightFraction / tallest,
        }
      : undefined
  );
  const scores = descriptors.map((descriptor) =>
    descriptor ? scoreTypes(descriptor, templates) : undefined
  );

  if (classifierSettings.useClusters) {
    const clustered = assignByClusters(
      cells.flatMap((cell, index) =>
        cell.color && descriptors[index] && scores[index]
          ? [
              {
                index,
                color: cell.color,
                descriptor: descriptors[index] as ShapeDescriptor,
                scores: scores[index] as TypeScore[],
              },
            ]
          : []
      ),
      shapeDistance,
      {
        clusterDistance: classifierSettings.clusterDistance,
        maxClusters: classifierSettings.maxClusters,
      }
    );

    if (clustered) {
      return cells.map((cell, index) => {
        const assignment = clustered.get(index);
        if (!assignment || !cell.color) return { piece: null, confidence: 1 };

        return {
          piece: `${cell.color}${assignment.type.toUpperCase()}` as PieceCode,
          confidence: assignment.confidence,
        };
      });
    }
  }

  const assigned: (PieceSymbol | null)[] = scores.map(
    (entry) => entry?.[0].type ?? null
  );

  for (const color of ["w", "b"] as const) {
    const indexes = cells
      .map((cell, index) =>
        cell.color === color && scores[index] ? index : -1
      )
      .filter((index) => index >= 0);
    if (!indexes.length) continue;

    const kingDistance = (index: number) =>
      scores[index]?.find((score) => score.type === "k")?.distance ?? Infinity;
    const kingIndex = indexes.reduce((best, index) =>
      kingDistance(index) < kingDistance(best) ? index : best
    );

    for (const index of indexes) {
      if (index === kingIndex) assigned[index] = "k";
      else if (assigned[index] === "k") {
        assigned[index] = bestExcluding(scores[index] as TypeScore[], [
          "k",
        ]).type;
      }
    }
  }

  cells.forEach((_, index) => {
    const row = Math.floor(index / 8);
    if ((row === 0 || row === 7) && assigned[index] === "p" && scores[index]) {
      assigned[index] = bestExcluding(scores[index] as TypeScore[], ["p"]).type;
    }
  });

  return cells.map((cell, index) => {
    const type = assigned[index];
    if (!type || !cell.color || !scores[index])
      return { piece: null, confidence: 1 };

    const entries = scores[index] as TypeScore[];
    const chosen = entries.find((score) => score.type === type);
    const confidence =
      entries[0].type === type
        ? confidenceOf(entries)
        : Math.max(
            0,
            0.05 - (chosen ? chosen.distance - entries[0].distance : 0) * 0.01
          );

    return {
      piece: `${cell.color}${type.toUpperCase()}` as PieceCode,
      confidence,
    };
  });
};

export const detectWhiteAtBottom = (classified: ClassifiedCell[]): boolean => {
  const rows: Record<"w" | "b", number[]> = { w: [], b: [] };

  classified.forEach((cell, index) => {
    if (cell.piece)
      rows[cell.piece[0] as "w" | "b"].push(Math.floor(index / 8));
  });

  const mean = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!rows.w.length || !rows.b.length) return true;

  return mean(rows.w) >= mean(rows.b);
};

export const buildScanPosition = (
  classified: ClassifiedCell[],
  whiteAtBottom: boolean
): ScanPosition => {
  const pieces: EditablePosition["pieces"] = {};
  const confidences: ScanPosition["confidences"] = {};

  classified.forEach((cell, index) => {
    const row = Math.floor(index / 8);
    const column = index % 8;
    const file = whiteAtBottom ? column : 7 - column;
    const rank = whiteAtBottom ? 8 - row : row + 1;
    const square = `${FILES[file]}${rank}` as Square;

    if (cell.piece) {
      pieces[square] = cell.piece;
      confidences[square] = cell.confidence;
    }
  });

  const position = sanitizePosition({
    pieces,
    turn: "w",
    castling: { K: true, Q: true, k: true, q: true },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
  });

  return {
    pieces: position.pieces,
    confidences,
    whiteAtBottom,
    fen: positionToFen(position),
  };
};
