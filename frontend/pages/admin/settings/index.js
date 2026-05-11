import { clearAdminSession } from '../../../services/admin/session';
import {
    fetchAdminMe,
    updateAdminPassword,
    updateAdminUsername,
    createAdminAccount,
} from '../../../services/admin/adminApi';
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
        createCurrentPassword: '',
        createUsername: '',
        createPassword: '',
    },
    onLoad() {
        this.loadData();
    },
    async loadData() {
        try {
            this.setData({ loading: true });
            const me = await fetchAdminMe();
            this.setData({
                me,
                newUsername: me?.username || '',
            });
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
            clearAdminSession();
            wx.reLaunch({ url: '/pages/admin/login/index' });
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
            clearAdminSession();
            wx.reLaunch({ url: '/pages/admin/login/index' });
        }
        catch (e) {
            showMessage(e?.message || '修改失败', 'error');
        }
        finally {
            this.setData({ submitting: false });
        }
    },
    async onCreateAdminAccount() {
        const { createCurrentPassword, createUsername, createPassword } = this.data;
        if (!createCurrentPassword || !createUsername || !createPassword)
            return showMessage('请填写当前密码、新管理员用户名和初始密码');
        try {
            this.setData({ submitting: true });
            const created = await createAdminAccount({
                currentPassword: createCurrentPassword,
                username: String(createUsername || '').trim(),
                password: createPassword,
            });
            this.setData({
                createCurrentPassword: '',
                createUsername: '',
                createPassword: '',
            });
            showMessage(`管理员创建成功: ${created?.username || ''}`, 'success');
        }
        catch (e) {
            showMessage(e?.message || '创建管理员失败', 'error');
        }
        finally {
            this.setData({ submitting: false });
        }
    },
});
