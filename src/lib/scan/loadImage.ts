import { RawImage } from "./gridDetect";

const MAX_SIDE = 1600;

export interface LoadedImage {
  src: string;
  raw: RawImage;
}

export const loadRawImage = async (src: string): Promise<LoadedImage> => {
  const image = new Image();
  image.src = src;
  await image.decode();

  const scale = Math.min(
    1,
    MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is not available");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  return { src, raw: { data, width, height } };
};

export const readFileAsDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
