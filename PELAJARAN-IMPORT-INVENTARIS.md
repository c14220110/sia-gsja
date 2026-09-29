# 📚 Pelajaran dari Import Excel → Database Maranatha
*Dokumen ini dibuat setelah ditemukan bug berulang saat import inventaris Maranatha ke database.*
*Wajib dibaca sebelum import data inventaris satelit manapun.*

---

## 🔴 Bug Yang Terjadi (Dan Diulang)

### Bug #1: UI Grouping Tidak Mempertimbangkan Lokasi

**Apa yang terjadi:**
Di halaman inventaris, item satuan di-group berdasarkan `nama + kategori_id` saja — tanpa `lokasi_sublokasi_id`. Akibatnya:

| Yang Muncul di UI (SALAH) | Yang Seharusnya |
|---|---|
| **Speaker Gantung — 18 unit** (IBD + LT3 campur) | Speaker Gantung IBD — 10 unit |
|  | Speaker Gantung LT3 — 8 unit |
| **Kursi Lipat — 102 unit** (IBD + SKL campur) | Kursi Lipat IBD — 76 unit |
|  | Kursi Lipat SKL — 26 unit |
| **Kursi — 240 unit** (IBD+SKL+LT3+GDG campur) | Kursi IBD — 160 unit |
|  | Kursi SKL — 58 unit |
|  | Kursi LT3 — 11 unit |
|  | Kursi GDG — 11 unit |
| **AC 1 PK — 6 unit** (GDG+IBD+LT3 campur) | AC 1 PK IBD — 5 unit |
|  | AC 1 PK GDG — 1 unit |
|  | AC 1 PK LT3 — 1 unit |

**Root cause:**
```typescript
// ❌ SALAH — grup tanpa lokasi → campur semua ruangan
const key = `${item.nama.trim().toLowerCase()}||${item.kategori_id}`;

// ✅ BENAR — grup per lokasi → tiap ruangan terpisah
const key = `${item.nama.trim().toLowerCase()}||${item.kategori_id}||${item.lokasi_sublokasi_id ?? 'null'}`;
```

**Fix:** Commit `0f244f6` — selalu include `lokasi_sublokasi_id` dalam grouping key.

---

### Bug #2: Pagination Grouped Mode Hanya Muat 10 Item Per Page

**Apa yang terjadi:**
Group "Kursi" muncul badge "10 unit" padahal seharusnya 160 — karena API limit=10 per request, tapi grouped view perlu SEMUA data untuk hitung group yang benar.

**Root cause:**
```typescript
// ❌ SALAH — limit 10, group cuma lihat 10 item
queryParams.append('limit', '10');

// ✅ BENAR — fetch semua item saat grouped mode
if (viewMode === 'grouped') {
  queryParams.append('all', 'true'); // bypass pagination, max 5000
}
```

**Fix:** Commit `5423dd4` — gunakan `?all=true` saat grouped mode.

---

## ✅ Aturan Wajib Saat Import Excel ke Database

### 1. Mapping Excel Tab → Sublokasi HARUS 1:1

```
Excel Tab "Lantai 1 (Ruang Ibadah Utama)" → sublokasi_id = 68 (IBD)
Excel Tab "Lantai 2 (Sekolah Minggu)"     → sublokasi_id = 73 (SKL)
Excel Tab "LT.3"                           → sublokasi_id = 86 (LT3)
Excel Tab "Ruang Multimedia"               → sublokasi_id = 69 (MLM)
Excel Tab "Gudang"                         → sublokasi_id = 71 (GDG)
```

**JANGAN pernah mix item dari tab berbeda ke sublokasi yang sama.**

### 2. Setiap Row di Excel = Satu Jenis Barang di Satu Ruangan

```
Row: Kursi Seahorse | Jumlah: 160 | Tab: Lantai 1 (IBD)
→ Insert 160 baris satuan, semua sublokasi_id = 68 (IBD)
BUKAN insert 160 baris dengan sublokasi berbeda-beda!
```

### 3. Navy Blue = Ganti ke Satuan, Tapi TETAP di Ruangan Asalnya

