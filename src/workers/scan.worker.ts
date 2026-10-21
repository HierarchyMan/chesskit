import { detectBoardGrid, RawImage } from "@/lib/scan/gridDetect";
import { scanBoard } from "@/lib/scan/scanBoard";
import type { ShapeTemplate } from "@/lib/scan/classify";
import type { GridRect } from "@/lib/scan/gridDetect";

let image: RawImage;
let templates: ShapeTemplate[];
self.onmessage = (
  event: MessageEvent<{
    id: number;
    task: string;
    input:
      | RawImage
      | ShapeTemplate[]
      | { grid: GridRect; orientation?: boolean };
  }>
) => {
  const { id, task, input } = event.data;
  try {
    if (task === "templates") {
      templates = input as ShapeTemplate[];
      return;
    }
    if (task === "image") image = input as RawImage;
    const request = input as { grid: GridRect; orientation?: boolean };
    const result =
      task === "scan"
        ? scanBoard(image, templates, request.grid, request.orientation)
        : detectBoardGrid(image);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : "Recognition failed",
    });
  }
};
