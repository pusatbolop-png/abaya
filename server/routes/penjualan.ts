import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { sekarang } from '../db';
import type { Variabel } from '../auth';
import { KANAL_PENJUALAN, KONDISI_RETUR } from '../../shared/konstanta';
import { awalHariWib, akhirHariWib, tanggalWib, rupiah } from '../../shared/format';
import { periksa, wajib, teksOpsional, bilBulat, GalatPengguna, tidakDitemukan, catatAktivitas, nomorBaru, bacaJson } from '../util';
import { catatMutasi } from '../domain/stok';

function rentang(c: { req: { query: (k: string) => string | undefined } }) {
  const dari = c.req.query('dari') ?? tanggalWib(new Date(Date.now() - 29 * 86_400_000));
  const sampai = c.req.query('sampai') ?? tanggalWib();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dari) || !/^\d{4}-\d{2}-\d{2}$/.test(sampai)) throw new GalatPengguna(400, 'Format tanggal tidak dikenali.');
  return { dari, sampai, awal: awalHariWib(dari), akhir: akhirHariWib(sampai) };
}

const waktuOpsional = z
  .string()
  .optional()
  .nullable()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Waktu tidak valid.')
  .refine((v) => !v || Date.parse(v) <= Date.now() + 5 * 60_000, 'Waktu tidak boleh di masa depan.')
  .transform((v) => (v ? new Date(v).toISOString() : sekarang()));

