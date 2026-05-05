import { fetchPerson } from '../../../services/usercenter/fetchPerson';
import { phoneEncryption } from '../../../utils/util';
import Toast from 'tdesign-miniprogram/toast/index';
import { logout, syncUserProfileByWeChat } from '../../../services/auth/session';
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
        const { nickName } = this.data.personInfo;
        switch (dataset.type) {
            case 'gender':
                this.setData({
                    typeVisible: true,
                });
                break;
            case 'name':
                wx.navigateTo({
                    url: `/pages/user/name-edit/index?name=${nickName}`,
                });
                break;
            case 'avatarUrl':
                this.toModifyAvatar();
                break;
            default: {
                break;
            }
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
    async toModifyAvatar() {
        try {
            const tempFilePath = await new Promise((resolve, reject) => {
                wx.chooseImage({
                    count: 1,
                    sizeType: ['compressed'],
                    sourceType: ['album', 'camera'],
                    success: (res) => {
                        const { path, size } = res.tempFiles[0];
                        if (size <= 10485760) {
                            resolve(path);
                        }
                        else {
                            reject({ errMsg: '图片大小超出限制，请重新上传' });
                        }
                    },
                    fail: (err) => reject(err),
                });
            });
            const tempUrlArr = tempFilePath.split('/');
            const tempFileName = tempUrlArr[tempUrlArr.length - 1];
            Toast({
                context: this,
                selector: '#t-toast',
                message: `已选择图片-${tempFileName}`,
                theme: 'success',
            });
        }
        catch (error) {
            if (error.errMsg === 'chooseImage:fail cancel')
                return;
            Toast({
                context: this,
                selector: '#t-toast',
                message: error.errMsg || error.msg || '修改头像出错了',
                theme: 'error',
            });
        }
    },
    async openUnbindConfirm() {
        try {
            const { confirm } = await new Promise((resolve) => {
                wx.showModal({
                    title: '切换账号登录',
                    content: '将清除本地登录信息，并重新进行微信登录/授权。',
                    confirmText: '继续',
                    cancelText: '取消',
                    success: resolve,
                    fail: () => resolve({ confirm: false }),
                });
            });
            if (!confirm)
                return;
            logout();
            await syncUserProfileByWeChat();
            Toast({
                context: this,
                selector: '#t-toast',
                message: '已重新登录并同步微信资料',
                theme: 'success',
            });
            this.fetchData();
        }
        catch (e) {
            const msg = e?.errMsg || e?.message || '';
            if (String(msg).includes('cancel'))
                return;
            Toast({
                context: this,
                selector: '#t-toast',
                message: '重新登录失败，请稍后再试',
                theme: 'error',
            });
        }
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
