import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { sekarang } from '../db';
import type { Variabel } from '../auth';
import { PLATFORM_LIVE, RUANG_SIARAN, type JenisRuangan, type StatusSesi } from '../../shared/konstanta';
import { awalHariWib, akhirHariWib, tanggalWib, jam } from '../../shared/format';
import { periksa, wajib, teksOpsional, bilBulat, GalatPengguna, tidakDitemukan, catatAktivitas, bacaJson } from '../util';

interface BarisSesi {
  id: number;
  ruangan_id: number;
  judul: string;
  platform: string;
  host: string;
  jadwal_mulai: string;
  jadwal_selesai: string;
  status: StatusSesi;
  mulai: string | null;
  selesai: string | null;
  catatan: string | null;
}

const waktuIso = (label: string) =>
  z.string({ error: `${label} wajib diisi.` }).refine((v) => !Number.isNaN(Date.parse(v)), `${label} tidak valid.`).transform((v) => new Date(v).toISOString());

const skemaSesi = z
  .object({
    ruangan_id: bilBulat('Studio', 1),
    judul: wajib('Judul sesi').max(120),
    platform: z.enum(PLATFORM_LIVE, { error: 'Pilih platform siaran.' }),
    host: wajib('Nama host').max(100),
    jadwal_mulai: waktuIso('Waktu mulai'),
    jadwal_selesai: waktuIso('Waktu selesai'),
    produk_ids: z.array(z.number().int().positive()).max(60).default([]),
    catatan: teksOpsional,
  })
  .refine((v) => v.jadwal_selesai > v.jadwal_mulai, { message: 'Waktu selesai harus setelah waktu mulai.', path: ['jadwal_selesai'] })
  .refine((v) => Date.parse(v.jadwal_selesai) - Date.parse(v.jadwal_mulai) <= 12 * 3600_000, {
    message: 'Satu sesi paling lama 12 jam. Pecah menjadi beberapa sesi.',
    path: ['jadwal_selesai'],
  });

function ambilSesi(db: DB, id: number): BarisSesi {
  const s = db.prepare('SELECT * FROM sesi_live WHERE id = ?').get(id) as BarisSesi | undefined;
  if (!s) throw tidakDitemukan('Sesi live');
  return s;
}

function periksaBentrok(db: DB, ruanganId: number, mulai: string, selesai: string, kecuali = 0) {
  const r = db.prepare("SELECT jenis, nama FROM ruangan WHERE id = ?").get(ruanganId) as { jenis: string; nama: string } | undefined;
  if (!r) throw tidakDitemukan('Studio');
  if (!RUANG_SIARAN.includes(r.jenis as JenisRuangan)) {
    throw new GalatPengguna(400, `${r.nama} bukan studio siaran. Pilih studio live atau ruang podcast.`, { ruangan_id: 'Pilih studio.' });
  }
  const bentrok = db
    .prepare(
      `SELECT judul, jadwal_mulai, jadwal_selesai FROM sesi_live
       WHERE ruangan_id = ? AND id != ? AND status IN ('terjadwal','berlangsung') AND jadwal_mulai < ? AND jadwal_selesai > ?`,
    )
    .get(ruanganId, kecuali, selesai, mulai) as { judul: string; jadwal_mulai: string; jadwal_selesai: string } | undefined;
  if (bentrok) {
    throw new GalatPengguna(
      409,
      `${r.nama} sudah dipakai untuk "${bentrok.judul}" pukul ${jam(bentrok.jadwal_mulai)}–${jam(bentrok.jadwal_selesai)}. Pilih studio lain atau geser jadwalnya.`,
      { jadwal_mulai: 'Bentrok dengan sesi lain di studio ini.' },
    );
  }
}

function simpanProduk(db: DB, sesiId: number, ids: number[]) {
  db.prepare('DELETE FROM sesi_produk WHERE sesi_id = ?').run(sesiId);
  const ins = db.prepare('INSERT OR IGNORE INTO sesi_produk (sesi_id, produk_id) SELECT ?, id FROM produk WHERE id = ? AND aktif = 1');
  for (const id of ids) ins.run(sesiId, id);
}

