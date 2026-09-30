// Upload foto struk ke Google Drive lewat Google Apps Script (lihat
// gas/Code.gs). Supabase cuma menyimpan link hasil upload ini, bukan file
// gambarnya -- sesuai permintaan awal ("di Supabase cukup link nya aja").

const GAS_URL = import.meta.env.VITE_GAS_UPLOAD_URL;

const MAX_DIMENSION = 1600; // px -- cukup buat baca detail struk, tidak bikin file kegedean.
const JPEG_QUALITY = 0.82;

// Foto dari kamera HP bisa berukuran 4000x3000px+ (beberapa MB). Dikecilkan
// dulu lewat canvas sebelum di-base64-kan & dikirim, supaya upload cepat dan
// tidak kena limit ukuran request Google Apps Script.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > MAX_DIMENSION) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else if (height > MAX_DIMENSION) {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Gagal memproses gambar."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Gagal membaca file gambar."));
    };

    img.src = objectUrl;
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result = "data:image/jpeg;base64,AAAA..." -- ambil bagian setelah koma saja.
      const commaIdx = reader.result.indexOf(",");
      resolve(reader.result.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(new Error("Gagal membaca gambar sebagai base64."));
    reader.readAsDataURL(blob);
  });
}

export async function uploadReceiptPhoto(file) {
  if (!GAS_URL || GAS_URL.startsWith("ganti-dengan-")) {
    return {
      ok: false,
      error: "VITE_GAS_UPLOAD_URL belum di-set di .env -- deploy dulu gas/Code.gs (lihat README)."
    };
  }

  try {
    const compressed = await compressImage(file);
    const dataBase64 = await blobToBase64(compressed);
    const filename = `struk-${Date.now()}.jpg`;

    // Content-Type "text/plain" dipakai sengaja (BUKAN application/json) supaya
    // browser tidak melakukan CORS preflight (OPTIONS) -- Google Apps Script
    // Web App tidak menangani preflight, jadi request application/json biasa
    // akan gagal kena CORS. Kode di gas/Code.gs tetap mem-parse body ini
    // sebagai JSON, terlepas dari Content-Type yang dikirim.
    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ filename, mimeType: "image/jpeg", dataBase64 })
    });

    if (!res.ok) {
      return { ok: false, error: `Upload gagal (HTTP ${res.status}).` };
    }

    const data = await res.json();
    if (!data.ok) {
      return { ok: false, error: data.error || "Upload ke Google Drive gagal." };
    }

    return { ok: true, url: data.url };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Gagal upload foto. Cek koneksi internet kamu." };
  }
}
