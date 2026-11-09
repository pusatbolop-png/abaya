// Penyusunan raport: nilai per mapel, peringkat kelas, kepribadian, kehadiran, hafalan, dan penerbitan.
import type { DB } from '../db';
import {
  ASPEK_KEPRIBADIAN,
  NILAI_KEPRIBADIAN,
  PREDIKAT_HAFALAN,
  nilaiAkhir,
  predikat,
  type Bobot,
  type NilaiKepribadian,
  type PredikatHafalan,
} from '../../shared/konstanta';
import { terbilang } from '../../shared/format';
import { GalatPengguna, ambilPengaturan, bobotNilai, buatKodeVerifikasi, lembaga, satu, semua, sekarang, type Lembaga } from '../util';

export interface Periode {
  id: number;
  tahun_ajaran: string;
  semester: 1 | 2;
  mulai: string;
  selesai: string;
  tanggal_raport: string | null;
  aktif: number;
}

export function ambilPeriode(db: DB, id?: number | null): Periode {
  const p = id
    ? satu<Periode>(db, 'SELECT * FROM periode WHERE id = ?', id)
    : satu<Periode>(db, 'SELECT * FROM periode WHERE aktif = 1') ?? satu<Periode>(db, 'SELECT * FROM periode ORDER BY mulai DESC LIMIT 1');
  if (!p) throw new GalatPengguna(404, 'Belum ada tahun ajaran. Buat tahun ajaran dan semester di menu Pengaturan.');
  return p;
}

export interface BarisNilai {
  mapelId: number;
  nama: string;
  namaArab: string | null;
  kitab: string | null;
  pengajar: string | null;
  kkm: number;
  harian: number | null;
  uts: number | null;
  uas: number | null;
  akhir: number | null;
  huruf: string | null;
  predikat: string | null;
  predikatArab: string | null;
  terbilang: string | null;
  tuntas: boolean | null;
}

export interface DataRaport {
  lembaga: Lembaga;
  periode: { id: number; tahunAjaran: string; semester: 1 | 2; mulai: string; selesai: string; tanggalRaport: string | null };
  santri: {
    id: number;
    nis: string;
    nama: string;
    jk: 'L' | 'P';
    tempatLahir: string | null;
    tanggalLahir: string | null;
    namaWali: string | null;
    alamat: string | null;
  };
  kelas: { id: number; nama: string; jenjang: string; tingkat: number; waliKelas: string | null } | null;
  bobot: Bobot;
  mapel: BarisNilai[];
  jumlah: number | null;
  rataRata: number | null;
  peringkat: number | null;
  jumlahSantri: number;
  tampilPeringkat: boolean;
  kepribadian: { kunci: string; label: string; arab: string; nilai: NilaiKepribadian | null; keterangan: string | null }[];
  kehadiran: { hadir: number; sakit: number; izin: number; alpa: number; total: number };
  hafalan: { tanggal: string; jenis: string; materi: string; predikat: string }[];
  catatan: string | null;
  keputusan: string | null;
  status: 'draf' | 'terbit';
  kode: string | null;
  diterbitkan: string | null;
  kekurangan: string[];
}

interface BarisRaport {
  akhlak: NilaiKepribadian | null;
  kerajinan: NilaiKepribadian | null;
  kerapian: NilaiKepribadian | null;
  kedisiplinan: NilaiKepribadian | null;
  catatan: string | null;
  keputusan: string | null;
  status: 'draf' | 'terbit';
  snapshot: string | null;
  kode: string | null;
  diterbitkan: string | null;
}

interface SantriBaris {
  id: number;
  nis: string;
  nama: string;
  jk: 'L' | 'P';
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  nama_wali: string | null;
  nama_ayah: string | null;
  alamat: string | null;
  kelas_id: number | null;
}

/** Mapel kelas beserta nilai santri pada periode tertentu. */
function barisNilai(db: DB, santriId: number, kelasId: number | null, periodeId: number, bobot: Bobot): BarisNilai[] {
  if (!kelasId) return [];
  const baris = semua<{
    mapel_id: number;
    nama: string;
    nama_arab: string | null;
    kitab: string | null;
    pengajar: string | null;
    kkm: number;
    harian: number | null;
    uts: number | null;
    uas: number | null;
  }>(
    db,
    `SELECT m.id AS mapel_id, m.nama, m.nama_arab, m.kitab, km.pengajar, m.kkm, n.harian, n.uts, n.uas
       FROM kelas_mapel km JOIN mapel m ON m.id = km.mapel_id
       LEFT JOIN nilai n ON n.mapel_id = m.id AND n.santri_id = ? AND n.periode_id = ?
      WHERE km.kelas_id = ? ORDER BY m.urutan, m.nama`,
    santriId,
    periodeId,
    kelasId,
  );
  return baris.map((b) => {
    const akhir = nilaiAkhir(b, bobot);
    const p = akhir === null ? null : predikat(akhir);
    return {
      mapelId: b.mapel_id,
      nama: b.nama,
      namaArab: b.nama_arab,
      kitab: b.kitab,
      pengajar: b.pengajar,
      kkm: b.kkm,
      harian: b.harian,
      uts: b.uts,
      uas: b.uas,
      akhir,
      huruf: p?.huruf ?? null,
      predikat: p?.nama ?? null,
      predikatArab: p?.arab ?? null,
      terbilang: akhir === null ? null : terbilang(akhir),
      tuntas: akhir === null ? null : akhir >= b.kkm,
    };
  });
}

