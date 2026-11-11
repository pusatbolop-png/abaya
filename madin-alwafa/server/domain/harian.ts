// Nilai harian per pertemuan. Guru mengisi nilai untuk pelajaran yang diajarkan hari itu (sesuai jadwal),
// paling lambat jam batas (bawaan 21:00 WIB). Nilai harian semester dihitung otomatis dari rata-ratanya.
import type { DB } from '../db';
import { GalatPengguna, ambilPengaturan, satu, semua, sekarang } from '../util';
import { pastikanBelumTerbit } from './raport';
import { hariIni } from '../../shared/format';

export interface PelajaranHari {
  kelasId: number;
  kelas: string;
  bagian: string;
  mapelId: number;
  mapel: string;
  mapelArab: string | null;
  jamMulai: string;
  jamSelesai: string;
  pengajar: string | null;
  waliKelas: string | null;
  anggota: number;
  tidakHadir: number;
  /** santri yang wajib dinilai: anggota kelas dikurangi yang izin, sakit, atau alpa hari itu */
  wajib: number;
  terisi: number;
  lengkap: boolean;
  absensiTerisi: boolean;
}

export const hariKe = (tanggal: string) => new Date(`${tanggal}T12:00:00Z`).getUTCDay() || 7;

/** Pelajaran yang terjadwal pada satu tanggal beserta kelengkapan absensi dan nilai hariannya. */
export function pelajaranHari(db: DB, tanggal: string): PelajaranHari[] {
  const jadwal = semua<{
    kelas_id: number;
    kelas: string;
    bagian: string;
    wali_kelas: string | null;
    mapel_id: number;
    mapel: string;
    nama_arab: string | null;
    jam_mulai: string;
    jam_selesai: string;
    pengajar: string | null;
  }>(
    db,
    `SELECT j.kelas_id, k.nama AS kelas, k.bagian, k.wali_kelas, j.mapel_id, m.nama AS mapel, m.nama_arab, j.jam_mulai, j.jam_selesai, km.pengajar
       FROM jadwal j JOIN kelas k ON k.id = j.kelas_id JOIN mapel m ON m.id = j.mapel_id
       LEFT JOIN kelas_mapel km ON km.kelas_id = j.kelas_id AND km.mapel_id = j.mapel_id
      WHERE j.hari = ? AND k.aktif = 1
      ORDER BY j.jam_mulai, k.tingkat, k.nama`,
    hariKe(tanggal),
  );
  const hasil: PelajaranHari[] = [];
  const sudah = new Set<string>();
  for (const j of jadwal) {
    // Pelajaran yang sama dua kali sehari cukup dinilai sekali.
    const kunci = `${j.kelas_id}:${j.mapel_id}`;
    if (sudah.has(kunci)) continue;
    sudah.add(kunci);
    const anggota = satu<{ n: number }>(
      db,
      "SELECT COUNT(*) AS n FROM santri WHERE kelas_id = ? AND status = 'aktif' AND (tanggal_masuk IS NULL OR tanggal_masuk <= ?)",
      j.kelas_id,
      tanggal,
    )!.n;
    const absen = satu<{ n: number; tidak: number }>(
      db,
      "SELECT COUNT(*) AS n, COALESCE(SUM(status != 'H'), 0) AS tidak FROM absensi WHERE kelas_id = ? AND tanggal = ?",
      j.kelas_id,
      tanggal,
    )!;
    const terisi = satu<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM nilai_harian WHERE kelas_id = ? AND mapel_id = ? AND tanggal = ?', j.kelas_id, j.mapel_id, tanggal)!.n;
    const wajib = Math.max(0, anggota - absen.tidak);
    hasil.push({
      kelasId: j.kelas_id,
      kelas: j.kelas,
      bagian: j.bagian,
      mapelId: j.mapel_id,
      mapel: j.mapel,
      mapelArab: j.nama_arab,
      jamMulai: j.jam_mulai,
      jamSelesai: j.jam_selesai,
      pengajar: j.pengajar,
      waliKelas: j.wali_kelas,
      anggota,
      tidakHadir: absen.tidak,
      wajib,
      terisi,
      lengkap: wajib > 0 && terisi >= wajib,
      absensiTerisi: absen.n > 0,
    });
  }
  return hasil;
}

