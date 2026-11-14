import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, Eye, EyeOff, GraduationCap, IdCard, LockKeyhole, LogIn, ShieldCheck, UserPlus, UserRound, Users } from 'lucide-react';
import { api, GalatApi } from '../../lib/api';
import { useSesi } from '../../lib/sesi';
import { Bidang, Pesan, Tombol, useJudul } from '../../ui/dasar';
import poster from '../../aset/poster-alwafa.webp';
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

const TEKS: Record<Pintu, { label: string; sapa: string; sub: string; muka: string; ikon: typeof Users }> = {
  wali: { label: 'Wali santri', sapa: 'Ahlan wa sahlan', sub: 'Masuk untuk melihat perkembangan ananda.', muka: 'Raport, kehadiran, hafalan, dan syahriah ananda.', ikon: Users },
  guru: { label: 'Guru', sapa: 'Ruang guru', sub: 'Masuk dengan akun guru dari madrasah.', muka: 'Absen kehadiran, nilai harian, dan absensi santri.', ikon: GraduationCap },
  pengurus: { label: 'Pengurus', sapa: 'Ruang pengurus', sub: 'Khusus administrator madrasah.', muka: 'Santri, guru, raport, syahriah, dan pesan otomatis.', ikon: ShieldCheck },
};

let kartuDipilih: { pintu: Pintu; kartu: Pintu } | null = null;

/** Posisi kartu relatif terhadap kartu aktif; untuk tiga kartu atau lebih, susunannya melingkar. */
function posisiKartu(i: number, aktif: number, n: number) {
  if (n < 3) return i - aktif;
  const d = (((i - aktif) % n) + n) % n;
  return d > n / 2 ? d - n : d;
}

/**
 * Halaman masuk berupa tumpukan kartu yang bisa digeser dan berputar.
 * Aplikasi sungguhan: halaman wali (/) hanya punya kartu wali, sedangkan /guru dan /pengurus berbagi kartu guru dan pengurus,
 * sehingga wali tidak pernah melihat pintu staf. Mode demo menampilkan ketiganya agar klien bisa mencoba semua.
 */
