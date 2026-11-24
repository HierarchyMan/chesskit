/**
 * Every keyboard and pointer shortcut the app answers to, grouped by where it
 * works. This is documentation the shortcuts dialog renders, so it must match
 * the real bindings (`useKeyboardShortcut` calls and the global listeners):
 * change one, change the other.
 *
 * Keys use `KeyboardEvent.key` names. Within one entry the keys are
 * alternatives (any one of them does the action). `+` joins a combination,
 * and `Mod` stands for Ctrl on Windows/Linux and Cmd on a Mac. Anything else
 * (a pointer gesture, a range such as `1-5`) is shown as written.
 */
export type ShortcutScope =
  | "Global"
  | "Play"
  | "Analysis"
  | "Puzzles"
  | "Openings"
  | "Vision"
  | "Arrows overlay";

export interface Shortcut {
  keys: string[];
  label: string;
}

export const SHORTCUT_SCOPES: readonly ShortcutScope[] = [
  "Global",
  "Play",
  "Analysis",
  "Puzzles",
  "Openings",
  "Vision",
  "Arrows overlay",
];

export const SHORTCUTS: Record<ShortcutScope, readonly Shortcut[]> = {
  Global: [
    { keys: ["?"], label: "Show this list of shortcuts" },
    { keys: ["Mod+K"], label: "Quick actions" },
    {
      keys: ["Mod+V"],
      label: "Paste a PGN, FEN, link or image to import it",
    },
  ],
  Play: [
    { keys: ["f"], label: "Flip the board" },
    { keys: ["h"], label: "Ask for a hint" },
    { keys: ["z"], label: "Take back your last move in a casual game" },
    { keys: ["ArrowLeft"], label: "Step back through your game's moves" },
    { keys: ["ArrowRight"], label: "Step forward through your game's moves" },
    { keys: ["Home"], label: "Jump to the first position" },
    { keys: ["End"], label: "Jump to the last position" },
    { keys: ["Escape"], label: "Cancel a selected piece or premove" },
    { keys: ["Right-click"], label: "Mark a square" },
    { keys: ["Drag"], label: "Premove: drag a piece on the opponent's turn" },
  ],
  Analysis: [
    { keys: ["ArrowLeft"], label: "Previous move" },
    { keys: ["ArrowRight"], label: "Next move" },
    { keys: ["ArrowUp", "Home"], label: "Back to the start position" },
    { keys: ["ArrowDown", "End"], label: "Final position of the line" },
    { keys: [" "], label: "Play the game forward, or pause" },
    { keys: ["Wheel over board"], label: "Step through moves" },
    { keys: ["f"], label: "Flip the board" },
    { keys: ["t"], label: "Show or hide the top moves" },
    { keys: ["Mod+Z"], label: "Undo a change on the Arrange board" },
    {
      keys: ["Mod+Y", "Mod+Shift+Z"],
      label: "Redo a change on the Arrange board",
    },
  ],
  Puzzles: [
    { keys: ["h"], label: "Show a hint while solving" },
    { keys: [" ", "ArrowRight"], label: "Continue to the next step" },
    { keys: ["n"], label: "Next puzzle, once solved" },
    { keys: ["ArrowLeft"], label: "Review: previous move" },
    { keys: ["Home"], label: "Review: back to the start" },
    { keys: ["End"], label: "Review: jump to the end" },
  ],
  Openings: [
    { keys: ["ArrowLeft"], label: "Learn: previous move" },
    { keys: ["ArrowRight"], label: "Learn: next move" },
    { keys: ["Home"], label: "Learn: back to the start" },
    { keys: ["End"], label: "Learn: jump to the end" },
    { keys: ["h"], label: "Drill: ask for a hint" },
  ],
  Vision: [
    { keys: ["a-h", "1-8"], label: "Name a square: type its file, then rank" },
    { keys: ["l", "d"], label: "Square colour: light or dark" },
    { keys: ["Backspace"], label: "Knight route: undo the last square" },
  ],
  "Arrows overlay": [
    { keys: ["a"], label: "Turn engine arrows on or off" },
    { keys: ["1-5"], label: "Number of arrows to show" },
    { keys: ["x"], label: "Show or hide threats" },
  ],
};

/**
 * The scope whose shortcuts belong to a route, or null when the page has none
 * of its own (the global shortcuts still work there).
 */
export function scopeForPath(pathname: string): ShortcutScope | null {
  const section = pathname.split("/")[1] ?? "";
  switch (section) {
    case "play":
      return "Play";
    case "analysis":
      return "Analysis";
    case "puzzles":
      return "Puzzles";
    case "openings":
      return "Openings";
    case "vision":
      return "Vision";
    default:
      return null;
  }
}

/** The scopes in display order: the current page's first, the rest as listed. */
export function orderedScopes(
  current: ShortcutScope | null
): readonly ShortcutScope[] {
  if (!current) return SHORTCUT_SCOPES;
  return [current, ...SHORTCUT_SCOPES.filter((scope) => scope !== current)];
}

const KEY_NAMES: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  " ": "Space",
  Escape: "Esc",
  Backspace: "⌫",
  Mod: "Ctrl/⌘",
};

/** How one key, or one part of a combination, reads on screen. */
export function formatKeyPart(part: string): string {
  const named = KEY_NAMES[part];
  if (named) return named;
  return part.length === 1 ? part.toUpperCase() : part;
}

/** The parts of a key or combination, ready to draw one key cap each. */
export function keyParts(key: string): string[] {
  if (key === "+") return ["+"];
  return key.split("+").map(formatKeyPart);
}

/** A key or combination as one string, such as "Ctrl/⌘ + K" or "←". */
export function formatKey(key: string): string {
  return keyParts(key).join(" + ");
}
