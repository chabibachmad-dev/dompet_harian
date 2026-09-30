# Dompet Harian 💸

PWA pribadi untuk mencatat pengeluaran harian:

1. Login pakai email/kata sandi sendiri, atau langsung "Lanjutkan dengan Google".
2. Tiap catatan pengeluaran: tanggal, nominal, kategori (bawaan atau buat sendiri), catatan, dan foto struk opsional.
3. Foto struk diambil langsung dari **kamera HP** (tap tombol → kamera kebuka), lalu diupload ke **Google Drive** kamu sendiri lewat Google Apps Script -- Supabase cuma menyimpan link-nya, bukan file gambarnya.
4. Desain disamakan dengan project **ringkasan_harian**: murni hitam/putih, font monospace, gaya "Snail OS".

Database-nya pakai **Supabase project yang sama** dengan ringkasan_harian -- cuma tabelnya beda (`expenses`, `custom_categories`), jadi tidak menyentuh tabel `summaries`/`chat_messages`/`push_subscriptions` yang sudah ada di sana.

## Arsitektur singkat

```
PWA (GitHub Pages, repo baru "dompet_harian")
   │
   ├── Supabase Auth ---- login email/password ATAU Google OAuth
   │
   ├── Supabase Postgres  (tabel expenses, custom_categories -- RLS per user_id)
   │      dibaca/ditulis LANGSUNG dari browser lewat anon key + RLS
   │      (bukan lewat Edge Function, beda dari ringkasan_harian)
   │
   └── Google Apps Script (Web App, jalan di akun Google kamu sendiri)
          menerima foto (base64) dari browser → simpan ke folder Drive kamu
          → balikin link filenya → link itu yang disimpan ke kolom
          expenses.receipt_url
```

Beda penting dari ringkasan_harian: di sana semua orang yang tahu link bisa buka (tanpa login, dikunci pakai kode akses untuk fitur privat). Di sini beneran ada sistem akun -- tiap orang yang login cuma bisa lihat/ubah catatan pengeluaran miliknya sendiri (dijamin oleh Row Level Security di database, bukan cuma disembunyikan di frontend).

---

## 0. Yang kamu butuhkan

- Repo GitHub **baru** bernama `dompet_harian` (bukan repo ringkasan_harian yang sudah ada) + GitHub Desktop untuk push.
- Project Supabase yang sama seperti ringkasan_harian (URL & anon key sudah dipakai otomatis di kode ini).
- [Node.js](https://nodejs.org/) versi 20+ di komputer, untuk build.
- Akun Google (buat Apps Script + opsional login Google) -- boleh pakai akun Google yang sama seperti biasa.

Salin semua file di folder ini ke folder lokal repo `dompet_harian` kamu (yang sudah di-clone lewat GitHub Desktop), lalu ikuti langkah di bawah **sebelum** push ke GitHub.

---

## 1. Setup database Supabase

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) → project kamu (yang sama dengan ringkasan_harian) → **SQL Editor**.
2. Jalankan isi file `supabase/migrations/0001_expenses.sql` -- ini bikin tabel `expenses` & `custom_categories` beserta RLS-nya, **tidak** mengubah tabel lain yang sudah ada.

## 2. Setup Google Apps Script (upload foto struk ke Drive)

1. Di Google Drive kamu, buat folder baru khusus buat nyimpen foto struk (misal namanya "Struk Dompet Harian"). Buka folder itu, salin **ID folder**-nya dari URL address bar:
   ```
   https://drive.google.com/drive/folders/1AbCDEfGhIjKlMnOpQrStUvWxYz
                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^ ini ID-nya
   ```
2. Buka https://script.google.com → **New project**.
3. Hapus semua isi default `Code.gs`, tempel isi file `gas/Code.gs` dari folder ini.
4. Cari baris `const FOLDER_ID = "GANTI_DENGAN_ID_FOLDER_DRIVE_KAMU";`, ganti dengan ID folder dari langkah 1.
5. (Opsional tapi disarankan) Ganti nama project-nya jadi "Dompet Harian Upload" lewat judul di pojok kiri atas, biar gampang dikenali nanti.
6. Klik **Deploy → New deployment**.
   - Klik ikon gerigi di sebelah "Select type" → pilih **Web app**.
   - **Execute as**: `Me` (akun Google kamu).
   - **Who has access**: `Anyone`.
   - Klik **Deploy**. Google mungkin minta kamu login ulang & konfirmasi izin akses Drive -- izinkan.
7. Setelah deploy selesai, salin **Web app URL**-nya (formatnya `https://script.google.com/macros/s/xxxxx/exec`). Ini yang dipakai sebagai `VITE_GAS_UPLOAD_URL` di langkah 4.

