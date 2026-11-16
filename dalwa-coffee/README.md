# Dalwa Coffee Roast — toko kopi bubuk

Situs toko statis (tanpa server). Di bagian atas ada panggung video: enam kemasan berdiri melingkar dan bisa digeser.
Kemasan terdepan memutar video produknya, lalu panggung berpindah sendiri ke kemasan berikutnya saat video selesai.
Ketuk kemasan untuk membuka detail, memilih ukuran, dan memesan. Di bawahnya ada koleksi, takaran seduh, keranjang,
dan formulir pesanan yang menyusun pesan WhatsApp.

## Sebelum dipakai berjualan

Buka `data.js`. Semua `price` masih harga sementara Rp400.000; ganti dengan harga sebenarnya. Nomor admin ada di `whatsapp`.

## Mengganti atau menambah video

Simpan video tegak 9:16 sebagai `assets/video/<id>.mp4` dan satu gambar diamnya sebagai `assets/video/<id>.jpg`,
dengan `<id>` sama seperti di daftar `products` pada `data.js`. Video tanpa suara, sekitar 720 × 1280, di bawah 500 KB.

## Menjalankan

Buka lewat server statis apa pun, misalnya `python3 -m http.server` di folder ini, atau unggah seluruh folder ke hosting.
