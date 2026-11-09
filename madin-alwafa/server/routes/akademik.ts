// Kelas, mata pelajaran, jadwal, dan tahun ajaran/semester.
import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { hanyaAdmin, pelaku, type VarPengurus } from '../auth';
import { GalatPengguna, bacaIsi, catatLog, idParam, satu, semua, tanggal, tanggalOpsional, teksOpsional, teksWajib } from '../util';

const skemaKelas = z.object({
  nama: teksWajib('Nama kelas', 60),
  jenjang: teksWajib('Jenjang', 40),
  tingkat: z.number({ error: 'Tingkat wajib diisi.' }).int().min(1, 'Tingkat 1–12.').max(12, 'Tingkat 1–12.'),
  bagian: z.enum(['putra', 'putri', 'campur'], { error: 'Pilih bagian kelas.' }),
  waliKelas: teksOpsional(100),
  ruang: teksOpsional(60),
  aktif: z.boolean().default(true),
});

const skemaMapel = z.object({
  nama: teksWajib('Nama mata pelajaran', 80),
  namaArab: teksOpsional(80),
  kitab: teksOpsional(120),
  urutan: z.number().int().min(0).max(999).default(0),
  kkm: z.number({ error: 'KKM wajib diisi.' }).int().min(0, 'KKM 0–100.').max(100, 'KKM 0–100.'),
});

const jam = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Jam tidak valid (JJ:MM).');

