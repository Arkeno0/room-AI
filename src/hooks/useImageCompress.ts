"use client";

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.85;
const MAX_BYTES = 1.5 * 1024 * 1024;

export class ImageCompressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageCompressError";
  }
}

export type CompressedImage = {
  blob: Blob;
  dataUrl: string;
  base64: string;
  mimeType: "image/jpeg";
};

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageCompressError("Не удалось прочитать изображение."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new ImageCompressError("Не удалось сжать фото."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new ImageCompressError("Не удалось прочитать сжатое фото."));
    reader.readAsDataURL(blob);
  });
}

export async function compressRoomPhoto(file: File): Promise<CompressedImage> {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    throw new ImageCompressError("Нужен JPG, PNG или WEBP.");
  }

  const image = await fileToImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new ImageCompressError("Canvas недоступен в этом браузере.");
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = JPEG_QUALITY;
  let blob = await canvasToBlob(canvas, quality);
  if (blob.size > MAX_BYTES) {
    quality = 0.7;
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > MAX_BYTES) {
    quality = 0.55;
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > MAX_BYTES) {
    throw new ImageCompressError("После сжатия файл всё ещё больше 1.5 МБ. Выберите кадр поменьше.");
  }

  const dataUrl = await blobToDataUrl(blob);
  const comma = dataUrl.indexOf(",");

  return {
    blob,
    dataUrl,
    base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
    mimeType: "image/jpeg",
  };
}

export function useImageCompress() {
  return { compressRoomPhoto };
}
