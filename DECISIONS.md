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
Instansi perizinan, nomor WhatsApp resmi, ukuran ruangan, dan logo bisa diubah administrator di menu Pengaturan.
Data resmi dari pemilik program (25 Oktober 2026) sudah menjadi isian bawaan: dua instansi, denah dari sketsa, dan lambang PCC.
Halaman Pengaturan menampilkan daftar *Lengkapi sebelum diluncurkan* sampai semuanya terisi.
Selama belum diisi, formulir publik menulis "Instansi penerbit akan diumumkan" dan kaki halaman menulis "Nomor WhatsApp resmi segera diumumkan". Sistem tidak pernah menampilkan nomor atau nama karangan.

**D-04. Dua instansi perizinan: Disperindag dan Dinkes.**
Ditetapkan pemilik program. Dokumen yang dipasangkan: Disperindag dengan Nomor Induk Berusaha (NIB, wajib), dan Dinkes dengan SPP-IRT (bila produk berupa pangan olahan).
Pasangan dokumen ini tebakan yang lazim dan bisa diubah di Pengaturan. Label kolomnya "Instansi", bukan "penerbit", karena NIB secara teknis terbit lewat OSS sementara Disperindag berperan memverifikasi.
UMKM hanya bisa diterima bila semua izin wajib sudah terverifikasi; aturan ini dijaga di server.

**D-05. Seleksi memakai empat kriteria bernilai 1–5.**
Kriteria: mutu produk, kemasan dan label, kesiapan stok, dan daya tarik untuk siaran live. Keputusannya terima, perlu perbaikan, atau tidak lolos.
Keputusan selain *terima* wajib disertai catatan, karena catatan itu tampil ke pendaftar di halaman Cek status.

**D-06. Kabar ke UMKM lewat tautan WhatsApp (`wa.me`) berisi pesan yang sudah disusun, bukan WhatsApp API.**
Alasan: tanpa biaya dan tanpa persetujuan WhatsApp Business API, dan petugas tetap memeriksa pesan sebelum mengirim. Integrasi API bisa ditambahkan nanti.

**D-07. Model konsinyasi.** PCC tidak membeli barang. Stok adalah titipan UMKM, dicatat sebagai mutasi bertanda (masuk, terjual, retur, kembali ke UMKM, rusak, penyesuaian).
Stok adalah jumlah mutasi, sehingga riwayatnya selalu bisa diaudit dan tidak bisa bergeser diam-diam. Stok tidak boleh minus.

**D-08. Retur dibedakan menurut kondisi barang.** Barang layak jual kembali ke stok, sedangkan barang rusak tidak (dicatat untuk dikembalikan ke UMKM). Keduanya mengurangi hak dana UMKM.

**D-09. Tanpa potongan jasa pengelola.** Ditetapkan pemilik program, sehingga hak UMKM = penjualan − retur.
Pengaturan persentase dihapus dari antarmuka dan server; kolom `potongan` di tabel pencairan dibiarkan bernilai 0 agar riwayat tetap utuh.
Setiap pencairan menyimpan bruto dan returnya sendiri. Penjualan yang dibatalkan setelah dicairkan otomatis mengurangi pencairan berikutnya.

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
| **Jingga PCC** | `#EF6C12` (logo) · `#B24C0B` (antarmuka) | **satu-satunya aksen**: siaran langsung (ON AIR), penanda aktif, cincin fokus |

Aksen awalnya tembaga `#A4532B`. Setelah logo resmi diterima, aksen digeser ke keluarga jingga logo agar merek dan aplikasi satu warna.
Jingga logo asli (`#EF6C12`) hanya 2,7:1 di atas pasir, jadi untuk teks dan tombol dipakai varian gelap `#B24C0B` (4,7:1; teks putih di atasnya 5,3:1). Di permukaan gelap dipakai `#F28A3C` (7,0:1).
Teks sekunder `#5C6058` diturunkan dari Arang. Warna fungsi (berhasil, peringatan, galat) dipakai bersama ikon dan teks, tidak pernah sebagai dekorasi.
Rasio kontras: teks utama 14,3:1; teks sekunder 5,7:1; teks pasir di atas Hutan 11,2:1. Semuanya memenuhi WCAG AA.

**D-25a. Lambang resmi PCC.** Berkas yang diterima hanya 150 × 150 piksel (JPG berlatar putih). Lambangnya dipisahkan, diperbesar 8×, dan tepinya ditajamkan menjadi PNG transparan (`public/merek/lambang-pcc.png`).
Lambang ini dipakai di kepala halaman, favicon, monumen, kanopi, dan dinding resepsionis 3D. Tulisan "PCC" dan nama lembaga diset ulang dengan huruf aplikasi karena teks kecil di berkas asli tidak terbaca.
Untuk cetak dan tampilan besar, sebaiknya disediakan berkas vektor (SVG/AI) atau PNG beresolusi tinggi; berkas pengganti bisa diunggah di Pengaturan.

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

