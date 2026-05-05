import type { RequestHandler } from 'express';

export type Services = ReturnType<typeof import('../services/serviceRegistry').createServices>;

export function createApiController(services: Services) {
  return {
    // middlewares
    requireAuth: services.auth.requireAuth as RequestHandler,
    requireAdmin: services.auth.requireAdmin as RequestHandler,

    // public
    health: services.health.health as RequestHandler,
    categories: services.category.categories as RequestHandler,
    wechatLogin: services.auth.wechatLogin as RequestHandler,
    publicProducts: services.product.publicProducts as RequestHandler,
    publicProductDetail: services.product.publicProductDetail as RequestHandler,

    // user
    me: services.user.me as RequestHandler,
    updateMe: services.user.updateMe as RequestHandler,

    // addresses
    listAddresses: services.address.listAddresses as RequestHandler,
    getAddress: services.address.getAddress as RequestHandler,
    createAddress: services.address.createAddress as RequestHandler,
    updateAddress: services.address.updateAddress as RequestHandler,
    deleteAddress: services.address.deleteAddress as RequestHandler,

    // orders
    listOrders: services.order.listOrders as RequestHandler,
    ordersCount: services.order.ordersCount as RequestHandler,
    getOrderDetail: services.order.getOrderDetail as RequestHandler,
    refundOrder: services.order.refundOrder as RequestHandler,
    commitOrder: services.order.commitOrder as RequestHandler,

    // support chat
    listMySupportMessages: services.support.listMyMessages as RequestHandler,
    createMySupportMessage: services.support.createMyMessage as RequestHandler,
    adminSupportConversations: services.support.adminConversations as RequestHandler,
    adminSupportMessagesByUser: services.support.adminMessagesByUser as RequestHandler,
    adminSupportReply: services.support.adminReply as RequestHandler,
    supportUploadMedia: services.support.uploadMyMedia as RequestHandler,
    adminSupportUploadMedia: services.support.uploadAdminMedia as RequestHandler,

    // admin
    adminLogin: services.auth.adminLogin as RequestHandler,
    adminMe: services.admin.adminMe as RequestHandler,
    adminUpdatePassword: services.admin.adminUpdatePassword as RequestHandler,
    adminUpdateUsername: services.admin.adminUpdateUsername as RequestHandler,
    adminOrders: services.admin.adminOrders as RequestHandler,
    adminUpdateOrderShipping: services.admin.adminUpdateOrderShipping as RequestHandler,
    adminProducts: services.product.adminProducts as RequestHandler,
    adminProductDetail: services.product.adminProductDetail as RequestHandler,
    adminCreateProduct: services.product.adminCreateProduct as RequestHandler,
    adminUpdateProduct: services.product.adminUpdateProduct as RequestHandler,
    adminUpdateProductStock: services.product.adminUpdateProductStock as RequestHandler,
    adminUploadImage: services.admin.adminUploadImage as RequestHandler,
  };
}
