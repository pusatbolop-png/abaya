# Catatan keputusan

Keputusan penting selama membangun sistem kerja Pasuruan Creative Center (PCC), beserta alasannya.
Urutan mengikuti lapisan: produk, data, keamanan, desain, 3D, kualitas.

## Produk dan cakupan

**D-01. Satu aplikasi web untuk dua kelompok pengguna.**
Halaman publik (beranda, formulir pendaftaran UMKM, cek status) dan ruang kerja petugas (`/kelola`) ada dalam satu aplikasi.
Alasan: satu domain, satu identitas, satu proses rilis. Pendaftar tidak memerlukan akun; status dicek dengan kode pendaftaran ditambah nomor WhatsApp.

**D-02. Alur inti mengikuti urutan kerja di gedung.**
Daftar → seleksi → stok → sesi live → penjualan → retur → dana → ekspor. Setiap langkah membaca hasil langkah sebelumnya, sehingga tidak ada data yang diketik dua kali.
Contoh: penjualan mengurangi stok otomatis, retur layak jual mengembalikannya, dan dana dihitung dari penjualan dikurangi retur.

**D-03. Data yang tidak bisa ditebak dijadikan pengaturan, bukan kode.**
Nama tiga instansi perizinan, nomor WhatsApp resmi, ukuran ruangan, dan logo diisi administrator di menu Pengaturan.
Halaman Pengaturan menampilkan daftar *Lengkapi sebelum diluncurkan* sampai semuanya terisi.
Selama belum diisi, formulir publik menulis "Instansi penerbit akan diumumkan" dan kaki halaman menulis "Nomor WhatsApp resmi segera diumumkan". Sistem tidak pernah menampilkan nomor atau nama karangan.

**D-04. Jenis dokumen izin bawaan: NIB (wajib), izin edar pangan SPP-IRT/BPOM, dan sertifikat halal.**
Ketiganya dokumen yang lazim diminta dari UMKM produk. Nama dokumen, instansi penerbit, dan status wajibnya bisa diubah.
UMKM hanya bisa diterima bila semua izin wajib sudah terverifikasi; aturan ini dijaga di server.

**D-05. Seleksi memakai empat kriteria bernilai 1–5.**
Kriteria: mutu produk, kemasan dan label, kesiapan stok, dan daya tarik untuk siaran live. Keputusannya terima, perlu perbaikan, atau tidak lolos.
Keputusan selain *terima* wajib disertai catatan, karena catatan itu tampil ke pendaftar di halaman Cek status.

**D-06. Kabar ke UMKM lewat tautan WhatsApp (`wa.me`) berisi pesan yang sudah disusun, bukan WhatsApp API.**
Alasan: tanpa biaya dan tanpa persetujuan WhatsApp Business API, dan petugas tetap memeriksa pesan sebelum mengirim. Integrasi API bisa ditambahkan nanti.

**D-07. Model konsinyasi.** PCC tidak membeli barang. Stok adalah titipan UMKM, dicatat sebagai mutasi bertanda (masuk, terjual, retur, kembali ke UMKM, rusak, penyesuaian).
Stok adalah jumlah mutasi, sehingga riwayatnya selalu bisa diaudit dan tidak bisa bergeser diam-diam. Stok tidak boleh minus.

**D-08. Retur dibedakan menurut kondisi barang.** Barang layak jual kembali ke stok, sedangkan barang rusak tidak (dicatat untuk dikembalikan ke UMKM). Keduanya mengurangi hak dana UMKM.

**D-09. Potongan jasa pengelola bawaan 0 %.** Program pemerintah daerah umumnya tidak memungut potongan. Persentase bisa diatur.
Setiap pencairan menyimpan bruto, retur, dan potongannya sendiri, sehingga perubahan persentase tidak mengubah pencairan yang sudah dibuat.
Penjualan yang dibatalkan setelah dicairkan otomatis mengurangi pencairan berikutnya.

**D-10. Pencairan dua tahap: disiapkan, lalu ditandai sudah ditransfer dengan nomor referensi bank.**
Transfer dilakukan di luar sistem melalui rekening instansi, dan sistem mencatat bukti agar rekonsiliasi mudah. Pencairan ditolak bila data rekening UMKM belum lengkap.

**D-11. Dua peran: Administrator dan Petugas studio.**
Petugas mengerjakan stok, sesi live, penjualan, dan retur. Seleksi, pencairan dana, dan pengaturan khusus administrator.
Pembatasan ini dijaga di server, bukan hanya disembunyikan di antarmuka.

**D-12. Ekspor Excel dan CSV untuk tujuh laporan.** Excel sudah berisi judul, periode, format rupiah, dan baris jumlah.
CSV memakai titik koma dan UTF-8 dengan BOM agar langsung terbaca Excel berlokal Indonesia.

