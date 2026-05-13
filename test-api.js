const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyb2xlX2lkIjoxLCJyb2xlX25hbWUiOiJTVVBFUl9BRE1JTiIsInNhdGVsaXRfaWQiOjEsImtvbWlzaV9pZCI6bnVsbCwiZGVwYXJ0ZW1lbl9pZCI6bnVsbCwiaXNfc3VwZXJfYWRtaW4iOnRydWUsInBlcm1pc3Npb25zIjpbImplbWFhdF92aWV3IiwiamVtYWF0X2NyZWF0ZSIsImplbWFhdF9lZGl0IiwicGVsYXlhbl92aWV3IiwicGVsYXlhbl9tYW5hZ2UiLCJwZW5ndXJ1c192aWV3IiwicGVuZ3VydXNfbWFuYWdlIiwia2VnaWF0YW5fdmlldyIsImtlZ2lhdGFuX2NyZWF0ZSIsImtlZ2lhdGFuX2VkaXQiLCJhYnNlbnNpX2lucHV0IiwiYWJzZW5zaV9lZGl0Iiwia2FzX3ZpZXciLCJrYXNfaW5wdXQiLCJwcm9wb3NhbF9jcmVhdGUiLCJwcm9wb3NhbF9hcHByb3ZlX21hamVsaXMiLCJwcm9wb3NhbF9hcHByb3ZlX2JlbmRhaGFyYSIsImxwal9pbnB1dCIsImxwal9hcHByb3ZlIiwiYWtzZXNfc2VtZW50YXJhX21hbmFnZSIsIm1hc3Rlcl9kYXRhX21hbmFnZSIsImF1ZGl0X2xvZ192aWV3IiwidXNlcl9hY2Nlc3NfbWFuYWdlIiwiamVtYWF0X2RlbGV0ZSIsImtlZ2lhdGFuX21hbmFnZSI';

fetch('http://localhost:3000/api/settings/akun-akses/roles', {
  headers: {
    'Authorization': `Bearer ${jwt}`,
    'Cookie': `auth_token=${jwt}`
  }
}).then(res => res.json()).then(data => {
  console.log("Total Permissions:", data.data.permissions.length);
  const permNames = data.data.permissions.map(p => p.nama_permission);
  console.log(permNames);
}).catch(console.error);