export function ruteKelas(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();

  r.get('/', (c) => {
    const daftar = semua(
      db,
      `SELECT k.id, k.nama, k.jenjang, k.tingkat, k.bagian, k.wali_kelas AS waliKelas, k.ruang, k.aktif,
              (SELECT COUNT(*) FROM santri s WHERE s.kelas_id = k.id AND s.status = 'aktif' AND s.jk = 'L') AS putra,
              (SELECT COUNT(*) FROM santri s WHERE s.kelas_id = k.id AND s.status = 'aktif' AND s.jk = 'P') AS putri,
              (SELECT COUNT(*) FROM kelas_mapel km WHERE km.kelas_id = k.id) AS jumlahMapel
         FROM kelas k ORDER BY k.aktif DESC, k.tingkat, k.nama`,
    );
    return c.json({ daftar });
  });

  r.get('/:id', (c) => {
    const id = idParam(c);
    const kelas = satu(db, 'SELECT id, nama, jenjang, tingkat, bagian, wali_kelas AS waliKelas, ruang, aktif FROM kelas WHERE id = ?', id);
    if (!kelas) throw new GalatPengguna(404, 'Kelas tidak ditemukan.');
    const mapel = semua(
      db,
      `SELECT m.id AS mapelId, m.nama, m.nama_arab AS namaArab, m.kitab, m.kkm, km.pengajar
         FROM kelas_mapel km JOIN mapel m ON m.id = km.mapel_id WHERE km.kelas_id = ? ORDER BY m.urutan, m.nama`,
      id,
    );
    const jadwal = semua(
      db,
      `SELECT j.id, j.hari, j.jam_mulai AS jamMulai, j.jam_selesai AS jamSelesai, j.mapel_id AS mapelId, m.nama AS mapel, km.pengajar
         FROM jadwal j JOIN mapel m ON m.id = j.mapel_id LEFT JOIN kelas_mapel km ON km.kelas_id = j.kelas_id AND km.mapel_id = j.mapel_id
        WHERE j.kelas_id = ? ORDER BY j.hari, j.jam_mulai`,
      id,
    );
    const santri = semua(db, "SELECT id, nis, nama, jk FROM santri WHERE kelas_id = ? AND status = 'aktif' ORDER BY nama", id);
    return c.json({ kelas, mapel, jadwal, santri });
  });

  r.post('/', async (c) => {
    hanyaAdmin(c);
    const isi = await bacaIsi(c, skemaKelas);
    if (satu(db, 'SELECT 1 FROM kelas WHERE nama = ?', isi.nama)) throw new GalatPengguna(409, `Kelas ${isi.nama} sudah ada.`, { nama: 'Nama kelas sudah dipakai.' });
    const id = Number(
      db
        .prepare('INSERT INTO kelas (nama, jenjang, tingkat, bagian, wali_kelas, ruang, aktif) VALUES (?,?,?,?,?,?,?)')
        .run(isi.nama, isi.jenjang, isi.tingkat, isi.bagian, isi.waliKelas, isi.ruang, isi.aktif ? 1 : 0).lastInsertRowid,
    );
    catatLog(db, pelaku(c), 'Menambah kelas', isi.nama);
    return c.json({ id });
  });

  r.put('/:id', async (c) => {
    hanyaAdmin(c);
    const id = idParam(c);
    const isi = await bacaIsi(c, skemaKelas);
    if (!satu(db, 'SELECT 1 FROM kelas WHERE id = ?', id)) throw new GalatPengguna(404, 'Kelas tidak ditemukan.');
    if (satu(db, 'SELECT 1 FROM kelas WHERE nama = ? AND id != ?', isi.nama, id)) throw new GalatPengguna(409, `Kelas ${isi.nama} sudah ada.`, { nama: 'Nama kelas sudah dipakai.' });
    db.prepare('UPDATE kelas SET nama=?, jenjang=?, tingkat=?, bagian=?, wali_kelas=?, ruang=?, aktif=? WHERE id=?').run(
      isi.nama,
      isi.jenjang,
      isi.tingkat,
      isi.bagian,
      isi.waliKelas,
      isi.ruang,
      isi.aktif ? 1 : 0,
      id,
    );
    catatLog(db, pelaku(c), 'Mengubah kelas', isi.nama);
    return c.json({ ok: true });
  });

  r.delete('/:id', (c) => {
    hanyaAdmin(c);
    const id = idParam(c);
    const k = satu<{ nama: string }>(db, 'SELECT nama FROM kelas WHERE id = ?', id);
    if (!k) throw new GalatPengguna(404, 'Kelas tidak ditemukan.');
    if (satu(db, 'SELECT 1 FROM santri WHERE kelas_id = ? LIMIT 1', id) || satu(db, 'SELECT 1 FROM absensi WHERE kelas_id = ? LIMIT 1', id)) {
      throw new GalatPengguna(409, `Kelas ${k.nama} masih punya santri atau riwayat absensi. Nonaktifkan kelas ini saja.`);
    }
    db.prepare('DELETE FROM kelas WHERE id = ?').run(id);
    catatLog(db, pelaku(c), 'Menghapus kelas', k.nama);
    return c.json({ ok: true });
  });

  // Mata pelajaran kelas beserta pengajarnya (mengganti seluruh daftar).
  r.put('/:id/mapel', async (c) => {
    hanyaAdmin(c);
    const id = idParam(c);
    const { daftar } = await bacaIsi(
      c,
      z.object({ daftar: z.array(z.object({ mapelId: z.number().int().positive(), pengajar: teksOpsional(100) })).max(40) }),
    );
    const k = satu<{ nama: string }>(db, 'SELECT nama FROM kelas WHERE id = ?', id);
    if (!k) throw new GalatPengguna(404, 'Kelas tidak ditemukan.');
    db.transaction(() => {
      db.prepare('DELETE FROM kelas_mapel WHERE kelas_id = ?').run(id);
      const st = db.prepare('INSERT OR REPLACE INTO kelas_mapel (kelas_id, mapel_id, pengajar) VALUES (?, ?, ?)');
      for (const m of daftar) {
        if (!satu(db, 'SELECT 1 FROM mapel WHERE id = ?', m.mapelId)) throw new GalatPengguna(400, 'Mata pelajaran tidak ditemukan.');
        st.run(id, m.mapelId, m.pengajar);
      }
      // Jadwal untuk mapel yang dilepas ikut dihapus.
      db.prepare('DELETE FROM jadwal WHERE kelas_id = ? AND mapel_id NOT IN (SELECT mapel_id FROM kelas_mapel WHERE kelas_id = ?)').run(id, id);
    })();
    catatLog(db, pelaku(c), 'Mengatur mata pelajaran kelas', `${k.nama}: ${daftar.length} mapel`);
    return c.json({ ok: true });
  });

  r.put('/:id/jadwal', async (c) => {
    hanyaAdmin(c);
    const id = idParam(c);
    const { daftar } = await bacaIsi(
      c,
      z.object({
        daftar: z
          .array(z.object({ hari: z.number().int().min(1).max(7), jamMulai: jam, jamSelesai: jam, mapelId: z.number().int().positive() }))
          .max(80),
      }),
    );
    const k = satu<{ nama: string }>(db, 'SELECT nama FROM kelas WHERE id = ?', id);
    if (!k) throw new GalatPengguna(404, 'Kelas tidak ditemukan.');
    for (const j of daftar) {
      if (j.jamSelesai <= j.jamMulai) throw new GalatPengguna(400, 'Jam selesai harus setelah jam mulai.');
      if (!satu(db, 'SELECT 1 FROM kelas_mapel WHERE kelas_id = ? AND mapel_id = ?', id, j.mapelId)) {
        throw new GalatPengguna(400, 'Jadwal memuat mata pelajaran yang tidak diajarkan di kelas ini.');
      }
    }
    db.transaction(() => {
      db.prepare('DELETE FROM jadwal WHERE kelas_id = ?').run(id);
      const st = db.prepare('INSERT INTO jadwal (kelas_id, hari, jam_mulai, jam_selesai, mapel_id) VALUES (?,?,?,?,?)');
      for (const j of daftar) st.run(id, j.hari, j.jamMulai, j.jamSelesai, j.mapelId);
    })();
    catatLog(db, pelaku(c), 'Mengatur jadwal pelajaran', k.nama);
    return c.json({ ok: true });
  });

  return r;
}

