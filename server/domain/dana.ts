import type { DB } from '../db';

export interface PosisiDana {
  umkmId: number;
  /** Penjualan kotor yang belum tercakup pencairan. */
  bruto: number;
  /** Nilai retur yang belum tercakup pencairan. */
  retur: number;
  /** Jumlah yang bisa dicairkan sekarang: bruto − retur. Program ini tanpa potongan jasa. */
  siapCair: number;
  sudahDibayar: number;
  menungguTransfer: number;
}

/**
 * Posisi dana UMKM sampai batas waktu tertentu (eksklusif).
 * Pencairan menyimpan bruto dan returnya sendiri; penjualan yang dibatalkan setelah dicairkan
 * otomatis mengurangi pencairan berikutnya.
 */
export function posisiDana(db: DB, umkmId: number, sampaiIso?: string): PosisiDana {
  const batas = sampaiIso ?? '9999-12-31T00:00:00.000Z';
  const bruto = (
    db
      .prepare(
        `SELECT COALESCE(SUM(i.subtotal), 0) AS v FROM item_penjualan i JOIN penjualan p ON p.id = i.penjualan_id
         WHERE i.umkm_id = ? AND p.status = 'selesai' AND p.tanggal < ?`,
      )
      .get(umkmId, batas) as { v: number }
  ).v;
  const retur = (
    db
      .prepare(
        `SELECT COALESCE(SUM(ir.nilai), 0) AS v FROM item_retur ir JOIN retur r ON r.id = ir.retur_id
         JOIN penjualan p ON p.id = r.penjualan_id
         WHERE ir.umkm_id = ? AND p.status = 'selesai' AND r.tanggal < ?`,
      )
      .get(umkmId, batas) as { v: number }
  ).v;
  const cair = db
    .prepare(
      `SELECT COALESCE(SUM(bruto), 0) AS bruto, COALESCE(SUM(retur), 0) AS retur,
              COALESCE(SUM(CASE WHEN status = 'dibayar' THEN jumlah END), 0) AS dibayar,
              COALESCE(SUM(CASE WHEN status = 'disiapkan' THEN jumlah END), 0) AS menunggu
       FROM pencairan WHERE umkm_id = ? AND status != 'batal'`,
    )
    .get(umkmId) as { bruto: number; retur: number; dibayar: number; menunggu: number };

  const b = bruto - cair.bruto;
  const r = retur - cair.retur;
  return {
    umkmId,
    bruto: b,
    retur: r,
    siapCair: b - r,
    sudahDibayar: cair.dibayar,
    menungguTransfer: cair.menunggu,
  };
}
