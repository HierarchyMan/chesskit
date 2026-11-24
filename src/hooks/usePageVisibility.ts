import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

const isVisible = () => document.visibilityState !== "hidden";
const serverVisible = () => true;

export function usePageVisibility() {
  return useSyncExternalStore(subscribe, isVisible, serverVisible);
}
