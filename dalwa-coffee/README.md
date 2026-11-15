# Dalwa Coffee Roast — toko kopi bubuk

Situs toko statis (tanpa server) dengan susunan yang sama seperti situs Salaf Boutique of Abaya:
panggung pilih produk, koleksi, keranjang, dan formulir pesanan yang menyusun pesan WhatsApp.
Bedanya, panggungnya 3D: kemasan bisa diputar depan-belakang, biji kopi melayang di seluruh halaman, dan ada cangkir beruap di bagian Cara Seduh.

## Sebelum dipakai berjualan

Buka `data.js`, lalu isi:

- `whatsapp`: nomor admin format `62…`.
- `price` tiap kemasan dalam rupiah. Selama `0`, situs menulis "Tanya harga".

## Menjalankan

Buka lewat server statis apa pun, misalnya `python3 -m http.server` di folder ini, atau unggah seluruh folder ke hosting.

## Berkas

- `index.html`, `styles.css`: halaman dan tampilan.
- `data.js`: produk, harga, nomor WhatsApp, takaran seduh.
- `scene.js`: adegan 3D (Three.js r128 dari cdnjs). Tanpa WebGL, kemasan tampil sebagai gambar biasa.
- `app.js`: panggung, keranjang, formulir pesanan.
- `assets/`: tekstur depan/belakang kemasan (diluruskan dari foto produk) dan foto suasana.
