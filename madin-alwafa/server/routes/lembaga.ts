// Syahriah, pengumuman, pengaturan, akun pengurus, ringkasan dasbor, dan riwayat aktivitas.
import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { hanyaAdmin, hapusSemuaSesi, hashSandi, pelaku, type VarPengurus } from '../auth';
import {
  GalatPengguna,
  ambilPengaturan,
  bacaIsi,
  bobotNilai,
  buatSandiAwal,
  catatLog,
  idParam,
  satu,
  semua,
  sekarang,
  simpanPengaturan,
  tanggal,
  teksOpsional,
  teksWajib,
} from '../util';
import { ambilPeriode } from '../domain/raport';
import { uraiAturan } from '../domain/kartu';
import { bulanIni, bulanTahunAjaran, hariIni, namaBulan } from '../../shared/format';

export function ruteSyahriah(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();
  r.use('*', async (c, next) => {
    hanyaAdmin(c);
    await next();
  });

  r.get('/', (c) => {
    const kelasId = Number(c.req.query('kelas'));
    const kelas = satu<{ id: number; nama: string }>(db, 'SELECT id, nama FROM kelas WHERE id = ?', kelasId);
    if (!kelas) throw new GalatPengguna(404, 'Pilih kelas terlebih dahulu.');
    const tahunAjaran = c.req.query('tahunAjaran') ?? ambilPeriode(db).tahun_ajaran;
    if (!/^\d{4}\/\d{4}$/.test(tahunAjaran)) throw new GalatPengguna(400, 'Tahun ajaran tidak valid.');
    const bulan = bulanTahunAjaran(tahunAjaran);
    const santri = semua<{ id: number; nis: string; nama: string; jk: string; hp_wali: string | null; foto_versi: string | null }>(
      db,
      "SELECT id, nis, nama, jk, hp_wali, foto_versi FROM santri WHERE kelas_id = ? AND status = 'aktif' ORDER BY nama",
      kelas.id,
    );
    const bayar = semua<{ id: number; santri_id: number; bulan: string; nominal: number; tanggal_bayar: string; metode: string; catatan: string | null }>(
      db,
      `SELECT y.id, y.santri_id, y.bulan, y.nominal, y.tanggal_bayar, y.metode, y.catatan FROM syahriah y JOIN santri s ON s.id = y.santri_id
        WHERE s.kelas_id = ? AND y.bulan IN (${bulan.map(() => '?').join(',')})`,
      kelas.id,
      ...bulan,
    );
    const daftar = santri.map((s) => ({
      santriId: s.id,
      nis: s.nis,
      nama: s.nama,
      jk: s.jk,
      fotoVersi: s.foto_versi,
      hp: s.hp_wali,
      bayar: Object.fromEntries(
        bayar.filter((b) => b.santri_id === s.id).map((b) => [b.bulan, { id: b.id, nominal: b.nominal, tanggal: b.tanggal_bayar, metode: b.metode, catatan: b.catatan }]),
      ),
    }));
    const total = bayar.reduce((t, b) => t + b.nominal, 0);
    return c.json({ kelas, tahunAjaran, bulan, bulanIni: bulanIni(), nominal: Number(ambilPengaturan(db).syahriah_nominal) || 0, daftar, total });
  });

  r.post('/', async (c) => {
    const isi = await bacaIsi(
      c,
      z.object({
        santriId: z.number().int().positive(),
        bulan: z.array(z.string().regex(/^\d{4}-\d{2}$/)).min(1, 'Pilih bulan yang dibayar.').max(12),
        nominal: z.number({ error: 'Nominal wajib diisi.' }).int().min(0, 'Nominal tidak boleh minus.').max(100_000_000),
        tanggalBayar: tanggal('Tanggal bayar'),
        metode: z.enum(['tunai', 'transfer', 'lainnya']),
        catatan: teksOpsional(200),
      }),
    );
    const s = satu<{ nama: string }>(db, 'SELECT nama FROM santri WHERE id = ?', isi.santriId);
    if (!s) throw new GalatPengguna(404, 'Santri tidak ditemukan.');
    db.transaction(() => {
      for (const b of isi.bulan) {
        if (satu(db, 'SELECT 1 FROM syahriah WHERE santri_id = ? AND bulan = ?', isi.santriId, b)) {
          throw new GalatPengguna(409, `Syahriah ${namaBulan(b)} untuk ${s.nama} sudah tercatat.`);
        }
        db.prepare('INSERT INTO syahriah (santri_id, bulan, nominal, tanggal_bayar, metode, catatan, dicatat_oleh, dibuat) VALUES (?,?,?,?,?,?,?,?)').run(
          isi.santriId,
          b,
          isi.nominal,
          isi.tanggalBayar,
          isi.metode,
          isi.catatan,
          c.get('pengurus').id,
          sekarang(),
        );
      }
    })();
    catatLog(db, pelaku(c), 'Mencatat syahriah', `${s.nama}: ${isi.bulan.map(namaBulan).join(', ')}`);
    return c.json({ ok: true });
  });

  r.delete('/:id', (c) => {
    const id = idParam(c);
    const y = satu<{ bulan: string; nama: string }>(db, 'SELECT y.bulan, s.nama FROM syahriah y JOIN santri s ON s.id = y.santri_id WHERE y.id = ?', id);
    if (!y) throw new GalatPengguna(404, 'Catatan pembayaran tidak ditemukan.');
    db.prepare('DELETE FROM syahriah WHERE id = ?').run(id);
    catatLog(db, pelaku(c), 'Membatalkan catatan syahriah', `${y.nama}: ${namaBulan(y.bulan)}`);
    return c.json({ ok: true });
  });

  return r;
}

