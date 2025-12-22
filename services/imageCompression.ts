const MAX_BYTES = 3 * 1024 * 1024;

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('圖片轉換失敗'));
      resolve(blob);
    }, type, quality);
  });
};

export async function compressImageToMaxBytes(file: File, opts?: { maxBytes?: number; maxDimension?: number }): Promise<File> {
  const maxBytes = opts?.maxBytes ?? MAX_BYTES;
  const maxDimension = opts?.maxDimension ?? 2560;

  if (file.size <= maxBytes && file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法建立 Canvas');
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Prefer webp when available, fallback to jpeg
  const tryTypes = ['image/webp', 'image/jpeg'];
  let best: Blob | null = null;
  let bestType = 'image/jpeg';

  for (const type of tryTypes) {
    let quality = 0.9;
    for (let i = 0; i < 8; i += 1) {
      const blob = await canvasToBlob(canvas, type, quality);
      if (!best || blob.size < best.size) {
        best = blob;
        bestType = type;
      }
      if (blob.size <= maxBytes) {
        const ext = type === 'image/webp' ? 'webp' : 'jpg';
        return new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type });
      }
      quality *= 0.78;
    }
  }

  if (!best) throw new Error('圖片壓縮失敗');
  const ext = bestType === 'image/webp' ? 'webp' : 'jpg';
  return new File([best], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: bestType });
}

