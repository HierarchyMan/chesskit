import type { GridRect, RawImage } from "./gridDetect";
import type { ShapeTemplate } from "./classify";
import type { ScanOutcome } from "./scanBoard";

export class ScanProcessor {
  private worker = new Worker(
    new URL("../../workers/scan.worker.ts", import.meta.url)
  );
  private serial = 0;
  disposed = false;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private templates?: ShapeTemplate[];
  private scanning = false;
  private queued?: {
    grid: GridRect;
    orientation?: boolean;
    resolve: (value: ScanOutcome | null) => void;
    reject: (error: Error) => void;
  };

  constructor() {
    this.worker.onmessage = ({ data }) => {
      const pending = this.pending.get(data.id);
      if (!pending) return;
      this.pending.delete(data.id);
      if (data.error) pending.reject(new Error(data.error));
      else pending.resolve(data.result);
    };
    this.worker.onerror = (event) =>
      this.dispose(new Error(event.message || "Recognition worker failed"));
    this.worker.onmessageerror = () =>
      this.dispose(new Error("Unable to read recognition result"));
  }
  private request<T>(
    task: string,
    input?: unknown,
    transfer: Transferable[] = []
  ): Promise<T> {
    if (this.disposed)
      return Promise.reject(new Error("Recognition worker is closed"));
    const id = ++this.serial;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
      try {
        this.worker.postMessage({ id, task, input }, transfer);
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  image(raw: RawImage) {
    // UI keeps dimensions and the original image URL; the worker owns pixels thereafter.
    return this.request<GridRect | undefined>("image", raw, [
      raw.data.buffer as ArrayBuffer,
    ]);
  }
  detect() {
    return this.request<GridRect | undefined>("detect");
  }
  scan(
    templates: ShapeTemplate[],
    grid: GridRect,
    orientation?: boolean
  ): Promise<ScanOutcome | null> {
    if (this.disposed)
      return Promise.reject(new Error("Recognition worker is closed"));
    if (this.templates !== templates) {
      this.templates = templates;
      this.worker.postMessage({ task: "templates", input: templates });
    }
    return new Promise((resolve, reject) => {
      this.queued?.resolve(null);
      this.queued = { grid, orientation, resolve, reject };
      void this.drain();
    });
  }
  private async drain() {
    if (this.scanning) return;
    this.scanning = true;
    try {
      while (this.queued) {
        const next = this.queued;
        this.queued = undefined;
        try {
          next.resolve(
            await this.request<ScanOutcome>("scan", {
              grid: next.grid,
              orientation: next.orientation,
            })
          );
        } catch (error) {
          next.reject(error as Error);
        }
      }
    } finally {
      this.scanning = false;
    }
  }
  dispose(error: Error = new DOMException("Cancelled", "AbortError")) {
    this.disposed = true;
    this.worker.terminate();
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
    this.queued?.resolve(null);
    this.queued = undefined;
  }
}
