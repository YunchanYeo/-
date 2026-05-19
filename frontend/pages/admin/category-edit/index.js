import {
    fetchAdminCategories,
    createAdminCategory,
    updateAdminCategory,
    uploadAdminImage,
} from '../../../services/admin/adminApi';
import { resolveAdminImageForDisplay, toStoredProductImagePath } from '../../../services/admin/adminImageUrl';
import { bumpProductDataVersion } from '../../../services/good/productVersion';

function showMessage(message, theme = 'none') {
    const icon = theme === 'success' ? 'success' : theme === 'error' ? 'error' : 'none';
    wx.showToast({ title: message || '', icon, duration: 1500 });
}

Page({
    data: {
        loading: true,
        submitting: false,
        isEdit: false,
        form: {
            id: '',
            name: '',
            thumbnail: '',
            sortOrder: '',
        },
    },
    onLoad(query) {
        const id = query?.id ? String(query.id) : '';
        this.setData({ isEdit: !!id });
        if (id) {
            void this.loadCategory(id);
        }
        else {
            this.setData({ loading: false });
        }
    },
    async loadCategory(id) {
        try {
            this.setData({ loading: true });
            const rows = await fetchAdminCategories();
            const row = (Array.isArray(rows) ? rows : []).find((r) => String(r?.id) === String(id));
            if (!row) {
                showMessage('分类不存在', 'error');
                wx.navigateBack();
                return;
            }
            this.setData({
                form: {
                    id: String(row.id),
                    name: row.name || '',
                    thumbnail: resolveAdminImageForDisplay(row.thumbnail || ''),
                    sortOrder: String(row.sortOrder ?? 0),
                },
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
        this.setData({ [`form.${key}`]: e.detail.value });
    },
    async onPickImage() {
        const action = await new Promise((resolve) => {
            wx.showActionSheet({
                itemList: ['拍照', '从相册选择'],
                success: (res) => resolve(res.tapIndex),
                fail: () => resolve(-1),
            });
        });
        if (action < 0)
            return;
        const sourceType = action === 0 ? ['camera'] : ['album'];
        try {
            const mediaRes = await new Promise((resolve, reject) => {
                wx.chooseMedia({
                    count: 1,
                    mediaType: ['image'],
                    sourceType,
                    sizeType: ['compressed'],
                    success: resolve,
                    fail: reject,
                });
            });
            const file = mediaRes?.tempFiles?.[0];
            const tempFilePath = file?.tempFilePath;
            if (!tempFilePath)
                throw new Error('图片选择失败');
            const base64Data = await new Promise((resolve, reject) => {
                wx.getFileSystemManager().readFile({
                    filePath: tempFilePath,
                    encoding: 'base64',
                    success: (res) => resolve(res.data),
                    fail: reject,
                });
            });
            const uploadRes = await uploadAdminImage({
                fileName: file?.fileType ? `image.${file.fileType}` : 'image.jpg',
                mimeType: file?.type ? `image/${file.type}` : 'image/jpeg',
                base64Data,
            });
            this.setData({ 'form.thumbnail': resolveAdminImageForDisplay(uploadRes.imageUrl) });
            showMessage('图标上传成功', 'success');
        }
        catch (e) {
            showMessage(e?.errMsg || e?.message || '上传失败', 'error');
        }
    },
    onClearImage() {
        this.setData({ 'form.thumbnail': '' });
    },
    async onSubmit() {
        const f = this.data.form;
        const name = String(f.name || '').trim();
        if (!name) {
            showMessage('请输入分类名称');
            return;
        }
        const sortOrderRaw = String(f.sortOrder ?? '').trim();
        const sortOrder = sortOrderRaw === '' ? undefined : Math.floor(Number(sortOrderRaw));
        if (sortOrderRaw !== '' && !Number.isFinite(sortOrder)) {
            showMessage('排序请输入数字');
            return;
        }
        const thumbnail = f.thumbnail ? toStoredProductImagePath(f.thumbnail) : null;
        try {
            this.setData({ submitting: true });
            if (this.data.isEdit && f.id) {
                await updateAdminCategory(f.id, {
                    name,
                    thumbnail,
                    ...(sortOrder !== undefined ? { sortOrder } : {}),
                });
            }
            else {
                await createAdminCategory({
                    name,
                    thumbnail: thumbnail || undefined,
                    ...(sortOrder !== undefined ? { sortOrder } : {}),
                });
            }
            bumpProductDataVersion();
            showMessage('已保存', 'success');
            setTimeout(() => wx.navigateBack(), 500);
        }
        catch (e) {
            showMessage(e?.message || '保存失败', 'error');
        }
        finally {
            this.setData({ submitting: false });
        }
    },
});
