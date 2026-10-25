import { Hono } from 'hono';
import ExcelJS from 'exceljs';
import type { DB } from '../db';
import type { Variabel } from '../auth';
import { JENIS_MUTASI, KONDISI_RETUR, STATUS_PENCAIRAN, STATUS_SESI, STATUS_UMKM, type JenisMutasi, type KondisiRetur, type StatusPencairan, type StatusSesi, type StatusUmkm } from '../../shared/konstanta';
import { tanggal, tanggalJam, tampilWa } from '../../shared/format';
import { ambilPengaturan, GalatPengguna } from '../util';
import { rentang } from './penjualan';
import { daftarPosisi } from './dana';

type Kolom = { judul: string; kunci: string; lebar?: number; jenis?: 'uang' | 'angka' | 'teks' };
type Lembar = { nama: string; kolom: Kolom[]; baris: Record<string, unknown>[] };

const JENIS_EKSPOR = ['penjualan', 'retur', 'stok', 'mutasi', 'dana', 'umkm', 'live'] as const;
type JenisEkspor = (typeof JENIS_EKSPOR)[number];

export const JUDUL_EKSPOR: Record<JenisEkspor, string> = {
  penjualan: 'Penjualan per barang',
  retur: 'Retur pembeli',
  stok: 'Posisi stok',
  mutasi: 'Riwayat mutasi stok',
  dana: 'Posisi dana dan pencairan UMKM',
  umkm: 'Daftar UMKM',
  live: 'Sesi live',
};

