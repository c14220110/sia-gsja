const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyb2xlX2lkIjoxLCJyb2xlX25hbWUiOiJTVVBFUl9BRE1JTiIsInNhdGVsaXRfaWQiOjEsImtvbWlzaV9pZCI6bnVsbCwiZGVwYXJ0ZW1lbl9pZCI6bnVsbCwiaXNfc3VwZXJfYWRtaW4iOnRydWUsInBlcm1pc3Npb25zIjpbImplbWFhdF92aWV3IiwiamVtYWF0X2NyZWF0ZSIsImplbWFhdF9lZGl0IiwicGVsYXlhbl92aWV3IiwicGVsYXlhbl9tYW5hZ2UiLCJwZW5ndXJ1c192aWV3IiwicGVuZ3VydXNfbWFuYWdlIiwia2VnaWF0YW5fdmlldyIsImtlZ2lhdGFuX2NyZWF0ZSIsImtlZ2lhdGFuX2VkaXQiLCJhYnNlbnNpX2lucHV0IiwiYWJzZW5zaV9lZGl0Iiwia2FzX3ZpZXciLCJrYXNfaW5wdXQiLCJwcm9wb3NhbF9jcmVhdGUiLCJwcm9wb3NhbF9hcHByb3ZlX21hamVsaXMiLCJwcm9wb3NhbF9hcHByb3ZlX2JlbmRhaGFyYSIsImxwal9pbnB1dCIsImxwal9hcHByb3ZlIiwiYWtzZXNfc2VtZW50YXJhX21hbmFnZSIsIm1hc3Rlcl9kYXRhX21hbmFnZSIsImF1ZGl0X2xvZ192aWV3IiwidXNlcl9hY2Nlc3NfbWFuYWdlIiwiamVtYWF0X2RlbGV0ZSIsImtlZ2lhdGFuX21hbmFnZSI';

async function testAll() {
  const kpis = ['kpi1', 'kpi2', 'kpi3', 'kpi4', 'kpi5', 'kpi6', 'kpi7', 'kpi8', 'kpi9', 'kpi10', 'kpi11', 'kpi12'];
  for (const kpi of kpis) {
    try {
      const res = await fetch(`http://localhost:3000/api/dashboard/bsc/trend?kpi=${kpi}&bulan=6`, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Cookie': `auth_token=${jwt}`
        }
      });
      const data = await res.json();
      console.log(`=== KPI: ${kpi} ===`);
      console.log('Success:', data.success);
      if (data.success) {
        console.log('Data length:', data.data?.length);
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
