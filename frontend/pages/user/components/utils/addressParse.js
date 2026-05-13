import { areaData } from '../../../../config/index';
/**
 * 将微信 chooseAddress 的省市区名称映射为内部编码；先精确匹配，失败再宽松匹配（与 areaData 标签差异时仍可保存）。
 */
const addressParse = (provinceName, cityName, countyName) => {
    const p = String(provinceName || '').trim();
    const c = String(cityName || '').trim();
    const d = String(countyName || '').trim();
    return new Promise((resolve, reject) => {
        const matchProvince = (fuzzy) => {
            if (!p)
                return null;
            if (!fuzzy)
                return areaData.find((v) => v.label === p) || null;
            return areaData.find((v) => v.label === p)
                || areaData.find((v) => p.includes(v.label) || v.label.includes(p))
                || null;
        };
        const matchCity = (province, fuzzy) => {
            if (!province || !c)
                return null;
            const list = province.children || [];
            if (!fuzzy)
                return list.find((v) => v.label === c) || null;
            return list.find((v) => v.label === c)
                || list.find((v) => c.includes(v.label) || v.label.includes(c))
                || null;
        };
        const matchDistrict = (city, fuzzy) => {
            if (!city || !d)
                return null;
            const list = city.children || [];
            if (!fuzzy)
                return list.find((v) => v.label === d) || null;
            return list.find((v) => v.label === d)
                || list.find((v) => d.includes(v.label) || v.label.includes(d))
                || null;
        };
        const tryOnce = (fuzzy) => {
            const province = matchProvince(fuzzy);
            const city = matchCity(province, fuzzy);
            const district = matchDistrict(city, fuzzy);
            if (!province || !city || !district)
                throw new Error('地址解析失败');
            return {
                provinceCode: province.value,
                cityCode: city.value,
                districtCode: district.value,
            };
        };
        try {
            resolve(tryOnce(false));
        }
        catch {
            try {
                resolve(tryOnce(true));
            }
            catch {
                reject('地址解析失败');
            }
        }
    });
};
module.exports = {
    addressParse,
};
