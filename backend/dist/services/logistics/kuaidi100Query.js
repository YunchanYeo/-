import crypto from 'node:crypto';
function md5SignUpper(param, key, customer) {
    return crypto.createHash('md5').update(`${param}${key}${customer}`).digest('hex').toUpperCase();
}
function parseAreaCenter(center) {
    if (typeof center !== 'string')
        return null;
    const parts = center.split(',').map((x) => Number(String(x).trim()));
    if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1]))
        return null;
    const lng = parts[0];
    const lat = parts[1];
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
        return null;
    return { longitude: lng, latitude: lat };
}
/**
 * 快递100「实时查询」：文档 https://api.kuaidi100.com/document/5f0ffb5ebc8da837cbd8aefc.html
 * 需环境变量 KUAIDI100_KEY、KUAIDI100_CUSTOMER（企业版授权）。
 */
export async function queryKuaidi100RealTime(opts) {
    const paramObj = {
        com: opts.com,
        num: opts.num.trim(),
        resultv2: '4',
        show: '0',
        order: 'desc',
        lang: 'zh',
    };
    const phone = String(opts.phone || '').replace(/\s/g, '');
    if (phone)
        paramObj.phone = phone;
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
    let json;
    try {
        json = JSON.parse(text);
    }
    catch {
        throw new Error(`快递100返回无法解析的响应`);
    }
    if (json && json.result === false) {
        const msg = String(json.message || json.returnCode || '查询失败');
        throw new Error(msg);
    }
    const rows = Array.isArray(json.data) ? json.data : [];
    const traces = rows.map((row) => {
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
    const withCoord = traces.filter((t) => t.latitude != null && t.longitude != null);
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
