import { TARGET_BAWAAN, type JenisRuangan, type StafRuang, type TargetProgram } from '../shared/konstanta';

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

export interface Pengaturan {
  organisasi: Organisasi;
  instansi: Instansi[];
  logo: string | null;
  /** Ditandai admin setelah ukuran ruangan dicocokkan dengan gambar kerja gedung. */
  denahTerkonfirmasi: boolean;
  /** Diisi 'demo' hanya oleh skrip data contoh. */
  mode: 'produksi' | 'demo';
  /** Tanggal mulai operasional (YYYY-MM-DD, WIB) dan target tahun pertama. */
  program: { mulai: string; target: TargetProgram };
}

export const INSTANSI_AWAL: Instansi[] = [
  { kunci: 'izin_1', instansi: 'Dinas Perindustrian dan Perdagangan (Disperindag)', dokumen: 'Nomor Induk Berusaha (NIB)', wajib: true },
  { kunci: 'izin_2', instansi: 'Dinas Kesehatan (Dinkes)', dokumen: 'Sertifikat Produksi Pangan Industri Rumah Tangga (SPP-IRT)', wajib: false },
];

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
  // Dua instansi perizinan yang ditetapkan pemilik program. Nama dokumen bisa diubah di Pengaturan.
  instansi: INSTANSI_AWAL,
  logo: null,
  denahTerkonfirmasi: false,
  mode: 'produksi',
  program: { mulai: '', target: TARGET_BAWAAN },
};

export type SisiPintu = 'depan' | 'belakang' | 'kiri' | 'kanan';

export interface RuanganAwal {
  kode: string;
  nama: string;
  jenis: JenisRuangan;
  lantai: number;
  /** Jarak dari dinding kiri gedung (dilihat dari sketsa, pintu masuk di atas), meter. */
  x: number;
  /** Jarak dari dinding depan gedung (sisi pintu masuk), meter. */
  z: number;
  lebar: number;
  panjang: number;
  kapasitas: number | null;
  sisi_pintu: SisiPintu;
  staf?: StafRuang[];
}

// Denah mengikuti sketsa pemilik program (25 Oktober 2026): pintu masuk di sisi depan,
// resepsionis di kiri depan, dua studio live di kiri dan dua di kanan, ruang podcast di depan lantai 2.
// Ukuran meter masih perkiraan dari proporsi sketsa dan bisa disesuaikan di Pengaturan.
export const RUANGAN_AWAL: RuanganAwal[] = [
  { kode: '1.01', nama: 'Resepsionis', jenis: 'lobi', lantai: 1, x: 0, z: 0, lebar: 5, panjang: 3.8, kapasitas: 6, sisi_pintu: 'kanan' },
  { kode: '1.02', nama: 'Studio Live 1', jenis: 'studio', lantai: 1, x: 0, z: 4.8, lebar: 5, panjang: 4.2, kapasitas: 4, sisi_pintu: 'kanan' },
  { kode: '1.03', nama: 'Studio Live 2', jenis: 'studio', lantai: 1, x: 0, z: 11.2, lebar: 6, panjang: 5.6, kapasitas: 4, sisi_pintu: 'kanan' },
  { kode: '1.04', nama: 'Studio Live 3', jenis: 'studio', lantai: 1, x: 12, z: 2.7, lebar: 6, panjang: 3.8, kapasitas: 4, sisi_pintu: 'kiri' },
  { kode: '1.05', nama: 'Studio Live 4', jenis: 'studio', lantai: 1, x: 12, z: 9.9, lebar: 6, panjang: 6, kapasitas: 4, sisi_pintu: 'kiri' },
  { kode: '1.06', nama: 'Layanan Disperindag', jenis: 'layanan', lantai: 1, x: 5.5, z: 17.4, lebar: 4.5, panjang: 2.6, kapasitas: 4, sisi_pintu: 'depan' },
  { kode: '1.07', nama: 'Layanan Dinkes', jenis: 'layanan', lantai: 1, x: 11.5, z: 17.4, lebar: 5, panjang: 2.6, kapasitas: 4, sisi_pintu: 'depan' },
  { kode: '2.01', nama: 'Ruang Podcast', jenis: 'podcast', lantai: 2, x: 3.5, z: 0, lebar: 10, panjang: 4.5, kapasitas: 6, sisi_pintu: 'belakang' },
  { kode: '2.02', nama: 'Ruang Belajar AI', jenis: 'kelas', lantai: 2, x: 0, z: 6, lebar: 6, panjang: 6.5, kapasitas: 16, sisi_pintu: 'kanan' },
  { kode: '2.03', nama: 'Ruang Tim Ahli', jenis: 'kerja', lantai: 2, x: 10, z: 6, lebar: 8, panjang: 6.5, kapasitas: 10, sisi_pintu: 'kiri',
    staf: [
      { nama: 'Bang Jack', perempuan: false },
      { nama: 'Didin', perempuan: false },
      { nama: 'Achmad', perempuan: false },
      { nama: 'Devita', perempuan: true },
    ],
  },
  { kode: '2.04', nama: 'Ruang Rapat', jenis: 'rapat', lantai: 2, x: 0, z: 15, lebar: 7, panjang: 5, kapasitas: 12, sisi_pintu: 'depan' },
  { kode: '2.05', nama: 'Toilet', jenis: 'toilet', lantai: 2, x: 10, z: 17, lebar: 2, panjang: 3, kapasitas: null, sisi_pintu: 'depan' },
  { kode: '2.06', nama: 'Toilet', jenis: 'toilet', lantai: 2, x: 13, z: 17, lebar: 2, panjang: 3, kapasitas: null, sisi_pintu: 'depan' },
];

/** Bentuk gedung dan elemen tetap untuk denah 3D (meter, koordinat sama dengan ruangan). */
export const PELAT_LANTAI = {
  lebar: 18,
  panjang: 20,
  tinggi: 3.6,
  pintuMasuk: { x: 6.5, lebar: 3 },
  // Tangga luar di kiri pintu masuk (dilihat dari halaman): naik sejajar fasad dari teras pintu
  // ke bordes dan pintu kaca lantai 2, sehingga aula lantai 1 lapang tanpa void tangga.
  tangga: { x: 10.7, panjang: 5.4, lebar: 1.2, jarak: 0.3, bordes: 1.9 },
};

/** Denah lantai 1 versi 2 (sebelum layanan perizinan ditambahkan), untuk mengenali ruangan yang belum diubah admin. */
export const DENAH_LANTAI1_V2: Record<string, [x: number, z: number, lebar: number, panjang: number]> = {
  '1.01': [0, 0, 5, 4],
  '1.02': [0, 5.5, 5, 5],
  '1.03': [0, 13.5, 6, 6.5],
  '1.04': [12, 3, 6, 4.5],
  '1.05': [12, 11.5, 6, 8],
};
