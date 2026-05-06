import { fetchAdminLogisticsTrace } from '../../../services/admin/adminApi';

Page({
  data: {
    loading: true,
    error: '',
    orderNo: '',
    configured: false,
    hint: '',
    logisticsCompanyName: '',
    logisticsNo: '',
    traces: [],
    lat: 35.0,
    lng: 105.0,
    scale: 5,
    polyline: [],
    showMap: false,
  },

  onLoad(query) {
    const raw = query.orderNo ? decodeURIComponent(query.orderNo) : '';
    if (!raw) {
      this.setData({ loading: false, error: '缺少订单号' });
      return;
    }
    this.setData({ orderNo: raw });
    this.loadTrace();
  },

  async loadTrace() {
    const orderNo = this.data.orderNo;
    if (!orderNo) return;
    this.setData({ loading: true, error: '' });
    try {
      const d = await fetchAdminLogisticsTrace(orderNo);
      const pts = Array.isArray(d.polylinePoints) ? d.polylinePoints : [];
      let lat = 35.0;
      let lng = 105.0;
      let scale = 5;
      /** @type {Array<{ points: Array<{ latitude: number; longitude: number }>; color: string; width: number; arrowLine?: boolean }>} */
      let polyline = [];
      const showMap = !!d.configured && pts.length > 0;

      if (pts.length > 0) {
        lat = pts.reduce((s, p) => s + p.latitude, 0) / pts.length;
        lng = pts.reduce((s, p) => s + p.longitude, 0) / pts.length;
        if (pts.length >= 2) {
          polyline = [{ points: pts, color: '#07c160', width: 5, arrowLine: true }];
        } else {
          scale = 11;
        }
      }

      this.setData({
        loading: false,
        configured: !!d.configured,
        hint: d.hint || '',
        logisticsCompanyName: d.logisticsCompanyName || '',
        logisticsNo: d.logisticsNo || '',
        traces: Array.isArray(d.traces) ? d.traces : [],
        lat,
        lng,
        scale,
        polyline,
        showMap,
      });
    } catch (e) {
      this.setData({
        loading: false,
        error: e?.message || '加载失败',
      });
    }
  },
});
