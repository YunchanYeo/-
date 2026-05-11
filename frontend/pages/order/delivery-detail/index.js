"use strict";
import { fetchOrderLogisticsTrace } from '../services/orderActions';

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
    },
    onLoad(query) {
        let data;
        try {
            data = JSON.parse(decodeURIComponent(query.data || '{}'));
        }
        catch (e) {
            console.warn('物流节点数据解析失败', e);
            data = {};
        }
        const orderNo = String(data?.orderNo || '').trim();
        this.setData({
            orderNo,
            logisticsCompanyName: data?.company || data?.logisticsCompanyName || '',
            logisticsNo: data?.logisticsNo || '',
        });
        if (orderNo) {
            this.loadTrace();
            return;
        }
        // 兼容旧数据：没有 orderNo 时显示传入节点
        const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
        const traces = nodes.map((n) => ({
            time: n.date || '',
            context: n.desc || n.title || '',
            areaName: '',
        }));
        const latest = traces[0] || null;
        this.setData({
            loading: false,
            configured: false,
            hint: '当前订单缺少 orderNo，暂时无法拉取地图轨迹。',
            traces,
            latestTraceText: latest?.context || '',
            latestTraceTime: latest?.time || '',
            statusText: latest?.context ? '运输中' : '暂无状态',
        });
    },
    async loadTrace() {
        const orderNo = this.data.orderNo;
        if (!orderNo)
            return;
        this.setData({ loading: true, error: '' });
        try {
            const d = await fetchOrderLogisticsTrace(orderNo);
            const pts = Array.isArray(d.polylinePoints) ? d.polylinePoints : [];
            let lat = 35.0;
            let lng = 105.0;
            let scale = 5;
            let polyline = [];
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
                }
                else {
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
                logisticsCompanyName: d.logisticsCompanyName || this.data.logisticsCompanyName || '',
                logisticsNo: d.logisticsNo || this.data.logisticsNo || '',
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
        }
        catch (e) {
            this.setData({
                loading: false,
                error: e?.message || '加载失败',
            });
        }
    },
    onLogisticsNoCopy() {
        wx.setClipboardData({ data: this.data.logisticsNo });
    },
});
