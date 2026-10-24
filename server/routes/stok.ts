import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { sekarang } from '../db';
import type { Variabel } from '../auth';
import { MUTASI_MANUAL, JENIS_MUTASI, type JenisMutasi } from '../../shared/konstanta';
import { periksa, wajib, teksOpsional, bilBulat, GalatPengguna, tidakDitemukan, catatAktivitas, bacaJson } from '../util';
import { catatMutasi } from '../domain/stok';
import { ambilUmkm } from './umkm';

const SQL_STOK = 'COALESCE((SELECT SUM(m.jumlah) FROM mutasi_stok m WHERE m.produk_id = p.id), 0)';

function skuBaru(db: DB, umkmId: number): string {
  const u = db.prepare('SELECT kode FROM umkm WHERE id = ?').get(umkmId) as { kode: string };
  const n = (db.prepare('SELECT COUNT(*) AS n FROM produk WHERE umkm_id = ?').get(umkmId) as { n: number }).n + 1;
  // UMKM-26-0012 → 2600120-03
  const dasar = u.kode.replace(/\D/g, '');
  let sku = `${dasar}-${String(n).padStart(2, '0')}`;
  while (db.prepare('SELECT 1 FROM produk WHERE sku = ?').get(sku)) sku += 'A';
  return sku;
}

export function ruteProduk(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();

  app.get('/', (c) => {
    const umkmId = Number(c.req.query('umkm_id')) || null;
    const q = c.req.query('q')?.trim();
    const kondisi = ["u.status = 'diterima'"];
    const arg: unknown[] = [];
    if (umkmId) {
      kondisi.push('p.umkm_id = ?');
      arg.push(umkmId);
    }
    if (c.req.query('aktif') !== 'semua') kondisi.push('p.aktif = 1');
    if (q) {
      kondisi.push('(p.nama LIKE ? OR p.sku LIKE ? OR u.nama_usaha LIKE ?)');
      arg.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const daftar = db
      .prepare(
        `SELECT p.id, p.nama, p.sku, p.harga, p.satuan, p.aktif, p.umkm_id AS umkmId, u.nama_usaha AS namaUsaha, ${SQL_STOK} AS stok
         FROM produk p JOIN umkm u ON u.id = p.umkm_id WHERE ${kondisi.join(' AND ')} ORDER BY u.nama_usaha, p.nama`,
      )
      .all(...arg);
    return c.json({ daftar });
  });

  app.post('/', async (c) => {
    const d = periksa(
      z.object({
        umkm_id: bilBulat('UMKM', 1),
        nama: wajib('Nama produk').max(120),
        harga: bilBulat('Harga', 0),
        satuan: z.string().trim().max(20).optional().transform((v) => v || 'pcs'),
        stok_awal: bilBulat('Stok awal', 0).optional().default(0),
      }),
      await bacaJson(c),
    );
    const u = ambilUmkm(db, d.umkm_id);
    if (u.status !== 'diterima') {
      throw new GalatPengguna(409, `${u.nama_usaha} belum diterima dalam seleksi. Selesaikan seleksi terlebih dahulu sebelum menambah produk.`);
    }
    const penggunaId = c.get('pengguna').id;
    const id = db.transaction(() => {
      const r = db
        .prepare('INSERT INTO produk (umkm_id, nama, sku, harga, satuan, dibuat) VALUES (?, ?, ?, ?, ?, ?)')
        .run(u.id, d.nama, skuBaru(db, u.id), d.harga, d.satuan, sekarang());
      const id = Number(r.lastInsertRowid);
      if (d.stok_awal > 0) catatMutasi(db, { produkId: id, jenis: 'masuk', jumlah: d.stok_awal, catatan: 'Stok awal', penggunaId });
      catatAktivitas(db, penggunaId, 'tambah', 'produk', id, `Produk ${d.nama} dari ${u.nama_usaha} ditambahkan`);
      return id;
    })();
    return c.json({ id }, 201);
  });

  app.patch('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!db.prepare('SELECT 1 FROM produk WHERE id = ?').get(id)) throw tidakDitemukan('Produk');
    const d = periksa(
      z.object({
        nama: wajib('Nama produk').max(120),
        harga: bilBulat('Harga', 0),
        satuan: z.string().trim().max(20).optional().transform((v) => v || 'pcs'),
        aktif: z.boolean(),
      }),
      await bacaJson(c),
    );
    db.prepare('UPDATE produk SET nama = ?, harga = ?, satuan = ?, aktif = ? WHERE id = ?').run(d.nama, d.harga, d.satuan, d.aktif ? 1 : 0, id);
    catatAktivitas(db, c.get('pengguna').id, 'ubah', 'produk', id, `Produk ${d.nama} diperbarui`);
    return c.json({ ok: true });
  });

  return app;
}

