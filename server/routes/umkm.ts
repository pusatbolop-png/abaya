import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { sekarang } from '../db';
import { hanyaAdmin, type Variabel } from '../auth';
import { KATEGORI_USAHA, KRITERIA_SELEKSI, STATUS_UMKM, type StatusUmkm } from '../../shared/konstanta';
import { normalisasiWa } from '../../shared/format';
import { ambilPengaturan, periksa, wajib, teksOpsional, GalatPengguna, tidakDitemukan, catatAktivitas, bacaJson } from '../util';
import { simpanBerkas, bacaBerkas, hapusBerkas, HEADER_BERKAS } from '../berkas';
import { posisiDana } from '../domain/dana';

interface BarisUmkm {
  id: number;
  kode: string;
  nama_usaha: string;
  pemilik: string;
  whatsapp: string;
  email: string | null;
  alamat: string;
  kecamatan: string;
  kategori: string;
  deskripsi: string;
  media_sosial: string | null;
  bank: string | null;
  no_rekening: string | null;
  atas_nama: string | null;
  status: StatusUmkm;
  skor: string | null;
  catatan_seleksi: string | null;
  diputuskan: string | null;
  diputuskan_oleh: number | null;
  dibuat: string;
}

export function ambilUmkm(db: DB, id: number): BarisUmkm {
  const u = db.prepare('SELECT * FROM umkm WHERE id = ?').get(id) as BarisUmkm | undefined;
  if (!u) throw tidakDitemukan('UMKM');
  return u;
}

