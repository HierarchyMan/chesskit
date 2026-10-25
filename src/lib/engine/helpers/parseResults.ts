import { formatUciPv } from "@/lib/chess";
import { LineEval, PositionEval } from "@/types/eval";

export class EvaluationParser {
  private consumed = 0;
  private bestMove?: string;
  private lines: Record<string, LineEval> = {};
  constructor(private fen: string) {}
  update(results: string[]): PositionEval {
    for (; this.consumed < results.length; this.consumed++) {
      const result = results[this.consumed];
      const tokens = result.trim().split(/\s+/);
      const pvIndex = tokens.indexOf("pv");
      // Fields come in any order, but nothing after "pv" is a field.
      const fields = pvIndex < 0 ? tokens : tokens.slice(0, pvIndex);
      const property = (name: string) => {
        const i = fields.indexOf(name);
        return i < 0 ? undefined : fields[i + 1];
      };
      if (result.startsWith("bestmove"))
        this.bestMove = tokens[1] ?? this.bestMove;
      if (!result.startsWith("info")) continue;
      // Engines without MultiPV (tomitankChess) print no "multipv": it is line 1.
      const multiPv = property("multipv") ?? "1",
        depth = property("depth");
      if (pvIndex < 0 || pvIndex + 1 >= tokens.length || !depth) continue;
      const previous = this.lines[multiPv];
      if (previous && Number(depth) < previous.depth) continue;
      // A bound is only a guess from an unfinished search; keep the exact score of that depth.
      const bound =
        fields.includes("lowerbound") || fields.includes("upperbound");
      if (bound && previous && Number(depth) === previous.depth) continue;
      const cp = property("cp"),
        mate = property("mate");
      this.lines[multiPv] = {
        pv: formatUciPv(this.fen, tokens.slice(pvIndex + 1)),
        cp: cp ? parseInt(cp) : undefined,
        mate: mate ? parseInt(mate) : undefined,
        depth: parseInt(depth),
        multiPv: parseInt(multiPv),
      };
    }
    const whiteToPlay = this.fen.split(" ")[1] === "w";
    const lines = Object.values(this.lines).sort(sortLines);
    const result: PositionEval = {
      lines: whiteToPlay
        ? lines
        : lines.map((line) => ({
            ...line,
            cp: line.cp ? -line.cp : line.cp,
            mate: line.mate ? -line.mate : line.mate,
          })),
    };
    if (this.bestMove !== undefined) result.bestMove = this.bestMove;
    return result;
  }
}
export const parseEvaluationResults = (
  results: string[],
  fen: string
): PositionEval => new EvaluationParser(fen).update(results);

export const sortLines = (a: LineEval, b: LineEval): number => {
  if (a.mate !== undefined && b.mate !== undefined) {
    if (a.mate > 0 && b.mate < 0) return -1;
    if (a.mate < 0 && b.mate > 0) return 1;
    return a.mate - b.mate;
  }

  if (a.mate !== undefined) {
    return -a.mate;
  }

  if (b.mate !== undefined) {
    return b.mate;
  }

  return (b.cp ?? 0) - (a.cp ?? 0);
};

export const getResultProperty = (
  result: string,
  property: string
): string | undefined => {
  const splitResult = result.split(" ");
  const propertyIndex = splitResult.indexOf(property);

  if (propertyIndex === -1 || propertyIndex + 1 >= splitResult.length) {
    return undefined;
  }

  return splitResult[propertyIndex + 1];
};
