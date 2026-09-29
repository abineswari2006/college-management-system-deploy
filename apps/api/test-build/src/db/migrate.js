import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.js';
async function readMigration(fileName) {
    const sourcePath = fileURLToPath(new URL(`../../sql/migrations/${fileName}`, import.meta.url));
    try {
        return await readFile(sourcePath, 'utf8');
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            return readFile(fileURLToPath(new URL(`../../../sql/migrations/${fileName}`, import.meta.url)), 'utf8');
        }
        throw error;
    }
}
const migrations = [
    {
        version: '0001_initial',
        sql: readMigration('0001_initial.sql'),
    },
    {
        version: '0002_system_administration',
        sql: readMigration('0002_system_administration.sql'),
    },
    {
        version: '0003_auth_rate_limits',
        sql: readMigration('0003_auth_rate_limits.sql'),
    },
];
export async function migrateDatabase(database) {
    await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
    for (const migration of migrations) {
        const applied = await database.query('SELECT version FROM schema_migrations WHERE version = $1', [migration.version]);
        if (applied.rows.length > 0)
            continue;
        await database.transaction(async (executor) => {
            await executor.executeScript(await migration.sql);
            await executor.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration.version]);
        });
    }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const database = await openDatabase();
    try {
        await migrateDatabase(database);
        console.log('Database migrations are up to date.');
    }
    finally {
        await database.close();
    }
}