/** Ringkasan untuk dasbor dan halaman nilai harian. */
export function statusHarian(db: DB, tanggal = hariIni()) {
  const p = ambilPengaturan(db);
  const pelajaran = pelajaranHari(db, tanggal);
  return {
    tanggal,
    batas: p.batas_input_jam,
    libur: !!p.jeda_sampai && tanggal <= p.jeda_sampai,
    pelajaran,
    lengkap: pelajaran.filter((x) => x.lengkap).length,
  };
}

function periodeTanggal(db: DB, tanggal: string) {
  const p = satu<{ id: number; mulai: string; selesai: string }>(db, 'SELECT id, mulai, selesai FROM periode WHERE mulai <= ? AND selesai >= ? ORDER BY mulai DESC LIMIT 1', tanggal, tanggal);
  if (!p) throw new GalatPengguna(400, 'Tanggal ini tidak termasuk semester mana pun. Periksa tahun ajaran di Pengaturan.');
  return p;
}

/** Nilai harian semester = rata-rata nilai harian per pertemuan pada rentang semester itu. */
export function hitungUlangHarian(db: DB, santriId: number, mapelId: number, periode: { id: number; mulai: string; selesai: string }) {
  const r = satu<{ rata: number | null }>(
    db,
    'SELECT AVG(nilai) AS rata FROM nilai_harian WHERE santri_id = ? AND mapel_id = ? AND tanggal BETWEEN ? AND ?',
    santriId,
    mapelId,
    periode.mulai,
    periode.selesai,
  )!;
  const harian = r.rata === null ? null : Math.round(r.rata);
  db.prepare(
    `INSERT INTO nilai (santri_id, periode_id, mapel_id, harian, uts, uas, diubah) VALUES (?, ?, ?, ?, NULL, NULL, ?)
     ON CONFLICT(santri_id, periode_id, mapel_id) DO UPDATE SET harian = excluded.harian, diubah = excluded.diubah`,
  ).run(santriId, periode.id, mapelId, harian, sekarang());
}

export function bacaHarian(db: DB, kelasId: number, mapelId: number, tanggal: string) {
  const kelas = satu<{ id: number; nama: string; wali_kelas: string | null }>(db, 'SELECT id, nama, wali_kelas FROM kelas WHERE id = ?', kelasId);
  const mapel = satu<{ id: number; nama: string; nama_arab: string | null; pengajar: string | null }>(
    db,
    'SELECT m.id, m.nama, m.nama_arab, km.pengajar FROM kelas_mapel km JOIN mapel m ON m.id = km.mapel_id WHERE km.kelas_id = ? AND km.mapel_id = ?',
    kelasId,
    mapelId,
  );
  if (!kelas || !mapel) throw new GalatPengguna(404, 'Pelajaran tidak ditemukan di kelas ini.');
  const periode = periodeTanggal(db, tanggal);
  const daftar = semua<{ santriId: number; nis: string; nama: string; jk: string; fotoVersi: string | null; nilai: number | null; absen: string | null; keterangan: string | null; jumlah: number; rata: number | null; terkunci: number }>(
    db,
    `SELECT s.id AS santriId, s.nis, s.nama, s.jk, s.foto_versi AS fotoVersi, nh.nilai, a.status AS absen, a.keterangan,
            (SELECT COUNT(*) FROM nilai_harian x WHERE x.santri_id = s.id AND x.mapel_id = ? AND x.tanggal BETWEEN ? AND ?) AS jumlah,
            (SELECT ROUND(AVG(nilai)) FROM nilai_harian x WHERE x.santri_id = s.id AND x.mapel_id = ? AND x.tanggal BETWEEN ? AND ?) AS rata,
            EXISTS (SELECT 1 FROM raport r WHERE r.santri_id = s.id AND r.periode_id = ? AND r.status = 'terbit') AS terkunci
       FROM santri s
       LEFT JOIN nilai_harian nh ON nh.santri_id = s.id AND nh.mapel_id = ? AND nh.tanggal = ?
       LEFT JOIN absensi a ON a.santri_id = s.id AND a.tanggal = ?
      WHERE s.kelas_id = ? AND s.status = 'aktif' AND (s.tanggal_masuk IS NULL OR s.tanggal_masuk <= ?)
      ORDER BY s.nama`,
    mapelId,
    periode.mulai,
    periode.selesai,
    mapelId,
    periode.mulai,
    periode.selesai,
    periode.id,
    mapelId,
    tanggal,
    tanggal,
    kelasId,
    tanggal,
  );
  return {
    kelas: { id: kelas.id, nama: kelas.nama, waliKelas: kelas.wali_kelas },
    mapel: { id: mapel.id, nama: mapel.nama, namaArab: mapel.nama_arab, pengajar: mapel.pengajar },
    tanggal,
    batas: ambilPengaturan(db).batas_input_jam,
    daftar: daftar.map((d) => ({ ...d, terkunci: !!d.terkunci })),
  };
}

