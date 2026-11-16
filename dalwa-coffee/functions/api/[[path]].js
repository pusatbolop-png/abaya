// API toko Dalwa Coffee untuk Cloudflare Pages Functions.
// Semua alamat /api/* ditangani di sini.
//
// Yang perlu dipasang di Cloudflare (Pages → proyek → Settings):
//   - Bindings → D1 database, nama variabel: DB
//   - Variables and Secrets → ADMIN_PASSWORD (jenis Secret): kata sandi dasbor admin
// Tabel dibuat otomatis pada permintaan pertama.
//
// Publik:  GET  /api/toko            harga, ketersediaan, nomor WhatsApp
//          POST /api/pesanan         buat pesanan (harga dihitung di server, bukan dari peramban)
// Admin:   POST /api/admin/masuk     {sandi} → cookie sesi
//          POST /api/admin/keluar
//          GET  /api/admin/saya
//          GET  /api/admin/ringkasan
//          GET  /api/admin/pesanan?status=&q=&halaman=
//          GET  /api/admin/pesanan/:kode
//          PATCH /api/admin/pesanan/:kode   {status, ongkir, kurir, resi, catatan_admin}
//          GET  /api/admin/ekspor             CSV semua pesanan
//          GET  /api/admin/produk
//          PATCH /api/admin/produk/:id      {harga, aktif}
//          GET/PUT /api/admin/pengaturan    {whatsapp}

const PRODUK_AWAL = [
  ['arabica-250g', 'Arabica', '250 g', 400000, 1],
  ['arabica-420g', 'Arabica', '420 g', 400000, 2],
  ['arabica-1kg', 'Arabica', '1 kg', 400000, 3],
  ['robusta-250g', 'Robusta', '250 g', 400000, 4],
  ['robusta-420g', 'Robusta', '420 g', 400000, 5],
  ['robusta-1kg', 'Robusta', '1 kg', 400000, 6],
];
const STATUS = ['baru', 'dikonfirmasi', 'dikemas', 'dikirim', 'selesai', 'batal'];
const SESI_JAM = 12;

const SKEMA = [
  `CREATE TABLE IF NOT EXISTS produk (id TEXT PRIMARY KEY, varian TEXT NOT NULL, berat TEXT NOT NULL,
     harga INTEGER NOT NULL, aktif INTEGER NOT NULL DEFAULT 1, urutan INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS pesanan (id INTEGER PRIMARY KEY AUTOINCREMENT, kode TEXT UNIQUE NOT NULL,
     dibuat TEXT NOT NULL, diubah TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'baru',
     nama TEXT NOT NULL, hp TEXT NOT NULL, alamat TEXT NOT NULL, bayar TEXT NOT NULL, catatan TEXT,
     subtotal INTEGER NOT NULL, ongkir INTEGER, kurir TEXT, resi TEXT, catatan_admin TEXT, ip TEXT)`,
  `CREATE TABLE IF NOT EXISTS item_pesanan (pesanan_id INTEGER NOT NULL, produk_id TEXT NOT NULL,
     nama TEXT NOT NULL, harga INTEGER NOT NULL, jumlah INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS item_pesanan_pesanan ON item_pesanan (pesanan_id)`,
  `CREATE INDEX IF NOT EXISTS pesanan_status ON pesanan (status, dibuat)`,
  `CREATE TABLE IF NOT EXISTS pengaturan (kunci TEXT PRIMARY KEY, nilai TEXT)`,
  `CREATE TABLE IF NOT EXISTS percobaan (jenis TEXT NOT NULL, ip TEXT NOT NULL, waktu INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS percobaan_ip ON percobaan (jenis, ip, waktu)`,
];

let siap = false;
async function siapkan(db) {
  if (siap) return;
  await db.batch(SKEMA.map(s => db.prepare(s)));
  const ada = await db.prepare('SELECT COUNT(*) AS n FROM produk').first();
  if (!ada.n) {
    await db.batch(PRODUK_AWAL.map(([id, varian, berat, harga, urutan]) =>
      db.prepare('INSERT INTO produk (id, varian, berat, harga, aktif, urutan) VALUES (?, ?, ?, ?, 1, ?)').bind(id, varian, berat, harga, urutan)));
  }
  await db.prepare("INSERT OR IGNORE INTO pengaturan (kunci, nilai) VALUES ('whatsapp', '6287818181330')").run();
  siap = true;
}

