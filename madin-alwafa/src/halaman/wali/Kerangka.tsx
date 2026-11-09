import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { BookOpenCheck, CalendarCheck2, CalendarClock, ChevronDown, Grid2x2, Home, KeyRound, LogOut, Megaphone, ScrollText, Wallet } from 'lucide-react';
import { useSesi } from '../../lib/sesi';
import { Avatar, Modal } from '../../ui/dasar';
import { Lambang } from '../../ui/Lambang';
import { PitaDemo } from '../../ui/PitaDemo';

const NAV = [
  { ke: '/wali', label: 'Beranda', ikon: Home, ujung: true },
  { ke: '/wali/raport', label: 'Raport', ikon: ScrollText },
  { ke: '/wali/absensi', label: 'Kehadiran', ikon: CalendarCheck2 },
  { ke: '/wali/hafalan', label: 'Hafalan', ikon: BookOpenCheck },
  { ke: '/wali/syahriah', label: 'Syahriah', ikon: Wallet },
  { ke: '/wali/jadwal', label: 'Jadwal', ikon: CalendarClock },
  { ke: '/wali/pengumuman', label: 'Pengumuman', ikon: Megaphone },
];

export default function KerangkaWali() {
  const { wali, lembaga, keluar } = useSesi();
  const navigasi = useNavigate();
  const lokasi = useLocation();
  const [menu, setMenu] = useState(false);
  const [lainnya, setLainnya] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenu(false);
    setLainnya(false);
    window.scrollTo({ top: 0 });
  }, [lokasi.pathname]);
  useEffect(() => {
    if (!menu) return;
    const tutup = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', tutup);
    return () => document.removeEventListener('mousedown', tutup);
  }, [menu]);
  if (!wali) return null;

  const akhiri = async () => {
    await keluar();
    navigasi('/', { replace: true });
  };
  const diLainnya = ['/wali/syahriah', '/wali/jadwal', '/wali/pengumuman', '/wali/akun'].some((p) => lokasi.pathname.startsWith(p));

  return (
    <div className="kerangka-wali">
      <PitaDemo />
      <header className="atas-wali">
        <div className="atas-wali__dalam">
          <NavLink to="/wali" className="merek">
            <Lambang className="merek__lambang" />
            <span className="merek__teks">
              <span className="merek__nama">{lembaga.singkatan}</span>
              <span className="merek__arab">{lembaga.namaArab}</span>
            </span>
          </NavLink>
          <nav className="nav-wali" aria-label="Menu wali santri">
            {NAV.map((n) => (
              <NavLink key={n.ke} to={n.ke} end={n.ujung} title={n.label}>
                <n.ikon />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="akun-wali" ref={ref}>
            <button onClick={() => setMenu(!menu)} aria-expanded={menu} aria-haspopup="menu">
              <Avatar nama={wali.nama} jk={wali.jk} ukuran={34} />
              <span className="akun-wali__nama potong" style={{ maxWidth: 140, fontWeight: 600, fontSize: 14 }}>
                {wali.nama.split(' ')[0]}
              </span>
              <ChevronDown style={{ width: 16 }} className="redup-2" />
            </button>
            {menu && (
              <div className="menu" role="menu">
                <div style={{ padding: '8px 12px 10px' }}>
                  <div className="kecil redup-2">Wali dari</div>
                  <b>{wali.nama}</b>
                  <div className="kecil redup-2 angka">NIS {wali.nis}</div>
                </div>
                <hr />
                <button role="menuitem" onClick={() => navigasi('/wali/akun')}>
                  <KeyRound /> Akun & sandi
                </button>
                <button role="menuitem" onClick={akhiri}>
                  <LogOut /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="konten-wali">
        <Outlet />
      </main>
      <nav className="tab-bawah" aria-label="Menu utama">
        {NAV.slice(0, 4).map((n) => (
          <NavLink key={n.ke} to={n.ke} end={n.ujung}>
            <n.ikon />
            {n.label}
          </NavLink>
        ))}
        <a
          href="#lainnya"
          className={diLainnya ? 'active' : ''}
          onClick={(e) => {
            e.preventDefault();
            setLainnya(true);
          }}
        >
          <Grid2x2 />
          Lainnya
        </a>
      </nav>
      {lainnya && (
        <Modal judul="Menu lainnya" tutup={() => setLainnya(false)}>
          <div className="grid-menu">
            {[...NAV.slice(4), { ke: '/wali/akun', label: 'Akun & sandi', ikon: KeyRound }].map((n) => (
              <NavLink key={n.ke} to={n.ke} className="grid-menu__item">
                <span className="stat__ikon">
                  <n.ikon />
                </span>
                {n.label}
              </NavLink>
            ))}
            <button className="grid-menu__item" onClick={akhiri}>
              <span className="stat__ikon">
                <LogOut />
              </span>
              Keluar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
