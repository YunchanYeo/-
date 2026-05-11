import 'dotenv/config';
import { jsapiTransactions, loadWechatPayConfigFromEnv, verifyWechatPayMerchantAuth } from '../services/wechatPayV3';

function looksLikeOpenidOrPayerError(msg: string): boolean {
  return /openid|OPENID|用户|账号|payer|无效|不符/i.test(msg);
}

function looksLikeAuthSignError(msg: string): boolean {
  return /HTTP 401|签名错误|SIGN_ERROR|CERTIFICATE_ERROR|Unauthorized/i.test(msg);
}

/** 非签名类业务错误：说明请求已进入微信支付业务校验（签名已通过） */
function looksLikeBusinessRejectionAfterSignOk(msg: string): boolean {
  return (
    looksLikeOpenidOrPayerError(msg) ||
    msg.includes('APPID_MCHID_NOT_MATCH') ||
    msg.includes('HTTP 400') ||
    msg.includes('HTTP 403')
  );
}

/**
 * 使用当前 .env（及默认 apiclient_key.pem）验证商户 API 证书序列号 + 私钥。
 * 1) GET /v3/certificates（部分新商户会 404「无可用平台证书」）
 * 2) 此时再发一笔故意无效 openid 的 JSAPI 下单：若返回与 openid/用户相关错误，通常表示签名已通过。
 */
async function main() {
  const cfg = loadWechatPayConfigFromEnv();
  if (!cfg) {
    console.error(
      '[probe-wechat-pay] 配置不完整：需 WECHAT_APPID、WECHAT_MCH_ID、WECHAT_PAY_SERIAL_NO、商户私钥（WECHAT_PAY_PRIVATE_KEY / 文件 / certs/wechat-pay/apiclient_key.pem）、WECHAT_PAY_NOTIFY_URL、WECHAT_PAY_API_V3_KEY。',
    );
    process.exit(1);
  }
  const key = Buffer.from(cfg.apiV3Key, 'utf8');
  if (key.length !== 32) {
    console.warn(
      `[probe-wechat-pay] 警告：WECHAT_PAY_API_V3_KEY 应为 32 字节（当前 ${key.length}）。证书接口不校验该字段；支付回调解密会失败。`,
    );
  }
  const r = await verifyWechatPayMerchantAuth(cfg);
  if (r.ok) {
    console.log(`[probe-wechat-pay] 成功：GET /v3/certificates 已接受商户签名；平台证书条数: ${r.certificateCount}`);
    process.exit(0);
  }

  const certUnavailable =
    r.httpStatus === 404 &&
    (r.detail.includes('平台证书') || r.detail.includes('RESOURCE_NOT_EXISTS') || r.detail.includes('公钥'));

  if (certUnavailable) {
    console.warn('[probe-wechat-pay] GET /v3/certificates 不可用（商户平台可能已切「微信支付公钥」模式）。改用 JSAPI 试探请求…');
    try {
      await jsapiTransactions({
        config: cfg,
        description: 'probe',
        outTradeNo: `PROBE${Date.now()}`,
        totalFen: 1,
        openid: 'oInvalidOpenidProbeAuth0000000001',
      });
      console.log('[probe-wechat-pay] 意外：无效 openid 仍返回 prepay_id，请人工核对响应');
      process.exit(0);
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      if (looksLikeAuthSignError(msg)) {
        console.error('[probe-wechat-pay] 失败：商户签名或证书序列号/私钥未被接受（与 401/签名 相关）。');
        console.error(msg.slice(0, 800));
        process.exit(1);
      }
      if (looksLikeBusinessRejectionAfterSignOk(msg)) {
        console.log(
          '[probe-wechat-pay] 成功（间接）：JSAPI 未报签名/证书错误，请求已进入业务校验。说明 WECHAT_PAY_SERIAL_NO + 私钥 与商户平台一致的概率很高。',
        );
        if (msg.includes('APPID_MCHID_NOT_MATCH')) {
          console.log(
            '[probe-wechat-pay] 提示：当前为「小程序 AppID」与「商户号 mchid」未在微信侧绑定。请核对 WECHAT_APPID 与商户平台「AppID 账号管理」关联，或改用已关联该商户的小程序 AppID。',
          );
        } else {
          console.log(
            '[probe-wechat-pay] 提示：下列错误来自测试用无效 openid 等，真机请用微信登录后的真实 openid 再测下单。',
          );
        }
        console.error('[probe-wechat-pay] 微信支付原始错误摘要（供对照）:');
        console.error(msg.slice(0, 800));
        process.exit(0);
      }
      console.error('[probe-wechat-pay] 无法判定，请根据下列响应人工核对：');
      console.error(msg.slice(0, 800));
      process.exit(1);
    }
  }

  console.error(`[probe-wechat-pay] 失败 HTTP ${r.httpStatus}`);
  console.error(r.detail);
  process.exit(1);
}

main().catch((err) => {
  console.error('[probe-wechat-pay]', err);
  process.exit(1);
});
