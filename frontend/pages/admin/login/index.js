import { adminLogin } from '../../../services/admin/session';
function showMessage(message, theme = 'none') {
    const icon = theme === 'success' ? 'success' : theme === 'error' ? 'error' : 'none';
    wx.showToast({
        title: message || '',
        icon,
        duration: 1500,
    });
}
Page({
    data: {
        username: '',
        password: '',
        passwordVisible: false,
        submitting: false,
    },
    onInput(e) {
        const { key } = e.currentTarget.dataset;
        this.setData({ [key]: e.detail.value });
    },
    togglePasswordVisible() {
        this.setData({
            passwordVisible: !this.data.passwordVisible,
        });
    },
    async onSubmit() {
        const { username, password } = this.data;
        if (!username || !password) {
            showMessage('请输入账号和密码');
            return;
        }
        try {
            this.setData({ submitting: true });
            await adminLogin(username, password);
            showMessage('管理员登录成功', 'success');
            setTimeout(() => {
                wx.redirectTo({ url: '/pages/admin/dashboard/index' });
            }, 300);
        }
        catch (e) {
            const message = e?.message || '登录失败';
            if (message.includes('账号或密码错误') || message.includes('用户名或密码错误') || message.includes('Invalid credentials')) {
                this.setData({
                    username: '',
                    password: '',
                });
            }
            showMessage(message, 'error');
        }
        finally {
            this.setData({ submitting: false });
        }
    },
});