export function ruteLive(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();

  app.get('/', (c) => {
    const dari = c.req.query('dari') ?? tanggalWib();
    const sampai = c.req.query('sampai') ?? dari;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dari) || !/^\d{4}-\d{2}-\d{2}$/.test(sampai)) throw new GalatPengguna(400, 'Format tanggal tidak dikenali.');
    const daftar = db
      .prepare(
        `SELECT s.id, s.judul, s.platform, s.host, s.jadwal_mulai AS jadwalMulai, s.jadwal_selesai AS jadwalSelesai, s.status, s.mulai, s.selesai,
           s.ruangan_id AS ruanganId, r.nama AS ruangan, r.kode AS kodeRuangan,
           (SELECT COUNT(*) FROM sesi_produk sp WHERE sp.sesi_id = s.id) AS jumlahProduk,
           COALESCE((SELECT SUM(total) FROM penjualan j WHERE j.sesi_id = s.id AND j.status = 'selesai'), 0) AS omzet,
           (SELECT COUNT(*) FROM penjualan j WHERE j.sesi_id = s.id AND j.status = 'selesai') AS jumlahPesanan
         FROM sesi_live s JOIN ruangan r ON r.id = s.ruangan_id
         WHERE (s.jadwal_mulai >= ? AND s.jadwal_mulai < ?) OR s.status = 'berlangsung'
         ORDER BY s.jadwal_mulai`,
      )
      .all(awalHariWib(dari), akhirHariWib(sampai));
    return c.json({ daftar });
  });

  app.get('/:id', (c) => {
    const s = ambilSesi(db, Number(c.req.param('id')));
    const r = db.prepare('SELECT id, kode, nama FROM ruangan WHERE id = ?').get(s.ruangan_id);
    const produk = db
      .prepare(
        `SELECT p.id, p.nama, p.sku, p.harga, p.satuan, u.nama_usaha AS namaUsaha,
           COALESCE((SELECT SUM(jumlah) FROM mutasi_stok m WHERE m.produk_id = p.id), 0) AS stok
         FROM sesi_produk sp JOIN produk p ON p.id = sp.produk_id JOIN umkm u ON u.id = p.umkm_id
         WHERE sp.sesi_id = ? ORDER BY u.nama_usaha, p.nama`,
      )
      .all(s.id);
    const penjualan = db
      .prepare('SELECT id, nomor, total, status, tanggal, nomor_pesanan AS nomorPesanan, pembeli FROM penjualan WHERE sesi_id = ? ORDER BY tanggal DESC')
      .all(s.id);
    return c.json({
      id: s.id,
      judul: s.judul,
      platform: s.platform,
      host: s.host,
      jadwalMulai: s.jadwal_mulai,
      jadwalSelesai: s.jadwal_selesai,
      status: s.status,
      mulai: s.mulai,
      selesai: s.selesai,
      catatan: s.catatan,
      ruangan: r,
      produk,
      penjualan,
    });
  });

  app.post('/', async (c) => {
    const d = periksa(skemaSesi, await bacaJson(c));
    periksaBentrok(db, d.ruangan_id, d.jadwal_mulai, d.jadwal_selesai);
    const penggunaId = c.get('pengguna').id;
    const id = db.transaction(() => {
      const r = db
        .prepare(
          'INSERT INTO sesi_live (ruangan_id, judul, platform, host, jadwal_mulai, jadwal_selesai, catatan, dibuat_oleh, dibuat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(d.ruangan_id, d.judul, d.platform, d.host, d.jadwal_mulai, d.jadwal_selesai, d.catatan, penggunaId, sekarang());
      const id = Number(r.lastInsertRowid);
      simpanProduk(db, id, d.produk_ids);
      catatAktivitas(db, penggunaId, 'jadwal', 'sesi', id, `Sesi "${d.judul}" dijadwalkan`);
      return id;
    })();
    return c.json({ id }, 201);
  });

  app.patch('/:id', async (c) => {
    const s = ambilSesi(db, Number(c.req.param('id')));
    if (s.status === 'selesai' || s.status === 'batal') {
      throw new GalatPengguna(409, 'Sesi yang sudah selesai atau dibatalkan tidak bisa diubah. Buat sesi baru bila perlu.');
    }
    const d = periksa(skemaSesi, await bacaJson(c));
    periksaBentrok(db, d.ruangan_id, d.jadwal_mulai, d.jadwal_selesai, s.id);
    db.transaction(() => {
      db.prepare('UPDATE sesi_live SET ruangan_id=?, judul=?, platform=?, host=?, jadwal_mulai=?, jadwal_selesai=?, catatan=? WHERE id=?').run(
        d.ruangan_id,
        d.judul,
        d.platform,
        d.host,
        d.jadwal_mulai,
        d.jadwal_selesai,
        d.catatan,
        s.id,
      );
      simpanProduk(db, s.id, d.produk_ids);
    })();
    catatAktivitas(db, c.get('pengguna').id, 'ubah', 'sesi', s.id, `Sesi "${d.judul}" diperbarui`);
    return c.json({ ok: true });
  });

  app.post('/:id/mulai', (c) => {
    const s = ambilSesi(db, Number(c.req.param('id')));
    if (s.status !== 'terjadwal') throw new GalatPengguna(409, 'Sesi ini tidak dalam status terjadwal, jadi tidak bisa dimulai.');
    const aktif = db.prepare("SELECT judul FROM sesi_live WHERE ruangan_id = ? AND status = 'berlangsung'").get(s.ruangan_id) as { judul: string } | undefined;
    if (aktif) throw new GalatPengguna(409, `Studio ini masih menyiarkan "${aktif.judul}". Akhiri siaran itu terlebih dahulu.`);
    db.prepare("UPDATE sesi_live SET status = 'berlangsung', mulai = ? WHERE id = ?").run(sekarang(), s.id);
    catatAktivitas(db, c.get('pengguna').id, 'mulai', 'sesi', s.id, `Siaran "${s.judul}" dimulai`);
    return c.json({ ok: true });
  });

  app.post('/:id/selesai', (c) => {
    const s = ambilSesi(db, Number(c.req.param('id')));
    if (s.status !== 'berlangsung') throw new GalatPengguna(409, 'Sesi ini belum dimulai, jadi belum bisa diakhiri.');
    db.prepare("UPDATE sesi_live SET status = 'selesai', selesai = ? WHERE id = ?").run(sekarang(), s.id);
    catatAktivitas(db, c.get('pengguna').id, 'selesai', 'sesi', s.id, `Siaran "${s.judul}" diakhiri`);
    return c.json({ ok: true });
  });

  app.post('/:id/batal', (c) => {
    const s = ambilSesi(db, Number(c.req.param('id')));
    if (s.status !== 'terjadwal') throw new GalatPengguna(409, 'Hanya sesi yang belum dimulai yang bisa dibatalkan.');
    db.prepare("UPDATE sesi_live SET status = 'batal' WHERE id = ?").run(s.id);
    catatAktivitas(db, c.get('pengguna').id, 'batal', 'sesi', s.id, `Sesi "${s.judul}" dibatalkan`);
    return c.json({ ok: true });
  });

  return app;
}
