import { useEffect, useRef } from "react";

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
};

export const useKeyboardShortcut = (
  keys: string | string[],
  handler: (event: KeyboardEvent) => void,
  enabled = true
) => {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  const keyList = Array.isArray(keys) ? keys.join("|") : keys;

  useEffect(() => {
    if (!enabled) return;

    const accepted = keyList.split("|");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (!accepted.includes(event.key)) return;

      handlerRef.current(event);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [keyList, enabled]);
};
