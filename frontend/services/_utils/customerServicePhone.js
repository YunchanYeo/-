import { config } from '../../config/index';
import { requestJson } from './http';

/** 优先使用后端 CUSTOMER_SERVICE_PHONE（/api/app-config），失败或未配置时用 config.customerServicePhone 兜底 */
export function fetchCustomerServicePhone() {
    return requestJson('/api/app-config', { method: 'GET' })
        .then((d) => {
            const p = String(d?.customerServicePhone || '').trim();
            return p || config.customerServicePhone;
        })
        .catch(() => config.customerServicePhone);
}
