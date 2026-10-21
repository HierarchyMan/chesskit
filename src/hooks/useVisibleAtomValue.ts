import { atom, useAtomValue, type Atom } from "jotai";
import { useMemo, useRef } from "react";
// Keep the mounted presentation/scroll state, but unsubscribe while CSS hides its tab.
export function useVisibleAtomValue<T>(source: Atom<T>, visible: boolean) {
  const previous = useRef<T | undefined>(undefined);
  const selected = useMemo(
    () =>
      atom((get) =>
        visible || previous.current === undefined
          ? get(source)
          : previous.current
      ),
    [source, visible]
  );
  const value = useAtomValue(selected);
  if (visible || previous.current === undefined) previous.current = value;
  return value;
}
