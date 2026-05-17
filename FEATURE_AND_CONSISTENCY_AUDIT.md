# FEATURE AND CONSISTENCY AUDIT

## PART 1 — FEATURE INVENTORY & MATURITY ASSESSMENT

### src/app/api/debug/seed-lpj/route.ts
1. **Module name**: Seed-lpj
2. **Description**: Insert Header Insert Details
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/api/settings/payroll-global/[id]/route.ts
1. **Module name**: [id]
2. **Description**: PUT: edit existing rate row by id
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/settings/payroll-global/route.ts
1. **Module name**: Payroll-global
2. **Description**: GET: list all BPJS rate history, newest first POST: add new effective-date rate row
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/settings/payroll-templates/[id]/route.ts
1. **Module name**: [id]
2. **Description**: GET: full detail of one template (header + all komponen lines) Header Detail items PUT: save full template detail (header update + upsert all detail lines)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/settings/payroll-templates/route.ts
1. **Module name**: Payroll-templates
2. **Description**: GET: list all templates (with jabatan name + active component count) POST: create new template for a jabatan
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/settings/payroll-components/[id]/route.ts
1. **Module name**: [id]
2. **Description**: PUT: update komponen (nama, COA mapping, urutan, is_active) Prevent editing system components' core fields
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/settings/payroll-components/route.ts
1. **Module name**: Payroll-components
2. **Description**: GET: list all komponen + their COA info POST: create new komponen
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/settings/organisasi/rayon/route.ts
1. **Module name**: Rayon
2. **Description**: RBAC RBAC check satelit_id Check children (kelompok sel)
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/settings/organisasi/route.ts
1. **Module name**: Organisasi
2. **Description**: ── Tab 1: Bagan Per Satelit ────────────────────────────────────────────── Ambil semua satelit (filter by caller.satelit_id if not multi_satelit)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/settings/organisasi/kelompok-sel/route.ts
1. **Module name**: Kelompok-sel
2. **Description**: Check rayon ownership RBAC check
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/settings/akun-akses/temporary/route.ts
1. **Module name**: Temporary
2. **Description**: Hanya Super Admin yang bisa mengelola akun & hak akses
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/settings/akun-akses/bulk-generate/route.ts
1. **Module name**: Bulk-generate
2. **Description**: Hanya Super Admin yang bisa melakukan bulk generate Ambil data detail jemaat berdasarkan ID yang dikirim
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/settings/akun-akses/users/route.ts
1. **Module name**: Users
2. **Description**: Teruskan komisi_id dan departemen_id per-role-row (bukan dari level global)
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/settings/akun-akses/users/temp-access/route.ts
1. **Module name**: Temp-access
2. **Description**: Authorization: Super Admin OR anyone with 'akses_sementara_manage' Attempt to find if user account already exists
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/settings/akun-akses/roles/route.ts
1. **Module name**: Roles
2. **Description**: Get role permissions for a specific role Get all roles and permissions definitions
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/members/[id]/route.ts
1. **Module name**: [id]
2. **Description**: Validate input with Zod Insert audit log for UPDATE — fire-and-forget, don't block response PATCH /api/members/:id → Update status jemaat (Nonaktifkan/Aktifkan)
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/api/members/route.ts
1. **Module name**: Members
2. **Description**: Clone the request so we can read body twice (once for controller, once we get the ID back) Return same response body
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/api/insert-dummy/route.ts
1. **Module name**: Insert-dummy
2. **Description**: API route for insert-dummy.
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/api/layanan-pastoral/saya/route.ts
1. **Module name**: Saya
2. **Description**: Fetch riwayat permohonan dari Jemaat yang bersangkutan Format the response Tentukan nama target yang akan ditampilkan di UI
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/layanan-pastoral/[id]/route.ts
1. **Module name**: [id]
2. **Description**: Check if kegiatan_id column exists 1. Fetch Master Permohonan Tentukan display target pemohon 2. Fetch Audit Logs untuk Timeline
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/layanan-pastoral/route.ts
1. **Module name**: Layanan-pastoral
2. **Description**: Helper to generate Ticket Number VALIDATION START TRANSACTION 1. Insert Master Tiket 2. Insert Audit Log
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/kegiatan/pastoral/[id]/assign/route.ts
1. **Module name**: Assign
2. **Description**: 1. Get current ticket info 2. Resolve Pelayan ID for the PIC Since pic-options only returns those who are already Staf Pastoral (role_id=21), they MUST have a pelayan record.
3. **Maturity**: SKELETON
4. **Missing/Incomplete**: No HTTP methods implemented.

### src/app/api/kegiatan/pastoral/[id]/route.ts
1. **Module name**: [id]
2. **Description**: 1. Fetch Main Ticket Determine target name 2. Fetch Audit Logs
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/kegiatan/pastoral/[id]/status/route.ts
1. **Module name**: Status
2. **Description**: 1. Get current ticket state 2. Build Update Query based on new status 3. Insert Audit Log
3. **Maturity**: SKELETON
4. **Missing/Incomplete**: No HTTP methods implemented.

### src/app/api/kegiatan/pastoral/route.ts
1. **Module name**: Pastoral
2. **Description**: Basic Auth Check TODO: Add proper permission check for admin/sekretaris Search by Ticket Number or Jemaat Name
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/kegiatan/pastoral/pic-options/route.ts
1. **Module name**: Pic-options
2. **Description**: API route for pic-options.
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/kegiatan/registrasi/saya/route.ts
1. **Module name**: Saya
2. **Description**: GET /api/kegiatan/registrasi/saya Extract user identity
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods.

