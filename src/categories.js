// Kategori bawaan -- daftar tetap yang selalu tersedia buat semua pengguna,
// tanpa perlu di-seed ke database. Kategori TAMBAHAN yang dibuat pengguna
// sendiri disimpan di tabel `custom_categories` (lihat src/expenses.js).
export const DEFAULT_CATEGORIES = [
  "Makanan & Minuman",
  "Transportasi",
  "Belanja",
  "Tagihan & Utilitas",
  "Kesehatan",
  "Hiburan",
  "Lain-lain"
];