**D-13. Semua waktu disimpan dalam UTC dan ditampilkan dalam WIB.** "Hari ini", rentang laporan, dan penomoran dokumen dihitung menurut tanggal WIB.

**D-14. Nomor dokumen yang mudah dibacakan lewat telepon.** UMKM-26-0001, PJ-261025-0003 (penjualan), RT-… (retur), DC-… (pencairan); berurutan per hari atau per tahun.

**D-15. Riwayat aktivitas.** Setiap perubahan penting dicatat beserta pelakunya, demi akuntabilitas instansi pemerintah.

## Teknologi dan data

**D-16. React + TypeScript + Vite untuk antarmuka, Hono di Node.js untuk server, SQLite (better-sqlite3) untuk data.**
Alasan: satu proses dan satu berkas basis data mudah dipasang di server pemerintah daerah tanpa layanan basis data terpisah. Cadangan cukup dengan menyalin folder `data/`.
SQLite memakai WAL dan transaksi untuk setiap operasi yang mengubah stok atau uang.

**D-17. Uang disimpan sebagai bilangan bulat rupiah.** Tidak ada pecahan, sehingga tidak ada galat pembulatan.

**D-18. Data contoh hanya ada di mode demo.**
`npm run demo` mengisi folder `data-demo/` dan menandai basis datanya *demo*. Server produksi (`npm start`) tidak pernah mengimpor kode data contoh, menolak berjalan di atas basis data bertanda demo, dan dimulai kosong dengan halaman *Siapkan akun administrator*.
Pita peringatan "Mode demo" tampil di semua halaman demo.

**D-19. Versi pustaka dipilih yang stabil dan bebas kerentanan tinggi.**
Satu temuan moderat tersisa: `uuid` di dalam `exceljs`. Galat itu hanya terjadi pada fungsi v3/v5/v6 dengan parameter `buf`; `exceljs` hanya memakai `v4`, jadi tidak bisa dieksploitasi.

## Keamanan

**D-20.** Kata sandi di-hash dengan scrypt; sesi berupa cookie `httpOnly` dan `SameSite=Lax`, ditambah `Secure` di produksi. Token sesi disimpan sebagai hash.
**D-21.** Setiap permintaan yang mengubah data wajib membawa header `x-pcc: 1`. Peramban tidak mengirim header ini lintas situs, sehingga menjadi perlindungan CSRF.
**D-22.** Berkas unggahan diperiksa dari isinya (magic bytes), bukan dari ekstensinya, dengan batas 5 MB, dan disimpan dengan nama acak. Berkas disajikan dengan CSP `sandbox` dan `nosniff`, termasuk logo SVG.
**D-23.** Ada pembatas laju untuk login, pendaftaran, dan cek status, serta header keamanan (CSP ketat, `frame-ancestors 'none'`). `X-Forwarded-For` hanya dipercaya bila `TRUST_PROXY=1`.
**D-24.** Data pribadi diminimalkan: tidak ada NIK atau foto KTP. Yang diminta hanya data yang diperlukan untuk kurasi dan pencairan.

## Identitas visual

**D-25. Palet enam warna dari lanskap Pasuruan, satu aksen.**

| Nama | Hex | Peran |
|---|---|---|
| Pasir Bromo | `#F4F1EA` | kanvas halaman |
| Abu vulkanik | `#D9D2C4` | garis dan pemisah |
| Lumut Purwodadi | `#7D8A76` | dekoratif saja (grafik, kain 3D), tidak untuk teks |
| Hutan Arjuno | `#24372E` | tombol utama, permukaan gelap |
| Arang | `#1D221F` | teks utama |
| **Tembaga fajar** | `#A4532B` | **satu-satunya aksen**: siaran langsung (ON AIR), penanda aktif, cincin fokus |

Teks sekunder `#5C6058` diturunkan dari Arang. Warna fungsi (berhasil, peringatan, galat) dipakai bersama ikon dan teks, tidak pernah sebagai dekorasi.
Rasio kontras: teks utama 14,3:1; teks sekunder 5,7:1; aksen pada pasir 4,8:1; teks pasir di atas Hutan 11,2:1. Semuanya memenuhi WCAG AA.

**D-26. Aksen tembaga diberi makna tunggal: "sedang berlangsung atau sedang dipilih".** Karena itu lampu ON AIR di 3D, lencana ON AIR di antarmuka, tombol *Mulai siaran*, dan cincin fokus papan ketik memakai warna yang sama. Aplikasi dan 3D berbicara satu bahasa.