**D-33. Denah mengikuti sketsa pemilik program dan dibangun dari data.**
- Lantai 1: resepsionis di kiri depan, pintu masuk di depan, Studio Live 1–2 di kiri, Studio Live 3–4 di kanan, serta loket Layanan Disperindag dan Layanan Dinkes di belakang tengah.
- Lantai 2: Ruang Podcast di depan, Ruang Belajar AI dan Ruang Tim Ahli di tengah, Ruang Rapat dan dua toilet di belakang.

Koordinat memakai orientasi sketsa: x dari dinding kiri, z dari dinding depan (pintu masuk). Pratinjau di Pengaturan tampil persis seperti sketsa. Maket 3D memutarnya 180° supaya fasad depan menghadap kamera.
Ukuran meter (pelat 18 × 20 m, tinggi lantai 3,6 m) diperkirakan dari proporsi sketsa dan ditandai "belum sesuai gambar kerja" sampai dikonfirmasi.
Setiap ruangan menyimpan sisi pintunya. Tangga tidak ada di sketsa. Penempatan pertama di belakang tengah ternyata menutupi loket Disperindag dan Dinkes. Tangga lalu dipindah ke tengah aula (x 7–9 m, z 7,5–13,5 m) dan naik ke arah depan, sehingga kakinya menghadap loket layanan dan ujung atasnya tiba di koridor lantai 2 dekat Ruang Podcast. Badannya pejal berplester dengan injakan walnut agar terbaca jelas dari sudut kamera mana pun.
Studio live berupa bilik terbuka sesuai arahan pemilik program: tanpa dinding di sisi pintu dan di sisi yang menghadap pintu masuk gedung. Dinding latar walnut dan panel akustik tetap ada di sisi yang tertutup. Loket layanan perizinan terbuka di sisi depannya.
Basis data versi 2 dimutakhirkan otomatis: ukuran ruangan lantai 1 yang belum diubah admin disesuaikan, dan dua loket layanan ditambahkan.
Gudang konsinyasi tidak ada di sketsa, jadi tidak digambar. Pencatatan stok tetap berjalan tanpa bergantung pada ruangan.
Ruang Podcast bisa dijadwalkan seperti studio dan punya lampu ON AIR sendiri.

**D-34. Maket realistis di siang hari.**
Pemilik program meminta hasil yang bagus dan realistis, jadi suasana senja yang gelap diganti dengan siang hari:
- Langit gradien yang juga dipakai sebagai peta pantulan lingkungan, matahari dengan bayangan lembut, dan tone mapping ACES.
- Ambient occlusion (GTAO, setengah resolusi) untuk bayangan kontak, dan bloom hanya untuk sumber cahaya seperti ON AIR dan ring light.
- Lingkungan nyata: rumput, paving, kanstin, jalan bermarka, lampu jalan, pohon bertajuk halus, pagar tanaman, dan tiang bendera Merah Putih.
- Gedung: fasad kaca bermullion aluminium dengan pintu kaca ganda dan kanopi berlogo, dinding samping berjendela (pejal di sisi studio dan toilet), tepi pelat beton, serta tangga dengan balok baja dan pagar kaca.
- Perabot bersudut tumpul sesuai fungsi ruang: studio dengan dinding bilah walnut, rak produk, panel akustik, ring light di tripod, dan softbox; podcast dengan meja bundar dan lengan mikrofon; ruang belajar dengan komputer dan layar besar; ruang tim dengan klaster meja; ruang rapat; serta toilet berkeramik.
- Dinding luar yang menghadap kamera dipotong setinggi ambang jendela (1 m), seperti maket potongan arsitek.
- Figur manusia skala 1:1 bergaya maket (tanpa wajah, berkulit sawo matang, sebagian berkerudung) agar ruang terbaca hidup: seorang host di setiap studio memegang produk ke arah ring light, dua tamu podcast, dua resepsionis berseragam PCC, serta petugas berseragam khaki ASN di loket Disperindag dan berjas putih di loket Dinkes.
- Geometri statis digabung per material agar panggilan gambar tetap sedikit. Peta bayangan hanya dihitung ulang setelah gerakan kamera berhenti. Di ponsel, pascaproses dan sebagian lampu dimatikan.

**D-34a. Model realistis dari Meshy AI.**
Atas permintaan pemilik program, figur dan perabot utama diganti dengan model hasil Meshy AI (text-to-3D, tekstur PBR 2K): host live pria dan wanita berkerudung yang memegang produk, resepsionis berseragam, figur duduk di kursi kantor (khaki ASN dan berkerudung), ring light meja, softbox, monstera dalam pot terakota, sofa sage, pohon peneduh, kursi kantor, dan kursi kayu. Total 13 model, 390 kredit.
- Berkas di `public/model/*.glb` sudah dioptimasi dengan gltf-transform: verteks terkuantisasi, tekstur WebP 1024 px (512 px untuk kursi dan lampu). Ukurannya 0,2–0,8 MB per model, 5,7 MB seluruhnya, dari semula 5–8 MB per model.
- Tidak memakai Draco atau meshopt karena keduanya butuh WASM yang diblokir CSP ketat. Tekstur dibaca lewat elemen gambar, bukan fetch, karena alasan yang sama.
- Maket tampil dulu dengan versi prosedural. Model dimuat sesudahnya dan menggantikan versi prosedural di tempatnya. Bila sebuah model gagal dimuat, versi prosedural tetap dipakai.
- Bahan model disalin per lantai agar pemudaran Lantai 2 tidak ikut memudarkan perabot Lantai 1.

