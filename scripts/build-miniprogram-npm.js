/**
 * frontend 에만 tdesign 등 런타임 의존성 두고, miniprogram-build-npm 은 레포 루트 node_modules 에만 둠.
 * (frontend/node_modules/miniprogram-build-npm 이 있으면 개발자 도구가 miniprogram 코드로 분석하려다 ENOENT 가 남)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const fe = path.join(root, 'frontend');
const buildBin = path.join(root, 'node_modules', 'miniprogram-build-npm', 'bin', 'miniprogram-build-npm.js');
const linkScript = path.join(root, 'scripts', 'link-miniprogram-npm-to-root.js');

if (!fs.existsSync(buildBin)) {
    console.error('[build-miniprogram-npm] missing:', buildBin);
    console.error('Run: npm install   (at repo root, devDependency miniprogram-build-npm)');
    process.exit(1);
}

execSync('npm install --omit=dev', { cwd: fe, stdio: 'inherit' });
execSync(`node "${buildBin}"`, { cwd: fe, stdio: 'inherit' });
execSync(`node "${linkScript}"`, { cwd: root, stdio: 'inherit' });
