import type Database from 'better-sqlite3';

export type Db = Database.Database;

export type RequestContext = {
  db: Db;
  uploadsDir: string;
  wechatAppId: string;
  wechatAppSecret: string;
  paymentMockMode: boolean;
};

export type AuthedUser = {
  id: number;
  customerId: string | null;
  openid: string;
  nickName: string | null;
  avatarUrl: string | null;
  gender: number | null;
  phoneNumber: string | null;
};

export type AuthedAdmin = {
  id: number;
  username: string;
};
