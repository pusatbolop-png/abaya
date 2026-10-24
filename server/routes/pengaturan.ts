import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { sekarang } from '../db';
import { hashSandi, hanyaAdmin, type Variabel } from '../auth';
import { normalisasiWa, tanggalWib, awalHariWib, akhirHariWib } from '../../shared/format';
import { STOK_MENIPIS } from '../../shared/konstanta';
import { ambilPengaturan, simpanPengaturan, periksa, wajib, GalatPengguna, tidakDitemukan, catatAktivitas, bacaJson } from '../util';
import { simpanBerkas, hapusBerkas } from '../berkas';
import { sandiKuat } from './auth';
import { daftarPosisi } from './dana';
import { PELAT_LANTAI } from '../defaults';

const ukuran = (label: string, min: number, maks: number) =>
  z.coerce.number({ error: `${label} harus berupa angka.` }).min(min, `${label} minimal ${min} m.`).max(maks, `${label} maksimal ${maks} m.`);

export function rutePengaturan(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();

  app.get('/', (c) => {
    const s = ambilPengaturan(db);
    const ruangan = db.prepare('SELECT * FROM ruangan ORDER BY lantai, urutan').all();
    return c.json({ ...s, logo: s.logo ? `/api/publik/logo?v=${s.logo.slice(-16, -4)}` : null, ruangan, pelat: PELAT_LANTAI });
  });

  app.put('/organisasi', async (c) => {
    hanyaAdmin(c);
    const d = periksa(
      z.object({
        nama: wajib('Nama lembaga').max(120),
        singkat: wajib('Singkatan').max(12),
        naungan: z.string().trim().max(120).default(''),
        alamat: z.string().trim().max(300).default(''),
        whatsapp: z
          .string()
          .trim()
          .default('')
          .transform((v) => (v ? normalisasiWa(v) : ''))
          .refine((v) => !v || /^628\d{7,12}$/.test(v), 'Nomor WhatsApp tidak dikenali. Tulis seperti 0812 3456 7890.'),
        email: z.union([z.literal(''), z.string().trim().email('Alamat email tidak valid.')]).default(''),
        jamLayanan: z.string().trim().max(120).default(''),
      }),
      await bacaJson(c),
    );
    simpanPengaturan(db, 'organisasi', d);
    catatAktivitas(db, c.get('pengguna').id, 'atur', 'pengaturan', null, 'Profil lembaga diperbarui');
    return c.json({ ok: true });
  });

  app.put('/instansi', async (c) => {
    hanyaAdmin(c);
    const lama = ambilPengaturan(db).instansi;
    const d = periksa(
      z
        .array(
          z.object({
            kunci: z.string(),
            instansi: z.string().trim().max(160),
            dokumen: wajib('Nama dokumen izin').max(120),
            wajib: z.boolean(),
          }),
        )
        .length(lama.length, 'Jumlah jenis izin tidak sesuai.'),
      await bacaJson(c),
    );
    // Kunci izin dipertahankan agar berkas yang sudah diunggah tetap terhubung.
    const baru = lama.map((l, i) => ({ ...d[i], kunci: l.kunci }));
    simpanPengaturan(db, 'instansi', baru);
    catatAktivitas(db, c.get('pengguna').id, 'atur', 'pengaturan', null, 'Instansi perizinan diperbarui');
    return c.json({ ok: true });
  });

  app.put('/keuangan', async (c) => {
    hanyaAdmin(c);
    const d = periksa(
      z.object({
        potonganPersen: z.coerce.number({ error: 'Potongan harus berupa angka.' }).min(0, 'Potongan minimal 0%.').max(50, 'Potongan maksimal 50%.'),
      }),
      await bacaJson(c),
    );
    simpanPengaturan(db, 'keuangan', d);
    catatAktivitas(db, c.get('pengguna').id, 'atur', 'pengaturan', null, `Potongan jasa diatur ${d.potonganPersen}%`);
    return c.json({ ok: true });
  });

  app.put('/ruangan/:id', async (c) => {
    hanyaAdmin(c);
    const id = Number(c.req.param('id'));
    if (!db.prepare('SELECT 1 FROM ruangan WHERE id = ?').get(id)) throw tidakDitemukan('Ruangan');
    const d = periksa(
      z
        .object({
          nama: wajib('Nama ruangan').max(60),
          lebar: ukuran('Lebar', 2, PELAT_LANTAI.lebar),
          panjang: ukuran('Panjang', 2, PELAT_LANTAI.panjang),
          x: ukuran('Posisi X', 0, PELAT_LANTAI.lebar),
          z: ukuran('Posisi Z', 0, PELAT_LANTAI.panjang),
          kapasitas: z.coerce.number().int().min(0).max(500).nullable().optional(),
        })
        .refine((v) => v.x + v.lebar <= PELAT_LANTAI.lebar, { message: `Ruangan melewati batas lebar gedung ${PELAT_LANTAI.lebar} m.`, path: ['lebar'] })
        .refine((v) => v.z + v.panjang <= PELAT_LANTAI.panjang, { message: `Ruangan melewati batas panjang gedung ${PELAT_LANTAI.panjang} m.`, path: ['panjang'] }),
      await bacaJson(c),
    );
    db.prepare('UPDATE ruangan SET nama = ?, lebar = ?, panjang = ?, x = ?, z = ?, kapasitas = ? WHERE id = ?').run(
      d.nama,
      d.lebar,
      d.panjang,
      d.x,
      d.z,
      d.kapasitas ?? null,
      id,
    );
    catatAktivitas(db, c.get('pengguna').id, 'atur', 'ruangan', id, `Ukuran ${d.nama} diperbarui`);
    return c.json({ ok: true });
  });

  app.put('/denah', async (c) => {
    hanyaAdmin(c);
    const d = periksa(z.object({ terkonfirmasi: z.boolean() }), await bacaJson(c));
    simpanPengaturan(db, 'denahTerkonfirmasi', d.terkonfirmasi);
    catatAktivitas(db, c.get('pengguna').id, 'atur', 'pengaturan', null, d.terkonfirmasi ? 'Ukuran denah ditandai sesuai gambar kerja' : 'Tanda kesesuaian denah dicabut');
    return c.json({ ok: true });
  });

  app.post('/logo', async (c) => {
    hanyaAdmin(c);
    const form = await c.req.parseBody();
    const f = form.logo;
    if (!(f instanceof File)) throw new GalatPengguna(400, 'Pilih berkas logo terlebih dahulu.');
    const s = await simpanBerkas(f, 'logo', ['svg', 'png', 'webp', 'jpg'], 'logo');
    const lama = ambilPengaturan(db).logo;
    simpanPengaturan(db, 'logo', s.nama);
    hapusBerkas(lama);
    catatAktivitas(db, c.get('pengguna').id, 'atur', 'pengaturan', null, 'Logo diperbarui');
    return c.json({ ok: true });
  });

  app.delete('/logo', (c) => {
    hanyaAdmin(c);
    hapusBerkas(ambilPengaturan(db).logo);
    simpanPengaturan(db, 'logo', null);
    return c.json({ ok: true });
  });

  return app;
}