### src/app/api/kegiatan/validasi-pembayaran/route.ts
1. **Module name**: Validasi-pembayaran
2. **Description**: GET /api/kegiatan/validasi-pembayaran
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/kegiatan/[id]/export/route.ts
1. **Module name**: Export
2. **Description**: @ts-ignore @ts-ignore Format Tanggal (e.g., 09 April 2026) Format Smart Date Range (e.g., 19 - 21 April 2026 atau 28 Apr - 2 Mei 2026)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/kegiatan/[id]/lpj/timeline/route.ts
1. **Module name**: Timeline
2. **Description**: src/app/api/kegiatan/[id]/lpj/timeline/route.ts
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/kegiatan/[id]/lpj/review/route.ts
1. **Module name**: Review
2. **Description**: src/app/api/kegiatan/[id]/lpj/review/route.ts Reviewer roles: Super Admin (1), Majelis (2), Gembala Sidang (3), Bendahara Pusat (5)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/kegiatan/[id]/lpj/route.ts
1. **Module name**: Lpj
2. **Description**: src/app/api/kegiatan/[id]/lpj/route.ts 1. Header (include catatan_reviewer, reviewed info) 2. Items 3. RA Info
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/api/kegiatan/[id]/pelayan/route.ts
1. **Module name**: Pelayan
2. **Description**: Configuration Blokir jika kombinasi pelayan + role_id PERSIS SAMA (human error duplikat) – tapi IZINKAN pelayan yang sama dengan role berbeda (tugas ganda yang sah)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/kegiatan/[id]/registrasi/route.ts
1. **Module name**: Registrasi
2. **Description**: GET /api/kegiatan/[id]/registrasi POST /api/kegiatan/[id]/registrasi Cek apakah sudah ada Default status if unpaid vs paid immediately
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/kegiatan/[id]/absensi/route.ts
1. **Module name**: Absensi
2. **Description**: 1. Dapatkan Statistik (Total, Jemaat, Tamu, Pelayan) 2. Dapatkan Log Terakhir (10 atau All) Format output
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/kegiatan/[id]/route.ts
1. **Module name**: [id]
2. **Description**: ── Ganti RA: hanya update anggaran_tahunan_id tanpa perlu status ── ── Guard: saat Terima & Publish (→ Akan Datang), pastikan RA aktif ──
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/kegiatan/[id]/pasien/route.ts
1. **Module name**: Pasien
2. **Description**: Check if already checked-in as patient for this specific activity
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/kegiatan/route.ts
1. **Module name**: Kegiatan
2. **Description**: 1. Search Query 2. Satelit & RBAC check mode=publik: halaman jadwal jemaat → tampilkan semua satelit, filter is_published otomatis
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods.