**Catatan privasi**, penting dibaca: supaya foto struk bisa langsung tampil sebagai thumbnail di app tanpa perlu login Google berulang kali, script ini otomatis men-share tiap file yang diupload sebagai "Anyone with the link can view". Artinya file itu tidak 100% privat seperti file Drive biasa -- siapa pun yang entah bagaimana tahu link persis file itu bisa membukanya. Link-nya sendiri acak & panjang (tidak disebar ke mana-mana), jadi risikonya rendah untuk pemakaian pribadi, tapi tetap perlu kamu sadari. Kalau nanti berubah pikiran, kasih tahu aku, bisa diubah supaya foto disimpan privat -- konsekuensinya app tidak bisa auto-preview foto di dalam list.

**Kalau nanti kamu edit `Code.gs` lagi** (misal ganti folder tujuan): buka lagi project script-nya → **Deploy → Manage deployments** → klik ikon pensil di deployment yang ada → ubah **Version** ke "New version" → **Deploy**. Dengan cara ini URL `/exec`-nya tetap sama, tidak perlu update `.env`/secret lagi. Kalau kamu malah bikin "New deployment" baru (bukan edit yang lama), URL-nya akan beda dan harus diupdate ulang di `.env` + GitHub secret.

## 3. Setup login via Google (opsional, tapi kalau mau tombol "Lanjutkan dengan Google" berfungsi wajib ini)

