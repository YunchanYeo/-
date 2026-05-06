import { fetchUserCenter } from '../../../services/usercenter/fetchUsercenter';

Page({
  data: {
    points: 0,
  },

  onShow() {
    this.load();
  },

  async load() {
    try {
      const res = await fetchUserCenter();
      const counts = Array.isArray(res?.countsData) ? res.countsData : [];
      const pointItem = counts.find((x) => x.type === 'point');
      this.setData({ points: Number(pointItem?.num || 0) });
    } catch (_) {
      this.setData({ points: 0 });
    }
  },
});
