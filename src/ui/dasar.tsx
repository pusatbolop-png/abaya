import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router';
import { Ikon, type NamaIkon } from './Ikon';
import { GalatApi } from '../lib/api';
import { rupiah } from '../../shared/format';

// ——— Tombol ———
type Ragam = 'utama' | 'kedua' | 'halus' | 'siaran' | 'bahaya';
interface PropsTombol extends ButtonHTMLAttributes<HTMLButtonElement> {
  ragam?: Ragam;
  kecil?: boolean;
  ikon?: NamaIkon;
  sibuk?: boolean;
}
export const Tombol = forwardRef<HTMLButtonElement, PropsTombol>(function Tombol(
  { ragam = 'kedua', kecil, ikon, sibuk, className, children, disabled, type = 'button', ...lain },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={['tombol', `tombol-${ragam}`, kecil && 'tombol-kecil', className].filter(Boolean).join(' ')}
      disabled={disabled || sibuk}
      aria-busy={sibuk || undefined}
      {...lain}
    >
      {sibuk ? <Ikon nama="putar" className="putar" /> : ikon ? <Ikon nama={ikon} /> : null}
      {children}
    </button>
  );
});

export function TautanTombol({ ke, ragam = 'kedua', kecil, ikon, children, ...lain }: { ke: string; ragam?: Ragam; kecil?: boolean; ikon?: NamaIkon; children: ReactNode; target?: string; rel?: string; 'aria-label'?: string }) {
  const kelas = ['tombol', `tombol-${ragam}`, kecil && 'tombol-kecil'].filter(Boolean).join(' ');
  if (/^(https?:|mailto:|\/api\/)/.test(ke)) {
    return (
      <a href={ke} className={kelas} {...lain}>
        {ikon && <Ikon nama={ikon} />}
        {children}
      </a>
    );
  }
  return (
    <Link to={ke} className={kelas} {...lain}>
      {ikon && <Ikon nama={ikon} />}
      {children}
    </Link>
  );
}

// ——— Isian ———
interface PropsBidang {
  label: ReactNode;
  petunjuk?: ReactNode;
  galat?: string;
  opsional?: boolean;
  className?: string;
  children: (p: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode;
}
export function Bidang({ label, petunjuk, galat, opsional, className, children }: PropsBidang) {
  const id = useId();
  const idPetunjuk = petunjuk ? `${id}-p` : undefined;
  const idGalat = galat ? `${id}-g` : undefined;
  const terangkan = [idPetunjuk, idGalat].filter(Boolean).join(' ') || undefined;
  return (
    <div className={['bidang', className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className="label">
        {label}
        {opsional && <span className="opsional"> (boleh dikosongkan)</span>}
      </label>
      {children({ id, 'aria-invalid': galat ? true : undefined, 'aria-describedby': terangkan })}
      {petunjuk && (
        <p className="petunjuk" id={idPetunjuk}>
          {petunjuk}
        </p>
      )}
      {galat && (
        <p className="pesan-galat" id={idGalat}>
          <Ikon nama="peringatan" />
          <span>{galat}</span>
        </p>
      )}
    </div>
  );
}

export const Masukan = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Masukan({ className, ...p }, ref) {
  return <input ref={ref} className={['masukan', className].filter(Boolean).join(' ')} {...p} />;
});
export const Pilihan = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Pilihan({ className, ...p }, ref) {
  return <select ref={ref} className={['pilihan', className].filter(Boolean).join(' ')} {...p} />;
});
export const Area = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Area({ className, ...p }, ref) {
  return <textarea ref={ref} className={['area', className].filter(Boolean).join(' ')} {...p} />;
});

/** Masukan nominal rupiah: menampilkan pemisah ribuan sambil menyimpan angka bulat. */
export function MasukanRupiah({ nilai, ubah, ...p }: { nilai: number | ''; ubah: (n: number | '') => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const tampil = nilai === '' ? '' : new Intl.NumberFormat('id-ID').format(nilai);
  return (
    <div className="dengan-awalan">
      <span aria-hidden="true">Rp</span>
      <input
        className="masukan angka"
        inputMode="numeric"
        autoComplete="off"
        value={tampil}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, '');
          ubah(d === '' ? '' : Math.min(Number(d), 999_999_999_999));
        }}
        {...p}
      />
    </div>
  );
}