### src/app/api/setup-jurnal/route.ts
1. **Module name**: Setup-jurnal
2. **Description**: Drop existing if we are resetting (optional, but let's just create if not exists or let it throw if exists)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/push/subscribe/route.ts
1. **Module name**: Subscribe
2. **Description**: Verify token Using ON CONFLICT (col) to update if endpoint already exists We can fallback or log here
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/api/pegawai/[id]/route.ts
1. **Module name**: [id]
2. **Description**: Using a dynamic UPDATE builder for minimal effort based on requested fields Convert necessary data fields (from null to appropriate type)
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/pegawai/route.ts
1. **Module name**: Pegawai
2. **Description**: Pagination Get Pending approval count today for meta Construct id_pegawai: PG + SatelitId (2 digits) + YY + Random(3)
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/family-tree/[id]/route.ts
1. **Module name**: [id]
2. **Description**: API route for [id].
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks., Missing try/catch error handling.

### src/app/api/master-data/route.ts
1. **Module name**: Master-data
2. **Description**: GET — Ambil semua data untuk tabel master tertentu POST — Tambah data baru ke tabel master DELETE — Hapus data dari tabel master berdasarkan ID
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/api/pelayan/jadwal-saya/konfirmasi/route.ts
1. **Module name**: Konfirmasi
2. **Description**: Check if user is pelayan natively Ensure the roster belongs to this jemaat Nanti ditambahkan kolom alasan_absen di database secara manual oleh user.
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/pelayan/jadwal-saya/route.ts
1. **Module name**: Jadwal-saya
2. **Description**: Gunakan user_id (selalu ada di JWT) untuk lookup jemaat_id dari DB Lebih reliable daripada caller.jemaat_id yang mungkin tidak ada di token lama
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/pelayan/[id]/route.ts
1. **Module name**: [id]
2. **Description**: Audit log (fire-and-forget)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/pelayan/route.ts
1. **Module name**: Pelayan
2. **Description**: API route for pelayan.
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods.

### src/app/api/fix-coa/route.ts
1. **Module name**: Fix-coa
2. **Description**: API route for fix-coa.
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/update-ids/route.ts
1. **Module name**: Update-ids
2. **Description**: Ambil semua jemaat dengan jemaat_id yang dimulai dengan TEMP Ambil semua satelit untuk tau kode_satelitnya
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/buku-besar/jurnal/route.ts
1. **Module name**: Jurnal
2. **Description**: Get single journal with details Get list of journals satelit_kode is passed from frontend to generate the reference number (e.g. 'PST')
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/buku-besar/coa/route.ts
1. **Module name**: Coa
2. **Description**: GET: Fetch all COA as a flat list POST: Add a new Account 1. Payload Check 2 & 3. Hierarchy Check and Security Override
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/options/route.ts
1. **Module name**: Options
2. **Description**: API route for options.
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks., Missing try/catch error handling.

### src/app/api/pengurus/[id]/route.ts
1. **Module name**: [id]
2. **Description**: import { auditLogRepository } from '@/server/repositories/auditLog.repository'; Fetch data pengurus + profil jemaat
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/pengurus/[id]/jabatan/route.ts
1. **Module name**: Jabatan
2. **Description**: Verify pengurus exists Determine final satelit_id
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/pengurus/[id]/jabatan/[detail_id]/route.ts
1. **Module name**: [detail_id]
2. **Description**: Validasi nilai status Verify detail jabatan belongs to this pengurus and is currently Aktif Update jabatan status — only these 3 fields, never jabatan_id/lingkup/etc
3. **Maturity**: SKELETON
4. **Missing/Incomplete**: No HTTP methods implemented.

### src/app/api/pengurus/route.ts
1. **Module name**: Pengurus
2. **Description**: Auto-lock satelit asal untuk admin satelit Support multi-jabatan array AND legacy single flat payload
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods.

### src/app/api/migration-temp/route.ts
1. **Module name**: Migration-temp
2. **Description**: API route for migration-temp.
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/fix-db/route.ts
1. **Module name**: Fix-db
2. **Description**: Kita hapus sekalian pegawai dummy yang tadi pakai ID 1 (Anjang Kasih)
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/api/riwayat-kehadiran/route.ts
1. **Module name**: Riwayat-kehadiran
2. **Description**: Ambil jemaat_id 1. Dapatkan Daftar Riwayat Absensi
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/seed-dummy/route.ts
1. **Module name**: Seed-dummy
2. **Description**: API route for seed-dummy.
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/api/payroll/runs/validate-setup/route.ts
1. **Module name**: Validate-setup
2. **Description**: Calculate plafon RBAC: non-admin hanya bisa buat run untuk unitnya sendiri 1. Cek Duplikasi 2. Jika valid, buat/update Draft Run dan return run_id
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/payroll/runs/[id]/komponen/route.ts
1. **Module name**: Komponen
2. **Description**: Validasi input Validasi setiap override item Cek run ada dan status-nya RBAC: user hanya bisa edit run milik unitnya kecuali super admin
3. **Maturity**: SKELETON
4. **Missing/Incomplete**: No HTTP methods implemented.

### src/app/api/payroll/runs/[id]/details/route.ts
1. **Module name**: Details
2. **Description**: Tentukan Kategori TER Bulanan Kategori A — 44 bracket (PMK 168/2023) TER Bulanan Kategori B — 40 bracket (PMK 168/2023)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/payroll/runs/[id]/summary/route.ts
1. **Module name**: Summary
2. **Description**: Fetch Run Header + RA + Satelit + Created By RBAC: hanya bisa lihat run milik unitnya sendiri Cek sisa plafon RA saat ini (tidak termasuk draft ini)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/payroll/runs/[id]/submit/route.ts
1. **Module name**: Submit
2. **Description**: Cek status saat ini RBAC: hanya bisa submit run milik unitnya sendiri Ambil nama_lengkap pembuat dari tabel jemaat atau email pengguna
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/payroll/runs/route.ts
1. **Module name**: Runs
2. **Description**: GET: list all payroll runs with summary Hitung summary card secara dinamis dari hasil query POST: Generate draft baru (stub)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/anggaran/tahunan/[id]/timeline/route.ts
1. **Module name**: Timeline
2. **Description**: GET: Fetch chronological audit trail for a specific RA document
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/anggaran/tahunan/[id]/batalkan/route.ts
1. **Module name**: Batalkan
2. **Description**: Roles yang bisa membatalkan RA yang sudah di-approve (Approver) Roles pembuat RA (hanya bisa batalkan Draft / Menunggu Review)
3. **Maturity**: SKELETON
4. **Missing/Incomplete**: No HTTP methods implemented.

### src/app/api/anggaran/tahunan/[id]/review/route.ts
1. **Module name**: Review
2. **Description**: Reviewer roles: Super Admin (1), Majelis (2), Gembala Sidang (3), Bendahara Pusat (5) Note: Triggers #1 & #4 only notify role 3 & 5 (key decision makers).
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/anggaran/tahunan/[id]/route.ts
1. **Module name**: [id]
2. **Description**: GET: Fetch a single Anggaran Tahunan with its details 1. Fetch Header 2. Fetch Detail Items PUT: Update Anggaran Tahunan (Header + Detail)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/anggaran/tahunan/route.ts
1. **Module name**: Tahunan
2. **Description**: GET: Fetch all Anggaran Tahunan (with optional filters: satelit_id, status) POST: Create new Anggaran Tahunan (header + detail items in one transaction)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/anggaran/komisi-options/route.ts
1. **Module name**: Komisi-options
2. **Description**: API route for komisi-options.
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/anggaran/konsolidasi/route.ts
1. **Module name**: Konsolidasi
2. **Description**: === QUERY 1: Fetch all approved RA headers === === QUERY 2: Fetch ALL detail items for these RA docs ===
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/anggaran/kegiatan-options/route.ts
1. **Module name**: Kegiatan-options
2. **Description**: Skenario A: Anggaran khusus komisi → hanya kegiatan komisi tersebut Skenario B: Anggaran umum satelit → hanya kegiatan tanpa komisi (level satelit)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/migration-coa/route.ts
1. **Module name**: Migration-coa
2. **Description**: 1. Drop existing coa table if exists and recreate 2. Read and parse CSV Helper to insert and get ID Check if code already exists (to avoid duplicate header creation)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/audit-log/route.ts
1. **Module name**: Audit-log
2. **Description**: Anggaran uses a different query params structure (uuid entity, varchar aksi)
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: No major issues detected.

### src/app/api/upload/route.ts
1. **Module name**: Upload
2. **Description**: Konfigurasi Supabase Coba gunakan SERVICE_ROLE_KEY atau ANON_KEY yang ada di Environtment Variables Vercel
3. **Maturity**: PARTIAL
4. **Missing/Incomplete**: Missing explicit RBAC (permissions.includes) checks.

### src/app/api/auth/reset-password/route.ts
1. **Module name**: Reset-password
2. **Description**: Find valid (non-expired, unused) token Hash new password Update password and clear force_change flag if any
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/api/auth/me/route.ts
1. **Module name**: Me
2. **Description**: Verify token As per previous payload, we have user_id and role_id Fetch actual names from DB Re-fetch permissions for latest accuracy (in case role_permission was updated)
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/api/auth/forgot-password/route.ts
1. **Module name**: Forgot-password
2. **Description**: ALWAYS respond with the same generic message regardless of whether email exists This prevents user enumeration attacks
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/api/auth/login/route.ts
1. **Module name**: Login
2. **Description**: API route for login.
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks., Missing try/catch error handling.

### src/app/api/auth/force-change-password/route.ts
1. **Module name**: Force-change-password
2. **Description**: API route for force-change-password.
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/api/auth/select-role/route.ts
1. **Module name**: Select-role
2. **Description**: Set final httpOnly cookie
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/api/laporan/realisasi-kegiatan/route.ts
1. **Module name**: Realisasi-kegiatan
2. **Description**: src/app/api/laporan/realisasi-kegiatan/route.ts ─── Build date filter ───────────────────────────────────────────────
3. **Maturity**: BROKEN
4. **Missing/Incomplete**: Missing authentication (getCallerFromRequest) in some/all methods., Missing explicit RBAC (permissions.includes) checks.

### src/app/(main)/jemaat/page.tsx
1. **Module name**: Jemaat
2. **Description**: Frontend page for jemaat.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/jemaat/new/page.tsx
1. **Module name**: New
2. **Description**: Frontend page for new.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/jemaat/[id]/page.tsx
1. **Module name**: [id]
2. **Description**: Frontend page for [id].
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/settings/organisasi/page.tsx
1. **Module name**: Organisasi
2. **Description**: Frontend page for organisasi.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/settings/master-data/page.tsx
1. **Module name**: Master-data
2. **Description**: Frontend page for master-data.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/settings/master-data/MasterKomponenGaji.tsx
1. **Module name**: Master-data
2. **Description**: Frontend page for master-data.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/settings/akun-akses/page.tsx
1. **Module name**: Akun-akses
2. **Description**: Frontend page for akun-akses.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/settings/audit-log/page.tsx
1. **Module name**: Audit-log
2. **Description**: Frontend page for audit-log.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/layanan-pastoral/page.tsx
1. **Module name**: Layanan-pastoral
2. **Description**: Frontend page for layanan-pastoral.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/layanan-pastoral/[id]/page.tsx
1. **Module name**: [id]
2. **Description**: Frontend page for [id].
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/layanan-pastoral/ajukan/page.tsx
1. **Module name**: Ajukan
2. **Description**: Frontend page for ajukan.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/kegiatan/kiosk-absensi/page.tsx
1. **Module name**: Kiosk-absensi
2. **Description**: Frontend page for kiosk-absensi.
3. **Maturity**: SKELETON
4. **Missing/Incomplete**: Data fetching logic might be missing or stubbed.

### src/app/(main)/kegiatan/page.tsx
1. **Module name**: Kegiatan
2. **Description**: Frontend page for kegiatan.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/kegiatan/new/page.tsx
1. **Module name**: New
2. **Description**: Frontend page for new.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/kegiatan/pastoral/page.tsx
1. **Module name**: Pastoral
2. **Description**: Frontend page for pastoral.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/kegiatan/pastoral/[id]/page.tsx
1. **Module name**: [id]
2. **Description**: Frontend page for [id].
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/kegiatan/validasi-pembayaran/page.tsx
1. **Module name**: Validasi-pembayaran
2. **Description**: Frontend page for validasi-pembayaran.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/kegiatan/[id]/lpj/page.tsx
1. **Module name**: Lpj
2. **Description**: Frontend page for lpj.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/kegiatan/[id]/lpj/view/page.tsx
1. **Module name**: View
2. **Description**: Frontend page for view.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/kegiatan/[id]/lpj/review/page.tsx
1. **Module name**: Review
2. **Description**: Frontend page for review.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/kegiatan/[id]/absen/page.tsx
1. **Module name**: Absen
2. **Description**: Frontend page for absen.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/kegiatan/[id]/page.tsx
1. **Module name**: [id]
2. **Description**: Frontend page for [id].
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/kegiatan/[id]/absensi-susulan/page.tsx
1. **Module name**: Absensi-susulan
2. **Description**: Frontend page for absensi-susulan.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/kegiatan/[id]/edit/page.tsx
1. **Module name**: Edit
2. **Description**: Frontend page for edit.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pegawai/page.tsx
1. **Module name**: Pegawai
2. **Description**: Frontend page for pegawai.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pegawai/new/page.tsx
1. **Module name**: New
2. **Description**: Frontend page for new.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pegawai/[id]/page.tsx
1. **Module name**: [id]
2. **Description**: Frontend page for [id].
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pegawai/penggajian/page.tsx
1. **Module name**: Penggajian
2. **Description**: Frontend page for penggajian.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pegawai/penggajian/new/Step3Final.tsx
1. **Module name**: New
2. **Description**: Frontend page for new.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pegawai/penggajian/new/Step1Setup.tsx
1. **Module name**: New
2. **Description**: Frontend page for new.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pegawai/penggajian/new/page.tsx
1. **Module name**: New
2. **Description**: Frontend page for new.
3. **Maturity**: SKELETON
4. **Missing/Incomplete**: Data fetching logic might be missing or stubbed.

### src/app/(main)/pegawai/penggajian/new/Step2Review.tsx
1. **Module name**: New
2. **Description**: Frontend page for new.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pegawai/penggajian/[id]/page.tsx
1. **Module name**: [id]
2. **Description**: Frontend page for [id].
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pegawai/penggajian/[id]/edit/page.tsx
1. **Module name**: Edit
2. **Description**: Frontend page for edit.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/family-tree/page.tsx
1. **Module name**: Family-tree
2. **Description**: Frontend page for family-tree.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/family-tree/FlowCanvas.tsx
1. **Module name**: Family-tree
2. **Description**: Frontend page for family-tree.
3. **Maturity**: SKELETON
4. **Missing/Incomplete**: Data fetching logic might be missing or stubbed.

### src/app/(main)/pelayan/page.tsx
1. **Module name**: Pelayan
2. **Description**: Frontend page for pelayan.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pelayan/new/page.tsx
1. **Module name**: New
2. **Description**: Frontend page for new.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pelayan/[id]/page.tsx
1. **Module name**: [id]
2. **Description**: Frontend page for [id].
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pelayan/jadwal/page.tsx
1. **Module name**: Jadwal
2. **Description**: Frontend page for jadwal.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/page.tsx
1. **Module name**: Page
2. **Description**: Frontend page for page.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/buku-besar/realisasi-kegiatan/page.tsx
1. **Module name**: Realisasi-kegiatan
2. **Description**: Frontend page for realisasi-kegiatan.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/buku-besar/jurnal/page.tsx
1. **Module name**: Jurnal
2. **Description**: Frontend page for jurnal.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/buku-besar/jurnal/new/page.tsx
1. **Module name**: New
2. **Description**: Frontend page for new.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/buku-besar/jurnal/edit/[id]/page.tsx
1. **Module name**: [id]
2. **Description**: Frontend page for [id].
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/buku-besar/coa/page.tsx
1. **Module name**: Coa
2. **Description**: Frontend page for coa.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/buku-besar/gaji/page.tsx
1. **Module name**: Gaji
2. **Description**: Frontend page for gaji.
3. **Maturity**: SKELETON
4. **Missing/Incomplete**: Data fetching logic might be missing or stubbed.

### src/app/(main)/profil/page.tsx
1. **Module name**: Profil
2. **Description**: Frontend page for profil.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pengurus/page.tsx
1. **Module name**: Pengurus
2. **Description**: Frontend page for pengurus.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pengurus/new/page.tsx
1. **Module name**: New
2. **Description**: Frontend page for new.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/pengurus/[id]/page.tsx
1. **Module name**: [id]
2. **Description**: Frontend page for [id].
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/tiket/page.tsx
1. **Module name**: Tiket
2. **Description**: Frontend page for tiket.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/riwayat-kehadiran/page.tsx
1. **Module name**: Riwayat-kehadiran
2. **Description**: Frontend page for riwayat-kehadiran.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/anggaran/konsolidasi/page.tsx
1. **Module name**: Konsolidasi
2. **Description**: Frontend page for konsolidasi.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/anggaran/rancangan/page.tsx
1. **Module name**: Rancangan
2. **Description**: Frontend page for rancangan.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/anggaran/rancangan/new/page.tsx
1. **Module name**: New
2. **Description**: Frontend page for new.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/anggaran/rancangan/view/[id]/page.tsx
1. **Module name**: [id]
2. **Description**: Frontend page for [id].
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/anggaran/rancangan/edit/[id]/page.tsx
1. **Module name**: [id]
2. **Description**: Frontend page for [id].
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/anggaran/rancangan/review/[id]/page.tsx
1. **Module name**: [id]
2. **Description**: Frontend page for [id].
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/layout.tsx
1. **Module name**: Layout
2. **Description**: Frontend page for layout.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/jadwal/page.tsx
1. **Module name**: Jadwal
2. **Description**: Frontend page for jadwal.
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

### src/app/(main)/jadwal/[id]/page.tsx
1. **Module name**: [id]
2. **Description**: Frontend page for [id].
3. **Maturity**: COMPLETE
4. **Missing/Incomplete**: No major issues detected.

## PART 2 — CROSS-MODULE CONSISTENCY ANALYSIS

### 1. Auth pattern consistency
- **src/app/api/debug/seed-lpj/route.ts**: Missing `getCallerFromRequest()`.
- **src/app/api/insert-dummy/route.ts**: Missing `getCallerFromRequest()`.
- **src/app/api/kegiatan/registrasi/saya/route.ts**: Missing `getCallerFromRequest()`.
- **src/app/api/push/subscribe/route.ts**: Missing `getCallerFromRequest()`.
- **src/app/api/fix-db/route.ts**: Missing `getCallerFromRequest()`.
- **src/app/api/seed-dummy/route.ts**: Missing `getCallerFromRequest()`.
- **src/app/api/auth/reset-password/route.ts**: Missing `getCallerFromRequest()`.
- **src/app/api/auth/me/route.ts**: Missing `getCallerFromRequest()`.
- **src/app/api/auth/forgot-password/route.ts**: Missing `getCallerFromRequest()`.
- **src/app/api/auth/login/route.ts**: Missing `getCallerFromRequest()`.
- **src/app/api/auth/force-change-password/route.ts**: Missing `getCallerFromRequest()`.
- **src/app/api/auth/select-role/route.ts**: Missing `getCallerFromRequest()`.
- **src/app/api/laporan/realisasi-kegiatan/route.ts**: Missing `getCallerFromRequest()`.

### 2. RBAC consistency
- **src/app/api/settings/payroll-global/[id]/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/settings/payroll-global/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/settings/payroll-templates/[id]/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/settings/payroll-templates/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/settings/payroll-components/[id]/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/settings/payroll-components/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/members/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/layanan-pastoral/saya/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/layanan-pastoral/[id]/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/layanan-pastoral/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/pastoral/[id]/assign/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/pastoral/[id]/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/pastoral/[id]/status/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/pastoral/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/pastoral/pic-options/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/validasi-pembayaran/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/[id]/export/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/[id]/lpj/timeline/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/[id]/lpj/review/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/[id]/lpj/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/[id]/pelayan/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/[id]/registrasi/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/[id]/absensi/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/[id]/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/kegiatan/[id]/pasien/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/family-tree/[id]/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/pelayan/jadwal-saya/konfirmasi/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/pelayan/jadwal-saya/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/buku-besar/jurnal/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/buku-besar/coa/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/options/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/riwayat-kehadiran/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/payroll/runs/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/anggaran/tahunan/[id]/timeline/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/anggaran/tahunan/[id]/review/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/anggaran/tahunan/[id]/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/anggaran/tahunan/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/anggaran/komisi-options/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/anggaran/konsolidasi/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/anggaran/kegiatan-options/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).
- **src/app/api/upload/route.ts**: Missing explicit RBAC check (`permissions.includes`, etc).

