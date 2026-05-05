import { Router } from 'express';

export function createApiRouter(controller: any) {
  const router = Router();

  // public routes
  router.get('/health', controller.health);
  router.get('/categories', controller.categories);
  router.post('/auth/wechat-login', controller.wechatLogin);
  router.get('/products', controller.publicProducts);
  router.get('/products/:id', controller.publicProductDetail);

  // auth routes
  router.get('/me', controller.requireAuth, controller.me);
  router.put('/me', controller.requireAuth, controller.updateMe);

  router.get('/addresses', controller.requireAuth, controller.listAddresses);
  router.get('/addresses/:id', controller.requireAuth, controller.getAddress);
  router.post('/addresses', controller.requireAuth, controller.createAddress);
  router.put('/addresses/:id', controller.requireAuth, controller.updateAddress);
  router.delete('/addresses/:id', controller.requireAuth, controller.deleteAddress);

  router.get('/orders', controller.requireAuth, controller.listOrders);
  router.get('/orders/count', controller.requireAuth, controller.ordersCount);
  router.get('/orders/:orderNo', controller.requireAuth, controller.getOrderDetail);
  router.post('/orders/:orderNo/refund', controller.requireAuth, controller.refundOrder);
  router.post('/orders/commit', controller.requireAuth, controller.commitOrder);

  // support chat (user)
  router.get('/support/messages', controller.requireAuth, controller.listMySupportMessages);
  router.post('/support/messages', controller.requireAuth, controller.createMySupportMessage);
  router.post('/support/upload-media', controller.requireAuth, controller.supportUploadMedia);

  // admin routes
  router.post('/admin/login', controller.adminLogin);
  router.get('/admin/me', controller.requireAdmin, controller.adminMe);
  router.put('/admin/me/password', controller.requireAdmin, controller.adminUpdatePassword);
  router.put('/admin/me/username', controller.requireAdmin, controller.adminUpdateUsername);

  router.get('/admin/orders', controller.requireAdmin, controller.adminOrders);
  router.post('/admin/orders/:orderNo/shipping', controller.requireAdmin, controller.adminUpdateOrderShipping);

  router.get('/admin/products', controller.requireAdmin, controller.adminProducts);
  router.get('/admin/products/:id', controller.requireAdmin, controller.adminProductDetail);
  router.post('/admin/products', controller.requireAdmin, controller.adminCreateProduct);
  router.put('/admin/products/:id', controller.requireAdmin, controller.adminUpdateProduct);
  router.put('/admin/products/:id/stock', controller.requireAdmin, controller.adminUpdateProductStock);
  router.post('/admin/upload-image', controller.requireAdmin, controller.adminUploadImage);
  router.get('/admin/support/conversations', controller.requireAdmin, controller.adminSupportConversations);
  router.get('/admin/support/messages/:userId', controller.requireAdmin, controller.adminSupportMessagesByUser);
  router.post('/admin/support/messages/:userId', controller.requireAdmin, controller.adminSupportReply);
  router.post('/admin/support/upload-media', controller.requireAdmin, controller.adminSupportUploadMedia);

  return router;
}
