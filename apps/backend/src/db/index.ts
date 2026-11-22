import { Pool, PoolClient } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface IDatabase {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  transaction<T>(callback: (client: IDatabaseClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  getEngineType(): 'postgres' | 'pglite';
}

export interface IDatabaseClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
}

class PostgresDatabase implements IDatabase {
  private pool: Pool;

  constructor(connectionString: string) {
    const isCloud = connectionString.includes('sslmode=') ||
                    connectionString.includes('neon.tech') ||
                    connectionString.includes('supabase.co') ||
                    connectionString.includes('render.com') ||
                    connectionString.includes('railway.app') ||
                    process.env.NODE_ENV === 'production';

    this.pool = new Pool({
      connectionString,
      ssl: isCloud ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle PostgreSQL client:', err);
    });
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const res = await this.pool.query(text, params);
    return {
      rows: res.rows as T[],
      rowCount: res.rowCount ?? 0,
    };
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async transaction<T>(callback: (client: IDatabaseClient) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const wrappedClient: IDatabaseClient = {
        query: async <R = any>(sql: string, p?: any[]) => {
          const res = await client.query(sql, p);
          return { rows: res.rows as R[], rowCount: res.rowCount ?? 0 };
        },
      };
      const result = await callback(wrappedClient);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  getEngineType(): 'postgres' {
    return 'postgres';
  }
}

class PGliteDatabase implements IDatabase {
  private pglite: PGlite | null = null;
  private dataDir: string;
  private initPromise: Promise<void> | null = null;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  private async ensureInit(): Promise<PGlite> {
    if (this.pglite) return this.pglite;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        if (this.dataDir && this.dataDir !== ':memory:') {
          const resolvedPath = path.resolve(process.cwd(), this.dataDir);
          fs.mkdirSync(resolvedPath, { recursive: true });
          this.pglite = new PGlite(resolvedPath);
        } else {
          this.pglite = new PGlite();
        }
        await this.pglite.waitReady;
      })();
    }

    await this.initPromise;
    return this.pglite!;
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const db = await this.ensureInit();
    const res = await db.query(text, params);
    return {
      rows: (res.rows || []) as T[],
      rowCount: res.affectedRows ?? res.rows?.length ?? 0,
    };
  }

  async exec(sql: string): Promise<void> {
    const db = await this.ensureInit();
    await db.exec(sql);
  }

  async transaction<T>(callback: (client: IDatabaseClient) => Promise<T>): Promise<T> {
    const db = await this.ensureInit();
    return await db.transaction(async (tx) => {
      const wrappedClient: IDatabaseClient = {
        query: async <R = any>(sql: string, p?: any[]) => {
          const res = await tx.query(sql, p);
          return {
            rows: (res.rows || []) as R[],
            rowCount: res.affectedRows ?? res.rows?.length ?? 0,
          };
        },
      };
      return await callback(wrappedClient);
    });
  }

  async close(): Promise<void> {
    if (this.pglite) {
      await this.pglite.close();
      this.pglite = null;
      this.initPromise = null;
    }
  }

  getEngineType(): 'pglite' {
    return 'pglite';
  }
}

// Factory instantiation
let dbInstance: IDatabase;

export function getDatabase(): IDatabase {
  if (!dbInstance) {
    const dbUrl = (env.DATABASE_URL || '').trim();
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      console.log('[DB] Connecting to external PostgreSQL database via connection string.');
      dbInstance = new PostgresDatabase(dbUrl);
    } else {
      console.log(`[DB] Using embedded PostgreSQL engine (PGlite) with directory: ${env.DATABASE_DATA_DIR}`);
      dbInstance = new PGliteDatabase(env.DATABASE_DATA_DIR);
    }
  }
  return dbInstance;
}

export const db = {
  query: <T = any>(text: string, params?: any[]) => getDatabase().query<T>(text, params),
  exec: (sql: string) => getDatabase().exec(sql),
  transaction: <T>(callback: (client: IDatabaseClient) => Promise<T>) => getDatabase().transaction<T>(callback),
  close: async () => {
    if (dbInstance) {
      await dbInstance.close();
      dbInstance = null as any;
    }
  },
  getEngineType: () => getDatabase().getEngineType(),
};
