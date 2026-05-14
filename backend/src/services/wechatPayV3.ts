import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type WechatPayV3Config = {
  appId: string;
  mchId: string;
  serialNo: string;
  privateKeyPem: string;
  notifyUrl: string;
  apiV3Key: string;
  /** 微信平台证书 PEM（用于校验回调签名；不设则仅解密 resource，生产建议配置） */
  platformCertPem?: string;
};

function readTextFileIfExists(filePath: string): string {
  try {
    if (!filePath || !fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return '';
  }
}

/** 商户私钥：优先 WECHAT_PAY_PRIVATE_KEY，其次 WECHAT_PAY_PRIVATE_KEY_FILE，再次默认 certs 目录 */
function resolveMerchantPrivateKeyPem(): string {
  const inline = String(process.env.WECHAT_PAY_PRIVATE_KEY || '').trim().replace(/\\n/g, '\n');
  if (inline) return inline;
  const explicitFile = String(process.env.WECHAT_PAY_PRIVATE_KEY_FILE || '').trim();
  const here = path.dirname(fileURLToPath(import.meta.url));
  const defaultKey = path.join(here, '..', '..', 'certs', 'wechat-pay', 'apiclient_key.pem');
  return readTextFileIfExists(explicitFile) || readTextFileIfExists(defaultKey);
}

/** 微信平台证书 PEM：优先文件，其次环境变量（须为 PEM 文本） */
function resolvePlatformCertPem(): string | undefined {
  const explicitFile = String(process.env.WECHAT_PAY_PLATFORM_CERT_FILE || '').trim();
  const here = path.dirname(fileURLToPath(import.meta.url));
  const defaultPem = path.join(here, '..', '..', 'certs', 'wechat-pay', 'wechatpay_cert.pem');
  const fromFile = readTextFileIfExists(explicitFile) || readTextFileIfExists(defaultPem);
  if (fromFile) return fromFile;
  const pem = String(process.env.WECHAT_PAY_PLATFORM_CERT_PEM || '').trim().replace(/\\n/g, '\n');
  if (pem.includes('BEGIN CERTIFICATE')) return pem;
  return undefined;
}

/** 从环境变量组装配置；缺任意必填项则返回 null */
export function loadWechatPayConfigFromEnv(): WechatPayV3Config | null {
  const appId = String(process.env.WECHAT_APPID || '').trim();
  const mchId = String(process.env.WECHAT_MCH_ID || '').trim();
  const serialNo = String(process.env.WECHAT_PAY_SERIAL_NO || '').trim();
  const privateKeyPem = resolveMerchantPrivateKeyPem();
  const notifyUrl = String(process.env.WECHAT_PAY_NOTIFY_URL || '').trim();
  const apiV3Key = String(process.env.WECHAT_PAY_API_V3_KEY || '').trim();
  const platformCertPem = resolvePlatformCertPem();

  if (!appId || !mchId || !serialNo || !privateKeyPem || !notifyUrl || !apiV3Key) return null;
  const cfg: WechatPayV3Config = { appId, mchId, serialNo, privateKeyPem, notifyUrl, apiV3Key };
  if (platformCertPem) cfg.platformCertPem = platformCertPem;
  return cfg;
}

export function shouldUseRealWechatPay(paymentMockMode: boolean, cfg: WechatPayV3Config | null): cfg is WechatPayV3Config {
  return !paymentMockMode && cfg !== null;
}

function buildAuthorization(opts: {
  mchId: string;
  serialNo: string;
  privateKeyPem: string;
  method: string;
  urlPath: string;
  body: string;
}): string {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const message = `${opts.method}\n${opts.urlPath}\n${timestamp}\n${nonceStr}\n${opts.body}\n`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);
  sign.end();
  const signature = sign.sign(opts.privateKeyPem, 'base64');
  return `WECHATPAY2-SHA256-RSA2048 mchid="${opts.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${opts.serialNo}"`;
}

/**
 * 调用 GET /v3/certificates：校验商户号 + 证书序列号 + 私钥 是否与微信支付侧一致（不下单、不扣款）。
 * 不验证 WECHAT_PAY_API_V3_KEY（该密钥用于回调解密等，需另在沙箱单测或真实 notify 中验证）。
 */
export async function verifyWechatPayMerchantAuth(config: WechatPayV3Config): Promise<
  { ok: true; certificateCount: number } | { ok: false; httpStatus: number; detail: string }
> {
  const urlPath = '/v3/certificates';
  const body = '';
  const authorization = buildAuthorization({
    mchId: config.mchId,
    serialNo: config.serialNo,
    privateKeyPem: config.privateKeyPem,
    method: 'GET',
    urlPath,
    body,
  });
  const res = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
    method: 'GET',
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      'Accept-Language': 'zh-CN',
      'User-Agent': 'WechatMiniBackend/1.0',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, httpStatus: res.status, detail: text.slice(0, 800) };
  }
  try {
    const json = JSON.parse(text) as { data?: unknown[] };
    const certificateCount = Array.isArray(json.data) ? json.data.length : 0;
    return { ok: true, certificateCount };
  } catch {
    return { ok: false, httpStatus: res.status, detail: 'response not json' };
  }
}