const skemaPengumuman = z.object({
  judul: teksWajib('Judul', 120),
  isi: teksWajib('Isi pengumuman', 3000),
  sasaran: z.string().regex(/^(semua|putra|putri|kelas:\d+)$/, 'Sasaran tidak valid.'),
  penting: z.boolean().default(false),
});

export function rutePengumuman(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();

  r.get('/', (c) =>
    c.json({
      daftar: semua(
        db,
        `SELECT p.id, p.judul, p.isi, p.sasaran, p.penting, p.terbit, g.nama AS penulis,
                CASE WHEN p.sasaran LIKE 'kelas:%' THEN (SELECT nama FROM kelas WHERE id = CAST(substr(p.sasaran, 7) AS INTEGER)) END AS kelas
           FROM pengumuman p LEFT JOIN pengurus g ON g.id = p.dibuat_oleh ORDER BY p.terbit DESC LIMIT 100`,
      ),
    }),
  );

  r.post('/', async (c) => {
    hanyaAdmin(c);
    const isi = await bacaIsi(c, skemaPengumuman);
    const id = Number(
      db
        .prepare('INSERT INTO pengumuman (judul, isi, sasaran, penting, terbit, dibuat_oleh) VALUES (?,?,?,?,?,?)')
        .run(isi.judul, isi.isi, isi.sasaran, isi.penting ? 1 : 0, sekarang(), c.get('pengurus').id).lastInsertRowid,
    );
    catatLog(db, pelaku(c), 'Menerbitkan pengumuman', isi.judul);
    return c.json({ id });
  });

  r.put('/:id', async (c) => {
    hanyaAdmin(c);
    const id = idParam(c);
    const isi = await bacaIsi(c, skemaPengumuman);
    if (!satu(db, 'SELECT 1 FROM pengumuman WHERE id = ?', id)) throw new GalatPengguna(404, 'Pengumuman tidak ditemukan.');
    db.prepare('UPDATE pengumuman SET judul=?, isi=?, sasaran=?, penting=? WHERE id=?').run(isi.judul, isi.isi, isi.sasaran, isi.penting ? 1 : 0, id);
    catatLog(db, pelaku(c), 'Mengubah pengumuman', isi.judul);
    return c.json({ ok: true });
  });

  r.delete('/:id', (c) => {
    hanyaAdmin(c);
    const id = idParam(c);
    const p = satu<{ judul: string }>(db, 'SELECT judul FROM pengumuman WHERE id = ?', id);
    if (!p) throw new GalatPengguna(404, 'Pengumuman tidak ditemukan.');
    db.prepare('DELETE FROM pengumuman WHERE id = ?').run(id);
    catatLog(db, pelaku(c), 'Menghapus pengumuman', p.judul);
    return c.json({ ok: true });
  });

  return r;
}

const angkaBobot = z.number().int().min(0, 'Bobot 0–100.').max(100, 'Bobot 0–100.');

