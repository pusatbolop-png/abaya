# Dalwa Coffee Roast — toko kopi bubuk

Situs toko statis (tanpa server) berbentuk cerita gulir empat babak di atas latar krem:

1. **Grind**: biji jatuh ke penggiling, lalu penggiling terurai dan bubuk berjatuhan.
2. **Pour**: bubuk masuk dripper V60, teko leher angsa menuang, kopi menetes ke server.
3. **Sip**: aliran kopi jatuh ke genangan yang beriak.
4. **Find your cup**: cangkir beruap diapit kartu produk (bisa dibalik untuk melihat sisi belakang kemasan).

Di bawahnya ada takaran seduh, keranjang, dan formulir pesanan yang menyusun pesan WhatsApp.

## Sebelum dipakai berjualan

Buka `data.js`. Semua `price` masih harga sementara Rp400.000; ganti dengan harga sebenarnya. Nomor admin ada di `whatsapp`.

## Menjalankan

Buka lewat server statis apa pun, misalnya `python3 -m http.server` di folder ini, atau unggah seluruh folder ke hosting.

## Berkas

- `index.html`, `styles.css`: halaman dan tampilan.
- `data.js`: produk, harga, nomor WhatsApp, takaran seduh.
- `scene.js`: adegan 3D (Three.js r128 dari cdnjs); semua benda dibuat dengan kode, tanpa berkas model. Tanpa WebGL, foto produk menggantikannya.
- `app.js`: kartu produk, keranjang, formulir pesanan.
- `assets/`: tekstur depan/belakang kemasan (diluruskan dari foto produk) dan foto suasana.
