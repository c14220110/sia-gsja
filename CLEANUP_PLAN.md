# CLEANUP PLAN

## 1. Files to Delete Before Production
The following files are debugging, seeding, migration, or temporary fix scripts. They are not referenced by any core UI components and represent a severe security risk if left in a production environment as they could be exploited to manipulate the database or leak information.

- `[ ] src/app/api/debug/seed-lpj/route.ts` (Safe to delete: One-off utility/seed script not referenced in frontend source)
- `[ ] src/app/api/insert-dummy/route.ts` (Safe to delete: One-off utility/seed script not referenced in frontend source)
- `[ ] src/app/api/setup-jurnal/route.ts` (Safe to delete: One-off utility/seed script not referenced in frontend source)
- `[ ] src/app/api/fix-coa/route.ts` (Safe to delete: One-off utility/seed script not referenced in frontend source)
- `[ ] src/app/api/update-ids/route.ts` (Safe to delete: One-off utility/seed script not referenced in frontend source)
- `[ ] src/app/api/migration-temp/route.ts` (Safe to delete: One-off utility/seed script not referenced in frontend source)
- `[ ] src/app/api/fix-db/route.ts` (Safe to delete: One-off utility/seed script not referenced in frontend source)
- `[ ] src/app/api/seed-dummy/route.ts` (Safe to delete: One-off utility/seed script not referenced in frontend source)
- `[ ] src/app/api/migration-coa/route.ts` (Safe to delete: One-off utility/seed script not referenced in frontend source)

## 2. Prioritized Fix Roadmap

### Critical Severity
**Vulnerabilities that allow unauthorized access, data destruction, or complete system compromise.**

#### Missing Authentication (`getCallerFromRequest`)
*These endpoints currently allow unauthenticated public access.*
- **Action**: Add auth check to the top of the route handler.
- **Fix Pattern**: `const caller = getCallerFromRequest(request); if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });`
  - `[ ] src/app/api/push/subscribe/route.ts`
  - `[ ] src/app/api/pegawai/[id]/route.ts`
  - `[ ] src/app/api/family-tree/[id]/route.ts`
  - `[ ] src/app/api/pelayan/route.ts`
  - `[ ] src/app/api/pelayan/[id]/route.ts`
  - `[ ] src/app/api/pengurus/route.ts`
  - `[ ] src/app/api/pengurus/[id]/route.ts`
  - `[ ] src/app/api/pengurus/[id]/jabatan/route.ts`
  - `[ ] src/app/api/pengurus/[id]/jabatan/[detail_id]/route.ts`
  - `[ ] src/app/api/payroll/runs/[id]/komponen/route.ts`
  - `[ ] src/app/api/payroll/runs/[id]/details/route.ts`
  - `[ ] src/app/api/payroll/runs/[id]/summary/route.ts`
  - `[ ] src/app/api/payroll/runs/[id]/submit/route.ts`

#### Potential SQL Injection (String Interpolation)
*These queries use string interpolation (``...${val}...``) instead of parameterization (`$1`).*
- **Action**: Convert to strict parameterized inputs.
- **Fix Pattern**: `await client.query('SELECT * FROM table WHERE col = $1', [val]);`
  - `[ ] src/app/api/settings/organisasi/route.ts`
  - `[ ] src/app/api/master-data/route.ts`
  - `[ ] src/app/api/buku-besar/jurnal/route.ts`
  - `[ ] src/app/api/anggaran/tahunan/route.ts`
  - `[ ] src/app/api/anggaran/kegiatan-options/route.ts`
  - `[ ] src/app/api/laporan/realisasi-kegiatan/route.ts`
  - `[ ] src/server/repositories/akunAkses.repository.ts`
  - `[ ] src/server/repositories/pelayan.repository.ts`
  - `[ ] src/server/repositories/pengurus.repository.ts`

#### Insecure Direct Object Reference (IDOR) & Weak RBAC
*These endpoints rely solely on the URL `id` parameter for UPDATE/DELETE without checking if the caller owns the entity or has specific permissions/satelit matches.*
- **Action**: Incorporate `caller.user_id`, `caller.satelit_id`, or `caller.permissions.includes(...)` into the query or logic.
- **Fix Pattern**: `await client.query('UPDATE table SET ... WHERE id = $1 AND satelit_id = $2', [id, caller.satelit_id]);`
  - `[ ] src/app/api/settings/payroll-global/[id]/route.ts`
  - `[ ] src/app/api/settings/payroll-templates/[id]/route.ts`
  - `[ ] src/app/api/settings/payroll-components/[id]/route.ts`
  - `[ ] src/app/api/kegiatan/[id]/route.ts`
  - `[ ] src/app/api/kegiatan/[id]/registrasi/route.ts`
  - `[ ] src/app/api/buku-besar/coa/route.ts`
  - `[ ] src/app/api/pelayan/jadwal-saya/konfirmasi/route.ts`
  - `[ ] src/app/api/pegawai/[id]/route.ts`
  - `[ ] src/app/api/anggaran/tahunan/[id]/route.ts`
  - `[ ] src/app/api/anggaran/tahunan/[id]/review/route.ts`

### High Severity
**Issues that cause architectural brittleness or break functionality across environments.**

#### Hardcoded Identifiers (`role_id`, `id`)
*These files contain hardcoded database IDs which will break if sequences differ between dev/staging/prod.*
- **Action**: Query the role/entity by name or string constant rather than integer ID.
- **Fix Pattern**: `const role = await client.query('SELECT id FROM roles WHERE nama_role = $1', ['KEUANGAN']);`
  - `[ ] src/app/api/kegiatan/pastoral/[id]/assign/route.ts`
  - `[ ] src/app/api/kegiatan/pastoral/pic-options/route.ts`
  - `[ ] src/app/(main)/layout.tsx`
  - `[ ] src/app/(main)/pegawai/new/page.tsx`
  - `[ ] src/app/(main)/pegawai/[id]/page.tsx`
  - `[ ] src/app/(main)/pegawai/penggajian/new/page.tsx`
  - `[ ] src/app/(main)/pegawai/penggajian/[id]/edit/page.tsx`
  - `[ ] src/app/(main)/anggaran/rancangan/new/page.tsx`
  - `[ ] src/app/(main)/anggaran/rancangan/edit/[id]/page.tsx`

### Medium Severity
**Consistency violations, resource leaks, and missing audit trails.**

#### Database Pool Singleton Violations (`new Pool()`)
*These routes instantiate a local connection pool, leading to connection leaks and database exhaustion.* (Note: Some are known debt listed in AGENTS.md, others are in files to be deleted. Only fix the ones remaining in core files).
- **Action**: Replace local `new Pool()` with the singleton import.
- **Fix Pattern**: `import pool from '@/lib/db';`
  - `[ ] src/app/api/settings/organisasi/rayon/route.ts`
  - `[ ] src/app/api/settings/organisasi/kelompok-sel/route.ts`
  - `[ ] src/app/api/kegiatan/registrasi/saya/route.ts`
  - `[ ] src/app/api/kegiatan/validasi-pembayaran/route.ts`
  - `[ ] src/app/api/kegiatan/[id]/export/route.ts`
  - `[ ] src/app/api/kegiatan/[id]/registrasi/route.ts`
  - `[ ] src/app/api/kegiatan/[id]/absensi/route.ts`
  - `[ ] src/app/api/kegiatan/[id]/pasien/route.ts`
