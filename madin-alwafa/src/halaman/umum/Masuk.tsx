import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Eye, EyeOff, GraduationCap, IdCard, LockKeyhole, LogIn, ShieldCheck, UserPlus, UserRound, Users } from 'lucide-react';
import { api, GalatApi } from '../../lib/api';
import { useSesi } from '../../lib/sesi';
import { Bidang, Pesan, Tombol, useJudul } from '../../ui/dasar';
import { LogoLengkap } from '../../ui/Lambang';
import { PitaDemo } from '../../ui/PitaDemo';

export type Pintu = 'wali' | 'guru' | 'pengurus';

/** Pintu masuk yang terakhir dipakai di perangkat ini, agar keluar/sesi habis kembali ke halaman yang sama. */
export const ingatPintu = (p: Pintu) => {
  try {
    localStorage.setItem('madin:pintu', p);
  } catch {
    /* tanpa penyimpanan peramban */
  }
};
export const pintuTerakhir = (): string => {
  try {
    const p = localStorage.getItem('madin:pintu');
    return p === 'guru' ? '/guru' : p === 'pengurus' ? '/pengurus' : '/';
  } catch {
    return '/';
  }
};

const TEKS: Record<Pintu, { sapa: string; sub: string; ikon: typeof Users }> = {
  wali: { sapa: 'Ahlan wa sahlan', sub: 'Masuk untuk melihat perkembangan ananda.', ikon: Users },
  guru: { sapa: 'Ruang guru', sub: 'Masuk dengan akun guru dari madrasah.', ikon: GraduationCap },
  pengurus: { sapa: 'Ruang pengurus', sub: 'Khusus administrator madrasah.', ikon: ShieldCheck },
};

export function Masuk({ pintu = 'wali' }: { pintu?: Pintu }) {
  useJudul(pintu === 'wali' ? 'Masuk' : pintu === 'guru' ? 'Masuk guru' : 'Masuk pengurus');
  const { lembaga, demo, muatUlang } = useSesi();
  const navigasi = useNavigate();
  const jenis = pintu;
  const [id, setId] = useState('');
  const [sandi, setSandi] = useState('');
  const [lihat, setLihat] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  const kirim = async () => {
    setSibuk(true);
    setGalat('');
    try {
      if (jenis === 'wali') await api('POST', '/api/auth/masuk-wali', { nis: id, sandi });
      else await api('POST', '/api/auth/masuk-pengurus', { username: id, sandi, pintu: jenis });
      ingatPintu(jenis);
      await muatUlang();
      navigasi(jenis === 'wali' ? '/wali' : '/admin', { replace: true });
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.message : 'Gagal masuk. Coba lagi.');
      setSibuk(false);
    }
  };

  const tanda = `© ${new Date().getFullYear()} ${lembaga.naungan || lembaga.nama}${lembaga.kota ? ` · ${lembaga.kota}` : ''}`;

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
            <p className="masuk__slogan">
              {jenis === 'wali'
                ? 'Raport, kehadiran, hafalan, dan syahriah ananda, bisa dilihat kapan saja dari ponsel.'
                : jenis === 'guru'
                  ? 'Absen kehadiran, nilai harian, dan absensi santri dalam satu tempat.'
                  : 'Kelola santri, guru, raport, syahriah, dan pesan otomatis madrasah.'}
            </p>
          </div>
          <p className="masuk__tanda">{tanda}</p>
        </section>

        <section className="kaca kaca--emas kaca--kilau masuk__kartu" aria-labelledby="judul-masuk">
          <div className="tumpuk tumpuk--rapat">
            <h2 id="judul-masuk" className="baris" style={{ gap: 10 }}>
              {jenis !== 'wali' && <span className="stat__ikon">{(() => { const I = TEKS[jenis].ikon; return <I />; })()}</span>}
              {TEKS[jenis].sapa}
            </h2>
            <p className="redup kecil">{TEKS[jenis].sub}</p>
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
                {jenis === 'wali' ? <IdCard /> : <UserRound />}
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
                <LockKeyhole />
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
          {jenis === 'wali' && (
            <Link to="/daftar" className="masuk__daftar">
              <UserPlus />
              <span>
                <b>Belum punya akun?</b> Daftar dengan NIS ananda dan nomor WhatsApp aktif
              </span>
            </Link>
          )}

          {demo && (
            <Pesan jenis="info" judul="Akun demo">
              <div className="tumpuk tumpuk--rapat" style={{ gap: 6 }}>
                <span>
                  {jenis === 'wali' ? (
                    <>
                      NIS <b>{demo.nis}</b> · sandi <b>{demo.sandiWali}</b>
                    </>
                  ) : (
                    <>
                      Nama pengguna <b>{jenis === 'guru' ? demo.guru : demo.username}</b> · sandi <b>{demo.sandi}</b>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className="tombol tombol--kecil"
                  style={{ justifySelf: 'start' }}
                  onClick={() => {
                    setId(jenis === 'wali' ? demo.nis : jenis === 'guru' ? demo.guru : demo.username);
                    setSandi(jenis === 'wali' ? demo.sandiWali : demo.sandi);
                  }}
                >
                  Isi otomatis
                </button>
              </div>
            </Pesan>
          )}

          <p className="masuk__kaki">
            {jenis === 'wali' ? (
              <>
                Lupa sandi? Hubungi madrasah. <Link to="/verifikasi">Periksa keaslian raport</Link>
              </>
            ) : (
              'Lupa sandi? Minta administrator membuat sandi baru.'
            )}
          </p>
        </section>
        <p className="masuk__tanda masuk__tanda--bawah">{tanda}</p>
      </main>
    </>
  );
}
