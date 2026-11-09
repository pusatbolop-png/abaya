import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router';
import { SesiProvider, useSesi } from './lib/sesi';
import { ToastProvider } from './lib/toast';
import { KonfirmasiProvider, Memuat } from './ui/dasar';
import { Masuk } from './halaman/umum/Masuk';
import { TidakDitemukan } from './halaman/umum/TidakDitemukan';

const Pasang = lazy(() => import('./halaman/umum/Pasang'));
const Verifikasi = lazy(() => import('./halaman/umum/Verifikasi'));

const KerangkaAdmin = lazy(() => import('./halaman/admin/Kerangka'));
const Dasbor = lazy(() => import('./halaman/admin/Dasbor'));
const DaftarSantri = lazy(() => import('./halaman/admin/Santri'));
const DetailSantri = lazy(() => import('./halaman/admin/DetailSantri'));
const Kelas = lazy(() => import('./halaman/admin/Kelas'));
const Absensi = lazy(() => import('./halaman/admin/Absensi'));
const Nilai = lazy(() => import('./halaman/admin/Nilai'));
const RaportKelas = lazy(() => import('./halaman/admin/Raport'));
const RaportSantri = lazy(() => import('./halaman/admin/RaportSantri'));
const CetakRaport = lazy(() => import('./halaman/admin/CetakRaport'));
const Hafalan = lazy(() => import('./halaman/admin/Hafalan'));
const Syahriah = lazy(() => import('./halaman/admin/Syahriah'));
const Pengumuman = lazy(() => import('./halaman/admin/Pengumuman'));
const Pengaturan = lazy(() => import('./halaman/admin/Pengaturan'));
const AkunSaya = lazy(() => import('./halaman/admin/AkunSaya'));

const KerangkaWali = lazy(() => import('./halaman/wali/Kerangka'));
const BerandaWali = lazy(() => import('./halaman/wali/Beranda'));
const RaportWali = lazy(() => import('./halaman/wali/Raport'));
const LihatRaport = lazy(() => import('./halaman/wali/LihatRaport'));
const AbsensiWali = lazy(() => import('./halaman/wali/Absensi'));
const HafalanWali = lazy(() => import('./halaman/wali/Hafalan'));
const SyahriahWali = lazy(() => import('./halaman/wali/Syahriah'));
const JadwalWali = lazy(() => import('./halaman/wali/Jadwal'));
const PengumumanWali = lazy(() => import('./halaman/wali/Pengumuman'));
const AkunWali = lazy(() => import('./halaman/wali/Akun'));

const muat = (
  <div className="konten" style={{ maxWidth: 900 }}>
    <Memuat baris={5} tinggi={64} />
  </div>
);
const tunda = (el: ReactNode) => <Suspense fallback={muat}>{el}</Suspense>;

function Beranda() {
  const { pengurus, wali, perluPasang } = useSesi();
  if (perluPasang) return <Navigate to="/pasang" replace />;
  if (pengurus) return <Navigate to="/admin" replace />;
  if (wali) return <Navigate to="/wali" replace />;
  return <Masuk />;
}

function KhususPengurus() {
  const { pengurus } = useSesi();
  if (!pengurus) return <Navigate to="/" replace />;
  return tunda(<KerangkaAdmin />);
}
function KhususAdmin({ children }: { children: ReactNode }) {
  const { pengurus } = useSesi();
  if (pengurus?.peran !== 'admin') return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
function KhususWali() {
  const { wali } = useSesi();
  if (!wali) return <Navigate to="/" replace />;
  return tunda(<KerangkaWali />);
}

function Akar() {
  return (
    <ToastProvider>
      <KonfirmasiProvider>
        <SesiProvider cadangan={muat}>
          <Outlet />
        </SesiProvider>
      </KonfirmasiProvider>
    </ToastProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <Akar />,
    children: [
      { path: '/', element: <Beranda /> },
      { path: '/pasang', element: tunda(<Pasang />) },
      { path: '/verifikasi/:kode?', element: tunda(<Verifikasi />) },
      { path: '/admin/raport/:kelasId/:periodeId/cetak', element: tunda(<CetakRaport />) },
      {
        path: '/admin',
        element: <KhususPengurus />,
        children: [
          { index: true, element: tunda(<Dasbor />) },
          { path: 'santri', element: tunda(<DaftarSantri />) },
          { path: 'santri/:id', element: tunda(<DetailSantri />) },
          { path: 'kelas', element: tunda(<Kelas />) },
          { path: 'absensi', element: tunda(<Absensi />) },
          { path: 'nilai', element: tunda(<Nilai />) },
          { path: 'raport', element: tunda(<RaportKelas />) },
          { path: 'raport/:santriId/:periodeId', element: tunda(<RaportSantri />) },
          { path: 'hafalan', element: tunda(<Hafalan />) },
          { path: 'syahriah', element: <KhususAdmin>{tunda(<Syahriah />)}</KhususAdmin> },
          { path: 'pengumuman', element: tunda(<Pengumuman />) },
          { path: 'pengaturan', element: tunda(<Pengaturan />) },
          { path: 'akun', element: tunda(<AkunSaya />) },
        ],
      },
      {
        path: '/wali',
        element: <KhususWali />,
        children: [
          { index: true, element: tunda(<BerandaWali />) },
          { path: 'raport', element: tunda(<RaportWali />) },
          { path: 'raport/:periodeId', element: tunda(<LihatRaport />) },
          { path: 'absensi', element: tunda(<AbsensiWali />) },
          { path: 'hafalan', element: tunda(<HafalanWali />) },
          { path: 'syahriah', element: tunda(<SyahriahWali />) },
          { path: 'jadwal', element: tunda(<JadwalWali />) },
          { path: 'pengumuman', element: tunda(<PengumumanWali />) },
          { path: 'akun', element: tunda(<AkunWali />) },
        ],
      },
      { path: '*', element: <TidakDitemukan /> },
    ],
  },
]);

export function Aplikasi() {
  return <RouterProvider router={router} />;
}
