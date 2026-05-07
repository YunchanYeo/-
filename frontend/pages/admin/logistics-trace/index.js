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
    markers: [],
    showMap: false,
    latestTraceText: '',
    latestTraceTime: '',
    statusText: '暂无状态',
    setupSteps: [
      '1. 在 backend/.env 中填写 KUAIDI100_KEY 与 KUAIDI100_CUSTOMER',
      '2. 保存后重启后端服务：cd backend && npm run dev',
      '3. 回到本页点击右上角返回后重新进入查看',
    ],
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
      /** @type {Array<{ id: number; latitude: number; longitude: number; width: number; height: number; callout?: any }>} */
      let markers = [];
      const showMap = !!d.configured && pts.length > 0;
      const traces = Array.isArray(d.traces) ? d.traces : [];
      const latest = traces[0] || null;

      if (pts.length > 0) {
        lat = pts.reduce((s, p) => s + p.latitude, 0) / pts.length;
        lng = pts.reduce((s, p) => s + p.longitude, 0) / pts.length;
        if (pts.length >= 2) {
          polyline = [{ points: pts, color: '#07c160', width: 5, arrowLine: true }];
          markers = [
            {
              id: 1,
              latitude: pts[0].latitude,
              longitude: pts[0].longitude,
              width: 22,
              height: 22,
              callout: {
                content: '起点',
                display: 'ALWAYS',
                bgColor: '#ffffff',
                borderRadius: 8,
                padding: 6,
                color: '#666666',
                fontSize: 12,
              },
            },
            {
              id: 2,
              latitude: pts[pts.length - 1].latitude,
              longitude: pts[pts.length - 1].longitude,
              width: 26,
              height: 26,
              callout: {
                content: '当前位置',
                display: 'ALWAYS',
                bgColor: '#07c160',
                borderRadius: 10,
                padding: 8,
                color: '#ffffff',
                fontSize: 12,
              },
            },
          ];
        } else {
          scale = 11;
          markers = [
            {
              id: 1,
              latitude: pts[0].latitude,
              longitude: pts[0].longitude,
              width: 26,
              height: 26,
              callout: {
                content: '当前位置',
                display: 'ALWAYS',
                bgColor: '#07c160',
                borderRadius: 10,
                padding: 8,
                color: '#ffffff',
                fontSize: 12,
              },
            },
          ];
        }
      }

      this.setData({
        loading: false,
        configured: !!d.configured,
        hint: d.hint || '',
        logisticsCompanyName: d.logisticsCompanyName || '',
        logisticsNo: d.logisticsNo || '',
        traces,
        lat,
        lng,
        scale,
        polyline,
        markers,
        showMap,
        latestTraceText: latest?.context || '',
        latestTraceTime: latest?.time || '',
        statusText: latest?.context ? '运输中' : '暂无状态',
      });
    } catch (e) {
      this.setData({
        loading: false,
        error: e?.message || '加载失败',
      });
    }
  },

  onCopyNo() {
    const text = this.data.logisticsNo || '';
    if (!text) return;
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制单号', icon: 'success' }),
    });
  },
});