export function rutePengaturan(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();

  r.get('/', (c) => {
    const p = ambilPengaturan(db);
    const lengkapi: { kunci: string; label: string }[] = [];
    if (!p.alamat) lengkapi.push({ kunci: 'alamat', label: 'Alamat madrasah (tampil di kop raport)' });
    if (!p.kota) lengkapi.push({ kunci: 'kota', label: 'Kota tempat raport ditandatangani' });
    if (!p.kepala) lengkapi.push({ kunci: 'kepala', label: 'Nama kepala madrasah (tanda tangan raport)' });
    if (!satu(db, 'SELECT 1 FROM periode')) lengkapi.push({ kunci: 'periode', label: 'Tahun ajaran dan semester' });
    if (!satu(db, 'SELECT 1 FROM kelas')) lengkapi.push({ kunci: 'kelas', label: 'Daftar kelas' });
    return c.json({
      pengaturan: {
        namaLembaga: p.nama_lembaga,
        namaArab: p.nama_arab,
        singkatan: p.singkatan,
        naungan: p.naungan,
        slogan: p.slogan,
        alamat: p.alamat,
        kota: p.kota,
        telepon: p.telepon,
        kepala: p.kepala,
        bobot: bobotNilai(p),
        syahriahNominal: Number(p.syahriah_nominal) || 0,
        tampilPeringkat: p.tampil_peringkat === '1',
        tataTertib: p.tata_tertib,
        kartuBerlaku: p.kartu_berlaku,
      },
      lengkapi,
    });
  });

  // Isi sisi belakang kartu santri.
  r.put('/kartu', async (c) => {
    hanyaAdmin(c);
    const isi = await bacaIsi(
      c,
      z.object({
        tataTertib: teksWajib('Tata tertib', 3000).refine((t) => uraiAturan(t).length > 0, 'Tulis paling sedikit satu butir tata tertib.'),
        kartuBerlaku: teksWajib('Masa berlaku', 80),
      }),
    );
    simpanPengaturan(db, { tata_tertib: isi.tataTertib, kartu_berlaku: isi.kartuBerlaku });
    catatLog(db, pelaku(c), 'Mengubah tata tertib kartu santri');
    return c.json({ ok: true, aturan: uraiAturan(isi.tataTertib) });
  });

  r.put('/', async (c) => {
    hanyaAdmin(c);
    const isi = await bacaIsi(
      c,
      z.object({
        namaLembaga: teksWajib('Nama madrasah', 120),
        namaArab: teksOpsional(120),
        singkatan: teksWajib('Nama singkat', 40),
        naungan: teksOpsional(120),
        slogan: teksOpsional(160),
        alamat: teksOpsional(300),
        kota: teksOpsional(60),
        telepon: teksOpsional(30),
        kepala: teksOpsional(100),
        bobot: z.object({ harian: angkaBobot, uts: angkaBobot, uas: angkaBobot }).refine((b) => b.harian + b.uts + b.uas === 100, 'Jumlah bobot harus 100.'),
        syahriahNominal: z.number().int().min(0).max(100_000_000),
        tampilPeringkat: z.boolean(),
      }),
    );
    simpanPengaturan(db, {
      nama_lembaga: isi.namaLembaga,
      nama_arab: isi.namaArab ?? '',
      singkatan: isi.singkatan,
      naungan: isi.naungan ?? '',
      slogan: isi.slogan ?? '',
      alamat: isi.alamat ?? '',
      kota: isi.kota ?? '',
      telepon: isi.telepon ?? '',
      kepala: isi.kepala ?? '',
      bobot_harian: String(isi.bobot.harian),
      bobot_uts: String(isi.bobot.uts),
      bobot_uas: String(isi.bobot.uas),
      syahriah_nominal: String(isi.syahriahNominal),
      tampil_peringkat: isi.tampilPeringkat ? '1' : '0',
    });
    catatLog(db, pelaku(c), 'Mengubah pengaturan madrasah');
    return c.json({ ok: true });
  });

  return r;
}

