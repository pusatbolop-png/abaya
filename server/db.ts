import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { RUANGAN_AWAL, PENGATURAN_AWAL, INSTANSI_AWAL, DENAH_LANTAI1_V2 } from './defaults';

export type DB = Database.Database;

const MIGRASI: string[] = [
  /* 1 */ `
  CREATE TABLE pengaturan (
    kunci TEXT PRIMARY KEY,
    nilai TEXT NOT NULL
  );

  CREATE TABLE pengguna (
    id INTEGER PRIMARY KEY,
    nama TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    sandi TEXT NOT NULL,
    peran TEXT NOT NULL CHECK (peran IN ('admin','petugas')),
    aktif INTEGER NOT NULL DEFAULT 1,
    dibuat TEXT NOT NULL
  );

  CREATE TABLE sesi_masuk (
    token TEXT PRIMARY KEY,
    pengguna_id INTEGER NOT NULL REFERENCES pengguna(id),
    kedaluwarsa TEXT NOT NULL
  );

  CREATE TABLE nomor_urut (
    kunci TEXT PRIMARY KEY,
    nilai INTEGER NOT NULL
  );

  CREATE TABLE umkm (
    id INTEGER PRIMARY KEY,
    kode TEXT NOT NULL UNIQUE,
    nama_usaha TEXT NOT NULL,
    pemilik TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    email TEXT,
    alamat TEXT NOT NULL,
    kecamatan TEXT NOT NULL,
    kategori TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    media_sosial TEXT,
    bank TEXT,
    no_rekening TEXT,
    atas_nama TEXT,
    status TEXT NOT NULL DEFAULT 'diajukan',
    skor TEXT,
    catatan_seleksi TEXT,
    diputuskan TEXT,
    diputuskan_oleh INTEGER REFERENCES pengguna(id),
    dibuat TEXT NOT NULL
  );
  CREATE INDEX umkm_status ON umkm(status);

  CREATE TABLE izin_umkm (
    umkm_id INTEGER NOT NULL REFERENCES umkm(id) ON DELETE CASCADE,
    kunci TEXT NOT NULL,
    nomor TEXT,
    berkas TEXT,
    berkas_nama TEXT,
    status TEXT NOT NULL DEFAULT 'belum_ada',
    catatan TEXT,
    diperiksa TEXT,
    PRIMARY KEY (umkm_id, kunci)
  );

  CREATE TABLE produk (
    id INTEGER PRIMARY KEY,
    umkm_id INTEGER NOT NULL REFERENCES umkm(id),
    nama TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    harga INTEGER NOT NULL CHECK (harga >= 0),
    satuan TEXT NOT NULL DEFAULT 'pcs',
    aktif INTEGER NOT NULL DEFAULT 1,
    dibuat TEXT NOT NULL
  );
  CREATE INDEX produk_umkm ON produk(umkm_id);

  CREATE TABLE mutasi_stok (
    id INTEGER PRIMARY KEY,
    produk_id INTEGER NOT NULL REFERENCES produk(id),
    jenis TEXT NOT NULL,
    jumlah INTEGER NOT NULL,
    ref_jenis TEXT,
    ref_id INTEGER,
    catatan TEXT,
    pengguna_id INTEGER REFERENCES pengguna(id),
    dibuat TEXT NOT NULL
  );
  CREATE INDEX mutasi_produk ON mutasi_stok(produk_id);

  CREATE TABLE ruangan (
    id INTEGER PRIMARY KEY,
    kode TEXT NOT NULL UNIQUE,
    nama TEXT NOT NULL,
    jenis TEXT NOT NULL,
    lantai INTEGER NOT NULL,
    x REAL NOT NULL,
    z REAL NOT NULL,
    lebar REAL NOT NULL,
    panjang REAL NOT NULL,
    kapasitas INTEGER,
    urutan INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE sesi_live (
    id INTEGER PRIMARY KEY,
    ruangan_id INTEGER NOT NULL REFERENCES ruangan(id),
    judul TEXT NOT NULL,
    platform TEXT NOT NULL,
    host TEXT NOT NULL,
    jadwal_mulai TEXT NOT NULL,
    jadwal_selesai TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'terjadwal',
    mulai TEXT,
    selesai TEXT,
    catatan TEXT,
    dibuat_oleh INTEGER REFERENCES pengguna(id),
    dibuat TEXT NOT NULL
  );
  CREATE INDEX sesi_jadwal ON sesi_live(jadwal_mulai);

  CREATE TABLE sesi_produk (
    sesi_id INTEGER NOT NULL REFERENCES sesi_live(id) ON DELETE CASCADE,
    produk_id INTEGER NOT NULL REFERENCES produk(id),
    PRIMARY KEY (sesi_id, produk_id)
  );

  CREATE TABLE penjualan (
    id INTEGER PRIMARY KEY,
    nomor TEXT NOT NULL UNIQUE,
    sesi_id INTEGER REFERENCES sesi_live(id),
    kanal TEXT NOT NULL,
    nomor_pesanan TEXT,
    pembeli TEXT,
    tanggal TEXT NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'selesai',
    alasan_batal TEXT,
    dibuat_oleh INTEGER REFERENCES pengguna(id),
    dibuat TEXT NOT NULL
  );
  CREATE INDEX penjualan_tanggal ON penjualan(tanggal);

  CREATE TABLE item_penjualan (
    id INTEGER PRIMARY KEY,
    penjualan_id INTEGER NOT NULL REFERENCES penjualan(id),
    produk_id INTEGER NOT NULL REFERENCES produk(id),
    umkm_id INTEGER NOT NULL REFERENCES umkm(id),
    jumlah INTEGER NOT NULL CHECK (jumlah > 0),
    harga INTEGER NOT NULL,
    subtotal INTEGER NOT NULL
  );
  CREATE INDEX item_penjualan_umkm ON item_penjualan(umkm_id);

  CREATE TABLE retur (
    id INTEGER PRIMARY KEY,
    nomor TEXT NOT NULL UNIQUE,
    penjualan_id INTEGER NOT NULL REFERENCES penjualan(id),
    tanggal TEXT NOT NULL,
    alasan TEXT NOT NULL,
    total INTEGER NOT NULL,
    dibuat_oleh INTEGER REFERENCES pengguna(id),
    dibuat TEXT NOT NULL
  );

  CREATE TABLE item_retur (
    id INTEGER PRIMARY KEY,
    retur_id INTEGER NOT NULL REFERENCES retur(id),
    item_penjualan_id INTEGER NOT NULL REFERENCES item_penjualan(id),
    umkm_id INTEGER NOT NULL REFERENCES umkm(id),
    jumlah INTEGER NOT NULL CHECK (jumlah > 0),
    kondisi TEXT NOT NULL,
    nilai INTEGER NOT NULL
  );

  CREATE TABLE pencairan (
    id INTEGER PRIMARY KEY,
    nomor TEXT NOT NULL UNIQUE,
    umkm_id INTEGER NOT NULL REFERENCES umkm(id),
    sampai TEXT NOT NULL,
    bruto INTEGER NOT NULL,
    retur INTEGER NOT NULL,
    potongan INTEGER NOT NULL,
    jumlah INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'disiapkan',
    referensi_transfer TEXT,
    dibayar TEXT,
    catatan TEXT,
    dibuat_oleh INTEGER REFERENCES pengguna(id),
    dibuat TEXT NOT NULL
  );

  CREATE TABLE aktivitas (
    id INTEGER PRIMARY KEY,
    pengguna_id INTEGER REFERENCES pengguna(id),
    aksi TEXT NOT NULL,
    entitas TEXT NOT NULL,
    entitas_id INTEGER,
    ringkasan TEXT NOT NULL,
    dibuat TEXT NOT NULL
  );
  `,
  /* 2 */ `
  ALTER TABLE ruangan ADD COLUMN sisi_pintu TEXT NOT NULL DEFAULT 'depan';
  DELETE FROM pengaturan WHERE kunci = 'keuangan';
  `,
  /* 3 */ `SELECT 1;`,
];

