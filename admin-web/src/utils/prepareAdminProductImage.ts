const MOBILE_UA_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export function isLikelyMobileUserAgent(): boolean {
  return MOBILE_UA_RE.test(navigator.userAgent || '');
}

export function isHeicLikeFile(file: File): boolean {
  const n = String(file.name || '').toLowerCase();
  const t = String(file.type || '').toLowerCase();
  if (n.endsWith('.heic') || n.endsWith('.heif')) return true;
  if (t.includes('heic') || t.includes('heif')) return true;
  return false;
}

/** 모바일·HEIC·대용량 원본은 JPEG 로 줄여 업로드 */
export function shouldPrecompressProductImage(file: File): boolean {
  if (isHeicLikeFile(file)) return true;
  if (isLikelyMobileUserAgent()) return true;
  if (file.size > 1.2 * 1024 * 1024) return true;
  return false;
}

function loadImageFromObjectUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('图片无法解码，请导出为 JPEG/PNG 或在 Safari 中重试(HEIC)'));
    img.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('压缩失败'))),
      'image/jpeg',
      quality,
    );
  });
}

export function readBlobAsDataUrlBase64(blob: Blob): Promise<{ mime: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = String(r.result || '');
      const m = res.match(/^data:([^;]+);base64,(.+)$/);
      if (m) resolve({ mime: m[1], base64: m[2] });
      else reject(new Error('无法读取图片'));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * 관리자 상품 이미지: 모바일/HEIC/대용량 시 캔버스로 JPEG 재인코딩
 */
export async function prepareAdminProductImage(file: File): Promise<{ blob: Blob; fileName: string; mimeType: string }> {
  if (!shouldPrecompressProductImage(file)) {
    const mt =
      file.type && file.type.startsWith('image/')
        ? file.type
        : isHeicLikeFile(file)
          ? 'image/heic'
          : 'image/jpeg';
    return {
      blob: file,
      fileName: file.name || 'image.jpg',
      mimeType: mt,
    };
  }

  const maxLongEdge = isLikelyMobileUserAgent() ? 1920 : 2560;
  const targetBytes = 2.5 * 1024 * 1024;
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageFromObjectUrl(objectUrl);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) throw new Error('图片尺寸无效');

    const scale0 = Math.min(1, maxLongEdge / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale0));
    h = Math.max(1, Math.round(h * scale0));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 不可用');
    ctx.drawImage(img, 0, 0, w, h);

    let q = isLikelyMobileUserAgent() ? 0.78 : 0.84;
    let blob = await canvasToJpegBlob(canvas, q);
    while (blob.size > targetBytes && q > 0.48) {
      q -= 0.07;
      blob = await canvasToJpegBlob(canvas, q);
    }

    if (blob.size > targetBytes && Math.max(w, h) > 1280) {
      const s = Math.min(1, 1280 / Math.max(w, h));
      const w2 = Math.max(1, Math.round(w * s));
      const h2 = Math.max(1, Math.round(h * s));
      canvas.width = w2;
      canvas.height = h2;
      ctx.drawImage(img, 0, 0, w2, h2);
      q = 0.7;
      blob = await canvasToJpegBlob(canvas, q);
    }

    const base = String(file.name || 'image').replace(/\.[^/.]+$/i, '') || 'image';
    return { blob, fileName: `${base}.jpg`, mimeType: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