// ---------- bantuan ----------
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});
const gagal = (pesan, status = 400) => json({ galat: pesan }, status);
const sekarang = () => new Date().toISOString();
const teks = (v, maks) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, maks) : '');
const ipDari = req => req.headers.get('CF-Connecting-IP') || 'lokal';

async function bacaJson(req) {
  try { return await req.json(); } catch { return null; }
}
// Batasi percobaan: jenis 'pesan' (anti-spam) dan 'masuk' (anti tebak kata sandi).
async function terlaluSering(db, jenis, ip, batas, detik) {
  const sejak = Date.now() - detik * 1000;
  await db.prepare('DELETE FROM percobaan WHERE waktu < ?').bind(Date.now() - 86400000).run();
  const r = await db.prepare('SELECT COUNT(*) AS n FROM percobaan WHERE jenis = ? AND ip = ? AND waktu > ?').bind(jenis, ip, sejak).first();
  return r.n >= batas;
}
const catatPercobaan = (db, jenis, ip) => db.prepare('INSERT INTO percobaan (jenis, ip, waktu) VALUES (?, ?, ?)').bind(jenis, ip, Date.now()).run();

function kodePesanan() {
  const d = new Date(Date.now() + 7 * 3600000); // tanggal WIB
  const tgl = d.toISOString().slice(2, 10).replace(/-/g, '');
  const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', acak = crypto.getRandomValues(new Uint8Array(4));
  return `DLW-${tgl}-${[...acak].map(b => huruf[b % huruf.length]).join('')}`;
}

