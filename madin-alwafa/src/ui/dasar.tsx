import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, type LinkProps } from 'react-router';
import { CircleAlert, Info, LoaderCircle, RefreshCw, Sparkle, TriangleAlert, X, CircleCheck } from 'lucide-react';
import { inisial } from '../../shared/format';
import type { GalatApi } from '../lib/api';

type Varian = 'utama' | 'zamrud' | 'hantu' | 'bahaya';
type Ukuran = 'kecil' | 'besar';

function kelasTombol(varian?: Varian, ukuran?: Ukuran, penuh?: boolean, ikonSaja?: boolean, tambahan?: string) {
  return ['tombol', varian && `tombol--${varian}`, ukuran && `tombol--${ukuran}`, penuh && 'tombol--penuh', ikonSaja && 'tombol--ikon', tambahan]
    .filter(Boolean)
    .join(' ');
}

interface PropsTombol extends ButtonHTMLAttributes<HTMLButtonElement> {
  varian?: Varian;
  ukuran?: Ukuran;
  ikon?: ReactNode;
  sibuk?: boolean;
  penuh?: boolean;
}

export function Tombol({ varian, ukuran, ikon, sibuk, penuh, children, className, disabled, type = 'button', ...lain }: PropsTombol) {
  return (
    <button
      type={type}
      className={kelasTombol(varian, ukuran, penuh, !children, className)}
      disabled={disabled || sibuk}
      aria-busy={sibuk || undefined}
      {...lain}
    >
      {sibuk ? <LoaderCircle className="putar" /> : ikon}
      {children}
    </button>
  );
}

export function TautanTombol({ varian, ukuran, ikon, penuh, children, className, ...lain }: LinkProps & { varian?: Varian; ukuran?: Ukuran; ikon?: ReactNode; penuh?: boolean }) {
  return (
    <Link className={kelasTombol(varian, ukuran, penuh, !children, className)} {...lain}>
      {ikon}
      {children}
    </Link>
  );
}

export function Bidang({
  label,
  wajib,
  galat,
  bantu,
  children,
  className,
  grup,
}: {
  label: ReactNode;
  wajib?: boolean;
  galat?: string;
  bantu?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Isi berupa kumpulan tombol (bukan satu masukan): dibungkus role="group", bukan <label>. */
  grup?: boolean;
}) {
  const id = useId();
  const judul = (
    <span className="bidang__label" id={`${id}-l`}>
      {label}
      {wajib && (
        <span className="wajib" aria-hidden>
          *
        </span>
      )}
    </span>
  );
  const kaki = galat ? <span className="bidang__galat">{galat}</span> : bantu ? <span className="bidang__bantu">{bantu}</span> : null;
  if (grup)
    return (
      <div className={`bidang ${className ?? ''}`} role="group" aria-labelledby={`${id}-l`}>
        {judul}
        {children}
        {kaki}
      </div>
    );
  return (
    <label className={`bidang ${className ?? ''}`}>
      {judul}
      {children}
      {kaki}
    </label>
  );
}