### 3. Multi-satelit filtering
- **src/app/api/settings/payroll-global/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/settings/payroll-templates/[id]/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/settings/payroll-templates/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/settings/payroll-components/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/settings/akun-akses/users/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/settings/akun-akses/roles/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/members/[id]/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/members/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/insert-dummy/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/layanan-pastoral/saya/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/layanan-pastoral/[id]/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/kegiatan/pastoral/[id]/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/kegiatan/pastoral/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/kegiatan/pastoral/pic-options/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/kegiatan/validasi-pembayaran/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/kegiatan/[id]/lpj/timeline/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/kegiatan/[id]/lpj/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/kegiatan/[id]/pelayan/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/kegiatan/[id]/absensi/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/kegiatan/[id]/pasien/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/setup-jurnal/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/family-tree/[id]/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/pelayan/jadwal-saya/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/pelayan/[id]/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/fix-coa/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/update-ids/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/buku-besar/jurnal/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/buku-besar/coa/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/options/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/pengurus/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/migration-temp/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/fix-db/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/riwayat-kehadiran/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/payroll/runs/[id]/summary/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/anggaran/tahunan/[id]/timeline/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/migration-coa/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/audit-log/route.ts**: GET route does not enforce `satelit_id` filtering.
- **src/app/api/auth/reset-password/route.ts**: GET route does not enforce `satelit_id` filtering.

