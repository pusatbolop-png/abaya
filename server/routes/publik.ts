import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { sekarang } from '../db';
import { config } from '../config';
import { PELAT_LANTAI } from '../defaults';
import { KATEGORI_USAHA, KECAMATAN_PASURUAN, STATUS_UMKM, type StatusUmkm } from '../../shared/konstanta';
import { normalisasiWa, tanggalWib, awalHariWib, akhirHariWib } from '../../shared/format';
import { ambilPengaturan, periksa, wajib, teksOpsional, GalatPengguna, nomorBaru, catatAktivitas, pembatasLaju, alamatKlien, bacaJson } from '../util';
import { simpanBerkas, bacaBerkas, HEADER_BERKAS, hapusBerkas } from '../berkas';

/** Lambang resmi PCC yang dibawa aplikasi; dipakai selama admin belum mengunggah logo lain. */
export const LOGO_BAWAAN = '/merek/lambang-pcc.png';

const nomorWa = z
  .string()
  .trim()
  .min(1, 'Nomor WhatsApp wajib diisi.')
  .transform(normalisasiWa)
  .refine((v) => /^628\d{7,12}$/.test(v), 'Nomor WhatsApp tidak dikenali. Tulis seperti 0812 3456 7890.');

const skemaDaftar = z.object({
  nama_usaha: wajib('Nama usaha').max(120),
  pemilik: wajib('Nama pemilik').max(120),
  whatsapp: nomorWa,
  email: z.union([z.literal(''), z.string().trim().email('Alamat email tidak valid. Contoh: nama@contoh.id')]).optional().transform((v) => v || null),
  alamat: wajib('Alamat usaha').max(300),
  kecamatan: wajib('Kecamatan').max(60),
  kategori: z.enum(KATEGORI_USAHA, { error: 'Pilih kategori usaha.' }),
  deskripsi: z.string().trim().min(20, 'Ceritakan produk Anda minimal 20 karakter.').max(1500),
  media_sosial: teksOpsional,
  bank: teksOpsional,
  no_rekening: z.string().trim().max(40).optional().transform((v) => (v ? v.replace(/[^\d]/g, '') : null)),
  atas_nama: teksOpsional,
  // Omzet rata-rata per bulan sebelum bergabung: pembanding evaluasi kenaikan omzet.
  omzet_awal: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v.replace(/[^\d]/g, '')) : null))
    .refine((v) => v === null || (Number.isSafeInteger(v) && v <= 100_000_000_000), 'Omzet per bulan tidak valid.'),
  persetujuan: z.literal('ya', { error: 'Centang pernyataan kebenaran data untuk melanjutkan.' }),
});

