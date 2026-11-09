import { useCallback, useEffect, useRef, useState } from 'react';
import { api, GalatApi } from './api';

/** Mengambil data GET; url null berarti belum siap diambil. */
export function usePakai<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [galat, setGalat] = useState<GalatApi | null>(null);
  const [memuat, setMemuat] = useState(!!url);
  const [versi, setVersi] = useState(0);
  const urlTerakhir = useRef<string | null>(null);

  useEffect(() => {
    if (!url) {
      setMemuat(false);
      return;
    }
    const ab = new AbortController();
    // Data lama tetap tampil saat memuat ulang url yang sama, agar layar tidak berkedip.
    if (urlTerakhir.current !== url) setData(null);
    urlTerakhir.current = url;
    setMemuat(true);
    setGalat(null);
    api<T>('GET', url, undefined, ab.signal)
      .then((d) => {
        setData(d);
        setMemuat(false);
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setGalat(e instanceof GalatApi ? e : new GalatApi(0, 'Terjadi kendala.'));
        setMemuat(false);
      });
    return () => ab.abort();
  }, [url, versi]);

  const muatUlang = useCallback(() => setVersi((v) => v + 1), []);
  return { data, galat, memuat, muatUlang, setData };
}

/** Status kirim untuk tombol simpan. */
export function useKirim() {
  const [sibuk, setSibuk] = useState(false);
  const [bidang, setBidang] = useState<Record<string, string>>({});
  const jalankan = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setSibuk(true);
    setBidang({});
    try {
      return await fn();
    } catch (e) {
      if (e instanceof GalatApi) setBidang(e.bidang);
      throw e;
    } finally {
      setSibuk(false);
    }
  }, []);
  return { sibuk, bidang, setBidang, jalankan };
}