**D-27. Dua keluarga huruf, di-host lokal.**
*Plus Jakarta Sans* (karya Tokotype, Jakarta) untuk antarmuka dan *Newsreader* untuk judul dan angka besar. Pasangan ini memberi kesan editorial dan instansi, bukan admin generik.
Keduanya memiliki tabular figures; semua angka di tabel memakai `tabular-nums`. Berkas woff2 dan lisensi OFL ada di `public/fonts`.
Skala: 12 / 13 / 15 / 17 / 20 / 26 / 36 px, dan tampilan publik 40–64 px.

**D-28. Tanpa kartu berbayang seragam.** Hierarki dibangun dengan garis rambut (1 px), garis tegas hitam di atas bagian penting seperti lembar laporan, ruang kosong, dan tipografi.
Metrik disusun berderet seperti lembar laporan keuangan, bukan kotak-kotak. Tidak ada gradien dekoratif, label kapital di atas judul, atau emoji. Ikon garis 1,5 px digambar khusus.

**D-29. Gerak hanya untuk menjelaskan perubahan**, yaitu lembar samping yang masuk (240 ms), toast konfirmasi, perpindahan lantai, dan kamera yang bergerak ke ruangan terpilih. Semuanya mati bila `prefers-reduced-motion` aktif.

**D-30. Formulir di lembar samping (`<dialog>`), bukan halaman terpisah.**
Konteks daftar tetap terlihat, fokus terkunci di dalam lembar, dan Escape menutupnya. Di ponsel lembar menjadi *bottom sheet*.
Tombol menyebut hasilnya: "Simpan penjualan", "Terima UMKM ini", "Siapkan pencairan Rp 70.000".

**D-31. Bahasa.** Bahasa Indonesia baku dengan kalimat aktif. Pesan kosong selalu memberi langkah berikutnya, dan pesan galat menyebut masalah serta cara memperbaikinya. Galat dari server ditulis dengan gaya yang sama.

## 3D

**D-32. Three.js murni dengan material prosedural yang digambar di kanvas** (terrazzo, walnut, kain akustik, logam brushed, plester, beton halus, kaca buram), tanpa berkas tekstur eksternal.
Hasilnya ringan (sekitar 140 kB gzip, dimuat terpisah hanya saat 3D tampil) dan warnanya diturunkan langsung dari palet aplikasi.

**D-33. Denah dibangun dari data ruangan di basis data.** Ubah ukuran atau posisi di Pengaturan, dan maket ikut berubah. Pratinjau denah 2D di Pengaturan memperingatkan bila ada ruangan yang bertumpuk.
Ukuran bawaan (pelat 24 × 16 m per lantai, 12 ruangan, 4 studio) adalah perkiraan kerja yang ditandai "belum sesuai gambar kerja" sampai administrator mengonfirmasinya.

**D-34. Gaya maket arsitek bersuasana senja.** Latar gelap hangat, matahari sore, lampu ruang hangat, dan tone mapping ACES.
Dinding luar yang menghadap kamera otomatis diturunkan seperti maket potongan, sehingga isi ruang selalu terlihat dari sudut mana pun.

**D-35. Signage dirancang seperti signage gedung.** Papan nama berlapis cat bubuk hijau hutan dengan kode ruangan tembaga di samping pintu, huruf kuningan tertanam di lantai ambang pintu (terbaca dari arah datang), kotak lampu ON AIR di atas pintu studio yang menyala ketika sesi dimulai, monumen nama gedung di pelataran, dan papan petunjuk lantai di tangga.

**D-36. Momen pembuka sekali saja.** Kamera berdiri di pelataran menghadap fasad kaca dan monumen, melangkah ke pintu, lalu naik memperlihatkan seluruh lantai (7 detik).
Bisa dilewati dengan tombol *Lewati*, klik, atau Escape. Momen ini tidak diputar bila `prefers-reduced-motion` aktif, dan tidak diulang setelah pernah dilihat (disimpan di `localStorage`).

**D-37. Aksesibilitas 3D.** Kanvas memiliki deskripsi teks yang selalu terbarui, termasuk jumlah studio yang sedang siaran. Daftar ruangan di samping maket berupa tombol yang bisa dipakai dengan papan ketik.
Bila WebGL tidak tersedia, maket diganti denah datar SVG. Di ponsel kualitas bayangan dan jumlah lampu diturunkan.

## Kualitas

**D-38. Uji otomatis.**
`npm test` menguji alur server (termasuk aturan bisnis dan perhitungan dana).
`npm run e2e` menjalankan build produksi dengan basis data kosong di peramban sungguhan dan menelusuri 17 langkah dari pembuatan akun administrator sampai ekspor. Setiap halaman diperiksa dengan axe-core (WCAG 2.1 A/AA), dan uji gagal bila ada galat di konsol.
