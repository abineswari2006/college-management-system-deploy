import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';

export interface QueryExecutor {
  query<Row extends object = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Row[]; rowCount: number }>;
  executeScript(text: string): Promise<void>;
}

export interface SqlDatabase extends QueryExecutor {
  transaction<T>(work: (executor: QueryExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

class PostgresDatabase implements SqlDatabase {
  constructor(private readonly pool: Pool) {}

  async query<Row extends object = Record<string, unknown>>(
    text: string,
    values: unknown[] = [],
  ) {
    const result = values.length
      ? await this.pool.query(text, values)
      : await this.pool.query(text);
    return { rows: result.rows as Row[], rowCount: result.rowCount ?? 0 };
  }

  async executeScript(text: string) {
    await this.pool.query(text);
  }

  async transaction<T>(work: (executor: QueryExecutor) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const executor: QueryExecutor = {
      query: async <Row extends object>(text: string, values: unknown[] = []) => {
        const result = await client.query(text, values);
        return { rows: result.rows as Row[], rowCount: result.rowCount ?? 0 };
      },
      executeScript: async (text: string) => {
        await client.query(text);
      },
    };

    try {
      await client.query('BEGIN');
      const result = await work(executor);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

class EmbeddedPostgresDatabase implements SqlDatabase {
  constructor(private readonly client: PGlite) {}

  async query<Row extends object = Record<string, unknown>>(
    text: string,
    values: unknown[] = [],
  ) {
    const result = await this.client.query(text, values);
    return { rows: result.rows as Row[], rowCount: result.rows.length };
  }

  async executeScript(text: string) {
    await this.client.exec(text);
  }

  async transaction<T>(work: (executor: QueryExecutor) => Promise<T>): Promise<T> {
    await this.client.exec('BEGIN');
    try {
      const result = await work(this);
      await this.client.exec('COMMIT');
      return result;
    } catch (error) {
      await this.client.exec('ROLLBACK');
      throw error;
    }
  }

  async close() {
    await this.client.close();
  }
}

export function wrapPGlite(client: PGlite): SqlDatabase {
  return new EmbeddedPostgresDatabase(client);
}

export async function openDatabase(): Promise<SqlDatabase> {
  if (process.env.DATABASE_URL) {
    return new PostgresDatabase(
      new Pool({
        connectionString: process.env.DATABASE_URL,
        max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
      }),
    );
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required in production.');
  }

  const client = new PGlite(process.env.PGLITE_DATA_DIR ?? '.pglite');
  await client.waitReady;
  return new EmbeddedPostgresDatabase(client);
}

export const DATABASE = Symbol('DATABASE');