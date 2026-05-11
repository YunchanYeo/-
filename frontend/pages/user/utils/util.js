import dayjs from 'dayjs';
const formatTime = (date, template) => dayjs(date).format(template);
const phoneEncryption = (phone) => {
    return String(phone || '').replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};
const innerPhoneReg = '^1(?:3\\d|4[4-9]|5[0-35-9]|6[67]|7[0-8]|8\\d|9\\d)\\d{8}$';
const phoneRegCheck = (phone) => {
    const phoneRegExp = new RegExp(innerPhoneReg);
    return phoneRegExp.test(String(phone || ''));
};
module.exports = {
    formatTime,
    phoneEncryption,
    phoneRegCheck,
};

