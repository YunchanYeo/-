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
  router.post('/orders/:orderNo/paid', controller.requireAuth, controller.markOrderPaid);
  router.post('/orders/:orderNo/cancel', controller.requireAuth, controller.cancelOrder);
  router.post('/orders/:orderNo/confirm', controller.requireAuth, controller.confirmOrderReceived);
  router.delete('/orders/:orderNo', controller.requireAuth, controller.deleteOrder);
  router.get('/orders/:orderNo/logistics-trace', controller.requireAuth, controller.orderLogisticsTrace);
  router.get('/points/config', controller.requireAuth, controller.pointsConfig);
  router.post('/orders/commit', controller.requireAuth, controller.commitOrder);

  // support chat (user)
  router.get('/support/messages', controller.requireAuth, controller.listMySupportMessages);
  router.post('/support/messages', controller.requireAuth, controller.createMySupportMessage);
  router.get('/support/typing', controller.requireAuth, controller.getMySupportPeerTyping);
  router.post('/support/typing', controller.requireAuth, controller.setMySupportTyping);
  router.post('/support/upload-media', controller.requireAuth, controller.supportUploadMedia);
  router.get('/coupons', controller.requireAuth, controller.listMyCoupons);
  router.get('/coupons/:id', controller.requireAuth, controller.getMyCouponDetail);

  // admin routes
  router.post('/admin/login', controller.adminLogin);
  router.get('/admin/me', controller.requireAdmin, controller.adminMe);
  router.put('/admin/me/password', controller.requireAdmin, controller.adminUpdatePassword);
  router.put('/admin/me/username', controller.requireAdmin, controller.adminUpdateUsername);

  router.get('/admin/orders', controller.requireAdmin, controller.adminOrders);
  router.get('/admin/orders/:orderNo/logistics-trace', controller.requireAdmin, controller.adminOrderLogisticsTrace);
  router.post('/admin/orders/:orderNo/shipping', controller.requireAdmin, controller.adminUpdateOrderShipping);
  router.put('/admin/orders/:orderNo/status', controller.requireAdmin, controller.adminUpdateOrderStatus);
  router.delete('/admin/orders/:orderNo', controller.requireAdmin, controller.adminDeleteOrder);
  router.get('/admin/point-policy', controller.requireAdmin, controller.adminGetPointPolicy);
  router.put('/admin/point-policy', controller.requireAdmin, controller.adminUpdatePointPolicy);
  router.get('/admin/order-visibility', controller.requireAdmin, controller.adminGetOrderVisibility);
  router.put('/admin/order-visibility', controller.requireAdmin, controller.adminUpdateOrderVisibility);

  router.get('/admin/products', controller.requireAdmin, controller.adminProducts);
  router.get('/admin/products/:id', controller.requireAdmin, controller.adminProductDetail);
  router.post('/admin/products', controller.requireAdmin, controller.adminCreateProduct);
  router.put('/admin/products/:id', controller.requireAdmin, controller.adminUpdateProduct);
  router.delete('/admin/products/:id', controller.requireAdmin, controller.adminDeleteProduct);
  router.put('/admin/products/:id/stock', controller.requireAdmin, controller.adminUpdateProductStock);
  router.post('/admin/upload-image', controller.requireAdmin, controller.adminUploadImage);

  router.get('/admin/categories', controller.requireAdmin, controller.adminListCategories);
  router.post('/admin/categories', controller.requireAdmin, controller.adminCreateCategory);
  router.put('/admin/categories/:id', controller.requireAdmin, controller.adminUpdateCategory);
  router.delete('/admin/categories/:id', controller.requireAdmin, controller.adminDeleteCategory);
  router.get('/admin/coupons', controller.requireAdmin, controller.adminListCoupons);
  router.post('/admin/coupons', controller.requireAdmin, controller.adminCreateCoupon);
  router.post('/admin/coupons/:id/grant', controller.requireAdmin, controller.adminGrantCoupon);
  router.put('/admin/coupons/:id', controller.requireAdmin, controller.adminUpdateCoupon);
  router.delete('/admin/coupons/:id', controller.requireAdmin, controller.adminDeleteCoupon);

  router.get('/admin/support/conversations', controller.requireAdmin, controller.adminSupportConversations);
  router.get('/admin/support/messages/:userId', controller.requireAdmin, controller.adminSupportMessagesByUser);
  router.post('/admin/support/messages/:userId', controller.requireAdmin, controller.adminSupportReply);
  router.get('/admin/support/typing/:userId', controller.requireAdmin, controller.adminGetSupportPeerTyping);
  router.post('/admin/support/typing/:userId', controller.requireAdmin, controller.adminSetSupportTyping);
  router.post('/admin/support/upload-media', controller.requireAdmin, controller.adminSupportUploadMedia);

  return router;
}
