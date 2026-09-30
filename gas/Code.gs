/**
 * Dompet Harian -- Google Apps Script "backend" buat upload foto struk ke
 * Google Drive dari PWA (lewat browser HP).
 *
 * CARA PAKAI (lihat juga README.md bagian "Setup Google Apps Script"):
 *   1. Buka https://script.google.com -> New project.
 *   2. Hapus isi default Code.gs, tempel isi file ini.
 *   3. Ganti FOLDER_ID di bawah dengan ID folder Google Drive tujuan.
 *   4. Deploy -> New deployment -> pilih tipe "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   5. Salin URL deployment (diakhiri "/exec"), taruh di .env sebagai
 *      VITE_GAS_UPLOAD_URL.
 *
 * CATATAN PRIVASI: supaya foto struk bisa langsung ditampilkan sebagai
 * thumbnail di app (tanpa harus login Google dulu), file yang diupload
 * lewat script ini otomatis diset "Anyone with the link can view". Artinya
 * siapa pun yang tahu/menebak link filenya bisa lihat gambarnya -- link-nya
 * sendiri tidak ditaruh di tempat publik mana pun, tapi ini bukan private
 * secara penuh seperti file Drive biasa. Kalau kamu tidak nyaman dengan ini,
 * bisa diubah nanti (misal simpan private + selalu buka pakai akun Google
 * yang sama) -- tinggal bilang, konsekuensinya foto tidak bisa auto-preview
 * di dalam app.
 */

// TODO: ganti dengan ID folder Google Drive tujuan upload foto struk.
// ID folder = bagian di URL setelah "folders/", misal:
// https://drive.google.com/drive/folders/1AbCDEfGhIjKlMnOpQrStUvWxYz
//                                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^ ini ID-nya
const FOLDER_ID = "GANTI_DENGAN_ID_FOLDER_DRIVE_KAMU";

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "Request kosong / tidak ada body." });
    }

    const body = JSON.parse(e.postData.contents);
    const filename = String(body.filename || `struk-${Date.now()}.jpg`);
    const mimeType = String(body.mimeType || "image/jpeg");
    const dataBase64 = body.dataBase64;

    if (!dataBase64) {
      return jsonResponse({ ok: false, error: "dataBase64 kosong." });
    }
    if (FOLDER_ID === "GANTI_DENGAN_ID_FOLDER_DRIVE_KAMU") {
      return jsonResponse({
        ok: false,
        error: "FOLDER_ID di Code.gs belum diganti -- lihat komentar di bagian atas file.",
      });
    }

    const folder = DriveApp.getFolderById(FOLDER_ID);
    const bytes = Utilities.base64Decode(dataBase64);
    const blob = Utilities.newBlob(bytes, mimeType, filename);
    const file = folder.createFile(blob);

    // Supaya link-nya bisa langsung dipakai sebagai <img src> di PWA tanpa
    // perlu login Google tiap buka -- lihat catatan privasi di atas.
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = file.getId();
    // CATATAN: sebelumnya pakai "https://drive.google.com/uc?export=view&id=..."
    // -- Google mematikan pola link itu untuk hotlink <img> pada tahun 2024
    // (selalu muncul ikon gambar rusak/broken image sejak saat itu). Endpoint
    // "thumbnail" di bawah ini yang sekarang umum dipakai & terbukti jalan.
    const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;

    return jsonResponse({ ok: true, fileId, url });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doGet() {
  // Cuma buat cek cepat lewat browser bahwa deployment-nya hidup.
  return jsonResponse({ ok: true, message: "Dompet Harian upload endpoint aktif." });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