export function Modal({
  judul,
  sub,
  tutup,
  children,
  kaki,
  lebar,
  laci,
  onSubmit,
}: {
  judul: ReactNode;
  sub?: ReactNode;
  tutup: () => void;
  children: ReactNode;
  kaki?: ReactNode;
  lebar?: boolean;
  laci?: boolean;
  onSubmit?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tutupRef = useRef(tutup);
  tutupRef.current = tutup;
  useEffect(() => {
    const sebelumnya = document.activeElement as HTMLElement | null;
    const lama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const fokus = ref.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), select, textarea');
    (fokus ?? ref.current)?.focus({ preventScroll: true });
    const kunci = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tutupRef.current();
    };
    document.addEventListener('keydown', kunci);
    return () => {
      document.body.style.overflow = lama;
      document.removeEventListener('keydown', kunci);
      sebelumnya?.focus?.({ preventScroll: true });
    };
  }, []);
  const isi = (
    <>
      <div className="modal__kepala">
        <div>
          <h2>{judul}</h2>
          {sub && <p>{sub}</p>}
        </div>
        <Tombol varian="hantu" ukuran="kecil" ikon={<X />} onClick={tutup} aria-label="Tutup" />
      </div>
      <div className="modal__isi">{children}</div>
      {kaki && <div className="modal__kaki">{kaki}</div>}
    </>
  );
  return createPortal(
    <div
      className={`tirai ${laci ? 'tirai--laci' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) tutup();
      }}
    >
      <div ref={ref} className={`modal ${lebar ? 'modal--lebar' : ''}`} role="dialog" aria-modal="true" tabIndex={-1}>
        {onSubmit ? (
          <form
            style={{ display: 'contents' }}
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {isi}
          </form>
        ) : (
          isi
        )}
      </div>
    </div>,
    document.body,
  );
}

// ——— Konfirmasi ———
interface Tanya {
  judul: string;
  pesan: ReactNode;
  ya?: string;
  bahaya?: boolean;
}
const KonteksKonfirmasi = createContext<(t: Tanya) => Promise<boolean>>(async () => false);

export function KonfirmasiProvider({ children }: { children: ReactNode }) {
  const [aktif, setAktif] = useState<(Tanya & { jawab: (v: boolean) => void }) | null>(null);
  const tanya = useCallback((t: Tanya) => new Promise<boolean>((jawab) => setAktif({ ...t, jawab })), []);
  const selesai = (v: boolean) => {
    aktif?.jawab(v);
    setAktif(null);
  };
  return (
    <KonteksKonfirmasi.Provider value={tanya}>
      {children}
      {aktif && (
        <Modal
          judul={aktif.judul}
          tutup={() => selesai(false)}
          kaki={
            <>
              <Tombol onClick={() => selesai(false)}>Batal</Tombol>
              <Tombol varian={aktif.bahaya ? 'bahaya' : 'utama'} onClick={() => selesai(true)} autoFocus>
                {aktif.ya ?? 'Lanjutkan'}
              </Tombol>
            </>
          }
        >
          <div className="redup" style={{ fontSize: 14.5 }}>
            {aktif.pesan}
          </div>
        </Modal>
      )}
    </KonteksKonfirmasi.Provider>
  );
}
export const useKonfirmasi = () => useContext(KonteksKonfirmasi);

// ——— Tampilan status ———
export function Kosong({ ikon, judul, pesan, aksi }: { ikon?: ReactNode; judul: string; pesan?: ReactNode; aksi?: ReactNode }) {
  return (
    <div className="kosong">
      <div className="kosong__ikon">{ikon ?? <Sparkle />}</div>
      <h3>{judul}</h3>
      {pesan && <p>{pesan}</p>}
      {aksi}
    </div>
  );
}

export function Memuat({ baris = 4, tinggi = 54 }: { baris?: number; tinggi?: number }) {
  return (
    <div className="tumpuk tumpuk--rapat" aria-busy="true" aria-label="Memuat">
      {Array.from({ length: baris }, (_, i) => (
        <div key={i} className="kerangka" style={{ height: tinggi, opacity: 1 - i * 0.14 }} />
      ))}
    </div>
  );
}

export function GalatMuat({ galat, ulang }: { galat: GalatApi | null; ulang?: () => void }) {
  return (
    <Kosong
      ikon={<CircleAlert />}
      judul="Data belum bisa dimuat"
      pesan={galat?.message}
      aksi={
        ulang && (
          <Tombol ikon={<RefreshCw />} onClick={ulang}>
            Coba lagi
          </Tombol>
        )
      }
    />
  );
}

export function Pesan({ jenis = 'info', children, judul }: { jenis?: 'info' | 'waspada' | 'bahaya' | 'ok'; children: ReactNode; judul?: string }) {
  const Ikon = { info: Info, waspada: TriangleAlert, bahaya: CircleAlert, ok: CircleCheck }[jenis];
  return (
    <div className={`pesan pesan--${jenis}`} role={jenis === 'bahaya' ? 'alert' : undefined}>
      <Ikon />
      <div className="tumpuk tumpuk--rapat" style={{ gap: 4 }}>
        {judul && <b>{judul}</b>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Avatar({ nama, jk, ukuran = 40, emas }: { nama: string; jk?: 'L' | 'P' | string; ukuran?: number; emas?: boolean }) {
  return (
    <span className={`avatar ${jk === 'P' ? 'avatar--P' : ''} ${emas ? 'avatar--emas' : ''}`} style={{ ['--ukuran' as string]: `${ukuran}px` }} aria-hidden>
      {inisial(nama)}
    </span>
  );
}

export function Lencana({ jenis, children, titik }: { jenis?: 'ok' | 'waspada' | 'bahaya' | 'info' | 'emas' | 'putra' | 'putri'; children: ReactNode; titik?: boolean }) {
  return (
    <span className={`lencana ${jenis ? `lencana--${jenis}` : ''}`}>
      {titik && <span className="titik" />}
      {children}
    </span>
  );
}

export function LencanaJk({ jk }: { jk: 'L' | 'P' | string }) {
  return <Lencana jenis={jk === 'P' ? 'putri' : 'putra'}>{jk === 'P' ? 'Santriwati' : 'Santri'}</Lencana>;
}

export function Stat({ ikon, label, nilai, sub, children, emas }: { ikon: ReactNode; label: string; nilai: ReactNode; sub?: ReactNode; children?: ReactNode; emas?: boolean }) {
  return (
    <div className={`kaca stat ${emas ? 'kaca--emas' : ''}`}>
      <div className="stat__label">
        <span className="stat__ikon">{ikon}</span>
        {label}
      </div>
      <div className="stat__nilai">{nilai}</div>
      {sub && <div className="stat__sub">{sub}</div>}
      {children}
    </div>
  );
}

export function Bilah({ persen, jenis }: { persen: number; jenis?: 'emas' | 'waspada' }) {
  const p = Math.max(0, Math.min(100, persen));
  return (
    <div className={`bilah ${jenis ? `bilah--${jenis}` : ''}`} role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${p}%` }} />
    </div>
  );
}

