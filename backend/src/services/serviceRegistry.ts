import type { RequestContext } from '../types';
import { createAuthService } from './authService';
import { createHealthService } from './healthService';
import { createAppConfigService } from './appConfigService';
import { createCategoryService } from './categoryService';
import { createProductService } from './productService';
import { createAdminService } from './adminService';
import { createAddressService } from './addressService';
import { createOrderService } from './orderService';
import { createUserService } from './userService';
import { createSupportService } from './supportService';
import { createCouponService } from './couponService';
import { createProductMediaService } from './productMediaService';
import { createPromotionService } from './promotionService';

export function createServices(ctx: RequestContext) {
  const health = createHealthService();
  const appConfig = createAppConfigService();
  const category = createCategoryService({ db: ctx.db });
  const auth = createAuthService({ db: ctx.db, wechatAppId: ctx.wechatAppId, wechatAppSecret: ctx.wechatAppSecret });
  const product = createProductService({ db: ctx.db });
  const admin = createAdminService({ db: ctx.db, uploadsDir: ctx.uploadsDir });
  const productMedia = createProductMediaService({ db: ctx.db });
  const address = createAddressService({ db: ctx.db });
  const order = createOrderService({
    db: ctx.db,
    paymentMockMode: ctx.paymentMockMode,
    wechatPayConfig: ctx.wechatPayConfig,
    alipayPaymentMockMode: ctx.alipayPaymentMockMode,
    alipayWapConfig: ctx.alipayWapConfig,
  });
  const user = createUserService({ db: ctx.db });
  const support = createSupportService({ db: ctx.db, uploadsDir: ctx.uploadsDir });
  const coupon = createCouponService({ db: ctx.db });
  const promotion = createPromotionService({ db: ctx.db });

  return { health, appConfig, category, auth, product, admin, productMedia, address, order, user, support, coupon, promotion };
}