export function ruteStok(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();

  app.get('/', (c) => {
    const daftar = db
      .prepare(
        `SELECT p.id, p.nama, p.sku, p.harga, p.satuan, p.umkm_id AS umkmId, u.nama_usaha AS namaUsaha, ${SQL_STOK} AS stok,
           (SELECT MAX(m.dibuat) FROM mutasi_stok m WHERE m.produk_id = p.id) AS mutasiTerakhir
         FROM produk p JOIN umkm u ON u.id = p.umkm_id WHERE p.aktif = 1 AND u.status = 'diterima'
         ORDER BY u.nama_usaha, p.nama`,
      )
      .all() as { stok: number; harga: number }[];
    const total = daftar.reduce((a, p) => ({ unit: a.unit + p.stok, nilai: a.nilai + p.stok * p.harga }), { unit: 0, nilai: 0 });
    return c.json({ daftar, total });
  });

  app.get('/mutasi', (c) => {
    const produkId = Number(c.req.query('produk_id')) || null;
    const daftar = db
      .prepare(
        `SELECT m.id, m.jenis, m.jumlah, m.catatan, m.dibuat, m.ref_jenis AS refJenis, m.ref_id AS refId, p.nama AS produk, p.sku,
           u.nama_usaha AS namaUsaha, g.nama AS oleh
         FROM mutasi_stok m JOIN produk p ON p.id = m.produk_id JOIN umkm u ON u.id = p.umkm_id
         LEFT JOIN pengguna g ON g.id = m.pengguna_id
         ${produkId ? 'WHERE m.produk_id = ?' : ''} ORDER BY m.dibuat DESC, m.id DESC LIMIT 200`,
      )
      .all(...(produkId ? [produkId] : []));
    return c.json({ daftar });
  });

  app.post('/mutasi', async (c) => {
    const d = periksa(
      z
        .object({
          produk_id: bilBulat('Produk', 1),
          jenis: z.enum(MUTASI_MANUAL, { error: 'Pilih jenis catatan stok.' }),
          jumlah: z.coerce.number({ error: 'Jumlah harus berupa angka.' }).int('Jumlah harus bilangan bulat.'),
          catatan: teksOpsional,
        })
        .refine((v) => v.jumlah !== 0, { message: 'Jumlah tidak boleh nol.', path: ['jumlah'] })
        .refine((v) => v.jenis === 'penyesuaian' || v.jumlah > 0, { message: 'Isi jumlah dengan angka positif.', path: ['jumlah'] })
        .refine((v) => v.jenis !== 'penyesuaian' || !!v.catatan, { message: 'Tuliskan alasan penyesuaian, misalnya hasil hitung fisik.', path: ['catatan'] }),
      await bacaJson(c),
    );
    const p = db.prepare('SELECT p.nama, u.status FROM produk p JOIN umkm u ON u.id = p.umkm_id WHERE p.id = ?').get(d.produk_id) as
      | { nama: string; status: string }
      | undefined;
    if (!p) throw tidakDitemukan('Produk');
    const tanda = d.jenis === 'masuk' || d.jenis === 'penyesuaian' ? 1 : -1;
    const jumlah = tanda * d.jumlah;
    const penggunaId = c.get('pengguna').id;
    db.transaction(() => {
      catatMutasi(db, { produkId: d.produk_id, jenis: d.jenis as JenisMutasi, jumlah, catatan: d.catatan, penggunaId });
      catatAktivitas(db, penggunaId, 'stok', 'produk', d.produk_id, `${JENIS_MUTASI[d.jenis as JenisMutasi]}: ${p.nama} ${jumlah > 0 ? '+' : ''}${jumlah}`);
    })();
    return c.json({ ok: true }, 201);
  });

  return app;
}
