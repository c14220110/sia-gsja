const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes('aws-1-ap-southeast-1.pooler.supabase.com')) {
    connectionString = connectionString.replace('aws-1-ap-southeast-1.pooler.supabase.com', 'db.zvyvnvkswedmjwmdnngz.supabase.co');
}

const pool = new Pool({ connectionString: connectionString });

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE public.permohonan_layanan_pastoral 
      ADD COLUMN IF NOT EXISTS kegiatan_id integer;
    `);
    
    // Attempt to add foreign key if it does not exist
    try {
        await client.query(`
          ALTER TABLE public.permohonan_layanan_pastoral 
          ADD CONSTRAINT permohonan_kegiatan_fk 
          FOREIGN KEY (kegiatan_id) REFERENCES public.kegiatan(id) ON DELETE SET NULL;
        `);
    } catch (e) {
        if (!e.message.includes('already exists')) {
            console.error('FK Add Error (ignored):', e.message);
        }
    }
    
    console.log("Database updated successfully");
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}
run();