```
Excel Tab IBD, Row Navy: Kursi | 160 | Navy Blue
→ 160 baris satuan, SEMUA di IBD (sublokasi_id = 68)

Excel Tab SKL, Row Navy: Kursi | 58 | Navy Blue
→ 58 baris satuan, SEMUA di SKL (sublokasi_id = 73)
```

### 4. Verifikasi Wajib Setelah Import (Per Sublokasi)

```sql
SELECT ms.kode, b.nama, b.merk, COUNT(*) as unit
FROM barang b
JOIN master_sublokasi ms ON b.lokasi_sublokasi_id = ms.id
WHERE ms.satelit_id = [ID_SATELIT] AND b.is_deleted = false
GROUP BY ms.kode, b.nama, b.merk
ORDER BY ms.kode, b.nama;
```

Bandingkan hasil ini dengan Excel tab per tab. Jumlah HARUS cocok per ruangan.

### 5. Cek UI Setelah Deploy

Buka inventaris, filter ke satelit yang baru diimport, mode Grouped:
- ✅ Item dari ruangan berbeda → grup terpisah
- ✅ Item dalam satu ruangan → masuk grup yang sama
- ✅ Count badge = jumlah unit di SATU ruangan saja
- ❌ Jika count > jumlah di Excel satu tab → ada item tercampur dari ruangan lain

---

## 🧠 Pola Kesalahan yang Harus Dihindari

### Pola 1: "Sama nama = sama grup"
**SALAH.** Item dengan nama sama di ruangan berbeda adalah dua entitas berbeda. Selalu ikutkan lokasi dalam grouping key.

### Pola 2: Verifikasi hanya total keseluruhan, tidak per-ruangan
**SALAH.** Total keseluruhan bisa cocok (609 = 609) padahal distribusi per ruangan salah. Selalu verifikasi **per sublokasi**.

### Pola 3: Pagination diabaikan saat grouped view
**SALAH.** Grouped view perlu semua data untuk menghitung ukuran grup yang akurat.

### Pola 4: Langsung claim "sudah benar" tanpa buka UI dan scroll semua grup
**SALAH.** Selalu buka UI, expand beberapa grup, pastikan semua item dalam grup dari ruangan yang sama.

---

## 📋 Checklist Import Satelit Baru

**Sebelum mulai:**
- [ ] Baca semua tab Excel, kenali berapa sublokasi dan nama-namanya
- [ ] Map setiap tab Excel ke `master_sublokasi.id` yang benar di DB

**Saat import:**
- [ ] Script import looping per-tab, tiap tab set sublokasi_id-nya sendiri
- [ ] Navy = satuan, non-navy = massal, tapi keduanya TETAP di sublokasi asalnya
- [ ] Setelah selesai, query DB per sublokasi dan bandingkan dengan Excel tab per tab

**Setelah import:**
- [ ] Buka UI inventaris, filter ke satelit yang baru
- [ ] Mode Grouped: pastikan tidak ada item lintas-ruangan dalam satu grup
- [ ] Spot-check grup yang banyak item (Kursi, Speaker, AC, dll)
- [ ] Konfirmasi ke user sebelum menutup task

---

## 📁 File Terkait

| File | Fungsi | Hal Kritis |
|---|---|---|
| `src/app/(main)/inventaris/page.tsx` | Grouping logic | Key wajib include `lokasi_sublokasi_id` |
| `src/app/api/inventaris/route.ts` | API | Support `?all=true` untuk grouped mode |
| `src/server/repositories/inventaris.repository.ts` | Query | Returns `lokasi_sublokasi_id`, `lokasi_nama_sublokasi` |

---

## 🔧 Fix Yang Sudah Diterapkan untuk Maranatha

| Commit | Fix |
|---|---|
| `0f244f6` | Grouping key tambah `lokasi_sublokasi_id` — item beda ruangan tidak campur |
| `5423dd4` | Grouped mode fetch semua item (`?all=true`) — count grup akurat |
| `f72ce2c` | Print semua QR unik per grup satuan |
| `c60b175` | Opsi MINI (kecilkan 30%) di bulk print |

---

*Dibuat: 2026-09-29 | Satelit: Maranatha (satelit_id=12, 609 item aktif)*
