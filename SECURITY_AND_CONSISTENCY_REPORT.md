# SECURITY AND CONSISTENCY REPORT (DEEP SCAN)

This report provides a comprehensive security and consistency review of the codebase. It has been updated to include findings from a deeper, semantic analysis of the codebase, covering Business Logic Vulnerabilities, Insecure Direct Object References (IDOR), Hardcoded Credentials/IDs, Weak Role-Based Access Control (RBAC), and potential Cross-Site Scripting (XSS).

## 1. Documented Debt — Do Not Fix

The following issues were identified in `AGENTS.md` and are known debts. They are explicitly marked to not be fixed without instruction.

- **src/app/api/kegiatan/route.ts**: new Pool() locally in api/kegiatan/route.ts
- **src/app/api/kegiatan/[id]/route.ts**: new Pool() locally in api/kegiatan/[id]/route.ts
- **src/app/api/settings/payroll-components/route.ts**: POST accessible by all users in api/settings/payroll-components/route.ts

## 2. New Security Findings & Consistency Violations

### 2.1 Weak RBAC / Insecure Direct Object Reference (IDOR) Vulnerabilities

The following API routes invoke `getCallerFromRequest()` to authenticate the user but fail to properly utilize the `caller` context (e.g., `caller.user_id`, `caller.satelit_id`, `caller.role_name`) in the subsequent database queries (such as `UPDATE` or `DELETE`). This relies solely on the client-provided `id` parameter, meaning any authenticated user could potentially manipulate or delete data belonging to other users or organizations by simply guessing the `id` (IDOR).

- **src/app/api/settings/payroll-global/[id]/route.ts**: (PUT) Does not validate if the caller has permissions to modify global payroll settings.
- **src/app/api/settings/payroll-templates/[id]/route.ts**: (PUT/DELETE) Does not validate ownership or authorization.
- **src/app/api/settings/payroll-components/[id]/route.ts**: (PUT/DELETE) Does not validate ownership or authorization.
- **src/app/api/kegiatan/[id]/route.ts**: (PUT/DELETE) Does not check if the caller is authorized for the specific `kegiatan_id` or `satelit_id`.
- **src/app/api/kegiatan/[id]/registrasi/route.ts**: (PUT) Missing specific authorization constraints.
- **src/app/api/buku-besar/coa/route.ts**: (PUT/DELETE) Missing specific authorization constraints.
- **src/app/api/pelayan/jadwal-saya/konfirmasi/route.ts**: (PUT) Requires validation to ensure the caller can only confirm their *own* schedule.
- **src/app/api/pegawai/[id]/route.ts**: (PUT/DELETE) Updates rely solely on the ID in the URL without restricting to authorized roles or matching satelit.
- **src/app/api/anggaran/tahunan/[id]/route.ts**: (PUT/DELETE) Missing authorization constraints specific to the caller's permissions over the budget ID.
- **src/app/api/anggaran/tahunan/[id]/review/route.ts**: (PUT) Needs rigorous checks to ensure only authorized reviewers can approve/reject.

### 2.2 Hardcoded Role IDs and Identifiers

The codebase contains several instances of hardcoded IDs (e.g., `role_id = 7`, `id === 4`). Hardcoding IDs is a severe anti-pattern that leads to brittleness, especially across different environments (dev/staging/prod) where database sequences may generate different IDs. It also violates the `AGENTS.md` directive: "Hardcode user_id, role_id, satelit_id di kode produksi" is strictly forbidden.

- **src/app/api/kegiatan/pastoral/[id]/assign/route.ts**: Hardcoded `role_id = 21`.
- **src/app/api/kegiatan/pastoral/pic-options/route.ts**: Hardcoded `role_id = 21`.
- **src/app/(main)/layout.tsx**: Hardcoded `role_id = 7` checks.
- **src/app/(main)/pegawai/new/page.tsx**: Hardcoded `id === 4`.
- **src/app/(main)/pegawai/[id]/page.tsx**: Hardcoded `id === 5`.
- **src/app/(main)/pegawai/penggajian/new/page.tsx**: Hardcoded `id === 3`.
- **src/app/(main)/pegawai/penggajian/[id]/edit/page.tsx**: Hardcoded `id === 3`.
- **src/app/(main)/anggaran/rancangan/new/page.tsx**: Hardcoded `role_id === 8`, `role_id === 6`, `role_id === 7`, `role_id === 10`.
- **src/app/(main)/anggaran/rancangan/edit/[id]/page.tsx**: Hardcoded `role_id === 8`, `role_id === 6`, `role_id === 7`, `role_id === 10`.

### 2.3 Database Pool Violations (Singleton Requirement)

`AGENTS.md` mandates that the database pool must be a singleton via `import pool from '@/lib/db';` and explicitly forbids `new Pool()` locally. This is a critical consistency and performance issue.

- **src/app/api/debug/seed-lpj/route.ts**
- **src/app/api/settings/organisasi/rayon/route.ts**
- **src/app/api/settings/organisasi/kelompok-sel/route.ts**
- **src/app/api/insert-dummy/route.ts**
- **src/app/api/kegiatan/registrasi/saya/route.ts**
- **src/app/api/kegiatan/validasi-pembayaran/route.ts**
- **src/app/api/kegiatan/[id]/export/route.ts**
- **src/app/api/kegiatan/[id]/registrasi/route.ts**
- **src/app/api/kegiatan/[id]/absensi/route.ts**
- **src/app/api/kegiatan/[id]/pasien/route.ts**
- **src/app/api/seed-dummy/route.ts**

### 2.4 Potential SQL Injection (String Interpolation)

`AGENTS.md` strictly requires all SQL queries to use parameterized values (`$1, $2, ...`) and prohibits string interpolation to prevent SQL injection attacks.

- **src/app/api/settings/organisasi/route.ts**
- **src/app/api/master-data/route.ts**
- **src/app/api/buku-besar/jurnal/route.ts**
- **src/app/api/anggaran/tahunan/route.ts**
- **src/app/api/anggaran/kegiatan-options/route.ts**
- **src/app/api/laporan/realisasi-kegiatan/route.ts**
- **src/server/repositories/akunAkses.repository.ts**
- **src/server/repositories/pelayan.repository.ts**
- **src/server/repositories/pengurus.repository.ts**

### 2.5 Potential Missing Authorization / Consistency Check

The following files might have route handlers that are missing the mandatory `getCallerFromRequest` check at the beginning, potentially allowing completely unauthorized access.

- **src/app/api/push/subscribe/route.ts**
- **src/app/api/pegawai/[id]/route.ts**
- **src/app/api/family-tree/[id]/route.ts**
- **src/app/api/pelayan/route.ts**
- **src/app/api/pelayan/[id]/route.ts**
- **src/app/api/pengurus/route.ts**
- **src/app/api/pengurus/[id]/route.ts**
- **src/app/api/pengurus/[id]/jabatan/route.ts**
- **src/app/api/pengurus/[id]/jabatan/[detail_id]/route.ts**
- **src/app/api/payroll/runs/[id]/komponen/route.ts**
- **src/app/api/payroll/runs/[id]/details/route.ts**
- **src/app/api/payroll/runs/[id]/summary/route.ts**
- **src/app/api/payroll/runs/[id]/submit/route.ts**