/** Pemilih berkas berbahasa Indonesia; tombol bawaan peramban mengikuti bahasa sistem. */
export function PilihBerkas({
  berkas,
  ubah,
  accept,
  id,
  name,
  ...aria
}: {
  berkas: File | null;
  ubah: (f: File | null) => void;
  accept: string;
  id?: string;
  name?: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="unggah">
      <input ref={ref} id={id} name={name} type="file" className="sr-only" accept={accept} onChange={(e) => ubah(e.target.files?.[0] ?? null)} {...aria} />
      <Tombol kecil ikon="unggah" onClick={() => ref.current?.click()} aria-hidden="true" tabIndex={-1}>
        {berkas ? 'Ganti berkas' : 'Pilih berkas'}
      </Tombol>
      <span className={berkas ? 'nama-berkas' : 'nama-berkas redup'}>{berkas ? berkas.name : 'Belum ada berkas dipilih'}</span>
      {berkas && (
        <Tombol
          kecil
          ragam="halus"
          onClick={() => {
            if (ref.current) ref.current.value = '';
            ubah(null);
          }}
        >
          Hapus
        </Tombol>
      )}
    </div>
  );
}

// ——— Kirim formulir dengan galat per kolom ———
export function useKirim() {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [bidang, setBidang] = useState<Record<string, string>>({});
  const kirim = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setSibuk(true);
    setGalat(null);
    setBidang({});
    try {
      return await fn();
    } catch (e) {
      if (e instanceof GalatApi) {
        setGalat(e.message);
        setBidang(e.bidang);
      } else {
        setGalat('Terjadi kendala yang tidak terduga. Muat ulang halaman lalu coba lagi.');
      }
      return undefined;
    } finally {
      setSibuk(false);
    }
  }, []);
  const atur = useCallback((pesan: string | null, b: Record<string, string> = {}) => {
    setGalat(pesan);
    setBidang(b);
  }, []);
  return { sibuk, galat, bidang, kirim, atur };
}

/** Pertahankan isi tetap terpasang sebentar setelah ditutup agar animasi keluar tidak kosong. */
function useTertunda(buka: boolean, ms = 280) {
  const [tampil, setTampil] = useState(buka);
  useEffect(() => {
    if (buka) {
      setTampil(true);
      return;
    }
    const t = window.setTimeout(() => setTampil(false), ms);
    return () => window.clearTimeout(t);
  }, [buka, ms]);
  return buka || tampil;
}

// ——— Lembar samping ———
interface PropsLembar {
  buka: boolean;
  tutup: () => void;
  judul: string;
  keterangan?: ReactNode;
  children: ReactNode;
  kaki?: ReactNode;
  onSubmit?: () => void;
  lebar?: number;
}
export function Lembar({ buka, tutup, judul, keterangan, children, kaki, onSubmit, lebar }: PropsLembar) {
  const ref = useRef<HTMLDialogElement>(null);
  const idJudul = useId();
  const tampil = useTertunda(buka);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (buka && !d.open) d.showModal();
    if (!buka && d.open) d.close();
  }, [buka]);
  const isi = (
    <>
      <div className="lembar-kepala">
        <div>
          <h2 id={idJudul}>{judul}</h2>
          {keterangan && <p>{keterangan}</p>}
        </div>
        <Tombol ragam="halus" className="tombol-ikon" ikon="tutup" aria-label="Tutup" onClick={tutup} />
      </div>
      <div className="lembar-isi">{children}</div>
      {kaki && <div className="lembar-kaki">{kaki}</div>}
    </>
  );
  return (
    <dialog
      ref={ref}
      className="lembar"
      aria-labelledby={idJudul}
      style={lebar ? { width: `min(${lebar}px, 100%)` } : undefined}
      onCancel={(e) => {
        e.preventDefault();
        tutup();
      }}
      onClick={(e) => {
        if (e.target === ref.current) tutup();
      }}
    >
      {tampil &&
        (onSubmit ? (
          <form
            noValidate
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
        ))}
    </dialog>
  );
}

