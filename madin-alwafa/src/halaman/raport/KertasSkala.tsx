import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Menampilkan kertas A4 (lebar tetap) yang diperkecil agar muat di layar, seperti penampil PDF. */
export function KertasSkala({ children, maks = 1 }: { children: ReactNode; maks?: number }) {
  const luar = useRef<HTMLDivElement>(null);
  const dalam = useRef<HTMLDivElement>(null);
  const [ukur, setUkur] = useState({ skala: 1, tinggi: 0 });

  useLayoutEffect(() => {
    const hitung = () => {
      if (!luar.current || !dalam.current) return;
      const lebarKertas = dalam.current.scrollWidth || 794;
      const skala = Math.min(maks, luar.current.clientWidth / lebarKertas);
      setUkur({ skala, tinggi: dalam.current.scrollHeight * skala });
    };
    hitung();
    const ro = new ResizeObserver(hitung);
    if (luar.current) ro.observe(luar.current);
    if (dalam.current) ro.observe(dalam.current);
    return () => ro.disconnect();
  }, [maks]);

  return (
    <div ref={luar} className="kertas-skala" style={{ height: ukur.tinggi || undefined }}>
      <div ref={dalam} className="kertas-skala__dalam" style={{ transform: `scale(${ukur.skala})`, left: `max(0px, calc((100% - ${794 * ukur.skala}px) / 2))` }}>
        {children}
      </div>
    </div>
  );
}
