// Format tanggal (WIB dan Hijriah), rupiah, dan terbilang. Dipakai server dan antarmuka.

export const ZONA = 'Asia/Jakarta';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_HIJRIAH = [
  'Muharram',
  'Shafar',
  "Rabi'ul Awal",
  "Rabi'ul Akhir",
  'Jumadil Awal',
  'Jumadil Akhir',
  'Rajab',
  "Sya'ban",
  'Ramadhan',
  'Syawal',
  "Dzulqa'dah",
  'Dzulhijjah',
];
const HARI_PANJANG = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];

/** Tanggal hari ini menurut WIB, format YYYY-MM-DD. */
export function hariIni(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Bulan berjalan menurut WIB, format YYYY-MM. */
export const bulanIni = (d: Date = new Date()) => hariIni(d).slice(0, 7);

function bagian(tanggal: string) {
  const [y, m, d] = tanggal.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

/** "9 November 2026" dari YYYY-MM-DD. */
export function tanggalPanjang(tanggal: string | null | undefined): string {
  if (!tanggal) return '–';
  const { y, m, d } = bagian(tanggal);
  return `${d} ${BULAN[m - 1]} ${y}`;
}

/** "9 Nov 2026". */
export function tanggalPendek(tanggal: string | null | undefined): string {
  if (!tanggal) return '–';
  const { y, m, d } = bagian(tanggal);
  return `${d} ${BULAN[m - 1].slice(0, 3)} ${y}`;
}

/** "Senin, 9 November 2026". */
export function tanggalHari(tanggal: string): string {
  const { y, m, d } = bagian(tanggal);
  const hari = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${HARI_PANJANG[hari]}, ${tanggalPanjang(tanggal)}`;
}

/** "November 2026" dari YYYY-MM. */
export function namaBulan(bulan: string): string {
  const { y, m } = bagian(bulan + '-01');
  return `${BULAN[m - 1]} ${y}`;
}

export const namaBulanPendek = (bulan: string) => BULAN[Number(bulan.slice(5, 7)) - 1].slice(0, 3);

/** Tanggal Hijriah (Umm al-Qura), mis. "29 Jumadil Awal 1448 H". */
export function tanggalHijriah(tanggal: string): string {
  const { y, m, d } = bagian(tanggal);
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).formatToParts(new Date(Date.UTC(y, m - 1, d, 12)));
    const ambil = (t: string) => Number(parts.find((p) => p.type === t)?.value.replace(/\D/g, ''));
    const bulan = ambil('month');
    const tahun = ambil('year');
    if (!bulan || !tahun) return '';
    return `${ambil('day')} ${BULAN_HIJRIAH[bulan - 1]} ${tahun} H`;
  } catch {
    return '';
  }
}

/** Waktu (ISO UTC) dalam WIB: "9 Nov 2026, 14.05". */
export function waktu(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  const jam = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${tanggalPendek(hariIni(d))}, ${jam}`;
}

export function rupiah(n: number): string {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(Math.round(n));
}

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

/** Terbilang bilangan bulat 0–999 dalam bahasa Indonesia, huruf awal kapital. */
export function terbilang(n: number): string {
  const kata = (x: number): string => {
    if (x < 12) return SATUAN[x];
    if (x < 20) return `${SATUAN[x - 10]} belas`;
    if (x < 100) return `${SATUAN[Math.floor(x / 10)]} puluh${x % 10 ? ' ' + SATUAN[x % 10] : ''}`;
    if (x < 200) return `seratus${x % 100 ? ' ' + kata(x % 100) : ''}`;
    return `${SATUAN[Math.floor(x / 100)]} ratus${x % 100 ? ' ' + kata(x % 100) : ''}`;
  };
  const hasil = n === 0 ? 'nol' : kata(Math.round(n));
  return hasil.charAt(0).toUpperCase() + hasil.slice(1);
}

/** Inisial dua huruf untuk avatar. */
export function inisial(nama: string): string {
  const kata = nama
    .replace(/[^\p{L}\s.]/gu, '')
    .replace(/\./g, ' ')
    .split(/\s+/)
    .filter((k) => k && !/^(bin|binti|al|el|ust|ustdz|ustadz|ustadzah|kh|hj?|kyai|nyai|gus|ning|dr|m)$/i.test(k));
  return ((kata[0]?.[0] ?? '') + (kata[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Nomor HP Indonesia ke format wa.me (62…). */
export function nomorWa(hp: string): string {
  const angka = hp.replace(/\D/g, '');
  if (angka.startsWith('0')) return '62' + angka.slice(1);
  if (angka.startsWith('8')) return '62' + angka;
  return angka;
}

export function tautanWa(hp: string, pesan: string): string {
  return `https://wa.me/${nomorWa(hp)}?text=${encodeURIComponent(pesan)}`;
}

/** Daftar bulan (YYYY-MM) dalam satu tahun ajaran, Juli sampai Juni. */
export function bulanTahunAjaran(tahunAjaran: string): string[] {
  const awal = Number(tahunAjaran.slice(0, 4));
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((6 + i) % 12) + 1;
    const y = i < 6 ? awal : awal + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
  });
}

export function namaSemester(semester: number): string {
  return semester === 1 ? 'Ganjil' : 'Genap';
}

/** Alamat lengkap satu baris: "Dusun Krajan RT 02/RW 01, Desa Kalirejo, Kec. Bangil, Kab. Pasuruan, Jawa Timur". */
export function alamatLengkap(a: { alamat?: string | null; desa?: string | null; kecamatan?: string | null; kabupaten?: string | null; provinsi?: string | null }): string {
  return [
    a.alamat,
    a.desa && (/^(desa|ds\.|kel)/i.test(a.desa) ? a.desa : `Desa ${a.desa}`),
    a.kecamatan && `Kec. ${a.kecamatan}`,
    a.kabupaten?.replace(/^Kabupaten /, 'Kab. '),
    a.provinsi,
  ]
    .filter(Boolean)
    .join(', ');
}