export async function jsapiTransactions(opts: {
  config: WechatPayV3Config;
  description: string;
  outTradeNo: string;
  totalFen: number;
  openid: string;
}): Promise<{ prepay_id: string }> {
  const urlPath = '/v3/pay/transactions/jsapi';
  const bodyObj = {
    appid: opts.config.appId,
    mchid: opts.config.mchId,
    description: opts.description.slice(0, 127),
    out_trade_no: opts.outTradeNo,
    notify_url: opts.config.notifyUrl,
    amount: { total: Math.floor(opts.totalFen), currency: 'CNY' },
    payer: { openid: opts.openid },
  };
  const body = JSON.stringify(bodyObj);
  const authorization = buildAuthorization({
    mchId: opts.config.mchId,
    serialNo: opts.config.serialNo,
    privateKeyPem: opts.config.privateKeyPem,
    method: 'POST',
    urlPath,
    body,
  });

  const res = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      'Accept-Language': 'zh-CN',
      'Content-Type': 'application/json',
      'User-Agent': 'WechatMiniBackend/1.0',
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `WeChat JSAPI HTTP ${res.status}`);
  }
  const json = JSON.parse(text) as { prepay_id?: string };
  if (!json.prepay_id) throw new Error(text || 'WeChat JSAPI missing prepay_id');
  return { prepay_id: json.prepay_id };
}

/** 退款：transaction_id 与 out_trade_no 二选一（与商户单号一致时用 out_trade_no 即可） */
export async function domesticRefund(opts: {
  config: WechatPayV3Config;
  outRefundNo: string;
  transactionId?: string;
  outTradeNo?: string;
  refundFen: number;
  totalFen: number;
  reason?: string;
}): Promise<{ status: string; refund_id?: string; amount?: { refund?: number; total?: number } }> {
  const urlPath = '/v3/refund/domestic/refunds';
  const bodyObj: Record<string, unknown> = {
    out_refund_no: opts.outRefundNo.slice(0, 64),
    reason: (opts.reason || '用户申请退款').slice(0, 80),
    amount: {
      refund: Math.floor(opts.refundFen),
      total: Math.floor(opts.totalFen),
      currency: 'CNY',
    },
  };
  const tid = String(opts.transactionId || '').trim();
  const otn = String(opts.outTradeNo || '').trim();
  if (tid) bodyObj.transaction_id = tid;
  else if (otn) bodyObj.out_trade_no = otn;
  else throw new Error('domesticRefund: need transaction_id or out_trade_no');

  const body = JSON.stringify(bodyObj);
  const authorization = buildAuthorization({
    mchId: opts.config.mchId,
    serialNo: opts.config.serialNo,
    privateKeyPem: opts.config.privateKeyPem,
    method: 'POST',
    urlPath,
    body,
  });

  const res = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      'Accept-Language': 'zh-CN',
      'Content-Type': 'application/json',
      'User-Agent': 'WechatMiniBackend/1.0',
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `WeChat refund HTTP ${res.status}`);
  }
  const json = JSON.parse(text) as { status?: string; refund_id?: string; amount?: { refund?: number; total?: number } };
  const status = String(json.status || '').trim();
  if (!status) throw new Error(text || 'WeChat refund missing status');
  const out: { status: string; refund_id?: string; amount?: { refund?: number; total?: number } } = { status };
  if (json.refund_id) out.refund_id = json.refund_id;
  if (json.amount) out.amount = json.amount;
  return out;
}

export function buildMiniProgramPayParams(appId: string, prepayId: string, privateKeyPem: string) {
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const pkg = `prepay_id=${prepayId}`;
  const message = `${appId}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);
  sign.end();
  const paySign = sign.sign(privateKeyPem, 'base64');
  return {
    timeStamp,
    nonceStr,
    package: pkg,
    signType: 'RSA' as const,
    paySign,
  };
}

/** AEAD_AES_256_GCM 解密支付通知 resource.ciphertext */
export function decryptNotifyCiphertext(apiV3Key: string, associatedData: string, nonce: string, ciphertextB64: string): string {
  const key = Buffer.from(apiV3Key, 'utf8');
  if (key.length !== 32) throw new Error('WECHAT_PAY_API_V3_KEY must be 32 bytes');
  const buf = Buffer.from(ciphertextB64, 'base64');
  if (buf.length < 17) throw new Error('invalid ciphertext length');
  const authTag = buf.subarray(buf.length - 16);
  const enc = buf.subarray(0, buf.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf8'));
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(associatedData || '', 'utf8'));
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function verifyNotifySignature(opts: {
  body: string;
  timestamp: string;
  nonce: string;
  signatureBase64: string;
  platformCertPem: string;
}): boolean {
  const message = `${opts.timestamp}\n${opts.nonce}\n${opts.body}\n`;
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(message);
  verifier.end();
  const sig = Buffer.from(opts.signatureBase64, 'base64');
  return verifier.verify(opts.platformCertPem, sig);
}
