import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { hanyaAdmin, hapusSemuaSesi, hashSandi, pelaku, type VarPengurus } from '../auth';
import {
  GalatPengguna,
  ambilPengaturan,
  bacaIsi,
  buatSandiAwal,
  catatLog,
  idParam,
  lembaga,
  satu,
  semua,
  sekarang,
  skemaAlamat,
  tanggalOpsional,
  teksOpsional,
  teksWajib,
} from '../util';
import { hapusFoto, simpanFoto } from '../domain/foto';
import { dataKartu } from '../domain/kartu';
import { ambilPeriode, rekapKehadiran } from '../domain/raport';
import { bulanTahunAjaran, hariIni } from '../../shared/format';

const skemaSantri = z.object({
  nis: z
    .string()
    .trim()
    .max(30, 'NIS paling banyak 30 karakter.')
    .regex(/^[A-Za-z0-9./-]*$/, 'NIS hanya boleh berisi huruf, angka, titik, garis miring, atau tanda hubung.')
    .default(''),
  nama: teksWajib('Nama santri', 120),
  jk: z.enum(['L', 'P'], { error: 'Pilih santri putra atau santriwati.' }),
  tempatLahir: teksOpsional(80),
  tanggalLahir: tanggalOpsional(),
  ...skemaAlamat,
  namaAyah: teksOpsional(120),
  namaIbu: teksOpsional(120),
  namaWali: teksOpsional(120),
  hpWali: teksOpsional(20).refine((v) => v === null || /^[0-9+\-\s]{8,20}$/.test(v), 'Nomor HP tidak valid.'),
  kelasId: z.number().int().positive().nullable().default(null),
  status: z.enum(['aktif', 'lulus', 'pindah', 'keluar']).default('aktif'),
  tanggalMasuk: tanggalOpsional(),
});

export interface SantriBaris {
  id: number;
  nis: string;
  nama: string;
  jk: 'L' | 'P';
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  alamat: string | null;
  nama_ayah: string | null;
  nama_ibu: string | null;
  nama_wali: string | null;
  hp_wali: string | null;
  kelas_id: number | null;
  status: string;
  tanggal_masuk: string | null;
  sandi_diganti: number;
  masuk_terakhir: string | null;
  dibuat: string;
  desa: string | null;
  kecamatan: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  kode_wilayah: string | null;
  foto_versi: string | null;
  daftar_mandiri: string | null;
}

export const keSantri = (s: SantriBaris & { kelas_nama?: string | null }) => ({
  id: s.id,
  nis: s.nis,
  nama: s.nama,
  jk: s.jk,
  tempatLahir: s.tempat_lahir,
  tanggalLahir: s.tanggal_lahir,
  alamat: s.alamat,
  desa: s.desa,
  kecamatan: s.kecamatan,
  kabupaten: s.kabupaten,
  provinsi: s.provinsi,
  kodeWilayah: s.kode_wilayah,
  fotoVersi: s.foto_versi,
  daftarMandiri: s.daftar_mandiri,
  namaAyah: s.nama_ayah,
  namaIbu: s.nama_ibu,
  namaWali: s.nama_wali,
  hpWali: s.hp_wali,
  kelasId: s.kelas_id,
  kelasNama: s.kelas_nama ?? null,
  status: s.status,
  tanggalMasuk: s.tanggal_masuk,
  sandiDiganti: !!s.sandi_diganti,
  masukTerakhir: s.masuk_terakhir,
});

/** NIS otomatis: dua digit tahun masuk + empat digit urut, mis. 260017. */
function nisOtomatis(db: DB, tanggalMasuk: string | null) {
  const yy = (tanggalMasuk ?? hariIni()).slice(2, 4);
  const terakhir = satu<{ nis: string }>(db, "SELECT nis FROM santri WHERE nis GLOB ? ORDER BY nis DESC LIMIT 1", `${yy}[0-9][0-9][0-9][0-9]`);
  const urut = terakhir ? Number(terakhir.nis.slice(2)) + 1 : 1;
  return `${yy}${String(urut).padStart(4, '0')}`;
}