export function ruteUmkm(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();

  app.get('/', (c) => {
    const status = c.req.query('status');
    const q = c.req.query('q')?.trim();
    const kondisi: string[] = [];
    const arg: unknown[] = [];
    if (status && status in STATUS_UMKM) {
      kondisi.push('u.status = ?');
      arg.push(status);
    }
    if (q) {
      kondisi.push('(u.nama_usaha LIKE ? OR u.pemilik LIKE ? OR u.kode LIKE ?)');
      arg.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const daftar = db
      .prepare(
        `SELECT u.id, u.kode, u.nama_usaha AS namaUsaha, u.pemilik, u.kategori, u.kecamatan, u.status, u.dibuat, u.whatsapp,
           (SELECT COUNT(*) FROM izin_umkm i WHERE i.umkm_id = u.id AND i.status = 'terverifikasi') AS izinTerverifikasi,
           (SELECT COUNT(*) FROM izin_umkm i WHERE i.umkm_id = u.id AND i.status = 'diunggah') AS izinMenunggu,
           (SELECT COUNT(*) FROM produk p WHERE p.umkm_id = u.id AND p.aktif = 1) AS jumlahProduk
         FROM umkm u ${kondisi.length ? 'WHERE ' + kondisi.join(' AND ') : ''}
         ORDER BY CASE u.status WHEN 'diajukan' THEN 0 WHEN 'perlu_perbaikan' THEN 1 WHEN 'diterima' THEN 2 ELSE 3 END, u.dibuat DESC`,
      )
      .all(...arg);
    const hitung = db.prepare('SELECT status, COUNT(*) AS n FROM umkm GROUP BY status').all() as { status: string; n: number }[];
    return c.json({ daftar, hitung: Object.fromEntries(hitung.map((h) => [h.status, h.n])) });
  });

  app.get('/:id', (c) => {
    const u = ambilUmkm(db, Number(c.req.param('id')));
    const s = ambilPengaturan(db);
    const izinDb = db.prepare('SELECT * FROM izin_umkm WHERE umkm_id = ?').all(u.id) as {
      kunci: string;
      nomor: string | null;
      berkas: string | null;
      berkas_nama: string | null;
      status: string;
      catatan: string | null;
      diperiksa: string | null;
    }[];
    const izin = s.instansi.map((i) => {
      const r = izinDb.find((x) => x.kunci === i.kunci);
      return {
        kunci: i.kunci,
        dokumen: i.dokumen,
        instansi: i.instansi,
        wajib: i.wajib,
        nomor: r?.nomor ?? null,
        adaBerkas: !!r?.berkas,
        berkasNama: r?.berkas_nama ?? null,
        status: r?.status ?? 'belum_ada',
        catatan: r?.catatan ?? null,
        diperiksa: r?.diperiksa ?? null,
      };
    });
    const produk = db
      .prepare(
        `SELECT p.id, p.nama, p.sku, p.harga, p.satuan, p.aktif,
           COALESCE((SELECT SUM(jumlah) FROM mutasi_stok m WHERE m.produk_id = p.id), 0) AS stok,
           COALESCE((SELECT SUM(i.jumlah) FROM item_penjualan i JOIN penjualan j ON j.id = i.penjualan_id WHERE i.produk_id = p.id AND j.status = 'selesai'), 0) AS terjual
         FROM produk p WHERE p.umkm_id = ? ORDER BY p.aktif DESC, p.nama`,
      )
      .all(u.id);
    const pemutus = u.diputuskan_oleh ? (db.prepare('SELECT nama FROM pengguna WHERE id = ?').get(u.diputuskan_oleh) as { nama: string }) : null;
    return c.json({
      id: u.id,
      kode: u.kode,
      namaUsaha: u.nama_usaha,
      pemilik: u.pemilik,
      whatsapp: u.whatsapp,
      email: u.email,
      alamat: u.alamat,
      kecamatan: u.kecamatan,
      kategori: u.kategori,
      deskripsi: u.deskripsi,
      mediaSosial: u.media_sosial,
      bank: u.bank,
      noRekening: u.no_rekening,
      atasNama: u.atas_nama,
      status: u.status,
      skor: u.skor ? JSON.parse(u.skor) : null,
      catatanSeleksi: u.catatan_seleksi,
      diputuskan: u.diputuskan,
      diputuskanOleh: pemutus?.nama ?? null,
      dibuat: u.dibuat,
      izin,
      produk,
      dana: posisiDana(db, u.id, s.keuangan.potonganPersen),
    });
  });

  app.patch('/:id', async (c) => {
    const u = ambilUmkm(db, Number(c.req.param('id')));
    const d = periksa(
      z.object({
        nama_usaha: wajib('Nama usaha').max(120),
        pemilik: wajib('Nama pemilik').max(120),
        whatsapp: wajib('Nomor WhatsApp').transform(normalisasiWa).refine((v) => /^628\d{7,12}$/.test(v), 'Nomor WhatsApp tidak dikenali.'),
        email: z.union([z.literal(''), z.string().trim().email('Alamat email tidak valid.')]).nullable().optional().transform((v) => v || null),
        alamat: wajib('Alamat').max(300),
        kecamatan: wajib('Kecamatan').max(60),
        kategori: z.enum(KATEGORI_USAHA, { error: 'Pilih kategori usaha.' }),
        deskripsi: wajib('Deskripsi').max(1500),
        media_sosial: teksOpsional,
        bank: teksOpsional,
        no_rekening: z.string().trim().max(40).nullable().optional().transform((v) => (v ? v.replace(/[^\d]/g, '') : null)),
        atas_nama: teksOpsional,
      }),
      await bacaJson(c),
    );
    db.prepare(
      `UPDATE umkm SET nama_usaha=@nama_usaha, pemilik=@pemilik, whatsapp=@whatsapp, email=@email, alamat=@alamat, kecamatan=@kecamatan,
       kategori=@kategori, deskripsi=@deskripsi, media_sosial=@media_sosial, bank=@bank, no_rekening=@no_rekening, atas_nama=@atas_nama WHERE id=@id`,
    ).run({ ...d, id: u.id });
    catatAktivitas(db, c.get('pengguna').id, 'ubah', 'umkm', u.id, `Data ${d.nama_usaha} diperbarui`);
    return c.json({ ok: true });
  });

  app.put('/:id/izin/:kunci', async (c) => {
    const u = ambilUmkm(db, Number(c.req.param('id')));
    const kunci = c.req.param('kunci');
    const dok = ambilPengaturan(db).instansi.find((i) => i.kunci === kunci);
    if (!dok) throw tidakDitemukan('Jenis izin');
    const d = periksa(
      z
        .object({
          status: z.enum(['belum_ada', 'diunggah', 'terverifikasi', 'tidak_valid'], { error: 'Pilih status verifikasi.' }),
          nomor: teksOpsional,
          catatan: teksOpsional,
        })
        .refine((v) => v.status !== 'tidak_valid' || !!v.catatan, { message: 'Tuliskan alasan agar UMKM tahu apa yang perlu diperbaiki.', path: ['catatan'] }),
      await bacaJson(c),
    );
    db.prepare(
      `INSERT INTO izin_umkm (umkm_id, kunci, nomor, status, catatan, diperiksa) VALUES (@u, @k, @nomor, @status, @catatan, @t)
       ON CONFLICT(umkm_id, kunci) DO UPDATE SET nomor = excluded.nomor, status = excluded.status, catatan = excluded.catatan, diperiksa = excluded.diperiksa`,
    ).run({ u: u.id, k: kunci, nomor: d.nomor, status: d.status, catatan: d.catatan, t: sekarang() });
    catatAktivitas(db, c.get('pengguna').id, 'verifikasi', 'umkm', u.id, `${dok.dokumen} ${u.nama_usaha}: ${d.status.replace('_', ' ')}`);
    return c.json({ ok: true });
  });

  app.post('/:id/izin/:kunci/berkas', async (c) => {
    const u = ambilUmkm(db, Number(c.req.param('id')));
    const kunci = c.req.param('kunci');
    const dok = ambilPengaturan(db).instansi.find((i) => i.kunci === kunci);
    if (!dok) throw tidakDitemukan('Jenis izin');
    const form = await c.req.parseBody();
    const f = form.berkas;
    if (!(f instanceof File)) throw new GalatPengguna(400, 'Pilih berkas yang akan diunggah.');
    const s = await simpanBerkas(f, 'izin', ['pdf', 'jpg', 'png'], dok.dokumen);
    const lama = db.prepare('SELECT berkas FROM izin_umkm WHERE umkm_id = ? AND kunci = ?').get(u.id, kunci) as { berkas: string | null } | undefined;
    db.prepare(
      `INSERT INTO izin_umkm (umkm_id, kunci, berkas, berkas_nama, status) VALUES (?, ?, ?, ?, 'diunggah')
       ON CONFLICT(umkm_id, kunci) DO UPDATE SET berkas = excluded.berkas, berkas_nama = excluded.berkas_nama, status = 'diunggah'`,
    ).run(u.id, kunci, s.nama, s.asli);
    hapusBerkas(lama?.berkas ?? null);
    return c.json({ ok: true });
  });

  app.get('/:id/izin/:kunci/berkas', (c) => {
    const r = db.prepare('SELECT berkas, berkas_nama FROM izin_umkm WHERE umkm_id = ? AND kunci = ?').get(Number(c.req.param('id')), c.req.param('kunci')) as
      | { berkas: string | null; berkas_nama: string | null }
      | undefined;
    const f = r?.berkas ? bacaBerkas(r.berkas) : null;
    if (!f) throw tidakDitemukan('Berkas');
    const nama = (r!.berkas_nama ?? 'berkas').replace(/[^\w.\- ]/g, '_');
    return c.body(new Uint8Array(f.isi), 200, { 'Content-Type': f.mime, 'Content-Disposition': `inline; filename="${nama}"`, ...HEADER_BERKAS });
  });

  app.post('/:id/seleksi', async (c) => {
    hanyaAdmin(c);
    const u = ambilUmkm(db, Number(c.req.param('id')));
    const skemaSkor = z.object(
      Object.fromEntries(KRITERIA_SELEKSI.map((k) => [k.kunci, z.coerce.number().int().min(1, `Beri nilai ${k.label.toLowerCase()}.`).max(5)])),
    );
    const d = periksa(
      z
        .object({
          keputusan: z.enum(['diterima', 'perlu_perbaikan', 'ditolak'], { error: 'Pilih keputusan seleksi.' }),
          skor: skemaSkor,
          catatan: teksOpsional,
        })
        .refine((v) => v.keputusan === 'diterima' || !!v.catatan, {
          message: 'Tuliskan catatan agar pendaftar tahu alasannya dan apa yang perlu dilakukan.',
          path: ['catatan'],
        }),
      await bacaJson(c),
    );
    if (d.keputusan === 'diterima') {
      const s = ambilPengaturan(db);
      const izin = db.prepare('SELECT kunci, status FROM izin_umkm WHERE umkm_id = ?').all(u.id) as { kunci: string; status: string }[];
      const kurang = s.instansi.filter((i) => i.wajib && izin.find((x) => x.kunci === i.kunci)?.status !== 'terverifikasi');
      if (kurang.length) {
        throw new GalatPengguna(
          409,
          `${kurang.map((k) => k.dokumen).join(' dan ')} belum terverifikasi. Verifikasi izin wajib terlebih dahulu, atau pilih "Perlu perbaikan".`,
        );
      }
    }
    db.prepare('UPDATE umkm SET status = ?, skor = ?, catatan_seleksi = ?, diputuskan = ?, diputuskan_oleh = ? WHERE id = ?').run(
      d.keputusan,
      JSON.stringify(d.skor),
      d.catatan,
      sekarang(),
      c.get('pengguna').id,
      u.id,
    );
    catatAktivitas(db, c.get('pengguna').id, 'seleksi', 'umkm', u.id, `${u.nama_usaha}: ${STATUS_UMKM[d.keputusan as StatusUmkm].toLowerCase()}`);
    return c.json({ ok: true });
  });

  return app;
}
