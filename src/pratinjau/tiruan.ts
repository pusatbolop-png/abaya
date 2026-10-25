// Tiruan API untuk pratinjau statis. Membaca rekaman respons server demo dan menolak perubahan data
// dengan pesan yang jelas, sehingga seluruh halaman bisa dijelajahi tanpa server.
import data from 'virtual:rekaman';
import logo from '../../public/merek/lambang-pcc.png?inline';
import { AKUN_PRATINJAU } from '../lib/pratinjau';

const LOGO = '/merek/lambang-pcc.png';
let masuk = false;

function json(status: number, isi: unknown) {
  const teks = JSON.stringify(isi).replaceAll(`"${LOGO}"`, JSON.stringify(logo));
  return new Response(teks, { status, headers: { 'content-type': 'application/json' } });
}
const galat = (status: number, pesan: string) => json(status, { galat: { pesan } });
const jeda = () => new Promise((r) => setTimeout(r, 120));
const angka = (s: string) => s.replace(/\D/g, '').replace(/^62/, '0');

function cariRekaman(u: URL) {
  const kunci = u.pathname + u.search;
  const tepat = data.rekaman[kunci] ?? data.rekaman[u.pathname] ?? data.rekaman[u.pathname + '?'];
  if (tepat && !u.searchParams.has('q')) return tepat;
  // Catatan konten bulan yang tidak direkam berarti bulan itu kosong, bukan bulan lain.
  if (u.pathname === '/api/konten') return { status: 200, isi: { bulan: u.searchParams.get('bulan'), daftar: [], hitung: {} } };
  // Tanggal atau kata kunci berbeda: pakai rekaman lain untuk alamat yang sama.
  const status = u.searchParams.get('status');
  const dasar =
    (status && data.rekaman[`${u.pathname}?status=${status}`]) ||
    tepat ||
    Object.entries(data.rekaman).find(([k]) => k.split('?')[0] === u.pathname)?.[1];
  const q = u.searchParams.get('q')?.toLowerCase();
  if (!dasar || !q) return dasar;
  const isi = dasar.isi as { daftar?: unknown[] };
  if (!Array.isArray(isi.daftar)) return dasar;
  return { ...dasar, isi: { ...isi, daftar: isi.daftar.filter((b) => JSON.stringify(b).toLowerCase().includes(q)) } };
}

async function tangani(url: string, init?: RequestInit): Promise<Response> {
  await jeda();
  const u = new URL(url, 'http://pratinjau.pcc');
  const metode = (init?.method ?? 'GET').toUpperCase();
  const isi = typeof init?.body === 'string' ? JSON.parse(init.body) : {};

  if (u.pathname === '/api/auth/saya') return json(200, { pengguna: masuk ? data.admin.pengguna : null });
  if (u.pathname === '/api/auth/masuk' && metode === 'POST') {
    if (String(isi.email).trim().toLowerCase() === AKUN_PRATINJAU.email && isi.sandi === AKUN_PRATINJAU.sandi) {
      masuk = true;
      return json(200, { pengguna: data.admin.pengguna });
    }
    return galat(401, `Di pratinjau ini, masuk dengan email ${AKUN_PRATINJAU.email} dan kata sandi ${AKUN_PRATINJAU.sandi}.`);
  }
  if (u.pathname === '/api/auth/keluar') {
    masuk = false;
    return json(200, { ok: true });
  }
  if (u.pathname === '/api/publik/status' && metode === 'POST') {
    const r = data.status[String(isi.kode ?? '').trim().toUpperCase()];
    if (r && angka(r.whatsapp) === angka(String(isi.whatsapp ?? ''))) return json(200, r.isi);
    return galat(404, 'Pendaftaran tidak ditemukan. Pastikan kode dan nomor WhatsApp sama persis dengan yang dipakai saat mendaftar.');
  }
  if (metode !== 'GET') {
    return galat(403, 'Ini pratinjau dengan data contoh, jadi perubahan tidak disimpan. Data baru bisa disimpan setelah aplikasi dipasang di server PCC.');
  }
  if (!u.pathname.startsWith('/api/publik/') && !masuk) return galat(401, 'Masuk terlebih dahulu.');
  const r = cariRekaman(u);
  return r ? json(r.status, r.isi) : galat(404, 'Data ini tidak termasuk dalam pratinjau.');
}

const fetchAsli = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return url.startsWith('/api/') ? tangani(url, init) : fetchAsli(input, init);
};
