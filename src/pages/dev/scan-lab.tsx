import { PIECE_SETS } from "@/constants";
import { detectBoardGrid } from "@/lib/scan/gridDetect";
import { scanBoard } from "@/lib/scan/scanBoard";
import { loadShapeTemplates, renderBoardCanvas } from "@/lib/scan/templates";
import { Chess } from "chess.js";
import { useState } from "react";

const THEMES = [
  ["#f0d9b5", "#b58863"],
  ["#eeeed2", "#769656"],
  ["#dee3e6", "#8ca2ad"],
  ["#ebecd0", "#739552"],
  ["#d9d9d9", "#7a8794"],
];

const TRIALS_PER_SET = 4;

const randomPosition = (plies: number, random: () => number): string => {
  const game = new Chess();
  for (let i = 0; i < plies && !game.isGameOver(); i++) {
    const moves = game.moves();
    game.move(moves[Math.floor(random() * moves.length)]);
  }
  return game.fen();
};

const createRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const expand = (placement: string) =>
  placement
    .split("/")
    .map((row) => row.replace(/\d/g, (digit) => ".".repeat(Number(digit))))
    .join("");

interface Trial {
  set: string;
  imageData: ImageData;
  truth: string;
  offset: [number, number];
}

const CONFIGS = [
  { name: "unseen style", excludeOwn: true },
  { name: "known style", excludeOwn: false },
];

export default function ScanLab() {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  if (process.env.NODE_ENV === "production") return null;

  const run = async () => {
    setRunning(true);
    const lines: string[] = [];
    const push = (line: string) => {
      lines.push(line);
      setLog([...lines]);
    };

    const all = await loadShapeTemplates();
    push(`templates: ${all.length}`);

    const random = createRandom(42);
    const trials: Trial[] = [];

    for (const set of PIECE_SETS) {
      for (let trial = 0; trial < TRIALS_PER_SET; trial++) {
        const fen = randomPosition(20 + Math.floor(random() * 50), random);
        const [light, dark] = THEMES[Math.floor(random() * THEMES.length)];
        const cell = 48 + Math.floor(random() * 30);
        const board = await renderBoardCanvas({
          fen,
          set,
          cell,
          light,
          dark,
          coordinates: random() < 0.5,
          whiteAtBottom: random() < 0.8,
        });

        const page = document.createElement("canvas");
        page.width = board.width + 360;
        page.height = board.height + 160;
        const context = page.getContext("2d") as CanvasRenderingContext2D;
        context.fillStyle = "#2b2d33";
        context.fillRect(0, 0, page.width, page.height);
        context.fillStyle = "#555a66";
        context.fillRect(0, 0, 120, page.height);
        context.fillStyle = "#c9ccd3";
        for (let i = 0; i < 12; i++) {
          context.fillRect(
            board.width + 140,
            20 + i * 24,
            120 + (i % 3) * 30,
            10
          );
        }
        const offsetX = 150 + Math.floor(random() * 40);
        const offsetY = 40 + Math.floor(random() * 40);
        context.drawImage(board, offsetX, offsetY);

        const jpeg = await new Promise<HTMLImageElement>((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.src = page.toDataURL("image/jpeg", 0.8);
        });
        const flat = document.createElement("canvas");
        flat.width = jpeg.width;
        flat.height = jpeg.height;
        const flatContext = flat.getContext("2d", {
          willReadFrequently: true,
        }) as CanvasRenderingContext2D;
        flatContext.drawImage(jpeg, 0, 0);

        trials.push({
          set,
          imageData: flatContext.getImageData(0, 0, flat.width, flat.height),
          truth: fen.split(" ")[0],
          offset: [offsetX, offsetY],
        });
      }
    }

    push(`rendered ${trials.length} boards`);

    const grids = trials.map((trial) => detectBoardGrid(trial.imageData));
    const gridMisses = trials.filter((trial, index) => {
      const grid = grids[index];
      return (
        !grid ||
        Math.abs(grid.x - trial.offset[0]) > 3 ||
        Math.abs(grid.y - trial.offset[1]) > 3
      );
    }).length;
    push(`grid misses: ${gridMisses}/${trials.length}`);
    trials.forEach((trial, index) => {
      const grid = grids[index];
      if (
        !grid ||
        Math.abs(grid.x - trial.offset[0]) > 3 ||
        Math.abs(grid.y - trial.offset[1]) > 3
      ) {
        push(
          `  grid miss ${trial.set}: wanted ${trial.offset.join(",")} got ${grid ? [grid.x, grid.y, grid.size].join(",") : "none"}`
        );
      }
    });

    for (const config of CONFIGS) {
      const kinds: Record<string, number> = {};

      let squares = 0;
      let correct = 0;
      let exact = 0;
      const perSet: Record<string, number> = {};

      trials.forEach((trial, index) => {
        const grid = grids[index];
        if (!grid) {
          squares += 64;
          return;
        }

        const templates = config.excludeOwn
          ? all.filter((template) => template.set !== trial.set)
          : all;
        const outcome = scanBoard(trial.imageData, templates, grid);
        const got = outcome.position.fen.split(" ")[0];
        const a = expand(trial.truth);
        const b = expand(got);

        let ok = 0;
        for (let i = 0; i < 64; i++) {
          if (a[i] === b[i]) ok++;
          else {
            const kind =
              a[i] === "."
                ? "phantom"
                : b[i] === "."
                  ? "missed"
                  : a[i].toLowerCase() === b[i].toLowerCase()
                    ? "color " + a[i] + "->" + b[i]
                    : "type " + a[i] + "->" + b[i];
            kinds[kind] = (kinds[kind] ?? 0) + 1;
          }
        }

        squares += 64;
        correct += ok;
        if (got === trial.truth) exact++;
        perSet[trial.set] = (perSet[trial.set] ?? 0) + ok;
      });

      const worst = Object.entries(perSet)
        .sort((x, y) => x[1] - y[1])
        .slice(0, 5)
        .map(
          ([set, ok]) =>
            `${set}:${((100 * ok) / (64 * TRIALS_PER_SET)).toFixed(0)}%`
        )
        .join(" ");

      const top = Object.entries(kinds)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 12)
        .map(([kind, count]) => `${kind}:${count}`)
        .join(" ");
      push(`  errors: ${top}`);

      push(
        `CONFIG ${JSON.stringify(config)} -> squares ${((100 * correct) / squares).toFixed(2)}% exact ${exact}/${trials.length} worst ${worst}`
      );
    }

    push("DONE");
    setRunning(false);
  };

  return (
    <div style={{ padding: 16, fontFamily: "monospace" }}>
      <h2>Scan lab (development only)</h2>
      <button onClick={run} disabled={running} id="run-lab">
        {running ? "Running..." : "Compare classifier settings"}
      </button>
      <pre id="lab-log" style={{ whiteSpace: "pre-wrap" }}>
        {log.join("\n")}
      </pre>
    </div>
  );
}
