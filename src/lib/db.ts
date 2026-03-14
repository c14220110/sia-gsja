import { Pool } from 'pg';

let pool: Pool;

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
} else {
  // @ts-ignore
  if (!globalThis.mongooseCurrentPool) {
    // @ts-ignore
    globalThis.mongooseCurrentPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  // @ts-ignore
  pool = globalThis.mongooseCurrentPool;
}

export default pool;
