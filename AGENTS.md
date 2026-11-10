# AGENTS.md — SIA GSJA (BSC Performance Management System)

> [!CRITICAL]
> ## ATURAN KESELAMATAN LINGKUNGAN & DATABASE (WAJIB DIIKUTI)
> 1. **PRODUCTION (GEREJA AKTIF):**
>    - **URL:** `https://gsja.vercel.app`
>    - **Supabase DB:** `stqsbfmhdemyxtyltivs`
>    - **STATUS:** SEDANG DIPAKAI OLEH RATUSAN USER AKTIF GEREJA.
>    - **ATURAN:** **DILARANG KERAS** menjalankan query modifikasi data (UPDATE/DELETE/TRUNCATE), migration, atau alter table ke database ini! Branch `main` tidak boleh disentuh sembarangan tanpa testing tuntas.
> 
> 2. **STAGING & LOCALHOST (TESTING & PENGEMBANGAN):**
>    - **URL:** `https://gsja-staging.vercel.app` & `http://localhost:3000`
>    - **Supabase DB:** `unqbekiwjzaundmdlfxo` (Password: `@gsjastaging123`)
>    - **STATUS:** Testing sandbox untuk dosen dan developer (data jemaat dipangkas ~20 orang).
>    - **ATURAN:** File `.env.local` di laptop pengembangan **WAJIB** mengarah ke database staging ini. Semua fitur baru dan bugfix dikerjakan di branch `staging`.

## Tentang Project
- Next.js 16 (App Router), TypeScript 5 strict mode, fullstack monolith (frontend + API dalam satu repo)
- PostgreSQL via `pg`, **TANPA ORM** — semua query SQL ditulis manual, selalu parameterized (`$1, $2, ...`), jangan pernah string concat ke query
- Auth: JWT di httpOnly cookie, diverifikasi lewat `getCallerFromRequest(request)` di setiap API route
- RBAC berbasis permission string: `caller.permissions.includes('nama_permission')`
- Pool koneksi DB adalah singleton di `src/lib/db.ts` — jangan bikin instance `pg.Pool` baru di file lain

## Alur arsitektur (wajib diikuti untuk fitur baru)

```
Browser → Page ('use client') → fetch('/api/...') → Route Handler (route.ts) → Repository (src/server/repositories/) → pool.query() → PostgreSQL
```

Route handler = controller tipis. Logika akses DB **harus** lewat repository, bukan SQL inline di route.
(Ada beberapa file lama yang melanggar ini — lihat bagian "Technical debt" di bawah. Jangan tiru, dan jangan diubah tanpa diminta eksplisit.)

## Konvensi wajib

### Response shape API (semua endpoint, termasuk auth)
```
List + paginasi: { success: true, data: [...], meta: { total, limit, offset } }
Single / mutasi: { success: true, data: {...}, message: '...' }
Error:           { success: false, message: '...' }
```

### Struktur route handler standar
```typescript
export async function GET(request: NextRequest) {
  // Auth & permission check SELALU di luar try/catch
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.permissions.includes('nama_permission')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    // logika lewat repository di sini, jangan query langsung
    return NextResponse.json({ success: true, data, meta: { total, limit, offset } });
  } catch (error) {
    console.error('[NamaRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
```

### Repository
- Export **sebagai class**, instansiasi di route file: `const xRepository = new XRepository();`
- Jangan export instance langsung (`export const xRepository = new XRepository()`) — pola lama di `auditLog.repository.ts`, jangan ditiru untuk repository baru
- Tidak ada try/catch di dalam repository — biarkan error propagate ke route handler

### Dynamic SQL di Repository
Gunakan pola ini secara konsisten untuk semua repository baru:
- Nama array kondisi: `conditions` (bukan `whereClauses`)
- Nama index: `idx` (bukan `paramIndex`)
```typescript
const conditions: string[] = [];
const values: any[] = [];
let idx = 1;

if (search) {
  conditions.push(`nama ILIKE $${idx++}`);
  values.push(`%${search}%`);
}

const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
```

