# AGENTS.md — SIA GSJA Eben Haezer

> Proyek ini **sudah production**. Jangan refactor tanpa instruksi eksplisit.

---

## Stack
- **Next.js 16** App Router + TypeScript (Turbopack)
- **PostgreSQL** via Supabase, client: `pg` (node-postgres)
- **Auth**: JWT di `httpOnly` cookie bernama `access_token`
- **No ORM** — semua query SQL mentah dengan parameterized values

---

## Arsitektur: 3 Pola yang Semua SAH

Jangan paksa seragamkan. Pilih pola berdasarkan yang sudah ada di modul terkait.

| Pola | Alur | Modul yang Pakai |
|---|---|---|
| **A — Full 3-Layer** | Route → Controller → Service → Repository → DB | Jemaat, Auth, Master |
| **B — 2-Layer** | Route → Repository → DB | Pengurus, Pelayan, AkunAkses |
| **C — Direct API** | Route → SQL langsung → DB | Kegiatan, Anggaran, Payroll, Buku Besar, dll |

Modul Pola C bukan buruk — sudah ada auth, RBAC, dan transaksi yang proper di dalamnya.

---

## Aturan Non-Negotiable

### 1. Database Pool — WAJIB singleton
```typescript
import pool from '@/lib/db'; // ✅ SELALU ini
```
**JANGAN pernah** `new Pool({ connectionString: ... })` — menyebabkan connection leak.

> **Known debt:** `src/app/api/kegiatan/route.ts` dan `kegiatan/[id]/route.ts` masih pakai `new Pool()` lokal. Ini diketahui, **jangan tiru, jangan "fix" tanpa perintah**.

### 2. Auth — Dua Layer Proteksi

**Layer 1 — `src/proxy.ts` (global gate):**
Next.js 16 menggunakan `proxy.ts` (bukan `middleware.ts`). File ini mengecek keberadaan cookie `access_token` di **semua** `/api/*` route. Tanpa cookie → langsung 401. Ini mencegah route yang lupa `getCallerFromRequest()` menjadi public.

**Layer 2 — `getCallerFromRequest()` (per-handler):**
```typescript
const caller = getCallerFromRequest(request); // dari '@/server/utils/getCallerFromRequest'
if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
```
`caller` berisi: `user_id`, `role_id`, `satelit_id`, `jemaat_id?`, `role_name`, `is_super_admin`, `permissions: string[]`

> **JANGAN** buat `src/middleware.ts` — Next.js 16 sudah deprecated, dan `proxy.ts` sudah ada.

**Penting — `is_super_admin`:** bernilai `true` HANYA jika `role_name === 'SUPER_ADMIN'`. Bukan berdasarkan tabel lain.

**Penting — Multi-Role:** User dengan >1 role harus memilih role dulu saat login. JWT yang diterbitkan hanya membawa **1 role aktif** per sesi. Jadi `caller.role_id` dan `caller.satelit_id` selalu tunggal — tidak perlu loop.

### 3. RBAC Multi-Satelit — Wajib di Setiap GET/POST
```typescript
if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
  satelit_id = caller.satelit_id?.toString(); // paksa ke satelit sendiri
}
```

### 4. Transaksi Multi-Tabel
Setiap write yang menyentuh >1 tabel wajib `BEGIN/COMMIT/ROLLBACK` + `client.release()` di `finally`.

### 5. Parameterized Query
Selalu `$1, $2, ...` — **tidak pernah** string interpolasi SQL.

### 6. Format Response
```typescript
{ success: true, data: ..., meta?: { total, limit, offset }, message?: string }
{ success: false, message: 'Pesan jelas' }
```
**Jangan ubah nama field response yang sudah ada** — frontend langsung error.

---

## Referensi Kode Canonical

Baca file ini sebelum menulis kode baru — lebih bermanfaat dari template hipotetikal:

| Kebutuhan | File Referensi |
|---|---|
| Pola A terlengkap | `src/app/api/members/route.ts` → `jemaat.controller.ts` → `jemaat.service.ts` → `jemaat.repository.ts` |
| Pola B dengan audit log | `src/app/api/pengurus/route.ts` + `src/server/repositories/pengurus.repository.ts` |
| Pola C dengan transaksi kompleks + RA validation | `src/app/api/kegiatan/route.ts` |
| Audit log + email notification | `src/app/api/anggaran/tahunan/route.ts` |
| Repository dengan pagination standard | `src/server/repositories/pelayan.repository.ts` |
| Auth flow lengkap | `src/server/services/auth.service.ts` |
| Global auth guard (proxy) | `src/proxy.ts` |
| Singleton DB pool | `src/lib/db.ts` |

---

## Modul & Audit Log

Modul berikut punya tabel audit log — wajib diisi saat write:

| Modul | Cara |
|---|---|
| Jemaat | `auditLogRepository.insertAuditLog({ jemaat_id, aksi, user_id, role_id, satelit_id, keterangan })` |
| Pelayan | Di dalam `pelayan.repository.ts` — sudah inline |
| Pengurus | Di dalam `pengurus.repository.ts` — sudah inline |
| Anggaran | `auditLogRepository.insertAnggaranAuditLog(...)` + `resolveCallerSnapshot(caller)` |
| Layanan Pastoral | Query langsung di route ke `permohonan_layanan_audit_log` |

---

## Permission Names — Daftar Lengkap dari DB

> **Sumber kebenaran:** tabel `public.permission`, kolom `nama_permission`. Jangan mengarang nama baru.
> File referensi: `konteks-tambahan/dump-postgres-202605130103.sql` baris 4888–4927.