const rata = (mapel: BarisNilai[]) => {
  if (!mapel.length || mapel.some((m) => m.akhir === null)) return null;
  const jumlah = mapel.reduce((s, m) => s + (m.akhir ?? 0), 0);
  return { jumlah, rataRata: Math.round((jumlah / mapel.length) * 100) / 100 };
};

/** Peringkat santri di kelasnya berdasarkan rata-rata nilai akhir; nilai sama berbagi peringkat. */
export function peringkatKelas(db: DB, kelasId: number, periodeId: number, bobot: Bobot) {
  const anggota = semua<{ id: number }>(db, "SELECT id FROM santri WHERE kelas_id = ? AND status = 'aktif'", kelasId);
  const nilai = anggota
    .map((a) => ({ id: a.id, r: rata(barisNilai(db, a.id, kelasId, periodeId, bobot))?.rataRata ?? null }))
    .filter((x): x is { id: number; r: number } => x.r !== null)
    .sort((a, b) => b.r - a.r);
  const hasil = new Map<number, number>();
  nilai.forEach((x, i) => hasil.set(x.id, i > 0 && nilai[i - 1].r === x.r ? hasil.get(nilai[i - 1].id)! : i + 1));
  return { peringkat: hasil, jumlahSantri: anggota.length };
}

export function rekapKehadiran(db: DB, santriId: number, mulai: string, selesai: string) {
  const baris = semua<{ status: string; n: number }>(
    db,
    'SELECT status, COUNT(*) AS n FROM absensi WHERE santri_id = ? AND tanggal BETWEEN ? AND ? GROUP BY status',
    santriId,
    mulai,
    selesai,
  );
  const n = (s: string) => baris.find((b) => b.status === s)?.n ?? 0;
  const k = { hadir: n('H'), sakit: n('S'), izin: n('I'), alpa: n('A'), total: 0 };
  k.total = k.hadir + k.sakit + k.izin + k.alpa;
  return k;
}

/** Menyusun raport dari data terkini (tanpa melihat snapshot). */
export function susunRaport(db: DB, santriId: number, periodeId: number): DataRaport {
  const s = satu<SantriBaris>(db, 'SELECT * FROM santri WHERE id = ?', santriId);
  if (!s) throw new GalatPengguna(404, 'Santri tidak ditemukan.');
  const periode = ambilPeriode(db, periodeId);
  const peng = ambilPengaturan(db);
  const bobot = bobotNilai(peng);
  const r = satu<BarisRaport>(db, 'SELECT * FROM raport WHERE santri_id = ? AND periode_id = ?', santriId, periodeId);
  const kelas = s.kelas_id
    ? satu<{ id: number; nama: string; jenjang: string; tingkat: number; wali_kelas: string | null }>(
        db,
        'SELECT id, nama, jenjang, tingkat, wali_kelas FROM kelas WHERE id = ?',
        s.kelas_id,
      )
    : undefined;

  const mapel = barisNilai(db, santriId, s.kelas_id, periodeId, bobot);
  const total = rata(mapel);
  const { peringkat, jumlahSantri } = s.kelas_id ? peringkatKelas(db, s.kelas_id, periodeId, bobot) : { peringkat: new Map(), jumlahSantri: 0 };

  const kepribadian = ASPEK_KEPRIBADIAN.map((a) => {
    const nilai = (r?.[a.kunci] ?? null) as NilaiKepribadian | null;
    return { kunci: a.kunci, label: a.label, arab: a.arab, nilai, keterangan: nilai ? NILAI_KEPRIBADIAN[nilai] : null };
  });

  const hafalan = semua<{ tanggal: string; jenis: string; materi: string; predikat: PredikatHafalan }>(
    db,
    `SELECT tanggal, jenis, materi, predikat FROM hafalan
      WHERE santri_id = ? AND tanggal BETWEEN ? AND ? AND predikat != 'ulang'
      ORDER BY tanggal DESC, id DESC LIMIT 8`,
    santriId,
    periode.mulai,
    periode.selesai,
  ).map((h) => ({ ...h, predikat: PREDIKAT_HAFALAN[h.predikat] }));

  const kekurangan: string[] = [];
  if (!kelas) kekurangan.push('Santri belum masuk kelas.');
  else if (!mapel.length) kekurangan.push(`Kelas ${kelas.nama} belum punya mata pelajaran.`);
  const belum = mapel.filter((m) => m.akhir === null).map((m) => m.nama);
  if (belum.length) kekurangan.push(`Nilai belum lengkap: ${belum.join(', ')}.`);
  const kosong = kepribadian.filter((k) => !k.nilai).map((k) => k.label.toLowerCase());
  if (kosong.length) kekurangan.push(`Kepribadian belum dinilai: ${kosong.join(', ')}.`);
  if (periode.semester === 2 && !r?.keputusan) kekurangan.push('Keputusan kenaikan kelas belum diisi.');

  return {
    lembaga: lembaga(peng),
    periode: {
      id: periode.id,
      tahunAjaran: periode.tahun_ajaran,
      semester: periode.semester,
      mulai: periode.mulai,
      selesai: periode.selesai,
      tanggalRaport: periode.tanggal_raport,
    },
    santri: {
      id: s.id,
      nis: s.nis,
      nama: s.nama,
      jk: s.jk,
      tempatLahir: s.tempat_lahir,
      tanggalLahir: s.tanggal_lahir,
      namaWali: s.nama_wali || s.nama_ayah,
      alamat: s.alamat,
    },
    kelas: kelas ? { id: kelas.id, nama: kelas.nama, jenjang: kelas.jenjang, tingkat: kelas.tingkat, waliKelas: kelas.wali_kelas } : null,
    bobot,
    mapel,
    jumlah: total?.jumlah ?? null,
    rataRata: total?.rataRata ?? null,
    peringkat: peringkat.get(santriId) ?? null,
    jumlahSantri,
    tampilPeringkat: peng.tampil_peringkat === '1',
    kepribadian,
    kehadiran: rekapKehadiran(db, santriId, periode.mulai, periode.selesai),
    hafalan,
    catatan: r?.catatan ?? null,
    keputusan: r?.keputusan ?? null,
    status: r?.status ?? 'draf',
    kode: r?.kode ?? null,
    diterbitkan: r?.diterbitkan ?? null,
    kekurangan,
  };
}

