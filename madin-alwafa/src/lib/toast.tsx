import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { pesanGalat } from './api';

type Jenis = 'ok' | 'galat';
interface Toast {
  id: number;
  pesan: string;
  jenis: Jenis;
}

const Konteks = createContext<{ tampil: (pesan: string, jenis?: Jenis) => void; galat: (e: unknown) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [daftar, setDaftar] = useState<Toast[]>([]);
  const tampil = useCallback((pesan: string, jenis: Jenis = 'ok') => {
    const id = Date.now() + Math.random();
    setDaftar((d) => [...d.slice(-2), { id, pesan, jenis }]);
    setTimeout(() => setDaftar((d) => d.filter((t) => t.id !== id)), jenis === 'galat' ? 6500 : 3800);
  }, []);
  const galat = useCallback((e: unknown) => tampil(pesanGalat(e), 'galat'), [tampil]);
  return (
    <Konteks.Provider value={{ tampil, galat }}>
      {children}
      <div className="toast-wadah" role="status" aria-live="polite">
        {daftar.map((t) => (
          <div key={t.id} className={`toast toast--${t.jenis}`}>
            {t.jenis === 'ok' ? <CircleCheck /> : <CircleAlert />}
            <span>{t.pesan}</span>
          </div>
        ))}
      </div>
    </Konteks.Provider>
  );
}

export function useToast() {
  const t = useContext(Konteks);
  if (!t) throw new Error('useToast di luar ToastProvider');
  return t;
}
