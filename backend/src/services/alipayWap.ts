import crypto from 'node:crypto';

/**
 * 支付宝「手机网站支付」alipay.trade.wap.pay（OpenAPI 网关）
 * 文档：https://opendocs.alipay.com/open-v3/05w4kr（快速接入）
 * 接口说明：https://opendocs.alipay.com/open-v3/09d1et?scene=21
 * 微信小程序内通过 web-view 打开本服务生成的 HTML 表单页，再唤起支付宝客户端。
 */
export type AlipayWapConfig = {
  appId: string;
  appPrivateKeyPem: string;
  alipayPublicKeyPem: string;
  notifyUrl: string;
  /** 例如 https://openapi.alipay.com/gateway.do */
  gateway: string;
};

export function loadAlipayWapConfigFromEnv(): AlipayWapConfig | null {
  const appId = String(process.env.ALIPAY_APP_ID || '').trim();
  let appPrivateKeyPem = String(process.env.ALIPAY_APP_PRIVATE_KEY || '')
    .trim()
    .replace(/\\n/g, '\n');
  let alipayPublicKeyPem = String(process.env.ALIPAY_ALIPAY_PUBLIC_KEY || '')
    .trim()
    .replace(/\\n/g, '\n');
  const notifyUrl = String(process.env.ALIPAY_NOTIFY_URL || '').trim();
  const gateway = String(process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do').trim();

  if (!appId || !appPrivateKeyPem || !alipayPublicKeyPem || !notifyUrl) return null;
  if (!/^https?:\/\//i.test(gateway)) return null;
  return { appId, appPrivateKeyPem, alipayPublicKeyPem, notifyUrl, gateway };
}

export function shouldUseRealAlipayPay(alipayPaymentMockMode: boolean, cfg: AlipayWapConfig | null): cfg is AlipayWapConfig {
  return !alipayPaymentMockMode && cfg !== null;
}

function formatAlipayTimestamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function buildSignString(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
}

export function rsa2Sign(signContent: string, privateKeyPem: string): string {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signContent, 'utf8');
  sign.end();
  return sign.sign(privateKeyPem, 'base64');
}

export function rsa2Verify(signContent: string, signatureBase64: string, alipayPublicKeyPem: string): boolean {
  try {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(signContent, 'utf8');
    verify.end();
    return verify.verify(alipayPublicKeyPem, signatureBase64, 'base64');
  } catch {
    return false;
  }
}

/** 将订单金额（分）转为支付宝 total_amount（元，字符串） */
export function fenToAlipayYuan(totalFen: number): string {
  const yuan = Math.max(0, Math.floor(totalFen)) / 100;
  return yuan.toFixed(2);
}

export type AlipayWapPayBiz = {
  outTradeNo: string;
  totalFen: number;
  subject: string;
  notifyUrl: string;
  returnUrl: string;
  quitUrl: string;
};

/**
 * 调用网关 pageExecute 等价逻辑：POST form，响应 body 为可自动提交的 HTML。
 */
export async function requestAlipayTradeWapPayHtml(config: AlipayWapConfig, biz: AlipayWapPayBiz): Promise<string> {
  const bizContent = JSON.stringify({
    out_trade_no: biz.outTradeNo,
    total_amount: fenToAlipayYuan(biz.totalFen),
    subject: biz.subject.slice(0, 128),
    product_code: 'QUICK_WAP_WAY',
    notify_url: biz.notifyUrl,
    return_url: biz.returnUrl,
    quit_url: biz.quitUrl,
  });

  const params: Record<string, string> = {
    app_id: config.appId,
    method: 'alipay.trade.wap.pay',
    format: 'json',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatAlipayTimestamp(),
    version: '1.0',
    biz_content: bizContent,
  };

  const signContent = buildSignString(params);
  params.sign = rsa2Sign(signContent, config.appPrivateKeyPem);

  const body = new URLSearchParams(params);
  const res = await fetch(config.gateway, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`支付宝网关 HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  if (!text.includes('<form') && !text.includes('<FORM')) {
    throw new Error(`支付宝网关未返回表单 HTML，请检查 APP_ID/密钥/网关环境。响应片段：${text.slice(0, 300)}`);
  }
  return text;
}

/** 异步通知验签（application/x-www-form-urlencoded 解析后的平铺对象） */
export function verifyAlipayNotifyParams(params: Record<string, string>, alipayPublicKeyPem: string): boolean {
  const signature = params.sign;
  const signType = params.sign_type;
  if (!signature || signType !== 'RSA2') return false;
  const signContent = buildSignString(params);
  return rsa2Verify(signContent, signature, alipayPublicKeyPem);
}

export function isAlipayTradeSuccess(params: Record<string, string>): boolean {
  const s = params.trade_status;
  return s === 'TRADE_SUCCESS' || s === 'TRADE_FINISHED';
}

/** 同步退款 alipay.trade.refund（biz 为 JSON，网关返回 JSON） */
export async function requestAlipayTradeRefund(
  config: AlipayWapConfig,
  opts: {
    outTradeNo: string;
    tradeNo?: string;
    refundAmountYuan: string;
    outRequestNo: string;
    refundReason?: string;
  },
): Promise<{ code: string; msg: string; sub_code?: string; sub_msg?: string }> {
  const biz: Record<string, string> = {
    out_trade_no: opts.outTradeNo,
    refund_amount: opts.refundAmountYuan,
    out_request_no: opts.outRequestNo.slice(0, 64),
  };
  const tn = String(opts.tradeNo || '').trim();
  if (tn) biz.trade_no = tn;
  if (opts.refundReason) biz.refund_reason = opts.refundReason.slice(0, 256);
  const bizContent = JSON.stringify(biz);

  const params: Record<string, string> = {
    app_id: config.appId,
    method: 'alipay.trade.refund',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatAlipayTimestamp(),
    version: '1.0',
    biz_content: bizContent,
  };
  const signContent = buildSignString(params);
  params.sign = rsa2Sign(signContent, config.appPrivateKeyPem);

  const body = new URLSearchParams(params);
  const res = await fetch(config.gateway, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`支付宝退款 HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  let root: Record<string, unknown>;
  try {
    root = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`支付宝退款响应非 JSON：${text.slice(0, 300)}`);
  }
  const sub = root.alipay_trade_refund_response as Record<string, unknown> | undefined;
  const resp = (sub || root) as Record<string, unknown>;
  const code = String(resp.code ?? '');
  const msg = String(resp.msg ?? '');
  const out: { code: string; msg: string; sub_code?: string; sub_msg?: string } = { code, msg };
  if (resp.sub_code != null && String(resp.sub_code) !== '') out.sub_code = String(resp.sub_code);
  if (resp.sub_msg != null && String(resp.sub_msg) !== '') out.sub_msg = String(resp.sub_msg);
  return out;
}