export function rutePengguna(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();

  app.get('/', (c) => {
    hanyaAdmin(c);
    return c.json({ daftar: db.prepare('SELECT id, nama, email, peran, aktif, dibuat FROM pengguna ORDER BY aktif DESC, nama').all() });
  });

  app.post('/', async (c) => {
    hanyaAdmin(c);
    const d = periksa(
      z.object({
        nama: wajib('Nama').max(100),
        email: z.string().trim().email('Alamat email tidak valid.'),
        peran: z.enum(['admin', 'petugas'], { error: 'Pilih peran.' }),
        sandi: sandiKuat,
      }),
      await bacaJson(c),
    );
    if (db.prepare('SELECT 1 FROM pengguna WHERE email = ?').get(d.email)) {
      throw new GalatPengguna(409, 'Email ini sudah dipakai akun lain. Gunakan email yang berbeda.', { email: 'Sudah dipakai.' });
    }
    const r = db.prepare('INSERT INTO pengguna (nama, email, sandi, peran, dibuat) VALUES (?, ?, ?, ?, ?)').run(d.nama, d.email, await hashSandi(d.sandi), d.peran, sekarang());
    catatAktivitas(db, c.get('pengguna').id, 'tambah', 'pengguna', Number(r.lastInsertRowid), `Akun ${d.nama} dibuat`);
    return c.json({ id: Number(r.lastInsertRowid) }, 201);
  });

  app.patch('/:id', async (c) => {
    hanyaAdmin(c);
    const id = Number(c.req.param('id'));
    if (!db.prepare('SELECT 1 FROM pengguna WHERE id = ?').get(id)) throw tidakDitemukan('Pengguna');
    const d = periksa(
      z.object({
        peran: z.enum(['admin', 'petugas']).optional(),
        aktif: z.boolean().optional(),
        sandi: z.union([z.literal(''), sandiKuat]).optional(),
      }),
      await bacaJson(c),
    );
    if (id === c.get('pengguna').id && (d.aktif === false || d.peran === 'petugas')) {
      throw new GalatPengguna(409, 'Anda tidak bisa menonaktifkan atau menurunkan peran akun sendiri. Minta administrator lain melakukannya.');
    }
    if (d.peran) db.prepare('UPDATE pengguna SET peran = ? WHERE id = ?').run(d.peran, id);
    if (d.aktif !== undefined) {
      db.prepare('UPDATE pengguna SET aktif = ? WHERE id = ?').run(d.aktif ? 1 : 0, id);
      if (!d.aktif) db.prepare('DELETE FROM sesi_masuk WHERE pengguna_id = ?').run(id);
    }
    if (d.sandi) db.prepare('UPDATE pengguna SET sandi = ? WHERE id = ?').run(await hashSandi(d.sandi), id);
    return c.json({ ok: true });
  });

  return app;
}

