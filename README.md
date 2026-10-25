# Pasuruan Creative Center — sistem kerja

Aplikasi web untuk ruang kreatif milik daerah. Isinya:

- **Halaman publik**: beranda dengan maket 3D gedung, formulir pendaftaran UMKM (dengan unggah dokumen izin), dan cek status pendaftaran.
- **Ruang kerja petugas** (`/kelola`): seleksi UMKM, produk dan stok konsinyasi, jadwal sesi live per studio (lampu ON AIR di maket 3D), penjualan, retur, dana dan pencairan UMKM, laporan Excel/CSV, serta pengaturan.

Keputusan desain dan teknis dicatat di [DECISIONS.md](DECISIONS.md).

## Menjalankan

Butuh Node.js 20.11 atau lebih baru.

```bash
npm install
npm run build
npm start                # produksi, http://localhost:8080, data di ./data
```

Saat pertama dibuka, sistem meminta pembuatan akun administrator. Setelah itu buka **Pengaturan** dan lengkapi daftar *Lengkapi sebelum diluncurkan*:
nomor WhatsApp resmi, konfirmasi ukuran ruangan, dan alamat. Instansi perizinan (Disperindag dan Dinkes), denah dari sketsa, dan lambang PCC sudah terpasang sebagai isian bawaan.

### Mode demo

```bash
npm run build && npm run demo     # data contoh di ./data-demo, http://localhost:8080
npm run demo:ulang                # hapus dan buat ulang data contoh
```

Masuk dengan `admin@demo.pcc` atau `petugas@demo.pcc`, kata sandi `demo-pcc-2026`.
Basis data demo ditandai khusus, dan `npm start` menolak memakainya, sehingga data contoh tidak pernah terbawa ke produksi.

### Pratinjau tanpa server

```bash
npm run build && npm run pratinjau   # hasil: dist/pratinjau/pcc-pratinjau.html
```

Menghasilkan satu berkas HTML berisi aplikasi lengkap dengan data demo yang direkam, untuk dibagikan kepada pimpinan atau mitra. Berkas ini bisa dibuka di ponsel maupun PC. Semua halaman bisa dijelajahi, tetapi perubahan data tidak disimpan.

### Pengembangan

```bash
npm run dev         # API + Vite dengan muat ulang otomatis, http://localhost:5173
npm run dev:demo    # sama, dengan data contoh
npm run typecheck
npm test            # uji alur server
npm run e2e         # uji peramban ujung ke ujung + aksesibilitas (perlu `npm run build`)
```

## Variabel lingkungan

| Nama | Bawaan | Keterangan |
|---|---|---|
| `PORT` | `8080` | Port server |
| `DATA_DIR` | `./data` | Basis data SQLite dan berkas unggahan; cadangkan folder ini |
| `COOKIE_SECURE` | `true` di produksi | Isi `false` hanya bila diuji tanpa HTTPS di jaringan lokal |
| `TRUST_PROXY` | kosong | Isi `1` bila berada di belakang reverse proxy instansi |

## Struktur

```
server/        API (Hono), basis data, aturan bisnis, ekspor, data demo
shared/        format rupiah/waktu WIB dan kosakata domain, dipakai server dan antarmuka
src/           antarmuka React
  tiga/        maket 3D (Three.js): adegan, material prosedural, signage
  halaman/     halaman publik dan ruang kerja
  styles/      token desain, komponen, tata letak
public/fonts/  Plus Jakarta Sans dan Newsreader (OFL), di-host lokal
public/merek/  lambang resmi PCC (PNG transparan)
public/model/  model 3D perabot hasil Meshy AI (GLB teroptimasi); staf/ berisi karakter berkerangka dan gerakannya
tests/e2e/     uji peramban ujung ke ujung
```
