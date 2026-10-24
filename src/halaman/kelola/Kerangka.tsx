import { useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useInfo, useSesi } from '../../lib/konteks';
import { ketikaSesiHabis } from '../../lib/api';
import { useBerkala, useData } from '../../lib/data';
import { Merek } from '../../ui/Merek';
import { Ikon, type NamaIkon } from '../../ui/Ikon';
import { Memuat, Tombol } from '../../ui/dasar';
import { PERAN } from '../../../shared/konstanta';

interface Lencana {
  menunggu: number;
  siaran: number;
}

const NAV: ({ ke: string; label: string; ikon: NamaIkon; akhir?: boolean; lencana?: keyof Lencana; admin?: boolean } | 'garis')[] = [
  { ke: '/kelola', label: 'Ringkasan', ikon: 'ringkasan', akhir: true },
  { ke: '/kelola/gedung', label: 'Gedung', ikon: 'gedung' },
  'garis',
  { ke: '/kelola/umkm', label: 'UMKM dan seleksi', ikon: 'umkm', lencana: 'menunggu' },
  { ke: '/kelola/stok', label: 'Produk dan stok', ikon: 'stok' },
  { ke: '/kelola/live', label: 'Sesi live', ikon: 'siaran', lencana: 'siaran' },
  { ke: '/kelola/penjualan', label: 'Penjualan', ikon: 'penjualan' },
  { ke: '/kelola/retur', label: 'Retur', ikon: 'retur' },
  'garis',
  { ke: '/kelola/dana', label: 'Dana UMKM', ikon: 'dana' },
  { ke: '/kelola/laporan', label: 'Laporan dan ekspor', ikon: 'laporan' },
  { ke: '/kelola/pengaturan', label: 'Pengaturan', ikon: 'pengaturan' },
];

function Navigasi({ lencana, admin }: { lencana: Lencana | null; admin: boolean }) {
  return (
    <nav className="navigasi" aria-label="Menu ruang kerja">
      {NAV.map((n, i) =>
        n === 'garis' ? (
          <hr key={i} />
        ) : n.admin && !admin ? null : (
          <NavLink key={n.ke} to={n.ke} end={n.akhir} className="tautan-nav">
            <Ikon nama={n.ikon} />
            <span>{n.label}</span>
            {n.lencana === 'menunggu' && lencana?.menunggu ? (
              <span className="lencana" aria-label={`${lencana.menunggu} menunggu seleksi`}>
                {lencana.menunggu}
              </span>
            ) : null}
            {n.lencana === 'siaran' && lencana?.siaran ? (
              <span className="on-air" aria-label={`${lencana.siaran} sesi sedang siaran`}>
                ON AIR
              </span>
            ) : null}
          </NavLink>
        ),
      )}
    </nav>
  );
}

export function KerangkaKelola() {
  const { pengguna, siap, keluar, setPengguna } = useSesi();
  const { info } = useInfo();
  const lokasi = useLocation();
  const navigasi = useNavigate();
  const laci = useRef<HTMLDialogElement>(null);
  const [laciBuka, setLaciBuka] = useState(false);
  const ringkas = useData<{ menunggu: number; sesi: { status: string }[] }>(pengguna ? '/api/ringkasan' : null);
  useBerkala(() => void ringkas.muatUlang(), 45_000);

  useEffect(() => {
    ketikaSesiHabis(() => {
      setPengguna(null);
      navigasi(`/masuk?habis=1&ke=${encodeURIComponent(window.location.pathname)}`, { replace: true });
    });
    return () => ketikaSesiHabis(() => {});
  }, [navigasi, setPengguna]);

  // Tutup laci dan pindahkan fokus ke judul halaman setiap berpindah halaman (bukan saat pertama dimuat,
  // agar tautan "Lompat ke isi" tetap menjadi tujuan Tab pertama).
  const pertama = useRef(true);
  useEffect(() => {
    setLaciBuka(false);
    window.scrollTo(0, 0);
    if (pertama.current) pertama.current = false;
    else requestAnimationFrame(() => document.querySelector<HTMLElement>('#isi h1')?.focus({ preventScroll: true }));
    void ringkas.muatUlang();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lokasi.pathname]);

  useEffect(() => {
    const d = laci.current;
    if (!d) return;
    if (laciBuka && !d.open) d.showModal();
    if (!laciBuka && d.open) d.close();
  }, [laciBuka]);

  if (!siap) return <Memuat label="Memeriksa sesi" />;
  if (!pengguna) return <Navigate to={`/masuk?ke=${encodeURIComponent(lokasi.pathname)}`} replace />;

  const lencana = ringkas.data ? { menunggu: ringkas.data.menunggu, siaran: ringkas.data.sesi.filter((s) => s.status === 'berlangsung').length } : null;
  const admin = pengguna.peran === 'admin';

  const kaki = (
    <div className="rel-kaki">
      <p className="siapa">
        <strong>{pengguna.nama}</strong>
        <span className="redup">{PERAN[pengguna.peran]}</span>
      </p>
      <Tombol
        ragam="halus"
        kecil
        ikon="keluar"
        onClick={async () => {
          await keluar();
          navigasi('/masuk', { replace: true });
        }}
      >
        Keluar
      </Tombol>
    </div>
  );

  return (
    <>
      <a href="#isi" className="lompat-isi">
        Lompat ke isi
      </a>
      {info?.demo && <div className="pita-demo">Mode demo: data di ruang kerja ini adalah data contoh dan bukan data resmi.</div>}
      <div className="kelola">
        <aside className="rel">
          <Merek ke="/kelola" />
          <Navigasi lencana={lencana} admin={admin} />
          {kaki}
        </aside>
        <div className="kolom-utama">
          <header className="bilah-atas">
            <Merek ke="/kelola" />
            <Tombol ragam="kedua" kecil ikon="menu" onClick={() => setLaciBuka(true)} aria-expanded={laciBuka} aria-controls="laci-menu">
              Menu
            </Tombol>
          </header>
          <main id="isi" className="isi" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
      <dialog
        ref={laci}
        id="laci-menu"
        className="laci"
        aria-label="Menu"
        onCancel={(e) => {
          e.preventDefault();
          setLaciBuka(false);
        }}
        onClick={(e) => {
          if (e.target === laci.current) setLaciBuka(false);
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Merek ke="/kelola" />
          <Tombol ragam="halus" className="tombol-ikon" ikon="tutup" aria-label="Tutup menu" onClick={() => setLaciBuka(false)} />
        </div>
        <Navigasi lencana={lencana} admin={admin} />
        {kaki}
      </dialog>
    </>
  );
}
