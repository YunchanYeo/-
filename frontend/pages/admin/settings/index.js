import { clearAdminSession } from '../../../services/admin/session';
import { fetchAdminMe, updateAdminPassword, updateAdminUsername } from '../../../services/admin/adminApi';
function showMessage(message, theme = 'none') {
    const icon = theme === 'success' ? 'success' : theme === 'error' ? 'error' : 'none';
    wx.showToast({ title: message || '', icon, duration: 1600 });
}
Page({
    data: {
        loading: true,
        submitting: false,
        me: null,
        currentPassword: '',
        newPassword: '',
        newUsername: '',
    },
    onLoad() {
        this.loadMe();
    },
    async loadMe() {
        try {
            this.setData({ loading: true });
            const me = await fetchAdminMe();
            this.setData({ me, newUsername: me?.username || '' });
        }
        catch (e) {
            showMessage(e?.message || '加载失败', 'error');
            wx.navigateBack();
        }
        finally {
            this.setData({ loading: false });
        }
    },
    onInput(e) {
        const { key } = e.currentTarget.dataset;
        this.setData({ [key]: e.detail.value });
    },
    async onChangePassword() {
        const { currentPassword, newPassword } = this.data;
        if (!currentPassword || !newPassword)
            return showMessage('请输入当前密码和新密码');
        try {
            this.setData({ submitting: true });
            await updateAdminPassword({ currentPassword, newPassword });
            showMessage('密码已更新，请重新登录', 'success');
            clearAdminSession();
            setTimeout(() => wx.reLaunch({ url: '/pages/admin/login/index' }), 600);
        }
        catch (e) {
            showMessage(e?.message || '修改失败', 'error');
        }
        finally {
            this.setData({ submitting: false });
        }
    },
    async onChangeUsername() {
        const { currentPassword, newUsername } = this.data;
        if (!currentPassword || !newUsername)
            return showMessage('请输入当前密码和新ID');
        try {
            this.setData({ submitting: true });
            await updateAdminUsername({ currentPassword, newUsername: newUsername.trim() });
            showMessage('ID已更新，请重新登录', 'success');
            clearAdminSession();
            setTimeout(() => wx.reLaunch({ url: '/pages/admin/login/index' }), 600);
        }
        catch (e) {
            showMessage(e?.message || '修改失败', 'error');
        }
        finally {
            this.setData({ submitting: false });
        }
    },
});
