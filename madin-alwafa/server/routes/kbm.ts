// Kegiatan belajar: absensi harian, nilai, dan setoran hafalan.
import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { pelaku, type VarPengurus } from '../auth';
import { GalatPengguna, ambilPengaturan, bacaIsi, bobotNilai, catatLog, idParam, satu, semua, sekarang, tanggal, teksOpsional, teksWajib } from '../util';
import { ambilPeriode, pastikanBelumTerbit } from '../domain/raport';
import { nilaiAkhir } from '../../shared/konstanta';
import { hariIni } from '../../shared/format';

function ambilKelas(db: DB, id: unknown) {
  const kelas = satu<{ id: number; nama: string; bagian: string; wali_kelas: string | null }>(db, 'SELECT id, nama, bagian, wali_kelas FROM kelas WHERE id = ?', Number(id));
  if (!kelas) throw new GalatPengguna(404, 'Pilih kelas terlebih dahulu.');
  return kelas;
}

export function ruteAbsensi(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();

  r.get('/', (c) => {
    const kelas = ambilKelas(db, c.req.query('kelas'));
    const tgl = c.req.query('tanggal') ?? hariIni();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) throw new GalatPengguna(400, 'Tanggal tidak valid.');
    const daftar = semua<{ santriId: number; nis: string; nama: string; jk: string; status: string | null; keterangan: string | null }>(
      db,
      `SELECT s.id AS santriId, s.nis, s.nama, s.jk, a.status, a.keterangan
         FROM santri s LEFT JOIN absensi a ON a.santri_id = s.id AND a.tanggal = ?
        WHERE (s.kelas_id = ? AND s.status = 'aktif') OR (a.kelas_id = ? AND a.tanggal = ?)
        ORDER BY s.nama`,
      tgl,
      kelas.id,
      kelas.id,
      tgl,
    );
    return c.json({ kelas, tanggal: tgl, daftar, tersimpan: daftar.some((d) => d.status) });
  });

  r.put('/', async (c) => {
    const isi = await bacaIsi(
      c,
      z.object({
        kelasId: z.number().int().positive(),
        tanggal: tanggal(),
        daftar: z
          .array(z.object({ santriId: z.number().int().positive(), status: z.enum(['H', 'I', 'S', 'A']), keterangan: teksOpsional(200) }))
          .min(1, 'Belum ada santri yang diabsen.')
          .max(200),
      }),
    );
    const kelas = ambilKelas(db, isi.kelasId);
    if (isi.tanggal > hariIni()) throw new GalatPengguna(400, 'Absensi tidak bisa diisi untuk tanggal yang akan datang.');
    db.transaction(() => {
      const st = db.prepare(
        `INSERT INTO absensi (santri_id, tanggal, kelas_id, status, keterangan) VALUES (?,?,?,?,?)
         ON CONFLICT(santri_id, tanggal) DO UPDATE SET kelas_id = excluded.kelas_id, status = excluded.status, keterangan = excluded.keterangan`,
      );
      for (const a of isi.daftar) {
        if (!satu(db, 'SELECT 1 FROM santri WHERE id = ? AND kelas_id = ?', a.santriId, kelas.id) && !satu(db, 'SELECT 1 FROM absensi WHERE santri_id = ? AND tanggal = ? AND kelas_id = ?', a.santriId, isi.tanggal, kelas.id)) {
          throw new GalatPengguna(400, 'Ada santri yang bukan anggota kelas ini. Muat ulang halaman lalu coba lagi.');
        }
        st.run(a.santriId, isi.tanggal, kelas.id, a.status, a.keterangan);
      }
    })();
    const tidakHadir = isi.daftar.filter((a) => a.status !== 'H').length;
    catatLog(db, pelaku(c), 'Mengisi absensi', `${kelas.nama}, ${isi.tanggal}: ${isi.daftar.length - tidakHadir} hadir, ${tidakHadir} tidak hadir`);
    return c.json({ ok: true });
  });

  // Rekap satu bulan untuk satu kelas.
  r.get('/rekap', (c) => {
    const kelas = ambilKelas(db, c.req.query('kelas'));
    const bulan = c.req.query('bulan') ?? hariIni().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(bulan)) throw new GalatPengguna(400, 'Bulan tidak valid.');
    const baris = semua<{ santri_id: number; tanggal: string; status: string }>(
      db,
      'SELECT santri_id, tanggal, status FROM absensi WHERE kelas_id = ? AND tanggal LIKE ? ORDER BY tanggal',
      kelas.id,
      `${bulan}-%`,
    );
    const tanggalPertemuan = [...new Set(baris.map((b) => b.tanggal))];
    const santri = semua<{ id: number; nama: string; nis: string; jk: string }>(
      db,
      `SELECT id, nama, nis, jk FROM santri WHERE (kelas_id = ? AND status = 'aktif') OR id IN (SELECT santri_id FROM absensi WHERE kelas_id = ? AND tanggal LIKE ?) ORDER BY nama`,
      kelas.id,
      kelas.id,
      `${bulan}-%`,
    );
    const daftar = santri.map((s) => {
      const miliknya = baris.filter((b) => b.santri_id === s.id);
      const hitung = (st: string) => miliknya.filter((m) => m.status === st).length;
      return {
        ...s,
        status: Object.fromEntries(miliknya.map((m) => [m.tanggal, m.status])),
        H: hitung('H'),
        I: hitung('I'),
        S: hitung('S'),
        A: hitung('A'),
      };
    });
    return c.json({ kelas, bulan, tanggal: tanggalPertemuan, daftar });
  });

  return r;
}

