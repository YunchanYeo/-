import type Database from 'better-sqlite3';
import type { WechatPayV3Config } from './services/wechatPayV3';
import type { AlipayWapConfig } from './services/alipayWap';

export type Db = Database.Database;

export type RequestContext = {
  db: Db;
  uploadsDir: string;
  wechatAppId: string;
  wechatAppSecret: string;
  paymentMockMode: boolean;
  /** 商户证书与 v3 密钥齐全时非 null；与 paymentMockMode 共同决定是否走真实 JSAPI */
  wechatPayConfig: WechatPayV3Config | null;
  /** 与 ALIPAY_PAY_MOCK 共同决定是否走真实手机网站支付 */
  alipayPaymentMockMode: boolean;
  alipayWapConfig: AlipayWapConfig | null;
};
//dfdfd
export type AuthedUser = {
  id: number;
  customerId: string | null;
  openid: string;
  nickName: string | null;
  avatarUrl: string | null;
  gender: number | null;
  phoneNumber: string | null;
  /** 积分（DB users.points） */
  points: number;
};

export type AuthedAdmin = {
  id: number;
  username: string;
};
