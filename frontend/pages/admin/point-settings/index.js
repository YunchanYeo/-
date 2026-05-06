import { fetchAdminPointPolicy, updateAdminPointPolicy } from '../../../services/admin/adminApi';

function showMessage(message, theme = 'none') {
  const icon = theme === 'success' ? 'success' : theme === 'error' ? 'error' : 'none';
  wx.showToast({ title: message || '', icon, duration: 1600 });
}

Page({
  data: {
    loading: true,
    submitting: false,
    pointsEarnRatePercent: '1',
    pointsUseThreshold: '1000',
  },

  onLoad() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const policy = await fetchAdminPointPolicy();
      this.setData({
        pointsEarnRatePercent: String(policy?.pointsEarnRatePercent ?? 1),
        pointsUseThreshold: String(policy?.pointsUseThreshold ?? 1000),
      });
    } catch (e) {
      showMessage(e?.message || '加载失败', 'error');
      wx.navigateBack();
    } finally {
      this.setData({ loading: false });
    }
  },

  onInput(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({ [key]: e.detail.value });
  },

  async onSavePointPolicy() {
    const pointsEarnRatePercent = Number(this.data.pointsEarnRatePercent);
    const pointsUseThreshold = Math.floor(Number(this.data.pointsUseThreshold));
    if (!Number.isFinite(pointsEarnRatePercent) || pointsEarnRatePercent < 0 || pointsEarnRatePercent > 100) {
      return showMessage('积分比例请填写 0~100 的数字');
    }
    if (!Number.isFinite(pointsUseThreshold) || pointsUseThreshold < 0) {
      return showMessage('积分门槛需为非负整数');
    }
    this.setData({ submitting: true });
    try {
      const next = await updateAdminPointPolicy({ pointsEarnRatePercent, pointsUseThreshold });
      this.setData({
        pointsEarnRatePercent: String(next?.pointsEarnRatePercent ?? pointsEarnRatePercent),
        pointsUseThreshold: String(next?.pointsUseThreshold ?? pointsUseThreshold),
      });
      showMessage('积分规则已保存', 'success');
    } catch (e) {
      showMessage(e?.message || '保存失败', 'error');
    } finally {
      this.setData({ submitting: false });
    }
  },
});
