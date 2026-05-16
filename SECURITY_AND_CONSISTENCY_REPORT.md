# SECURITY AND CONSISTENCY REPORT

This report provides a comprehensive security and consistency review of the codebase. It flags any identified vulnerabilities (e.g., SQL Injection, Authentication bypasses) and consistency violations (e.g., Singleton Database Pool violations, Missing Auth Checks) based on the project's established conventions in `AGENTS.md`.

## 1. Documented Debt — Do Not Fix

The following issues were identified in `AGENTS.md` and are known debts. They are explicitly marked to not be fixed without instruction.

- **src/app/api/kegiatan/route.ts**: new Pool() locally in api/kegiatan/route.ts
- **src/app/api/kegiatan/[id]/route.ts**: new Pool() locally in api/kegiatan/[id]/route.ts
- **src/app/api/settings/payroll-components/route.ts**: POST accessible by all users in api/settings/payroll-components/route.ts


## 2. New Security Findings & Consistency Violations

The following issues are new findings based on a deep scan of the codebase.

### 2.1 Database Pool Violations (Singleton Requirement)

`AGENTS.md` mandates that the database pool must be a singleton via `import pool from '@/lib/db';` and explicitly forbids `new Pool()` locally.

- **src/app/api/debug/seed-lpj/route.ts**: Local `new Pool()` creation found. This can lead to connection leaks.
- **src/app/api/settings/organisasi/rayon/route.ts**: Local `new Pool()` creation found. This can lead to connection leaks.
- **src/app/api/settings/organisasi/kelompok-sel/route.ts**: Local `new Pool()` creation found. This can lead to connection leaks.
- **src/app/api/insert-dummy/route.ts**: Local `new Pool()` creation found. This can lead to connection leaks.
- **src/app/api/kegiatan/registrasi/saya/route.ts**: Local `new Pool()` creation found. This can lead to connection leaks.
- **src/app/api/kegiatan/validasi-pembayaran/route.ts**: Local `new Pool()` creation found. This can lead to connection leaks.
- **src/app/api/kegiatan/[id]/export/route.ts**: Local `new Pool()` creation found. This can lead to connection leaks.
- **src/app/api/kegiatan/[id]/registrasi/route.ts**: Local `new Pool()` creation found. This can lead to connection leaks.
- **src/app/api/kegiatan/[id]/absensi/route.ts**: Local `new Pool()` creation found. This can lead to connection leaks.
- **src/app/api/kegiatan/[id]/pasien/route.ts**: Local `new Pool()` creation found. This can lead to connection leaks.
- **src/app/api/seed-dummy/route.ts**: Local `new Pool()` creation found. This can lead to connection leaks.


### 2.2 Potential SQL Injection (String Interpolation)

`AGENTS.md` strictly requires all SQL queries to use parameterized values (`$1, $2, ...`) and prohibits string interpolation to prevent SQL injection attacks.

- **src/app/api/settings/organisasi/route.ts**: Potential SQL interpolation detected.
- **src/app/api/master-data/route.ts**: Potential SQL interpolation detected.
- **src/app/api/buku-besar/jurnal/route.ts**: Potential SQL interpolation detected.
- **src/app/api/anggaran/tahunan/route.ts**: Potential SQL interpolation detected.
- **src/app/api/anggaran/kegiatan-options/route.ts**: Potential SQL interpolation detected.
- **src/app/api/laporan/realisasi-kegiatan/route.ts**: Potential SQL interpolation detected.
- **src/server/repositories/akunAkses.repository.ts**: Potential SQL interpolation detected.
- **src/server/repositories/pelayan.repository.ts**: Potential SQL interpolation detected.
- **src/server/repositories/pengurus.repository.ts**: Potential SQL interpolation detected.


### 2.3 Potential Missing Authorization / Consistency Check

`AGENTS.md` mandates that the first line of every handler should be:
```typescript
const caller = getCallerFromRequest(request);
if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
```

The following files might have route handlers that are missing this check at the beginning, potentially allowing unauthorized access.

- **src/app/api/settings/payroll-global/[id]/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/settings/payroll-templates/[id]/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/settings/payroll-components/[id]/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/members/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/members/[id]/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/layanan-pastoral/[id]/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/kegiatan/pastoral/[id]/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/kegiatan/pastoral/[id]/assign/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/kegiatan/pastoral/[id]/status/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/kegiatan/[id]/lpj/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/kegiatan/[id]/lpj/timeline/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/kegiatan/[id]/lpj/review/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/kegiatan/[id]/pelayan/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/push/subscribe/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/pegawai/[id]/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/family-tree/[id]/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/pelayan/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/pelayan/[id]/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/pengurus/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/pengurus/[id]/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/pengurus/[id]/jabatan/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/pengurus/[id]/jabatan/[detail_id]/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/payroll/runs/[id]/komponen/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/payroll/runs/[id]/details/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/payroll/runs/[id]/summary/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/payroll/runs/[id]/submit/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/anggaran/tahunan/[id]/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/anggaran/tahunan/[id]/timeline/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/anggaran/tahunan/[id]/batalkan/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
- **src/app/api/anggaran/tahunan/[id]/review/route.ts**: Potential missing `getCallerFromRequest` call in a route handler.
