// Skema basis data dan migrasinya. Tanpa impor Node, sehingga juga dipakai pratinjau peramban.
import type { DB } from './db';

export const MIGRASI: string[] = [
  /* 1 */ `
  CREATE TABLE pengaturan (
    kunci TEXT PRIMARY KEY,
    nilai TEXT NOT NULL
  );

  CREATE TABLE pengurus (
    id INTEGER PRIMARY KEY,
    nama TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    sandi TEXT NOT NULL,
    peran TEXT NOT NULL CHECK (peran IN ('admin','ustadz')),
    hp TEXT,
    aktif INTEGER NOT NULL DEFAULT 1,
    masuk_terakhir TEXT,
    dibuat TEXT NOT NULL
  );

  CREATE TABLE sesi (
    token TEXT PRIMARY KEY,
    jenis TEXT NOT NULL CHECK (jenis IN ('pengurus','wali')),
    subjek_id INTEGER NOT NULL,
    kedaluwarsa TEXT NOT NULL
  );

  CREATE TABLE periode (
    id INTEGER PRIMARY KEY,
    tahun_ajaran TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK (semester IN (1,2)),
    mulai TEXT NOT NULL,
    selesai TEXT NOT NULL,
    tanggal_raport TEXT,
    aktif INTEGER NOT NULL DEFAULT 0,
    UNIQUE (tahun_ajaran, semester)
  );

  CREATE TABLE kelas (
    id INTEGER PRIMARY KEY,
    nama TEXT NOT NULL UNIQUE COLLATE NOCASE,
    jenjang TEXT NOT NULL,
    tingkat INTEGER NOT NULL,
    bagian TEXT NOT NULL CHECK (bagian IN ('putra','putri','campur')),
    wali_kelas TEXT,
    ruang TEXT,
    aktif INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE mapel (
    id INTEGER PRIMARY KEY,
    nama TEXT NOT NULL UNIQUE COLLATE NOCASE,
    nama_arab TEXT,
    kitab TEXT,
    urutan INTEGER NOT NULL DEFAULT 0,
    kkm INTEGER NOT NULL DEFAULT 60
  );

  CREATE TABLE kelas_mapel (
    kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
    mapel_id INTEGER NOT NULL REFERENCES mapel(id),
    pengajar TEXT,
    PRIMARY KEY (kelas_id, mapel_id)
  );

  CREATE TABLE jadwal (
    id INTEGER PRIMARY KEY,
    kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
    hari INTEGER NOT NULL CHECK (hari BETWEEN 1 AND 7),
    jam_mulai TEXT NOT NULL,
    jam_selesai TEXT NOT NULL,
    mapel_id INTEGER NOT NULL REFERENCES mapel(id)
  );
  CREATE INDEX jadwal_kelas ON jadwal(kelas_id, hari);

  CREATE TABLE santri (
    id INTEGER PRIMARY KEY,
    nis TEXT NOT NULL UNIQUE COLLATE NOCASE,
    nama TEXT NOT NULL,
    jk TEXT NOT NULL CHECK (jk IN ('L','P')),
    tempat_lahir TEXT,
    tanggal_lahir TEXT,
    alamat TEXT,
    nama_ayah TEXT,
    nama_ibu TEXT,
    nama_wali TEXT,
    hp_wali TEXT,
    kelas_id INTEGER REFERENCES kelas(id),
    status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','lulus','pindah','keluar')),
    tanggal_masuk TEXT,
    sandi TEXT NOT NULL,
    sandi_diganti INTEGER NOT NULL DEFAULT 0,
    masuk_terakhir TEXT,
    dibuat TEXT NOT NULL
  );
  CREATE INDEX santri_kelas ON santri(kelas_id, status);

  CREATE TABLE absensi (
    santri_id INTEGER NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    tanggal TEXT NOT NULL,
    kelas_id INTEGER REFERENCES kelas(id),
    status TEXT NOT NULL CHECK (status IN ('H','I','S','A')),
    keterangan TEXT,
    PRIMARY KEY (santri_id, tanggal)
  );
  CREATE INDEX absensi_kelas ON absensi(kelas_id, tanggal);

  CREATE TABLE nilai (
    santri_id INTEGER NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    periode_id INTEGER NOT NULL REFERENCES periode(id),
    mapel_id INTEGER NOT NULL REFERENCES mapel(id),
    harian INTEGER CHECK (harian BETWEEN 0 AND 100),
    uts INTEGER CHECK (uts BETWEEN 0 AND 100),
    uas INTEGER CHECK (uas BETWEEN 0 AND 100),
    diubah TEXT NOT NULL,
    PRIMARY KEY (santri_id, periode_id, mapel_id)
  );

  CREATE TABLE raport (
    santri_id INTEGER NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    periode_id INTEGER NOT NULL REFERENCES periode(id),
    akhlak TEXT,
    kerajinan TEXT,
    kerapian TEXT,
    kedisiplinan TEXT,
    catatan TEXT,
    keputusan TEXT,
    status TEXT NOT NULL DEFAULT 'draf' CHECK (status IN ('draf','terbit')),
    snapshot TEXT,
    kode TEXT UNIQUE,
    diterbitkan TEXT,
    diterbitkan_oleh INTEGER REFERENCES pengurus(id),
    dibaca_wali TEXT,
    PRIMARY KEY (santri_id, periode_id)
  );

  CREATE TABLE hafalan (
    id INTEGER PRIMARY KEY,
    santri_id INTEGER NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    tanggal TEXT NOT NULL,
    jenis TEXT NOT NULL,
    materi TEXT NOT NULL,
    predikat TEXT NOT NULL CHECK (predikat IN ('lancar','cukup','ulang')),
    catatan TEXT,
    penyimak TEXT,
    dibuat TEXT NOT NULL
  );
  CREATE INDEX hafalan_santri ON hafalan(santri_id, tanggal);

  CREATE TABLE syahriah (
    id INTEGER PRIMARY KEY,
    santri_id INTEGER NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    bulan TEXT NOT NULL,
    nominal INTEGER NOT NULL CHECK (nominal >= 0),
    tanggal_bayar TEXT NOT NULL,
    metode TEXT NOT NULL,
    catatan TEXT,
    dicatat_oleh INTEGER REFERENCES pengurus(id),
    dibuat TEXT NOT NULL,
    UNIQUE (santri_id, bulan)
  );

  CREATE TABLE pengumuman (
    id INTEGER PRIMARY KEY,
    judul TEXT NOT NULL,
    isi TEXT NOT NULL,
    sasaran TEXT NOT NULL DEFAULT 'semua',
    penting INTEGER NOT NULL DEFAULT 0,
    terbit TEXT NOT NULL,
    dibuat_oleh INTEGER REFERENCES pengurus(id)
  );

  CREATE TABLE log_aktivitas (
    id INTEGER PRIMARY KEY,
    waktu TEXT NOT NULL,
    pelaku TEXT NOT NULL,
    aksi TEXT NOT NULL,
    detail TEXT
  );
  `,
];

export function migrasi(db: DB) {
  const versi = db.pragma('user_version', { simple: true }) as number;
  for (let i = versi; i < MIGRASI.length; i++) {
    db.transaction(() => {
      db.exec(MIGRASI[i]);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}
