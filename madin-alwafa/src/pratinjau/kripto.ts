// Pengganti server/kripto.ts di pratinjau peramban. Semua data hanya hidup di memori peramban pengunjung,
// jadi yang dibutuhkan hanya keacakan dan pencocokan sandi, bukan perlindungan penyimpanan.
const acak32 = () => crypto.getRandomValues(new Uint32Array(1))[0];

/** Ringkasan 53-bit (cyrb53), cukup untuk membedakan sandi di pratinjau. */
function ringkas(teks: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < teks.length; i++) {
    const k = teks.charCodeAt(i);
    h1 = Math.imul(h1 ^ k, 2654435761);
    h2 = Math.imul(h2 ^ k, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export async function hashSandi(sandi: string) {
  return `pratinjau$${ringkas(sandi.normalize('NFKC'))}`;
}

export async function cocokSandi(sandi: string, tersimpan: string) {
  return tersimpan === `pratinjau$${ringkas(sandi.normalize('NFKC'))}`;
}

export const tokenAcak = () => Array.from({ length: 6 }, () => acak32().toString(36)).join('');
export const hashToken = (t: string) => t;
export const angkaAcak = (batas: number) => Math.floor((acak32() / 4294967296) * batas);
