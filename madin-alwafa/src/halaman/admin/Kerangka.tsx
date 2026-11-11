import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  BookOpenCheck,
  CalendarCheck2,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  NotebookPen,
  School,
  ScrollText,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import { useSesi } from '../../lib/sesi';
import { Avatar, Tombol } from '../../ui/dasar';
import { Lambang } from '../../ui/Lambang';
import { PitaDemo } from '../../ui/PitaDemo';
import { PERAN_PENGURUS } from '../../../shared/konstanta';

const MENU = [
  { kelompok: null, isi: [{ ke: '/admin', label: 'Dasbor', ikon: LayoutDashboard, ujung: true }] },
  {
    kelompok: 'Santri',
    isi: [
      { ke: '/admin/santri', label: 'Data santri', ikon: Users },
      { ke: '/admin/kelas', label: 'Kelas & pelajaran', ikon: School },
    ],
  },
  {
    kelompok: 'Kegiatan belajar',
    isi: [
      { ke: '/admin/absensi', label: 'Absensi', ikon: CalendarCheck2 },
      { ke: '/admin/nilai', label: 'Nilai', ikon: NotebookPen },
      { ke: '/admin/raport', label: 'Raport', ikon: ScrollText },
      { ke: '/admin/hafalan', label: 'Hafalan', ikon: BookOpenCheck },
    ],
  },
  {
    kelompok: 'Madrasah',
    isi: [
      { ke: '/admin/syahriah', label: 'Syahriah', ikon: Wallet, admin: true },
      { ke: '/admin/pengumuman', label: 'Pengumuman', ikon: Megaphone },
      { ke: '/admin/pengaturan', label: 'Pengaturan', ikon: Settings },
    ],
  },
];

export default function KerangkaAdmin() {
  const { pengurus, lembaga, keluar } = useSesi();
  const [buka, setBuka] = useState(false);
  const lokasi = useLocation();
  const navigasi = useNavigate();
  useEffect(() => setBuka(false), [lokasi.pathname]);
  if (!pengurus) return null;

  const merek = (
    <NavLink to="/admin" className="merek">
      <Lambang className="merek__lambang" />
      <span className="merek__teks">
        <span className="merek__nama">{lembaga.singkatan}</span>
        <span className="merek__arab">{lembaga.namaArab}</span>
      </span>
    </NavLink>
  );

  return (
    <>
      <PitaDemo />
      <div className="kerangka-pengurus">
        {buka && <div className="sisi__tutupan" onClick={() => setBuka(false)} />}
        <aside className={`sisi ${buka ? 'sisi--buka' : ''}`} aria-label="Menu pengurus">
          <div className="sisi__merek">{merek}</div>
          <nav className="sisi__nav">
            {MENU.map((g, i) => (
              <div key={i} style={{ display: 'grid', gap: 2 }}>
                {g.kelompok && <div className="sisi__kelompok">{g.kelompok}</div>}
                {g.isi
                  .filter((m) => !('admin' in m && m.admin) || pengurus.peran === 'admin')
                  .map((m) => (
                    <NavLink key={m.ke} to={m.ke} end={'ujung' in m && m.ujung} className="sisi__tautan">
                      <m.ikon />
                      {m.label}
                    </NavLink>
                  ))}
              </div>
            ))}
          </nav>
          <div className="sisi__akun">
            <NavLink to="/admin/akun" className="sisi__akun-tautan" title="Akun saya">
              <Avatar nama={pengurus.nama} emas ukuran={38} />
              <span className="isi-penuh" style={{ display: 'grid', lineHeight: 1.25 }}>
                <span className="potong tebal" style={{ fontSize: 14 }}>
                  {pengurus.nama}
                </span>
                <span className="redup-2 kecil">{PERAN_PENGURUS[pengurus.peran]}</span>
              </span>
            </NavLink>
            <Tombol
              varian="hantu"
              ukuran="kecil"
              ikon={<LogOut />}
              aria-label="Keluar"
              title="Keluar"
              onClick={async () => {
                await keluar();
                navigasi('/', { replace: true });
              }}
            />
          </div>
        </aside>
        <div className="utama">
          <div className="bilah-atas">
            <Tombol varian="hantu" ikon={<Menu />} onClick={() => setBuka(true)} aria-label="Buka menu" />
            {merek}
          </div>
          <main className="konten">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
