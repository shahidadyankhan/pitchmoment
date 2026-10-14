/**
 * Browser-side photo prep: shrink big phone photos before upload (faster, and
 * keeps the data URI within provider limits) and make a tiny gallery thumbnail.
 */

async function decode(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error("Couldn't read that image. Try a JPG or PNG photo.");
  } finally {
    // decode() has finished with the URL either way
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export interface PreparedPhoto {
  file: File;
  previewUrl: string;
  thumbnail: string;
  width: number;
  height: number;
}

export async function preparePhoto(input: File, maxSide = 1280): Promise<PreparedPhoto> {
  if (!input.type.startsWith("image/")) throw new Error("That file isn't an image.");
  const img = await decode(input);
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if (w0 < 256 || h0 < 256) throw new Error("That photo is too small — use one at least 256px wide.");

  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process the image.");
  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image encode failed"))), "image/jpeg", 0.9),
  );
  const file = new File([blob], "photo.jpg", { type: "image/jpeg" });

  // Square, centre-cropped thumbnail for the gallery
  const t = document.createElement("canvas");
  t.width = t.height = 160;
  const side = Math.min(w0, h0);
  t.getContext("2d")?.drawImage(img, (w0 - side) / 2, (h0 - side) / 3, side, side, 0, 0, 160, 160);
  const thumbnail = t.toDataURL("image/jpeg", 0.72);

  return { file, previewUrl: URL.createObjectURL(blob), thumbnail, width: w, height: h };
}
