# Madin Al Wafa’ — sistem informasi madrasah dan raport online

Aplikasi web untuk Madrasah Diniyah Al Wafa’ (Al Wafa’ Islamic Center, Bangil Pasuruan), dengan tampilan kaca (glassy)
berlatar hijau tosca, aksen emas, dan logo Al Wafa’.
Ada dua jenis akun:

- **Wali santri** (masuk dengan NIS + sandi, atau **daftar sendiri dari ponsel** dengan NIS + nomor WhatsApp aktif): beranda ananda, **raport online** (ringkasan di ponsel, lembar A4, unduh PDF), **kartu santri digital**, foto ananda langsung dari kamera ponsel, kehadiran per bulan, setoran hafalan, status syahriah, jadwal pelajaran, pengumuman, alamat, dan ganti sandi.
- **Pengurus** (masuk dengan nama pengguna + sandi), dengan dua peran:
  - **Administrator**: semua menu, termasuk data santri, kelas, pengaturan, syahriah, akun pengurus, dan menerbitkan raport.
  - **Ustadz/ustadzah**: mengisi absensi, nilai, hafalan, dan isian raport (kepribadian, catatan wali kelas).

## Fitur

| Menu | Isi |
|---|---|
| Dasbor | Santri aktif (putra/putri), absensi hari ini per kelas, grafik kehadiran, kemajuan pengisian nilai, raport terbit, syahriah bulan ini, aktivitas terbaru, tanggal Hijriah |
| Data santri | Tambah/ubah santri dan santriwati, foto santri, alamat dengan kecamatan yang mengisi kabupaten/kota dan provinsi otomatis, NIS otomatis, akun wali dibuat otomatis, kirim sandi lewat WhatsApp, kartu akun wali per kelas, pindah kelas/ubah status massal, pemeriksaan pendaftaran wali, kartu santri digital |
| Kelas & pelajaran | Kelas putra/putri per jenjang (Ula, Wustho, Ulya), wali kelas, mata pelajaran dengan nama Arab, kitab, KKM, pengajar, dan jadwal pekanan |
| Absensi | Hadir/Izin/Sakit/Alpa per pertemuan, rekap bulanan per kelas |
| Nilai | Nilai harian, UTS, UAS dengan bobot yang bisa diatur; nilai akhir, predikat (Mumtaz, Jayyid jiddan, …) dan terbilang dihitung otomatis |
| Raport | Kepribadian, catatan wali kelas, keputusan kenaikan kelas, peringkat, kehadiran, capaian hafalan; pratinjau langsung; terbitkan per santri atau per kelas; cetak satu kelas sekaligus |
| Hafalan | Setoran Al-Qur'an, nadzom, do'a & hadits dengan predikat lancar/cukup/ulang |
| Syahriah | Tabel 12 bulan per kelas, catat beberapa bulan sekaligus, pengingat tunggakan lewat WhatsApp |
| Pengumuman | Untuk semua wali, wali santri putra, wali santriwati, atau satu kelas |
| Pesan otomatis | Laporan harian santri untuk setiap guru (bawaan pukul 18:00 WIB) dan pengingat syahriah setiap 3 hari sampai lunas, lewat WhatsApp |
| Pengaturan | Identitas madrasah (kop raport), tahun ajaran & semester, bobot nilai, iuran syahriah, tata tertib di balik kartu santri, akun pengurus, riwayat aktivitas |

### Raport online

- Raport **draf** hanya terlihat oleh pengurus. Raport baru bisa diterbitkan bila semua nilai, kepribadian, dan (semester genap) keputusan sudah diisi.
- Saat **terbit**, isi raport dibekukan dan diberi **kode verifikasi + QR**. Nilai santri itu terkunci; untuk memperbaikinya, tarik raport, ubah, lalu terbitkan lagi.
- Siapa pun bisa memeriksa keaslian di `/verifikasi/KODE`. Halaman itu hanya menampilkan ringkasan dengan nama yang disamarkan, bukan rincian nilai.
- Lembar raport dirancang muat satu halaman A4. Wali menekan **Unduh PDF**, lalu memilih *Simpan sebagai PDF*.

### Foto, pendaftaran wali, dan kartu santri

- **Foto santri** diambil dari kamera ponsel (langsung selfie) atau galeri, lalu digeser/diperbesar agar wajah pas di bingkai 3×4.
  Foto dikompres di ponsel (sekitar 60–150 KB), disimpan di basis data, dan hanya bisa dilihat pengurus dan wali santri itu sendiri.
- **Daftar akun wali** (`/daftar`): wali mengisi NIS, nama, nomor WhatsApp aktif, alamat, dan sandi pilihannya.
  Bila nomor WhatsApp **sama** dengan yang tercatat di madrasah, akun langsung aktif. Bila **berbeda atau belum tercatat**,
  pendaftaran menunggu di *Data santri* sampai administrator menghubungi nomor itu lalu menyetujui atau menolaknya.
