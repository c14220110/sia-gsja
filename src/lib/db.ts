import { Pool, types } from 'pg';

// Override the date type parser (OID 1082) so that it returns the date string directly (e.g. 'YYYY-MM-DD')
// instead of creating a Date object that gets shifted by local timezone differences.
types.setTypeParser(1082, (val) => val);

let pool: Pool;

declare global {
  // eslint-disable-next-line no-var
  var mongooseCurrentPool: Pool | undefined;
}

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
} else {
  if (!globalThis.mongooseCurrentPool) {
    globalThis.mongooseCurrentPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    });
  }
  pool = globalThis.mongooseCurrentPool;
}

export default pool;