**D-34b. Staf yang hidup: bekerja dan berjalan.**
Atas permintaan pemilik program, semua staf di maket bergerak seperti manusia.
- Karakter: 10 karakter Meshy dalam pose-A, diberi kerangka otomatis, lalu dianimasikan dari pustaka gerak Meshy. Gerakannya: berjalan, diam, berbicara ke kamera, menelepon, duduk, duduk sambil berbicara, bangkit dari kursi, dan duduk kembali. Karakternya: dua host, dua resepsionis, petugas Disperindag dan Dinkes, serta Bang Jack, Didin, Achmad, dan Devita di Ruang Tim Ahli. Biayanya 476 kredit (350 untuk karakter dan kerangka, 126 untuk 42 gerakan).
- Kerangka hasil Meshy berbeda orientasi tulangnya antar-karakter, sehingga setiap karakter dianimasikan dengan klipnya sendiri; klip tidak dipindahkan antar-karakter.
- Klip dirampingkan: hanya rotasi tulang dan translasi pinggul, digabung satu berkas per karakter (0,1–0,2 MB). Posisi pinggul disamakan saat dimuat agar peralihan duduk, bangkit, berjalan, dan duduk kembali tidak melompat.
- Perilaku: setiap staf bekerja di tempatnya, lalu sesekali berdiri dan berjalan ke tujuan di aula (direktori, depan loket, koridor, dekat toilet). Di sana ia singgah, lalu kembali dan duduk lagi.
  - Jalur dicari dengan A* pada kisi 25 cm yang menghindari ruangan, tangga, dan perabot aula.
  - Host tidak meninggalkan studio yang sedang siaran. Satu resepsionis selalu berjaga, dan pengisi podcast tetap di mejanya.
- Staf Ruang Tim Ahli adalah data (kolom `staf` di tabel ruangan, migrasi 4). Admin mengubahnya di Pengaturan → Ruangan. Namanya tampil di papan nama meja dan di panel informasi ruangan maket.
- Performa: karakter tidak ikut peta bayangan (memakai bayangan bundar lembut di kaki), dan animasi berjalan sekitar 30 bingkai per detik hanya di lantai yang tampak. Dengan `prefers-reduced-motion`, staf diam dalam satu pose kerja.
- Figur prosedural tampil sampai karakternya termuat, dan tetap dipakai bila pemuatan gagal.

**D-35. Signage dirancang seperti signage gedung.**
- Papan nama hijau hutan dengan kode ruangan berwarna jingga di samping pintu.
- Huruf kuningan tertanam di lantai ambang pintu, terbaca dari arah datang.
- Kotak lampu ON AIR di atas pintu ruang podcast, dan pada studio terbuka digantung dari langit-langit di tengah bukaan bersama papan namanya. Lampu menyala (dengan pendaran) ketika sesi dimulai.
- Monumen berlogo di pelataran, huruf berlogo di kanopi pintu masuk, dan dinding fitur berlogo di belakang meja resepsionis.
- Papan direktori kedua lantai di dekat pintu masuk, dan tiang petunjuk lantai di kaki tangga.

**D-36. Momen pembuka sekali saja.** Kamera berdiri di pelataran menghadap gedung dua lantai yang utuh, melangkah ke pintu masuk, lalu naik. Saat itu lantai 2 terangkat dan memudar sehingga seluruh lantai 1 terlihat (7,5 detik).
Bisa dilewati dengan tombol *Lewati*, klik, atau Escape. Momen ini tidak diputar bila `prefers-reduced-motion` aktif, dan tidak diulang setelah pernah dilihat (disimpan di `localStorage`).

**D-37. Aksesibilitas 3D.** Kanvas memiliki deskripsi teks yang selalu terbarui, termasuk jumlah studio yang sedang siaran. Daftar ruangan di samping maket berupa tombol yang bisa dipakai dengan papan ketik.
Bila WebGL tidak tersedia, maket diganti denah datar SVG. Di ponsel kualitas bayangan dan jumlah lampu diturunkan.

## Kualitas

**D-38. Uji otomatis.**
`npm test` menguji alur server (termasuk aturan bisnis dan perhitungan dana).
`npm run e2e` menjalankan build produksi dengan basis data kosong di peramban sungguhan dan menelusuri 17 langkah dari pembuatan akun administrator sampai ekspor. Setiap halaman diperiksa dengan axe-core (WCAG 2.1 A/AA), dan uji gagal bila ada galat di konsol.