export function Masuk({ pintu = 'wali' }: { pintu?: Pintu }) {
  const { lembaga } = useSesi();
  const daftar: Pintu[] = lembaga.demo ? ['wali', 'guru', 'pengurus'] : pintu === 'wali' ? ['wali'] : ['guru', 'pengurus'];
  // Simpan jenis kartunya (bukan urutan), karena daftar kartu bisa berubah saat data madrasah selesai dimuat.
  const [kartu, setKartu] = useState<Pintu>(() => (kartuDipilih?.pintu === pintu ? kartuDipilih.kartu : pintu));
  const aktif = daftar.includes(kartu) ? daftar.indexOf(kartu) : Math.max(0, daftar.indexOf(pintu));
  const jenis = daftar[aktif] ?? 'wali';
  useJudul(jenis === 'wali' ? 'Masuk' : jenis === 'guru' ? 'Masuk guru' : 'Masuk pengurus');

  const n = daftar.length;
  const pilih = (i: number) => {
    const j = ((i % n) + n) % n;
    kartuDipilih = { pintu, kartu: daftar[j] };
    setKartu(daftar[j]);
  };

  // Geser dengan jari atau tetikus
  const [seret, setSeret] = useState(0);
  const awal = useRef<{ x: number; y: number; id: number; arah: 'x' | 'y' | null } | null>(null);
  const lebarDek = useRef<HTMLDivElement>(null);
  const barusanDiseret = useRef(false);
  const mulai = (e: React.PointerEvent) => {
    if (n < 2 || e.button !== 0) return;
    // Jari boleh mulai menggeser dari mana saja di kartu (di ponsel kartu hampir penuh isian dan tombol).
    // Dengan tetikus, tarikan di dalam kolom isian dibiarkan untuk memilih teks.
    if (e.pointerType === 'mouse' && (e.target as HTMLElement).closest('input, textarea, select')) return;
    awal.current = { x: e.clientX, y: e.clientY, id: e.pointerId, arah: null };
    barusanDiseret.current = false;
  };
  const gerak = (e: React.PointerEvent) => {
    const a = awal.current;
    if (!a || a.id !== e.pointerId) return;
    const dx = e.clientX - a.x;
    const dy = e.clientY - a.y;
    if (!a.arah) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      a.arah = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (a.arah === 'x') {
        barusanDiseret.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    }
    if (a.arah === 'x') setSeret(dx);
  };
  const lepas = (e: React.PointerEvent) => {
    const a = awal.current;
    if (!a || a.id !== e.pointerId) return;
    awal.current = null;
    const ambang = Math.min(90, (lebarDek.current?.offsetWidth ?? 400) * 0.18);
    if (a.arah === 'x' && Math.abs(seret) > ambang) pilih(aktif + (seret < 0 ? 1 : -1));
    setSeret(0);
  };

  const tanda = `© ${new Date().getFullYear()} ${lembaga.naungan || lembaga.nama}${lembaga.kota ? ` · ${lembaga.kota}` : ''}`;

  return (
    <>
      <PitaDemo />
      {/* Poster Al Wafa’ menjadi latar penuh; kartu kaca melayang di atasnya. */}
      <div className="latar-poster" aria-hidden>
        <img className="latar-poster__gambar" src={poster} alt="" width={1024} height={1536} draggable={false} />
      </div>
      <main className="masuk">
        <h1 className="sr-only">
          {lembaga.nama}
          {lembaga.naungan ? ` · ${lembaga.naungan}` : ''}
          {lembaga.kota ? `, ${lembaga.kota}` : ''}
        </h1>

        <section className="dek-masuk" aria-label="Masuk">
          {n > 1 && (
            <div className="dek__nav">
              <button type="button" className="dek__panah" onClick={() => pilih(aktif - 1)} aria-label="Kartu sebelumnya">
                <ChevronLeft />
              </button>
              <div className="dek__pilihan" role="tablist" aria-label="Pilih jenis akun">
                {daftar.map((p, i) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={i === aktif}
                    className="dek__pil"
                    onClick={() => pilih(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                        e.preventDefault();
                        const j = ((aktif + (e.key === 'ArrowRight' ? 1 : -1)) % n + n) % n;
                        pilih(j);
                        (e.currentTarget.parentElement?.children[j] as HTMLElement | undefined)?.focus();
                      }
                    }}
                    tabIndex={i === aktif ? 0 : -1}
                  >
                    {TEKS[p].label}
                  </button>
                ))}
              </div>
              <button type="button" className="dek__panah" onClick={() => pilih(aktif + 1)} aria-label="Kartu berikutnya">
                <ChevronRight />
              </button>
            </div>
          )}
          {n > 1 && <p className="dek__petunjuk">Geser kartu ke kiri atau kanan untuk berganti</p>}
          <div
            ref={lebarDek}
            className={`dek${seret ? ' dek--diseret' : ''}${n > 1 ? ' dek--banyak' : ''}`}
            onPointerDown={mulai}
            onPointerMove={gerak}
            onPointerUp={lepas}
            onPointerCancel={lepas}
            onClickCapture={(e) => {
              // Setelah kartu diseret, jangan sampai lepasnya jari dianggap mengetuk tombol atau tautan.
              if (barusanDiseret.current) {
                e.preventDefault();
                e.stopPropagation();
                barusanDiseret.current = false;
              }
            }}
          >
            {daftar.map((p, i) => {
              const pos = posisiKartu(i, aktif, n);
              const depan = pos === 0;
              const jarak = Math.abs(pos);
              const geserRel = seret / ((lebarDek.current?.offsetWidth ?? 400) || 400);
              const sudut = pos * -32 + geserRel * 34;
              const gaya: React.CSSProperties = {
                transform: `perspective(1400px) translateX(calc(${pos} * var(--geser-dek) + ${seret * 0.9}px)) translateZ(${-jarak * 170}px) rotateY(${sudut}deg) scale(${depan ? 1 : 0.9})`,
                zIndex: 10 - jarak,
                opacity: jarak > 1 ? 0 : depan ? 1 : 0.7,
              };
              const I = TEKS[p].ikon;
              return (
                <div
                  key={p}
                  className={`kartu-pintu kartu-pintu--${p}${depan ? ' kartu-pintu--aktif' : ''}`}
                  style={gaya}
                  aria-hidden={!depan}
                  onClick={depan ? undefined : () => !barusanDiseret.current && pilih(i)}
                >
                  {depan ? (
                    <FormMasuk jenis={p} />
                  ) : (
                    <div className="kartu-pintu__muka">
                      <span className="kartu-pintu__lencana">
                        <I />
                      </span>
                      <span className="kartu-pintu__label">{TEKS[p].label}</span>
                      <b>{TEKS[p].sapa}</b>
                      <span className="redup kecil">{TEKS[p].muka}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </section>
        <p className="masuk__tanda masuk__tanda--bawah">{tanda}</p>
      </main>
    </>
  );
}

function FormMasuk({ jenis }: { jenis: Pintu }) {
  const { demo, muatUlang } = useSesi();
  const navigasi = useNavigate();
  const [id, setId] = useState('');
  const [sandi, setSandi] = useState('');
  const [lihat, setLihat] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const I = TEKS[jenis].ikon;

  const kirim = async () => {
    setSibuk(true);
    setGalat('');
    try {
      if (jenis === 'wali') await api('POST', '/api/auth/masuk-wali', { nis: id, sandi });
      else await api('POST', '/api/auth/masuk-pengurus', { username: id, sandi, pintu: jenis });
      ingatPintu(jenis);
      kartuDipilih = null;
      await muatUlang();
      navigasi(jenis === 'wali' ? '/wali' : '/admin', { replace: true });
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.message : 'Gagal masuk. Coba lagi.');
      setSibuk(false);
    }
  };

  return (
    <div className="kartu-pintu__isi" role="group" aria-labelledby="judul-masuk">
      <div className="kartu-pintu__kepala">
        <span className="kartu-pintu__lencana">
          <I />
        </span>
        <div className="tumpuk tumpuk--rapat" style={{ gap: 2 }}>
          <span className="kartu-pintu__label">{TEKS[jenis].label}</span>
          <h2 id="judul-masuk">{TEKS[jenis].sapa}</h2>
        </div>
      </div>
      <p className="redup kecil" style={{ marginTop: -8 }}>
        {TEKS[jenis].sub}
      </p>

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
    </div>
  );
}