function susun(db: DB, jenis: JenisEkspor, awal: string, akhir: string): Lembar[] {
  switch (jenis) {
    case 'penjualan':
      return [
        {
          nama: 'Penjualan',
          kolom: [
            { judul: 'Nomor', kunci: 'nomor', lebar: 20 },
            { judul: 'Waktu (WIB)', kunci: 'waktu', lebar: 18 },
            { judul: 'Kanal', kunci: 'kanal', lebar: 22 },
            { judul: 'Sesi live', kunci: 'sesi', lebar: 28 },
            { judul: 'No. pesanan', kunci: 'nomor_pesanan', lebar: 18 },
            { judul: 'UMKM', kunci: 'umkm', lebar: 26 },
            { judul: 'Produk', kunci: 'produk', lebar: 30 },
            { judul: 'SKU', kunci: 'sku', lebar: 14 },
            { judul: 'Jumlah', kunci: 'jumlah', jenis: 'angka', lebar: 9 },
            { judul: 'Harga', kunci: 'harga', jenis: 'uang', lebar: 14 },
            { judul: 'Subtotal', kunci: 'subtotal', jenis: 'uang', lebar: 15 },
            { judul: 'Diretur', kunci: 'diretur', jenis: 'angka', lebar: 9 },
          ],
          baris: (
            db
              .prepare(
                `SELECT j.nomor, j.tanggal, j.kanal, s.judul AS sesi, j.nomor_pesanan, u.nama_usaha AS umkm, p.nama AS produk, p.sku,
                   i.jumlah, i.harga, i.subtotal, COALESCE((SELECT SUM(jumlah) FROM item_retur ir WHERE ir.item_penjualan_id = i.id), 0) AS diretur
                 FROM item_penjualan i JOIN penjualan j ON j.id = i.penjualan_id JOIN produk p ON p.id = i.produk_id JOIN umkm u ON u.id = i.umkm_id
                 LEFT JOIN sesi_live s ON s.id = j.sesi_id
                 WHERE j.status = 'selesai' AND j.tanggal >= ? AND j.tanggal < ? ORDER BY j.tanggal, j.nomor`,
              )
              .all(awal, akhir) as Record<string, unknown>[]
          ).map((r) => ({ ...r, waktu: tanggalJam(r.tanggal as string) })),
        },
      ];
    case 'retur':
      return [
        {
          nama: 'Retur',
          kolom: [
            { judul: 'Nomor retur', kunci: 'nomor', lebar: 20 },
            { judul: 'Waktu (WIB)', kunci: 'waktu', lebar: 18 },
            { judul: 'Penjualan', kunci: 'penjualan', lebar: 20 },
            { judul: 'UMKM', kunci: 'umkm', lebar: 26 },
            { judul: 'Produk', kunci: 'produk', lebar: 30 },
            { judul: 'Jumlah', kunci: 'jumlah', jenis: 'angka', lebar: 9 },
            { judul: 'Kondisi', kunci: 'kondisi', lebar: 30 },
            { judul: 'Nilai', kunci: 'nilai', jenis: 'uang', lebar: 15 },
            { judul: 'Alasan', kunci: 'alasan', lebar: 40 },
          ],
          baris: (
            db
              .prepare(
                `SELECT r.nomor, r.tanggal, j.nomor AS penjualan, u.nama_usaha AS umkm, p.nama AS produk, ir.jumlah, ir.kondisi, ir.nilai, r.alasan
                 FROM item_retur ir JOIN retur r ON r.id = ir.retur_id JOIN penjualan j ON j.id = r.penjualan_id
                 JOIN item_penjualan i ON i.id = ir.item_penjualan_id JOIN produk p ON p.id = i.produk_id JOIN umkm u ON u.id = ir.umkm_id
                 WHERE r.tanggal >= ? AND r.tanggal < ? ORDER BY r.tanggal`,
              )
              .all(awal, akhir) as Record<string, unknown>[]
          ).map((r) => ({ ...r, waktu: tanggalJam(r.tanggal as string), kondisi: KONDISI_RETUR[r.kondisi as KondisiRetur] })),
        },
      ];
    case 'stok':
      return [
        {
          nama: 'Stok',
          kolom: [
            { judul: 'UMKM', kunci: 'umkm', lebar: 26 },
            { judul: 'Produk', kunci: 'nama', lebar: 30 },
            { judul: 'SKU', kunci: 'sku', lebar: 14 },
            { judul: 'Satuan', kunci: 'satuan', lebar: 9 },
            { judul: 'Stok', kunci: 'stok', jenis: 'angka', lebar: 9 },
            { judul: 'Harga', kunci: 'harga', jenis: 'uang', lebar: 14 },
            { judul: 'Nilai stok', kunci: 'nilai', jenis: 'uang', lebar: 16 },
          ],
          baris: (
            db
              .prepare(
                `SELECT u.nama_usaha AS umkm, p.nama, p.sku, p.satuan, p.harga,
                   COALESCE((SELECT SUM(jumlah) FROM mutasi_stok m WHERE m.produk_id = p.id), 0) AS stok
                 FROM produk p JOIN umkm u ON u.id = p.umkm_id WHERE p.aktif = 1 ORDER BY u.nama_usaha, p.nama`,
              )
              .all() as { stok: number; harga: number }[]
          ).map((r) => ({ ...r, nilai: r.stok * r.harga })),
        },
      ];
    case 'mutasi':
      return [
        {
          nama: 'Mutasi stok',
          kolom: [
            { judul: 'Waktu (WIB)', kunci: 'waktu', lebar: 18 },
            { judul: 'UMKM', kunci: 'umkm', lebar: 26 },
            { judul: 'Produk', kunci: 'produk', lebar: 30 },
            { judul: 'SKU', kunci: 'sku', lebar: 14 },
            { judul: 'Jenis', kunci: 'jenis', lebar: 28 },
            { judul: 'Jumlah', kunci: 'jumlah', jenis: 'angka', lebar: 9 },
            { judul: 'Catatan', kunci: 'catatan', lebar: 32 },
            { judul: 'Petugas', kunci: 'oleh', lebar: 20 },
          ],
          baris: (
            db
              .prepare(
                `SELECT m.dibuat, u.nama_usaha AS umkm, p.nama AS produk, p.sku, m.jenis, m.jumlah, m.catatan, g.nama AS oleh
                 FROM mutasi_stok m JOIN produk p ON p.id = m.produk_id JOIN umkm u ON u.id = p.umkm_id LEFT JOIN pengguna g ON g.id = m.pengguna_id
                 WHERE m.dibuat >= ? AND m.dibuat < ? ORDER BY m.dibuat`,
              )
              .all(awal, akhir) as Record<string, unknown>[]
          ).map((r) => ({ ...r, waktu: tanggalJam(r.dibuat as string), jenis: JENIS_MUTASI[r.jenis as JenisMutasi] })),
        },
      ];
    case 'dana': {
      const { daftar } = daftarPosisi(db);
      return [
        {
          nama: 'Posisi dana',
          kolom: [
            { judul: 'UMKM', kunci: 'namaUsaha', lebar: 26 },
            { judul: 'Bank', kunci: 'bank', lebar: 14 },
            { judul: 'No. rekening', kunci: 'noRekening', lebar: 18 },
            { judul: 'Atas nama', kunci: 'atasNama', lebar: 22 },
            { judul: 'Penjualan belum dicairkan', kunci: 'bruto', jenis: 'uang', lebar: 18 },
            { judul: 'Retur', kunci: 'retur', jenis: 'uang', lebar: 14 },
            { judul: 'Siap dicairkan', kunci: 'siapCair', jenis: 'uang', lebar: 16 },
            { judul: 'Menunggu transfer', kunci: 'menungguTransfer', jenis: 'uang', lebar: 16 },
            { judul: 'Sudah ditransfer', kunci: 'sudahDibayar', jenis: 'uang', lebar: 16 },
          ],
          baris: daftar as unknown as Record<string, unknown>[],
        },
        {
          nama: 'Pencairan',
          kolom: [
            { judul: 'Nomor', kunci: 'nomor', lebar: 20 },
            { judul: 'Dibuat (WIB)', kunci: 'waktu', lebar: 18 },
            { judul: 'UMKM', kunci: 'umkm', lebar: 26 },
            { judul: 'Penjualan sampai', kunci: 'sampaiTampil', lebar: 18 },
            { judul: 'Penjualan', kunci: 'bruto', jenis: 'uang', lebar: 15 },
            { judul: 'Retur', kunci: 'retur', jenis: 'uang', lebar: 14 },
            { judul: 'Dicairkan', kunci: 'jumlah', jenis: 'uang', lebar: 15 },
            { judul: 'Status', kunci: 'statusTampil', lebar: 18 },
            { judul: 'Referensi transfer', kunci: 'referensi_transfer', lebar: 22 },
            { judul: 'Ditransfer (WIB)', kunci: 'dibayarTampil', lebar: 18 },
          ],
          baris: (
            db
              .prepare(
                `SELECT c.*, u.nama_usaha AS umkm FROM pencairan c JOIN umkm u ON u.id = c.umkm_id
                 WHERE c.dibuat >= ? AND c.dibuat < ? ORDER BY c.dibuat`,
              )
              .all(awal, akhir) as Record<string, unknown>[]
          ).map((r) => ({
            ...r,
            waktu: tanggalJam(r.dibuat as string),
            sampaiTampil: tanggal(`${r.sampai}T05:00:00Z`),
            statusTampil: STATUS_PENCAIRAN[r.status as StatusPencairan],
            dibayarTampil: r.dibayar ? tanggalJam(r.dibayar as string) : '',
          })),
        },
      ];
    }
    case 'umkm':
      return [
        {
          nama: 'UMKM',
          kolom: [
            { judul: 'Kode', kunci: 'kode', lebar: 16 },
            { judul: 'Nama usaha', kunci: 'nama_usaha', lebar: 28 },
            { judul: 'Pemilik', kunci: 'pemilik', lebar: 22 },
            { judul: 'WhatsApp', kunci: 'wa', lebar: 16 },
            { judul: 'Kategori', kunci: 'kategori', lebar: 18 },
            { judul: 'Kecamatan', kunci: 'kecamatan', lebar: 16 },
            { judul: 'Status', kunci: 'statusTampil', lebar: 18 },
            { judul: 'Terdaftar', kunci: 'terdaftar', lebar: 18 },
            { judul: 'Produk aktif', kunci: 'produk', jenis: 'angka', lebar: 12 },
          ],
          baris: (
            db
              .prepare(
                `SELECT u.*, (SELECT COUNT(*) FROM produk p WHERE p.umkm_id = u.id AND p.aktif = 1) AS produk FROM umkm u
                 ORDER BY u.kode`,
              )
              .all() as Record<string, unknown>[]
          ).map((r) => ({
            ...r,
            wa: tampilWa(r.whatsapp as string),
            statusTampil: STATUS_UMKM[r.status as StatusUmkm],
            terdaftar: tanggal(r.dibuat as string),
          })),
        },
      ];
    case 'live':
      return [
        {
          nama: 'Sesi live',
          kolom: [
            { judul: 'Jadwal (WIB)', kunci: 'jadwal', lebar: 18 },
            { judul: 'Judul', kunci: 'judul', lebar: 30 },
            { judul: 'Studio', kunci: 'ruangan', lebar: 16 },
            { judul: 'Platform', kunci: 'platform', lebar: 16 },
            { judul: 'Host', kunci: 'host', lebar: 18 },
            { judul: 'Status', kunci: 'statusTampil', lebar: 16 },
            { judul: 'Pesanan', kunci: 'pesanan', jenis: 'angka', lebar: 10 },
            { judul: 'Omzet', kunci: 'omzet', jenis: 'uang', lebar: 16 },
          ],
          baris: (
            db
              .prepare(
                `SELECT s.*, r.nama AS ruangan,
                   (SELECT COUNT(*) FROM penjualan j WHERE j.sesi_id = s.id AND j.status = 'selesai') AS pesanan,
                   COALESCE((SELECT SUM(total) FROM penjualan j WHERE j.sesi_id = s.id AND j.status = 'selesai'), 0) AS omzet
                 FROM sesi_live s JOIN ruangan r ON r.id = s.ruangan_id WHERE s.jadwal_mulai >= ? AND s.jadwal_mulai < ? ORDER BY s.jadwal_mulai`,
              )
              .all(awal, akhir) as Record<string, unknown>[]
          ).map((r) => ({ ...r, jadwal: tanggalJam(r.jadwal_mulai as string), statusTampil: STATUS_SESI[r.status as StatusSesi] })),
        },
      ];
  }
}

