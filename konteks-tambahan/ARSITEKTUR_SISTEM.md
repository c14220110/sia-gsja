# Arsitektur Sistem — SIA GSJA Eben Haezer

> Dokumen ini menjelaskan arsitektur **aktual** sistem berdasarkan verifikasi kode pada 19 Mei 2026.

---

## 1. Tech Stack

| Layer | Teknologi |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Backend** | Next.js API Routes (`route.ts`) |
| **Database** | PostgreSQL (via `pg` library, koneksi pool) |
| **Auth** | JWT (httpOnly cookie), Bcrypt password hashing |
| **File Storage** | Supabase Storage / Cloudflare R2 |
| **Notifications** | Web Push API |
| **Document Export** | Docxtemplater (DOCX generation) |

---

## 2. Arsitektur Backend — Hybrid Pattern

Sistem ini menggunakan **2 pola arsitektur** yang hidup berdampingan:

### Pola A: Layered Architecture (4 modul, ~7%)

```
Browser → route.ts → Controller → Service → Repository → PostgreSQL
                         ↓              ↓           ↓
                    Zod Validation   Bcrypt/JWT   SQL Query
```

**Modul yang pakai pola ini:**
- `auth/login` — Controller → Service (JWT + Bcrypt) → Repository
- `members` (jemaat GET/POST) — Controller → Service → Repository + Zod validation
- `family-tree` — Controller → Repository (tanpa Service)
- `options` — Controller → Service → Repository

**File terkait:**
```
src/server/
├── controllers/     → auth, jemaat, familyTree, master
├── services/        → auth, jemaat, master
├── repositories/    → user, jemaat, familyTree, master, pelayan, pengurus, auditLog, akunAkses
└── validations/     → auth (Zod), jemaat (Zod)
```

### Pola B: Fat Route (59+ route files, ~93%)

```
Browser → route.ts → langsung pool.query() → PostgreSQL
              ↓
         Auth check + Permission check + IDOR check + SQL query
         (semua dalam 1 file)
```

**Modul yang pakai pola ini:**
Anggaran, Kegiatan, Pegawai, Pelayan*, Pengurus*, Payroll, Buku Besar, Settings, Pastoral, dll.

> *Pelayan dan Pengurus pakai Repository tapi tanpa Controller/Service — route langsung panggil repository.

### Kenapa Hybrid?

- Modul inti awal (Auth, Jemaat) dibangun dengan pola layered karena dikembangkan pertama kali
- Modul-modul selanjutnya dibangun langsung di `route.ts` karena lebih pragmatis untuk Next.js App Router
- **Kedua pola sama-sama aman** — keamanan ditentukan oleh auth guard, bukan jumlah layer

---

## 3. Alur Keamanan (Berlaku untuk SEMUA modul)

```
Request masuk
    ↓
[1] getCallerFromRequest(request)
    → Baca JWT dari cookie `access_token`
    → Decode dan return: user_id, role_id, satelit_id, permissions[], is_super_admin
    → Jika gagal → 401 Unauthorized
    ↓
[2] Permission Guard
    → if (!caller.is_super_admin && !caller.permissions.includes('xxx')) → 403
    ↓
[3] IDOR / Ownership Check (untuk write endpoints)
    → Fetch data dari DB, bandingkan satelit_id caller vs data
    → Jika beda satelit dan bukan super_admin → 403
    ↓
[4] Business Logic + SQL Query
    ↓
[5] Return JSON Response
```

### Pengecualian yang SAH (bukan bug):
- `auth/login`, `auth/forgot-password`, `auth/reset-password`, `auth/force-change-password` — **public endpoints**, tidak perlu JWT
- `auth/me` — membaca JWT sendiri untuk return user data, bukan via `getCallerFromRequest`
- `auth/select-role` — flow multi-role selection setelah login

---

## 4. Database Connection

### Singleton Pool (standar — mayoritas modul)
```typescript
import pool from '@/lib/db';  // src/lib/db.ts
const result = await pool.query('SELECT ...', [param]);
```

