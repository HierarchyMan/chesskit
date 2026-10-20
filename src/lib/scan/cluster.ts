import { PieceSymbol } from "chess.js";
import { ShapeDescriptor } from "./cell";

export interface ClusterInput {
  index: number;
  color: "w" | "b";
  descriptor: ShapeDescriptor;
  scores: { type: PieceSymbol; distance: number }[];
}

export interface ClusterAssignment {
  type: PieceSymbol;
  confidence: number;
}

interface Cluster {
  members: ClusterInput[];
  distances: Record<PieceSymbol, number>;
  backRankMembers: number;
}

const TYPES: PieceSymbol[] = ["p", "n", "b", "r", "q", "k"];

const LIMITS: Record<PieceSymbol, number> = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
  k: 1,
};
const EXCESS_PENALTY: Record<PieceSymbol, number> = {
  p: 150,
  n: 80,
  b: 80,
  r: 80,
  q: 60,
  k: 100_000,
};
const MISSING_KING_PENALTY = 100_000;
const PAWN_ON_BACK_RANK_PENALTY = 200;

const buildClusters = (
  inputs: ClusterInput[],
  distance: (a: ShapeDescriptor, b: ShapeDescriptor) => number,
  threshold: number
): Cluster[] => {
  const parent = inputs.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));

  for (let i = 0; i < inputs.length; i++) {
    for (let j = i + 1; j < inputs.length; j++) {
      if (distance(inputs[i].descriptor, inputs[j].descriptor) < threshold) {
        parent[find(i)] = find(j);
      }
    }
  }

  const groups = new Map<number, ClusterInput[]>();
  inputs.forEach((input, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), input]);
  });

  return [...groups.values()].map((members) => {
    const distances = {} as Record<PieceSymbol, number>;

    for (const type of TYPES) {
      distances[type] = members.reduce(
        (sum, member) =>
          sum +
          (member.scores.find((score) => score.type === type)?.distance ??
            1000),
        0
      );
    }

    return {
      members,
      distances,
      backRankMembers: members.filter((member) => {
        const row = Math.floor(member.index / 8);
        return row === 0 || row === 7;
      }).length,
    };
  });
};

const solve = (clusters: Cluster[]): PieceSymbol[] => {
  const minimumRest = new Array(clusters.length + 1).fill(0);
  for (let i = clusters.length - 1; i >= 0; i--) {
    minimumRest[i] =
      minimumRest[i + 1] +
      Math.min(...TYPES.map((type) => clusters[i].distances[type]));
  }

  let best = Infinity;
  let bestAssignment: PieceSymbol[] = [];
  const counts: Record<PieceSymbol, number> = {
    p: 0,
    n: 0,
    b: 0,
    r: 0,
    q: 0,
    k: 0,
  };
  const current: PieceSymbol[] = [];

  const search = (index: number, cost: number) => {
    if (cost + minimumRest[index] >= best) return;

    if (index === clusters.length) {
      const total = cost + (counts.k === 0 ? MISSING_KING_PENALTY : 0);
      if (total < best) {
        best = total;
        bestAssignment = [...current];
      }
      return;
    }

    const cluster = clusters[index];
    const size = cluster.members.length;
    const ordered = [...TYPES].sort(
      (a, b) => cluster.distances[a] - cluster.distances[b]
    );

    for (const type of ordered) {
      const before = counts[type];
      const after = before + size;
      let extra = 0;

      if (after > LIMITS[type]) {
        extra +=
          (after - Math.max(LIMITS[type], before)) * EXCESS_PENALTY[type];
      }
      if (type === "p")
        extra += cluster.backRankMembers * PAWN_ON_BACK_RANK_PENALTY;

      counts[type] = after;
      current[index] = type;
      search(index + 1, cost + cluster.distances[type] + extra);
      counts[type] = before;
    }
  };

  search(0, 0);
  return bestAssignment;
};

export const assignByClusters = (
  inputs: ClusterInput[],
  distance: (a: ShapeDescriptor, b: ShapeDescriptor) => number,
  options: { clusterDistance: number; maxClusters: number }
): Map<number, ClusterAssignment> | undefined => {
  const result = new Map<number, ClusterAssignment>();

  for (const color of ["w", "b"] as const) {
    const ofColor = inputs.filter((input) => input.color === color);
    if (!ofColor.length) continue;

    const clusters = buildClusters(ofColor, distance, options.clusterDistance);
    if (clusters.length > options.maxClusters) return undefined;

    const assignment = solve(clusters);

    clusters.forEach((cluster, i) => {
      const type = assignment[i];
      const size = cluster.members.length;
      const chosen = cluster.distances[type] / size;
      const alternative = Math.min(
        ...TYPES.filter((other) => other !== type).map(
          (other) => cluster.distances[other] / size
        )
      );
      const confidence = Math.max(
        0,
        Math.min(1, (alternative - chosen) / (alternative + 1e-6))
      );

      for (const member of cluster.members) {
        result.set(member.index, { type, confidence });
      }
    });
  }

  return result;
};
