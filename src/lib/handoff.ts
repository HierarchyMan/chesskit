export type Handoff =
  | { kind: "pgn"; pgn: string; orientation?: "white" | "black" }
  | { kind: "fen"; fen: string }
  | { kind: "image"; dataUrl: string }
  | { kind: "challenge"; id: string };

export const HANDOFF_EVENT = "chesskit:handoff";

const STORAGE_KEY = "chesskit-handoff";

export const setHandoff = (handoff: Handoff, targetPath?: string): void => {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...handoff, targetPath })
    );
  } catch (error) {
    console.error("Unable to store handoff", error);
    return;
  }

  window.dispatchEvent(new Event(HANDOFF_EVENT));
};

export const takeHandoff = <K extends Handoff["kind"]>(
  ...kinds: K[]
): Extract<Handoff, { kind: K }> | undefined => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;

    const handoff = JSON.parse(raw) as Handoff & { targetPath?: string };
    if (handoff.targetPath && handoff.targetPath !== window.location.pathname)
      return undefined;
    if (!(kinds as string[]).includes(handoff.kind)) return undefined;

    window.sessionStorage.removeItem(STORAGE_KEY);
    return handoff as Extract<Handoff, { kind: K }>;
  } catch {
    return undefined;
  }
};
