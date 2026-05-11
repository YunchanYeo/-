import type { Request, Response } from 'express';

/** 小程序等可读的公开配置（无敏感信息） */
export function createAppConfigService() {
  return {
    appConfig(_req: Request, res: Response) {
      const customerServicePhone = String(process.env.CUSTOMER_SERVICE_PHONE || '').trim();
      res.json({ ok: true, data: { customerServicePhone } });
    },
  };
}
