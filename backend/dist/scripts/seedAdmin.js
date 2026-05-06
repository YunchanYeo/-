import 'dotenv/config';
import { upsertAdminByCredentials } from '../adminBootstrap';
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
    const r = await upsertAdminByCredentials(db, username, plainPassword);
    console.log(`[seed-admin] ${r === 'created' ? 'created' : 'updated'}: ${username}`);
}
main().catch((err) => {
    console.error('[seed-admin] failed', err);
    process.exit(1);
});
