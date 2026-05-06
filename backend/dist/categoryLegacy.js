/**
 * 旧版多级分类里的「叶子名称」与当前 product_categories 主名称的对应。
 * 用于：① 启动时把历史商品的 category/categoryId 归一 ② 列表 API 按主分类筛选时兼容旧字符串。
 */
export const LEGACY_LABELS_BY_CANONICAL = {
    面: ['方便面', '拌面', '挂面', '粉/米线', '粉', '米线', '速冻水饺/馄饨', '速冻面点'],
    饭: ['自热饭', '八宝粥', '即食粥'],
    罐头: ['罐头'],
    零食: [
        '薯片',
        '膨化食品',
        '饼干',
        '蛋糕/面包',
        '月饼',
        '坚果',
        '瓜子/花生',
        '巧克力',
        '糖果',
        '肉干肉脯',
        '卤味零食',
    ],
    饮料: [],
};
export function nameVariantsForCategoryFilter(canonicalName) {
    const c = String(canonicalName ?? '').trim();
    if (!c)
        return [];
    const legacy = LEGACY_LABELS_BY_CANONICAL[c] || [];
    return [...new Set([c, ...legacy])];
}
