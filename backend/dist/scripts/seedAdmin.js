import 'dotenv/config';
import bcrypt from 'bcrypt';
import { getDb } from '../db';
/**
 * Ensures an admin account exists using environment variables.
 * Required env:
 * - ADMIN_USERNAME
 * - ADMIN_PASSWORD (plaintext for seeding only)
 */
async function main() {
    const username = String(process.env.ADMIN_USERNAME || '').trim();
    const plainPassword = String(process.env.ADMIN_PASSWORD || '').trim();
    if (!username || !plainPassword) {
        throw new Error('Missing env: ADMIN_USERNAME / ADMIN_PASSWORD');
    }
    const db = getDb();
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const exists = db.prepare(`SELECT id FROM admins WHERE username = ?`).get(username);
    if (exists) {
        db.prepare(`UPDATE admins SET passwordHash = ?, updatedAt = datetime('now') WHERE id = ?`).run(passwordHash, exists.id);
        console.log(`[seed-admin] updated: ${username}`);
        return;
    }
    db.prepare(`INSERT INTO admins (username, password, passwordHash, createdAt, updatedAt)
     VALUES (?, '', ?, datetime('now'), datetime('now'))`).run(username, passwordHash);
    console.log(`[seed-admin] created: ${username}`);
}
main().catch((err) => {
    console.error('[seed-admin] failed', err);
    process.exit(1);
});