export function bukaDb(file = path.join(config.dataDir, 'pcc.sqlite')): DB {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrasi(db);
  return db;
}

function migrasi(db: DB) {
  const versi = db.pragma('user_version', { simple: true }) as number;
  if (versi >= MIGRASI.length) return;
  db.transaction(() => {
    for (let i = versi; i < MIGRASI.length; i++) db.exec(MIGRASI[i]);
    if (versi === 0) isiAwal(db);
    else if (versi < 2) sesuaikanVersi1(db);
    if (versi > 0) sesuaikanVersi2(db);
    db.pragma(`user_version = ${MIGRASI.length}`);
  })();
}

function isiRuangan(db: DB) {
  const ruang = db.prepare(
    `INSERT INTO ruangan (kode, nama, jenis, lantai, x, z, lebar, panjang, kapasitas, sisi_pintu, urutan)
     VALUES (@kode, @nama, @jenis, @lantai, @x, @z, @lebar, @panjang, @kapasitas, @sisi_pintu, @urutan)`,
  );
  RUANGAN_AWAL.forEach((r, i) => ruang.run({ ...r, urutan: i }));
}

/** Isian struktural yang dibutuhkan aplikasi untuk berjalan, bukan data contoh. */
function isiAwal(db: DB) {
  const setel = db.prepare('INSERT INTO pengaturan (kunci, nilai) VALUES (?, ?)');
  for (const [k, v] of Object.entries(PENGATURAN_AWAL)) setel.run(k, JSON.stringify(v));
  isiRuangan(db);
}

