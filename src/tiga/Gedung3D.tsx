import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AdeganGedung, DataDenah, DataRuang, Identitas } from './adegan';
import { Ikon } from '../ui/Ikon';
import { JENIS_RUANGAN, RUANG_SIARAN, type JenisRuangan } from '../../shared/konstanta';
import { jam } from '../../shared/format';
import { Denah2D } from './Denah2D';

export interface SesiRuang {
  id: number;
  ruanganId: number;
  judul: string;
  platform: string;
  host: string;
  jadwalMulai: string;
  jadwalSelesai: string;
  status: string;
  mulai: string | null;
}

interface Props {
  ruangan: DataRuang[];
  sesi: SesiRuang[];
  denah: DataDenah;
  identitas: Identitas;
  /** Isi tambahan pada panel ruangan terpilih, misalnya tautan ke sesi. */
  aksiRuang?: (r: DataRuang, s: { berlangsung?: SesiRuang; berikutnya?: SesiRuang }) => ReactNode;
  label?: string;
  className?: string;
}

const KUNCI_PEMBUKA = 'pcc.pembuka.v1';

function bolehWebgl() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function sudahPembuka() {
  try {
    return localStorage.getItem(KUNCI_PEMBUKA) === '1';
  } catch {
    return false;
  }
}
function tandaiPembuka() {
  try {
    localStorage.setItem(KUNCI_PEMBUKA, '1');
  } catch {
    /* penyimpanan tidak tersedia: momen pembuka bisa muncul lagi, tidak masalah */
  }
}

export function statusRuang(r: DataRuang, sesi: SesiRuang[]) {
  const milik = sesi.filter((s) => s.ruanganId === r.id && s.status !== 'batal');
  const berlangsung = milik.find((s) => s.status === 'berlangsung');
  const kini = new Date().toISOString();
  const berikutnya = milik.filter((s) => s.status === 'terjadwal' && s.jadwalSelesai > kini).sort((a, b) => a.jadwalMulai.localeCompare(b.jadwalMulai))[0];
  return { berlangsung, berikutnya };
}

