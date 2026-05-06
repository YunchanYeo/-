import crypto from 'node:crypto';

export type LogisticsTracePoint = {
  time: string;
  context: string;
  status?: string;
  areaName?: string;
  longitude?: number;
  latitude?: number;
};

export type Kuaidi100QueryResult = {
  state: string | undefined;
  com: string | undefined;
  nu: string | undefined;
  traces: LogisticsTracePoint[];
  /** 用于小程序 map 折线：按时间从早到晚 */
  polylinePoints: Array<{ latitude: number; longitude: number }>;
  routeInfo: unknown;
  rawMessage: string | undefined;
};

function md5SignUpper(param: string, key: string, customer: string) {
  return crypto.createHash('md5').update(`${param}${key}${customer}`).digest('hex').toUpperCase();
}

function parseAreaCenter(center: unknown): { longitude: number; latitude: number } | null {
  if (typeof center !== 'string') return null;
  const parts = center.split(',').map((x) => Number(String(x).trim()));
  if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  const lng = parts[0] as number;
  const lat = parts[1] as number;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { longitude: lng, latitude: lat };
}

/**
 * 快递100「实时查询」：文档 https://api.kuaidi100.com/document/5f0ffb5ebc8da837cbd8aefc.html
 * 需环境变量 KUAIDI100_KEY、KUAIDI100_CUSTOMER（企业版授权）。
 */
export async function queryKuaidi100RealTime(opts: {
  key: string;
  customer: string;
  com: string;
  num: string;
  phone?: string;
}): Promise<Kuaidi100QueryResult> {
  const paramObj: Record<string, string> = {
    com: opts.com,
    num: opts.num.trim(),
    resultv2: '4',
    show: '0',
    order: 'desc',
    lang: 'zh',
  };
  const phone = String(opts.phone || '').replace(/\s/g, '');
  if (phone) paramObj.phone = phone;

  const param = JSON.stringify(paramObj);
  const sign = md5SignUpper(param, opts.key, opts.customer);
  const body = new URLSearchParams({
    customer: opts.customer,
    sign,
    param,
  });

  const res = await fetch('https://poll.kuaidi100.com/poll/query.do', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: body.toString(),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`快递100返回无法解析的响应`);
  }

  if (json && json.result === false) {
    const msg = String(json.message || json.returnCode || '查询失败');
    throw new Error(msg);
  }

  const rows = Array.isArray(json.data) ? json.data : [];
  const traces: LogisticsTracePoint[] = rows.map((row: any) => {
    const coord = parseAreaCenter(row.areaCenter);
    return {
      time: String(row.ftime || row.time || ''),
      context: String(row.context || ''),
      status: row.status != null ? String(row.status) : undefined,
      areaName: row.areaName != null ? String(row.areaName) : undefined,
      longitude: coord?.longitude,
      latitude: coord?.latitude,
    };
  });

  const withCoord = traces.filter((t) => t.latitude != null && t.longitude != null) as Array<
    LogisticsTracePoint & { latitude: number; longitude: number }
  >;
  const chronological = [...withCoord].reverse();
  const polylinePoints = chronological.map((t) => ({
    latitude: t.latitude,
    longitude: t.longitude,
  }));

  return {
    state: json.state != null ? String(json.state) : undefined,
    com: json.com != null ? String(json.com) : undefined,
    nu: json.nu != null ? String(json.nu) : undefined,
    traces,
    polylinePoints,
    routeInfo: json.routeInfo ?? undefined,
    rawMessage: json.message != null ? String(json.message) : undefined,
  };
}
