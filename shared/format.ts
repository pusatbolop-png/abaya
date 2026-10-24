// Format angka, uang, dan waktu. Semua waktu ditampilkan dalam WIB.

export const ZONA = 'Asia/Jakarta';
const OFFSET_WIB_MS = 7 * 60 * 60 * 1000;

const fmtAngka = new Intl.NumberFormat('id-ID');
export function angka(n: number | null | undefined): string {
  return fmtAngka.format(n ?? 0);
}

export function rupiah(n: number | null | undefined): string {
  const v = Math.round(n ?? 0);
  const s = fmtAngka.format(Math.abs(v));
  return (v < 0 ? '−Rp ' : 'Rp ') + s;
}

const fmtTanggal = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric' });
const fmtTanggalPendek = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, day: 'numeric', month: 'short' });
const fmtJam = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false });
const fmtHari = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' });

export function tanggal(iso: string | null | undefined): string {
  return iso ? fmtTanggal.format(new Date(iso)) : '—';
}
export function tanggalPendek(iso: string | null | undefined): string {
  return iso ? fmtTanggalPendek.format(new Date(iso)) : '—';
}
export function jam(iso: string | null | undefined): string {
  return iso ? fmtJam.format(new Date(iso)).replace(':', '.') : '—';
}
export function tanggalJam(iso: string | null | undefined): string {
  return iso ? `${tanggalPendek(iso)}, ${jam(iso)}` : '—';
}
export function hari(iso: string): string {
  return fmtHari.format(new Date(iso));
}

/** Tanggal kalender WIB (YYYY-MM-DD) untuk sebuah instan waktu. */
export function tanggalWib(d: Date | string = new Date()): string {
  const t = typeof d === 'string' ? new Date(d) : d;
  return new Date(t.getTime() + OFFSET_WIB_MS).toISOString().slice(0, 10);
}

/** Awal hari WIB (YYYY-MM-DD) sebagai ISO UTC. */
export function awalHariWib(ymd: string): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) - OFFSET_WIB_MS).toISOString();
}
/** Awal hari berikutnya WIB sebagai ISO UTC, untuk batas atas eksklusif. */
export function akhirHariWib(ymd: string): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) - OFFSET_WIB_MS + 86_400_000).toISOString();
}

/** Ubah nilai input datetime-local (dianggap WIB) ke ISO UTC. */
export function wibLokalKeIso(lokal: string): string {
  return new Date(Date.parse(`${lokal}:00Z`) - OFFSET_WIB_MS).toISOString();
}
/** Ubah ISO UTC ke nilai input datetime-local dalam WIB. */
export function isoKeWibLokal(iso: string): string {
  return new Date(Date.parse(iso) + OFFSET_WIB_MS).toISOString().slice(0, 16);
}

/** Nomor WhatsApp Indonesia ke format internasional tanpa tanda plus (62…). */
export function normalisasiWa(nomor: string): string {
  let d = nomor.replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d;
}
export function tampilWa(nomor: string | null | undefined): string {
  if (!nomor) return '—';
  const d = normalisasiWa(nomor);
  const lokal = '0' + d.slice(2);
  return lokal.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
}
export function tautanWa(nomor: string, pesan?: string): string {
  const q = pesan ? `?text=${encodeURIComponent(pesan)}` : '';
  return `https://wa.me/${normalisasiWa(nomor)}${q}`;
}
