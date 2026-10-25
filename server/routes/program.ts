import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { sekarang } from '../db';
import { hanyaAdmin, type Variabel } from '../auth';
import { normalisasiWa, tanggalWib } from '../../shared/format';
import { JENIS_KONTEN, PLATFORM_KONTEN, STATUS_AFFILIATE, type JenisKonten } from '../../shared/konstanta';
import { periksa, wajib, teksOpsional, bilBulat, GalatPengguna, tidakDitemukan, catatAktivitas, bacaJson } from '../util';
import { hitungKinerja } from '../domain/kinerja';

const tanggal = (label: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `Pilih ${label}.`)
    .refine((v) => v <= tanggalWib(), `${label[0].toUpperCase()}${label.slice(1)} tidak boleh di masa depan.`);

const tautan = z
  .union([z.literal(''), z.string().trim().url('Tautan harus diawali https://').max(300)])
  .nullable()
  .optional()
  .transform((v) => v || null);

/** Dasbor kinerja program terhadap Blueprint PCC. */
export function ruteDasbor(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();
  app.get('/', (c) => c.json(hitungKinerja(db)));
  return app;
}

/** Content Factory (Pilar 4): catatan setiap konten yang diproduksi. */
export function ruteKonten(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();

  app.get('/', (c) => {
    const bulan = c.req.query('bulan') ?? tanggalWib().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(bulan)) throw new GalatPengguna(400, 'Format bulan tidak dikenali.');
    const daftar = db
      .prepare(
        `SELECT k.id, k.jenis, k.judul, k.platform, k.tautan, k.tanggal, k.umkm_id AS umkmId, u.nama_usaha AS namaUsaha, p.nama AS produk
         FROM konten k LEFT JOIN umkm u ON u.id = k.umkm_id LEFT JOIN produk p ON p.id = k.produk_id
         WHERE substr(k.tanggal, 1, 7) = ? ORDER BY k.tanggal DESC, k.id DESC`,
      )
      .all(bulan);
    const hitung = db.prepare('SELECT jenis, COUNT(*) AS n FROM konten WHERE substr(tanggal, 1, 7) = ? GROUP BY jenis').all(bulan) as { jenis: string; n: number }[];
    return c.json({ bulan, daftar, hitung: Object.fromEntries(hitung.map((h) => [h.jenis, h.n])) });
  });

  app.post('/', async (c) => {
    const d = periksa(
      z
        .object({
          jenis: z.enum(Object.keys(JENIS_KONTEN) as [JenisKonten, ...JenisKonten[]], { error: 'Pilih jenis konten.' }),
          judul: wajib('Judul konten').max(160),
          umkm_id: bilBulat('UMKM', 1).nullable().optional(),
          produk_id: bilBulat('Produk', 1).nullable().optional(),
          platform: z.enum(PLATFORM_KONTEN, { error: 'Pilih platform.' }).nullable().optional(),
          tautan,
          tanggal: tanggal('tanggal tayang atau selesai'),
          jumlah: bilBulat('Jumlah', 1).max(50, 'Paling banyak 50 konten sekaligus.').optional().default(1),
        })
        .refine((v) => !v.produk_id || !!v.umkm_id, { message: 'Pilih UMKM pemilik produk terlebih dahulu.', path: ['produk_id'] }),
      await bacaJson(c),
    );
    if (d.umkm_id && !db.prepare("SELECT 1 FROM umkm WHERE id = ? AND status = 'diterima'").get(d.umkm_id)) {
      throw new GalatPengguna(400, 'UMKM tidak ditemukan atau belum lolos kurasi.', { umkm_id: 'Pilih UMKM binaan.' });
    }
    if (d.produk_id && !db.prepare('SELECT 1 FROM produk WHERE id = ? AND umkm_id = ?').get(d.produk_id, d.umkm_id)) {
      throw new GalatPengguna(400, 'Produk bukan milik UMKM yang dipilih.', { produk_id: 'Pilih produk dari UMKM tersebut.' });
    }
    const pengguna = c.get('pengguna').id;
    const tambah = db.prepare(
      'INSERT INTO konten (jenis, judul, umkm_id, produk_id, platform, tautan, tanggal, dibuat_oleh, dibuat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (let i = 0; i < d.jumlah; i++)
        tambah.run(d.jenis, d.jumlah > 1 ? `${d.judul} (${i + 1})` : d.judul, d.umkm_id ?? null, d.produk_id ?? null, d.platform ?? null, d.tautan, d.tanggal, pengguna, sekarang());
    })();
    catatAktivitas(db, pengguna, 'tambah', 'konten', null, `${d.jumlah} ${JENIS_KONTEN[d.jenis].toLowerCase()} dicatat: ${d.judul}`);
    return c.json({ ok: true }, 201);
  });

  app.delete('/:id', (c) => {
    const id = Number(c.req.param('id'));
    const k = db.prepare('SELECT judul FROM konten WHERE id = ?').get(id) as { judul: string } | undefined;
    if (!k) throw tidakDitemukan('Konten');
    db.prepare('DELETE FROM konten WHERE id = ?').run(id);
    catatAktivitas(db, c.get('pengguna').id, 'hapus', 'konten', id, `Catatan konten "${k.judul}" dihapus`);
    return c.json({ ok: true });
  });

  return app;
}