export function rutePenjualan(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();

  app.get('/', (c) => {
    const { awal, akhir } = rentang(c);
    const sesiId = Number(c.req.query('sesi_id')) || null;
    const q = c.req.query('q')?.trim();
    const kondisi = ['j.tanggal >= ?', 'j.tanggal < ?'];
    const arg: unknown[] = [awal, akhir];
    if (sesiId) {
      kondisi.push('j.sesi_id = ?');
      arg.push(sesiId);
    }
    if (q) {
      kondisi.push('(j.nomor LIKE ? OR j.nomor_pesanan LIKE ? OR j.pembeli LIKE ?)');
      arg.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const daftar = db
      .prepare(
        `SELECT j.id, j.nomor, j.kanal, j.nomor_pesanan AS nomorPesanan, j.pembeli, j.tanggal, j.total, j.status, j.sesi_id AS sesiId, s.judul AS sesi,
           (SELECT SUM(jumlah) FROM item_penjualan i WHERE i.penjualan_id = j.id) AS jumlahItem,
           COALESCE((SELECT SUM(total) FROM retur r WHERE r.penjualan_id = j.id), 0) AS nilaiRetur
         FROM penjualan j LEFT JOIN sesi_live s ON s.id = j.sesi_id
         WHERE ${kondisi.join(' AND ')} ORDER BY j.tanggal DESC, j.id DESC`,
      )
      .all(...arg) as { total: number; status: string; nilaiRetur: number }[];
    const selesai = daftar.filter((d) => d.status === 'selesai');
    const ringkas = {
      jumlah: selesai.length,
      bruto: selesai.reduce((a, d) => a + d.total, 0),
      retur: selesai.reduce((a, d) => a + d.nilaiRetur, 0),
    };
    return c.json({ daftar, ringkas });
  });

  app.get('/:id', (c) => {
    const j = db
      .prepare(
        `SELECT j.id, j.nomor, j.kanal, j.nomor_pesanan AS nomorPesanan, j.pembeli, j.tanggal, j.total, j.status, j.alasan_batal AS alasanBatal,
           j.sesi_id AS sesiId, s.judul AS sesi, g.nama AS oleh
         FROM penjualan j LEFT JOIN sesi_live s ON s.id = j.sesi_id LEFT JOIN pengguna g ON g.id = j.dibuat_oleh WHERE j.id = ?`,
      )
      .get(Number(c.req.param('id'))) as { id: number } | undefined;
    if (!j) throw tidakDitemukan('Penjualan');
    const item = db
      .prepare(
        `SELECT i.id, i.produk_id AS produkId, p.nama AS produk, p.sku, u.nama_usaha AS namaUsaha, i.jumlah, i.harga, i.subtotal,
           COALESCE((SELECT SUM(ir.jumlah) FROM item_retur ir WHERE ir.item_penjualan_id = i.id), 0) AS diretur
         FROM item_penjualan i JOIN produk p ON p.id = i.produk_id JOIN umkm u ON u.id = i.umkm_id WHERE i.penjualan_id = ?`,
      )
      .all(j.id);
    const retur = db.prepare('SELECT id, nomor, tanggal, alasan, total FROM retur WHERE penjualan_id = ? ORDER BY tanggal').all(j.id);
    return c.json({ ...j, item, retur });
  });

  app.post('/', async (c) => {
    const d = periksa(
      z.object({
        kanal: z.enum(KANAL_PENJUALAN, { error: 'Pilih kanal penjualan.' }),
        sesi_id: z.coerce.number().int().positive().optional().nullable(),
        nomor_pesanan: teksOpsional,
        pembeli: teksOpsional,
        tanggal: waktuOpsional,
        item: z
          .array(
            z.object({
              produk_id: bilBulat('Produk', 1),
              jumlah: bilBulat('Jumlah', 1),
              harga: bilBulat('Harga', 0).optional(),
            }),
          )
          .min(1, 'Tambahkan minimal satu produk.')
          .max(100),
      }),
      await bacaJson(c),
    );
    if (d.sesi_id) {
      const s = db.prepare('SELECT status FROM sesi_live WHERE id = ?').get(d.sesi_id) as { status: string } | undefined;
      if (!s) throw tidakDitemukan('Sesi live');
      if (s.status === 'batal') throw new GalatPengguna(409, 'Sesi ini dibatalkan. Pilih sesi lain atau kosongkan pilihan sesi.');
    }
    const penggunaId = c.get('pengguna').id;
    const hasil = db.transaction(() => {
      const nomor = nomorBaru(db, 'PJ');
      const r = db
        .prepare(
          'INSERT INTO penjualan (nomor, sesi_id, kanal, nomor_pesanan, pembeli, tanggal, total, dibuat_oleh, dibuat) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
        )
        .run(nomor, d.sesi_id ?? null, d.kanal, d.nomor_pesanan, d.pembeli, d.tanggal, penggunaId, sekarang());
      const id = Number(r.lastInsertRowid);
      let total = 0;
      for (const it of d.item) {
        const p = db
          .prepare("SELECT p.id, p.nama, p.harga, p.umkm_id, p.aktif, u.status FROM produk p JOIN umkm u ON u.id = p.umkm_id WHERE p.id = ?")
          .get(it.produk_id) as { id: number; nama: string; harga: number; umkm_id: number; aktif: number; status: string } | undefined;
        if (!p) throw tidakDitemukan('Produk');
        if (!p.aktif || p.status !== 'diterima') throw new GalatPengguna(409, `${p.nama} sedang tidak dijual. Aktifkan produknya terlebih dahulu.`);
        const harga = it.harga ?? p.harga;
        const subtotal = harga * it.jumlah;
        total += subtotal;
        db.prepare('INSERT INTO item_penjualan (penjualan_id, produk_id, umkm_id, jumlah, harga, subtotal) VALUES (?, ?, ?, ?, ?, ?)').run(
          id,
          p.id,
          p.umkm_id,
          it.jumlah,
          harga,
          subtotal,
        );
        catatMutasi(db, { produkId: p.id, jenis: 'terjual', jumlah: -it.jumlah, refJenis: 'penjualan', refId: id, catatan: nomor, penggunaId });
      }
      db.prepare('UPDATE penjualan SET total = ? WHERE id = ?').run(total, id);
      catatAktivitas(db, penggunaId, 'jual', 'penjualan', id, `Penjualan ${nomor} sebesar ${rupiah(total)} dicatat`);
      return { id, nomor, total };
    })();
    return c.json(hasil, 201);
  });

  app.post('/:id/batal', async (c) => {
    const id = Number(c.req.param('id'));
    const j = db.prepare('SELECT nomor, status FROM penjualan WHERE id = ?').get(id) as { nomor: string; status: string } | undefined;
    if (!j) throw tidakDitemukan('Penjualan');
    if (j.status !== 'selesai') throw new GalatPengguna(409, 'Penjualan ini sudah dibatalkan sebelumnya.');
    if (db.prepare('SELECT 1 FROM retur WHERE penjualan_id = ?').get(id)) {
      throw new GalatPengguna(409, 'Penjualan ini sudah punya retur, jadi tidak bisa dibatalkan. Catat retur untuk sisa barangnya.');
    }
    const d = periksa(z.object({ alasan: wajib('Alasan pembatalan').max(300) }), await bacaJson(c));
    const penggunaId = c.get('pengguna').id;
    db.transaction(() => {
      const item = db.prepare('SELECT produk_id, jumlah FROM item_penjualan WHERE penjualan_id = ?').all(id) as { produk_id: number; jumlah: number }[];
      for (const it of item) {
        catatMutasi(db, { produkId: it.produk_id, jenis: 'batal_jual', jumlah: it.jumlah, refJenis: 'penjualan', refId: id, catatan: `Batal ${j.nomor}`, penggunaId });
      }
      db.prepare("UPDATE penjualan SET status = 'dibatalkan', alasan_batal = ? WHERE id = ?").run(d.alasan, id);
      catatAktivitas(db, penggunaId, 'batal', 'penjualan', id, `Penjualan ${j.nomor} dibatalkan`);
    })();
    return c.json({ ok: true });
  });

  return app;
}

export function ruteRetur(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();

  app.get('/', (c) => {
    const { awal, akhir } = rentang(c);
    const daftar = db
      .prepare(
        `SELECT r.id, r.nomor, r.tanggal, r.alasan, r.total, r.penjualan_id AS penjualanId, j.nomor AS nomorPenjualan, j.kanal,
           (SELECT SUM(jumlah) FROM item_retur ir WHERE ir.retur_id = r.id) AS jumlahItem,
           (SELECT SUM(jumlah) FROM item_retur ir WHERE ir.retur_id = r.id AND ir.kondisi = 'rusak') AS jumlahRusak
         FROM retur r JOIN penjualan j ON j.id = r.penjualan_id WHERE r.tanggal >= ? AND r.tanggal < ? ORDER BY r.tanggal DESC`,
      )
      .all(awal, akhir);
    return c.json({ daftar });
  });

  app.post('/', async (c) => {
    const d = periksa(
      z.object({
        penjualan_id: bilBulat('Penjualan', 1),
        alasan: wajib('Alasan retur').max(300),
        tanggal: waktuOpsional,
        item: z
          .array(
            z.object({
              item_penjualan_id: bilBulat('Barang', 1),
              jumlah: bilBulat('Jumlah', 1),
              kondisi: z.enum(Object.keys(KONDISI_RETUR) as [keyof typeof KONDISI_RETUR], { error: 'Pilih kondisi barang.' }),
            }),
          )
          .min(1, 'Pilih minimal satu barang yang diretur.'),
      }),
      await bacaJson(c),
    );
    const j = db.prepare('SELECT nomor, status, tanggal FROM penjualan WHERE id = ?').get(d.penjualan_id) as
      | { nomor: string; status: string; tanggal: string }
      | undefined;
    if (!j) throw tidakDitemukan('Penjualan');
    if (j.status !== 'selesai') throw new GalatPengguna(409, 'Penjualan ini sudah dibatalkan, jadi tidak perlu retur.');
    if (d.tanggal < j.tanggal) throw new GalatPengguna(400, 'Tanggal retur tidak boleh sebelum tanggal penjualan.', { tanggal: 'Sebelum tanggal penjualan.' });
    const penggunaId = c.get('pengguna').id;
    const hasil = db.transaction(() => {
      const nomor = nomorBaru(db, 'RT');
      const r = db
        .prepare('INSERT INTO retur (nomor, penjualan_id, tanggal, alasan, total, dibuat_oleh, dibuat) VALUES (?, ?, ?, ?, 0, ?, ?)')
        .run(nomor, d.penjualan_id, d.tanggal, d.alasan, penggunaId, sekarang());
      const id = Number(r.lastInsertRowid);
      let total = 0;
      for (const it of d.item) {
        const ip = db
          .prepare(
            `SELECT i.id, i.produk_id, i.umkm_id, i.jumlah, i.harga, p.nama,
               COALESCE((SELECT SUM(jumlah) FROM item_retur ir WHERE ir.item_penjualan_id = i.id), 0) AS diretur
             FROM item_penjualan i JOIN produk p ON p.id = i.produk_id WHERE i.id = ? AND i.penjualan_id = ?`,
          )
          .get(it.item_penjualan_id, d.penjualan_id) as
          | { id: number; produk_id: number; umkm_id: number; jumlah: number; harga: number; nama: string; diretur: number }
          | undefined;
        if (!ip) throw tidakDitemukan('Barang pada penjualan');
        const sisa = ip.jumlah - ip.diretur;
        if (it.jumlah > sisa) {
          throw new GalatPengguna(409, `${ip.nama} hanya bisa diretur ${sisa} lagi dari ${ip.jumlah} yang terjual. Kurangi jumlahnya.`);
        }
        const nilai = ip.harga * it.jumlah;
        total += nilai;
        db.prepare('INSERT INTO item_retur (retur_id, item_penjualan_id, umkm_id, jumlah, kondisi, nilai) VALUES (?, ?, ?, ?, ?, ?)').run(
          id,
          ip.id,
          ip.umkm_id,
          it.jumlah,
          it.kondisi,
          nilai,
        );
        // Barang layak jual kembali ke stok; barang rusak dicatat di retur untuk dikembalikan ke UMKM.
        if (it.kondisi === 'layak_jual') {
          catatMutasi(db, { produkId: ip.produk_id, jenis: 'retur_pembeli', jumlah: it.jumlah, refJenis: 'retur', refId: id, catatan: nomor, penggunaId });
        }
      }
      db.prepare('UPDATE retur SET total = ? WHERE id = ?').run(total, id);
      catatAktivitas(db, penggunaId, 'retur', 'retur', id, `Retur ${nomor} untuk ${j.nomor} sebesar ${rupiah(total)}`);
      return { id, nomor, total };
    })();
    return c.json(hasil, 201);
  });

  return app;
}

export { rentang };
