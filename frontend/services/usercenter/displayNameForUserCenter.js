/**
 * 个人中心顶部展示名：有真实昵称用昵称；否则用已绑定大陆手机号；再没有才用「微信用户」
 * @param {string} [nickName]
 * @param {string} [phoneNumber]
 * @returns {string}
 */
export function displayNameForUserCenter(nickName, phoneNumber) {
    const nick = String(nickName ?? '').trim();
    const phone = String(phoneNumber ?? '').replace(/\s/g, '').trim();
    if (nick && nick !== '微信用户')
        return nick;
    if (/^1\d{10}$/.test(phone))
        return phone;
    if (nick)
        return nick;
    return '微信用户';
}
