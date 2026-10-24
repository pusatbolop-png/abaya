import type { JenisRuangan } from '../shared/konstanta';

export interface Organisasi {
  nama: string;
  singkat: string;
  /** Pemerintah daerah yang menaungi, tampil di bawah nama lembaga. */
  naungan: string;
  alamat: string;
  whatsapp: string;
  email: string;
  jamLayanan: string;
}

export interface Instansi {
  kunci: string;
  /** Nama instansi penerbit. Kosong berarti belum diatur oleh admin. */
  instansi: string;
  dokumen: string;
  wajib: boolean;
}

export interface Keuangan {
  /** Potongan jasa pengelola dalam persen dari penjualan bersih. */
  potonganPersen: number;
}

export interface Pengaturan {
  organisasi: Organisasi;
  instansi: Instansi[];
  keuangan: Keuangan;
  logo: string | null;
  /** Ditandai admin setelah ukuran ruangan dicocokkan dengan gambar kerja gedung. */
  denahTerkonfirmasi: boolean;
  /** Diisi 'demo' hanya oleh skrip data contoh. */
  mode: 'produksi' | 'demo';
}

export const PENGATURAN_AWAL: Pengaturan = {
  organisasi: {
    nama: 'Pasuruan Creative Center',
    singkat: 'PCC',
    naungan: 'Pemerintah Kabupaten Pasuruan',
    alamat: '',
    whatsapp: '',
    email: '',
    jamLayanan: 'Senin–Jumat, 08.00–16.00 WIB',
  },
  // Nama instansi sengaja dikosongkan sampai dikonfirmasi pemilik program.
  instansi: [
    { kunci: 'izin_1', instansi: '', dokumen: 'Nomor Induk Berusaha (NIB)', wajib: true },
    { kunci: 'izin_2', instansi: '', dokumen: 'Izin edar pangan (SPP-IRT atau BPOM)', wajib: false },
    { kunci: 'izin_3', instansi: '', dokumen: 'Sertifikat halal', wajib: false },
  ],
  keuangan: { potonganPersen: 0 },
  logo: null,
  denahTerkonfirmasi: false,
  mode: 'produksi',
};

export interface RuanganAwal {
  kode: string;
  nama: string;
  jenis: JenisRuangan;
  lantai: number;
  x: number;
  z: number;
  lebar: number;
  panjang: number;
  kapasitas: number | null;
}

// Denah kerja sementara, 24 × 16 m per lantai, koridor 2 m di tengah.
// Ukuran asli menunggu gambar kerja gedung; semuanya bisa diubah di Pengaturan.
export const RUANGAN_AWAL: RuanganAwal[] = [
  { kode: '1.01', nama: 'Studio Live 1', jenis: 'studio', lantai: 1, x: 0, z: 0, lebar: 6, panjang: 7, kapasitas: 4 },
  { kode: '1.02', nama: 'Studio Live 2', jenis: 'studio', lantai: 1, x: 6, z: 0, lebar: 6, panjang: 7, kapasitas: 4 },
  { kode: '1.03', nama: 'Ruang Kontrol', jenis: 'kontrol', lantai: 1, x: 12, z: 0, lebar: 4, panjang: 7, kapasitas: 3 },
  { kode: '1.04', nama: 'Gudang Konsinyasi', jenis: 'gudang', lantai: 1, x: 16, z: 0, lebar: 8, panjang: 7, kapasitas: null },
  { kode: '1.05', nama: 'Galeri Produk', jenis: 'galeri', lantai: 1, x: 0, z: 9, lebar: 9, panjang: 7, kapasitas: 30 },
  { kode: '1.06', nama: 'Lobi', jenis: 'lobi', lantai: 1, x: 9, z: 9, lebar: 7, panjang: 7, kapasitas: 20 },
  { kode: '1.07', nama: 'Ruang Kurasi', jenis: 'kurasi', lantai: 1, x: 16, z: 9, lebar: 6, panjang: 7, kapasitas: 8 },
  { kode: '2.01', nama: 'Studio Live 3', jenis: 'studio', lantai: 2, x: 0, z: 0, lebar: 6, panjang: 7, kapasitas: 4 },
  { kode: '2.02', nama: 'Studio Live 4', jenis: 'studio', lantai: 2, x: 6, z: 0, lebar: 6, panjang: 7, kapasitas: 4 },
  { kode: '2.03', nama: 'Ruang Rapat', jenis: 'rapat', lantai: 2, x: 12, z: 0, lebar: 6, panjang: 7, kapasitas: 12 },
  { kode: '2.04', nama: 'Ruang Kerja Bersama', jenis: 'kerja', lantai: 2, x: 0, z: 9, lebar: 14, panjang: 7, kapasitas: 24 },
  { kode: '2.05', nama: 'Ruang Kelas', jenis: 'kurasi', lantai: 2, x: 14, z: 9, lebar: 8, panjang: 7, kapasitas: 20 },
];

/** Ukuran pelat lantai yang dipakai denah 3D. */
export const PELAT_LANTAI = { lebar: 24, panjang: 16, tinggi: 3.4 };
