// Bentuk data dari API yang dipakai di banyak halaman.
export interface Lembaga {
  nama: string;
  namaArab: string;
  singkatan: string;
  naungan: string;
  slogan: string;
  alamat: string;
  kota: string;
  telepon: string;
  kepala: string;
  demo: boolean;
}

export interface Pengurus {
  id: number;
  nama: string;
  username: string;
  peran: 'admin' | 'ustadz';
}

export interface Wali {
  santriId: number;
  nama: string;
  nis: string;
  jk: 'L' | 'P';
  sandiDiganti: boolean;
}

export interface Saya {
  lembaga: Lembaga;
  demo: { username: string; sandi: string; nis: string; sandiWali: string } | null;
  perluPasang: boolean;
  pengurus: Pengurus | null;
  wali: Wali | null;
}

export interface Kelas {
  id: number;
  nama: string;
  jenjang: string;
  tingkat: number;
  bagian: 'putra' | 'putri' | 'campur';
  waliKelas: string | null;
  ruang: string | null;
  aktif: number;
  putra: number;
  putri: number;
  jumlahMapel: number;
}

export interface Periode {
  id: number;
  tahunAjaran: string;
  semester: 1 | 2;
  mulai: string;
  selesai: string;
  tanggalRaport: string | null;
  aktif: number;
  raportTerbit: number;
}

export interface Santri {
  id: number;
  nis: string;
  nama: string;
  jk: 'L' | 'P';
  tempatLahir: string | null;
  tanggalLahir: string | null;
  alamat: string | null;
  namaAyah: string | null;
  namaIbu: string | null;
  namaWali: string | null;
  hpWali: string | null;
  kelasId: number | null;
  kelasNama: string | null;
  status: 'aktif' | 'lulus' | 'pindah' | 'keluar';
  tanggalMasuk: string | null;
  sandiDiganti: boolean;
  masukTerakhir: string | null;
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
  santri: { id: number; nis: string; nama: string; jk: 'L' | 'P'; tempatLahir: string | null; tanggalLahir: string | null; namaWali: string | null; alamat: string | null };
  kelas: { id: number; nama: string; jenjang: string; tingkat: number; waliKelas: string | null } | null;
  bobot: { harian: number; uts: number; uas: number };
  mapel: BarisNilai[];
  jumlah: number | null;
  rataRata: number | null;
  peringkat: number | null;
  jumlahSantri: number;
  tampilPeringkat: boolean;
  kepribadian: { kunci: string; label: string; arab: string; nilai: 'A' | 'B' | 'C' | 'D' | null; keterangan: string | null }[];
  kehadiran: { hadir: number; sakit: number; izin: number; alpa: number; total: number };
  hafalan: { tanggal: string; jenis: string; materi: string; predikat: string }[];
  catatan: string | null;
  keputusan: string | null;
  status: 'draf' | 'terbit';
  kode: string | null;
  diterbitkan: string | null;
  kekurangan: string[];
}

export interface Hafalan {
  id: number;
  santriId?: number;
  nama?: string;
  nis?: string;
  jk?: 'L' | 'P';
  kelas?: string | null;
  tanggal: string;
  jenis: string;
  materi: string;
  predikat: 'lancar' | 'cukup' | 'ulang';
  catatan: string | null;
  penyimak: string | null;
}

export interface Pengumuman {
  id: number;
  judul: string;
  isi: string;
  sasaran: string;
  penting: number;
  terbit: string;
  penulis?: string | null;
  kelas?: string | null;
}
