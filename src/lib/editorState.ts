import { atom } from "jotai";
import {
  EditablePosition,
  parseFenLoose,
  positionFromFen,
  positionToFen,
  sanitizePosition,
  START_FEN,
} from "./editorPosition";

export const createEditorAtoms = () => {
  const value = atom(positionFromFen(START_FEN));
  const input = atom<string | null>(null);
  type Snapshot = { position: EditablePosition; draft: string | null };
  const history = atom<{
    past: Snapshot[];
    future: Snapshot[];
  }>({ past: [], future: [] });
  const position = atom(
    (get) => get(value),
    (
      get,
      set,
      update:
        | EditablePosition
        | ((previous: EditablePosition) => EditablePosition)
    ) => {
      const previous = get(value);
      const previousDraft = get(input);
      const next = sanitizePosition(
        typeof update === "function" ? update(previous) : update
      );
      set(input, null);
      if (
        positionToFen(previous) === positionToFen(next) &&
        previousDraft === null
      )
        return;
      set(history, {
        past: [
          ...get(history).past.slice(-199),
          { position: previous, draft: previousDraft },
        ],
        future: [],
      });
      set(value, next);
    }
  );
  const draft = atom(
    (get) => get(input),
    (_get, set, text: string | null) => {
      if (text !== null) {
        const parsed = parseFenLoose(text);
        if (parsed) set(position, parsed);
      }
      set(input, text);
    }
  );
  const reset = atom(
    null,
    (_get, set, next: { position: EditablePosition; draft?: string }) => {
      set(value, next.position);
      set(input, next.draft ?? null);
      set(history, { past: [], future: [] });
    }
  );
  const undo = atom(null, (get, set) => {
    const { past, future } = get(history);
    if (!past.length) return;
    const previous = { position: get(value), draft: get(input) };
    set(value, past[past.length - 1].position);
    set(input, past[past.length - 1].draft);
    set(history, { past: past.slice(0, -1), future: [previous, ...future] });
  });
  const redo = atom(null, (get, set) => {
    const { past, future } = get(history);
    if (!future.length) return;
    const previous = { position: get(value), draft: get(input) };
    set(value, future[0].position);
    set(input, future[0].draft);
    set(history, { past: [...past, previous], future: future.slice(1) });
  });
  return { position, draft, reset, history, undo, redo };
};
