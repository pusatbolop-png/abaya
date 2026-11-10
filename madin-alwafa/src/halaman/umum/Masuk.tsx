import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { BookOpenCheck, CalendarCheck2, Eye, EyeOff, KeyRound, LogIn, ScrollText, ShieldCheck, UserRound, Users } from 'lucide-react';
import { api, GalatApi } from '../../lib/api';
import { useSesi } from '../../lib/sesi';
import { Bidang, Pesan, Tombol, useIngat, useJudul } from '../../ui/dasar';
import { LogoLengkap } from '../../ui/Lambang';
import { PitaDemo } from '../../ui/PitaDemo';

type Jenis = 'wali' | 'pengurus';

export function Masuk() {
  useJudul('Masuk');
  const { lembaga, demo, muatUlang } = useSesi();
  const navigasi = useNavigate();
  const [jenis, setJenis] = useIngat<Jenis>('jenis-masuk', 'wali');
  const [id, setId] = useState('');
  const [sandi, setSandi] = useState('');
  const [lihat, setLihat] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  const ganti = (j: Jenis) => {
    setJenis(j);
    setId('');
    setSandi('');
    setGalat('');
  };

  const kirim = async () => {
    setSibuk(true);
    setGalat('');
    try {
      if (jenis === 'wali') await api('POST', '/api/auth/masuk-wali', { nis: id, sandi });
      else await api('POST', '/api/auth/masuk-pengurus', { username: id, sandi });
      await muatUlang();
      navigasi(jenis === 'wali' ? '/wali' : '/admin', { replace: true });
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.message : 'Gagal masuk. Coba lagi.');
      setSibuk(false);
    }
  };

  return (
    <>
      <PitaDemo />
      <main className="masuk">
        <section className="masuk__hero">
          <LogoLengkap className="masuk__logo" />
          <div className="tumpuk" style={{ gap: 10 }}>
            {lembaga.namaArab && <div className="masuk__arab">{lembaga.namaArab}</div>}
            <h1 className="masuk__judul">{lembaga.nama}</h1>
            {lembaga.slogan && <p className="masuk__semboyan">{lembaga.slogan}</p>}
            <p className="masuk__slogan">Pantau perkembangan ananda — raport, kehadiran, hafalan, dan syahriah — dalam satu tempat.</p>
          </div>
          <div className="masuk__fitur">
            <div>
              <ScrollText />
              <b>Raport online</b>
              Lihat, unduh, dan cetak raport bersegel QR.
            </div>
            <div>
              <CalendarCheck2 />
              <b>Kehadiran</b>
              Rekap hadir, izin, dan sakit setiap hari.
            </div>
            <div>
              <BookOpenCheck />
              <b>Hafalan</b>
              Setoran Al-Qur'an, nadzom, dan do'a.
            </div>
          </div>
        </section>

        <section className="kaca kaca--emas kaca--kilau masuk__kartu" aria-labelledby="judul-masuk">
          <div className="tumpuk tumpuk--rapat">
            <h2 id="judul-masuk">Ahlan wa sahlan</h2>
            <p className="redup kecil">Masuk sebagai wali santri atau pengurus madrasah.</p>
          </div>
          <div className="segmen" role="tablist" style={{ width: '100%' }}>
            <button role="tab" aria-selected={jenis === 'wali'} onClick={() => ganti('wali')} style={{ flex: 1, justifyContent: 'center' }}>
              <Users /> Wali santri
            </button>
            <button role="tab" aria-selected={jenis === 'pengurus'} onClick={() => ganti('pengurus')} style={{ flex: 1, justifyContent: 'center' }}>
              <ShieldCheck /> Pengurus
            </button>
          </div>

          <form
            className="tumpuk"
            onSubmit={(e) => {
              e.preventDefault();
              kirim();
            }}
          >
            <Bidang label={jenis === 'wali' ? 'Nomor Induk Santri (NIS)' : 'Nama pengguna'}>
              <div className="masukan-ikon">
                {jenis === 'wali' ? <KeyRound /> : <UserRound />}
                <input
                  className="masukan"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  autoComplete="username"
                  inputMode={jenis === 'wali' ? 'numeric' : 'text'}
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={jenis === 'wali' ? 'NIS ananda' : 'Nama pengguna'}
                  required
                />
              </div>
            </Bidang>
            <Bidang label="Sandi">
              <div className="masukan-ikon">
                <KeyRound />
                <input
                  className="masukan"
                  type={lihat ? 'text' : 'password'}
                  value={sandi}
                  onChange={(e) => setSandi(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Sandi"
                  required
                  style={{ paddingRight: 48 }}
                />
                <Tombol varian="hantu" ukuran="kecil" ikon={lihat ? <EyeOff /> : <Eye />} onClick={() => setLihat(!lihat)} aria-label={lihat ? 'Sembunyikan sandi' : 'Tampilkan sandi'} />
              </div>
            </Bidang>
            {galat && <Pesan jenis="bahaya">{galat}</Pesan>}
            <Tombol type="submit" varian="utama" ukuran="besar" penuh sibuk={sibuk} ikon={<LogIn />}>
              Masuk
            </Tombol>
          </form>

          {demo && (
            <Pesan jenis="info" judul="Akun demo">
              <div className="tumpuk tumpuk--rapat" style={{ gap: 6 }}>
                <span>
                  Wali: NIS <b>{demo.nis}</b> · sandi <b>{demo.sandiWali}</b>
                  <br />
                  Pengurus: <b>{demo.username}</b> · sandi <b>{demo.sandi}</b>
                </span>
                <button
                  type="button"
                  className="tombol tombol--kecil"
                  style={{ justifySelf: 'start' }}
                  onClick={() => {
                    if (jenis === 'wali') {
                      setId(demo.nis);
                      setSandi(demo.sandiWali);
                    } else {
                      setId(demo.username);
                      setSandi(demo.sandi);
                    }
                  }}
                >
                  Isi otomatis
                </button>
              </div>
            </Pesan>
          )}

          <p className="masuk__kaki">
            {jenis === 'wali' ? 'NIS dan sandi awal diberikan oleh pengurus madrasah. ' : 'Lupa sandi? Minta administrator membuat sandi baru. '}
            <Link to="/verifikasi">Periksa keaslian raport</Link>
          </p>
        </section>
      </main>
    </>
  );
}
