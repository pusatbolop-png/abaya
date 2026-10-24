import { useCallback, useEffect, useRef, useState } from 'react';
import { ambil, GalatApi } from './api';

export interface Sumber<T> {
  data: T | null;
  galat: GalatApi | null;
  memuat: boolean;
  muatUlang: () => Promise<void>;
}

/** Ambil data dari API dan sediakan cara memuat ulang setelah ada perubahan. */
export function useData<T>(url: string | null): Sumber<T> {
  const [data, setData] = useState<T | null>(null);
  const [galat, setGalat] = useState<GalatApi | null>(null);
  const [memuat, setMemuat] = useState(!!url);
  const urlTerakhir = useRef(url);
  urlTerakhir.current = url;

  const muat = useCallback(async () => {
    if (!url) return;
    setMemuat(true);
    try {
      const d = await ambil<T>(url);
      if (urlTerakhir.current === url) {
        setData(d);
        setGalat(null);
      }
    } catch (e) {
      if (urlTerakhir.current === url) setGalat(e instanceof GalatApi ? e : new GalatApi(0, 'Terjadi kendala saat memuat data.'));
    } finally {
      if (urlTerakhir.current === url) setMemuat(false);
    }
  }, [url]);

  useEffect(() => {
    void muat();
  }, [muat]);

  return { data, galat, memuat, muatUlang: muat };
}

/** Muat ulang berkala, misalnya untuk status siaran. Berhenti saat tab tidak terlihat. */
export function useBerkala(fn: () => void, ms: number) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') ref.current();
    }, ms);
    return () => window.clearInterval(id);
  }, [ms]);
}