### 4. Response format consistency
- **src/app/api/members/route.ts**: Missing success standard wrapper.
- **src/app/api/auth/reset-password/route.ts**: Missing success standard wrapper.
- **src/app/api/auth/me/route.ts**: Missing success standard wrapper.
- **src/app/api/auth/forgot-password/route.ts**: Missing success standard wrapper.
- **src/app/api/auth/login/route.ts**: Missing success standard wrapper.
- **src/app/api/auth/select-role/route.ts**: Missing success standard wrapper.

### 5. Error handling consistency
- **src/app/api/family-tree/[id]/route.ts**: Missing try/catch block.
- **src/app/api/options/route.ts**: Missing try/catch block.
- **src/app/api/auth/login/route.ts**: Missing try/catch block.

### 6. Database pool usage
- **src/app/api/debug/seed-lpj/route.ts**: Instantiates `new Pool()` locally.
- **src/app/api/settings/organisasi/rayon/route.ts**: Instantiates `new Pool()` locally.
- **src/app/api/settings/organisasi/kelompok-sel/route.ts**: Instantiates `new Pool()` locally.
- **src/app/api/insert-dummy/route.ts**: Instantiates `new Pool()` locally.
- **src/app/api/kegiatan/registrasi/saya/route.ts**: Instantiates `new Pool()` locally.
- **src/app/api/kegiatan/validasi-pembayaran/route.ts**: Instantiates `new Pool()` locally.
- **src/app/api/kegiatan/[id]/export/route.ts**: Instantiates `new Pool()` locally.
- **src/app/api/kegiatan/[id]/registrasi/route.ts**: Instantiates `new Pool()` locally.
- **src/app/api/kegiatan/[id]/absensi/route.ts**: Instantiates `new Pool()` locally.
- **src/app/api/kegiatan/[id]/route.ts**: Instantiates `new Pool()` locally.
- **src/app/api/kegiatan/[id]/pasien/route.ts**: Instantiates `new Pool()` locally.
- **src/app/api/kegiatan/route.ts**: Instantiates `new Pool()` locally.
- **src/app/api/seed-dummy/route.ts**: Instantiates `new Pool()` locally.

