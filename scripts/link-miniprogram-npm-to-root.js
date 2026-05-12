/**
 * 部分微信开发者工具在 miniprogramRoot 为子目录(frontend/)时，仍将「/」起头的路径
 * (如 /pages、/miniprogram_npm、/components、/assets) 解析到 project.config.json 所在目录，
 * 而非 frontend/。仓库根에 심볼릭 링크를 두면 해당 no such file 오류를 피할 수 있음。
 *
 * macOS/Linux: node scripts/link-miniprogram-npm-to-root.js
 * 或 레포 루트: npm run miniprogram:link
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const fe = path.join(root, 'frontend');
const targets = [
    ['miniprogram_npm', path.join(fe, 'miniprogram_npm')],
    ['components', path.join(fe, 'components')],
    ['pages', path.join(fe, 'pages')],
    ['custom-tab-bar', path.join(fe, 'custom-tab-bar')],
    ['assets', path.join(fe, 'assets')],
];

for (const [name, dest] of targets) {
    const linkPath = path.join(root, name);
    if (!fs.existsSync(dest)) {
        console.warn('[link-miniprogram-npm] skip (missing):', dest);
        continue;
    }
    try {
        fs.unlinkSync(linkPath);
    }
    catch (_) {}
    try {
        fs.symlinkSync(path.relative(root, dest), linkPath, 'dir');
        console.log('[link-miniprogram-npm]', linkPath, '->', dest);
    }
    catch (e) {
        console.error('[link-miniprogram-npm] failed', name, e.message);
        process.exitCode = 1;
    }
}
