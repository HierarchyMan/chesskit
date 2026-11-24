import type { Square } from "chess.js";
import type { BoardArrow } from "@/lib/arrows/types";
import type {
  BoardEffect,
  HighlightTone,
  SquareHighlight,
} from "@/components/board/cues";
import { COACH_ARROW_COLORS } from "@/lib/coachCascade";
import type { PositionEval } from "@/types/eval";

export interface CoachPersona {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

export const COACH_PERSONAS: readonly CoachPersona[] = [
  {
    id: "David",
    name: "Coach David",
    role: "Warm & encouraging",
    avatar: "/coaches/David.png",
  },
  {
    id: "Anna",
    name: "Coach Anna",
    role: "Clear tactical guide",
    avatar: "/coaches/Anna.png",
  },
  {
    id: "Levy",
    name: "Coach Levy",
    role: "Energetic & sharp",
    avatar: "/coaches/Levy.png",
  },
  {
    id: "Hikaru",
    name: "GM Hikaru",
    role: "Fast calculation",
    avatar: "/coaches/Hikaru.png",
  },
  {
    id: "Magnus",
    name: "GM Magnus",
    role: "Positional mastery",
    avatar: "/coaches/Magnus.png",
  },
  {
    id: "Judit",
    name: "GM Judit",
    role: "Attacking instincts",
    avatar: "/coaches/Judit.png",
  },
  {
    id: "Vishy",
    name: "GM Vishy",
    role: "Calm & strategic",
    avatar: "/coaches/Vishy.png",
  },
  {
    id: "Danny",
    name: "Coach Danny",
    role: "Playful instructor",
    avatar: "/coaches/Danny.png",
  },
  {
    id: "Tania",
    name: "IM Tania",
    role: "Dynamic & instructive",
    avatar: "/coaches/Tania.png",
  },
  {
    id: "Nadia",
    name: "Coach Nadia",
    role: "Patient fundamentals",
    avatar: "/coaches/Nadia.png",
  },
  {
    id: "Mae",
    name: "Coach Mae",
    role: "Friendly & upbeat",
    avatar: "/coaches/Mae.png",
  },
  {
    id: "Ben",
    name: "Coach Ben",
    role: "Classic principles",
    avatar: "/coaches/Ben.png",
  },
];

export interface CoachChoice {
  action: string;
  title: string;
  parameters?: string;
}

export interface CoachDefinition {
  title: string;
  html: string;
}

export interface CoachMessage {
  id: number;
  /** May contain `<a href="coach://define?term=...">` or `<a href="coach://highlight?square=...">` links from Dr. Wolf JS. */
  html: string;
  plain: string;
  wiggleTick?: number;
}

export interface CoachEngineRequest {
  action: string;
  initialFen?: string;
  fen?: string;
  komodo_level?: number;
  komodo_depth?: number;
  komodoElo?: number;
  personality?: string;
  openingBook?: string;
  moves?: string[];
}

export interface CoachRawAction {
  action: string;
  id?: number;
  line?: string;
  plainLine?: string;
  from?: string;
  to?: string;
  promotion?: string | null;
  color?: string;
  type?: string;
  square?: string;
  location?: string;
  title?: string;
  text?: string;
  buttons?: Array<{
    action?: string;
    title?: string;
    text?: string;
    parameters?: string;
  }>;
}

export interface CoachEventResponse {
  play?: CoachRawAction[];
  playChessEngine?: CoachEngineRequest[];
  global?: CoachRawAction[];
}

export interface ParsedCoachActions {
  clearChat: boolean;
  messages: CoachMessage[];
  arrows: BoardArrow[];
  clearShapes: boolean;
  highlights: SquareHighlight[];
  effect?: BoardEffect;
  choices?: CoachChoice[];
  clearChoices: boolean;
  definition?: CoachDefinition;
  botMove?: { from: Square; to: Square; promotion?: string };
  undoRequested: boolean;
  wiggle: boolean;
  engineRequests: CoachEngineRequest[];
}

const isSquare = (s?: string): s is Square => !!s && /^[a-h][1-8]$/.test(s);

const mapArrowColor = (color?: string): string => {
  if (!color) return COACH_ARROW_COLORS.bright;
  const key = color.toLowerCase();
  if (key === "danger" || key === "red" || key === "r")
    return COACH_ARROW_COLORS.danger;
  if (key === "success" || key === "green" || key === "g")
    return COACH_ARROW_COLORS.success;
  if (key === "reminder" || key === "blue" || key === "u")
    return COACH_ARROW_COLORS.reminder;
  return COACH_ARROW_COLORS.bright;
};

const mapHighlightTone = (color?: string): HighlightTone => {
  if (!color) return "bright";
  const key = color.toLowerCase();
  if (key === "danger" || key === "red") return "danger";
  if (key === "success" || key === "green") return "success";
  if (key === "mentioned" || key === "blue") return "mentioned";
  if (key === "selected") return "selected";
  return "bright";
};

export function parseCoachActions(res: CoachEventResponse): ParsedCoachActions {
  const actions = [...(res.play ?? []), ...(res.global ?? [])];
  let clearChat = false;
  let clearChoices = false;
  const messages: CoachMessage[] = [];
  let arrows: BoardArrow[] = [];
  let highlights: SquareHighlight[] = [];
  let clearShapes = false;
  let effect: BoardEffect | undefined;
  let choices: CoachChoice[] | undefined;
  let definition: CoachDefinition | undefined;
  let botMove: { from: Square; to: Square; promotion?: string } | undefined;
  let undoRequested = false;
  let wiggle = false;

  for (const act of actions) {
    switch (act.action) {
      case "clear_chat": {
        clearChat = true;
        messages.length = 0;
        break;
      }
      case "clear_chat_and_choice": {
        clearChat = true;
        clearChoices = true;
        messages.length = 0;
        choices = [];
        break;
      }
      case "say": {
        if (act.line || act.plainLine) {
          messages.push({
            id: act.id ?? Date.now() + messages.length,
            html: act.line ?? act.plainLine ?? "",
            plain: act.plainLine ?? stripTags(act.line ?? ""),
          });
        }
        break;
      }
      case "wiggle_last_line": {
        wiggle = true;
        break;
      }
      case "clear_shapes": {
        clearShapes = true;
        arrows = [];
        highlights = [];
        break;
      }
      case "draw_shape": {
        if (isSquare(act.from) && isSquare(act.to)) {
          if (act.type === "only") {
            arrows = [];
          }
          arrows.push({
            from: act.from,
            to: act.to,
            kind: "content",
            color: mapArrowColor(act.color),
          });
        }
        break;
      }
      case "highlight_square": {
        if (isSquare(act.square)) {
          highlights.push({
            square: act.square,
            tone: mapHighlightTone(act.color),
          });
        }
        break;
      }
      case "special_effect": {
        if (
          isSquare(act.location) &&
          (act.type === "shake_king" ||
            act.type === "spin_king" ||
            act.type === "point_earned" ||
            act.type === "progress_made")
        ) {
          effect = {
            square: act.location,
            kind: act.type,
            key: Date.now(),
          };
        }
        break;
      }
      case "choice_request": {
        if (Array.isArray(act.buttons)) {
          choices = act.buttons
            .filter((b) => b && (b.title || b.text) && b.action)
            .map((b) => ({
              action: b.action!,
              title: (b.title ?? b.text)!,
              parameters: b.parameters,
            }));
        }
        break;
      }
      case "show_game_text":
      case "show_chessboard_dialog": {
        if (act.title || act.text) {
          definition = {
            title: act.title ?? "Chess Term",
            html: act.text ?? "",
          };
        }
        break;
      }
      case "move": {
        if (isSquare(act.from) && isSquare(act.to)) {
          botMove = {
            from: act.from,
            to: act.to,
            promotion: act.promotion ?? undefined,
          };
        }
        break;
      }
      case "undo_response": {
        undoRequested = true;
        break;
      }
    }
  }

  return {
    clearChat,
    messages,
    arrows,
    clearShapes,
    highlights,
    effect,
    choices,
    clearChoices,
    definition,
    botMove,
    undoRequested,
    wiggle,
    engineRequests: res.playChessEngine ?? [],
  };
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

/** Parses Dr. Wolf HTML containing `coach://define?term=...`, `coach://highlight?square=...`, and `<strong>...</strong>`. */
export type CoachTextSegment =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "square"; label: string; square: Square }
  | { kind: "term"; label: string; url: string };

export function parseLinkifiedText(html: string): CoachTextSegment[] {
  const segments: CoachTextSegment[] = [];
  const regex =
    /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>|<strong>([^<]+)<\/strong>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        kind: "text",
        text: stripTags(html.slice(lastIndex, match.index)),
      });
    }
    if (match[1] && match[2]) {
      const sqMatch = match[1].match(/highlight\?square=([a-h][1-8])/i);
      if (sqMatch) {
        segments.push({
          kind: "square",
          label: match[2],
          square: sqMatch[1].toLowerCase() as Square,
        });
      } else {
        segments.push({
          kind: "term",
          url: match[1],
          label: match[2],
        });
      }
    } else if (match[3]) {
      segments.push({
        kind: "strong",
        text: match[3],
      });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < html.length) {
    segments.push({
      kind: "text",
      text: stripTags(html.slice(lastIndex)),
    });
  }
  return segments;
}