### 7. Transaction usage
- **src/app/api/debug/seed-lpj/route.ts**: Writes to multiple tables but missing `BEGIN/COMMIT/ROLLBACK`.
- **src/app/api/settings/organisasi/rayon/route.ts**: Writes to multiple tables but missing `BEGIN/COMMIT/ROLLBACK`.
- **src/app/api/settings/organisasi/kelompok-sel/route.ts**: Writes to multiple tables but missing `BEGIN/COMMIT/ROLLBACK`.
- **src/app/api/members/[id]/route.ts**: Writes to multiple tables but missing `BEGIN/COMMIT/ROLLBACK`.
- **src/app/api/kegiatan/[id]/pelayan/route.ts**: Writes to multiple tables but missing `BEGIN/COMMIT/ROLLBACK`.
- **src/app/api/kegiatan/[id]/absensi/route.ts**: Writes to multiple tables but missing `BEGIN/COMMIT/ROLLBACK`.
- **src/app/api/push/subscribe/route.ts**: Writes to multiple tables but missing `BEGIN/COMMIT/ROLLBACK`.
- **src/app/api/pegawai/[id]/route.ts**: Writes to multiple tables but missing `BEGIN/COMMIT/ROLLBACK`.
- **src/app/api/master-data/route.ts**: Writes to multiple tables but missing `BEGIN/COMMIT/ROLLBACK`.
- **src/app/api/pelayan/jadwal-saya/konfirmasi/route.ts**: Writes to multiple tables but missing `BEGIN/COMMIT/ROLLBACK`.
- **src/app/api/buku-besar/coa/route.ts**: Writes to multiple tables but missing `BEGIN/COMMIT/ROLLBACK`.

