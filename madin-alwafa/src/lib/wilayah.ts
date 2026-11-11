// Data kecamatan seluruh Indonesia (Kemendagri via idn-area-data, ODbL), dimuat saat isian alamat dibuka.

export interface Kecamatan {
  kode: string; // 35.14.14
  kecamatan: string;
  kabupaten: string; // Kabupaten Pasuruan / Kota Pasuruan
  provinsi: string;
  kunci: string; // huruf kecil untuk pencarian
}

let janji: Promise<Kecamatan[]> | null = null;

export function muatWilayah(): Promise<Kecamatan[]> {
  janji ??= import('../data/wilayah.json').then(({ default: d }) => {
    const data = d as { prov: Record<string, string>; kab: Record<string, string>; kec: Record<string, string> };
    const hasil: Kecamatan[] = [];
    for (const [kodeKab, daftar] of Object.entries(data.kec)) {
      const kabupaten = data.kab[kodeKab];
      const provinsi = data.prov[kodeKab.slice(0, 2)];
      for (const isi of daftar.split('|')) {
        const kecamatan = isi.slice(3);
        hasil.push({ kode: `${kodeKab}.${isi.slice(0, 2)}`, kecamatan, kabupaten, provinsi, kunci: `${kecamatan} ${kabupaten} ${provinsi}`.toLowerCase() });
      }
    }
    return hasil;
  });
  return janji;
}

const normal = (t: string) =>
  t
    .toLowerCase()
    .replace(/\bkab(upaten)?\.?\s*/g, '')
    .replace(/\bkec(amatan)?\.?\s*/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

/**
 * Cari kecamatan: "bangil", "beji pasuruan", atau "kec. pandaan". Yang paling dekat dengan madrasah
 * (kabupaten lalu provinsi yang sama) didahulukan.
 */
export function cariKecamatan(daftar: Kecamatan[], kata: string, dekat = '35.14', batas = 8): Kecamatan[] {
  const q = normal(kata);
  if (q.length < 2) return [];
  const token = q.split(/\s+/);
  const nilai: { k: Kecamatan; skor: number }[] = [];
  for (const k of daftar) {
    if (!token.every((t) => k.kunci.includes(t))) continue;
    const nama = k.kecamatan.toLowerCase();
    let skor = 0;
    if (nama === token[0]) skor += 100;
    else if (nama.startsWith(token[0])) skor += 60;
    else if (nama.split(/\s+/).some((b) => b.startsWith(token[0]))) skor += 40;
    if (k.kode.startsWith(dekat)) skor += 30;
    else if (k.kode.startsWith(dekat.slice(0, 2))) skor += 15;
    nilai.push({ k, skor });
  }
  return nilai
    .sort((a, b) => b.skor - a.skor || a.k.kecamatan.localeCompare(b.k.kecamatan))
    .slice(0, batas)
    .map((n) => n.k);
}