export function rutePublik(db: DB) {
  const app = new Hono();
  const batasDaftar = pembatasLaju(10, 60 * 60_000);
  const batasStatus = pembatasLaju(30, 10 * 60_000);

  app.get('/info', (c) => {
    const s = ambilPengaturan(db);
    const jumlahPengguna = (db.prepare('SELECT COUNT(*) AS n FROM pengguna').get() as { n: number }).n;
    return c.json({
      organisasi: s.organisasi,
      instansi: s.instansi,
      logo: s.logo ? `/api/publik/logo?v=${s.logo.slice(-16, -4)}` : LOGO_BAWAAN,
      kategori: KATEGORI_USAHA,
      kecamatan: KECAMATAN_PASURUAN,
      demo: config.demo || s.mode === 'demo',
      perluSetup: jumlahPengguna === 0,
    });
  });

  app.get('/logo', (c) => {
    const s = ambilPengaturan(db);
    const f = s.logo ? bacaBerkas(s.logo) : null;
    if (!f) throw new GalatPengguna(404, 'Logo belum diunggah.');
    return c.body(new Uint8Array(f.isi), 200, { 'Content-Type': f.mime, ...HEADER_BERKAS, 'Cache-Control': 'public, max-age=3600' });
  });

  app.post('/daftar', async (c) => {
    batasDaftar(alamatKlien(c));
    const form = await c.req.parseBody();
    const data = periksa(skemaDaftar, form);
    const { instansi } = ambilPengaturan(db);

    // Kumpulkan izin dan berkasnya. Izin wajib harus punya nomor atau berkas.
    const bidang: Record<string, string> = {};
    const izin: { kunci: string; nomor: string | null; berkas: File | null }[] = [];
    for (const i of instansi) {
      const nomor = String(form[`izin_${i.kunci}_nomor`] ?? '').trim().slice(0, 80) || null;
      const f = form[`izin_${i.kunci}_berkas`];
      const berkas = f instanceof File && f.size > 0 ? f : null;
      if (i.wajib && !nomor && !berkas) bidang[`izin_${i.kunci}_nomor`] = `${i.dokumen} wajib dilampirkan. Isi nomornya atau unggah berkasnya.`;
      izin.push({ kunci: i.kunci, nomor, berkas });
    }
    if (Object.keys(bidang).length) throw new GalatPengguna(400, 'Ada isian yang perlu diperbaiki. Periksa kolom yang ditandai.', bidang);

    const ganda = db
      .prepare("SELECT kode FROM umkm WHERE whatsapp = ? AND lower(nama_usaha) = lower(?) AND status IN ('diajukan','perlu_perbaikan','diterima')")
      .get(data.whatsapp, data.nama_usaha) as { kode: string } | undefined;
    if (ganda) {
      throw new GalatPengguna(
        409,
        `Usaha ini sudah terdaftar dengan kode ${ganda.kode}. Gunakan halaman Cek status untuk melihat perkembangannya.`,
      );
    }

    const tersimpan: { kunci: string; nomor: string | null; berkas: string | null; asli: string | null }[] = [];
    try {
      for (const i of izin) {
        const dok = instansi.find((x) => x.kunci === i.kunci)!;
        const s = i.berkas ? await simpanBerkas(i.berkas, 'izin', ['pdf', 'jpg', 'png'], dok.dokumen) : null;
        tersimpan.push({ kunci: i.kunci, nomor: i.nomor, berkas: s?.nama ?? null, asli: s?.asli ?? null });
      }
    } catch (e) {
      tersimpan.forEach((t) => hapusBerkas(t.berkas));
      throw e;
    }

    const kode = db.transaction(() => {
      const kode = nomorBaru(db, 'UMKM', false);
      const r = db
        .prepare(
          `INSERT INTO umkm (kode, nama_usaha, pemilik, whatsapp, email, alamat, kecamatan, kategori, deskripsi, media_sosial, bank, no_rekening, atas_nama, omzet_awal, dibuat)
           VALUES (@kode, @nama_usaha, @pemilik, @whatsapp, @email, @alamat, @kecamatan, @kategori, @deskripsi, @media_sosial, @bank, @no_rekening, @atas_nama, @omzet_awal, @dibuat)`,
        )
        .run({ ...data, kode, dibuat: sekarang() });
      const id = Number(r.lastInsertRowid);
      const ins = db.prepare('INSERT INTO izin_umkm (umkm_id, kunci, nomor, berkas, berkas_nama, status) VALUES (?, ?, ?, ?, ?, ?)');
      for (const t of tersimpan) ins.run(id, t.kunci, t.nomor, t.berkas, t.asli, t.nomor || t.berkas ? 'diunggah' : 'belum_ada');
      catatAktivitas(db, null, 'daftar', 'umkm', id, `${data.nama_usaha} mendaftar lewat formulir publik`);
      return kode;
    })();
    return c.json({ kode }, 201);
  });

  app.post('/status', async (c) => {
    batasStatus(alamatKlien(c));
    const d = periksa(z.object({ kode: wajib('Kode pendaftaran').transform((v) => v.toUpperCase()), whatsapp: nomorWa }), await bacaJson(c));
    const u = db.prepare('SELECT nama_usaha, status, catatan_seleksi, dibuat, diputuskan FROM umkm WHERE kode = ? AND whatsapp = ?').get(d.kode, d.whatsapp) as
      | { nama_usaha: string; status: StatusUmkm; catatan_seleksi: string | null; dibuat: string; diputuskan: string | null }
      | undefined;
    if (!u) {
      throw new GalatPengguna(404, 'Pendaftaran tidak ditemukan. Pastikan kode dan nomor WhatsApp sama persis dengan yang dipakai saat mendaftar.');
    }
    return c.json({
      namaUsaha: u.nama_usaha,
      status: u.status,
      label: STATUS_UMKM[u.status],
      catatan: u.status === 'diajukan' ? null : u.catatan_seleksi,
      dibuat: u.dibuat,
      diputuskan: u.diputuskan,
    });
  });

  // Data gedung untuk tur publik: hanya ruangan dan sesi hari ini, tanpa data penjualan.
  app.get('/gedung', (c) => c.json(dataGedung(db)));

  return app;
}

export function dataGedung(db: DB) {
  const hari = tanggalWib();
  const ruangan = db
    .prepare('SELECT id, kode, nama, jenis, lantai, x, z, lebar, panjang, kapasitas, sisi_pintu AS sisiPintu, staf FROM ruangan ORDER BY lantai, urutan')
    .all()
    .map((r) => ({ ...(r as object), staf: JSON.parse((r as { staf: string }).staf) }));
  const sesi = db
    .prepare(
      `SELECT id, ruangan_id AS ruanganId, judul, platform, host, jadwal_mulai AS jadwalMulai, jadwal_selesai AS jadwalSelesai, status, mulai
       FROM sesi_live WHERE status != 'batal' AND ((jadwal_mulai >= ? AND jadwal_mulai < ?) OR status = 'berlangsung')
       ORDER BY jadwal_mulai`,
    )
    .all(awalHariWib(hari), akhirHariWib(hari));
  return { ruangan, sesi, denah: PELAT_LANTAI, diperbarui: sekarang() };
}
