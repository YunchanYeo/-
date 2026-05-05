export function createCategoryService() {
    function categories(req, res) {
        const keywordThumbMap = [
            { keywords: ['方便面', '拌面', '挂面', '面食'], url: 'https://img.icons8.com/color/240/noodles.png' },
            { keywords: ['米线', '粉', '自热饭', '八宝粥', '即食粥'], url: 'https://img.icons8.com/color/240/rice-bowl.png' },
            { keywords: ['水饺', '馄饨', '面点'], url: 'https://img.icons8.com/color/240/dumpling.png' },
            { keywords: ['罐头'], url: 'https://img.icons8.com/color/240/tin-can.png' },
            { keywords: ['薯片', '膨化'], url: 'https://img.icons8.com/color/240/potato-chips.png' },
            { keywords: ['饼干'], url: 'https://img.icons8.com/color/240/cookies.png' },
            { keywords: ['蛋糕', '面包'], url: 'https://img.icons8.com/color/240/cupcake.png' },
            { keywords: ['月饼'], url: 'https://img.icons8.com/color/240/mooncake.png' },
            { keywords: ['坚果', '瓜子', '花生'], url: 'https://img.icons8.com/color/240/almond.png' },
            { keywords: ['巧克力', '糖果', '糖巧'], url: 'https://img.icons8.com/color/240/chocolate-bar.png' },
            { keywords: ['肉干', '肉脯', '卤味'], url: 'https://img.icons8.com/color/240/steak.png' },
        ];
        const fallbackThumb = 'https://img.icons8.com/color/240/shopping-basket-2.png';
        const cdnThumb = (name) => {
            const target = keywordThumbMap.find((row) => row.keywords.some((kw) => String(name || '').includes(kw)));
            return target?.url || fallbackThumb;
        };
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
