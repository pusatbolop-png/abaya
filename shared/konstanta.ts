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

export type JenisRuangan = 'studio' | 'galeri' | 'gudang' | 'kurasi' | 'lobi' | 'kerja' | 'rapat' | 'kontrol' | 'servis';
export const JENIS_RUANGAN: Record<JenisRuangan, string> = {
  studio: 'Studio live',
  galeri: 'Galeri produk',
  gudang: 'Gudang konsinyasi',
  kurasi: 'Ruang kurasi',
  lobi: 'Lobi',
  kerja: 'Ruang kerja bersama',
  rapat: 'Ruang rapat',
  kontrol: 'Ruang kontrol',
  servis: 'Servis',
};

export type Peran = 'admin' | 'petugas';
export const PERAN: Record<Peran, string> = {
  admin: 'Administrator',
  petugas: 'Petugas studio',
};

/** Batas stok yang dianggap menipis. */
export const STOK_MENIPIS = 5;
export const BATAS_BERKAS_BYTE = 5 * 1024 * 1024;
