import dayjs from 'dayjs';
const formatTime = (date, template) => dayjs(date).format(template);
function priceFormat(price, fill = 0) {
    if (isNaN(price) || price === null || price === Infinity) {
        return price;
    }
    let priceFormatValue = Math.round(parseFloat(`${price}`) * 10 ** 8) / 10 ** 8;
    priceFormatValue = `${Math.ceil(priceFormatValue) / 100}`;
    if (fill > 0) {
        if (priceFormatValue.indexOf('.') === -1) {
            priceFormatValue = `${priceFormatValue}.`;
        }
        const n = fill - priceFormatValue.split('.')[1]?.length;
        for (let i = 0; i < n; i++) {
            priceFormatValue = `${priceFormatValue}0`;
        }
    }
    return priceFormatValue;
}
module.exports = {
    formatTime,
    priceFormat,
};

