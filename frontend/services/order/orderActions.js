import { requestJson } from '../_utils/http';

export function cancelOrder(orderNo) {
  return requestJson(`/api/orders/${encodeURIComponent(orderNo)}/cancel`, { method: 'POST' });
}

export function confirmOrder(orderNo) {
  return requestJson(`/api/orders/${encodeURIComponent(orderNo)}/confirm`, { method: 'POST' });
}

export function deleteOrder(orderNo) {
  return requestJson(`/api/orders/${encodeURIComponent(orderNo)}`, { method: 'DELETE' });
}

export function payOrder(orderNo) {
  return requestJson(`/api/orders/${encodeURIComponent(orderNo)}/paid`, { method: 'POST' });
}

export function fetchOrderLogisticsTrace(orderNo) {
  return requestJson(`/api/orders/${encodeURIComponent(orderNo)}/logistics-trace`, { method: 'GET', timeoutMs: 25000 });
}
