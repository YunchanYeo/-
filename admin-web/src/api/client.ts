const rawBase = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

/** API 根路径（无末尾 /）；开发环境留空则走 Vite 同源代理 */
export function getApiBase(): string {
  return rawBase.replace(/\/$/, '');
}

export function resolveUploadUrl(image: string | null | undefined): string {
  if (!image) return '';
  if (/^https?:\/\//i.test(image)) return image;
  const base = getApiBase();
  const path = image.startsWith('/') ? image : `/${image}`;
  if (!base) return path;
  return `${base}${path}`;
}

/** 客服消息里的媒体 URL：开发环境下把 localhost 绝对地址换成同源路径，便于 Vite 代理 */
export function normalizeSupportMediaUrl(url: string | null | undefined): string {
  const s = String(url || '').trim();
  if (!s) return '';
  const base = getApiBase().replace(/\/+$/, '');
  if (s.startsWith('/')) {
    return base ? `${base}${s}` : s;
  }
  try {
    const u = new URL(s);
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') {
      const pathOnly = `${u.pathname}${u.search}`;
      return base ? `${base}${pathOnly}` : pathOnly;
    }
  } catch {
    /* 非绝对 URL */
  }
  if (!/^https?:\/\//i.test(s)) {
    const stripped = s.replace(/^\/+/, '');
    return base ? `${base}/${stripped}` : `/${stripped}`;
  }
  return s;
}

type JsonOpts = {
  method?: string;
  body?: unknown;
  token?: string | null;
  /** 大图/语音上传等 */
  timeoutMs?: number;
};

export async function adminJson<T>(path: string, opts: JsonOpts = {}): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (opts.token) headers['x-admin-token'] = opts.token;

  const signal =
    opts.timeoutMs != null && opts.timeoutMs > 0 ? AbortSignal.timeout(opts.timeoutMs) : undefined;

  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal,
  });

  const text = await res.text();
  let data: { ok?: boolean; message?: string; data?: T } = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`无效响应 (${res.status})`);
  }

  if (!res.ok || !data.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }

  return data.data as T;
}
