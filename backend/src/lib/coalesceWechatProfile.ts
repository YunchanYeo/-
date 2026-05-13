/**
 * UPDATE … COALESCE(?, column) 용: null 이면 기존 컬럼 유지.
 * 빈 문자열을 넘기면 SQLite 에서 '' 로 덮어써져「불러와지는데 저장 안 됨」처럼 보일 수 있음.
 */
export function nickNameForSqlUpdate(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  /** 「微信用户」도 위챗이 내려준 값이면 DB에 저장해야 마이페이지에 반영됨（null 로 두면 COALESCE 가 기존 빈 값 유지） */
  return t;
}

export function avatarUrlForSqlUpdate(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  return t;
}
