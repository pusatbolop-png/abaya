// Absensi guru: setiap guru yang mengajar pada suatu hari wajib mengisi kehadirannya sendiri (hadir, izin, sakit).
// Kehadiran setelah jam pelajaran pertamanya dimulai ditandai terlambat. Pengurus bisa mencatat atau membetulkan.
import type { DB } from '../db';
import { semua, sekarang } from '../util';
import { pelajaranHari } from './harian';

export type StatusGuru = 'H' | 'I' | 'S' | 'A';

const sama = (a: string | null | undefined, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Guru yang mengajar (atau menjadi wali kelas yang belajar) pada tanggal itu, beserta kehadirannya. */
export function absenGuruHari(db: DB, tanggal: string) {
  const pelajaran = pelajaranHari(db, tanggal);
  const guru = semua<{ id: number; nama: string; peran: string; hp: string | null }>(db, 'SELECT id, nama, peran, hp FROM pengurus WHERE aktif = 1 ORDER BY nama');
  const catatan = new Map(
    semua<{ pengurus_id: number; status: StatusGuru; jam: string | null; terlambat: number; keterangan: string | null; dicatat_oleh: string | null }>(
      db,
      'SELECT pengurus_id, status, jam, terlambat, keterangan, dicatat_oleh FROM absensi_guru WHERE tanggal = ?',
      tanggal,
    ).map((c) => [c.pengurus_id, c]),
  );
  return guru
    .map((g) => {
      const mengajar = pelajaran.filter((p) => sama(p.pengajar, g.nama));
      const wali = pelajaran.some((p) => sama(p.waliKelas, g.nama));
      const c = catatan.get(g.id);
      return {
        id: g.id,
        nama: g.nama,
        peran: g.peran,
        mengajar: mengajar.map((p) => ({ kelas: p.kelas, mapel: p.mapel, jamMulai: p.jamMulai })),
        jamPertama: mengajar.length ? mengajar.map((p) => p.jamMulai).sort()[0] : null,
        wajib: mengajar.length > 0 || wali,
        status: c?.status ?? null,
        jam: c?.jam ?? null,
        terlambat: !!c?.terlambat,
        keterangan: c?.keterangan ?? null,
        dicatatOleh: c?.dicatat_oleh ?? null,
      };
    })
    .filter((g) => g.wajib || g.status);
}

export function catatAbsenGuru(
  db: DB,
  d: { pengurusId: number; tanggal: string; status: StatusGuru; jam: string | null; jamPertama: string | null; keterangan: string | null; oleh: string },
) {
  const terlambat = d.status === 'H' && !!d.jam && !!d.jamPertama && d.jam > d.jamPertama ? 1 : 0;
  db.prepare(
    `INSERT INTO absensi_guru (pengurus_id, tanggal, status, jam, terlambat, keterangan, dicatat_oleh, diubah) VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(pengurus_id, tanggal) DO UPDATE SET status = excluded.status, jam = COALESCE(absensi_guru.jam, excluded.jam),
       terlambat = CASE WHEN absensi_guru.jam IS NULL THEN excluded.terlambat ELSE absensi_guru.terlambat END,
       keterangan = excluded.keterangan, dicatat_oleh = excluded.dicatat_oleh, diubah = excluded.diubah`,
  ).run(d.pengurusId, d.tanggal, d.status, d.status === 'H' ? d.jam : null, terlambat, d.keterangan, d.oleh, sekarang());
}

/** Rekap kehadiran guru satu bulan (YYYY-MM). */
export function rekapAbsenGuru(db: DB, bulan: string) {
  return semua<{ id: number; nama: string; H: number; I: number; S: number; A: number; terlambat: number }>(
    db,
    `SELECT p.id, p.nama,
            COALESCE(SUM(a.status = 'H'), 0) AS H, COALESCE(SUM(a.status = 'I'), 0) AS I,
            COALESCE(SUM(a.status = 'S'), 0) AS S, COALESCE(SUM(a.status = 'A'), 0) AS A,
            COALESCE(SUM(a.terlambat), 0) AS terlambat
       FROM pengurus p LEFT JOIN absensi_guru a ON a.pengurus_id = p.id AND a.tanggal LIKE ?
      WHERE p.aktif = 1
      GROUP BY p.id ORDER BY p.nama`,
    `${bulan}-%`,
  );
}
