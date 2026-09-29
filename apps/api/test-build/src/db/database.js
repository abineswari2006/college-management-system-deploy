import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
class PostgresDatabase {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async query(text, values = []) {
        const result = values.length
            ? await this.pool.query(text, values)
            : await this.pool.query(text);
        return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    }
    async executeScript(text) {
        await this.pool.query(text);
    }
    async transaction(work) {
        const client = await this.pool.connect();
        const executor = {
            query: async (text, values = []) => {
                const result = await client.query(text, values);
                return { rows: result.rows, rowCount: result.rowCount ?? 0 };
            },
            executeScript: async (text) => {
                await client.query(text);
            },
        };
        try {
            await client.query('BEGIN');
            const result = await work(executor);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async close() {
        await this.pool.end();
    }
}
class EmbeddedPostgresDatabase {
    client;
    constructor(client) {
        this.client = client;
    }
    async query(text, values = []) {
        const result = await this.client.query(text, values);
        return { rows: result.rows, rowCount: result.rows.length };
    }
    async executeScript(text) {
        await this.client.exec(text);
    }
    async transaction(work) {
        await this.client.exec('BEGIN');
        try {
            const result = await work(this);
            await this.client.exec('COMMIT');
            return result;
        }
        catch (error) {
            await this.client.exec('ROLLBACK');
            throw error;
        }
    }
    async close() {
        await this.client.close();
    }
}
export function wrapPGlite(client) {
    return new EmbeddedPostgresDatabase(client);
}
export async function openDatabase() {
    if (process.env.DATABASE_URL) {
        return new PostgresDatabase(new Pool({
            connectionString: process.env.DATABASE_URL,
            max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
            ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
        }));
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('DATABASE_URL is required in production.');
    }
    const client = new PGlite(process.env.PGLITE_DATA_DIR ?? '.pglite');
    await client.waitReady;
    return new EmbeddedPostgresDatabase(client);
}
export const DATABASE = Symbol('DATABASE');
