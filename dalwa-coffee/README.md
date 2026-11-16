# Dalwa Coffee Roast — toko kopi bubuk

Situs toko statis (tanpa server). Di bagian atas ada panggung video: enam kemasan berdiri melingkar dan bisa digeser.
Kemasan terdepan memutar video produknya, lalu panggung berpindah sendiri ke kemasan berikutnya saat video selesai.
Ketuk kemasan untuk membuka detail, memilih ukuran, dan memesan. Di bawahnya ada koleksi, takaran seduh, keranjang,
dan formulir pesanan yang menyusun pesan WhatsApp.

## Sebelum dipakai berjualan

Buka `data.js`. Semua `price` masih harga sementara Rp400.000; ganti dengan harga sebenarnya. Nomor admin ada di `whatsapp`.

## Mengganti atau menambah video

Video di panggung berlatar bening. Tiap berkas `assets/video/<id>.mp4` berisi gambar berwarna di separuh atas dan
peta transparansinya (putih = terlihat) di separuh bawah, 540 × 1920. Halaman menggabungkan keduanya lewat WebGL,
jadi satu berkas MP4 ini jalan di Android maupun iPhone. `assets/video/<id>.webp` adalah gambar diamnya, juga bening.

Video baru dari studio berlatar polos bisa diubah dengan skrip pemisah latar yang dipakai di proyek ini
(berbasis warna latar krem keabu-abuan; uap putih ikut hilang karena warnanya sama dengan latar).

## Menjalankan

Buka lewat server statis apa pun, misalnya `python3 -m http.server` di folder ini, atau unggah seluruh folder ke hosting.
