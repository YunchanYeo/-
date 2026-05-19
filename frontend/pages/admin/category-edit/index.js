import {
    fetchAdminCategories,
    createAdminCategory,
    updateAdminCategory,
    uploadAdminImage,
} from '../../../services/admin/adminApi';
import { resolveAdminImageForDisplay, toStoredProductImagePath } from '../../../services/admin/adminImageUrl';
import { bumpProductDataVersion } from '../../../services/good/productVersion';
import { getDefaultCategoryThumb } from '../../../services/home/home';

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
        displayIconUrl: getDefaultCategoryThumb(''),
        hasCustomThumb: false,
    },
    onLoad(query) {
        const id = query?.id ? String(query.id) : '';
        this.setData({ isEdit: !!id });
        if (id) {
            void this.loadCategory(id);
        }
        else {
            this.setData({
                loading: false,
                displayIconUrl: getDefaultCategoryThumb(''),
                hasCustomThumb: false,
            });
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
            const hasCustom = !!String(row.thumbnail || '').trim();
            const name = row.name || '';
            this.setData({
                form: {
                    id: String(row.id),
                    name,
                    thumbnail: hasCustom ? resolveAdminImageForDisplay(row.thumbnail) : '',
                    sortOrder: String(row.sortOrder ?? 0),
                },
                hasCustomThumb: hasCustom,
                displayIconUrl: hasCustom
                    ? resolveAdminImageForDisplay(row.thumbnail)
                    : getDefaultCategoryThumb(name),
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
        const value = e.detail.value;
        const patch = { [`form.${key}`]: value };
        if (key === 'name' && !this.data.hasCustomThumb) {
            patch.displayIconUrl = getDefaultCategoryThumb(String(value || '').trim() || '分类');
        }
        this.setData(patch);
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
            const storedPath = toStoredProductImagePath(uploadRes.imageUrl);
            const displayUrl = resolveAdminImageForDisplay(storedPath || uploadRes.imageUrl);
            this.setData({
                'form.thumbnail': displayUrl,
                displayIconUrl: displayUrl,
                hasCustomThumb: true,
            });
            if (this.data.isEdit && this.data.form.id) {
                await updateAdminCategory(this.data.form.id, {
                    thumbnail: storedPath || null,
                });
                bumpProductDataVersion();
                showMessage('图标已保存到服务器', 'success');
            }
            else {
                showMessage('图片上传成功，请点击保存', 'success');
            }
        }
        catch (e) {
            showMessage(e?.errMsg || e?.message || '上传失败', 'error');
        }
    },
    async onClearImage() {
        const name = String(this.data.form.name || '').trim() || '分类';
        const defaultThumb = getDefaultCategoryThumb(name);
        this.setData({
            'form.thumbnail': '',
            displayIconUrl: defaultThumb,
            hasCustomThumb: false,
        });
        if (this.data.isEdit && this.data.form.id) {
            try {
                await updateAdminCategory(this.data.form.id, { thumbnail: null });
                bumpProductDataVersion();
                showMessage('已恢复默认图标', 'success');
            }
            catch (e) {
                showMessage(e?.message || '恢复失败', 'error');
            }
        }
        else {
            showMessage('将使用默认图标', 'none');
        }
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
