import type { RequestContext } from '../types';
import { createAuthService } from './authService';
import { createHealthService } from './healthService';
import { createCategoryService } from './categoryService';
import { createProductService } from './productService';
import { createAdminService } from './adminService';
import { createAddressService } from './addressService';
import { createOrderService } from './orderService';
import { createUserService } from './userService';
import { createSupportService } from './supportService';

export function createServices(ctx: RequestContext) {
  const health = createHealthService();
  const category = createCategoryService();
  const auth = createAuthService({ db: ctx.db, wechatAppId: ctx.wechatAppId, wechatAppSecret: ctx.wechatAppSecret });
  const product = createProductService({ db: ctx.db });
  const admin = createAdminService({ db: ctx.db, uploadsDir: ctx.uploadsDir });
  const address = createAddressService({ db: ctx.db });
  const order = createOrderService({ db: ctx.db, paymentMockMode: ctx.paymentMockMode });
  const user = createUserService({ db: ctx.db });
  const support = createSupportService({ db: ctx.db, uploadsDir: ctx.uploadsDir });

  return { health, category, auth, product, admin, address, order, user, support };
}
