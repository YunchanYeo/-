"use strict";
function generateMixed(n, str) {
    var res = '';
    for (var i = 0; i < n; i++) {
        var id = Math.ceil(Math.random() * 35);
        res += str[id];
    }
    return res;
}
function getRandomNum(min, max) {
    var range = max - min;
    var rand = Math.random();
    return min + Math.round(rand * range);
}
function mockIp() {
    return `10.${getRandomNum(1, 254)}.${getRandomNum(1, 254)}.${getRandomNum(1, 254)}`;
}
function mockReqId() {
    return `${getRandomNum(100000, 999999)}.${new Date().valueOf()}${getRandomNum(1000, 9999)}.${getRandomNum(10000000, 99999999)}`;
}
module.exports = {
    generateMixed,
    mockIp,
    mockReqId,
    getRandomNum,
};