/** Simpan nilai satu pertemuan; nilai kosong menghapus isian. Nilai harian semester langsung diperbarui. */
export function simpanHarian(db: DB, isi: { kelasId: number; mapelId: number; tanggal: string; daftar: { santriId: number; nilai: number | null }[] }, oleh: string) {
  if (isi.tanggal > hariIni()) throw new GalatPengguna(400, 'Nilai harian tidak bisa diisi untuk tanggal yang belum tiba.');
  if (!satu(db, 'SELECT 1 FROM kelas_mapel WHERE kelas_id = ? AND mapel_id = ?', isi.kelasId, isi.mapelId)) {
    throw new GalatPengguna(404, 'Mata pelajaran ini tidak diajarkan di kelas tersebut.');
  }
  const periode = periodeTanggal(db, isi.tanggal);
  let berubah = 0;
  db.transaction(() => {
    for (const n of isi.daftar) {
      const s = satu<{ nama: string }>(db, 'SELECT nama FROM santri WHERE id = ? AND kelas_id = ?', n.santriId, isi.kelasId);
      if (!s) throw new GalatPengguna(400, 'Ada santri yang bukan anggota kelas ini. Muat ulang halaman lalu coba lagi.');
      const lama = satu<{ nilai: number }>(db, 'SELECT nilai FROM nilai_harian WHERE santri_id = ? AND mapel_id = ? AND tanggal = ?', n.santriId, isi.mapelId, isi.tanggal);
      if ((lama?.nilai ?? null) === n.nilai) continue;
      pastikanBelumTerbit(db, n.santriId, periode.id, s.nama);
      if (n.nilai === null) {
        db.prepare('DELETE FROM nilai_harian WHERE santri_id = ? AND mapel_id = ? AND tanggal = ?').run(n.santriId, isi.mapelId, isi.tanggal);
      } else {
        db.prepare(
          `INSERT INTO nilai_harian (santri_id, mapel_id, tanggal, kelas_id, nilai, oleh, diubah) VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(santri_id, mapel_id, tanggal) DO UPDATE SET nilai = excluded.nilai, kelas_id = excluded.kelas_id, oleh = excluded.oleh, diubah = excluded.diubah`,
        ).run(n.santriId, isi.mapelId, isi.tanggal, isi.kelasId, n.nilai, oleh, sekarang());
      }
      hitungUlangHarian(db, n.santriId, isi.mapelId, periode);
      berubah++;
    }
  })();
  return berubah;
}
