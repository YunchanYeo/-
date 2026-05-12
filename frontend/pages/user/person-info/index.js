import { fetchPerson } from '../services/fetchPerson';
import { phoneEncryption } from '../utils/util';
import Toast from 'tdesign-miniprogram/toast/index';
import { logout } from '../../../services/auth/session';
import { requestJson } from '../../../services/_utils/http';
import { uploadSupportMedia } from '../services/support/chat';
Page({
    data: {
        personInfo: {
            avatarUrl: '',
            nickName: '',
            gender: 0,
            phoneNumber: '',
        },
        showUnbindConfirm: false,
        pickerOptions: [
            {
                name: '男',
                code: '1',
            },
            {
                name: '女',
                code: '2',
            },
        ],
        typeVisible: false,
        genderMap: ['', '男', '女'],
    },
    onLoad() {
        this.init();
    },
    init() {
        this.fetchData();
    },
    fetchData() {
        fetchPerson().then((personInfo) => {
            this.setData({
                personInfo,
                'personInfo.phoneNumber': phoneEncryption(personInfo.phoneNumber),
            });
        });
    },
    onClickCell({ currentTarget }) {
        const { dataset } = currentTarget;
        switch (dataset.type) {
            case 'gender':
                this.setData({
                    typeVisible: true,
                });
                break;
            case 'phoneNumber':
                this.openPhoneNumberEditor();
                break;
            default: {
                break;
            }
        }
    },
    openPhoneNumberEditor() {
        wx.showModal({
            title: '绑定手机号',
            content: '',
            editable: true,
            placeholderText: '11位手机号',
            confirmText: '保存',
            cancelText: '取消',
            success: async (res) => {
                if (!res.confirm)
                    return;
                const phone = String(res.content || '').trim();
                if (!/^1\d{10}$/.test(phone)) {
                    Toast({
                        context: this,
                        selector: '#t-toast',
                        message: '手机号格式不正确',
                        theme: 'error',
                    });
                    return;
                }
                try {
                    await requestJson('/api/me', { method: 'PUT', data: { phoneNumber: phone } });
                    this.fetchData();
                    Toast({
                        context: this,
                        selector: '#t-toast',
                        message: '手机号已更新',
                        theme: 'success',
                    });
                }
                catch (e) {
                    Toast({
                        context: this,
                        selector: '#t-toast',
                        message: '手机号保存失败，请稍后重试',
                        theme: 'error',
                    });
                }
            },
        });
    },
    async onChooseAvatar(e) {
        const localAvatarPath = String(e?.detail?.avatarUrl || '').trim();
        if (!localAvatarPath)
            return;
        try {
            const uploadedUrl = await uploadSupportMedia({
                kind: 'image',
                filePath: localAvatarPath,
                mimeType: 'image/jpeg',
                fileName: `avatar-${Date.now()}.jpg`,
            });
            await requestJson('/api/me', { method: 'PUT', data: { avatarUrl: uploadedUrl } });
            this.fetchData();
            Toast({
                context: this,
                selector: '#t-toast',
                message: '头像已更新',
                theme: 'success',
            });
        }
        catch (error) {
            const msg = (error && (error.message || error.errMsg)) ? String(error.message || error.errMsg).slice(0, 48) : '头像上传失败，请重试';
            Toast({
                context: this,
                selector: '#t-toast',
                message: msg,
                theme: 'error',
            });
        }
    },
    async onNicknameBlur(e) {
        const nickName = String(e?.detail?.value || '').trim();
        if (!nickName || nickName === this.data.personInfo.nickName)
            return;
        try {
            await requestJson('/api/me', { method: 'PUT', data: { nickName } });
            this.fetchData();
        }
        catch (error) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '昵称保存失败，请重试',
                theme: 'error',
            });
        }
    },
    onClose() {
        this.setData({
            typeVisible: false,
        });
    },
    onConfirm(e) {
        const { value } = e.detail;
        this.setData({
            typeVisible: false,
            'personInfo.gender': value,
        }, () => {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '设置成功',
                theme: 'success',
            });
        });
    },
    async onLogout() {
        const { confirm } = await new Promise((resolve) => {
            wx.showModal({
                title: '退出登录',
                content: '确认退出当前账号吗？',
                confirmText: '退出',
                cancelText: '取消',
                success: resolve,
                fail: () => resolve({ confirm: false }),
            });
        });
        if (!confirm)
            return;
        logout();
        Toast({
            context: this,
            selector: '#t-toast',
            message: '已退出登录',
            theme: 'success',
        });
        setTimeout(() => {
            wx.switchTab({ url: '/pages/usercenter/index' });
        }, 400);
    },
});
