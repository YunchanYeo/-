import { fetchAdminOrders, fetchAdminProducts, updateAdminOrderShipping, updateAdminOrderStatus, deleteAdminOrder, updateAdminProductStock, createAdminProduct, uploadAdminImage, fetchAdminCategories, createAdminCategory, updateAdminCategory, deleteAdminCategory, fetchAdminCoupons, createAdminCoupon, grantAdminCoupon, updateAdminCoupon, deleteAdminCoupon, deleteAdminProduct, fetchAdminPromotions, createAdminPromotion, updateAdminPromotion, deleteAdminPromotion, } from '../../../services/admin/adminApi';
import { clearAdminSession, getAdminToken } from '../../../services/admin/session';
import { config } from '../../../config/runtime';
import { wxRequestTransportOpts } from '../../../services/_utils/wxRequestTransport';
import { bumpProductDataVersion } from '../../../services/good/productVersion';
import { resolveAdminImageForDisplay, toStoredProductImagePath } from '../../../services/admin/adminImageUrl';
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
        expandedOrderNo: '',
        products: [],
        loading: false,
        createSubmitting: false,
        productForm: {
            title: '',
            price: '',
            originPrice: '',
            stock: '',
            unit: '件',
            image: '',
            category: '',
            description: '',
            brand: '',
            company: '',
            status: 'ON',
        },
        categoriesTree: [],
        adminCategories: [],
        categoriesLoading: false,
        coupons: [],
        couponsLoading: false,
        couponEditingId: null,
        couponEditForm: {
            name: '',
            type: '2',
            value: '',
            base: '',
            totalCount: '100',
            startDate: '',
            endDate: '',
            status: 'enabled',
        },
        couponForm: {
            name: '',
            type: '2',
            value: '',
            base: '',
            totalCount: '100',
            startDate: '',
            endDate: '',
        },
        promotions: [],
        promotionsLoading: false,
        promotionSubmitting: false,
        promotionForm: {
            id: '',
            title: '',
            imageUrl: '',
            description: '',
            relatedProductId: '',
            status: 'ON',
            sortOrder: '0',
        },
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
            ...wxRequestTransportOpts,
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
        const list = Array.isArray(this.data.categoriesTree) ? this.data.categoriesTree : [];
        if (list.length === 0) {
            showMessage('分类数据加载中，请稍后重试');
            return;
        }
        const selected = await new Promise((resolve) => {
            wx.showActionSheet({
                itemList: list.map((x) => String(x.name || '')),
                success: (res) => resolve(list[res.tapIndex] || null),
                fail: () => resolve(null),
            });
        });
        if (!selected) {
            return;
        }
        this.setData({ 'productForm.category': selected.name || '' });
    },
    onUnload() {
        if (this._memoryWarningHandler && typeof wx.offMemoryWarning === 'function') {
            wx.offMemoryWarning(this._memoryWarningHandler);
        }
    },
    async refreshAll() {
        this.setData({ loading: true });
        try {
            const settled = await Promise.allSettled([fetchAdminOrders(), fetchAdminProducts()]);
            const oRes = settled[0];
            const pRes = settled[1];
            const ordersRaw = oRes.status === 'fulfilled' ? oRes.value : [];
            const products = pRes.status === 'fulfilled' ? pRes.value : [];
            if (oRes.status === 'rejected')
                showMessage(oRes.reason?.message || '订单列表加载失败', 'error');
            if (pRes.status === 'rejected')
                showMessage(pRes.reason?.message || '商品列表加载失败', 'error');
            const normalizedOrders = (Array.isArray(ordersRaw) ? ordersRaw : []).map((x) => this.enrichAdminOrder(x));
            this.setData({ orders: normalizedOrders, products: products || [] });
        }
        catch (e) {
            showMessage(e?.message || '加载失败', 'error');
        }
        finally {
            this.setData({ loading: false });
        }
    },
    onTabChange(e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({ activeTab: tab });
        if (tab === 'categories') {
            this.loadAdminCategories();
        }
        if (tab === 'coupons') {
            this.loadAdminCoupons();
        }
        if (tab === 'promotions') {
            this.loadAdminPromotions();
        }
    },
    async loadAdminPromotions() {
        this.setData({ promotionsLoading: true });
        try {
            const rows = await fetchAdminPromotions();
            this.setData({ promotions: Array.isArray(rows) ? rows : [] });
        }
        catch (e) {
            showMessage(e?.message || '活动列表加载失败', 'error');
        }
        finally {
            this.setData({ promotionsLoading: false });
        }
    },
    onPromotionInput(e) {
        const { key } = e.currentTarget.dataset;
        this.setData({ [`promotionForm.${key}`]: e.detail.value });
    },
    async onPickPromotionImage() {
        try {
            const mediaRes = await new Promise((resolve, reject) => {
                wx.chooseMedia({
                    count: 1,
                    mediaType: ['image'],
                    sourceType: ['album', 'camera'],
                    sizeType: ['compressed'],
                    success: resolve,
                    fail: reject,
                });
            });
            const file = mediaRes?.tempFiles?.[0];
            if (!file?.tempFilePath)
                throw new Error('图片选择失败');
            const base64Data = await new Promise((resolve, reject) => {
                wx.getFileSystemManager().readFile({
                    filePath: file.tempFilePath,
                    encoding: 'base64',
                    success: (res) => resolve(res.data),
                    fail: reject,
                });
            });
            const uploadRes = await uploadAdminImage({
                fileName: file?.fileType ? `promotion.${file.fileType}` : 'promotion.jpg',
                mimeType: file?.type ? `image/${file.type}` : 'image/jpeg',
                base64Data,
            });
            this.setData({ 'promotionForm.imageUrl': uploadRes.imageUrl || '' });
            showMessage('活动图片上传成功', 'success');
        }
        catch (e) {
            showMessage(e?.message || '活动图片上传失败', 'error');
        }
    },
    async onSavePromotion() {
        const f = this.data.promotionForm || {};
        const title = String(f.title || '').trim();
        const imageUrl = String(f.imageUrl || '').trim();
        if (!title || !imageUrl) {
            showMessage('请填写活动标题并上传图片');
            return;
        }
        const payload = {
            title,
            imageUrl,
            description: String(f.description || '').trim(),
            relatedProductId: String(f.relatedProductId || '').trim() ? Number(f.relatedProductId) : null,
            status: String(f.status || 'ON').toUpperCase() === 'OFF' ? 'OFF' : 'ON',
            sortOrder: Number(f.sortOrder || 0),
        };
        try {
            this.setData({ promotionSubmitting: true });
            if (String(f.id || '')) {
                await updateAdminPromotion(Number(f.id), payload);
            }
            else {
                await createAdminPromotion(payload);
            }
            showMessage('活动已保存', 'success');
            this.setData({
                promotionForm: {
                    id: '',
                    title: '',
                    imageUrl: '',
                    description: '',
                    relatedProductId: '',
                    status: 'ON',
                    sortOrder: '0',
                },
            });
            this.loadAdminPromotions();
        }
        catch (e) {
            showMessage(e?.message || '活动保存失败', 'error');
        }
        finally {
            this.setData({ promotionSubmitting: false });
        }
    },
    onEditPromotion(e) {
        const item = e.currentTarget.dataset.item;
        if (!item?.id)
            return;
        this.setData({
            promotionForm: {
                id: String(item.id || ''),
                title: String(item.title || ''),
                imageUrl: String(item.imageUrl || ''),
                description: String(item.description || ''),
                relatedProductId: item.relatedProductId == null ? '' : String(item.relatedProductId),
                status: String(item.status || 'ON'),
                sortOrder: String(item.sortOrder ?? 0),
            },
        });
    },
    async onDeletePromotion(e) {
        const item = e.currentTarget.dataset.item;
        if (!item?.id)
            return;
        const confirm = await new Promise((resolve) => {
            wx.showModal({
                title: '删除活动',
                content: `确定删除「${item.title || ''}」？`,
                success: resolve,
                fail: () => resolve({ confirm: false }),
            });
        });
        if (!confirm.confirm)
            return;
        try {
            await deleteAdminPromotion(Number(item.id));
            showMessage('活动已删除', 'success');
            this.loadAdminPromotions();
        }
        catch (e) {
            showMessage(e?.message || '活动删除失败', 'error');
        }
    },

    enrichAdminOrder(order) {
        const o = order || {};
        const address = this.formatOrderAddress(o.address || o.addressJson || {});
        const items = this.normalizeOrderItems(o.items || o.itemsJson || []);
        const itemsSummary = this.formatItemsSummary(items);
        return {
            ...o,
            _addressText: address.text,
            _receiverText: address.receiver,
            _items: items,
            _itemsSummary: itemsSummary,
        };
    },

    formatOrderAddress(addr) {
        const a = addr && typeof addr === 'object' ? addr : {};
        const name = String(a.name || a.receiverName || a.userName || '').trim();
        const phone = String(a.phone || a.phoneNumber || a.tel || a.mobile || '').trim();
        const province = String(a.provinceName || a.province || '').trim();
        const city = String(a.cityName || a.city || '').trim();
        const district = String(a.districtName || a.district || a.county || '').trim();
        const detail = String(a.detailAddress || a.address || a.addressDetail || '').trim();
        const region = [province, city, district].filter(Boolean).join(' ');
        const text = [region, detail].filter(Boolean).join(' ') || '-';
        const receiver = [name || '-', phone || ''].filter(Boolean).join(' ').trim() || '-';
        return { receiver, text };
    },

    normalizeOrderItems(items) {
        const arr = Array.isArray(items) ? items : [];
        return arr.map((it) => {
            const title = String(it?.goodsName || it?.title || it?.name || '商品').trim();
            const qty = Number(it?.quantity ?? it?.buyQuantity ?? 1) || 1;
            return { title, qty, raw: it };
        });
    },

    formatItemsSummary(items) {
        const arr = Array.isArray(items) ? items : [];
        if (arr.length === 0)
            return '-';
        const first = arr[0];
        if (arr.length === 1)
            return `${first.title} ×${first.qty}`;
        const restCount = arr.length - 1;
        return `${first.title} ×${first.qty} 외 ${restCount}개`;
    },

    onToggleOrderDetail(e) {
        const item = e.currentTarget.dataset.item;
        const orderNo = String(item?.orderNo || '');
        if (!orderNo)
            return;
        this.setData({ expandedOrderNo: this.data.expandedOrderNo === orderNo ? '' : orderNo });
    },
    async loadAdminCoupons() {
        this.setData({ couponsLoading: true });
        try {
            const rows = await fetchAdminCoupons();
            this.setData({ coupons: Array.isArray(rows) ? rows : [] });
        }
        catch (e) {
            showMessage(e?.message || '优惠券列表加载失败', 'error');
        }
        finally {
            this.setData({ couponsLoading: false });
        }
    },
    onCouponInput(e) {
        const { key } = e.currentTarget.dataset;
        this.setData({ [`couponForm.${key}`]: e.detail.value });
    },
    onCouponEditInput(e) {
        const { key } = e.currentTarget.dataset;
        this.setData({ [`couponEditForm.${key}`]: e.detail.value });
    },
    async onCreateCoupon() {
        const { couponForm } = this.data;
        const startTime = new Date(couponForm.startDate).getTime();
        const endTime = new Date(couponForm.endDate).getTime();
        const value = Number(couponForm.value);
        const base = Number(couponForm.base || 0);
        const totalCount = Number(couponForm.totalCount || 100);
        if (!couponForm.name || !Number.isFinite(value) || value <= 0 || !Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
            showMessage('请检查优惠券参数');
            return;
        }
        try {
            await createAdminCoupon({
                name: couponForm.name.trim(),
                type: Number(couponForm.type) === 1 ? 1 : 2,
                value: Math.floor(value),
                base: Number.isFinite(base) && base >= 0 ? Math.floor(base) : 0,
                totalCount: Number.isFinite(totalCount) && totalCount > 0 ? Math.floor(totalCount) : 100,
                startTime,
                endTime,
            });
            showMessage('优惠券已创建', 'success');
            this.setData({
                couponForm: {
                    name: '',
                    type: '2',
                    value: '',
                    base: '',
                    totalCount: '100',
                    startDate: '',
                    endDate: '',
                },
            });
            this.loadAdminCoupons();
        }
        catch (e) {
            showMessage(e?.message || '创建失败', 'error');
        }
    },
    openEditCoupon(e) {
        const item = e.currentTarget.dataset.item;
        if (!item?.id)
            return;
        const startDate = item.startTime ? new Date(Number(item.startTime)).toISOString().slice(0, 10) : '';
        const endDate = item.endTime ? new Date(Number(item.endTime)).toISOString().slice(0, 10) : '';
        this.setData({
            couponEditingId: item.id,
            couponEditForm: {
                name: item.name || '',
                type: String(item.type === 1 ? 1 : 2),
                value: String(item.value ?? ''),
                base: String(item.base ?? 0),
                totalCount: String(item.totalCount ?? 100),
                startDate,
                endDate,
                status: item.status === 'disabled' ? 'disabled' : 'enabled',
            },
        });
    },
    cancelEditCoupon() {
        this.setData({ couponEditingId: null });
    },
    async onSaveCouponEdit() {
        const id = this.data.couponEditingId;
        if (!id)
            return;
        const f = this.data.couponEditForm;
        const startTime = new Date(f.startDate).getTime();
        const endTime = new Date(f.endDate).getTime();
        const value = Math.floor(Number(f.value));
        const base = Math.floor(Number(f.base || 0));
        const totalCount = Math.floor(Number(f.totalCount || 100));
        const type = Number(f.type) === 1 ? 1 : 2;
        const status = f.status === 'disabled' ? 'disabled' : 'enabled';
        if (!f.name || !Number.isFinite(value) || value <= 0 || !Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
            showMessage('请检查优惠券参数');
            return;
        }
        if (!Number.isFinite(base) || base < 0) {
            showMessage('门槛需为非负整数');
            return;
        }
        if (!Number.isFinite(totalCount) || totalCount <= 0) {
            showMessage('总量需大于0');
            return;
        }
        try {
            await updateAdminCoupon(id, {
                name: f.name.trim(),
                type,
                value,
                base,
                totalCount,
                startTime,
                endTime,
                status,
            });
            showMessage('优惠券已更新', 'success');
            this.setData({ couponEditingId: null });
            this.loadAdminCoupons();
        }
        catch (e) {
            showMessage(e?.message || '更新失败', 'error');
        }
    },
    async onGrantCouponAll(e) {
        const item = e.currentTarget.dataset.item;
        if (!item?.id)
            return;
        try {
            const r = await grantAdminCoupon(item.id, { grantAllUsers: true });
            showMessage(`已发放 ${r?.grantedCount || 0} 张`, 'success');
            this.loadAdminCoupons();
        }
        catch (e) {
            showMessage(e?.message || '发放失败', 'error');
        }
    },
    async onDeleteCoupon(e) {
        const item = e.currentTarget.dataset.item;
        if (!item?.id)
            return;
        const confirm = await new Promise((resolve) => {
            wx.showModal({
                title: '删除优惠券',
                content: `确定删除「${item.name}」？已领取记录也会一并删除。`,
                success: resolve,
                fail: () => resolve({ confirm: false }),
            });
        });
        if (!confirm.confirm)
            return;
        try {
            await deleteAdminCoupon(item.id);
            showMessage('优惠券已删除', 'success');
            this.loadAdminCoupons();
        }
        catch (e) {
            showMessage(e?.message || '删除失败', 'error');
        }
    },
    async loadAdminCategories() {
        this.setData({ categoriesLoading: true });
        try {
            const rows = await fetchAdminCategories();
            this.setData({ adminCategories: Array.isArray(rows) ? rows : [] });
        }
        catch (e) {
            showMessage(e?.message || '分类列表加载失败', 'error');
        }
        finally {
            this.setData({ categoriesLoading: false });
        }
    },
    async onAddCategory() {
        const modal = await new Promise((resolve) => {
            wx.showModal({
                title: '新增分类',
                editable: true,
                placeholderText: '例如：甜品',
                success: resolve,
                fail: () => resolve({ confirm: false }),
            });
        });
        if (!modal.confirm)
            return;
        const name = String(modal.content || '').trim();
        if (!name) {
            showMessage('请输入分类名称');
            return;
        }
        try {
            await createAdminCategory({ name });
            showMessage('已新增分类', 'success');
            await this.loadAdminCategories();
            this.loadCategories();
        }
        catch (e) {
            showMessage(e?.message || '新增失败', 'error');
        }
    },
    async onEditCategory(e) {
        const item = e.currentTarget.dataset.item;
        if (!item?.id)
            return;
        const modal = await new Promise((resolve) => {
            wx.showModal({
                title: '修改分类名称',
                editable: true,
                placeholderText: item.name || '',
                success: resolve,
                fail: () => resolve({ confirm: false }),
            });
        });
        if (!modal.confirm)
            return;
        const name = String(modal.content || '').trim();
        if (!name) {
            showMessage('请输入分类名称');
            return;
        }
        try {
            await updateAdminCategory(item.id, { name });
            showMessage('已保存', 'success');
            await this.loadAdminCategories();
            this.loadCategories();
        }
        catch (e) {
            showMessage(e?.message || '保存失败', 'error');
        }
    },
    async onDeleteCategory(e) {
        const item = e.currentTarget.dataset.item;
        if (!item?.id)
            return;
        const confirm = await new Promise((resolve) => {
            wx.showModal({
                title: '删除分类',
                content: `确定删除「${item.name}」？若有商品使用该分类将无法删除。`,
                success: resolve,
                fail: () => resolve({ confirm: false }),
            });
        });
        if (!confirm.confirm)
            return;
        try {
            await deleteAdminCategory(item.id);
            showMessage('已删除', 'success');
            await this.loadAdminCategories();
            this.loadCategories();
        }
        catch (e) {
            showMessage(e?.message || '删除失败', 'error');
        }
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
                'productForm.image': resolveAdminImageForDisplay(uploadRes.imageUrl),
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
            unit: (productForm.unit && String(productForm.unit).trim()) || '件',
            originPrice: productForm.originPrice === '' ? undefined : Math.round(Number(productForm.originPrice) * 100),
            image: toStoredProductImagePath(productForm.image),
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
    async onDeleteProduct(e) {
        const item = e.currentTarget.dataset.item;
        if (!item?.id)
            return;
        const confirm = await new Promise((resolve) => {
            wx.showModal({
                title: '删除商品',
                content: `确定删除「${item.title}」？删除后不可恢复（历史订单快照不受影响）。`,
                success: resolve,
                fail: () => resolve({ confirm: false }),
            });
        });
        if (!confirm.confirm)
            return;
        try {
            await deleteAdminProduct(item.id);
            bumpProductDataVersion();
            showMessage('商品已删除', 'success');
            this.refreshAll();
        }
        catch (e) {
            showMessage(e?.message || '删除失败', 'error');
        }
    },
    onViewLogisticsTrace(e) {
        const item = e.currentTarget.dataset.item;
        if (!item?.logisticsNo) {
            showMessage('请先填写运单号');
            return;
        }
        wx.navigateTo({
            url: `/pages/admin/logistics-trace/index?orderNo=${encodeURIComponent(item.orderNo)}`,
        });
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
    async onDeleteOrder(e) {
        const item = e.currentTarget.dataset.item;
        if (!item?.orderNo)
            return;
        const confirm = await new Promise((resolve) => {
            wx.showModal({
                title: '删除订单',
                content: `确定删除订单 ${item.orderNo}？此操作不可恢复。`,
                success: resolve,
                fail: () => resolve({ confirm: false }),
            });
        });
        if (!confirm.confirm)
            return;
        try {
            await deleteAdminOrder(item.orderNo);
            showMessage('订单已删除', 'success');
            this.refreshAll();
        }
        catch (e) {
            showMessage(e?.message || '删除失败', 'error');
        }
    },
    async onChangeOrderStatus(e) {
        const item = e.currentTarget.dataset.item;
        if (!item?.orderNo)
            return;
        const options = ['待发货', '待收货', '已完成', '已取消'];
        const statusByIndex = [10, 40, 50, 60];
        const selected = await new Promise((resolve) => {
            wx.showActionSheet({
                itemList: options,
                success: (res) => resolve(res.tapIndex),
                fail: () => resolve(-1),
            });
        });
        if (selected < 0)
            return;
        const orderStatus = statusByIndex[selected] || 10;
        const orderStatusName = options[selected] || '待发货';
        try {
            await updateAdminOrderStatus(item.orderNo, { orderStatus, orderStatusName });
            showMessage('订单状态已更新', 'success');
            this.refreshAll();
        }
        catch (e) {
            showMessage(e?.message || '更新失败', 'error');
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
    gotoPointSettings() {
        wx.navigateTo({ url: '/pages/admin/point-settings/index' });
    },
    gotoSupportChat() {
        const go = () => {
            wx.navigateTo({
                url: '/pages/admin/support-chat/index',
                fail: (err) => {
                    wx.showToast({
                        title: String(err?.errMsg || '无法打开客服页'),
                        icon: 'none',
                        duration: 2500,
                    });
                },
            });
        };
        if (typeof wx.loadSubpackage === 'function') {
            wx.loadSubpackage({
                name: 'admin',
                success: go,
                fail: go,
            });
        }
        else {
            go();
        }
    },
});
