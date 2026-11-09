import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ketikaSesiHabis } from './api';
import type { Saya } from './tipe';

interface NilaiSesi extends Saya {
  muatUlang: () => Promise<Saya>;
  keluar: () => Promise<void>;
}

const Konteks = createContext<NilaiSesi | null>(null);

export function SesiProvider({ children, cadangan }: { children: ReactNode; cadangan: ReactNode }) {
  const [saya, setSaya] = useState<Saya | null>(null);
  const [galat, setGalat] = useState(false);

  const muatUlang = useCallback(async () => {
    const d = await api<Saya>('GET', '/api/auth/saya');
    setSaya(d);
    return d;
  }, []);

  useEffect(() => {
    muatUlang().catch(() => setGalat(true));
    ketikaSesiHabis(() => {
      muatUlang().catch(() => undefined);
    });
  }, [muatUlang]);

  const keluar = useCallback(async () => {
    await api('POST', '/api/auth/keluar').catch(() => undefined);
    await muatUlang();
  }, [muatUlang]);

  if (galat && !saya) {
    return (
      <div className="kosong" style={{ minHeight: '100dvh', alignContent: 'center' }}>
        <h3>Tidak bisa terhubung ke server</h3>
        <p>Periksa koneksi internet Anda, lalu muat ulang halaman ini.</p>
        <button className="tombol" onClick={() => location.reload()}>
          Muat ulang
        </button>
      </div>
    );
  }
  if (!saya) return <>{cadangan}</>;
  return <Konteks.Provider value={{ ...saya, muatUlang, keluar }}>{children}</Konteks.Provider>;
}

export function useSesi() {
  const s = useContext(Konteks);
  if (!s) throw new Error('useSesi di luar SesiProvider');
  return s;
}