/** Affiliate Community (Pilar 6): pasukan affiliate lokal. */
export function ruteAffiliate(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();
  const skema = z.object({
    nama: wajib('Nama').max(120),
    whatsapp: wajib('Nomor WhatsApp')
      .transform(normalisasiWa)
      .refine((v) => /^628\d{7,12}$/.test(v), 'Nomor WhatsApp tidak dikenali. Tulis seperti 0812 3456 7890.'),
    kecamatan: teksOpsional,
    platform: z.enum(PLATFORM_KONTEN, { error: 'Pilih platform utama.' }),
    akun: z.string().trim().max(80).optional().nullable().transform((v) => v || null),
    status: z.enum(Object.keys(STATUS_AFFILIATE) as ['aktif', 'jeda', 'berhenti']).optional().default('aktif'),
    bergabung: tanggal('tanggal bergabung'),
    catatan: teksOpsional,
  });

  app.get('/', (c) => {
    const daftar = db
      .prepare(
        `SELECT id, nama, whatsapp, kecamatan, platform, akun, status, bergabung, catatan FROM affiliate
         ORDER BY CASE status WHEN 'aktif' THEN 0 WHEN 'jeda' THEN 1 ELSE 2 END, bergabung DESC, id DESC`,
      )
      .all();
    const hitung = db.prepare('SELECT status, COUNT(*) AS n FROM affiliate GROUP BY status').all() as { status: string; n: number }[];
    return c.json({ daftar, hitung: Object.fromEntries(hitung.map((h) => [h.status, h.n])) });
  });

  app.post('/', async (c) => {
    const d = periksa(skema, await bacaJson(c));
    if (db.prepare('SELECT 1 FROM affiliate WHERE whatsapp = ?').get(d.whatsapp)) {
      throw new GalatPengguna(409, 'Nomor WhatsApp ini sudah terdaftar sebagai affiliate.', { whatsapp: 'Nomor sudah terdaftar.' });
    }
    const r = db
      .prepare('INSERT INTO affiliate (nama, whatsapp, kecamatan, platform, akun, status, bergabung, catatan, dibuat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(d.nama, d.whatsapp, d.kecamatan, d.platform, d.akun, d.status, d.bergabung, d.catatan, sekarang());
    catatAktivitas(db, c.get('pengguna').id, 'tambah', 'affiliate', Number(r.lastInsertRowid), `Affiliate ${d.nama} bergabung`);
    return c.json({ id: Number(r.lastInsertRowid) }, 201);
  });

  app.put('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!db.prepare('SELECT 1 FROM affiliate WHERE id = ?').get(id)) throw tidakDitemukan('Affiliate');
    const d = periksa(skema, await bacaJson(c));
    if (db.prepare('SELECT 1 FROM affiliate WHERE whatsapp = ? AND id != ?').get(d.whatsapp, id)) {
      throw new GalatPengguna(409, 'Nomor WhatsApp ini sudah dipakai affiliate lain.', { whatsapp: 'Nomor sudah terdaftar.' });
    }
    db.prepare('UPDATE affiliate SET nama = ?, whatsapp = ?, kecamatan = ?, platform = ?, akun = ?, status = ?, bergabung = ?, catatan = ? WHERE id = ?').run(
      d.nama,
      d.whatsapp,
      d.kecamatan,
      d.platform,
      d.akun,
      d.status,
      d.bergabung,
      d.catatan,
      id,
    );
    catatAktivitas(db, c.get('pengguna').id, 'ubah', 'affiliate', id, `Data affiliate ${d.nama} diperbarui`);
    return c.json({ ok: true });
  });

  app.delete('/:id', (c) => {
    hanyaAdmin(c);
    const id = Number(c.req.param('id'));
    const a = db.prepare('SELECT nama FROM affiliate WHERE id = ?').get(id) as { nama: string } | undefined;
    if (!a) throw tidakDitemukan('Affiliate');
    db.prepare('DELETE FROM affiliate WHERE id = ?').run(id);
    catatAktivitas(db, c.get('pengguna').id, 'hapus', 'affiliate', id, `Affiliate ${a.nama} dihapus`);
    return c.json({ ok: true });
  });

  return app;
}
