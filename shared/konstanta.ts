// Kosakata domain yang dipakai bersama oleh server dan antarmuka.
// Label ditulis dalam bahasa Indonesia baku, siap tampil apa adanya.

export const KATEGORI_USAHA = [
  'Kuliner',
  'Minuman',
  'Fesyen',
  'Kriya',
  'Kecantikan dan perawatan',
  'Hasil tani olahan',
  'Lainnya',
] as const;

export const KECAMATAN_PASURUAN = [
  'Bangil', 'Beji', 'Gempol', 'Gondangwetan', 'Grati', 'Kejayan', 'Kraton', 'Lekok',
  'Lumbang', 'Nguling', 'Pandaan', 'Pasrepan', 'Pohjentrek', 'Prigen', 'Purwodadi',
  'Purwosari', 'Puspo', 'Rejoso', 'Rembang', 'Sukorejo', 'Tosari', 'Tutur', 'Winongan',
  'Wonorejo',
  // Kota Pasuruan
  'Bugul Kidul', 'Gadingrejo', 'Panggungrejo', 'Purworejo',
] as const;

export type StatusUmkm = 'diajukan' | 'perlu_perbaikan' | 'diterima' | 'ditolak';
export const STATUS_UMKM: Record<StatusUmkm, string> = {
  diajukan: 'Menunggu seleksi',
  perlu_perbaikan: 'Perlu perbaikan',
  diterima: 'Diterima',
  ditolak: 'Tidak lolos',
};

export type StatusIzin = 'belum_ada' | 'diunggah' | 'terverifikasi' | 'tidak_valid';
export const STATUS_IZIN: Record<StatusIzin, string> = {
  belum_ada: 'Belum ada',
  diunggah: 'Menunggu verifikasi',
  terverifikasi: 'Terverifikasi',
  tidak_valid: 'Tidak valid',
};

/** Kriteria penilaian seleksi, masing-masing bernilai 1–5. */
export const KRITERIA_SELEKSI = [
  { kunci: 'mutu', label: 'Mutu produk' },
  { kunci: 'kemasan', label: 'Kemasan dan label' },
  { kunci: 'kapasitas', label: 'Kesiapan stok' },
  { kunci: 'pasar', label: 'Daya tarik untuk siaran live' },
] as const;
export type KunciKriteria = (typeof KRITERIA_SELEKSI)[number]['kunci'];

export const PLATFORM_LIVE = ['TikTok Shop', 'Shopee Live', 'Instagram Live', 'Tokopedia Play', 'Lainnya'] as const;
export const KANAL_PENJUALAN = [...PLATFORM_LIVE, 'Penjualan langsung di galeri'] as const;

export type StatusSesi = 'terjadwal' | 'berlangsung' | 'selesai' | 'batal';
export const STATUS_SESI: Record<StatusSesi, string> = {
  terjadwal: 'Terjadwal',
  berlangsung: 'Sedang siaran',
  selesai: 'Selesai',
  batal: 'Dibatalkan',
};

export type JenisMutasi = 'masuk' | 'terjual' | 'retur_pembeli' | 'kembali_umkm' | 'rusak' | 'penyesuaian' | 'batal_jual';
export const JENIS_MUTASI: Record<JenisMutasi, string> = {
  masuk: 'Barang masuk dari UMKM',
  terjual: 'Terjual',
  retur_pembeli: 'Retur pembeli, layak jual',
  kembali_umkm: 'Dikembalikan ke UMKM',
  rusak: 'Rusak atau hilang',
  penyesuaian: 'Penyesuaian hasil hitung',
  batal_jual: 'Penjualan dibatalkan',
};
/** Jenis mutasi yang boleh dicatat manual oleh petugas. */
export const MUTASI_MANUAL = ['masuk', 'kembali_umkm', 'rusak', 'penyesuaian'] as const;

export type KondisiRetur = 'layak_jual' | 'rusak';
export const KONDISI_RETUR: Record<KondisiRetur, string> = {
  layak_jual: 'Layak jual, kembali ke stok',
  rusak: 'Rusak, dikembalikan ke UMKM',
};

export type StatusPencairan = 'disiapkan' | 'dibayar' | 'batal';
export const STATUS_PENCAIRAN: Record<StatusPencairan, string> = {
  disiapkan: 'Menunggu transfer',
  dibayar: 'Sudah ditransfer',
  batal: 'Dibatalkan',
};