export function rutePengurus(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();
  r.use('*', async (c, next) => {
    hanyaAdmin(c);
    await next();
  });

  r.get('/', (c) =>
    c.json({
      daftar: semua(db, 'SELECT id, nama, username, peran, hp, aktif, masuk_terakhir AS masukTerakhir FROM pengurus ORDER BY aktif DESC, peran, nama'),
    }),
  );

  const skema = z.object({
    nama: teksWajib('Nama', 100),
    username: teksWajib('Nama pengguna', 40).regex(/^[a-z0-9._-]+$/i, 'Nama pengguna hanya huruf, angka, titik, garis bawah, atau tanda hubung.'),
    peran: z.enum(['admin', 'ustadz'], { error: 'Pilih peran.' }),
    hp: teksOpsional(20),
    aktif: z.boolean().default(true),
  });

  r.post('/', async (c) => {
    const isi = await bacaIsi(c, skema);
    if (satu(db, 'SELECT 1 FROM pengurus WHERE username = ?', isi.username)) throw new GalatPengguna(409, 'Nama pengguna sudah dipakai.', { username: 'Sudah dipakai.' });
    const sandi = buatSandiAwal();
    const id = Number(
      db
        .prepare('INSERT INTO pengurus (nama, username, sandi, peran, hp, aktif, dibuat) VALUES (?,?,?,?,?,?,?)')
        .run(isi.nama, isi.username.toLowerCase(), await hashSandi(sandi), isi.peran, isi.hp, isi.aktif ? 1 : 0, sekarang()).lastInsertRowid,
    );
    catatLog(db, pelaku(c), 'Menambah akun pengurus', `${isi.nama} (${isi.peran})`);
    return c.json({ id, username: isi.username.toLowerCase(), sandi });
  });

  r.put('/:id', async (c) => {
    const id = idParam(c);
    const isi = await bacaIsi(c, skema);
    if (!satu(db, 'SELECT 1 FROM pengurus WHERE id = ?', id)) throw new GalatPengguna(404, 'Akun tidak ditemukan.');
    if (satu(db, 'SELECT 1 FROM pengurus WHERE username = ? AND id != ?', isi.username, id)) throw new GalatPengguna(409, 'Nama pengguna sudah dipakai.', { username: 'Sudah dipakai.' });
    if (id === c.get('pengurus').id && (!isi.aktif || isi.peran !== 'admin')) {
      throw new GalatPengguna(400, 'Anda tidak bisa menonaktifkan atau menurunkan peran akun Anda sendiri.');
    }
    db.transaction(() => {
      db.prepare('UPDATE pengurus SET nama=?, username=?, peran=?, hp=?, aktif=? WHERE id=?').run(isi.nama, isi.username.toLowerCase(), isi.peran, isi.hp, isi.aktif ? 1 : 0, id);
      if (!satu(db, "SELECT 1 FROM pengurus WHERE peran = 'admin' AND aktif = 1")) throw new GalatPengguna(400, 'Harus ada paling sedikit satu administrator aktif.');
    })();
    if (!isi.aktif) hapusSemuaSesi(db, 'pengurus', id);
    catatLog(db, pelaku(c), 'Mengubah akun pengurus', isi.nama);
    return c.json({ ok: true });
  });

  r.post('/:id/sandi', async (c) => {
    const id = idParam(c);
    const p = satu<{ nama: string; username: string }>(db, 'SELECT nama, username FROM pengurus WHERE id = ?', id);
    if (!p) throw new GalatPengguna(404, 'Akun tidak ditemukan.');
    if (id === c.get('pengurus').id) throw new GalatPengguna(400, 'Ganti sandi Anda sendiri lewat menu Akun saya.');
    const sandi = buatSandiAwal();
    db.prepare('UPDATE pengurus SET sandi = ? WHERE id = ?').run(await hashSandi(sandi), id);
    hapusSemuaSesi(db, 'pengurus', id);
    catatLog(db, pelaku(c), 'Membuat sandi baru pengurus', p.nama);
    return c.json({ username: p.username, sandi });
  });

  return r;
}

