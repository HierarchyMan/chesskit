import { EngineId } from "@/types/enums";
import { EngineModel, getEngineModel } from "./models";

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

export const isModelSupported = (model: EngineModel): boolean => {
  if (model.source === "bridge") return typeof WebSocket !== "undefined";
  return !model.needsWasm || isWasmSupported();
};

export const isEngineSupported = (name: EngineId): boolean =>
  isModelSupported(getEngineModel(name));
