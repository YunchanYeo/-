export function createCategoryService() {
    function categories(req, res) {
        const cdnThumb = (name) => `https://tdesign.gtimg.com/miniprogram/template/retail/goods/nz-09a.png?cat=${encodeURIComponent(name)}`;
        const leaf = (id, name) => ({ id, name, thumbnail: cdnThumb(name) });
        const level2 = (name, children) => ({ name, children });
        const level1 = (name, children) => ({ name, children });
        const data = [
            level1('方便速食', [
                level2('面食', [leaf('方便面', '方便面'), leaf('拌面', '拌面'), leaf('粉/米线', '粉/米线'), leaf('挂面', '挂面')]),
                level2('速食料理', [leaf('自热饭', '自热饭'), leaf('速冻水饺/馄饨', '速冻水饺/馄饨'), leaf('速冻面点', '速冻面点')]),
                level2('罐头/即食', [leaf('罐头', '罐头'), leaf('八宝粥', '八宝粥'), leaf('即食粥', '即食粥')]),
            ]),
            level1('零食', [
                level2('膨化/薯片', [leaf('薯片', '薯片'), leaf('膨化食品', '膨化食品')]),
                level2('饼干糕点', [leaf('饼干', '饼干'), leaf('蛋糕/面包', '蛋糕/面包'), leaf('月饼', '月饼')]),
                level2('坚果炒货', [leaf('坚果', '坚果'), leaf('瓜子/花生', '瓜子/花生')]),
                level2('糖巧', [leaf('巧克力', '巧克力'), leaf('糖果', '糖果')]),
                level2('肉类零食', [leaf('肉干肉脯', '肉干肉脯'), leaf('卤味零食', '卤味零食')]),
            ]),
        ];
        res.json({ ok: true, data });
    }
    return { categories };
}
