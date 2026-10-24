import type { DB } from '../db';
import { akhirHariWib } from '../../shared/format';

export interface PosisiDana {
  umkmId: number;
  /** Penjualan kotor yang belum tercakup pencairan. */
  bruto: number;
  /** Nilai retur yang belum tercakup pencairan. */
  retur: number;
  /** bruto − retur */
  neto: number;
  potongan: number;
  /** Jumlah yang bisa dicairkan sekarang. */
  siapCair: number;
  sudahDibayar: number;
  menungguTransfer: number;
}

export function hitungPotongan(neto: number, persen: number): number {
  if (neto <= 0 || persen <= 0) return 0;
  return Math.round((neto * persen) / 100);
}

/**
 * Posisi dana UMKM sampai batas waktu tertentu (eksklusif).
 * Pencairan menyimpan bruto dan returnya sendiri, sehingga perubahan persentase potongan
 * tidak mengubah pencairan yang sudah dibuat. Penjualan yang dibatalkan setelah dicairkan
 * otomatis mengurangi pencairan berikutnya.
 */
export function posisiDana(db: DB, umkmId: number, persen: number, sampaiIso?: string): PosisiDana {
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
  const neto = b - r;
  const potongan = hitungPotongan(neto, persen);
  return {
    umkmId,
    bruto: b,
    retur: r,
    neto,
    potongan,
    siapCair: neto - potongan,
    sudahDibayar: cair.dibayar,
    menungguTransfer: cair.menunggu,
  };
}

export function batasAkhirHari(ymd: string): string {
  return akhirHariWib(ymd);
}