Kalau kamu cuma mau pakai login email/kata sandi, langkah ini **boleh dilewati** -- tab "Daftar"/"Masuk" di app sudah otomatis jalan tanpa setup tambahan.

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) → project kamu → **Authentication → Providers → Google**.
2. Aktifkan toggle-nya. Supabase akan menampilkan sebuah **Callback URL** (formatnya `https://<project-id>.supabase.co/auth/v1/callback`) -- salin, dipakai di langkah 4.
3. Buka [Google Cloud Console](https://console.cloud.google.com/) → buat project baru (atau pakai yang sudah ada) → **APIs & Services → OAuth consent screen** → isi info dasar (nama app "Dompet Harian", email kamu) → simpan. Kalau ditanya "User type", pilih **External** lalu tambahkan email kamu sendiri sebagai **Test user** (supaya tidak perlu proses review Google, cukup buat kamu pakai sendiri).
4. Masih di Google Cloud Console → **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized redirect URIs**: tempel Callback URL dari langkah 2.
   - Klik **Create** → salin **Client ID** dan **Client Secret** yang muncul.
5. Balik ke Supabase Dashboard (halaman provider Google dari langkah 1), tempel Client ID & Client Secret, klik **Save**.
6. Masih di Supabase Dashboard → **Authentication → URL Configuration** → di bagian **Redirect URLs**, tambahkan:
   - `http://localhost:5173/*` (buat testing lokal)
   - URL GitHub Pages kamu nanti, misal `https://username.github.io/dompet_harian/*` (isi setelah langkah 5 di bawah selesai & kamu tahu URL aslinya -- boleh balik ke sini belakangan untuk nambahin).

## 4. Konfigurasi frontend

1. Salin `.env.example` menjadi `.env`.
2. Isi `VITE_GAS_UPLOAD_URL` dengan Web app URL dari langkah 2 (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` sudah otomatis terisi sama seperti ringkasan_harian, karena memang project Supabase yang sama).
3. Test lokal kalau mau: `npm install` lalu `npm run dev`, buka `http://localhost:5173`.

## 5. Push ke GitHub & deploy ke GitHub Pages

1. Buat repo GitHub baru bernama `dompet_harian` (kalau belum ada), clone lewat GitHub Desktop, taruh semua file dari folder ini di situ.
2. Commit semua file, push ke `main`.
3. Di GitHub.com, buka repo → **Settings → Pages** → bagian **Build and deployment**, pilih Source: **GitHub Actions**.
4. Buka **Settings → Secrets and variables → Actions → New repository secret**, tambahkan 3 secret ini (nilainya sama seperti isi `.env` kamu):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GAS_UPLOAD_URL`
5. Push commit apa saja ke `main` (atau buka tab **Actions** → jalankan workflow "Deploy PWA ke GitHub Pages" secara manual) untuk memicu deploy pertama.
6. Setelah selesai (cek tab **Actions**), URL PWA kamu ada di **Settings → Pages**, biasanya `https://<username>.github.io/dompet_harian/`.
7. Kalau kamu setup login Google di langkah 3: balik ke Supabase Dashboard → **Authentication → URL Configuration → Redirect URLs**, tambahkan URL GitHub Pages ini (`https://<username>.github.io/dompet_harian/*`) kalau belum.

## 6. Install & mulai pakai di HP

1. Buka URL GitHub Pages kamu di browser HP.
2. (Opsional, biar terasa seperti app asli) Tambahkan ke Layar Utama: di Safari (iPhone) lewat tombol Share → "Add to Home Screen"; di Chrome (Android) lewat menu → "Add to Home screen" / "Install app".
3. Daftar akun baru (email + kata sandi) atau langsung "Lanjutkan dengan Google".
4. Tap tombol "+" di kanan bawah untuk catat pengeluaran pertama -- coba tap "Ambil / Pilih Foto" untuk lihat kamera HP langsung kebuka.

---

## Kalau foto struk muncul ikon gambar rusak (broken image)

Ini bug yang sempat kejadian di versi awal: link foto yang dipakai (`drive.google.com/uc?export=view&id=...`) ternyata dimatikan Google untuk hotlink `<img>` sejak 2024, jadi selalu muncul ikon rusak walau upload-nya sendiri berhasil.

**Sudah diperbaiki** di `gas/Code.gs` -- sekarang pakai `drive.google.com/thumbnail?id=...&sz=w1000` yang memang didesain untuk ini. Supaya perbaikannya aktif:

1. Buka lagi project Apps Script kamu di https://script.google.com, tempel ulang isi `gas/Code.gs` yang baru (atau cari baris `const url = ...` dan ganti sesuai file ini).
2. **Deploy → Manage deployments** → klik ikon pensil di deployment yang ada → Version: **New version** → **Deploy**. URL `/exec`-nya tetap sama, jadi `.env`/secret GitHub tidak perlu diubah.
3. Foto yang diupload **setelah** langkah ini otomatis kepakai link yang benar.
4. Foto yang sudah kadung tersimpan dengan link lama (rusak) perlu diperbaiki manual sekali lewat SQL Editor Supabase -- file aslinya di Drive tidak hilang, cuma link yang tersimpan di database perlu diganti formatnya:

   ```sql
   update public.expenses
   set receipt_url = 'https://drive.google.com/thumbnail?id='
     || substring(receipt_url from 'id=([^&]+)')
     || '&sz=w1000'
   where receipt_url like '%uc?export=view%';
   ```

   Jalankan sekali saja, aman diulang (baris yang sudah benar otomatis tidak match kondisi `where`-nya).

## Catatan keamanan & privasi

- Beda dari ringkasan_harian, aplikasi ini beneran pakai sistem akun (Supabase Auth). Tabel `expenses` & `custom_categories` punya Row Level Security yang membatasi tiap pengguna cuma bisa membaca/mengubah baris miliknya sendiri (`user_id = auth.uid()`) -- ini dijamin di level database, bukan cuma disembunyikan di tampilan.
- `anon key` Supabase memang didesain publik ada di kode frontend (bukan kebocoran) -- yang menjaga privasi data adalah RLS di atas, bukan kerahasiaan key ini.
- Foto struk di Google Drive di-share sebagai "anyone with the link can view" (lihat catatan privasi di langkah 2) supaya bisa auto-preview di app.
- URL Web App Google Apps Script diset "Anyone" bisa memanggilnya (bukan cuma kamu yang login) -- ini supaya frontend bisa langsung upload tanpa perlu proses login Google terpisah tiap upload foto. Konsekuensinya: siapa pun yang entah bagaimana tahu persis URL `/exec` itu secara teknis bisa memakainya untuk upload file ke folder Drive kamu. Untuk pemakaian pribadi (URL tidak pernah disebar/dipublikasikan) risikonya kecil, tapi tetap perlu kamu sadari -- jangan taruh URL itu di tempat publik.

## Batasan yang perlu diketahui

- Daftar pengeluaran mengambil maksimal 500 baris terbaru sekaligus (lihat `FETCH_LIMIT` di `src/expenses.js`) -- lebih dari cukup untuk pemakaian pribadi biasa, tapi kalau suatu saat riwayatnya jadi sangat panjang (ribuan baris), bisa diubah jadi query berpaginasi per bulan.
- Aplikasi ini sengaja dibuat satu bahasa (Indonesia) tanpa toggle ID/EN seperti ringkasan_harian, supaya lebih ringkas -- gampang ditambahkan belakangan kalau ternyata dibutuhkan.
- Total yang ditampilkan di atas cuma "total bulan ini" (pengeluaran, bukan pemasukan/saldo) -- sesuai cakupan yang diminta di awal.