export function ruteMapel(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();

  r.get('/', (c) =>
    c.json({
      daftar: semua(
        db,
        `SELECT m.id, m.nama, m.nama_arab AS namaArab, m.kitab, m.urutan, m.kkm,
                (SELECT COUNT(*) FROM kelas_mapel km WHERE km.mapel_id = m.id) AS jumlahKelas
           FROM mapel m ORDER BY m.urutan, m.nama`,
      ),
    }),
  );

  r.post('/', async (c) => {
    hanyaAdmin(c);
    const isi = await bacaIsi(c, skemaMapel);
    if (satu(db, 'SELECT 1 FROM mapel WHERE nama = ?', isi.nama)) throw new GalatPengguna(409, `${isi.nama} sudah ada.`, { nama: 'Nama sudah dipakai.' });
    const id = Number(
      db.prepare('INSERT INTO mapel (nama, nama_arab, kitab, urutan, kkm) VALUES (?,?,?,?,?)').run(isi.nama, isi.namaArab, isi.kitab, isi.urutan, isi.kkm)
        .lastInsertRowid,
    );
    catatLog(db, pelaku(c), 'Menambah mata pelajaran', isi.nama);
    return c.json({ id });
  });

  r.put('/:id', async (c) => {
    hanyaAdmin(c);
    const id = idParam(c);
    const isi = await bacaIsi(c, skemaMapel);
    if (!satu(db, 'SELECT 1 FROM mapel WHERE id = ?', id)) throw new GalatPengguna(404, 'Mata pelajaran tidak ditemukan.');
    if (satu(db, 'SELECT 1 FROM mapel WHERE nama = ? AND id != ?', isi.nama, id)) throw new GalatPengguna(409, `${isi.nama} sudah ada.`, { nama: 'Nama sudah dipakai.' });
    db.prepare('UPDATE mapel SET nama=?, nama_arab=?, kitab=?, urutan=?, kkm=? WHERE id=?').run(isi.nama, isi.namaArab, isi.kitab, isi.urutan, isi.kkm, id);
    catatLog(db, pelaku(c), 'Mengubah mata pelajaran', isi.nama);
    return c.json({ ok: true });
  });

  r.delete('/:id', (c) => {
    hanyaAdmin(c);
    const id = idParam(c);
    const m = satu<{ nama: string }>(db, 'SELECT nama FROM mapel WHERE id = ?', id);
    if (!m) throw new GalatPengguna(404, 'Mata pelajaran tidak ditemukan.');
    if (satu(db, 'SELECT 1 FROM kelas_mapel WHERE mapel_id = ? LIMIT 1', id) || satu(db, 'SELECT 1 FROM nilai WHERE mapel_id = ? LIMIT 1', id)) {
      throw new GalatPengguna(409, `${m.nama} masih dipakai kelas atau sudah punya nilai, jadi tidak bisa dihapus.`);
    }
    db.prepare('DELETE FROM mapel WHERE id = ?').run(id);
    catatLog(db, pelaku(c), 'Menghapus mata pelajaran', m.nama);
    return c.json({ ok: true });
  });

  return r;
}

