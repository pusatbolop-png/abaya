# Dalwa Coffee Roast — toko kopi bubuk

Situs toko statis (tanpa server). Di bagian atas ada panggung video: enam kemasan berdiri melingkar dan bisa digeser.
Kemasan terdepan memutar video produknya, lalu panggung berpindah sendiri ke kemasan berikutnya saat video selesai.
Ketuk kemasan untuk membuka detail, memilih ukuran, dan memesan. Di bawahnya ada koleksi, takaran seduh, keranjang,
dan formulir pesanan yang menyusun pesan WhatsApp.

## Pesanan dan dasbor admin

Tombol pesan menyimpan pesanan ke basis data Cloudflare D1, lalu pembeli mendapat nomor pesanan (DLW-…).
Pesanan dikelola di dasbor admin pada alamat `/admin-dalwa/`. Alamat ini tidak ditautkan dari toko,
tidak diindeks mesin pencari, dan dikunci kata sandi.

Di dasbor: ringkasan (pesanan menunggu, omzet bulan ini, terlaris), daftar pesanan dengan filter status dan pencarian,
detail pesanan (ubah status, isi ongkir, kurir, resi, catatan, chat pembeli lewat WhatsApp, salin alamat),
unduh CSV, ubah harga dan stok produk, dan nomor WhatsApp toko.

### Memasang di Cloudflare Pages (sekali saja)

Proyek harus tersambung ke GitHub (bukan unggah zip), karena folder `functions/` hanya dijalankan lewat Git atau Wrangler.

1. **Build settings**: Root directory `dalwa-coffee`, Build command kosong, Build output directory `.`
   (branch: `claude/coffee-shop-website-4d-nddp9r`).
2. **Basis data**: Workers & Pages → D1 → Create database, beri nama `dalwa-toko`.
3. **Hubungkan**: proyek Pages → Settings → Bindings → Add → D1 database. Variable name `DB`, pilih `dalwa-toko`.
   Lakukan untuk Production (dan Preview bila dipakai).
4. **Kata sandi admin**: Settings → Variables and Secrets → Add → jenis Secret, nama `ADMIN_PASSWORD`, isi kata sandi Anda.
5. Deployments → deployment terbaru → Retry deployment, agar pengaturan di atas terpakai.

Tabel dibuat otomatis saat situs pertama kali dibuka. Harga awal semua kemasan Rp400.000; ubah di dasbor → Produk.

## Mengganti atau menambah video

Video di panggung adalah MP4 biasa pada resolusi asli (1080 × 1920, tanpa suara). Isinya sama dengan video asli;
hanya dinding studionya yang disamakan dengan warna halaman (`--bg`, `#D8D1C6`), sehingga kemasan, biji, uap, bayangan,
dan tulisan tampil utuh langsung di atas halaman. `assets/video/<id>.webp` adalah gambar diamnya.
Kalau warna halaman diganti, video perlu diproses ulang dengan warna itu.

## Menjalankan

Buka lewat server statis apa pun, misalnya `python3 -m http.server` di folder ini, atau unggah seluruh folder ke hosting.
