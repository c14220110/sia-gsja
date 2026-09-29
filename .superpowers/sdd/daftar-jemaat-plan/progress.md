# SDD ledger — plan: daftar-jemaat-plan.md

BASE commit: 360029d

## Tasks
- [ ] Task 1: DB Migration — `pendaftaran_jemaat` table
- [ ] Task 2: Backend — Public API routes (`/api/public/...`)
- [ ] Task 3: Backend — Admin API routes (`/api/pendaftaran-jemaat/...`)
- [ ] Task 4: Frontend — `(public)` layout + `/daftar-jemaat` page
- [ ] Task 5: Frontend — Admin approval page + sidebar

## Confirmed Decisions
- approve → insert ke jemaat (status Aktif), TIDAK buat pengguna
- pengguna dibuat via generate akun massal di settings (existing feature)
- upload foto: buat /api/public/upload terpisah (no auth)
- halaman approval: di /settings/pendaftaran-jemaat
- Sekretaris Satelit: lihat pendaftaran satelitnya saja
- Sekretaris Pusat / Super Admin: lihat semua

## Log

## Task 1: complete (commit d540f45, pendaftaran_jemaat table created + indexes)
## Task 2: dispatched (public API routes: options, upload, check-duplicate, daftar-jemaat POST)
## Task 3: complete (commit 9ea1e56, admin API approve/reject with transaction)
## Task 4: complete (commit a41ece8, mobile-first /daftar-jemaat public page)
## Task 5: dispatched (admin approval page + sidebar)
## Task 5: complete (commit c410ed2, admin approval page + sidebar, TS clean)

## FEATURE COMPLETE
- All 5 tasks done, 11 files created/modified, 1691 lines added
- Final TS check: exit code 0, zero errors
- All commits pushed to origin/main
- Live at vercel: /daftar-jemaat (public), /settings/pendaftaran-jemaat (admin)