const angkaNilai = z
  .number()
  .int('Nilai harus bilangan bulat.')
  .min(0, 'Nilai 0–100.')
  .max(100, 'Nilai 0–100.')
  .nullable();

export function ruteNilai(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();

  r.get('/', (c) => {
    const kelas = ambilKelas(db, c.req.query('kelas'));
    const periode = ambilPeriode(db, c.req.query('periode') ? Number(c.req.query('periode')) : null);
    const mapelId = Number(c.req.query('mapel'));
    const mapel = satu<{ id: number; nama: string; nama_arab: string | null; kkm: number; pengajar: string | null }>(
      db,
      'SELECT m.id, m.nama, m.nama_arab, m.kkm, km.pengajar FROM kelas_mapel km JOIN mapel m ON m.id = km.mapel_id WHERE km.kelas_id = ? AND km.mapel_id = ?',
      kelas.id,
      mapelId,
    );
    if (!mapel) throw new GalatPengguna(404, 'Pilih mata pelajaran yang diajarkan di kelas ini.');
    const bobot = bobotNilai(ambilPengaturan(db));
    const daftar = semua<{ santriId: number; nis: string; nama: string; jk: string; harian: number | null; uts: number | null; uas: number | null; status: string | null }>(
      db,
      `SELECT s.id AS santriId, s.nis, s.nama, s.jk, n.harian, n.uts, n.uas, r.status
         FROM santri s
         LEFT JOIN nilai n ON n.santri_id = s.id AND n.periode_id = ? AND n.mapel_id = ?
         LEFT JOIN raport r ON r.santri_id = s.id AND r.periode_id = ?
        WHERE s.kelas_id = ? AND s.status = 'aktif' ORDER BY s.nama`,
      periode.id,
      mapel.id,
      periode.id,
      kelas.id,
    ).map(({ status, ...d }) => ({ ...d, akhir: nilaiAkhir(d, bobot), terkunci: status === 'terbit' }));
    return c.json({
      kelas,
      mapel: { id: mapel.id, nama: mapel.nama, namaArab: mapel.nama_arab, kkm: mapel.kkm, pengajar: mapel.pengajar },
      periode: { id: periode.id, tahunAjaran: periode.tahun_ajaran, semester: periode.semester },
      bobot,
      daftar,
    });
  });

  r.put('/', async (c) => {
    const isi = await bacaIsi(
      c,
      z.object({
        periodeId: z.number().int().positive(),
        kelasId: z.number().int().positive(),
        mapelId: z.number().int().positive(),
        daftar: z.array(z.object({ santriId: z.number().int().positive(), harian: angkaNilai, uts: angkaNilai, uas: angkaNilai })).max(200),
      }),
    );
    const kelas = ambilKelas(db, isi.kelasId);
    const periode = ambilPeriode(db, isi.periodeId);
    const mapel = satu<{ nama: string }>(db, 'SELECT m.nama FROM kelas_mapel km JOIN mapel m ON m.id = km.mapel_id WHERE km.kelas_id = ? AND km.mapel_id = ?', kelas.id, isi.mapelId);
    if (!mapel) throw new GalatPengguna(404, 'Mata pelajaran ini tidak diajarkan di kelas tersebut.');
    let berubah = 0;
    db.transaction(() => {
      const st = db.prepare(
        `INSERT INTO nilai (santri_id, periode_id, mapel_id, harian, uts, uas, diubah) VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(santri_id, periode_id, mapel_id) DO UPDATE SET harian = excluded.harian, uts = excluded.uts, uas = excluded.uas, diubah = excluded.diubah`,
      );
      for (const n of isi.daftar) {
        const s = satu<{ nama: string }>(db, "SELECT nama FROM santri WHERE id = ? AND kelas_id = ?", n.santriId, kelas.id);
        if (!s) throw new GalatPengguna(400, 'Ada santri yang bukan anggota kelas ini. Muat ulang halaman lalu coba lagi.');
        const lama = satu<{ harian: number | null; uts: number | null; uas: number | null }>(
          db,
          'SELECT harian, uts, uas FROM nilai WHERE santri_id = ? AND periode_id = ? AND mapel_id = ?',
          n.santriId,
          periode.id,
          isi.mapelId,
        );
        const sama = lama ? lama.harian === n.harian && lama.uts === n.uts && lama.uas === n.uas : n.harian === null && n.uts === null && n.uas === null;
        if (sama) continue;
        pastikanBelumTerbit(db, n.santriId, periode.id, s.nama);
        st.run(n.santriId, periode.id, isi.mapelId, n.harian, n.uts, n.uas, sekarang());
        berubah++;
      }
    })();
    if (berubah) catatLog(db, pelaku(c), 'Mengisi nilai', `${kelas.nama} · ${mapel.nama}: ${berubah} santri`);
    return c.json({ ok: true, berubah });
  });

  // Kelengkapan nilai per kelas dan mapel pada satu semester.
  r.get('/progres', (c) => {
    const periode = ambilPeriode(db, c.req.query('periode') ? Number(c.req.query('periode')) : null);
    const bobot = bobotNilai(ambilPengaturan(db));
    const wajib = (['harian', 'uts', 'uas'] as const).filter((k) => bobot[k] > 0);
    const syaratLengkap = wajib.map((k) => `n.${k} IS NOT NULL`).join(' AND ') || '1';
    const daftar = semua<{ kelasId: number; kelas: string; mapelId: number; mapel: string; pengajar: string | null; santri: number; harian: number; uts: number; uas: number; lengkap: number }>(
      db,
      `SELECT k.id AS kelasId, k.nama AS kelas, m.id AS mapelId, m.nama AS mapel, km.pengajar,
              COUNT(s.id) AS santri, COUNT(n.harian) AS harian, COUNT(n.uts) AS uts, COUNT(n.uas) AS uas,
              SUM(CASE WHEN n.santri_id IS NOT NULL AND ${syaratLengkap} THEN 1 ELSE 0 END) AS lengkap
         FROM kelas k JOIN kelas_mapel km ON km.kelas_id = k.id JOIN mapel m ON m.id = km.mapel_id
         LEFT JOIN santri s ON s.kelas_id = k.id AND s.status = 'aktif'
         LEFT JOIN nilai n ON n.santri_id = s.id AND n.mapel_id = m.id AND n.periode_id = ?
        WHERE k.aktif = 1 GROUP BY k.id, m.id ORDER BY k.tingkat, k.nama, m.urutan, m.nama`,
      periode.id,
    );
    return c.json({ periode: { id: periode.id, tahunAjaran: periode.tahun_ajaran, semester: periode.semester }, bobot, daftar });
  });

  return r;
}