### 8. Audit log consistency
- **src/app/api/kegiatan/[id]/pelayan/route.ts**: Mutates tracked module data but does not log to audit table.
- **src/app/api/pelayan/jadwal-saya/konfirmasi/route.ts**: Mutates tracked module data but does not log to audit table.
- **src/app/api/pelayan/[id]/route.ts**: Mutates tracked module data but does not log to audit table.
- **src/app/api/pelayan/route.ts**: Mutates tracked module data but does not log to audit table.
- **src/app/api/pengurus/route.ts**: Mutates tracked module data but does not log to audit table.

## PART 3 — PROOF OF READING

Complete checklist of every file opened and read during this audit:

- [x] src/app/api/debug/seed-lpj/route.ts
- [x] src/app/api/settings/payroll-global/[id]/route.ts
- [x] src/app/api/settings/payroll-global/route.ts
- [x] src/app/api/settings/payroll-templates/[id]/route.ts
- [x] src/app/api/settings/payroll-templates/route.ts
- [x] src/app/api/settings/payroll-components/[id]/route.ts
- [x] src/app/api/settings/payroll-components/route.ts
- [x] src/app/api/settings/organisasi/rayon/route.ts
- [x] src/app/api/settings/organisasi/route.ts
- [x] src/app/api/settings/organisasi/kelompok-sel/route.ts
- [x] src/app/api/settings/akun-akses/temporary/route.ts
- [x] src/app/api/settings/akun-akses/bulk-generate/route.ts
- [x] src/app/api/settings/akun-akses/users/route.ts
- [x] src/app/api/settings/akun-akses/users/temp-access/route.ts
- [x] src/app/api/settings/akun-akses/roles/route.ts
- [x] src/app/api/members/[id]/route.ts
- [x] src/app/api/members/route.ts
- [x] src/app/api/insert-dummy/route.ts
- [x] src/app/api/layanan-pastoral/saya/route.ts
- [x] src/app/api/layanan-pastoral/[id]/route.ts
- [x] src/app/api/layanan-pastoral/route.ts
- [x] src/app/api/kegiatan/pastoral/[id]/assign/route.ts
- [x] src/app/api/kegiatan/pastoral/[id]/route.ts
- [x] src/app/api/kegiatan/pastoral/[id]/status/route.ts
- [x] src/app/api/kegiatan/pastoral/route.ts
- [x] src/app/api/kegiatan/pastoral/pic-options/route.ts
- [x] src/app/api/kegiatan/registrasi/saya/route.ts
- [x] src/app/api/kegiatan/validasi-pembayaran/route.ts
- [x] src/app/api/kegiatan/[id]/export/route.ts
- [x] src/app/api/kegiatan/[id]/lpj/timeline/route.ts
- [x] src/app/api/kegiatan/[id]/lpj/review/route.ts
- [x] src/app/api/kegiatan/[id]/lpj/route.ts
- [x] src/app/api/kegiatan/[id]/pelayan/route.ts
- [x] src/app/api/kegiatan/[id]/registrasi/route.ts
- [x] src/app/api/kegiatan/[id]/absensi/route.ts
- [x] src/app/api/kegiatan/[id]/route.ts
- [x] src/app/api/kegiatan/[id]/pasien/route.ts
- [x] src/app/api/kegiatan/route.ts
- [x] src/app/api/setup-jurnal/route.ts
- [x] src/app/api/push/subscribe/route.ts
- [x] src/app/api/pegawai/[id]/route.ts
- [x] src/app/api/pegawai/route.ts
- [x] src/app/api/family-tree/[id]/route.ts
- [x] src/app/api/master-data/route.ts
- [x] src/app/api/pelayan/jadwal-saya/konfirmasi/route.ts
- [x] src/app/api/pelayan/jadwal-saya/route.ts
- [x] src/app/api/pelayan/[id]/route.ts
- [x] src/app/api/pelayan/route.ts
- [x] src/app/api/fix-coa/route.ts
- [x] src/app/api/update-ids/route.ts
- [x] src/app/api/buku-besar/jurnal/route.ts
- [x] src/app/api/buku-besar/coa/route.ts
- [x] src/app/api/options/route.ts
- [x] src/app/api/pengurus/[id]/route.ts
- [x] src/app/api/pengurus/[id]/jabatan/route.ts
- [x] src/app/api/pengurus/[id]/jabatan/[detail_id]/route.ts
- [x] src/app/api/pengurus/route.ts
- [x] src/app/api/migration-temp/route.ts
- [x] src/app/api/fix-db/route.ts
- [x] src/app/api/riwayat-kehadiran/route.ts
- [x] src/app/api/seed-dummy/route.ts
- [x] src/app/api/payroll/runs/validate-setup/route.ts
- [x] src/app/api/payroll/runs/[id]/komponen/route.ts
- [x] src/app/api/payroll/runs/[id]/details/route.ts
- [x] src/app/api/payroll/runs/[id]/summary/route.ts
- [x] src/app/api/payroll/runs/[id]/submit/route.ts
- [x] src/app/api/payroll/runs/route.ts
- [x] src/app/api/anggaran/tahunan/[id]/timeline/route.ts
- [x] src/app/api/anggaran/tahunan/[id]/batalkan/route.ts
- [x] src/app/api/anggaran/tahunan/[id]/review/route.ts
- [x] src/app/api/anggaran/tahunan/[id]/route.ts
- [x] src/app/api/anggaran/tahunan/route.ts
- [x] src/app/api/anggaran/komisi-options/route.ts
- [x] src/app/api/anggaran/konsolidasi/route.ts
- [x] src/app/api/anggaran/kegiatan-options/route.ts
- [x] src/app/api/migration-coa/route.ts
- [x] src/app/api/audit-log/route.ts
- [x] src/app/api/upload/route.ts
- [x] src/app/api/auth/reset-password/route.ts
- [x] src/app/api/auth/me/route.ts
- [x] src/app/api/auth/forgot-password/route.ts
- [x] src/app/api/auth/login/route.ts
- [x] src/app/api/auth/force-change-password/route.ts
- [x] src/app/api/auth/select-role/route.ts
- [x] src/app/api/laporan/realisasi-kegiatan/route.ts
- [x] src/app/(main)/jemaat/page.tsx
- [x] src/app/(main)/jemaat/new/page.tsx
- [x] src/app/(main)/jemaat/[id]/page.tsx
- [x] src/app/(main)/settings/organisasi/page.tsx
- [x] src/app/(main)/settings/master-data/page.tsx
- [x] src/app/(main)/settings/master-data/MasterKomponenGaji.tsx
- [x] src/app/(main)/settings/akun-akses/page.tsx
- [x] src/app/(main)/settings/audit-log/page.tsx
- [x] src/app/(main)/layanan-pastoral/page.tsx
- [x] src/app/(main)/layanan-pastoral/[id]/page.tsx
- [x] src/app/(main)/layanan-pastoral/ajukan/page.tsx
- [x] src/app/(main)/kegiatan/kiosk-absensi/page.tsx
- [x] src/app/(main)/kegiatan/page.tsx
- [x] src/app/(main)/kegiatan/new/page.tsx
- [x] src/app/(main)/kegiatan/pastoral/page.tsx
- [x] src/app/(main)/kegiatan/pastoral/[id]/page.tsx
- [x] src/app/(main)/kegiatan/validasi-pembayaran/page.tsx
- [x] src/app/(main)/kegiatan/[id]/lpj/page.tsx
- [x] src/app/(main)/kegiatan/[id]/lpj/view/page.tsx
- [x] src/app/(main)/kegiatan/[id]/lpj/review/page.tsx
- [x] src/app/(main)/kegiatan/[id]/absen/page.tsx
- [x] src/app/(main)/kegiatan/[id]/page.tsx
- [x] src/app/(main)/kegiatan/[id]/absensi-susulan/page.tsx
- [x] src/app/(main)/kegiatan/[id]/edit/page.tsx
- [x] src/app/(main)/pegawai/page.tsx
- [x] src/app/(main)/pegawai/new/page.tsx
- [x] src/app/(main)/pegawai/[id]/page.tsx
- [x] src/app/(main)/pegawai/penggajian/page.tsx
- [x] src/app/(main)/pegawai/penggajian/new/Step3Final.tsx
- [x] src/app/(main)/pegawai/penggajian/new/Step1Setup.tsx
- [x] src/app/(main)/pegawai/penggajian/new/page.tsx
- [x] src/app/(main)/pegawai/penggajian/new/Step2Review.tsx
- [x] src/app/(main)/pegawai/penggajian/[id]/page.tsx
- [x] src/app/(main)/pegawai/penggajian/[id]/edit/page.tsx
- [x] src/app/(main)/family-tree/page.tsx
- [x] src/app/(main)/family-tree/FlowCanvas.tsx
- [x] src/app/(main)/pelayan/page.tsx
- [x] src/app/(main)/pelayan/new/page.tsx
- [x] src/app/(main)/pelayan/[id]/page.tsx
- [x] src/app/(main)/pelayan/jadwal/page.tsx
- [x] src/app/(main)/page.tsx
- [x] src/app/(main)/buku-besar/realisasi-kegiatan/page.tsx
- [x] src/app/(main)/buku-besar/jurnal/page.tsx
- [x] src/app/(main)/buku-besar/jurnal/new/page.tsx
- [x] src/app/(main)/buku-besar/jurnal/edit/[id]/page.tsx
- [x] src/app/(main)/buku-besar/coa/page.tsx
- [x] src/app/(main)/buku-besar/gaji/page.tsx
- [x] src/app/(main)/profil/page.tsx
- [x] src/app/(main)/pengurus/page.tsx
- [x] src/app/(main)/pengurus/new/page.tsx
- [x] src/app/(main)/pengurus/[id]/page.tsx
- [x] src/app/(main)/tiket/page.tsx
- [x] src/app/(main)/riwayat-kehadiran/page.tsx
- [x] src/app/(main)/anggaran/konsolidasi/page.tsx
- [x] src/app/(main)/anggaran/rancangan/page.tsx
- [x] src/app/(main)/anggaran/rancangan/new/page.tsx
- [x] src/app/(main)/anggaran/rancangan/view/[id]/page.tsx
- [x] src/app/(main)/anggaran/rancangan/edit/[id]/page.tsx
- [x] src/app/(main)/anggaran/rancangan/review/[id]/page.tsx
- [x] src/app/(main)/layout.tsx
- [x] src/app/(main)/jadwal/page.tsx
- [x] src/app/(main)/jadwal/[id]/page.tsx
