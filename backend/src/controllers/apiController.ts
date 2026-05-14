import type { RequestHandler } from 'express';

export type Services = ReturnType<typeof import('../services/serviceRegistry').createServices>;

export function createApiController(services: Services) {
  return {
    // middlewares
    requireAuth: services.auth.requireAuth as RequestHandler,
    requireAdmin: services.auth.requireAdmin as RequestHandler,

    // public
    health: services.health.health as RequestHandler,
    appConfig: services.appConfig.appConfig as RequestHandler,
    categories: services.category.categories as RequestHandler,
    wechatLogin: services.auth.wechatLogin as RequestHandler,
    wechatOneClickLogin: services.auth.wechatOneClickLogin as RequestHandler,
    bindWechatPhone: services.auth.bindWechatPhone as RequestHandler,
    publicProducts: services.product.publicProducts as RequestHandler,
    publicProductReviews: services.product.publicProductReviews as RequestHandler,
    publicProductDetail: services.product.publicProductDetail as RequestHandler,
    publicPromotions: services.promotion.publicPromotions as RequestHandler,
    publicPromotionDetail: services.promotion.publicPromotionDetail as RequestHandler,
    /** 관리자 업로드 상품 이미지(DB BLOB) 조회 */
    serveProductImage: services.productMedia.serveProductImage as RequestHandler,
    serveUserAvatar: services.userAvatarMedia.serveUserAvatar as RequestHandler,

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
    createOrderReview: services.order.createOrderReview as RequestHandler,
    refundOrder: services.order.refundOrder as RequestHandler,
    commitOrder: services.order.commitOrder as RequestHandler,
    markOrderPaid: services.order.markOrderPaid as RequestHandler,
    cancelOrder: services.order.cancelOrder as RequestHandler,
    confirmOrderReceived: services.order.confirmOrderReceived as RequestHandler,
    deleteOrder: services.order.deleteOrder as RequestHandler,
    orderLogisticsTrace: services.order.orderLogisticsTrace as RequestHandler,
    pointsConfig: services.order.pointsConfig as RequestHandler,

    // support chat
    listMySupportMessages: services.support.listMyMessages as RequestHandler,
    createMySupportMessage: services.support.createMyMessage as RequestHandler,
    setMySupportTyping: services.support.setMyTyping as RequestHandler,
    getMySupportPeerTyping: services.support.getMyPeerTyping as RequestHandler,
    adminSupportConversations: services.support.adminConversations as RequestHandler,
    adminSupportMessagesByUser: services.support.adminMessagesByUser as RequestHandler,
    adminSupportReply: services.support.adminReply as RequestHandler,
    adminSetSupportTyping: services.support.setAdminTyping as RequestHandler,
    adminGetSupportPeerTyping: services.support.getAdminPeerTyping as RequestHandler,
    supportUploadMedia: services.support.uploadMyMedia as RequestHandler,
    adminSupportUploadMedia: services.support.uploadAdminMedia as RequestHandler,

    // coupons
    listMyCoupons: services.coupon.listMyCoupons as RequestHandler,
    getMyCouponDetail: services.coupon.getMyCouponDetail as RequestHandler,
    adminListCoupons: services.coupon.adminListCoupons as RequestHandler,
    adminCreateCoupon: services.coupon.adminCreateCoupon as RequestHandler,
    adminGrantCoupon: services.coupon.adminGrantCoupon as RequestHandler,
    adminUpdateCoupon: services.coupon.adminUpdateCoupon as RequestHandler,
    adminDeleteCoupon: services.coupon.adminDeleteCoupon as RequestHandler,
    adminPromotions: services.promotion.adminPromotions as RequestHandler,
    adminCreatePromotion: services.promotion.adminCreatePromotion as RequestHandler,
    adminUpdatePromotion: services.promotion.adminUpdatePromotion as RequestHandler,
    adminDeletePromotion: services.promotion.adminDeletePromotion as RequestHandler,

    // admin
    adminLogin: services.auth.adminLogin as RequestHandler,
    adminMe: services.admin.adminMe as RequestHandler,
    adminUpdatePassword: services.admin.adminUpdatePassword as RequestHandler,
    adminUpdateUsername: services.admin.adminUpdateUsername as RequestHandler,
    adminCreateAccount: services.admin.adminCreateAccount as RequestHandler,
    adminOrders: services.admin.adminOrders as RequestHandler,
    adminOrderLogisticsTrace: services.admin.adminOrderLogisticsTrace as RequestHandler,
    adminUpdateOrderShipping: services.admin.adminUpdateOrderShipping as RequestHandler,
    adminUpdateOrderStatus: services.admin.adminUpdateOrderStatus as RequestHandler,
    adminDeleteOrder: services.admin.adminDeleteOrder as RequestHandler,
    adminGetPointPolicy: services.admin.adminGetPointPolicy as RequestHandler,
    adminUpdatePointPolicy: services.admin.adminUpdatePointPolicy as RequestHandler,
    adminGetOrderVisibility: services.admin.adminGetOrderVisibility as RequestHandler,
    adminUpdateOrderVisibility: services.admin.adminUpdateOrderVisibility as RequestHandler,
    adminProducts: services.product.adminProducts as RequestHandler,
    adminProductDetail: services.product.adminProductDetail as RequestHandler,
    adminCreateProduct: services.product.adminCreateProduct as RequestHandler,
    adminUpdateProduct: services.product.adminUpdateProduct as RequestHandler,
    adminDeleteProduct: services.product.adminDeleteProduct as RequestHandler,
    adminUpdateProductStock: services.product.adminUpdateProductStock as RequestHandler,
    adminUploadImage: services.admin.adminUploadImage as RequestHandler,
    adminUploadImageMultipart: services.admin.adminUploadImageMultipart as RequestHandler,
    adminCreateUploadSignedUrl: services.admin.adminCreateUploadSignedUrl as RequestHandler,

    adminListCategories: services.category.adminListCategories as RequestHandler,
    adminCreateCategory: services.category.adminCreateCategory as RequestHandler,
    adminUpdateCategory: services.category.adminUpdateCategory as RequestHandler,
    adminDeleteCategory: services.category.adminDeleteCategory as RequestHandler,
  };
}