// ---------- sesi admin: token bertanda tangan HMAC dari ADMIN_PASSWORD ----------
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function kunci(env) {
  return crypto.subtle.importKey('raw', enc.encode('dalwa-sesi:' + env.ADMIN_PASSWORD), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
async function tandaTangan(env, isi) { return b64u(await crypto.subtle.sign('HMAC', await kunci(env), enc.encode(isi))); }
function samaPersis(a, b) {
  if (a.length !== b.length) return false;
  let beda = 0; for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}
async function buatSesi(env) {
  const isi = String(Date.now() + SESI_JAM * 3600000);
  return `${isi}.${await tandaTangan(env, isi)}`;
}
async function sesiSah(env, req) {
  if (!env.ADMIN_PASSWORD) return false;
  const m = /(?:^|;\s*)dalwa_admin=([^;]+)/.exec(req.headers.get('cookie') || '');
  if (!m) return false;
  const [isi, ttd] = m[1].split('.');
  if (!isi || !ttd || Number(isi) < Date.now()) return false;
  return samaPersis(ttd, await tandaTangan(env, isi));
}
const cookieSesi = (nilai, umur) => `dalwa_admin=${nilai}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${umur}`;

// ---------- publik ----------
async function toko(db) {
  const produk = (await db.prepare('SELECT id, harga, aktif FROM produk ORDER BY urutan').all()).results;
  const wa = await db.prepare("SELECT nilai FROM pengaturan WHERE kunci = 'whatsapp'").first();
  return json({ produk, whatsapp: wa ? wa.nilai : '' }); // tanpa cache: perubahan harga di dasbor langsung terlihat
}

async function buatPesanan(db, req) {
  const ip = ipDari(req);
  if (await terlaluSering(db, 'pesan', ip, 6, 600)) return gagal('Terlalu banyak pesanan dari perangkat ini. Coba lagi beberapa menit lagi.', 429);
  const b = await bacaJson(req);
  if (!b || typeof b !== 'object') return gagal('Data pesanan tidak terbaca.');
  if (b.situs) return json({ kode: 'DLW-000000-OK' }); // kolom jebakan untuk robot: diam-diam diabaikan

  const p = b.penerima || {}, a = b.alamat || {};
  const nama = teks(p.nama, 80), hp = teks(p.hp, 20).replace(/[\s-]/g, '');
  if (!nama) return gagal('Nama penerima wajib diisi.');
  if (!/^(\+?62|0)8\d{7,12}$/.test(hp)) return gagal('No. WhatsApp tidak valid (contoh: 081234567890).');
  const alamat = {
    provinsi: teks(a.provinsi, 60), kota: teks(a.kota, 80), kecamatan: teks(a.kecamatan, 80), kelurahan: teks(a.kelurahan, 80),
    jalan: teks(a.jalan, 160), no: teks(a.no, 20), rt: teks(a.rt, 3), rw: teks(a.rw, 3), kodepos: teks(a.kodepos, 5), patokan: teks(a.patokan, 120),
  };
  for (const k of ['provinsi', 'kota', 'kecamatan', 'kelurahan', 'jalan', 'no', 'rt', 'rw', 'kodepos'])
    if (!alamat[k]) return gagal('Alamat belum lengkap. Lengkapi semua kolom yang wajib.');
  if (!/^\d{5}$/.test(alamat.kodepos)) return gagal('Kode pos harus 5 angka.');
  const bayar = b.bayar === 'Transfer bank / QRIS' ? 'Transfer bank / QRIS' : 'COD (bayar di tempat)';

  // gabungkan item kembar, lalu ambil harga dari basis data
  const jumlah = new Map();
  for (const it of Array.isArray(b.items) ? b.items.slice(0, 20) : []) {
    const q = Math.floor(Number(it && it.qty));
    if (typeof it.id === 'string' && q > 0) jumlah.set(it.id, Math.min(99, (jumlah.get(it.id) || 0) + q));
  }
  if (!jumlah.size) return gagal('Keranjang kosong.');
  const produk = (await db.prepare(`SELECT * FROM produk WHERE id IN (${[...jumlah.keys()].map(() => '?').join(',')})`).bind(...jumlah.keys()).all()).results;
  if (produk.length !== jumlah.size) return gagal('Ada produk yang tidak dikenal. Muat ulang halaman lalu coba lagi.');
  const habis = produk.filter(x => !x.aktif);
  if (habis.length) return gagal(`Maaf, ${habis.map(x => `${x.varian} ${x.berat}`).join(', ')} sedang habis.`, 409);
  const items = produk.map(x => ({ id: x.id, nama: `${x.varian} ${x.berat}`, harga: x.harga, jumlah: jumlah.get(x.id) }));
  const subtotal = items.reduce((t, x) => t + x.harga * x.jumlah, 0);

  const waktu = sekarang();
  let kode, id;
  for (let coba = 0; coba < 5 && !id; coba++) {
    kode = kodePesanan();
    try {
      const r = await db.prepare(`INSERT INTO pesanan (kode, dibuat, diubah, nama, hp, alamat, bayar, catatan, subtotal, ip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(kode, waktu, waktu, nama, hp, JSON.stringify(alamat), bayar, teks(b.catatan, 300), subtotal, ip).run();
      id = r.meta.last_row_id;
    } catch (err) { if (!/UNIQUE/i.test(String(err))) throw err; }
  }
  await db.batch(items.map(x => db.prepare('INSERT INTO item_pesanan (pesanan_id, produk_id, nama, harga, jumlah) VALUES (?, ?, ?, ?, ?)')
    .bind(id, x.id, x.nama, x.harga, x.jumlah)));
  await catatPercobaan(db, 'pesan', ip);
  return json({ kode, subtotal, items }, 201);
}

// ---------- admin ----------
async function detailPesanan(db, kode) {
  const p = await db.prepare('SELECT * FROM pesanan WHERE kode = ?').bind(kode).first();
  if (!p) return null;
  p.alamat = JSON.parse(p.alamat);
  p.items = (await db.prepare('SELECT produk_id, nama, harga, jumlah FROM item_pesanan WHERE pesanan_id = ?').bind(p.id).all()).results;
  delete p.ip;
  return p;
}

async function admin(db, env, req, jalur) {
  const [bagian, kodeAtauId] = jalur;
  const metode = req.method;

  if (bagian === 'masuk' && metode === 'POST') {
    if (!env.ADMIN_PASSWORD) return gagal('Kata sandi admin belum dipasang di Cloudflare (ADMIN_PASSWORD).', 503);
    const ip = ipDari(req);
    if (await terlaluSering(db, 'masuk', ip, 5, 900)) return gagal('Terlalu banyak percobaan. Tunggu 15 menit lalu coba lagi.', 429);
    const b = await bacaJson(req);
    const [ttd1, ttd2] = await Promise.all([tandaTangan(env, 'cek:' + String(b && b.sandi || '')), tandaTangan(env, 'cek:' + env.ADMIN_PASSWORD)]);
    if (!samaPersis(ttd1, ttd2)) { await catatPercobaan(db, 'masuk', ip); return gagal('Kata sandi salah.', 401); }
    return json({ ok: true }, 200, { 'set-cookie': cookieSesi(await buatSesi(env), SESI_JAM * 3600) });
  }
  if (bagian === 'keluar') return json({ ok: true }, 200, { 'set-cookie': cookieSesi('', 0) });
  if (!(await sesiSah(env, req))) return gagal('Silakan masuk dulu.', 401);
  if (bagian === 'saya') return json({ ok: true });

  if (bagian === 'ringkasan') {
    const wibHariIni = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    const awalHari = new Date(wibHariIni + 'T00:00:00+07:00').toISOString();
    const awalBulan = new Date(wibHariIni.slice(0, 7) + '-01T00:00:00+07:00').toISOString();
    const per = (await db.prepare('SELECT status, COUNT(*) AS n FROM pesanan GROUP BY status').all()).results;
    const hari = await db.prepare("SELECT COUNT(*) AS n FROM pesanan WHERE dibuat >= ? AND status != 'batal'").bind(awalHari).first();
    // jumlah pesanan bulan ini: semua kecuali batal; omzet: hanya yang sudah dikonfirmasi admin
    const bulan = await db.prepare(`SELECT COUNT(*) AS n,
      COALESCE(SUM(CASE WHEN status NOT IN ('baru', 'batal') THEN subtotal END), 0) AS omzet
      FROM pesanan WHERE dibuat >= ? AND status != 'batal'`).bind(awalBulan).first();
    const laris = (await db.prepare(`SELECT i.nama, SUM(i.jumlah) AS jumlah FROM item_pesanan i JOIN pesanan p ON p.id = i.pesanan_id
      WHERE p.dibuat >= ? AND p.status != 'batal' GROUP BY i.produk_id ORDER BY jumlah DESC LIMIT 6`).bind(awalBulan).all()).results;
    const terbaru = (await db.prepare("SELECT kode, dibuat, nama, subtotal, status FROM pesanan ORDER BY id DESC LIMIT 5").all()).results;
    return json({ status: Object.fromEntries(per.map(r => [r.status, r.n])), hari_ini: hari.n, bulan_ini: bulan, laris, terbaru });
  }

  if (bagian === 'pesanan' && !kodeAtauId && metode === 'GET') {
    const u = new URL(req.url), status = u.searchParams.get('status') || '', q = teks(u.searchParams.get('q') || '', 60);
    const halaman = Math.max(1, Number(u.searchParams.get('halaman')) || 1), per = 25;
    const syarat = [], nilai = [];
    if (STATUS.includes(status)) { syarat.push('status = ?'); nilai.push(status); }
    if (q) { syarat.push('(kode LIKE ? OR nama LIKE ? OR hp LIKE ?)'); nilai.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const where = syarat.length ? 'WHERE ' + syarat.join(' AND ') : '';
    const total = await db.prepare(`SELECT COUNT(*) AS n FROM pesanan ${where}`).bind(...nilai).first();
    const baris = (await db.prepare(`SELECT p.kode, p.dibuat, p.status, p.nama, p.hp, p.subtotal, p.ongkir, p.bayar, p.alamat,
        (SELECT GROUP_CONCAT(i.nama || ' ×' || i.jumlah, ', ') FROM item_pesanan i WHERE i.pesanan_id = p.id) AS ringkas
      FROM pesanan p ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`).bind(...nilai, per, (halaman - 1) * per).all()).results;
    baris.forEach(r => { const a = JSON.parse(r.alamat); r.kota = a.kota; delete r.alamat; });
    return json({ baris, total: total.n, halaman, per });
  }

  if (bagian === 'pesanan' && kodeAtauId) {
    if (metode === 'GET') {
      const p = await detailPesanan(db, kodeAtauId);
      return p ? json(p) : gagal('Pesanan tidak ditemukan.', 404);
    }
    if (metode === 'PATCH') {
      const b = await bacaJson(req) || {}, set = [], nilai = [];
      if ('status' in b) { if (!STATUS.includes(b.status)) return gagal('Status tidak dikenal.'); set.push('status = ?'); nilai.push(b.status); }
      if ('ongkir' in b) {
        const o = b.ongkir === null || b.ongkir === '' ? null : Math.round(Number(b.ongkir));
        if (o !== null && !(o >= 0 && o < 10000000)) return gagal('Ongkos kirim tidak valid.');
        set.push('ongkir = ?'); nilai.push(o);
      }
      for (const [k, maks] of [['kurir', 40], ['resi', 60], ['catatan_admin', 500]]) if (k in b) { set.push(`${k} = ?`); nilai.push(teks(b[k], maks)); }
      if (!set.length) return gagal('Tidak ada perubahan.');
      set.push('diubah = ?'); nilai.push(sekarang());
      const r = await db.prepare(`UPDATE pesanan SET ${set.join(', ')} WHERE kode = ?`).bind(...nilai, kodeAtauId).run();
      if (!r.meta.changes) return gagal('Pesanan tidak ditemukan.', 404);
      return json(await detailPesanan(db, kodeAtauId));
    }
  }

  if (bagian === 'ekspor') {
    const baris = (await db.prepare(`SELECT p.*, (SELECT GROUP_CONCAT(i.nama || ' x' || i.jumlah, '; ') FROM item_pesanan i WHERE i.pesanan_id = p.id) AS isi
      FROM pesanan p ORDER BY p.id DESC`).all()).results;
    const sel = v => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const kepala = ['Kode', 'Tanggal (UTC)', 'Status', 'Nama', 'No. WhatsApp', 'Isi', 'Subtotal', 'Ongkir', 'Total', 'Pembayaran', 'Alamat', 'Kurir', 'Resi', 'Catatan pembeli', 'Catatan admin'];
    const isi = baris.map(p => {
      const a = JSON.parse(p.alamat);
      const alamat = `${a.jalan} No. ${a.no}, RT ${a.rt}/RW ${a.rw}, Kel. ${a.kelurahan}, Kec. ${a.kecamatan}, ${a.kota}, ${a.provinsi} ${a.kodepos}`;
      return [p.kode, p.dibuat, p.status, p.nama, p.hp, p.isi, p.subtotal, p.ongkir, p.subtotal + (p.ongkir || 0), p.bayar, alamat, p.kurir, p.resi, p.catatan, p.catatan_admin].map(sel).join(';');
    });
    return new Response('﻿' + [kepala.join(';'), ...isi].join('\r\n'), { headers: {
      'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store',
      'content-disposition': `attachment; filename="pesanan-dalwa-${new Date().toISOString().slice(0, 10)}.csv"` } });
  }

  if (bagian === 'produk' && !kodeAtauId) return json((await db.prepare('SELECT * FROM produk ORDER BY urutan').all()).results);
  if (bagian === 'produk' && kodeAtauId && metode === 'PATCH') {
    const b = await bacaJson(req) || {}, set = [], nilai = [];
    if ('harga' in b) { const h = Math.round(Number(b.harga)); if (!(h >= 0 && h < 100000000)) return gagal('Harga tidak valid.'); set.push('harga = ?'); nilai.push(h); }
    if ('aktif' in b) { set.push('aktif = ?'); nilai.push(b.aktif ? 1 : 0); }
    if (!set.length) return gagal('Tidak ada perubahan.');
    const r = await db.prepare(`UPDATE produk SET ${set.join(', ')} WHERE id = ?`).bind(...nilai, kodeAtauId).run();
    if (!r.meta.changes) return gagal('Produk tidak ditemukan.', 404);
    return json(await db.prepare('SELECT * FROM produk WHERE id = ?').bind(kodeAtauId).first());
  }

  if (bagian === 'pengaturan') {
    if (metode === 'PUT') {
      const b = await bacaJson(req) || {}, wa = teks(b.whatsapp, 20).replace(/[\s+-]/g, '').replace(/^0/, '62');
      if (!/^628\d{7,12}$/.test(wa)) return gagal('Nomor WhatsApp tidak valid (contoh: 6281234567890).');
      await db.prepare("INSERT INTO pengaturan (kunci, nilai) VALUES ('whatsapp', ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai").bind(wa).run();
    }
    const wa = await db.prepare("SELECT nilai FROM pengaturan WHERE kunci = 'whatsapp'").first();
    return json({ whatsapp: wa ? wa.nilai : '', sandi_terpasang: !!env.ADMIN_PASSWORD });
  }

  return gagal('Alamat tidak dikenal.', 404);
}

export async function onRequest({ request, env, params }) {
  const jalur = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  if (!env.DB) return gagal('Basis data belum dipasang di Cloudflare (binding D1 bernama DB).', 503);
  try {
    await siapkan(env.DB);
    if (jalur[0] === 'toko' && request.method === 'GET') return await toko(env.DB);
    if (jalur[0] === 'pesanan' && request.method === 'POST') return await buatPesanan(env.DB, request);
    if (jalur[0] === 'admin') {
      // permintaan pengubah data dari admin harus datang dari situs ini sendiri
      if (request.method !== 'GET') {
        const asal = request.headers.get('origin');
        if (asal && new URL(asal).host !== new URL(request.url).host) return gagal('Asal permintaan tidak dikenal.', 403);
      }
      return await admin(env.DB, env, request, jalur.slice(1));
    }
    return gagal('Alamat tidak dikenal.', 404);
  } catch (err) {
    console.error(err);
    return gagal('Terjadi kesalahan di server. Coba lagi sebentar lagi.', 500);
  }
}