**Data Jemaat**
| Nama | Keterangan |
|---|---|
| `jemaat_view` | Melihat daftar dan detail jemaat |
| `jemaat_create` | Mendaftarkan jemaat baru |
| `jemaat_edit` | Mengubah data dan status jemaat |
| `jemaat_delete` | Hapus / nonaktifkan jemaat |

**Pelayan & Pengurus**
| Nama | Keterangan |
|---|---|
| `pelayan_view` | Melihat jadwal dan data pelayan |
| `pelayan_manage` | Menambah dan mengatur role pelayan |
| `pengurus_view` | Melihat susunan pengurus |
| `pengurus_manage` | Meregistrasi dan mengubah status pengurus |

**Kegiatan & Pelayanan**
| Nama | Keterangan |
|---|---|
| `kegiatan_view` | Melihat daftar kegiatan dan laporan |
| `kegiatan_create` | Membuat jadwal kegiatan baru |
| `kegiatan_manage` | Edit / batalkan / selesaikan kegiatan |
| `kegiatan_absensi` | Input & lihat absensi kegiatan |
| `kegiatan_lpj` | Submit & lihat LPJ kegiatan |
| `kegiatan_pastoral_view` | Lihat permohonan layanan pastoral |
| `kegiatan_pastoral_manage` | Assign & update status pastoral |

**Keuangan & Anggaran**
| Nama | Keterangan |
|---|---|
| `anggaran_view` | Lihat rancangan anggaran |
| `anggaran_create` | Buat & submit rancangan anggaran |
| `anggaran_review` | Review & approve/tolak anggaran |
| `buku_besar_view` | Lihat COA, jurnal, buku besar |
| `buku_besar_manage` | Input & posting jurnal umum |

**HRD & Penggajian**
| Nama | Keterangan |
|---|---|
| `pegawai_view` | Lihat data pegawai |
| `pegawai_create` | Tambah pegawai baru |
| `pegawai_edit` | Edit data pegawai |
| `pegawai_approval` | Approve / tolak permohonan pegawai |
| `penggajian_manage` | Input & kelola penggajian |

**Sistem & Keamanan**
| Nama | Keterangan |
|---|---|
| `master_data_manage` | Menambah/mengedit tabel referensi |
| `user_access_manage` | Membuat akun dan mengatur hak akses |
| `akses_sementara_manage` | Memberikan hak akses sementara |
| `audit_log_view` | Melihat rekam jejak aktivitas sistem |
| `multi_satelit_view` | Lihat data dari SEMUA satelit |

**Role khusus:** `JEMAAT` = pengguna PWA mobile, token expire **180 hari** (bukan 1 hari seperti admin).

---

## Known Issues (Jangan "Fix" Tanpa Perintah)

| Masalah | Lokasi | Status |
|---|---|---|
| `new Pool()` lokal bukan singleton | `api/kegiatan/route.ts`, `api/kegiatan/[id]/route.ts` | ⚠️ Open — Medium (hanya 2 file ini tersisa; 8 file lain sudah fixed 2026-05-18) |
| POST bisa diakses semua user (harusnya `is_super_admin` only) | `api/settings/payroll-components/route.ts` | ⚠️ Open — Medium |
| ~~Tidak ada auth check + `created_by = 1` hardcoded~~ | ~~`api/buku-besar/jurnal/route.ts`~~ | ✅ Fixed 2026-05-15 |
| ~~Tidak ada permission check spesifik~~ | ~~`api/pegawai/route.ts` & `api/pegawai/[id]/route.ts`~~ | ✅ Fixed 2026-05-15 |
| ~~Tidak ada global auth guard (`middleware.ts`)~~ | ~~Semua `/api/*` route~~ | ✅ Fixed 2026-05-18 — `src/proxy.ts` sudah ada sebagai global gate |
| ~~Hardcoded `role_id = 21` (Staf Pastoral)~~ | ~~`api/kegiatan/pastoral/[id]/assign`, `api/kegiatan/pastoral/pic-options`~~ | ✅ Fixed 2026-05-18 — diganti subquery `(SELECT id FROM role_pelayan WHERE nama_role = 'Staf Pastoral')` |
| ~~SQL injection: `caller.satelit_id` raw di SQL~~ | ~~`api/settings/organisasi/route.ts` tab konflik~~ | ✅ Fixed 2026-05-18 — diganti `$1` + `rbacParams` array |
| ~~Tidak ada auth check (route public tanpa login)~~ | ~~`api/laporan/realisasi-kegiatan/route.ts`~~ | ✅ Fixed 2026-05-18 — ditambahkan `getCallerFromRequest()` |
| ~~IDOR cross-satelit: tidak ada ownership check~~ | ~~`api/pegawai/[id]` PUT/PATCH~~ | ✅ Fixed 2026-05-18 — tambah fetch `satelit_id` + 403 jika beda satelit |
| ~~IDOR cross-satelit: tidak ada ownership check~~ | ~~`api/anggaran/tahunan/[id]` PUT/DELETE~~ | ✅ Fixed 2026-05-18 — tambah `satelit_id` di SELECT + 403 jika beda satelit |
| ~~IDOR cross-satelit + DELETE tanpa status guard~~ | ~~`api/kegiatan/[id]` PUT/DELETE~~ | ✅ Fixed 2026-05-18 — tambah satelit check + DELETE guard status Draft only |

---

## Dilarang Keras
- `new Pool()` lokal
- SQL tanpa parameterized values
- Route handler tanpa `getCallerFromRequest()`
- Hardcode `user_id`, `role_id`, `satelit_id` di kode produksi
- Mengubah nama field di response JSON yang sudah dipakai frontend
- Refactor pola arsitektur modul tanpa instruksi eksplisit
- Mengubah atau menghapus file di folder `migrations/`
