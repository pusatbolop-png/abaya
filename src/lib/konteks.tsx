import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ambil } from './api';
import type { Peran } from '../../shared/konstanta';
import { Ikon } from '../ui/Ikon';

// ——— Info lembaga (publik) ———
export interface InfoLembaga {
  organisasi: { nama: string; singkat: string; naungan: string; alamat: string; whatsapp: string; email: string; jamLayanan: string };
  instansi: { kunci: string; instansi: string; dokumen: string; wajib: boolean }[];
  logo: string | null;
  kategori: string[];
  kecamatan: string[];
  demo: boolean;
  perluSetup: boolean;
}

const KonteksInfo = createContext<{ info: InfoLembaga | null; muatUlang: () => Promise<void> }>({ info: null, muatUlang: async () => {} });

export function PenyediaInfo({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<InfoLembaga | null>(null);
  const muatUlang = useCallback(async () => {
    try {
      setInfo(await ambil<InfoLembaga>('/api/publik/info'));
    } catch {
      /* halaman tetap tampil dengan nama bawaan */
    }
  }, []);
  useEffect(() => {
    void muatUlang();
  }, [muatUlang]);
  return <KonteksInfo.Provider value={{ info, muatUlang }}>{children}</KonteksInfo.Provider>;
}
export const useInfo = () => useContext(KonteksInfo);

// ——— Sesi pengguna ———
export interface Pengguna {
  id: number;
  nama: string;
  email: string;
  peran: Peran;
}

interface NilaiSesi {
  pengguna: Pengguna | null;
  siap: boolean;
  setPengguna: (p: Pengguna | null) => void;
  keluar: () => Promise<void>;
}
const KonteksSesi = createContext<NilaiSesi>({ pengguna: null, siap: false, setPengguna: () => {}, keluar: async () => {} });

export function PenyediaSesi({ children }: { children: ReactNode }) {
  const [pengguna, setPengguna] = useState<Pengguna | null>(null);
  const [siap, setSiap] = useState(false);
  useEffect(() => {
    ambil<{ pengguna: Pengguna | null }>('/api/auth/saya')
      .then((r) => setPengguna(r.pengguna))
      .catch(() => setPengguna(null))
      .finally(() => setSiap(true));
  }, []);
  const keluar = useCallback(async () => {
    await api('POST', '/api/auth/keluar').catch(() => {});
    setPengguna(null);
  }, []);
  const nilai = useMemo(() => ({ pengguna, siap, setPengguna, keluar }), [pengguna, siap, keluar]);
  return <KonteksSesi.Provider value={nilai}>{children}</KonteksSesi.Provider>;
}
export const useSesi = () => useContext(KonteksSesi);

// ——— Toast konfirmasi ———
interface Toast {
  id: number;
  pesan: string;
  nada: 'ok' | 'galat';
}
const KonteksToast = createContext<(pesan: string, nada?: 'ok' | 'galat') => void>(() => {});

export function PenyediaToast({ children }: { children: ReactNode }) {
  const [daftar, setDaftar] = useState<Toast[]>([]);
  const nomor = useRef(0);
  const tampil = useCallback((pesan: string, nada: 'ok' | 'galat' = 'ok') => {
    const id = ++nomor.current;
    setDaftar((d) => [...d.slice(-2), { id, pesan, nada }]);
    window.setTimeout(() => setDaftar((d) => d.filter((t) => t.id !== id)), nada === 'galat' ? 7000 : 4200);
  }, []);
  return (
    <KonteksToast.Provider value={tampil}>
      {children}
      <div className="wadah-toast" role="status" aria-live="polite" aria-atomic="false">
        {daftar.map((t) => (
          <div key={t.id} className="toast" data-nada={t.nada}>
            <Ikon nama={t.nada === 'ok' ? 'centang' : 'peringatan'} />
            <span>{t.pesan}</span>
          </div>
        ))}
      </div>
    </KonteksToast.Provider>
  );
}
export const useToast = () => useContext(KonteksToast);