export function ruteHafalan(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();

  r.get('/', (c) => {
    const syarat: string[] = [];
    const param: unknown[] = [];
    const santri = c.req.query('santri');
    const kelas = c.req.query('kelas');
    const jenis = c.req.query('jenis');
    if (santri) {
      syarat.push('h.santri_id = ?');
      param.push(Number(santri));
    }
    if (kelas) {
      syarat.push('s.kelas_id = ?');
      param.push(Number(kelas));
    }
    if (jenis) {
      syarat.push('h.jenis = ?');
      param.push(jenis);
    }
    const daftar = semua(
      db,
      `SELECT h.id, h.santri_id AS santriId, s.nama, s.nis, s.jk, k.nama AS kelas, h.tanggal, h.jenis, h.materi, h.predikat, h.catatan, h.penyimak
         FROM hafalan h JOIN santri s ON s.id = h.santri_id LEFT JOIN kelas k ON k.id = s.kelas_id
        ${syarat.length ? 'WHERE ' + syarat.join(' AND ') : ''}
        ORDER BY h.tanggal DESC, h.id DESC LIMIT 200`,
      ...param,
    );
    const ringkasan = satu<{ total: number; lancar: number; pekan: number }>(
      db,
      "SELECT COUNT(*) AS total, SUM(predikat = 'lancar') AS lancar, SUM(tanggal >= ?) AS pekan FROM hafalan",
      new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10),
    )!;
    return c.json({ daftar, ringkasan: { total: ringkasan.total, lancar: ringkasan.lancar ?? 0, pekan: ringkasan.pekan ?? 0 } });
  });

  r.post('/', async (c) => {
    const isi = await bacaIsi(
      c,
      z.object({
        santriId: z.number({ error: 'Pilih santri.' }).int().positive(),
        tanggal: tanggal(),
        jenis: teksWajib('Jenis hafalan', 40),
        materi: teksWajib('Materi hafalan', 200),
        predikat: z.enum(['lancar', 'cukup', 'ulang'], { error: 'Pilih predikat setoran.' }),
        catatan: teksOpsional(300),
        penyimak: teksOpsional(100),
      }),
    );
    const s = satu<{ nama: string }>(db, 'SELECT nama FROM santri WHERE id = ?', isi.santriId);
    if (!s) throw new GalatPengguna(404, 'Santri tidak ditemukan.');
    if (isi.tanggal > hariIni()) throw new GalatPengguna(400, 'Tanggal setoran tidak boleh di masa depan.', { tanggal: 'Tidak boleh di masa depan.' });
    const id = Number(
      db
        .prepare('INSERT INTO hafalan (santri_id, tanggal, jenis, materi, predikat, catatan, penyimak, dibuat) VALUES (?,?,?,?,?,?,?,?)')
        .run(isi.santriId, isi.tanggal, isi.jenis, isi.materi, isi.predikat, isi.catatan, isi.penyimak ?? c.get('pengurus').nama, sekarang()).lastInsertRowid,
    );
    catatLog(db, pelaku(c), 'Mencatat setoran hafalan', `${s.nama}: ${isi.materi}`);
    return c.json({ id });
  });

  r.delete('/:id', (c) => {
    const id = idParam(c);
    const h = satu<{ materi: string; nama: string }>(db, 'SELECT h.materi, s.nama FROM hafalan h JOIN santri s ON s.id = h.santri_id WHERE h.id = ?', id);
    if (!h) throw new GalatPengguna(404, 'Catatan hafalan tidak ditemukan.');
    db.prepare('DELETE FROM hafalan WHERE id = ?').run(id);
    catatLog(db, pelaku(c), 'Menghapus catatan hafalan', `${h.nama}: ${h.materi}`);
    return c.json({ ok: true });
  });

  return r;
}
