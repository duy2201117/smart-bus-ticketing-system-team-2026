import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

function defaultLocalPath() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  // Local demo defaults to RAM so `npm run dev` is reliable on Windows/Node 22.
  // Set DATA_DIR=data/pg explicitly when persistent PGlite storage is desired.
  return process.env.NODE_ENV === 'production' ? 'data/pg' : ':memory:';
}

async function openPglite(path) {
  if (path !== ':memory:') await mkdir(dirname(resolve(path)), { recursive: true });
  const engine = new PGlite(path === ':memory:' ? undefined : resolve(path));
  await engine.waitReady;
  await engine.exec(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  return engine;
}

export async function createDatabase(path = defaultLocalPath(), options = {}) {
  const url = options.databaseUrl ?? process.env.DATABASE_URL;
  let db;
  if (url) {
    const pool = new pg.Pool({ connectionString: url, max: 10 });
    db = {
      dialect: 'postgresql', storageMode: 'postgresql', query: (sql, params = []) => pool.query(sql, params),
      async transaction(callback) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          // One lock order across application transactions avoids seat/payment races.
          await client.query('SELECT pg_advisory_xact_lock(7401)');
          const result = await callback({ query: (sql, params = []) => client.query(sql, params) });
          await client.query('COMMIT');
          return result;
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      },
      close: () => pool.end(),
    };
    const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
    await pool.query(sql);
  } else {
    let engine;
    let storageMode = path === ':memory:' ? 'memory' : 'persistent';
    try {
      engine = await openPglite(path);
    } catch (error) {
      const allowFallback = options.allowMemoryFallback ?? (process.env.DEMO_MODE !== 'false' && process.env.NODE_ENV !== 'production');
      if (!allowFallback || path === ':memory:') throw error;
      console.warn(`[SmartBus DB] Không mở được PGlite tại "${path}" (${error?.message || error}). Chuyển sang database RAM cho phiên demo.`);
      try { await engine?.close?.(); } catch { /* ignore failed engine cleanup */ }
      engine = await openPglite(':memory:');
      storageMode = 'memory-fallback';
    }
    db = {
      dialect: 'pglite', storageMode, query: (sql, params = []) => engine.query(sql, params),
      transaction: callback => engine.transaction(tx => callback({ query: (sql, params = []) => tx.query(sql, params) })),
      close: () => engine.close(),
    };
  }
  // Reference roles are required in both demo and production databases.
  for (const [role, name] of [['admin','Quản trị viên'],['manager','Quản lý'],['driver','Tài xế / Phụ xe'],['passenger','Hành khách']]) {
    await db.query('INSERT INTO roles(id,name) VALUES($1,$2) ON CONFLICT(id) DO NOTHING', [role,name]);
  }
  return db;
}
