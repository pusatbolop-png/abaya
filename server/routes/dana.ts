import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { sekarang } from '../db';
import { hanyaAdmin, type Variabel } from '../auth';
import { tanggalWib, akhirHariWib, rupiah } from '../../shared/format';
import { ambilPengaturan, periksa, wajib, teksOpsional, bilBulat, GalatPengguna, tidakDitemukan, catatAktivitas, nomorBaru, bacaJson } from '../util';
import { posisiDana } from '../domain/dana';
import { ambilUmkm } from './umkm';

export function daftarPosisi(db: DB) {
  const persen = ambilPengaturan(db).keuangan.potonganPersen;
  const umkm = db
    .prepare(
      `SELECT id, kode, nama_usaha AS namaUsaha, bank, no_rekening AS noRekening, atas_nama AS atasNama FROM umkm
       WHERE status = 'diterima' OR id IN (SELECT umkm_id FROM item_penjualan) ORDER BY nama_usaha`,
    )
    .all() as { id: number; bank: string | null; noRekening: string | null; atasNama: string | null }[];
  return {
    persen,
    daftar: umkm.map((u) => ({ ...u, rekeningLengkap: !!(u.bank && u.noRekening && u.atasNama), ...posisiDana(db, u.id, persen) })),
  };
}

export function ruteDana(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();

  app.get('/', (c) => {
    const { persen, daftar } = daftarPosisi(db);
    const total = daftar.reduce(
      (a, d) => ({ siapCair: a.siapCair + Math.max(0, d.siapCair), menunggu: a.menunggu + d.menungguTransfer, dibayar: a.dibayar + d.sudahDibayar }),
      { siapCair: 0, menunggu: 0, dibayar: 0 },
    );
    return c.json({ persen, daftar, total });
  });

  app.get('/pencairan', (c) => {
    const umkmId = Number(c.req.query('umkm_id')) || null;
    const daftar = db
      .prepare(
        `SELECT c.id, c.nomor, c.umkm_id AS umkmId, u.nama_usaha AS namaUsaha, c.sampai, c.bruto, c.retur, c.potongan, c.jumlah, c.status,
           c.referensi_transfer AS referensiTransfer, c.dibayar, c.catatan, c.dibuat
         FROM pencairan c JOIN umkm u ON u.id = c.umkm_id ${umkmId ? 'WHERE c.umkm_id = ?' : ''}
         ORDER BY c.dibuat DESC LIMIT 300`,
      )
      .all(...(umkmId ? [umkmId] : []));
    return c.json({ daftar });
  });

  app.post('/pencairan', async (c) => {
    hanyaAdmin(c);
    const d = periksa(
      z.object({
        umkm_id: bilBulat('UMKM', 1),
        sampai: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal batas tidak valid.')
          .optional()
          .transform((v) => v ?? tanggalWib())
          .refine((v) => v <= tanggalWib(), 'Tanggal batas tidak boleh melewati hari ini.'),
        catatan: teksOpsional,
      }),
      await bacaJson(c),
    );
    const u = ambilUmkm(db, d.umkm_id);
    if (!u.bank || !u.no_rekening || !u.atas_nama) {
      throw new GalatPengguna(409, `Data rekening ${u.nama_usaha} belum lengkap. Lengkapi bank, nomor rekening, dan nama pemilik rekening di halaman UMKM.`);
    }
    const terakhir = db.prepare("SELECT MAX(sampai) AS s FROM pencairan WHERE umkm_id = ? AND status != 'batal'").get(u.id) as { s: string | null };
    if (terakhir.s && d.sampai < terakhir.s) {
      throw new GalatPengguna(409, `Pencairan sebelumnya sudah mencakup sampai ${terakhir.s}. Pilih tanggal batas yang sama atau sesudahnya.`);
    }
    const persen = ambilPengaturan(db).keuangan.potonganPersen;
    const pos = posisiDana(db, u.id, persen, akhirHariWib(d.sampai));
    if (pos.siapCair <= 0) {
      throw new GalatPengguna(409, `Belum ada dana yang bisa dicairkan untuk ${u.nama_usaha} sampai tanggal itu.`);
    }
    const penggunaId = c.get('pengguna').id;
    const hasil = db.transaction(() => {
      const nomor = nomorBaru(db, 'DC');
      const r = db
        .prepare(
          'INSERT INTO pencairan (nomor, umkm_id, sampai, bruto, retur, potongan, jumlah, catatan, dibuat_oleh, dibuat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(nomor, u.id, d.sampai, pos.bruto, pos.retur, pos.potongan, pos.siapCair, d.catatan, penggunaId, sekarang());
      const id = Number(r.lastInsertRowid);
      catatAktivitas(db, penggunaId, 'cair', 'pencairan', id, `Pencairan ${nomor} untuk ${u.nama_usaha} sebesar ${rupiah(pos.siapCair)} disiapkan`);
      return { id, nomor, jumlah: pos.siapCair };
    })();
    return c.json(hasil, 201);
  });

  app.post('/pencairan/:id/bayar', async (c) => {
    hanyaAdmin(c);
    const id = Number(c.req.param('id'));
    const p = db.prepare('SELECT nomor, status FROM pencairan WHERE id = ?').get(id) as { nomor: string; status: string } | undefined;
    if (!p) throw tidakDitemukan('Pencairan');
    if (p.status !== 'disiapkan') throw new GalatPengguna(409, 'Pencairan ini sudah ditandai sebelumnya.');
    const d = periksa(z.object({ referensi_transfer: wajib('Nomor referensi transfer').max(80) }), await bacaJson(c));
    db.prepare("UPDATE pencairan SET status = 'dibayar', referensi_transfer = ?, dibayar = ? WHERE id = ?").run(d.referensi_transfer, sekarang(), id);
    catatAktivitas(db, c.get('pengguna').id, 'bayar', 'pencairan', id, `Pencairan ${p.nomor} ditandai sudah ditransfer`);
    return c.json({ ok: true });
  });

  app.post('/pencairan/:id/batal', async (c) => {
    hanyaAdmin(c);
    const id = Number(c.req.param('id'));
    const p = db.prepare('SELECT nomor, status FROM pencairan WHERE id = ?').get(id) as { nomor: string; status: string } | undefined;
    if (!p) throw tidakDitemukan('Pencairan');
    if (p.status !== 'disiapkan') throw new GalatPengguna(409, 'Pencairan yang sudah ditransfer tidak bisa dibatalkan.');
    db.prepare("UPDATE pencairan SET status = 'batal' WHERE id = ?").run(id);
    catatAktivitas(db, c.get('pengguna').id, 'batal', 'pencairan', id, `Pencairan ${p.nomor} dibatalkan`);
    return c.json({ ok: true });
  });

  return app;
}