export const BUILTIN_CHESS_GLOSSARY: Record<string, CoachDefinition> = {
  CENTER: {
    title: "Center",
    html: "The four central squares (d4, e4, d5, e5). Pieces placed in or attacking the center control more of the board and reach either flank faster.",
  },
  CENTER_PAWN: {
    title: "Center Pawn",
    html: "The d-pawn or e-pawn. Advancing a center pawn claims space and opens diagonals for your bishops and queen.",
  },
  DEVELOP: {
    title: "Development",
    html: "Moving knights and bishops off the back rank onto active squares early in the game so your rooks can connect and your king can castle.",
  },
  DEVELOPING: {
    title: "Development",
    html: "Moving knights and bishops off the back rank onto active squares early in the game so your rooks can connect and your king can castle.",
  },
  DEVELOPMENT: {
    title: "Development",
    html: "Moving knights and bishops off the back rank onto active squares early in the game so your rooks can connect and your king can castle.",
  },
  CASTLING: {
    title: "Castling",
    html: "A special move that moves the king two squares toward a rook while jumping the rook over — tucking your king into shelter and activating the rook.",
  },
  OPENING: {
    title: "Opening",
    html: "The first phase of the game focused on claiming the center, developing minor pieces quickly, and getting the king to safety.",
  },
  FORK: {
    title: "Fork",
    html: "A single piece attacking two or more enemy targets at once, making it hard for the opponent to save both.",
  },
  PIN: {
    title: "Pin",
    html: "Attacking an enemy piece that cannot move without exposing an even more valuable piece — or the king — behind it.",
  },
  SKEWER: {
    title: "Skewer",
    html: "The reverse of a pin: attacking a high-value piece so that when it moves out of danger, a piece behind it is captured.",
  },
  HANGING_PIECE: {
    title: "Hanging Piece",
    html: "An undefended (or under-defended) piece that the opponent can capture for free or win material on.",
  },
  BLUNDER: {
    title: "Blunder",
    html: "A serious mistake that loses significant material, allows a decisive tactic, or throws away a winning position.",
  },
  MAJOR_PIECES: {
    title: "Major Pieces",
    html: "Your rooks and queen — powerful long-range pieces that dominate open files and ranks.",
  },
};

