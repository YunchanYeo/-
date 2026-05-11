import { clearAdminSession } from '../../../services/admin/session';
import {
    fetchAdminMe,
    updateAdminPassword,
    updateAdminUsername,
    createAdminAccount,
    fetchAdminPromotions,
    createAdminPromotion,
    updateAdminPromotion,
    deleteAdminPromotion,
    uploadAdminImage,
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
        promotions: [],
        promotionForm: {
            id: '',
            title: '',
            imageUrl: '',
            description: '',
            relatedProductId: '',
            status: 'ON',
            sortOrder: 0,
        },
    },
    onLoad() {
        this.loadData();
    },
    async loadData() {
        try {
            this.setData({ loading: true });
            const me = await fetchAdminMe();
            const promotions = await fetchAdminPromotions().catch(() => []);
            this.setData({
                me,
                newUsername: me?.username || '',
                promotions: Array.isArray(promotions) ? promotions : [],
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
    onPromotionFieldInput(e) {
        const { key } = e.currentTarget.dataset;
        this.setData({ [`promotionForm.${key}`]: e.detail.value });
    },
    async onPickPromotionImage() {
        try {
            const filePath = await new Promise((resolve, reject) => {
                wx.chooseImage({
                    count: 1,
                    sizeType: ['compressed'],
                    sourceType: ['album', 'camera'],
                    success: (res) => resolve(res.tempFilePaths?.[0]),
                    fail: reject,
                });
            });
            if (!filePath)
                return;
            const base64Data = await new Promise((resolve, reject) => {
                wx.getFileSystemManager().readFile({
                    filePath,
                    encoding: 'base64',
                    success: (r) => resolve(r.data),
                    fail: reject,
                });
            });
            const uploaded = await uploadAdminImage({
                fileName: `promotion_${Date.now()}.jpg`,
                mimeType: 'image/jpeg',
                base64Data: String(base64Data || ''),
            });
            this.setData({ 'promotionForm.imageUrl': uploaded?.imageUrl || '' });
            showMessage('活动图片已上传', 'success');
        }
        catch (e) {
            showMessage(e?.message || '上传活动图片失败', 'error');
        }
    },
    async onSavePromotion() {
        const form = this.data.promotionForm || {};
        const title = String(form.title || '').trim();
        const imageUrl = String(form.imageUrl || '').trim();
        if (!title || !imageUrl)
            return showMessage('请填写活动标题并上传活动图片');
        try {
            this.setData({ submitting: true });
            const payload = {
                title,
                imageUrl,
                description: String(form.description || ''),
                relatedProductId: form.relatedProductId ? Number(form.relatedProductId) : null,
                status: String(form.status || 'ON') === 'OFF' ? 'OFF' : 'ON',
                sortOrder: Number(form.sortOrder || 0),
            };
            if (form.id) {
                await updateAdminPromotion(form.id, payload);
            } else {
                await createAdminPromotion(payload);
            }
            const promotions = await fetchAdminPromotions();
            this.setData({
                promotions: Array.isArray(promotions) ? promotions : [],
                promotionForm: {
                    id: '',
                    title: '',
                    imageUrl: '',
                    description: '',
                    relatedProductId: '',
                    status: 'ON',
                    sortOrder: 0,
                },
            });
            showMessage('活动已保存', 'success');
        }
        catch (e) {
            showMessage(e?.message || '活动保存失败', 'error');
        }
        finally {
            this.setData({ submitting: false });
        }
    },
    onEditPromotion(e) {
        const idx = Number(e.currentTarget.dataset.index);
        const row = (this.data.promotions || [])[idx];
        if (!row)
            return;
        this.setData({
            promotionForm: {
                id: String(row.id || ''),
                title: String(row.title || ''),
                imageUrl: String(row.imageUrl || ''),
                description: String(row.description || ''),
                relatedProductId: row.relatedProductId ? String(row.relatedProductId) : '',
                status: String(row.status || 'ON'),
                sortOrder: Number(row.sortOrder || 0),
            },
        });
    },
    async onDeletePromotion(e) {
        const idx = Number(e.currentTarget.dataset.index);
        const row = (this.data.promotions || [])[idx];
        if (!row)
            return;
        const ok = await new Promise((resolve) => {
            wx.showModal({
                title: '删除活动',
                content: `确认删除「${row.title || ''}」吗？`,
                success: (r) => resolve(!!r.confirm),
                fail: () => resolve(false),
            });
        });
        if (!ok)
            return;
        try {
            await deleteAdminPromotion(row.id);
            const promotions = await fetchAdminPromotions();
            this.setData({ promotions: Array.isArray(promotions) ? promotions : [] });
            showMessage('活动已删除', 'success');
        }
        catch (e) {
            showMessage(e?.message || '删除活动失败', 'error');
        }
    },
});
