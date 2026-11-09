# Madin Al-Wafa — sistem informasi madrasah dan raport online

Aplikasi web untuk Madrasah Diniyah Al-Wafa, dengan tampilan kaca (glassy) bernuansa zamrud dan emas.
Ada dua jenis akun:

- **Wali santri** (masuk dengan NIS + sandi): beranda ananda, **raport online** (ringkasan di ponsel, lembar A4, unduh PDF), kehadiran per bulan, setoran hafalan, status syahriah, jadwal pelajaran, pengumuman, dan ganti sandi.
- **Pengurus** (masuk dengan nama pengguna + sandi), dengan dua peran:
  - **Administrator**: semua menu, termasuk data santri, kelas, pengaturan, syahriah, akun pengurus, dan menerbitkan raport.
  - **Ustadz/ustadzah**: mengisi absensi, nilai, hafalan, dan isian raport (kepribadian, catatan wali kelas).

## Fitur

| Menu | Isi |
|---|---|
| Dasbor | Santri aktif (putra/putri), absensi hari ini per kelas, grafik kehadiran, kemajuan pengisian nilai, raport terbit, syahriah bulan ini, aktivitas terbaru, tanggal Hijriah |
| Data santri | Tambah/ubah santri dan santriwati, NIS otomatis, akun wali dibuat otomatis, kirim sandi lewat WhatsApp, kartu akun wali per kelas untuk dicetak, pindah kelas/ubah status massal |
| Kelas & pelajaran | Kelas putra/putri per jenjang (Ula, Wustho, Ulya), wali kelas, mata pelajaran dengan nama Arab, kitab, KKM, pengajar, dan jadwal pekanan |
| Absensi | Hadir/Izin/Sakit/Alpa per pertemuan, rekap bulanan per kelas |
| Nilai | Nilai harian, UTS, UAS dengan bobot yang bisa diatur; nilai akhir, predikat (Mumtaz, Jayyid jiddan, …) dan terbilang dihitung otomatis |
| Raport | Kepribadian, catatan wali kelas, keputusan kenaikan kelas, peringkat, kehadiran, capaian hafalan; pratinjau langsung; terbitkan per santri atau per kelas; cetak satu kelas sekaligus |
| Hafalan | Setoran Al-Qur'an, nadzom, do'a & hadits dengan predikat lancar/cukup/ulang |
| Syahriah | Tabel 12 bulan per kelas, catat beberapa bulan sekaligus, pengingat tunggakan lewat WhatsApp |
| Pengumuman | Untuk semua wali, wali santri putra, wali santriwati, atau satu kelas |
| Pengaturan | Identitas madrasah (kop raport), tahun ajaran & semester, bobot nilai, iuran syahriah, akun pengurus, riwayat aktivitas |

### Raport online

- Raport **draf** hanya terlihat oleh pengurus. Raport baru bisa diterbitkan bila semua nilai, kepribadian, dan (semester genap) keputusan sudah diisi.
- Saat **terbit**, isi raport dibekukan dan diberi **kode verifikasi + QR**. Nilai santri itu terkunci; untuk memperbaikinya, tarik raport, ubah, lalu terbitkan lagi.
- Siapa pun bisa memeriksa keaslian di `/verifikasi/KODE`. Halaman itu hanya menampilkan ringkasan dengan nama yang disamarkan, bukan rincian nilai.
- Lembar raport dirancang muat satu halaman A4. Wali menekan **Unduh PDF**, lalu memilih *Simpan sebagai PDF*.

## Menjalankan

Butuh Node.js 20.11 atau lebih baru.

```bash
npm install
npm run build
npm start                      # http://localhost:8080, data di ./data
```

Saat pertama dibuka, aplikasi meminta pembuatan akun administrator. Setelah itu buka **Pengaturan** dan lengkapi:
alamat dan kota madrasah, nama kepala madrasah, tahun ajaran/semester, lalu kelas, mata pelajaran, dan santri.

### Mode demo

```bash
npm run build && npm run demo     # data contoh di ./data-demo, http://localhost:8080
npm run demo:ulang                # hapus dan buat ulang data contoh
```

Halaman masuk demo menampilkan akun contoh dan tombol *Isi otomatis*:
pengurus `admin` / `demo-wafa-2026`, wali santri NIS yang ditampilkan / `wafa2026`.
Semua nama dan angka demo adalah rekaan. `npm start` menolak memakai basis data demo, sehingga data contoh tidak terbawa ke data sungguhan.

### Pengembangan

```bash
npm run dev          # API + Vite dengan muat ulang otomatis, http://localhost:5173
npm run dev:demo     # sama, dengan data contoh
npm run typecheck
npm test             # uji alur server
npm run e2e          # uji peramban ujung ke ujung (perlu `npm run build`)
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

## Keamanan

- Sandi disimpan dengan scrypt; sesi berupa cookie HttpOnly. Ganti sandi atau reset sandi mengakhiri sesi di perangkat lain.
- Percobaan masuk dibatasi 8 kali per 10 menit untuk setiap NIS/nama pengguna dan alamat IP.
- Setiap perubahan data wajib membawa header khusus aplikasi (perlindungan CSRF), dan pembatasan peran diperiksa di server.
- Wali santri hanya bisa membaca data ananda sendiri, dan raport hanya setelah diterbitkan.

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
```