const sel = (v: unknown) => (v === null || v === undefined ? '' : v);

function keCsv(l: Lembar): string {
  const esc = (v: unknown) => {
    const s = String(sel(v));
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Titik koma sebagai pemisah agar langsung terbaca Excel berlokal Indonesia.
  const kepala = l.kolom.map((k) => esc(k.judul)).join(';');
  const isi = l.baris.map((b) => l.kolom.map((k) => esc(b[k.kunci])).join(';'));
  return '﻿' + [kepala, ...isi].join('\r\n');
}

async function keXlsx(lembar: Lembar[], judul: string, periode: string | null, organisasi: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = organisasi;
  wb.created = new Date();
  for (const l of lembar) {
    const ws = wb.addWorksheet(l.nama, { views: [{ state: 'frozen', ySplit: 4 }] });
    ws.columns = l.kolom.map((k) => ({ key: k.kunci, width: k.lebar ?? 16 }));
    ws.getCell('A1').value = `${organisasi} — ${l.nama === lembar[0].nama ? judul : l.nama}`;
    ws.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FF1D221F' } };
    ws.getCell('A2').value = periode ? `Periode ${periode}` : `Per ${tanggalJam(new Date().toISOString())} WIB`;
    ws.getCell('A2').font = { size: 10, color: { argb: 'FF5F625A' } };
    const kepala = ws.getRow(4);
    l.kolom.forEach((k, i) => {
      const c = kepala.getCell(i + 1);
      c.value = k.judul;
      c.font = { bold: true, color: { argb: 'FF1D221F' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE8DD' } };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFB9B09F' } } };
      c.alignment = { vertical: 'middle', horizontal: k.jenis ? 'right' : 'left', wrapText: true };
    });
    kepala.height = 22;
    for (const b of l.baris) {
      const r = ws.addRow(Object.fromEntries(l.kolom.map((k) => [k.kunci, sel(b[k.kunci])])));
      l.kolom.forEach((k, i) => {
        if (k.jenis === 'uang') r.getCell(i + 1).numFmt = '"Rp" #,##0;[Red]-"Rp" #,##0';
        if (k.jenis === 'angka') r.getCell(i + 1).numFmt = '#,##0';
      });
    }
    // Baris jumlah untuk kolom uang dan angka.
    if (l.baris.length) {
      const awal = 5;
      const akhir = 4 + l.baris.length;
      const total = ws.addRow({});
      total.getCell(1).value = 'Jumlah';
      total.font = { bold: true };
      l.kolom.forEach((k, i) => {
        if (!k.jenis || k.jenis === 'teks') return;
        const huruf = ws.getColumn(i + 1).letter;
        const c = total.getCell(i + 1);
        c.value = { formula: `SUM(${huruf}${awal}:${huruf}${akhir})` };
        c.numFmt = k.jenis === 'uang' ? '"Rp" #,##0;[Red]-"Rp" #,##0' : '#,##0';
      });
      total.eachCell((c) => (c.border = { top: { style: 'thin', color: { argb: 'FFB9B09F' } } }));
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function ruteEkspor(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();

  app.get('/:jenis', async (c) => {
    const jenis = c.req.param('jenis') as JenisEkspor;
    if (!JENIS_EKSPOR.includes(jenis)) throw new GalatPengguna(404, 'Jenis laporan tidak dikenal. Pilih salah satu laporan yang tersedia.');
    const format = c.req.query('format') === 'csv' ? 'csv' : 'xlsx';
    const { dari, sampai, awal, akhir } = rentang(c);
    if (dari > sampai) throw new GalatPengguna(400, 'Tanggal awal harus sebelum tanggal akhir.');
    const lembar = susun(db, jenis, awal, akhir);
    const berperiode = !['stok', 'umkm'].includes(jenis);
    const periode = berperiode ? `${tanggal(`${dari}T05:00:00Z`)} – ${tanggal(`${sampai}T05:00:00Z`)}` : null;
    const namaBerkas = `pcc-${jenis}${berperiode ? `-${dari}_${sampai}` : ''}`;
    const org = ambilPengaturan(db).organisasi.nama;
    if (format === 'csv') {
      return c.body(keCsv(lembar[0]), 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${namaBerkas}.csv"`,
      });
    }
    const buf = await keXlsx(lembar, JUDUL_EKSPOR[jenis], periode, org);
    return c.body(new Uint8Array(buf), 200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${namaBerkas}.xlsx"`,
    });
  });

  return app;
}
