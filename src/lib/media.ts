function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось прочитать изображение"));
    image.src = src;
  });
}

export async function stylizePhoto(src: string) {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return src;
  }

  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  ctx.globalCompositeOperation = "soft-light";
  const wash = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  wash.addColorStop(0, "rgba(196, 165, 116, 0.42)");
  wash.addColorStop(0.45, "rgba(232, 213, 196, 0.18)");
  wash.addColorStop(1, "rgba(79, 93, 74, 0.28)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalCompositeOperation = "multiply";
  const vignette = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    Math.min(canvas.width, canvas.height) * 0.28,
    canvas.width / 2,
    canvas.height / 2,
    Math.max(canvas.width, canvas.height) * 0.72,
  );
  vignette.addColorStop(0, "rgba(255,255,255,0)");
  vignette.addColorStop(1, "rgba(28, 23, 20, 0.28)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalCompositeOperation = "source-over";
  return canvas.toDataURL("image/jpeg", 0.88);
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
