// Foto santri: disimpan di basis data (kecil, sudah dipotong dan dikompres di peramban) dan hanya
// disajikan kepada pengurus atau wali santri yang bersangkutan.
import type { DB } from '../db';
import { GalatPengguna, satu, sekarang } from '../util';

const BATAS_BYTE = 600 * 1024;

function keBita(base64: string): Uint8Array {
  const biner = atob(base64);
  const hasil = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) hasil[i] = biner.charCodeAt(i);
  return hasil;
}

/** Jenis gambar dari tanda tangan berkas, bukan dari klaim pengirim. */
function jenisGambar(b: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

/** better-sqlite3 mengikat Buffer sebagai BLOB; di pratinjau peramban Uint8Array sudah cukup. */
const untukDb = (b: Uint8Array): Uint8Array => {
  const B = (globalThis as { Buffer?: { from(b: Uint8Array): Uint8Array } }).Buffer;
  return B ? B.from(b) : b;
};

export function simpanFoto(db: DB, santriId: number, dataUrl: string, oleh: string): string {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new GalatPengguna(400, 'Berkas foto tidak dikenali. Gunakan foto JPG atau PNG.');
  const bita = keBita(m[2]);
  if (bita.length > BATAS_BYTE) throw new GalatPengguna(413, 'Ukuran foto terlalu besar.');
  const jenis = jenisGambar(bita);
  if (!jenis) throw new GalatPengguna(400, 'Berkas foto tidak dikenali. Gunakan foto JPG atau PNG.');
  const versi = Date.now().toString(36);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO foto_santri (santri_id, data, jenis, diubah, oleh) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(santri_id) DO UPDATE SET data = excluded.data, jenis = excluded.jenis, diubah = excluded.diubah, oleh = excluded.oleh`,
    ).run(santriId, untukDb(bita) as never, jenis, sekarang(), oleh);
    db.prepare('UPDATE santri SET foto_versi = ? WHERE id = ?').run(versi, santriId);
  })();
  return versi;
}

export function hapusFoto(db: DB, santriId: number) {
  db.transaction(() => {
    db.prepare('DELETE FROM foto_santri WHERE santri_id = ?').run(santriId);
    db.prepare('UPDATE santri SET foto_versi = NULL WHERE id = ?').run(santriId);
  })();
}

export function ambilFoto(db: DB, santriId: number) {
  return satu<{ data: Uint8Array; jenis: string }>(db, 'SELECT data, jenis FROM foto_santri WHERE santri_id = ?', santriId);
}