const skemaPeriode = z.object({
  tahunAjaran: z
    .string({ error: 'Tahun ajaran wajib diisi.' })
    .trim()
    .regex(/^\d{4}\/\d{4}$/, 'Tulis tahun ajaran seperti 2026/2027.')
    .refine((t) => Number(t.slice(5)) === Number(t.slice(0, 4)) + 1, 'Tahun kedua harus satu tahun setelah tahun pertama.'),
  semester: z.union([z.literal(1), z.literal(2)], { error: 'Pilih semester.' }),
  mulai: tanggal('Tanggal mulai'),
  selesai: tanggal('Tanggal selesai'),
  tanggalRaport: tanggalOpsional(),
});

export function rutePeriode(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();

  r.get('/', (c) =>
    c.json({
      daftar: semua(
        db,
        `SELECT p.id, p.tahun_ajaran AS tahunAjaran, p.semester, p.mulai, p.selesai, p.tanggal_raport AS tanggalRaport, p.aktif,
                (SELECT COUNT(*) FROM raport r WHERE r.periode_id = p.id AND r.status = 'terbit') AS raportTerbit
           FROM periode p ORDER BY p.mulai DESC`,
      ),
    }),
  );

  const periksa = (db: DB, isi: z.infer<typeof skemaPeriode>, id?: number) => {
    if (isi.selesai <= isi.mulai) throw new GalatPengguna(400, 'Tanggal selesai harus setelah tanggal mulai.', { selesai: 'Harus setelah tanggal mulai.' });
    const bentrok = satu<{ tahun_ajaran: string; semester: number }>(
      db,
      'SELECT tahun_ajaran, semester FROM periode WHERE mulai <= ? AND selesai >= ? AND id != ?',
      isi.selesai,
      isi.mulai,
      id ?? 0,
    );
    if (bentrok) throw new GalatPengguna(409, `Rentang tanggal bertumpuk dengan ${bentrok.tahun_ajaran} semester ${bentrok.semester}.`);
    if (satu(db, 'SELECT 1 FROM periode WHERE tahun_ajaran = ? AND semester = ? AND id != ?', isi.tahunAjaran, isi.semester, id ?? 0)) {
      throw new GalatPengguna(409, `${isi.tahunAjaran} semester ${isi.semester} sudah ada.`);
    }
  };

  r.post('/', async (c) => {
    hanyaAdmin(c);
    const isi = await bacaIsi(c, skemaPeriode);
    periksa(db, isi);
    const adaAktif = !!satu(db, 'SELECT 1 FROM periode WHERE aktif = 1');
    const id = Number(
      db
        .prepare('INSERT INTO periode (tahun_ajaran, semester, mulai, selesai, tanggal_raport, aktif) VALUES (?,?,?,?,?,?)')
        .run(isi.tahunAjaran, isi.semester, isi.mulai, isi.selesai, isi.tanggalRaport, adaAktif ? 0 : 1).lastInsertRowid,
    );
    catatLog(db, pelaku(c), 'Menambah semester', `${isi.tahunAjaran} semester ${isi.semester}`);
    return c.json({ id });
  });

  r.put('/:id', async (c) => {
    hanyaAdmin(c);
    const id = idParam(c);
    const isi = await bacaIsi(c, skemaPeriode);
    if (!satu(db, 'SELECT 1 FROM periode WHERE id = ?', id)) throw new GalatPengguna(404, 'Semester tidak ditemukan.');
    periksa(db, isi, id);
    db.prepare('UPDATE periode SET tahun_ajaran=?, semester=?, mulai=?, selesai=?, tanggal_raport=? WHERE id=?').run(
      isi.tahunAjaran,
      isi.semester,
      isi.mulai,
      isi.selesai,
      isi.tanggalRaport,
      id,
    );
    catatLog(db, pelaku(c), 'Mengubah semester', `${isi.tahunAjaran} semester ${isi.semester}`);
    return c.json({ ok: true });
  });

  r.post('/:id/aktifkan', (c) => {
    hanyaAdmin(c);
    const id = idParam(c);
    const p = satu<{ tahun_ajaran: string; semester: number }>(db, 'SELECT tahun_ajaran, semester FROM periode WHERE id = ?', id);
    if (!p) throw new GalatPengguna(404, 'Semester tidak ditemukan.');
    db.transaction(() => {
      db.prepare('UPDATE periode SET aktif = 0').run();
      db.prepare('UPDATE periode SET aktif = 1 WHERE id = ?').run(id);
    })();
    catatLog(db, pelaku(c), 'Mengaktifkan semester', `${p.tahun_ajaran} semester ${p.semester}`);
    return c.json({ ok: true });
  });

  return r;
}
