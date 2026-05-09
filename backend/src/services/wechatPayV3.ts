import crypto from 'node:crypto';

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

/** 从环境变量组装配置；缺任意必填项则返回 null */
export function loadWechatPayConfigFromEnv(): WechatPayV3Config | null {
  const appId = String(process.env.WECHAT_APPID || '').trim();
  const mchId = String(process.env.WECHAT_MCH_ID || '').trim();
  const serialNo = String(process.env.WECHAT_PAY_SERIAL_NO || '').trim();
  let privateKeyPem = String(process.env.WECHAT_PAY_PRIVATE_KEY || '').trim().replace(/\\n/g, '\n');
  const notifyUrl = String(process.env.WECHAT_PAY_NOTIFY_URL || '').trim();
  const apiV3Key = String(process.env.WECHAT_PAY_API_V3_KEY || '').trim();
  let platformCertPem = process.env.WECHAT_PAY_PLATFORM_CERT_PEM?.trim();
  if (platformCertPem) platformCertPem = platformCertPem.replace(/\\n/g, '\n');

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
