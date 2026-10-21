import { EngineName } from "@/types/enums";
export const isWasmSupported = () =>
  typeof WebAssembly === "object" &&
  WebAssembly.validate(
    Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
  );

export const isIosDevice = () =>
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod/i.test(navigator.userAgent);

export const isMobileDevice = () =>
  isIosDevice() ||
  (typeof navigator !== "undefined" &&
    /Android|Opera Mini/i.test(navigator.userAgent));

export const isEngineSupported = (name: EngineName): boolean =>
  name === EngineName.Stockfish11 ||
  (name === EngineName.Reckless
    ? typeof WebSocket !== "undefined"
    : isWasmSupported());
