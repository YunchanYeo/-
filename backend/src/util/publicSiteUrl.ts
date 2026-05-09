import type { Request } from 'express';

/** 공인 https 원점(PUBLIC_UPLOAD_BASE_URL) 또는 프록시 뒤 요청 기준 절대 URL */
export function buildPublicSiteUrl(req: Request, pathname: string): string {
  const base = String(process.env.PUBLIC_UPLOAD_BASE_URL || process.env.PUBLIC_SITE_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (base) return `${base}${path}`;
  return `${req.protocol}://${req.get('host')}${path}`;
}
