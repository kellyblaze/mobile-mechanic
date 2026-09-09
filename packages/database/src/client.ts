import { Pool, type PoolClient, type QueryResultRow } from 'pg';

export type Database = { pool: Pool; withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T>; query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<T[]>; close(): Promise<void> };

export function createDatabase(connectionString = process.env.DATABASE_URL): Database | null {
  if (!connectionString) return null;
  const pool = new Pool({ connectionString, max: Number(process.env.DB_POOL_SIZE ?? 10), ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined });
  return {
    pool,
    async query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) { const result = await pool.query<T>(text, values); return result.rows; },
    async withTransaction<T>(work: (client: PoolClient) => Promise<T>) { const client = await pool.connect(); try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } },
    close: () => pool.end()
  };
}