/**
 * Basis data versi 1 memakai denah dan instansi sementara. Ganti dengan denah sketsa dan
 * dua instansi resmi, kecuali bila sudah dipakai (ada sesi live) atau sudah diisi admin.
 */
function sesuaikanVersi1(db: DB) {
  const adaSesi = (db.prepare('SELECT COUNT(*) AS n FROM sesi_live').get() as { n: number }).n > 0;
  if (!adaSesi) {
    db.exec('DELETE FROM ruangan');
    isiRuangan(db);
    db.prepare("UPDATE pengaturan SET nilai = 'false' WHERE kunci = 'denahTerkonfirmasi'").run();
  }
  const baris = db.prepare("SELECT nilai FROM pengaturan WHERE kunci = 'instansi'").get() as { nilai: string } | undefined;
  const lama = baris ? (JSON.parse(baris.nilai) as { instansi: string }[]) : [];
  if (lama.every((i) => !i.instansi)) {
    db.prepare("INSERT INTO pengaturan (kunci, nilai) VALUES ('instansi', ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai").run(JSON.stringify(INSTANSI_AWAL));
  }
}

/**
 * Versi 3 menata ulang lantai 1 mengikuti sketsa lengkap: layanan Disperindag dan Dinkes di belakang,
 * tangga pindah ke tengah aula. Ruangan yang ukurannya sudah diubah admin dibiarkan.
 */
function sesuaikanVersi2(db: DB) {
  const ubah = db.prepare('UPDATE ruangan SET x = ?, z = ?, lebar = ?, panjang = ? WHERE kode = ? AND x = ? AND z = ? AND lebar = ? AND panjang = ?');
  const ada = db.prepare('SELECT 1 FROM ruangan WHERE kode = ?');
  const tambah = db.prepare(
    `INSERT INTO ruangan (kode, nama, jenis, lantai, x, z, lebar, panjang, kapasitas, sisi_pintu, urutan)
     VALUES (@kode, @nama, @jenis, @lantai, @x, @z, @lebar, @panjang, @kapasitas, @sisi_pintu, @urutan)`,
  );
  let berubah = false;
  RUANGAN_AWAL.forEach((r, i) => {
    const lama = DENAH_LANTAI1_V2[r.kode];
    if (lama) berubah = ubah.run(r.x, r.z, r.lebar, r.panjang, r.kode, ...lama).changes > 0 || berubah;
    else if (!ada.get(r.kode)) {
      tambah.run({ ...r, urutan: i });
      berubah = true;
    }
  });
  if (berubah) db.prepare("UPDATE pengaturan SET nilai = 'false' WHERE kunci = 'denahTerkonfirmasi'").run();
}

export function sekarang(): string {
  return new Date().toISOString();
}
