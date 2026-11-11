import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, CircleCheck, Clock, Eye, EyeOff, IdCard, LockKeyhole, MessageCircle, UserPlus, UserRound } from 'lucide-react';
import { kirim } from '../../lib/api';
import { useKirim } from '../../lib/pakai';
import { useSesi } from '../../lib/sesi';
import { useToast } from '../../lib/toast';
import { Bidang, Pesan, Tombol, useJudul } from '../../ui/dasar';
import { ALAMAT_KOSONG, IsianAlamat, type Alamat } from '../../ui/IsianAlamat';
import { LogoLengkap } from '../../ui/Lambang';
import { PitaDemo } from '../../ui/PitaDemo';

type Hubungan = 'Ayah' | 'Ibu' | 'Wali';

export default function Daftar() {
  useJudul('Daftar akun wali');
  const { lembaga, demo, muatUlang } = useSesi();
  const navigasi = useNavigate();
  const toast = useToast();
  const { sibuk, bidang, jalankan } = useKirim();
  const [f, setF] = useState({ nis: '', hp: '', namaWali: '', hubungan: 'Ayah' as Hubungan, sandi: '', ulang: '' });
  const [alamat, setAlamat] = useState<Alamat>(ALAMAT_KOSONG);
  const [lihat, setLihat] = useState(false);
  const [galatUlang, setGalatUlang] = useState('');
  const [hasil, setHasil] = useState<{ status: 'aktif' | 'menunggu'; nama: string } | null>(null);

  const daftar = () => {
    setGalatUlang('');
    if (f.sandi !== f.ulang) {
      setGalatUlang('Sandi tidak sama.');
      return;
    }
    jalankan(async () => {
      const r = await kirim<{ status: 'aktif' | 'menunggu'; nama: string }>('POST', '/api/auth/daftar-wali', {
        nis: f.nis,
        hp: f.hp,
        namaWali: f.namaWali,
        hubungan: f.hubungan,
        sandi: f.sandi,
        ...alamat,
      });
      setHasil(r);
      window.scrollTo({ top: 0 });
    }).catch(toast.galat);
  };

  if (hasil) {
    return (
      <>
        <PitaDemo />
        <main className="halaman-daftar">
          <section className="kaca kaca--emas kaca--kilau halaman-daftar__kartu halaman-daftar__hasil" aria-live="polite">
            {hasil.status === 'aktif' ? (
              <>
                <span className="halaman-daftar__ikon halaman-daftar__ikon--ok">
                  <CircleCheck />
                </span>
                <h1 className="judul-hias">Akun wali aktif</h1>
                <p className="redup">
                  Nomor WhatsApp Anda cocok dengan data madrasah, jadi akun wali untuk ananda <b>{hasil.nama}</b> langsung aktif. Selanjutnya masuk dengan NIS dan sandi yang
                  baru saja Anda buat.
                </p>
                <Tombol
                  varian="utama"
                  penuh
                  onClick={async () => {
                    await muatUlang();
                    navigasi('/wali', { replace: true });
                  }}
                >
                  Buka beranda wali
                </Tombol>
              </>
            ) : (
              <>
                <span className="halaman-daftar__ikon">
                  <Clock />
                </span>
                <h1 className="judul-hias">Pendaftaran terkirim</h1>
                <p className="redup">
                  Nomor WhatsApp yang Anda masukkan belum tercatat di madrasah, jadi madrasah akan memeriksanya lebih dulu. Anda akan dihubungi lewat WhatsApp setelah disetujui,
                  lalu bisa masuk dengan NIS ananda <b>{hasil.nama}</b> dan sandi yang baru Anda buat.
                </p>
                <Link to="/" className="tombol tombol--penuh">
                  Kembali ke halaman masuk
                </Link>
              </>
            )}
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <PitaDemo />
      <main className="halaman-daftar">
        <div className="halaman-daftar__kepala">
          <Link to="/" className="tautan-kembali">
            <ArrowLeft /> Halaman masuk
          </Link>
          <LogoLengkap className="halaman-daftar__logo" />
        </div>
        <form
          className="kaca kaca--emas kaca--kilau halaman-daftar__kartu"
          onSubmit={(e) => {
            e.preventDefault();
            daftar();
          }}
          aria-labelledby="judul-daftar"
        >
          <div className="tumpuk tumpuk--rapat">
            <h1 id="judul-daftar" className="judul-hias halaman-daftar__judul">
              Daftar akun wali santri
            </h1>
            <p className="redup kecil">
              Untuk orang tua atau wali santri {lembaga.singkatan}. Siapkan NIS ananda (ada di kartu atau raport) dan nomor WhatsApp yang aktif.
            </p>
          </div>

          {demo?.daftarNis && (
            <Pesan judul="Coba pendaftaran">
              NIS <b>{demo.daftarNis}</b> · WhatsApp <b>{demo.daftarHp}</b> (nomor tercatat, akun langsung aktif).
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="tombol tombol--kecil"
                  onClick={() => {
                    setF({ ...f, nis: demo.daftarNis, hp: demo.daftarHp, namaWali: 'Bapak Wali Contoh', sandi: 'wali-contoh-1', ulang: 'wali-contoh-1' });
                    setAlamat({ alamat: 'Dusun Krajan RT 02/RW 01', desa: 'Kalirejo', kecamatan: 'Bangil', kabupaten: 'Kabupaten Pasuruan', provinsi: 'Jawa Timur', kodeWilayah: '35.14.14' });
                  }}
                >
                  Isi contoh
                </button>
              </div>
            </Pesan>
          )}

          <fieldset className="halaman-daftar__bagian">
            <legend>
              <span>1</span> Santri
            </legend>
            <Bidang label="Nomor Induk Santri (NIS)" wajib galat={bidang.nis} bantu="Tertulis di kartu santri, raport, atau tanyakan kepada wali kelas.">
              <div className="masukan-ikon">
                <IdCard />
                <input
                  className="masukan angka"
                  value={f.nis}
                  onChange={(e) => setF({ ...f, nis: e.target.value })}
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder="Mis. 250011"
                  required
                />
              </div>
            </Bidang>
          </fieldset>

          <fieldset className="halaman-daftar__bagian">
            <legend>
              <span>2</span> Orang tua / wali
            </legend>
            <Bidang label="Hubungan dengan santri" wajib grup>
              <div className="segmen" role="radiogroup" style={{ width: '100%' }}>
                {(['Ayah', 'Ibu', 'Wali'] as const).map((h) => (
                  <button key={h} type="button" role="radio" aria-checked={f.hubungan === h} onClick={() => setF({ ...f, hubungan: h })} style={{ flex: 1, justifyContent: 'center' }}>
                    {h}
                  </button>
                ))}
              </div>
            </Bidang>
            <Bidang label="Nama lengkap" wajib galat={bidang.namaWali}>
              <div className="masukan-ikon">
                <UserRound />
                <input className="masukan" value={f.namaWali} onChange={(e) => setF({ ...f, namaWali: e.target.value })} autoComplete="name" required />
              </div>
            </Bidang>
            <Bidang
              label="Nomor WhatsApp aktif"
              wajib
              galat={bidang.hp}
              bantu="Pakai nomor yang dulu diberikan ke madrasah agar akun langsung aktif. Nomor lain akan diperiksa madrasah lebih dulu."
            >
              <div className="masukan-ikon">
                <MessageCircle />
                <input
                  className="masukan angka"
                  type="tel"
                  inputMode="tel"
                  value={f.hp}
                  onChange={(e) => setF({ ...f, hp: e.target.value })}
                  autoComplete="tel"
                  placeholder="0812-3456-7890"
                  required
                />
              </div>
            </Bidang>
          </fieldset>

          <fieldset className="halaman-daftar__bagian">
            <legend>
              <span>3</span> Alamat
            </legend>
            <IsianAlamat nilai={alamat} ubah={setAlamat} galat={bidang} wajibKecamatan />
          </fieldset>

          <fieldset className="halaman-daftar__bagian">
            <legend>
              <span>4</span> Sandi
            </legend>
            <Bidang label="Buat sandi" wajib galat={bidang.sandi} bantu="Paling sedikit 8 karakter. Simpan baik-baik; dipakai setiap kali masuk.">
              <div className="masukan-ikon">
                <LockKeyhole />
                <input
                  className="masukan"
                  type={lihat ? 'text' : 'password'}
                  value={f.sandi}
                  onChange={(e) => setF({ ...f, sandi: e.target.value })}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <Tombol varian="hantu" ukuran="kecil" ikon={lihat ? <EyeOff /> : <Eye />} onClick={() => setLihat(!lihat)} aria-label={lihat ? 'Sembunyikan sandi' : 'Tampilkan sandi'} />
              </div>
            </Bidang>
            <Bidang label="Ketik ulang sandi" wajib galat={galatUlang}>
              <input className="masukan" type={lihat ? 'text' : 'password'} value={f.ulang} onChange={(e) => setF({ ...f, ulang: e.target.value })} autoComplete="new-password" required />
            </Bidang>
          </fieldset>

          <Tombol type="submit" varian="utama" ukuran="besar" penuh ikon={<UserPlus />} sibuk={sibuk}>
            Daftar
          </Tombol>
          <p className="masuk__kaki">
            Sudah punya akun? <Link to="/">Masuk</Link>
          </p>
        </form>
      </main>
    </>
  );
}