### Local Pool (known debt — 2 file kegiatan)
```typescript
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```
File: `api/kegiatan/route.ts`, `api/kegiatan/[id]/route.ts`
> Dipertahankan sementara karena kompleksitas migrasi. Didokumentasikan di AGENTS.md.

---

## 5. Frontend Architecture

### Routing
- Next.js App Router (`src/app/`)
- `(main)/` — layout admin dengan sidebar (protected)
- Public pages: `/login`, `/select-role`, `/jadwal`, `/registrasi`

### State Management
- **Tidak ada global state** (Redux/Zustand)
- Per-page `useState` + `useEffect` dengan `fetch()` ke API
- User data di-cache ke `localStorage` untuk offline support (PWA)

### Sidebar Visibility
- Sepenuhnya dikontrol via `hasPermission()` yang membaca `userData.permissions[]`
- Tidak ada hardcoded role_id di sidebar (sudah dibersihkan 19 Mei 2026)

### PWA (Jemaat Role)
- Jemaat dengan `role_name === 'jemaat'` dialihkan ke `JemaatPwaLayout`
- Token JWT berlaku 180 hari (vs 1 hari untuk admin)
- Fitur: Jadwal Kegiatan, Registrasi, Profil, Riwayat Kehadiran

---

## 6. Permission System

### Tabel Database
```
pengguna → user_role (role_id, satelit_id, komisi_id, departemen_id)
                ↓
            role → role_permission → permission
```

### Flow
1. Saat login, `auth.service.ts` query `role_permission` untuk get semua `permission.nama_permission`
2. Permission array di-embed ke JWT payload
3. Setiap request, `getCallerFromRequest` decode JWT → `caller.permissions[]`
4. Guard: `caller.permissions.includes('nama_permission')` atau `caller.is_super_admin`

### Daftar Permission Aktif
| ID | Permission | Digunakan Di |
|---|---|---|
| 1 | `jemaat_view` | members GET, sidebar |
| 2 | `jemaat_create` | members POST |
| 3 | `jemaat_edit` | members PUT/PATCH |
| 5 | `pelayan_manage` | pelayan POST/PUT/DELETE |
| 7 | `pengurus_manage` | pengurus POST/PUT |
| 9 | `kegiatan_create` | kegiatan POST |
| 34 | `kegiatan_manage` | kegiatan PATCH/PUT/DELETE |
| 40 | `anggaran_create` | anggaran POST/PUT/DELETE |
| 41 | `anggaran_review` | anggaran review/batalkan |
| 44-47 | `pegawai_*` | pegawai CRUD |
| 48 | `penggajian_manage` | payroll |
| 53 | `multi_satelit_view` | cross-satelit data access |

---

## 7. Folder Structure (Ringkas)

```
gsja/
├── src/
│   ├── app/
│   │   ├── (main)/          → Protected pages (admin sidebar layout)
│   │   │   ├── dashboard/
│   │   │   ├── jemaat/
│   │   │   ├── pelayan/
│   │   │   ├── pengurus/
│   │   │   ├── kegiatan/
│   │   │   ├── anggaran/
│   │   │   ├── pegawai/
│   │   │   ├── buku-besar/
│   │   │   ├── settings/
│   │   │   └── layout.tsx   → Sidebar + auth guard
│   │   ├── api/             → 75+ API route handlers
│   │   ├── login/           → Public login page
│   │   └── layout.tsx       → Root layout + global providers
│   ├── server/
│   │   ├── controllers/     → 4 files (auth, jemaat, familyTree, master)
│   │   ├── services/        → 3 files (auth, jemaat, master)
│   │   ├── repositories/    → 8 files
│   │   ├── validations/     → 2 files (auth, jemaat) — Zod schemas
│   │   └── utils/           → getCallerFromRequest, jwt, kegiatanUtils
│   ├── lib/
│   │   ├── db.ts            → PostgreSQL singleton pool
│   │   └── notificationService.ts → Web Push
│   └── components/
│       ├── ui/              → Reusable UI components
│       └── layouts/         → JemaatPwaLayout
├── public/                  → Static assets, PWA manifest
├── AGENTS.md                → Development rules + known issues
└── next.config.ts
```