/** Raport yang dilihat: salinan beku bila sudah terbit, susunan terkini bila masih draf. */
export function bacaRaport(db: DB, santriId: number, periodeId: number): DataRaport {
  const r = satu<{ status: string; snapshot: string | null }>(
    db,
    'SELECT status, snapshot FROM raport WHERE santri_id = ? AND periode_id = ?',
    santriId,
    periodeId,
  );
  if (r?.status === 'terbit' && r.snapshot) return JSON.parse(r.snapshot) as DataRaport;
  return susunRaport(db, santriId, periodeId);
}

export function statusRaport(db: DB, santriId: number, periodeId: number) {
  return satu<{ status: string }>(db, 'SELECT status FROM raport WHERE santri_id = ? AND periode_id = ?', santriId, periodeId)?.status ?? 'draf';
}

/** Menolak perubahan nilai atau isian raport yang sudah diterbitkan. */
export function pastikanBelumTerbit(db: DB, santriId: number, periodeId: number, nama?: string) {
  if (statusRaport(db, santriId, periodeId) === 'terbit') {
    throw new GalatPengguna(
      409,
      `Raport ${nama ?? 'santri ini'} sudah diterbitkan. Tarik raport di menu Raport bila nilainya perlu diperbaiki.`,
    );
  }
}

/** Menerbitkan satu raport: membekukan isinya dan memberi kode verifikasi. */
export function terbitkan(db: DB, santriId: number, periodeId: number, pengurusId: number): { ok: true; kode: string } | { ok: false; alasan: string[] } {
  const data = susunRaport(db, santriId, periodeId);
  if (data.kekurangan.length) return { ok: false, alasan: data.kekurangan };
  const lama = satu<{ kode: string | null; status: string }>(db, 'SELECT kode, status FROM raport WHERE santri_id = ? AND periode_id = ?', santriId, periodeId);
  if (lama?.status === 'terbit') return { ok: true, kode: lama.kode! };
  const kode = lama?.kode ?? buatKodeVerifikasi();
  const waktu = sekarang();
  const beku: DataRaport = { ...data, status: 'terbit', kode, diterbitkan: waktu, kekurangan: [] };
  db.prepare(
    `INSERT INTO raport (santri_id, periode_id, status, snapshot, kode, diterbitkan, diterbitkan_oleh)
     VALUES (?, ?, 'terbit', ?, ?, ?, ?)
     ON CONFLICT(santri_id, periode_id) DO UPDATE SET status = 'terbit', snapshot = excluded.snapshot, kode = excluded.kode,
       diterbitkan = excluded.diterbitkan, diterbitkan_oleh = excluded.diterbitkan_oleh, dibaca_wali = NULL`,
  ).run(santriId, periodeId, JSON.stringify(beku), kode, waktu, pengurusId);
  return { ok: true, kode };
}

export function tarik(db: DB, santriId: number, periodeId: number) {
  db.prepare("UPDATE raport SET status = 'draf', snapshot = NULL WHERE santri_id = ? AND periode_id = ?").run(santriId, periodeId);
}