export function ruteRingkasan(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();

  app.get('/', (c) => {
    const hari = tanggalWib();
    const awal = awalHariWib(hari);
    const akhir = akhirHariWib(hari);
    const hariIni = db
      .prepare("SELECT COUNT(*) AS pesanan, COALESCE(SUM(total), 0) AS omzet FROM penjualan WHERE status = 'selesai' AND tanggal >= ? AND tanggal < ?")
      .get(awal, akhir) as { pesanan: number; omzet: number };
    const tujuhHari: { tanggal: string; omzet: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const t = tanggalWib(new Date(Date.now() - i * 86_400_000));
      const r = db
        .prepare("SELECT COALESCE(SUM(total), 0) AS omzet FROM penjualan WHERE status = 'selesai' AND tanggal >= ? AND tanggal < ?")
        .get(awalHariWib(t), akhirHariWib(t)) as { omzet: number };
      tujuhHari.push({ tanggal: t, omzet: r.omzet });
    }
    const sesi = db
      .prepare(
        `SELECT s.id, s.judul, s.platform, s.host, s.status, s.jadwal_mulai AS jadwalMulai, s.jadwal_selesai AS jadwalSelesai, r.nama AS ruangan,
           COALESCE((SELECT SUM(total) FROM penjualan j WHERE j.sesi_id = s.id AND j.status = 'selesai'), 0) AS omzet
         FROM sesi_live s JOIN ruangan r ON r.id = s.ruangan_id
         WHERE s.status != 'batal' AND ((s.jadwal_mulai >= ? AND s.jadwal_mulai < ?) OR s.status = 'berlangsung') ORDER BY s.jadwal_mulai`,
      )
      .all(awal, akhir);
    const menunggu = (db.prepare("SELECT COUNT(*) AS n FROM umkm WHERE status = 'diajukan'").get() as { n: number }).n;
    const diterima = (db.prepare("SELECT COUNT(*) AS n FROM umkm WHERE status = 'diterima'").get() as { n: number }).n;
    const menipis = db
      .prepare(
        `SELECT * FROM (SELECT p.id, p.nama, u.nama_usaha AS namaUsaha, COALESCE((SELECT SUM(jumlah) FROM mutasi_stok m WHERE m.produk_id = p.id), 0) AS stok
         FROM produk p JOIN umkm u ON u.id = p.umkm_id WHERE p.aktif = 1 AND u.status = 'diterima') WHERE stok <= ? ORDER BY stok LIMIT 6`,
      )
      .all(STOK_MENIPIS);
    const { daftar } = daftarPosisi(db);
    const siapCair = daftar.reduce((a, d) => a + Math.max(0, d.siapCair), 0);
    const aktivitas = db
      .prepare('SELECT a.id, a.aksi, a.ringkasan, a.dibuat, g.nama AS oleh FROM aktivitas a LEFT JOIN pengguna g ON g.id = a.pengguna_id ORDER BY a.id DESC LIMIT 8')
      .all();
    return c.json({ hariIni, tujuhHari, sesi, menunggu, diterima, menipis, siapCair, aktivitas });
  });

  return app;
}