export type JenisRuangan = 'studio' | 'podcast' | 'kelas' | 'toilet' | 'galeri' | 'gudang' | 'kurasi' | 'lobi' | 'kerja' | 'rapat' | 'kontrol' | 'servis' | 'layanan';
export const JENIS_RUANGAN: Record<JenisRuangan, string> = {
  studio: 'Studio live',
  podcast: 'Studio podcast',
  kelas: 'Ruang belajar',
  toilet: 'Toilet',
  galeri: 'Galeri produk',
  gudang: 'Gudang konsinyasi',
  kurasi: 'Ruang kurasi',
  lobi: 'Resepsionis',
  kerja: 'Ruang tim',
  rapat: 'Ruang rapat',
  kontrol: 'Ruang kontrol',
  servis: 'Servis',
  layanan: 'Layanan perizinan',
};

export type Peran = 'admin' | 'petugas';
export const PERAN: Record<Peran, string> = {
  admin: 'Administrator',
  petugas: 'Petugas studio',
};

/** Ruangan yang bisa dijadwalkan untuk siaran dan memiliki lampu ON AIR. */
export const RUANG_SIARAN: readonly JenisRuangan[] = ['studio', 'podcast'];

export const SISI_PINTU = { depan: 'Depan (arah pintu masuk)', belakang: 'Belakang', kiri: 'Kiri', kanan: 'Kanan' } as const;

/** Batas stok yang dianggap menipis. */
/** Staf yang berkantor di sebuah ruangan; tampil sebagai figur dan papan nama meja di maket 3D. */
export interface StafRuang {
  nama: string;
  perempuan: boolean;
}
export const BATAS_STAF_RUANG = 8;

export const STOK_MENIPIS = 5;

// ——— Program PCC (Blueprint Pasuruan Creative Center) ———

/** Kanal penjualan luring; kanal lain dianggap marketplace daring berjangkauan nasional. */
export const KANAL_LURING = 'Penjualan langsung di galeri';

/** Daftar periksa inkubasi UMKM (Pilar 3): legalitas, standar produk, dan kesiapan pasar. */
export const LANGKAH_INKUBASI = [
  { kunci: 'nib', label: 'NIB terbit' },
  { kunci: 'pirt', label: 'SPP-IRT (PIRT)' },
  { kunci: 'halal', label: 'Sertifikat halal' },
  { kunci: 'haki', label: 'Merek terdaftar (HAKI)' },
  { kunci: 'kemasan', label: 'Kemasan terstandar' },
  { kunci: 'marketplace', label: 'Toko marketplace dikelola' },
  { kunci: 'produksi', label: 'Siap produksi massal' },
] as const;
export type KunciInkubasi = (typeof LANGKAH_INKUBASI)[number]['kunci'];
export type StatusInkubasi = 'belum' | 'selesai' | 'tidak_berlaku';
export const STATUS_INKUBASI: Record<StatusInkubasi, string> = { belum: 'Belum', selesai: 'Selesai', tidak_berlaku: 'Tidak berlaku' };

/** Keluaran Content Factory (Pilar 4). */
export const JENIS_KONTEN = {
  video: 'Video pendek',
  foto: 'Foto produk',
  ugc: 'Konten UGC',
  materi: 'Materi affiliate dan host',
} as const;
export type JenisKonten = keyof typeof JENIS_KONTEN;
export const PLATFORM_KONTEN = ['TikTok', 'Shopee', 'Instagram', 'Tokopedia', 'YouTube', 'Lainnya'] as const;

export const STATUS_AFFILIATE = { aktif: 'Aktif', jeda: 'Jeda', berhenti: 'Berhenti' } as const;
export type StatusAffiliate = keyof typeof STATUS_AFFILIATE;

/** Target kinerja tahun pertama (Blueprint PCC). Dapat disesuaikan admin di Pengaturan. */
export interface TargetProgram {
  terinkubasi: number;
  produkNasional: number;
  studioAktif: number;
  affiliate: number;
  kontenPerTahun: number;
  kenaikanOmzet: number;
}
export const TARGET_BAWAAN: TargetProgram = {
  terinkubasi: 100,
  produkNasional: 30,
  studioAktif: 5,
  affiliate: 100,
  kontenPerTahun: 3000,
  kenaikanOmzet: 20,
};

/** Roadmap akselerasi 100 hari pertama. */
export const ROADMAP_100 = [
  { dari: 1, sampai: 30, judul: 'Konsolidasi internal', isi: 'Pembentukan tim inti dan penyusunan SOP operasional PCC.' },
  { dari: 31, sampai: 60, judul: 'Akuisisi', isi: 'PCC Call UMKM dan kurasi produk unggulan.' },
  { dari: 61, sampai: 80, judul: 'Infrastruktur digital', isi: 'Digitalisasi produk, standardisasi, dan optimasi toko marketplace.' },
  { dari: 81, sampai: 100, judul: 'Go live dan scale', isi: 'Aktivasi Content Factory, Live Commerce Center, dan jaringan affiliate.' },
] as const;
export const BATAS_BERKAS_BYTE = 5 * 1024 * 1024;