export function ruteRingkasan(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();

  r.get('/', (c) => {
    const hari = hariIni();
    const santri = satu<{ total: number; putra: number; putri: number }>(
      db,
      "SELECT COUNT(*) AS total, SUM(jk = 'L') AS putra, SUM(jk = 'P') AS putri FROM santri WHERE status = 'aktif'",
    )!;
    const periodeAda = satu<{ id: number }>(db, 'SELECT id FROM periode WHERE aktif = 1') ?? satu<{ id: number }>(db, 'SELECT id FROM periode ORDER BY mulai DESC LIMIT 1');
    const periode = periodeAda ? ambilPeriode(db, periodeAda.id) : null;

    const absenHariIni = semua<{ kelasId: number; kelas: string; bagian: string; santri: number; tercatat: number; hadir: number; izin: number; sakit: number; alpa: number }>(
      db,
      `SELECT k.id AS kelasId, k.nama AS kelas, k.bagian,
              (SELECT COUNT(*) FROM santri s WHERE s.kelas_id = k.id AND s.status = 'aktif') AS santri,
              COUNT(a.santri_id) AS tercatat, SUM(a.status = 'H') AS hadir, SUM(a.status = 'I') AS izin, SUM(a.status = 'S') AS sakit, SUM(a.status = 'A') AS alpa
         FROM kelas k LEFT JOIN absensi a ON a.kelas_id = k.id AND a.tanggal = ?
        WHERE k.aktif = 1 GROUP BY k.id ORDER BY k.tingkat, k.nama`,
      hari,
    ).map((k) => ({ ...k, hadir: k.hadir ?? 0, izin: k.izin ?? 0, sakit: k.sakit ?? 0, alpa: k.alpa ?? 0 }));

    // Tren kehadiran 14 hari terakhir yang ada absensinya.
    const tren = semua<{ tanggal: string; hadir: number; total: number }>(
      db,
      `SELECT tanggal, SUM(status = 'H') AS hadir, COUNT(*) AS total FROM absensi
        WHERE tanggal <= ? GROUP BY tanggal ORDER BY tanggal DESC LIMIT 14`,
      hari,
    ).reverse();

    let nilai = null;
    let raport = null;
    if (periode) {
      const bobot = bobotNilai(ambilPengaturan(db));
      const wajib = (['harian', 'uts', 'uas'] as const).filter((k) => bobot[k] > 0);
      const syarat = wajib.map((k) => `n.${k} IS NOT NULL`).join(' AND ') || '1';
      const hitung = satu<{ harus: number; harian: number; uts: number; uas: number; lengkap: number }>(
        db,
        `SELECT COUNT(*) AS harus, COUNT(n.harian) AS harian, COUNT(n.uts) AS uts, COUNT(n.uas) AS uas,
                SUM(CASE WHEN ${syarat} THEN 1 ELSE 0 END) AS lengkap
           FROM santri s JOIN kelas_mapel km ON km.kelas_id = s.kelas_id
           LEFT JOIN nilai n ON n.santri_id = s.id AND n.mapel_id = km.mapel_id AND n.periode_id = ?
          WHERE s.status = 'aktif'`,
        periode.id,
      )!;
      nilai = { harus: hitung.harus, harian: hitung.harian, uts: hitung.uts, uas: hitung.uas, lengkap: hitung.lengkap ?? 0, bobot };
      const r = satu<{ terbit: number; dibaca: number }>(
        db,
        "SELECT SUM(status = 'terbit') AS terbit, SUM(status = 'terbit' AND dibaca_wali IS NOT NULL) AS dibaca FROM raport WHERE periode_id = ?",
        periode.id,
      )!;
      raport = { terbit: r.terbit ?? 0, dibaca: r.dibaca ?? 0, santri: santri.total };
    }

    const bulan = bulanIni();
    const syahriah = satu<{ jumlah: number; total: number }>(db, 'SELECT COUNT(*) AS jumlah, COALESCE(SUM(nominal), 0) AS total FROM syahriah WHERE bulan = ?', bulan)!;
    const hafalanPekan = satu<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM hafalan WHERE tanggal > ?', new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10))!.n;
    const akunWali = satu<{ aktif: number; total: number }>(
      db,
      "SELECT SUM(masuk_terakhir IS NOT NULL) AS aktif, COUNT(*) AS total FROM santri WHERE status = 'aktif'",
    )!;

    return c.json({
      hariIni: hari,
      santri: { total: santri.total, putra: santri.putra ?? 0, putri: santri.putri ?? 0 },
      kelas: absenHariIni.length,
      periode: periode && { id: periode.id, tahunAjaran: periode.tahun_ajaran, semester: periode.semester, mulai: periode.mulai, selesai: periode.selesai },
      absenHariIni,
      tren,
      nilai,
      raport,
      syahriah: { bulan, jumlah: syahriah.jumlah, total: syahriah.total },
      hafalanPekan,
      akunWali: { aktif: akunWali.aktif ?? 0, total: akunWali.total },
      aktivitas: semua(db, 'SELECT waktu, pelaku, aksi, detail FROM log_aktivitas ORDER BY id DESC LIMIT 8'),
    });
  });

  return r;
}

export function ruteLog(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();
  r.get('/', (c) => {
    hanyaAdmin(c);
    return c.json({ daftar: semua(db, 'SELECT id, waktu, pelaku, aksi, detail FROM log_aktivitas ORDER BY id DESC LIMIT 300') });
  });
  return r;
}