- **Alamat otomatis**: ketik nama kecamatan (mis. "bangil"), pilih dari daftar, maka kabupaten/kota dan provinsi terisi sendiri.
  Data 7.285 kecamatan seluruh Indonesia ada di dalam aplikasi (lihat `src/data/WILAYAH.md`), tanpa layanan luar.
- **Kartu santri digital** (ukuran kartu ATM, 54 × 85,6 mm): depan berisi foto, nama, NIS, kelas, data lahir, wali, alamat, dan QR;
  belakang berisi tata tertib. Ketuk kartu untuk membaliknya, atau cetak depan-belakang lalu laminasi. QR membuka `/kartu/KODE`
  yang hanya menampilkan nama, NIS, kelas, dan status aktif (tanpa foto dan alamat).
- **Tata tertib** di balik kartu masih **draf** dan bisa diganti di *Pengaturan › Kartu santri*, dengan pratinjau langsung.

### Pesan WhatsApp otomatis

- **Laporan harian guru** (bawaan 18:00 WIB): setiap guru yang punya nomor HP menerima rekap kelas yang diajarnya
  (sebagai wali kelas atau pengajar): hadir, izin, sakit, alpa beserta namanya, dan setoran hafalan. Administrator menerima semua kelas,
  ditambah syahriah yang masuk hari itu dan pendaftaran wali yang menunggu. Hari tanpa pelajaran tidak dikirimi laporan.
- **Pengingat syahriah**: wali yang syahriahnya belum tercatat (lewat tanggal jatuh tempo, bawaan tanggal 10) diingatkan
  **setiap 3 hari** (bawaan 09:00 WIB) sampai lunas. Jeda hari, jam, dan tanggal jatuh tempo bisa diatur.