// ——— Konfirmasi ———
interface PropsKonfirmasi {
  buka: boolean;
  judul: string;
  children?: ReactNode;
  label: string;
  ragam?: Ragam;
  sibuk?: boolean;
  ya: () => void;
  batal: () => void;
}
export function Konfirmasi({ buka, judul, children, label, ragam = 'utama', sibuk, ya, batal }: PropsKonfirmasi) {
  const ref = useRef<HTMLDialogElement>(null);
  const idJudul = useId();
  const tampil = useTertunda(buka, 160);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (buka && !d.open) d.showModal();
    if (!buka && d.open) d.close();
  }, [buka]);
  return (
    <dialog
      ref={ref}
      className="konfirmasi"
      aria-labelledby={idJudul}
      onCancel={(e) => {
        e.preventDefault();
        batal();
      }}
    >
      {tampil && (
        <>
          <div className="isi-konfirmasi">
            <h2 id={idJudul}>{judul}</h2>
            {children}
          </div>
          <div className="lembar-kaki">
            <Tombol onClick={batal}>Kembali</Tombol>
            <Tombol ragam={ragam} sibuk={sibuk} onClick={ya} autoFocus>
              {label}
            </Tombol>
          </div>
        </>
      )}
    </dialog>
  );
}

// ——— Keadaan ———
export function Pemberitahuan({ nada = 'info', children }: { nada?: 'info' | 'galat' | 'tunggu' | 'ok'; children: ReactNode }) {
  const ikon: NamaIkon = nada === 'ok' ? 'centang' : nada === 'info' ? 'info' : 'peringatan';
  return (
    <div className="pemberitahuan" data-nada={nada} role={nada === 'galat' ? 'alert' : undefined}>
      <Ikon nama={ikon} />
      <div>{children}</div>
    </div>
  );
}

export function Kosong({ judul, children, aksi, tengah }: { judul: string; children?: ReactNode; aksi?: ReactNode; tengah?: boolean }) {
  return (
    <div className={['kosong', tengah && 'tengah'].filter(Boolean).join(' ')}>
      <p className="judul-kosong">{judul}</p>
      {children && <p>{children}</p>}
      {aksi}
    </div>
  );
}

export function Memuat({ label = 'Memuat data' }: { label?: string }) {
  return (
    <div className="memuat" role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </div>
  );
}

export function GalatMuat({ galat, ulang }: { galat: GalatApi; ulang: () => void }) {
  return (
    <Pemberitahuan nada="galat">
      <p>{galat.message}</p>
      <p style={{ marginTop: 8 }}>
        <Tombol kecil onClick={ulang} ikon="putar">
          Muat ulang
        </Tombol>
      </p>
    </Pemberitahuan>
  );
}

export function Status({ nada = 'netral', children }: { nada?: 'netral' | 'tunggu' | 'ok' | 'galat' | 'siaran' | 'mati'; children: ReactNode }) {
  return (
    <span className="status" data-nada={nada}>
      {children}
    </span>
  );
}

export function Uang({ n, className }: { n: number; className?: string }) {
  return <span className={['angka', className].filter(Boolean).join(' ')}>{rupiah(n)}</span>;
}

export function KepalaHalaman({ judul, keterangan, aksi, remah }: { judul: string; keterangan?: ReactNode; aksi?: ReactNode; remah?: { ke: string; label: string } }) {
  useJudul(judul);
  return (
    <header className="kepala-halaman">
      <div className="teks">
        {remah && (
          <nav className="remah" aria-label="Lokasi">
            <Link to={remah.ke}>{remah.label}</Link>
            <span aria-hidden="true">/</span>
          </nav>
        )}
        <h1 tabIndex={-1}>{judul}</h1>
        {keterangan && <p>{keterangan}</p>}
      </div>
      {aksi && <div className="deret-tombol">{aksi}</div>}
    </header>
  );
}

export function useJudul(judul: string) {
  useEffect(() => {
    document.title = `${judul} · PCC`;
  }, [judul]);
}

/** Baris tabel yang bisa diklik; tautan di sel pertama tetap jadi jalur utama untuk papan ketik. */
export function onKlikBaris(navigasi: (ke: string) => void, ke: string) {
  return {
    'data-tautan': '',
    onClick: (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('a,button,input,select,label')) return;
      if (window.getSelection()?.toString()) return;
      navigasi(ke);
    },
  };
}
