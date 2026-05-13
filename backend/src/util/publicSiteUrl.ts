import type { Request } from 'express';

let warnedLegacyUploadBase = false;

/** 공인 https 원점(PUBLIC_UPLOAD_BASE_URL) 또는 프록시 뒤 요청 기준 절대 URL */
export function buildPublicSiteUrl(req: Request, pathname: string): string {
  const base = String(process.env.PUBLIC_UPLOAD_BASE_URL || process.env.PUBLIC_SITE_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (base) {
    if (!warnedLegacyUploadBase && /hebibingtest\.shop/i.test(base)) {
      warnedLegacyUploadBase = true;
      console.warn(
        '[buildPublicSiteUrl] PUBLIC_UPLOAD_BASE_URL 에 폐기 도메인(hebibingtest.shop)이 포함됨 — 로컬에서는 .env 에서 삭제하거나 https://127.0.0.1:3000 로 두세요.',
      );
    }
    return `${base}${path}`;
  }
  return `${req.protocol}://${req.get('host')}${path}`;
}
