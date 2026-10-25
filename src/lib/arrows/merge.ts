import { ARROW_PRIORITY, BoardArrow } from "./types";

/**
 * Two arrows between the same squares would sit exactly on top of each other,
 * so the one that matters more is drawn. The ply numbers of the arrows that
 * lose are not lost: they are carried by the winner, so a line that comes back
 * to a square still shows every move it makes there. The first of two equally
 * important arrows wins. The result is ordered so that the arrows that matter
 * most are drawn last.
 */
export const mergeArrows = (arrows: readonly BoardArrow[]): BoardArrow[] => {
  const winners = new Map<string, BoardArrow>();
  const labels = new Map<string, string[]>();
  const roles = new Map<string, NonNullable<BoardArrow["roles"]>[number][]>();

  for (const arrow of arrows) {
    const key = `${arrow.from}-${arrow.to}`;
    const meanings = roles.get(key) ?? [];
    for (const role of [
      { kind: arrow.kind, side: arrow.side, rank: arrow.rank },
      ...(arrow.roles ?? []),
    ]) {
      if (
        !meanings.some(
          (meaning) =>
            meaning.kind === role.kind &&
            meaning.side === role.side &&
            meaning.rank === role.rank
        )
      )
        meanings.push(role);
    }
    roles.set(key, meanings);
    for (const label of [arrow.label, ...(arrow.alsoLabels ?? [])]) {
      if (label === undefined) continue;
      const list = labels.get(key) ?? [];
      if (!list.includes(label)) list.push(label);
      labels.set(key, list);
    }

    const current = winners.get(key);
    if (!current || ARROW_PRIORITY[arrow.kind] > ARROW_PRIORITY[current.kind]) {
      winners.set(key, arrow);
    }
  }

  return [...winners.entries()]
    .map(([key, winner]) => {
      const all = labels.get(key) ?? [];
      const [label, ...alsoLabels] = all;
      const meanings = roles.get(key)!;
      if (
        label === winner.label &&
        alsoLabels.length === 0 &&
        meanings.length === 1
      )
        return winner;
      return {
        ...winner,
        label,
        alsoLabels,
        ...(meanings.length > 1 ? { roles: meanings } : {}),
      };
    })
    .sort((a, b) => ARROW_PRIORITY[a.kind] - ARROW_PRIORITY[b.kind]);
};
