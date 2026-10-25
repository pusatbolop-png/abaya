import { createBrowserRouter, createMemoryRouter, Navigate, type RouteObject } from 'react-router';
import { PRATINJAU } from './lib/pratinjau';
import { KerangkaPublik } from './halaman/publik/Kerangka';
import { Beranda } from './halaman/publik/Beranda';
import { Daftar, DaftarTerkirim } from './halaman/publik/Daftar';
import { CekStatus } from './halaman/publik/CekStatus';
import { Masuk, Siapkan } from './halaman/publik/Masuk';
import { KerangkaKelola } from './halaman/kelola/Kerangka';
import { Ringkasan } from './halaman/kelola/Ringkasan';
import { HalamanGedung } from './halaman/kelola/Gedung';
import { DaftarUmkm } from './halaman/kelola/DaftarUmkm';
import { DetailUmkm } from './halaman/kelola/DetailUmkm';
import { Stok } from './halaman/kelola/Stok';
import { Live, DetailLive } from './halaman/kelola/Live';
import { Penjualan, DetailPenjualan } from './halaman/kelola/Penjualan';
import { Retur } from './halaman/kelola/Retur';
import { Dana } from './halaman/kelola/Dana';
import { Laporan } from './halaman/kelola/Laporan';
import { Pengaturan } from './halaman/kelola/Pengaturan';
import { TidakDitemukan } from './halaman/TidakDitemukan';

const rute: RouteObject[] = [
  {
    element: <KerangkaPublik />,
    children: [
      { index: true, element: <Beranda /> },
      { path: 'daftar', element: <Daftar /> },
      { path: 'daftar/terkirim/:kode', element: <DaftarTerkirim /> },
      { path: 'status', element: <CekStatus /> },
      { path: 'masuk', element: <Masuk /> },
      { path: 'siapkan', element: <Siapkan /> },
    ],
  },
  {
    path: 'kelola',
    element: <KerangkaKelola />,
    children: [
      { index: true, element: <Ringkasan /> },
      { path: 'gedung', element: <HalamanGedung /> },
      { path: 'umkm', element: <DaftarUmkm /> },
      { path: 'umkm/:id', element: <DetailUmkm /> },
      { path: 'stok', element: <Stok /> },
      { path: 'live', element: <Live /> },
      { path: 'live/:id', element: <DetailLive /> },
      { path: 'penjualan', element: <Penjualan /> },
      { path: 'penjualan/:id', element: <DetailPenjualan /> },
      { path: 'retur', element: <Retur /> },
      { path: 'dana', element: <Dana /> },
      { path: 'laporan', element: <Laporan /> },
      { path: 'pengaturan', element: <Pengaturan /> },
      { path: '*', element: <TidakDitemukan /> },
    ],
  },
  { path: 'beranda', element: <Navigate to="/" replace /> },
  { path: '*', element: <TidakDitemukan publik /> },
];

// Pratinjau berjalan di dalam bingkai tanpa alamat sendiri, jadi riwayat halaman disimpan di memori.
export const router = PRATINJAU ? createMemoryRouter(rute) : createBrowserRouter(rute);