### Transaksi Database
Untuk operasi multi-tabel yang harus atomic, gunakan `client` dari pool:
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... query-query
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```
Pola ini sudah dipakai di beberapa repository — konsisten dengan ini untuk fitur baru.

### Naming
| Item | Pola | Contoh |
|---|---|---|
| File repository | `namaModul.repository.ts` | `jemaat.repository.ts` |
| Komponen React | `PascalCase.tsx` | `SubmitOverlay.tsx` |
| Server utility | `camelCase.ts` | `getCallerFromRequest.ts` |
| Kolom DB / parameter SQL | `snake_case` | `satelit_id`, `is_active` |
| Variabel/fungsi TS | `camelCase` | `queryParams` |
| Interface | `PascalCase` | `JemaatData` |
| Interface filter | `NamaFilterParams` | `JemaatFilterParams` |

### Logging
- Hanya `console.error`, cuma di dalam catch block, format: `console.error('[NamaRoute] METHOD error:', error)`
- Jangan tambah `console.log` untuk debug permanen — hapus sebelum selesai task

### Data fetching frontend
Semua page adalah `'use client'`. Pola fetch standar (pertahankan cleanup flag-nya):
```typescript
useEffect(() => {
  let active = true;
  setLoading(true);
  const fetchData = async () => {
    try {
      const res = await fetch('/api/...');
      const json = await res.json();
      if (json.success && active) setState(json.data);
    } catch (e) {
      console.error('...', e);
    } finally {
      if (active) setLoading(false);
    }
  };
  fetchData();
  return () => { active = false; };
}, [deps]);
```

### Dependency yang ADA di package.json tapi JANGAN dipakai
- `axios` → pakai `fetch` native
- `zod` → validasi manual (belum ada standar; tanya dulu kalau mau mulai migrasi ke zod)
- `bcryptjs` → pakai `bcrypt` (native bindings, yang aktif dipakai)

## Technical debt yang diketahui — jangan diperparah, jangan diubah tanpa diminta eksplisit
- `(main)/page.tsx` (~1.800 baris), `(main)/layout.tsx` (~1.016 baris), `jemaat.repository.ts` (~962 baris) — file besar. `page.tsx` sengaja mendefinisikan sub-komponen di file scope untuk mencegah re-render bug, ini keputusan sadar bukan kecelakaan. Kalau nambah fitur ke file ini, tanya dulu apakah perlu dipisah.
- `api/members/route.ts`, `api/options/route.ts`, `api/master-data/route.ts` — masih ada SQL inline, tidak lewat repository. Debt lama, jangan ditiru di route baru.
- Tidak ada test framework (Jest/Vitest/Playwright) — jangan asumsikan ada test yang bisa dijalankan. Kalau diminta bikin test, tanya dulu mau pakai framework apa.
- Tidak ada `middleware.ts` — auth guard sepenuhnya di client (`layout.tsx` fetch `/api/auth/me` lalu redirect). Jangan ubah pola ini tanpa diminta eksplisit.
- `auth/login/route.ts` masih pakai response shape lama (tanpa field `success`) — jangan ditiru di route baru. Mengubahnya butuh koordinasi karena frontend sudah bergantung ke shape ini.
- ESLint men-downgrade `@typescript-eslint/no-explicit-any`, `no-unused-vars`, dan `react-hooks/exhaustive-deps` dari error ke warn. Untuk kode baru, tetap perlakukan sebagai error meskipun linter cuma warn.

## Sebelum mulai kerjain task
1. Cek dulu apakah ada repository yang relevan di `src/server/repositories/` sebelum bikin query baru
2. API endpoint baru wajib ikuti struktur route handler di atas persis
3. Kalau ragu antara "ikuti pola lama yang inkonsisten" vs "pola yang benar di dokumen ini" — pakai yang di dokumen ini, dan sebutkan di response bahwa kamu menyimpang dari pola lama yang salah

---
Update file ini kalau ada keputusan arsitektur baru atau pola berubah.
