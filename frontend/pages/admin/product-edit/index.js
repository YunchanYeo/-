import { config } from '../../../config/index';
import { fetchAdminProduct, updateAdminProduct, uploadAdminImage } from '../../../services/admin/adminApi';
import { bumpProductDataVersion } from '../../../services/good/productVersion';
function showMessage(message, theme = 'none') {
    const icon = theme === 'success' ? 'success' : theme === 'error' ? 'error' : 'none';
    wx.showToast({ title: message || '', icon, duration: 1500 });
}
Page({
    data: {
        loading: true,
        submitting: false,
        categoriesTree: [],
        form: {
            id: '',
            title: '',
            price: '',
            originPrice: '',
            stock: '',
            category: '',
            image: '',
            brand: '',
            company: '',
            description: '',
            status: 'ON',
        },
    },
    onLoad(query) {
        const id = query?.id;
        if (!id) {
            showMessage('缺少商品ID', 'error');
            wx.navigateBack();
            return;
        }
        this.loadCategories();
        this.loadProduct(id);
    },
    loadCategories() {
        wx.request({
            url: `${config.apiBaseUrl}/api/categories`,
            method: 'GET',
            timeout: 10000,
            success: (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300 && res.data?.ok) {
                    this.setData({ categoriesTree: Array.isArray(res.data.data) ? res.data.data : [] });
                }
            },
        });
    },
    async loadProduct(id) {
        try {
            this.setData({ loading: true });
            const p = await fetchAdminProduct(id);
            this.setData({
                form: {
                    id: String(p.id),
                    title: p.title || '',
                    price: p.price ? (Number(p.price) / 100).toFixed(2) : '',
                    originPrice: p.originPrice ? (Number(p.originPrice) / 100).toFixed(2) : '',
                    stock: String(p.stock ?? ''),
                    category: p.category || '',
                    image: p.image || '',
                    brand: p.brand || '',
                    company: p.company || '',
                    description: p.description || '',
                    status: p.status || 'ON',
                },
            });
        }
        catch (e) {
            showMessage(e?.message || '加载商品失败', 'error');
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
    async pickCategory() {
        const tree = Array.isArray(this.data.categoriesTree) ? this.data.categoriesTree : [];
        if (tree.length === 0) {
            showMessage('分类数据加载中，请稍后重试');
            return;
        }
        const pickFromList = (list) => new Promise((resolve) => {
            wx.showActionSheet({
                itemList: list.map((x) => x.name),
                success: (res) => resolve(list[res.tapIndex] || null),
                fail: () => resolve(null),
            });
        });
        /**
         * 逐层选择分类，支持 1~N 层；如果当前层没有子节点，则直接使用该层作为最终分类。
         */
        let currentList = tree;
        let selected = null;
        while (Array.isArray(currentList) && currentList.length > 0) {
            selected = await pickFromList(currentList);
            if (!selected)
                return;
            const nextList = Array.isArray(selected.children) ? selected.children : [];
            if (nextList.length === 0)
                break;
            currentList = nextList;
        }
        this.setData({ 'form.category': selected?.name || '' });
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
            this.setData({ 'form.image': uploadRes.imageUrl || '' });
            showMessage('图片上传成功', 'success');
        }
        catch (e) {
            showMessage(e?.errMsg || e?.message || '图片上传失败', 'error');
        }
    },
    async onSubmit() {
        const f = this.data.form;
        if (!f.title || f.price === '' || f.stock === '') {
            showMessage('商品名/价格/库存为必填项');
            return;
        }
        const priceFen = Math.round(Number(f.price) * 100);
        const originFen = f.originPrice === '' ? null : Math.round(Number(f.originPrice) * 100);
        const stock = Number(f.stock);
        if (!Number.isFinite(priceFen) || priceFen < 0)
            return showMessage('价格不正确');
        if (!Number.isFinite(stock) || stock < 0)
            return showMessage('库存不正确');
        try {
            this.setData({ submitting: true });
            await updateAdminProduct(f.id, {
                title: f.title.trim(),
                price: priceFen,
                originPrice: originFen,
                stock,
                category: f.category || '',
                image: f.image || '',
                brand: f.brand || '',
                company: f.company || '',
                description: f.description || '',
                status: f.status || 'ON',
            });
            bumpProductDataVersion();
            showMessage('已保存', 'success');
            setTimeout(() => wx.navigateBack({ backRefresh: true }), 500);
        }
        catch (e) {
            showMessage(e?.message || '保存失败', 'error');
        }
        finally {
            this.setData({ submitting: false });
        }
    },
});