function pesanAkun(db: DB, nama: string, nis: string, sandi: string, alamatAplikasi: string) {
  const l = lembaga(ambilPengaturan(db));
  return (
    `Assalamu'alaikum warahmatullahi wabarakatuh.\n\n` +
    `Berikut akun wali santri ${l.nama} untuk ananda *${nama}*:\n` +
    `• NIS: *${nis}*\n• Sandi: *${sandi}*\n\n` +
    `Masuk di ${alamatAplikasi} untuk melihat raport, kehadiran, hafalan, dan syahriah. ` +
    `Mohon segera ganti sandi setelah masuk, dan jangan bagikan sandi kepada orang lain.\n\nJazakumullahu khairan.`
  );
}

function pastikanKelas(db: DB, kelasId: number | null) {
  if (kelasId && !satu(db, 'SELECT 1 FROM kelas WHERE id = ?', kelasId)) throw new GalatPengguna(400, 'Kelas tidak ditemukan.', { kelasId: 'Kelas tidak ditemukan.' });
}

export function ruteSantri(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();
  const asal = (c: { req: { header: (n: string) => string | undefined; url: string } }) => c.req.header('origin') ?? new URL(c.req.url).origin;

  r.get('/', (c) => {
    const q = (c.req.query('q') ?? '').trim();
    const kelas = c.req.query('kelas');
    const jk = c.req.query('jk');
    const status = c.req.query('status') ?? 'aktif';
    const syarat: string[] = [];
    const param: unknown[] = [];
    if (q) {
      syarat.push('(s.nama LIKE ? OR s.nis LIKE ? OR s.nama_wali LIKE ? OR s.nama_ayah LIKE ?)');
      param.push(`%${q}%`, `${q}%`, `%${q}%`, `%${q}%`);
    }
    if (kelas === 'tanpa') syarat.push('s.kelas_id IS NULL');
    else if (kelas) {
      syarat.push('s.kelas_id = ?');
      param.push(Number(kelas));
    }
    if (jk === 'L' || jk === 'P') {
      syarat.push('s.jk = ?');
      param.push(jk);
    }
    if (status !== 'semua') {
      syarat.push('s.status = ?');
      param.push(status);
    }
    const daftar = semua<SantriBaris & { kelas_nama: string | null }>(
      db,
      `SELECT s.*, k.nama AS kelas_nama FROM santri s LEFT JOIN kelas k ON k.id = s.kelas_id
        ${syarat.length ? 'WHERE ' + syarat.join(' AND ') : ''}
        ORDER BY k.tingkat IS NULL, k.tingkat, k.nama, s.nama LIMIT 1000`,
      ...param,
    ).map(keSantri);
    const hitung = satu<{ total: number; putra: number; putri: number }>(
      db,
      "SELECT COUNT(*) AS total, SUM(jk = 'L') AS putra, SUM(jk = 'P') AS putri FROM santri WHERE status = 'aktif'",
    )!;
    return c.json({ daftar, hitung: { total: hitung.total, putra: hitung.putra ?? 0, putri: hitung.putri ?? 0 } });
  });

  r.post('/', async (c) => {
    hanyaAdmin(c);
    const isi = await bacaIsi(c, skemaSantri);
    pastikanKelas(db, isi.kelasId);
    const nis = isi.nis || nisOtomatis(db, isi.tanggalMasuk);
    if (satu(db, 'SELECT 1 FROM santri WHERE nis = ?', nis)) {
      throw new GalatPengguna(409, `NIS ${nis} sudah dipakai santri lain.`, { nis: 'NIS sudah dipakai.' });
    }
    const sandi = buatSandiAwal();
    const id = Number(
      db
        .prepare(
          `INSERT INTO santri (nis, nama, jk, tempat_lahir, tanggal_lahir, alamat, desa, kecamatan, kabupaten, provinsi, kode_wilayah,
             nama_ayah, nama_ibu, nama_wali, hp_wali, kelas_id, status, tanggal_masuk, sandi, dibuat) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          nis,
          isi.nama,
          isi.jk,
          isi.tempatLahir,
          isi.tanggalLahir,
          isi.alamat,
          isi.desa,
          isi.kecamatan,
          isi.kabupaten,
          isi.provinsi,
          isi.kodeWilayah,
          isi.namaAyah,
          isi.namaIbu,
          isi.namaWali,
          isi.hpWali,
          isi.kelasId,
          isi.status,
          isi.tanggalMasuk ?? hariIni(),
          await hashSandi(sandi),
          sekarang(),
        ).lastInsertRowid,
    );
    catatLog(db, pelaku(c), 'Menambah santri', `${isi.nama} (${nis})`);
    return c.json({ id, nis, sandi, pesan: pesanAkun(db, isi.nama, nis, sandi, asal(c)), hp: isi.hpWali });
  });

  r.get('/:id', (c) => {
    const id = idParam(c);
    const s = satu<SantriBaris & { kelas_nama: string | null; wali_kelas: string | null }>(
      db,
      'SELECT s.*, k.nama AS kelas_nama, k.wali_kelas FROM santri s LEFT JOIN kelas k ON k.id = s.kelas_id WHERE s.id = ?',
      id,
    );
    if (!s) throw new GalatPengguna(404, 'Santri tidak ditemukan.');
    const periodeAktif = satu<{ id: number }>(db, 'SELECT id FROM periode WHERE aktif = 1');
    const periode = periodeAktif ? ambilPeriode(db, periodeAktif.id) : null;
    const raport = semua<{ periode_id: number; tahun_ajaran: string; semester: number; status: string; kode: string | null; diterbitkan: string | null; dibaca_wali: string | null }>(
      db,
      `SELECT p.id AS periode_id, p.tahun_ajaran, p.semester, COALESCE(r.status, 'draf') AS status, r.kode, r.diterbitkan, r.dibaca_wali
         FROM periode p LEFT JOIN raport r ON r.periode_id = p.id AND r.santri_id = ?
        WHERE p.mulai <= ? ORDER BY p.mulai DESC`,
      id,
      hariIni(),
    );
    const hafalan = semua(db, 'SELECT id, tanggal, jenis, materi, predikat, catatan, penyimak FROM hafalan WHERE santri_id = ? ORDER BY tanggal DESC, id DESC LIMIT 10', id);
    let syahriah = null;
    if (periode) {
      const bulan = bulanTahunAjaran(periode.tahun_ajaran);
      const bayar = semua<{ bulan: string; nominal: number; tanggal_bayar: string }>(
        db,
        `SELECT bulan, nominal, tanggal_bayar FROM syahriah WHERE santri_id = ? AND bulan IN (${bulan.map(() => '?').join(',')})`,
        id,
        ...bulan,
      );
      syahriah = { tahunAjaran: periode.tahun_ajaran, bulan: bulan.map((b) => ({ bulan: b, bayar: bayar.find((x) => x.bulan === b) ?? null })) };
    }
    return c.json({
      santri: { ...keSantri(s), waliKelas: s.wali_kelas },
      periode: periode && { id: periode.id, tahunAjaran: periode.tahun_ajaran, semester: periode.semester },
      kehadiran: periode ? rekapKehadiran(db, id, periode.mulai, periode.selesai) : null,
      raport,
      hafalan,
      syahriah,
    });
  });

  r.put('/:id', async (c) => {
    hanyaAdmin(c);
    const id = idParam(c);
    const isi = await bacaIsi(c, skemaSantri);
    pastikanKelas(db, isi.kelasId);
    const lama = satu<SantriBaris>(db, 'SELECT * FROM santri WHERE id = ?', id);
    if (!lama) throw new GalatPengguna(404, 'Santri tidak ditemukan.');
    const nis = isi.nis || lama.nis;
    if (satu(db, 'SELECT 1 FROM santri WHERE nis = ? AND id != ?', nis, id)) {
      throw new GalatPengguna(409, `NIS ${nis} sudah dipakai santri lain.`, { nis: 'NIS sudah dipakai.' });
    }
    db.prepare(
      `UPDATE santri SET nis=?, nama=?, jk=?, tempat_lahir=?, tanggal_lahir=?, alamat=?, desa=?, kecamatan=?, kabupaten=?, provinsi=?,
         kode_wilayah=?, nama_ayah=?, nama_ibu=?, nama_wali=?, hp_wali=?, kelas_id=?, status=?, tanggal_masuk=? WHERE id = ?`,
    ).run(
      nis,
      isi.nama,
      isi.jk,
      isi.tempatLahir,
      isi.tanggalLahir,
      isi.alamat,
      isi.desa,
      isi.kecamatan,
      isi.kabupaten,
      isi.provinsi,
      isi.kodeWilayah,
      isi.namaAyah,
      isi.namaIbu,
      isi.namaWali,
      isi.hpWali,
      isi.kelasId,
      isi.status,
      isi.tanggalMasuk ?? lama.tanggal_masuk,
      id,
    );
    if (isi.status === 'keluar') hapusSemuaSesi(db, 'wali', id);
    catatLog(db, pelaku(c), 'Mengubah data santri', `${isi.nama} (${nis})`);
    return c.json({ ok: true });
  });

  r.delete('/:id', (c) => {
    hanyaAdmin(c);
    const id = idParam(c);
    const s = satu<{ nama: string; nis: string }>(db, 'SELECT nama, nis FROM santri WHERE id = ?', id);
    if (!s) throw new GalatPengguna(404, 'Santri tidak ditemukan.');
    const punyaRiwayat = ['nilai', 'absensi', 'raport', 'hafalan', 'syahriah'].some((t) => satu(db, `SELECT 1 FROM ${t} WHERE santri_id = ? LIMIT 1`, id));
    if (punyaRiwayat) {
      throw new GalatPengguna(
        409,
        `${s.nama} sudah punya riwayat absensi, nilai, hafalan, atau syahriah. Ubah statusnya menjadi Keluar atau Pindah agar riwayatnya tetap tersimpan.`,
      );
    }
    hapusSemuaSesi(db, 'wali', id);
    db.prepare('DELETE FROM santri WHERE id = ?').run(id);
    catatLog(db, pelaku(c), 'Menghapus santri', `${s.nama} (${s.nis})`);
    return c.json({ ok: true });
  });

  // Foto santri: diambil dari kamera ponsel atau galeri, sudah dipotong 3:4 dan dikompres di peramban.
  r.put('/:id/foto', async (c) => {
    const id = idParam(c);
    const s = satu<{ nama: string; nis: string }>(db, 'SELECT nama, nis FROM santri WHERE id = ?', id);
    if (!s) throw new GalatPengguna(404, 'Santri tidak ditemukan.');
    const { data } = await bacaIsi(c, z.object({ data: z.string().max(900_000, 'Ukuran foto terlalu besar.') }));
    const fotoVersi = simpanFoto(db, id, data, pelaku(c));
    catatLog(db, pelaku(c), 'Memperbarui foto santri', `${s.nama} (${s.nis})`);
    return c.json({ fotoVersi });
  });

  r.delete('/:id/foto', (c) => {
    const id = idParam(c);
    const s = satu<{ nama: string; nis: string }>(db, 'SELECT nama, nis FROM santri WHERE id = ?', id);
    if (!s) throw new GalatPengguna(404, 'Santri tidak ditemukan.');
    hapusFoto(db, id);
    catatLog(db, pelaku(c), 'Menghapus foto santri', `${s.nama} (${s.nis})`);
    return c.json({ ok: true });
  });

  r.get('/:id/kartu', (c) => c.json({ ...dataKartu(db, idParam(c)), alamatAplikasi: asal(c) }));

  // Sandi baru untuk wali santri; sesi lama di perangkat lain diakhiri.
  r.post('/:id/sandi', async (c) => {
    hanyaAdmin(c);
    const id = idParam(c);
    const s = satu<{ nama: string; nis: string; hp_wali: string | null }>(db, 'SELECT nama, nis, hp_wali FROM santri WHERE id = ?', id);
    if (!s) throw new GalatPengguna(404, 'Santri tidak ditemukan.');
    const sandi = buatSandiAwal();
    db.prepare('UPDATE santri SET sandi = ?, sandi_diganti = 0 WHERE id = ?').run(await hashSandi(sandi), id);
    hapusSemuaSesi(db, 'wali', id);
    catatLog(db, pelaku(c), 'Membuat sandi baru wali santri', `${s.nama} (${s.nis})`);
    return c.json({ nis: s.nis, sandi, hp: s.hp_wali, pesan: pesanAkun(db, s.nama, s.nis, sandi, asal(c)) });
  });

  // Kartu akun satu kelas: sandi baru untuk santri yang belum pernah mengganti sandinya.
  r.post('/kartu-akun', async (c) => {
    hanyaAdmin(c);
    const { kelasId } = await bacaIsi(c, z.object({ kelasId: z.number().int().positive() }));
    const kelas = satu<{ nama: string }>(db, 'SELECT nama FROM kelas WHERE id = ?', kelasId);
    if (!kelas) throw new GalatPengguna(404, 'Kelas tidak ditemukan.');
    const daftar = semua<{ id: number; nama: string; nis: string; jk: string; hp_wali: string | null }>(
      db,
      "SELECT id, nama, nis, jk, hp_wali FROM santri WHERE kelas_id = ? AND status = 'aktif' AND sandi_diganti = 0 ORDER BY nama",
      kelasId,
    );
    const hasil = [];
    for (const s of daftar) {
      const sandi = buatSandiAwal();
      db.prepare('UPDATE santri SET sandi = ? WHERE id = ?').run(await hashSandi(sandi), s.id);
      hapusSemuaSesi(db, 'wali', s.id);
      hasil.push({ id: s.id, nama: s.nama, nis: s.nis, jk: s.jk, sandi, hp: s.hp_wali, pesan: pesanAkun(db, s.nama, s.nis, sandi, asal(c)) });
    }
    const dilewati = (satu<{ n: number }>(db, "SELECT COUNT(*) AS n FROM santri WHERE kelas_id = ? AND status = 'aktif' AND sandi_diganti = 1", kelasId)?.n ?? 0);
    catatLog(db, pelaku(c), 'Mencetak kartu akun wali', `${kelas.nama}: ${hasil.length} santri`);
    return c.json({ kelas: kelas.nama, alamat: asal(c), daftar: hasil, dilewati });
  });

  // Pindah kelas atau ubah status beberapa santri sekaligus (mis. kenaikan kelas).
  r.post('/massal', async (c) => {
    hanyaAdmin(c);
    const isi = await bacaIsi(
      c,
      z.object({
        ids: z.array(z.number().int().positive()).min(1, 'Pilih paling sedikit satu santri.').max(1000),
        kelasId: z.number().int().positive().nullable().optional(),
        status: z.enum(['aktif', 'lulus', 'pindah', 'keluar']).optional(),
      }),
    );
    if (isi.kelasId === undefined && !isi.status) throw new GalatPengguna(400, 'Pilih kelas tujuan atau status baru.');
    if (isi.kelasId) pastikanKelas(db, isi.kelasId);
    db.transaction(() => {
      for (const id of isi.ids) {
        if (isi.kelasId !== undefined) db.prepare('UPDATE santri SET kelas_id = ? WHERE id = ?').run(isi.kelasId, id);
        if (isi.status) {
          db.prepare('UPDATE santri SET status = ? WHERE id = ?').run(isi.status, id);
          if (isi.status === 'keluar') hapusSemuaSesi(db, 'wali', id);
        }
      }
    })();
    const kelas = isi.kelasId ? satu<{ nama: string }>(db, 'SELECT nama FROM kelas WHERE id = ?', isi.kelasId)?.nama : null;
    catatLog(db, pelaku(c), 'Mengubah santri secara massal', `${isi.ids.length} santri${kelas ? ` → ${kelas}` : ''}${isi.status ? ` (status ${isi.status})` : ''}`);
    return c.json({ ok: true, jumlah: isi.ids.length });
  });

  return r;
}