- **Cara kirim**:
  - *Manual* (bawaan): pesan dibuat otomatis sesuai jadwal dan menunggu di *Pesan otomatis › Kotak keluar*. Admin mengetuk
    **Kirim via WhatsApp** dan pesan terbuka di WhatsApp siap dikirim. Tidak perlu biaya atau akun tambahan.
  - *Otomatis* lewat [Fonnte](https://fonnte.com): daftar, hubungkan nomor WhatsApp madrasah dengan memindai QR di dasbor Fonnte,
    lalu salin token perangkat ke *Pesan otomatis › Pengaturan*. Pesan terkirim sendiri tanpa disentuh. Gunakan nomor khusus madrasah,
    bukan nomor pribadi.
- Jadwal hanya berjalan bila server menyala terus (VPS). Pratinjau tanpa server tidak bisa mengirim pesan terjadwal; tombol
  *Buat laporan hari ini* dan *Proses pengingat sekarang* tetap bisa dicoba di sana.

## Menjalankan

Butuh Node.js 20.11 atau lebih baru.

```bash
npm install
npm run build
npm start                      # http://localhost:8080, data di ./data
```

Saat pertama dibuka, aplikasi meminta pembuatan akun administrator dan langsung membuat empat kelas:
Sayyidina Husein (1) dan Sayyidina Hasan (2) untuk putra, Sayyidah Fatimah (1) dan Sayyidah Khodijah (2) untuk putri.
Setelah itu buka **Pengaturan** dan lengkapi nama kepala madrasah, alamat lengkap, serta tahun ajaran/semester,
lalu atur mata pelajaran tiap kelas dan masukkan santri. Nama lembaga, lembaga induk, dan kota (Bangil) sudah terisi dan bisa diubah.

### Mode demo

```bash
npm run build && npm run demo     # data contoh di ./data-demo, http://localhost:8080
npm run demo:ulang                # hapus dan buat ulang data contoh
```

Halaman masuk demo menampilkan akun contoh dan tombol *Isi otomatis*:
pengurus `admin` / `demo-wafa-2026`, wali santri NIS yang ditampilkan / `wafa2026`.
Semua nama dan angka demo adalah rekaan. `npm start` menolak memakai basis data demo, sehingga data contoh tidak terbawa ke data sungguhan.

### Pratinjau tanpa server

```bash
npm run pratinjau     # hasil: dist/pratinjau/madin-alwafa-pratinjau.html (±3 MB)
```

Satu berkas HTML berisi aplikasi lengkap untuk ditunjukkan ke klien tanpa VPS. Server (Hono) dan basis data (SQLite versi
JavaScript, sql.js) ikut berjalan di peramban, sehingga semua menu bisa dicoba: isi absensi, nilai, terbitkan raport, tambah santri.
Data contoh dibuat saat halaman dibuka; perubahan hanya ada di tab itu dan hilang saat dimuat ulang. Cetak/PDF dimatikan di pratinjau.
Bagian khusus Node diganti padanannya di `src/pratinjau/` lewat `vite.pratinjau.config.ts`; kode aplikasi dan server sama dengan versi terpasang.

### Pengembangan

```bash
npm run dev          # API + Vite dengan muat ulang otomatis, http://localhost:5173
npm run dev:demo     # sama, dengan data contoh
npm run typecheck
npm test             # uji alur server
npm run e2e          # uji peramban ujung ke ujung (perlu `npm run build`)
npm run uji:menyeluruh  # tekan setiap tombol semua peran, 5 lebar layar, cek aksesibilitas (perlu `npm run build`)
```

## Memasang di VPS (mis. port 3012)

```bash
git clone <repo> && cd <repo>/madin-alwafa
npm ci && npm run build
PORT=3012 DATA_DIR=/var/lib/madin-alwafa npm start
```

Jalankan perintah dari folder `madin-alwafa`, dan pastikan folder `DATA_DIR` bisa ditulisi pengguna yang menjalankan aplikasi.
Agar tetap berjalan setelah VPS dinyalakan ulang, pakai PM2:

```bash
npm i -g pm2
NODE_ENV=production PORT=3012 DATA_DIR=/var/lib/madin-alwafa pm2 start dist/server/index.js --name madin-alwafa
pm2 save && pm2 startup
```

atau systemd (`/etc/systemd/system/madin-alwafa.service`):

```ini
[Unit]
Description=Madin Al-Wafa
After=network.target

[Service]
WorkingDirectory=/opt/madin-alwafa
Environment=NODE_ENV=production PORT=3012 DATA_DIR=/var/lib/madin-alwafa
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

**Domain dan HTTPS (disarankan).** Pasang Nginx/Caddy di depan aplikasi, arahkan ke `http://127.0.0.1:3012`, dan isi `TRUST_PROXY=1`.
Tanpa HTTPS, sandi wali dan pengurus terkirim tanpa enkripsi. Aplikasi tetap bisa dibuka lewat `http://IP:3012` untuk uji coba.

**Cadangan.** Semua data ada di satu folder (`DATA_DIR`, berkas `madin.db`). Salin folder itu secara berkala, misalnya dengan
`sqlite3 /var/lib/madin-alwafa/madin.db ".backup '/cadangan/madin-$(date +%F).db'"`.

## Variabel lingkungan

| Nama | Bawaan | Keterangan |
|---|---|---|
| `PORT` | `8080` | Port server |
| `DATA_DIR` | `./data` | Folder basis data SQLite; cadangkan folder ini |
| `TRUST_PROXY` | kosong | Isi `1` bila berada di belakang Nginx/Caddy, agar alamat IP dan HTTPS terbaca benar |
| `COOKIE_SECURE` | otomatis | Bawaan mengikuti protokol (HTTPS → cookie Secure). Isi `true`/`false` untuk memaksa |
| `PENJADWAL` | menyala | Isi `0` untuk mematikan laporan harian dan pengingat syahriah terjadwal (mis. di server cadangan) |
| `WA_JEDA_MS` | `4000` | Jeda antarpesan WhatsApp lewat gateway, agar nomor madrasah tidak dianggap spam |
| `WA_FONNTE_URL` | `https://api.fonnte.com/send` | Alamat API Fonnte (hanya diubah untuk pengujian) |

## Keamanan

- Sandi disimpan dengan scrypt; sesi berupa cookie HttpOnly. Ganti sandi atau reset sandi mengakhiri sesi di perangkat lain.
- Percobaan masuk dibatasi 8 kali per 10 menit untuk setiap NIS/nama pengguna dan alamat IP.
- Setiap perubahan data wajib membawa header khusus aplikasi (perlindungan CSRF), dan pembatasan peran diperiksa di server.
- Wali santri hanya bisa membaca data ananda sendiri, dan raport hanya setelah diterbitkan.
- Foto santri hanya disajikan kepada pengurus dan wali santri itu sendiri; jenis berkas diperiksa dari isinya, bukan dari namanya.
- Pendaftaran wali dibatasi per alamat IP. Nomor yang tidak cocok dengan data madrasah tidak pernah langsung aktif.
- Token gateway WhatsApp disimpan di server dan tidak pernah dikirim ke peramban.

## Struktur

```
server/          API (Hono) dan basis data SQLite
  domain/        penyusunan raport, peringkat, kehadiran, penerbitan
  routes/        auth, publik (verifikasi), santri, akademik, kbm, raport, lembaga, wali
  demo-data.ts   data contoh
shared/          format tanggal (WIB & Hijriah), terbilang, predikat, kosakata
src/             antarmuka React
  halaman/admin  ruang pengurus
  halaman/wali   portal wali santri
  halaman/raport lembar raport A4 dan kode QR
  styles/        token desain kaca, komponen, tata letak, lembar raport
tests/e2e.mjs    uji peramban ujung ke ujung
tests/menyeluruh.mjs  uji menyeluruh: 114 pemeriksaan tombol, tata letak, dan aksesibilitas
```
