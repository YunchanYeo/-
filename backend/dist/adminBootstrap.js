import bcrypt from 'bcrypt';
export async function upsertAdminByCredentials(db, username, plainPassword) {
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const exists = db.prepare(`SELECT id FROM admins WHERE username = ?`).get(username);
    if (exists) {
        db.prepare(`UPDATE admins SET passwordHash = ?, sessionToken = NULL, updatedAt = datetime('now') WHERE id = ?`).run(passwordHash, exists.id);
        return 'updated';
    }
    db.prepare(`INSERT INTO admins (username, password, passwordHash, createdAt, updatedAt)
     VALUES (?, '', ?, datetime('now'), datetime('now'))`).run(username, passwordHash);
    return 'created';
}
/** admins 테이블이 비어 있으면 ADMIN_USERNAME / ADMIN_PASSWORD 로 1명 생성 */
export async function bootstrapAdminIfDbEmpty(db) {
    const { c } = db.prepare(`SELECT COUNT(*) as c FROM admins`).get();
    if (c > 0)
        return;
    const username = String(process.env.ADMIN_USERNAME || '').trim();
    const plainPassword = String(process.env.ADMIN_PASSWORD || '').trim();
    if (!username || !plainPassword) {
        console.warn('[backend] 관리자 계정이 없습니다. backend/.env 에 ADMIN_USERNAME·ADMIN_PASSWORD 를 넣거나 `npm run seed:admin` 을 실행하세요.');
        return;
    }
    const r = await upsertAdminByCredentials(db, username, plainPassword);
    console.log(`[backend] 초기 관리자 ${r === 'created' ? '생성' : '갱신'}: ${username}`);
}
/**
 * true 이면 매 서버 기동 시 ADMIN_USERNAME 의 비밀번호를 ADMIN_PASSWORD 로 덮어씀.
 * 미니프로그램·PC 관리자 로그인을 동일하게 맞출 때 사용 (운영에서는 false 권장).
 */
export async function syncAdminPasswordFromEnvOnStart(db) {
    if (process.env.ADMIN_SYNC_ON_START !== 'true')
        return;
    const username = String(process.env.ADMIN_USERNAME || '').trim();
    const plainPassword = String(process.env.ADMIN_PASSWORD || '').trim();
    if (!username || !plainPassword) {
        console.warn('[backend] ADMIN_SYNC_ON_START=true 인데 ADMIN_USERNAME 또는 ADMIN_PASSWORD 가 비어 있습니다.');
        return;
    }
    await upsertAdminByCredentials(db, username, plainPassword);
    console.log(`[backend] ADMIN_SYNC_ON_START: "${username}" 비밀번호를 .env 와 동기화했습니다. (미니프로그램·PC 동일 로그인)`);
}
