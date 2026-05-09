import { adminJson } from './client';

export type AdminMe = { id: number; username: string };
export type PointPolicy = { pointsEarnRatePercent: number; pointsUseThreshold: number };

export type ProductRow = {
  id: number;
  title: string;
  price: number;
  originPrice: number | null;
  stock: number;
  image: string;
  description: string;
  brand: string;
  company: string;
  soldNum: number;
  category: string;
  categoryId: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type CategoryRow = {
  id: number;
  name: string;
  sortOrder: number;
  thumbnail: string | null;
  createdAt: string;
};

export type OrderRow = {
  id: number;
  orderNo: string;
  userId: number;
  totalAmount: number;
  paymentAmount: number;
  refundAmount: number;
  refundStatus: string | null;
  orderStatus: number;
  orderStatusName: string;
  items: unknown[];
  address: Record<string, unknown>;
  createdAt: string;
  logisticsCompanyCode: string;
  logisticsCompanyName: string;
  logisticsNo: string;
  logisticsRemark: string;
  shippedAt: string | null;
  nickName: string | null;
  phoneNumber: string | null;
};

export function loginAdmin(body: { username: string; password: string }) {
  return adminJson<{ token: string; admin: AdminMe }>('/api/admin/login', {
    method: 'POST',
    body,
  });
}

export function fetchAdminMe(token: string) {
  return adminJson<AdminMe>('/api/admin/me', { token });
}

export function updateAdminPassword(
  token: string,
  body: { currentPassword: string; newPassword: string },
) {
  return adminJson<{ ok: true }>('/api/admin/me/password', {
    method: 'PUT',
    token,
    body,
  });
}

export function updateAdminUsername(
  token: string,
  body: { currentPassword: string; newUsername: string },
) {
  return adminJson<AdminMe>('/api/admin/me/username', {
    method: 'PUT',
    token,
    body,
  });
}

export function fetchPointPolicy(token: string) {
  return adminJson<PointPolicy>('/api/admin/point-policy', { token });
}

export function updatePointPolicy(token: string, body: PointPolicy) {
  return adminJson<PointPolicy>('/api/admin/point-policy', {
    method: 'PUT',
    token,
    body,
  });
}

export type AdminOrderVisibility = {
  hiddenOrderNos: string[];
};

export function fetchAdminOrderVisibility(token: string) {
  return adminJson<AdminOrderVisibility>('/api/admin/order-visibility', { token });
}

export function updateAdminOrderVisibility(token: string, body: AdminOrderVisibility) {
  return adminJson<AdminOrderVisibility>('/api/admin/order-visibility', {
    method: 'PUT',
    token,
    body,
  });
}

export function fetchProducts(token: string) {
  return adminJson<ProductRow[]>('/api/admin/products', { token });
}

export function fetchProduct(token: string, id: number) {
  return adminJson<ProductRow>(`/api/admin/products/${id}`, { token });
}

export function updateProductStock(token: string, id: number, stock: number) {
  return adminJson<ProductRow>(`/api/admin/products/${id}/stock`, {
    method: 'PUT',
    token,
    body: { stock },
  });
}

export type ProductPayload = {
  title: string;
  price: number;
  originPrice?: number | null;
  stock: number;
  image?: string;
  description?: string;
  brand?: string;
  company?: string;
  category?: string;
  status?: 'ON' | 'OFF';
};

export function createProduct(token: string, payload: ProductPayload) {
  return adminJson<ProductRow>('/api/admin/products', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateProduct(token: string, id: number, payload: ProductPayload) {
  return adminJson<ProductRow>(`/api/admin/products/${id}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export function deleteProduct(token: string, id: number) {
  return adminJson<{ deleted: boolean }>(`/api/admin/products/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function uploadAdminImage(
  token: string,
  file: { fileName: string; mimeType: string; base64Data: string },
) {
  return adminJson<{ imageUrl: string }>('/api/admin/upload-image', {
    method: 'POST',
    token,
    body: file,
    timeoutMs: 120_000,
  });
}

export function fetchOrders(token: string) {
  return adminJson<OrderRow[]>('/api/admin/orders', { token });
}

export function updateShipping(
  token: string,
  orderNo: string,
  body: {
    logisticsCompanyCode?: string;
    logisticsCompanyName: string;
    logisticsNo: string;
    logisticsRemark?: string;
  },
) {
  return adminJson<unknown>(`/api/admin/orders/${encodeURIComponent(orderNo)}/shipping`, {
    method: 'POST',
    token,
    body,
  });
}

export function updateOrderStatus(
  token: string,
  orderNo: string,
  body: { orderStatus: number; orderStatusName?: string },
) {
  return adminJson<unknown>(`/api/admin/orders/${encodeURIComponent(orderNo)}/status`, {
    method: 'PUT',
    token,
    body,
  });
}

export function deleteAdminOrder(token: string, orderNo: string) {
  return adminJson<{ ok: true }>(`/api/admin/orders/${encodeURIComponent(orderNo)}`, {
    method: 'DELETE',
    token,
  });
}

export function fetchCategories(token: string) {
  return adminJson<CategoryRow[]>('/api/admin/categories', { token });
}

export function createCategory(
  token: string,
  body: { name: string; thumbnail?: string; sortOrder?: number },
) {
  return adminJson<CategoryRow>('/api/admin/categories', {
    method: 'POST',
    token,
    body,
  });
}

export function updateCategory(
  token: string,
  id: number,
  body: { name?: string; thumbnail?: string | null; sortOrder?: number },
) {
  return adminJson<CategoryRow>(`/api/admin/categories/${id}`, {
    method: 'PUT',
    token,
    body,
  });
}

export function deleteCategory(token: string, id: number) {
  return adminJson<unknown>(`/api/admin/categories/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function fetchLogisticsTrace(token: string, orderNo: string) {
  return adminJson<unknown>(
    `/api/admin/orders/${encodeURIComponent(orderNo)}/logistics-trace`,
    { token },
  );
}

// —— 客服（与小程序管理端同源 API / DB）——

export type SupportConversationRow = {
  userId: number;
  nickName: string | null;
  avatarUrl: string | null;
  lastMessageId: number;
  unreadCount: number;
};

export type SupportMessageRow = {
  id: number;
  userId: number;
  fromRole: 'user' | 'admin';
  msgType?: string;
  content: string;
  meta?: { durationMs?: number; orderNo?: string } | null;
  adminRead: number;
  userRead: number;
  createdAt: string;
};

export function fetchSupportConversations(token: string) {
  return adminJson<SupportConversationRow[]>('/api/admin/support/conversations', {
    token,
    timeoutMs: 15000,
  });
}

export function fetchSupportMessages(token: string, userId: number) {
  return adminJson<SupportMessageRow[]>(`/api/admin/support/messages/${userId}`, {
    token,
    timeoutMs: 15000,
  });
}

export function postSupportReply(
  token: string,
  userId: number,
  body: {
    msgType?: 'text' | 'image' | 'voice';
    content: string;
    meta?: { durationMs?: number; orderNo?: string };
  },
) {
  return adminJson<SupportMessageRow>(`/api/admin/support/messages/${userId}`, {
    method: 'POST',
    token,
    body,
    timeoutMs: 30000,
  });
}

export function uploadAdminSupportMedia(
  token: string,
  payload: {
    kind: 'image' | 'voice';
    fileName?: string;
    mimeType?: string;
    base64Data: string;
  },
) {
  return adminJson<{ url: string }>('/api/admin/support/upload-media', {
    method: 'POST',
    token,
    body: payload,
    timeoutMs: 120000,
  });
}

export function fetchSupportPeerTyping(token: string, userId: number) {
  return adminJson<{ peerTyping: boolean }>(`/api/admin/support/typing/${userId}`, {
    token,
    timeoutMs: 8000,
  });
}

export function updateSupportTyping(token: string, userId: number, typing: boolean) {
  return adminJson<{ typing: boolean }>(`/api/admin/support/typing/${userId}`, {
    method: 'POST',
    token,
    body: { typing },
    timeoutMs: 8000,
  });
}

export type AdminCouponRow = {
  id: number;
  name: string;
  type: 1 | 2;
  value: number;
  base: number;
  status: 'enabled' | 'disabled';
  startTime: number;
  endTime: number;
  totalCount: number;
  issuedCount: number;
};

export function fetchAdminCoupons(token: string) {
  return adminJson<AdminCouponRow[]>('/api/admin/coupons', { token });
}

export function createAdminCoupon(
  token: string,
  body: {
    name: string;
    type: 1 | 2;
    value: number;
    base?: number;
    startTime: number;
    endTime: number;
    totalCount?: number;
  },
) {
  return adminJson<AdminCouponRow>('/api/admin/coupons', { method: 'POST', token, body });
}

export function updateAdminCoupon(
  token: string,
  couponId: number,
  body: Partial<{
    name: string;
    type: 1 | 2;
    value: number;
    base: number;
    startTime: number;
    endTime: number;
    totalCount: number;
    status: 'enabled' | 'disabled';
  }>,
) {
  return adminJson<AdminCouponRow>(`/api/admin/coupons/${couponId}`, {
    method: 'PUT',
    token,
    body,
  });
}

export function deleteAdminCoupon(token: string, couponId: number) {
  return adminJson<{ ok: true }>(`/api/admin/coupons/${couponId}`, {
    method: 'DELETE',
    token,
  });
}

export function grantAdminCoupon(
  token: string,
  couponId: number,
  body: { userIds?: number[]; grantAllUsers?: boolean } = { grantAllUsers: true },
) {
  return adminJson<{ grantedCount: number; requestedUsers: number }>(
    `/api/admin/coupons/${couponId}/grant`,
    { method: 'POST', token, body },
  );
}
