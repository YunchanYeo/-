const rawBase = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

/** API 根路径（无末尾 /）；开发环境留空则走 Vite 同源代理 */
export function getApiBase(): string {
  return rawBase.replace(/\/$/, '');
}

export function resolveUploadUrl(image: string | null | undefined): string {
  if (!image) return '';
  if (/^https?:\/\//i.test(image)) {
    // HTTPS 페이지에서 http:// 업로드 URL(프록시 오구성) 혼합 콘텐츠 차단 방지
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && image.startsWith('http://')) {
      try {
        const u = new URL(image);
        if (u.hostname === window.location.hostname) {
          return `https://${u.host}${u.pathname}${u.search}`;
        }
      } catch {
        /* */
      }
    }
    return image;
  }
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

function createTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  ctrl.signal.addEventListener(
    'abort',
    () => {
      clearTimeout(t);
    },
    { once: true },
  );
  return ctrl.signal;
}

export async function adminJson<T>(path: string, opts: JsonOpts = {}): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (opts.token) headers['x-admin-token'] = opts.token;

  const signal =
    opts.timeoutMs != null && opts.timeoutMs > 0 ? createTimeoutSignal(opts.timeoutMs) : undefined;

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'Failed to fetch' || msg.includes('Load failed') || msg.includes('NetworkError')) {
      throw new Error(
        '网络请求失败（请确认管理后台与 API 同源部署，或检查 VITE_API_BASE_URL / HTTPS 混合内容）',
      );
    }
    if (msg === 'The user aborted a request.' || msg.includes('aborted')) {
      throw new Error('请求超时，请稍后重试或缩小图片');
    }
    throw e instanceof Error ? e : new Error(msg);
  }

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
