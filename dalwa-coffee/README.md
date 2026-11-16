# Dalwa Coffee Roast — toko kopi bubuk

Situs toko statis (tanpa server). Di bagian atas ada panggung video: enam kemasan berdiri melingkar dan bisa digeser.
Kemasan terdepan memutar video produknya, lalu panggung berpindah sendiri ke kemasan berikutnya saat video selesai.
Ketuk kemasan untuk membuka detail, memilih ukuran, dan memesan. Di bawahnya ada koleksi, takaran seduh, keranjang,
dan formulir pesanan yang menyusun pesan WhatsApp.

## Sebelum dipakai berjualan

Buka `data.js`. Semua `price` masih harga sementara Rp400.000; ganti dengan harga sebenarnya. Nomor admin ada di `whatsapp`.

## Mengganti atau menambah video

Video di panggung adalah MP4 biasa pada resolusi asli (1080 × 1920, tanpa suara). Isinya sama dengan video asli;
hanya dinding studionya yang disamakan dengan warna halaman (`--bg`, `#D8D1C6`), sehingga kemasan, biji, uap, bayangan,
dan tulisan tampil utuh langsung di atas halaman. `assets/video/<id>.webp` adalah gambar diamnya.
Kalau warna halaman diganti, video perlu diproses ulang dengan warna itu.

## Menjalankan

Buka lewat server statis apa pun, misalnya `python3 -m http.server` di folder ini, atau unggah seluruh folder ke hosting.