export function Sakelar({ nyala, ubah, label }: { nyala: boolean; ubah: (v: boolean) => void; label: string }) {
  return (
    <span className="sakelar">
      <input type="checkbox" role="switch" checked={nyala} onChange={(e) => ubah(e.target.checked)} aria-label={label} />
    </span>
  );
}

export function KepalaHalaman({ kecil, judul, sub, aksi }: { kecil?: ReactNode; judul: ReactNode; sub?: ReactNode; aksi?: ReactNode }) {
  return (
    <header className="kepala-halaman">
      <div className="kepala-halaman__teks">
        {kecil && <div className="kepala-halaman__kecil">{kecil}</div>}
        <h1>{judul}</h1>
        {sub && <p className="kepala-halaman__sub">{sub}</p>}
      </div>
      {aksi && <div className="kepala-halaman__aksi">{aksi}</div>}
    </header>
  );
}

export function Ornamen() {
  return (
    <div className="ornamen" aria-hidden>
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.4 4.6L19 5l-1.6 4.6L22 12l-4.6 2.4L19 19l-4.6-1.6L12 22l-2.4-4.6L5 19l1.6-4.6L2 12l4.6-2.4L5 5l4.6 1.6z" />
      </svg>
    </div>
  );
}

/** Judul tab peramban. */
export function useJudul(judul: string) {
  useEffect(() => {
    const lama = document.title;
    document.title = `${judul} · Madin Al Wafa’`;
    return () => {
      document.title = lama;
    };
  }, [judul]);
}

/** Nilai yang disimpan di localStorage (aman bila penyimpanan diblokir). */
export function useIngat<T>(kunci: string, awal: T): [T, (v: T) => void] {
  const [nilai, setNilai] = useState<T>(() => {
    try {
      const s = localStorage.getItem(`madin:${kunci}`);
      return s ? (JSON.parse(s) as T) : awal;
    } catch {
      return awal;
    }
  });
  const simpan = useCallback(
    (v: T) => {
      setNilai(v);
      try {
        localStorage.setItem(`madin:${kunci}`, JSON.stringify(v));
      } catch {
        /* penyimpanan diblokir */
      }
    },
    [kunci],
  );
  return [nilai, simpan];
}
