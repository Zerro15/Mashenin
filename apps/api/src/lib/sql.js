let pool = null;

export async function createPool(config) {
  const { Pool } = await import("pg");

  if (pool) {
    // Pool already exists — reuse it (idempotent for hot-reload safety)
    return pool;
  }

  pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password
  });

  return pool;
}

export function getPool() {
  if (!pool) {
    throw new Error("sql_pool_not_initialized");
  }

  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
