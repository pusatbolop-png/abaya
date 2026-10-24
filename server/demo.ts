// Mode demo: basis data terpisah berisi data contoh untuk peragaan dan uji tampilan.
// Tidak pernah dipanggil oleh server produksi, dan basis data hasilnya ditolak oleh `npm start`.
import fs from 'node:fs';
import path from 'node:path';

process.env.DATA_DIR = path.resolve(process.env.DATA_DIR ?? 'data-demo');
process.env.PCC_DEMO = '1';

const ulang = process.argv.includes('--ulang');
const hanyaIsi = process.argv.includes('--isi-saja');
if (ulang) fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });

const { bukaDb } = await import('./db');
const { buatApp } = await import('./app');
const { simpanPengaturan } = await import('./util');

const db = bukaDb();
const sudahAda = (db.prepare('SELECT COUNT(*) AS n FROM pengguna').get() as { n: number }).n > 0;

if (!sudahAda) {
  const app = buatApp(db);
  let cookie = '';
  const minta = async <T = { id: number }>(metode: string, url: string, isi?: unknown): Promise<T> => {
    const headers: Record<string, string> = { 'x-pcc': '1', cookie };
    let body: BodyInit | undefined;
    if (isi instanceof FormData) body = isi;
    else if (isi !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(isi);
    }
    const res = await app.request(url, { method: metode, headers, body });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const data = await res.json();
    if (!res.ok) throw new Error(`${metode} ${url}: ${JSON.stringify(data)}`);
    return data as T;
  };

  simpanPengaturan(db, 'mode', 'demo');
  await minta('POST', '/api/auth/siapkan', { nama: 'Dewi Rahmawati', email: 'admin@demo.pcc', sandi: 'demo-pcc-2026' });
  await minta('POST', '/api/pengguna', { nama: 'Rizal Hakim', email: 'petugas@demo.pcc', peran: 'petugas', sandi: 'demo-pcc-2026' });

  const pdf = () => new File([Buffer.from('%PDF-1.4\n% contoh\n')], 'izin-contoh.pdf', { type: 'application/pdf' });
  const umkm = [
    { nama_usaha: 'Kopi Lereng Arjuno', pemilik: 'Siti Aminah', whatsapp: '081234560001', alamat: 'Jl. Raya Prigen 12', kecamatan: 'Prigen', kategori: 'Minuman', deskripsi: 'Kopi robusta petik merah dari lereng Arjuno, disangrai sendiri dalam takaran kecil setiap pekan.', bank: 'Bank Jatim', no_rekening: '0011223344', atas_nama: 'Siti Aminah', status: 'diterima' },
    { nama_usaha: 'Bordir Sekar Bangil', pemilik: 'Nur Hasanah', whatsapp: '081234560002', alamat: 'Kauman Gg. III No. 5', kecamatan: 'Bangil', kategori: 'Fesyen', deskripsi: 'Kerudung dan mukena bordir tangan khas Bangil dengan motif melati dan sulur daun.', bank: 'BRI', no_rekening: '0123456789012', atas_nama: 'Nur Hasanah', status: 'diterima' },
    { nama_usaha: 'Keripik Apel Tutur', pemilik: 'Bambang Sutrisno', whatsapp: '081234560003', alamat: 'Desa Gendro RT 02', kecamatan: 'Tutur', kategori: 'Kuliner', deskripsi: 'Keripik apel manalagi dari kebun sendiri, digoreng hampa tanpa pemanis tambahan.', bank: 'BNI', no_rekening: '0987654321', atas_nama: 'Bambang Sutrisno', status: 'diterima' },
    { nama_usaha: 'Susu Etawa Nongkojajar', pemilik: 'Agus Prasetyo', whatsapp: '081234560004', alamat: 'Dusun Krajan, Nongkojajar', kecamatan: 'Tutur', kategori: 'Minuman', deskripsi: 'Susu kambing etawa bubuk dan cair pasteurisasi dari peternakan kelompok tani.', bank: '', no_rekening: '', atas_nama: '', status: 'diterima' },
    { nama_usaha: 'Gerabah Kraton Asri', pemilik: 'Slamet Riyadi', whatsapp: '081234560005', alamat: 'Jl. Pesanggrahan 21', kecamatan: 'Kraton', kategori: 'Kriya', deskripsi: 'Vas, cobek, dan peralatan saji dari tanah liat, dibakar tradisional dan diglasir alami.', status: 'diajukan' },
    { nama_usaha: 'Terasi Udang Lekok', pemilik: 'Fatimah Zahra', whatsapp: '081234560006', alamat: 'Desa Jatirejo', kecamatan: 'Lekok', kategori: 'Kuliner', deskripsi: 'Terasi udang rebon dari nelayan pesisir Lekok, dijemur dan difermentasi alami.', status: 'diajukan' },
    { nama_usaha: 'Sabun Herbal Purwodadi', pemilik: 'Rina Kusuma', whatsapp: '081234560007', alamat: 'Jl. Raya Purwodadi 88', kecamatan: 'Purwodadi', kategori: 'Kecantikan dan perawatan', deskripsi: 'Sabun batang dari minyak kelapa dan rempah, terinspirasi tanaman obat Kebun Raya.', status: 'perlu_perbaikan' },
  ];

  const id: number[] = [];
  for (const u of umkm) {
    const f = new FormData();
    for (const [k, v] of Object.entries(u)) if (k !== 'status') f.append(k, v);
    f.append('persetujuan', 'ya');
    f.append('izin_izin_1_nomor', `9120${String(id.length + 1).padStart(9, '0')}`);
    f.append('izin_izin_1_berkas', pdf());
    if (u.kategori === 'Kuliner' || u.kategori === 'Minuman') f.append('izin_izin_2_nomor', `P-IRT 20135140${id.length + 1}`);
    await minta<{ kode: string }>('POST', '/api/publik/daftar', f);
    const r = db.prepare('SELECT id FROM umkm ORDER BY id DESC LIMIT 1').get() as { id: number };
    id.push(r.id);
    if (u.status === 'diterima') {
      await minta('PUT', `/api/umkm/${r.id}/izin/izin_1`, { status: 'terverifikasi', nomor: `9120${String(id.length).padStart(9, '0')}` });
      await minta('POST', `/api/umkm/${r.id}/seleksi`, { keputusan: 'diterima', skor: { mutu: 4, kemasan: 4, kapasitas: 3 + (id.length % 2), pasar: 5 }, catatan: 'Siap untuk siaran perdana.' });
    } else if (u.status === 'perlu_perbaikan') {
      await minta('PUT', `/api/umkm/${r.id}/izin/izin_1`, { status: 'tidak_valid', catatan: 'Foto NIB buram, nomor tidak terbaca.' });
      await minta('POST', `/api/umkm/${r.id}/seleksi`, {
        keputusan: 'perlu_perbaikan',
        skor: { mutu: 4, kemasan: 2, kapasitas: 3, pasar: 4 },
        catatan: 'Unggah ulang NIB yang terbaca jelas dan lengkapi label komposisi pada kemasan.',
      });
    }
  }

  const produk: Record<string, number> = {};
  const tambah = async (umkmKe: number, nama: string, harga: number, stok: number, satuan = 'pcs') => {
    produk[nama] = (await minta('POST', '/api/produk', { umkm_id: id[umkmKe], nama, harga, stok_awal: stok, satuan })).id;
  };
  await tambah(0, 'Kopi Robusta Arjuno 200 g', 45_000, 40);
  await tambah(0, 'Kopi Arabika Prigen 200 g', 62_000, 24);
  await tambah(0, 'Drip Bag Robusta isi 10', 38_000, 4, 'kotak');
  await tambah(1, 'Kerudung Bordir Melati', 185_000, 18);
  await tambah(1, 'Mukena Bordir Sulur', 425_000, 8);
  await tambah(2, 'Keripik Apel Manalagi 100 g', 22_000, 60, 'bungkus');
  await tambah(2, 'Keripik Apel Pedas 100 g', 24_000, 3, 'bungkus');
  await tambah(3, 'Susu Etawa Bubuk 200 g', 75_000, 30, 'kaleng');
  await tambah(3, 'Susu Etawa Cair 250 ml', 15_000, 0, 'botol');

  // Penjualan tujuh hari terakhir dari kanal campuran.
  const kanal = ['TikTok Shop', 'Shopee Live', 'Penjualan langsung di galeri', 'TikTok Shop', 'Instagram Live'];
  const nama = Object.keys(produk);
  let k = 0;
  const penjualan: number[] = [];
  for (let h = 6; h >= 1; h--) {
    for (let j = 0; j < 2 + (h % 3); j++) {
      const waktu = new Date(Date.now() - h * 86_400_000 - (j * 2 + 3) * 3600_000).toISOString();
      const a = nama[(k * 3) % 8];
      const b = nama[(k * 5 + 1) % 8];
      const item = [{ produk_id: produk[a], jumlah: 1 + (k % 2) }];
      if (k % 3 === 0 && b !== a) item.push({ produk_id: produk[b], jumlah: 1 });
      k++;
      try {
        const r = await minta('POST', '/api/penjualan', { kanal: kanal[k % kanal.length], tanggal: waktu, item, nomor_pesanan: `57${String(830000 + k * 137)}` });
        penjualan.push(r.id);
      } catch {
        // Stok contoh habis untuk kombinasi ini; lewati saja.
      }
    }
  }

  // Satu retur: kemasan rusak saat pengiriman.
  const dj = await minta<{ item: { id: number }[] }>('GET', `/api/penjualan/${penjualan[2]}`);
  await minta('POST', '/api/retur', { penjualan_id: penjualan[2], alasan: 'Kemasan sobek saat pengiriman', item: [{ item_penjualan_id: dj.item[0].id, jumlah: 1, kondisi: 'rusak' }] });

  // Sesi hari ini: satu sudah selesai, satu sedang siaran, dua terjadwal.
  const studio = db.prepare("SELECT id FROM ruangan WHERE jenis = 'studio' ORDER BY lantai, urutan").all() as { id: number }[];
  const jamIni = (offsetMenit: number) => new Date(Math.floor(Date.now() / 900_000) * 900_000 + offsetMenit * 60_000).toISOString();
  const s1 = await minta('POST', '/api/live', { ruangan_id: studio[0].id, judul: 'Pagi Ngopi bareng Arjuno', platform: 'TikTok Shop', host: 'Rani', jadwal_mulai: jamIni(-240), jadwal_selesai: jamIni(-150), produk_ids: [produk['Kopi Robusta Arjuno 200 g'], produk['Kopi Arabika Prigen 200 g']] });
  await minta('POST', `/api/live/${s1.id}/mulai`);
  await minta('POST', '/api/penjualan', { kanal: 'TikTok Shop', sesi_id: s1.id, tanggal: jamIni(-200), item: [{ produk_id: produk['Kopi Robusta Arjuno 200 g'], jumlah: 3 }] });
  await minta('POST', '/api/penjualan', { kanal: 'TikTok Shop', sesi_id: s1.id, tanggal: jamIni(-180), item: [{ produk_id: produk['Kopi Arabika Prigen 200 g'], jumlah: 2 }] });
  await minta('POST', `/api/live/${s1.id}/selesai`);
  db.prepare('UPDATE sesi_live SET mulai = ?, selesai = ? WHERE id = ?').run(jamIni(-238), jamIni(-152), s1.id);

  const s2 = await minta('POST', '/api/live', { ruangan_id: studio[1].id, judul: 'Bordir Bangil untuk Lebaran', platform: 'Shopee Live', host: 'Maya', jadwal_mulai: jamIni(-30), jadwal_selesai: jamIni(90), produk_ids: [produk['Kerudung Bordir Melati'], produk['Mukena Bordir Sulur']] });
  await minta('POST', `/api/live/${s2.id}/mulai`);
  db.prepare('UPDATE sesi_live SET mulai = ? WHERE id = ?').run(jamIni(-28), s2.id);
  await minta('POST', '/api/penjualan', { kanal: 'Shopee Live', sesi_id: s2.id, tanggal: jamIni(-10), item: [{ produk_id: produk['Kerudung Bordir Melati'], jumlah: 2 }] });

  await minta('POST', '/api/live', { ruangan_id: studio[2].id, judul: 'Camilan Sehat dari Tutur', platform: 'TikTok Shop', host: 'Fajar', jadwal_mulai: jamIni(120), jadwal_selesai: jamIni(210), produk_ids: [produk['Keripik Apel Manalagi 100 g'], produk['Susu Etawa Bubuk 200 g']] });
  await minta('POST', '/api/live', { ruangan_id: studio[0].id, judul: 'Sore Santai Kopi Prigen', platform: 'Instagram Live', host: 'Rani', jadwal_mulai: jamIni(240), jadwal_selesai: jamIni(300), produk_ids: [produk['Drip Bag Robusta isi 10']] });

  // Satu pencairan yang sudah ditransfer.
  const cair = await minta('POST', '/api/dana/pencairan', { umkm_id: id[2], catatan: 'Pencairan pekan lalu' });
  await minta('POST', `/api/dana/pencairan/${cair.id}/bayar`, { referensi_transfer: 'TRF2610190045' });

  console.log('Data contoh dibuat di', process.env.DATA_DIR);
  console.log('Masuk sebagai admin@demo.pcc atau petugas@demo.pcc, sandi demo-pcc-2026');
}

db.close();
if (!hanyaIsi) await import('./index');
