// Pengganti modul khusus Node untuk pratinjau peramban: hono/cookie, @hono/node-server/conninfo, dan server/config.
// Satu tab peramban = satu pengunjung, jadi sesi cukup disimpan di memori.
const toples = new Map<string, string>();

export function getCookie(_c: unknown, nama?: string) {
  return nama ? toples.get(nama) : Object.fromEntries(toples);
}
export function setCookie(_c: unknown, nama: string, nilai: string) {
  toples.set(nama, nilai);
}
export function deleteCookie(_c: unknown, nama: string) {
  const lama = toples.get(nama);
  toples.delete(nama);
  return lama;
}

export const getConnInfo = () => ({ remote: { address: 'pratinjau' } });

export const config = {
  produksi: true,
  port: 0,
  host: '',
  dataDir: '',
  cookieSecure: false as boolean | 'otomatis',
  demo: true,
  lamaSesiJam: 24 * 7,
  trustProxy: false,
};
