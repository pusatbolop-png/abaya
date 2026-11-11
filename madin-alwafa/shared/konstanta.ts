// Kosakata domain yang dipakai bersama oleh server dan antarmuka.

export const JENIS_KELAMIN = { L: 'Santri (putra)', P: 'Santriwati (putri)' } as const;
export type JenisKelamin = keyof typeof JENIS_KELAMIN;

export const STATUS_SANTRI = { aktif: 'Aktif', lulus: 'Lulus', pindah: 'Pindah', keluar: 'Keluar' } as const;
export type StatusSantri = keyof typeof STATUS_SANTRI;

export const BAGIAN_KELAS = { putra: 'Putra', putri: 'Putri', campur: 'Putra & putri' } as const;
export type BagianKelas = keyof typeof BAGIAN_KELAS;

export const JENJANG = ['Ula', 'Wustho', 'Ulya'] as const;

/** Kelas Al Wafa’: putra Sayyidina Husein (1) dan Sayyidina Hasan (2), putri Sayyidah Fatimah (1) dan Sayyidah Khodijah (2). */
export const KELAS_AWAL = [
  { nama: 'Sayyidina Husein', jenjang: 'Ula', tingkat: 1, bagian: 'putra' },
  { nama: 'Sayyidah Fatimah', jenjang: 'Ula', tingkat: 1, bagian: 'putri' },
  { nama: 'Sayyidina Hasan', jenjang: 'Ula', tingkat: 2, bagian: 'putra' },
  { nama: 'Sayyidah Khodijah', jenjang: 'Ula', tingkat: 2, bagian: 'putri' },
] as const;


export const STATUS_HADIR = { H: 'Hadir', I: 'Izin', S: 'Sakit', A: 'Alpa' } as const;
export type StatusHadir = keyof typeof STATUS_HADIR;

export const HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu', 'Ahad'] as const;

export const JENIS_HAFALAN = ["Al-Qur'an", 'Nadzom', "Do'a & hadits"] as const;
export const PREDIKAT_HAFALAN = { lancar: 'Lancar', cukup: 'Cukup lancar', ulang: 'Perlu diulang' } as const;
export type PredikatHafalan = keyof typeof PREDIKAT_HAFALAN;

/** Aspek kepribadian di raport, dinilai A–D. */
export const ASPEK_KEPRIBADIAN = [
  { kunci: 'akhlak', label: 'Akhlak', arab: 'الأخلاق' },
  { kunci: 'kerajinan', label: 'Kerajinan', arab: 'المواظبة' },
  { kunci: 'kerapian', label: 'Kerapian', arab: 'النظافة' },
  { kunci: 'kedisiplinan', label: 'Kedisiplinan', arab: 'الانضباط' },
] as const;
export type AspekKepribadian = (typeof ASPEK_KEPRIBADIAN)[number]['kunci'];
export const NILAI_KEPRIBADIAN = { A: 'Baik sekali', B: 'Baik', C: 'Cukup', D: 'Perlu bimbingan' } as const;
export type NilaiKepribadian = keyof typeof NILAI_KEPRIBADIAN;

export const METODE_BAYAR = { tunai: 'Tunai', transfer: 'Transfer', lainnya: 'Lainnya' } as const;
export type MetodeBayar = keyof typeof METODE_BAYAR;

export const SASARAN_PENGUMUMAN = { semua: 'Semua wali santri', putra: 'Wali santri putra', putri: 'Wali santriwati' } as const;

/** Predikat nilai akhir. Batas bawah inklusif, diurutkan dari tertinggi. */
export const PREDIKAT = [
  { min: 90, huruf: 'A', nama: 'Mumtaz', arab: 'ممتاز' },
  { min: 80, huruf: 'B', nama: 'Jayyid jiddan', arab: 'جيد جدا' },
  { min: 70, huruf: 'C', nama: 'Jayyid', arab: 'جيد' },
  { min: 60, huruf: 'D', nama: 'Maqbul', arab: 'مقبول' },
  { min: 0, huruf: 'E', nama: 'Naqish', arab: 'ناقص' },
] as const;

export function predikat(nilai: number) {
  return PREDIKAT.find((p) => nilai >= p.min) ?? PREDIKAT[PREDIKAT.length - 1];
}

export interface Bobot {
  harian: number;
  uts: number;
  uas: number;
}

/** Nilai akhir = rata-rata berbobot komponen. Komponen berbobot 0 tidak wajib diisi. */
export function nilaiAkhir(n: { harian: number | null; uts: number | null; uas: number | null }, b: Bobot): number | null {
  let total = 0;
  for (const k of ['harian', 'uts', 'uas'] as const) {
    if (b[k] === 0) continue;
    const v = n[k];
    if (v === null || v === undefined) return null;
    total += v * b[k];
  }
  const jumlahBobot = b.harian + b.uts + b.uas;
  if (jumlahBobot === 0) return null;
  return Math.round(total / jumlahBobot);
}

/** Peran akun pengurus. Ustadz mengisi absensi, nilai, hafalan, dan raport; administrator mengelola semuanya. */
export const PERAN_PENGURUS = { admin: 'Administrator', ustadz: 'Guru' } as const;
export type PeranPengurus = keyof typeof PERAN_PENGURUS;