export default function Gedung3D({ ruangan, sesi, denah, identitas, aksiRuang, label = 'Maket tiga dimensi gedung', className }: Props) {
  const kanvas = useRef<HTMLCanvasElement>(null);
  const adegan = useRef<AdeganGedung | null>(null);
  const [webgl] = useState(bolehWebgl);
  const [siap, setSiap] = useState(false);
  const [intro, setIntro] = useState(false);
  const [lantai, setLantai] = useState(1);
  const [dipilih, setDipilih] = useState<number | null>(null);
  const [diarah, setDiarah] = useState<number | null>(null);
  const [petunjuk, setPetunjuk] = useState(true);

  const daftarLantai = useMemo(() => [...new Set(ruangan.map((r) => r.lantai))].sort(), [ruangan]);
  const siaranIds = useMemo(() => sesi.filter((s) => s.status === 'berlangsung').map((s) => s.ruanganId), [sesi]);
  const kunciRuang = useMemo(() => JSON.stringify(ruangan) + JSON.stringify(denah) + JSON.stringify(identitas), [ruangan, denah, identitas]);

  // Buat adegan sekali.
  useEffect(() => {
    if (!webgl || !kanvas.current) return;
    let batal = false;
    const gerakDikurangi = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ringan = window.matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;
    void import('./adegan').then(({ AdeganGedung }) => {
      if (batal || !kanvas.current) return;
      adegan.current = new AdeganGedung(kanvas.current, {
        ringan,
        gerakDikurangi,
        saatPilih: (id) => setDipilih(id),
        saatArah: (id) => setDiarah(id),
        saatIntroSelesai: () => {
          setIntro(false);
          tandaiPembuka();
        },
      });
      setSiap(true);
    });
    return () => {
      batal = true;
      adegan.current?.hancurkan();
      adegan.current = null;
    };
  }, [webgl]);

  // Bangun ulang saat denah atau identitas berubah.
  const sudahDibangun = useRef(false);
  useEffect(() => {
    const a = adegan.current;
    if (!siap || !a) return;
    let batal = false;
    void a.bangun(ruangan, denah, identitas).then(() => {
      if (batal) return;
      a.aturSiaran(siaranIds);
      if (!sudahDibangun.current) {
        sudahDibangun.current = true;
        if (!sudahPembuka() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          setIntro(true);
          a.mulaiIntro(() => {});
        }
      }
    });
    return () => {
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siap, kunciRuang]);

  useEffect(() => {
    adegan.current?.aturSiaran(siaranIds);
  }, [siaranIds]);

  useEffect(() => {
    if (!intro) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') adegan.current?.lewatiIntro();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [intro]);

  const gantiLantai = (n: number) => {
    setLantai(n);
    setDipilih(null);
    adegan.current?.pilih(null, false);
    adegan.current?.aturLantai(n);
  };

  const pilihRuang = (id: number | null) => setDipilih(id);

  // Sinkronkan pilihan dari klik kanvas.
  useEffect(() => {
    if (dipilih === null) {
      adegan.current?.pilih(null, false);
      return;
    }
    const r = ruangan.find((x) => x.id === dipilih);
    if (r && r.lantai !== lantai) setLantai(r.lantai);
    adegan.current?.pilih(dipilih, true);
    setPetunjuk(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dipilih]);

  const ruangLantai = ruangan.filter((r) => r.lantai === lantai);
  const terpilih = ruangan.find((r) => r.id === dipilih) ?? null;
  const st = terpilih ? statusRuang(terpilih, sesi) : null;
  const sedangSiaran = sesi.filter((s) => s.status === 'berlangsung').length;
  const ringkasAlt = `${label}. Lantai ${lantai} berisi ${ruangLantai.map((r) => r.nama).join(', ')}. ${
    sedangSiaran ? `${sedangSiaran} studio sedang siaran.` : 'Tidak ada studio yang sedang siaran.'
  }`;

  if (!webgl) {
    return (
      <div className={['gedung3d', 'tanpa-webgl', className].filter(Boolean).join(' ')}>
        <Denah2D ruangan={ruangLantai} denah={denah} sesi={sesi} dipilih={dipilih} pilih={pilihRuang} />
        <PanelLantai daftar={daftarLantai} lantai={lantai} ganti={gantiLantai} />
        <DaftarRuang ruang={ruangLantai} sesi={sesi} dipilih={dipilih} diarah={diarah} pilih={pilihRuang} />
        {terpilih && st && <PanelRuang r={terpilih} st={st} tutup={() => pilihRuang(null)} aksi={aksiRuang?.(terpilih, st)} />}
      </div>
    );
  }

  return (
    <div className={['gedung3d', intro && 'sedang-intro', className].filter(Boolean).join(' ')}>
      <div className="g3-kanvas">
        <canvas ref={kanvas} role="img" aria-label={ringkasAlt} />
      </div>
      {!siap && (
        <div className="g3-memuat" role="status">
          Menyiapkan maket gedung…
        </div>
      )}
      <div className="g3-lapis" aria-hidden={intro || undefined}>
        <PanelLantai daftar={daftarLantai} lantai={lantai} ganti={gantiLantai} reset={() => adegan.current?.tampilanAwal()} />
        <DaftarRuang ruang={ruangLantai} sesi={sesi} dipilih={dipilih} diarah={diarah} pilih={pilihRuang} />
        {terpilih && st && <PanelRuang r={terpilih} st={st} tutup={() => pilihRuang(null)} aksi={aksiRuang?.(terpilih, st)} />}
        {petunjuk && !terpilih && <p className="g3-petunjuk">Seret untuk memutar, cubit atau gulir untuk mendekat. Pilih ruangan untuk melihat jadwalnya.</p>}
      </div>
      {intro && (
        <button type="button" className="g3-lewati" onClick={() => adegan.current?.lewatiIntro()}>
          Lewati
          <Ikon nama="lewati" />
        </button>
      )}
    </div>
  );
}

function PanelLantai({ daftar, lantai, ganti, reset }: { daftar: number[]; lantai: number; ganti: (n: number) => void; reset?: () => void }) {
  return (
    <div className="g3-lantai">
      <div className="segmen gelap" role="group" aria-label="Pilih lantai">
        {daftar.map((n) => (
          <button key={n} type="button" aria-pressed={n === lantai} onClick={() => ganti(n)}>
            Lantai {n}
          </button>
        ))}
      </div>
      {reset && (
        <button type="button" className="g3-ikon" onClick={reset} aria-label="Kembali ke tampilan awal" title="Tampilan awal">
          <Ikon nama="sasaran" />
        </button>
      )}
    </div>
  );
}

function DaftarRuang({
  ruang,
  sesi,
  dipilih,
  diarah,
  pilih,
}: {
  ruang: DataRuang[];
  sesi: SesiRuang[];
  dipilih: number | null;
  diarah: number | null;
  pilih: (id: number | null) => void;
}) {
  return (
    <nav className="g3-daftar" aria-label="Ruangan di lantai ini">
      <ul>
        {ruang.map((r) => {
          const { berlangsung, berikutnya } = statusRuang(r, sesi);
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={dipilih === r.id}
                data-arah={diarah === r.id || undefined}
                onClick={() => pilih(dipilih === r.id ? null : r.id)}
              >
                <span className="kode">{r.kode}</span>
                <span className="nama">{r.nama}</span>
                {berlangsung ? (
                  <span className="on-air">ON AIR</span>
                ) : berikutnya ? (
                  <span className="kapan">{jam(berikutnya.jadwalMulai)}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function PanelRuang({
  r,
  st,
  tutup,
  aksi,
}: {
  r: DataRuang;
  st: { berlangsung?: SesiRuang; berikutnya?: SesiRuang };
  tutup: () => void;
  aksi?: ReactNode;
}) {
  return (
    <section className="g3-info" aria-label={`Informasi ${r.nama}`}>
      <div className="g3-info-kepala">
        <div>
          <p className="kode">
            {r.kode} · {JENIS_RUANGAN[r.jenis as JenisRuangan] ?? r.jenis}
          </p>
          <h2>{r.nama}</h2>
        </div>
        <button type="button" className="g3-ikon" onClick={tutup} aria-label="Tutup informasi ruangan">
          <Ikon nama="tutup" />
        </button>
      </div>
      <dl className="g3-ukuran">
        <div>
          <dt>Ukuran</dt>
          <dd className="angka">
            {String(r.lebar).replace('.', ',')} × {String(r.panjang).replace('.', ',')} m
          </dd>
        </div>
        <div>
          <dt>Luas</dt>
          <dd className="angka">{String(Math.round(r.lebar * r.panjang * 10) / 10).replace('.', ',')} m²</dd>
        </div>
        {r.kapasitas ? (
          <div>
            <dt>Kapasitas</dt>
            <dd className="angka">{r.kapasitas} orang</dd>
          </div>
        ) : null}
      </dl>
      {RUANG_SIARAN.includes(r.jenis as JenisRuangan) && (
        <div className="g3-sesi">
          {st.berlangsung ? (
            <>
              <span className="on-air">ON AIR</span>
              <p className="judul">{st.berlangsung.judul}</p>
              <p className="redup kecil">
                {st.berlangsung.platform} · host {st.berlangsung.host} · sejak {jam(st.berlangsung.mulai ?? st.berlangsung.jadwalMulai)}
              </p>
            </>
          ) : st.berikutnya ? (
            <>
              <p className="redup kecil">Sesi berikutnya</p>
              <p className="judul">{st.berikutnya.judul}</p>
              <p className="redup kecil">
                {jam(st.berikutnya.jadwalMulai)}–{jam(st.berikutnya.jadwalSelesai)} · {st.berikutnya.platform}
              </p>
            </>
          ) : (
            <p className="redup kecil">Tidak ada sesi terjadwal lagi hari ini. Studio tersedia.</p>
          )}
        </div>
      )}
      {aksi}
    </section>
  );
}
