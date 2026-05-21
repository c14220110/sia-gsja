const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env.local' });

const secret = process.env.JWT_SECRET || 'super-secret-jwt-key-for-local-development';
const payload = {
  user_id: 1,
  role_id: 1,
  satelit_id: 1,
  role_name: 'SUPER_ADMIN',
  is_super_admin: true,
  permissions: ['jemaat_view', 'kegiatan_view']
};

const token = jwt.sign(payload, secret, { expiresIn: '1h' });

async function testAll() {
  const kpis = ['kpi1', 'kpi2', 'kpi3', 'kpi4', 'kpi5', 'kpi6', 'kpi7', 'kpi8', 'kpi9', 'kpi10', 'kpi11', 'kpi12'];
  for (const kpi of kpis) {
    try {
      const res = await fetch(`http://localhost:3000/api/dashboard/bsc/trend?kpi=${kpi}&bulan=6`, {
        headers: {
          'Cookie': `access_token=${token}`
        }
      });
      const data = await res.json();
      console.log(`=== KPI: ${kpi} ===`);
      console.log('Success:', data.success);
      if (data.success) {
        console.log('Sample data:', data.data);
      } else {
        console.log('Error message:', data.message);
      }
    } catch (e) {
      console.error(`Fetch failed for ${kpi}:`, e.message);
    }
  }
}

testAll();
