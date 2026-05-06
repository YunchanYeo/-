/**
 * 将后台存的物流公司名称 / 编码映射为快递100「com」编码（小写）。
 * 编码表：https://api.kuaidi100.com/manager/openapi/download/kdbm.do
 */
export function resolveKuaidiCom(params: { logisticsCompanyCode: string; logisticsCompanyName: string }): string | null {
  const rawCode = String(params.logisticsCompanyCode || '').trim().toLowerCase();
  const name = String(params.logisticsCompanyName || '').trim();

  const known = new Set([
    'shunfeng',
    'yuantong',
    'zhongtong',
    'shentong',
    'yunda',
    'youzhengguonei',
    'ems',
    'jd',
    'jtexpress',
    'debangwuliu',
    'debangkuaidi',
    'htky',
    'fengwang',
    'youzhengbk',
    'china-post',
    'pjbest',
  ]);
  if (rawCode && known.has(rawCode)) return rawCode;

  const rules: Array<{ test: (s: string) => boolean; com: string }> = [
    { test: (s) => /顺丰|sf|shunfeng/i.test(s), com: 'shunfeng' },
    { test: (s) => /圆通|yuantong|yt\b/i.test(s), com: 'yuantong' },
    { test: (s) => /中通|zhongtong|zt\b/i.test(s), com: 'zhongtong' },
    { test: (s) => /申通|shentong|sto/i.test(s), com: 'shentong' },
    { test: (s) => /韵达|yunda/i.test(s), com: 'yunda' },
    { test: (s) => /顺丰丰网|丰网/i.test(s), com: 'fengwang' },
    { test: (s) => /百世|htky|best/i.test(s), com: 'htky' },
    { test: (s) => /京东|jd物流|jdl/i.test(s), com: 'jd' },
    { test: (s) => /极兔|j&t|jtexpress/i.test(s), com: 'jtexpress' },
    { test: (s) => /德邦/i.test(s), com: 'debangwuliu' },
    { test: (s) => /邮政包裹|邮政快递|国内小包/i.test(s), com: 'youzhengguonei' },
    { test: (s) => /EMS|ems\b/i.test(s), com: 'ems' },
    { test: (s) => /中国邮政/i.test(s), com: 'youzhengguonei' },
  ];

  const hay = `${name} ${rawCode}`;
  for (const r of rules) {
    if (r.test(hay)) return r.com;
  }
  return rawCode && /^[a-z][a-z0-9_-]{1,29}$/.test(rawCode) ? rawCode : null;
}
