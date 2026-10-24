import type { DB } from '../db';
import { sekarang } from '../db';
import type { JenisMutasi } from '../../shared/konstanta';
import { GalatPengguna } from '../util';

export function stokProduk(db: DB, produkId: number): number {
  const r = db.prepare('SELECT COALESCE(SUM(jumlah), 0) AS s FROM mutasi_stok WHERE produk_id = ?').get(produkId) as { s: number };
  return r.s;
}

export interface Mutasi {
  produkId: number;
  jenis: JenisMutasi;
  /** Bertanda: positif menambah stok, negatif mengurangi. */
  jumlah: number;
  refJenis?: string;
  refId?: number;
  catatan?: string | null;
  penggunaId: number | null;
  waktu?: string;
}

/** Catat mutasi; menolak bila stok akan menjadi minus. Panggil di dalam transaksi. */
export function catatMutasi(db: DB, m: Mutasi) {
  if (m.jumlah === 0) return;
  if (m.jumlah < 0) {
    const ada = stokProduk(db, m.produkId);
    if (ada + m.jumlah < 0) {
      const p = db.prepare('SELECT nama FROM produk WHERE id = ?').get(m.produkId) as { nama: string } | undefined;
      throw new GalatPengguna(
        409,
        `Stok ${p?.nama ?? 'produk'} tinggal ${ada}, tidak cukup untuk ${-m.jumlah}. Kurangi jumlahnya atau catat barang masuk terlebih dahulu.`,
      );
    }
  }
  db.prepare(
    'INSERT INTO mutasi_stok (produk_id, jenis, jumlah, ref_jenis, ref_id, catatan, pengguna_id, dibuat) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(m.produkId, m.jenis, m.jumlah, m.refJenis ?? null, m.refId ?? null, m.catatan ?? null, m.penggunaId, m.waktu ?? sekarang());
}
