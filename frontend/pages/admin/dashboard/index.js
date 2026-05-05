import { fetchAdminOrders, fetchAdminProducts, updateAdminOrderShipping, updateAdminProductStock, createAdminProduct, uploadAdminImage, } from '../../../services/admin/adminApi';
import { clearAdminSession, getAdminToken } from '../../../services/admin/session';
import { config } from '../../../config/index';
import { bumpProductDataVersion } from '../../../services/good/productVersion';
function showMessage(message, theme = 'none') {
    const icon = theme === 'success' ? 'success' : theme === 'error' ? 'error' : 'none';
    wx.showToast({
        title: message || '',
        icon,
        duration: 1600,
    });
}
Page({
    data: {
        activeTab: 'orders',
        orders: [],
        products: [],
        loading: false,
        createSubmitting: false,
        productForm: {
            title: '',
            price: '',
            originPrice: '',
            stock: '',
            image: '',
            category: '',
            description: '',
            brand: '',
            company: '',
            status: 'ON',
        },
        categoriesTree: [],
    },
    onLoad() {
        if (!getAdminToken()) {
            wx.redirectTo({ url: '/pages/admin/login/index' });
            return;
        }
        this.refreshAll();
        this.loadCategories();
        if (typeof wx.onMemoryWarning === 'function') {
            this._memoryWarningHandler = () => {
                // 메모리 경고 시 미리보기 이미지를 비워 앱 메모리 사용량을 줄입니다.
                if (this.data.productForm?.image) {
                    this.setData({ 'productForm.image': '' });
                }
            };
            wx.onMemoryWarning(this._memoryWarningHandler);
        }
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
            fail: () => { },
        });
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
         * 逐层选择分类，支持 1~N 层；如果没有更深层节点，当前选择即为最终分类。
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
        this.setData({ 'productForm.category': selected?.name || '' });
    },
    onUnload() {
        if (this._memoryWarningHandler && typeof wx.offMemoryWarning === 'function') {
            wx.offMemoryWarning(this._memoryWarningHandler);
        }
    },
    async refreshAll() {
        this.setData({ loading: true });
        try {
            const [orders, products] = await Promise.all([fetchAdminOrders(), fetchAdminProducts()]);
            this.setData({ orders: orders || [], products: products || [] });
        }
        catch (e) {
            showMessage(e?.message || '加载失败', 'error');
        }
        finally {
            this.setData({ loading: false });
        }
    },
    onTabChange(e) {
        this.setData({ activeTab: e.currentTarget.dataset.tab });
    },
    onProductInput(e) {
        const { key } = e.currentTarget.dataset;
        this.setData({
            [`productForm.${key}`]: e.detail.value,
        });
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
            this.setData({
                'productForm.image': uploadRes.imageUrl || '',
            });
            showMessage('图片上传成功', 'success');
        }
        catch (e) {
            showMessage(e?.errMsg || e?.message || '图片上传失败', 'error');
        }
    },
    async onCreateProduct() {
        const { productForm } = this.data;
        if (!productForm.title || productForm.price === '' || productForm.stock === '') {
            showMessage('商品名/价格/库存为必填项');
            return;
        }
        const payload = {
            title: productForm.title.trim(),
            // 관리자 입력은 원(예: 12.9) 기준으로 받고 DB에는 분 단위 정수로 저장
            price: Math.round(Number(productForm.price) * 100),
            stock: Number(productForm.stock),
            status: productForm.status || 'ON',
            originPrice: productForm.originPrice === '' ? undefined : Math.round(Number(productForm.originPrice) * 100),
            image: productForm.image || '',
            category: productForm.category || '',
            description: productForm.description || '',
            brand: productForm.brand || '',
            company: productForm.company || '',
        };
        if (!Number.isFinite(payload.price) || payload.price < 0 || !Number.isInteger(payload.price)) {
            showMessage('价格必须是大于等于0的数字');
            return;
        }
        if (!Number.isFinite(payload.stock) || payload.stock < 0 || !Number.isInteger(payload.stock)) {
            showMessage('库存必须是大于等于0的整数');
            return;
        }
        if (payload.originPrice !== undefined && (!Number.isFinite(payload.originPrice) || payload.originPrice < 0)) {
            showMessage('原价必须是大于等于0的数字');
            return;
        }
        try {
            this.setData({ createSubmitting: true });
            await createAdminProduct(payload);
            bumpProductDataVersion();
            showMessage('商品新增成功(已写入DB)', 'success');
            this.setData({
                productForm: {
                    title: '',
                    price: '',
                    originPrice: '',
                    stock: '',
                    image: '',
                    category: '',
                    description: '',
                    brand: '',
                    company: '',
                    status: 'ON',
                },
            });
            this.refreshAll();
        }
        catch (e) {
            showMessage(e?.message || '商品新增失败', 'error');
        }
        finally {
            this.setData({ createSubmitting: false });
        }
    },
    async onEditStock(e) {
        const item = e.currentTarget.dataset.item;
        const modal = await new Promise((resolve) => {
            wx.showModal({
                title: `修改库存 - ${item.title}`,
                editable: true,
                placeholderText: `当前库存: ${item.stock}`,
                success: resolve,
                fail: () => resolve({ confirm: false }),
            });
        });
        if (!modal.confirm)
            return;
        const stock = Number(modal.content);
        if (!Number.isFinite(stock) || stock < 0) {
            showMessage('库存必须是大于等于0的数字');
            return;
        }
        try {
            await updateAdminProductStock(item.id, stock);
            bumpProductDataVersion();
            showMessage('库存已更新', 'success');
            this.refreshAll();
        }
        catch (e) {
            showMessage(e?.message || '更新失败', 'error');
        }
    },
    async onFillShipping(e) {
        const item = e.currentTarget.dataset.item;
        const trackingModal = await new Promise((resolve) => {
            wx.showModal({
                title: `订单 ${item.orderNo}`,
                editable: true,
                placeholderText: item.logisticsNo || '请输入运单号',
                success: resolve,
                fail: () => resolve({ confirm: false }),
            });
        });
        if (!trackingModal.confirm || !trackingModal.content)
            return;
        const companyModal = await new Promise((resolve) => {
            wx.showModal({
                title: '物流公司',
                editable: true,
                placeholderText: item.logisticsCompanyName || '例如: 顺丰快递',
                success: resolve,
                fail: () => resolve({ confirm: false }),
            });
        });
        if (!companyModal.confirm || !companyModal.content)
            return;
        try {
            await updateAdminOrderShipping(item.orderNo, {
                logisticsNo: trackingModal.content,
                logisticsCompanyName: companyModal.content,
                logisticsCompanyCode: '',
            });
            showMessage('运单已保存', 'success');
            this.refreshAll();
        }
        catch (e) {
            showMessage(e?.message || '保存失败', 'error');
        }
    },
    onLogoutAdmin() {
        clearAdminSession();
        wx.redirectTo({ url: '/pages/admin/login/index' });
    },
    gotoEditProduct(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({ url: `/pages/admin/product-edit/index?id=${id}` });
    },
    gotoAdminSettings() {
        wx.navigateTo({ url: '/pages/admin/settings/index' });
    },
    gotoSupportChat() {
        wx.navigateTo({ url: '/pages/admin/support-chat/index' });
    },
});