/** Converts ChessKit's PositionEval (White-perspective cp) into Dr. Wolf's Komodo `engine_result` payload. */
export function toCoachEngineResult(
  fen: string,
  positionEval: PositionEval,
  req?: { komodo_level?: number; komodo_depth?: number }
) {
  const evals = positionEval.lines.slice(0, 3).map((line) => ({
    cp:
      line.mate !== undefined
        ? line.mate > 0
          ? 10000 - Math.abs(line.mate) * 10
          : -10000 + Math.abs(line.mate) * 10
        : (line.cp ?? 0),
    pv: line.pv,
  }));
  const topPv = evals[0]?.pv ?? [];
  return {
    what: "engine_result",
    gameScreen: "PLAY",
    fen,
    komodo_level: req?.komodo_level ?? 35,
    komodo_depth: req?.komodo_depth ?? 9,
    komodoElo: null,
    botName: null,
    detailedResults: JSON.stringify({
      positions: [
        {
          fen,
          evals,
          threat_evals: [],
          suggestedMove: topPv.length
            ? { eval: { pv: topPv, pvCutoff: Math.min(2, topPv.length - 1) } }
            : undefined,
        },
      ],
    }),
  };
}

/** Thin async RPC client around `/coach/coach-worker.js`. */
export class CoachWorkerClient {
  private worker: Worker | null = null;
  private reqId = 0;
  private pending = new Map<
    number,
    {
      resolve: (res: CoachEventResponse) => void;
      reject: (err: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  constructor() {
    if (typeof window !== "undefined" && typeof Worker !== "undefined") {
      this.worker = new Worker("/coach/coach-worker.js");
      this.worker.onmessage = (e: MessageEvent) => {
        const data = e.data as {
          id: number;
          ok: boolean;
          res?: CoachEventResponse;
          error?: string;
        };
        const entry = this.pending.get(data.id);
        if (!entry) return;
        this.pending.delete(data.id);
        clearTimeout(entry.timeout);
        if (data.ok && data.res) entry.resolve(data.res);
        else entry.reject(new Error(data.error ?? "Coach worker error"));
      };
      this.worker.onerror = (err) => {
        for (const [, entry] of this.pending) {
          clearTimeout(entry.timeout);
          entry.reject(new Error(err.message || "Coach worker crashed"));
        }
        this.pending.clear();
      };
    }
  }

  private call(payload: Record<string, unknown>): Promise<CoachEventResponse> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("Coach worker unavailable"));
    const id = ++this.reqId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Coach worker timed out"));
      }, 8000);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        worker.postMessage({ id, ...payload });
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  init(playerColor: "w" | "b") {
    return this.call({ type: "init", playerColor });
  }

  sendEvent(event: Record<string, unknown>) {
    return this.call({ type: "event", event });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timeout);
      entry.reject(new Error("Coach worker stopped"));
    }
    this.pending.clear();
  }
}
