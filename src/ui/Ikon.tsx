// Ikon garis 24 px, goresan 1,5 px, digambar untuk aplikasi ini agar satu bahasa dengan huruf dan signage.
const JALUR = {
  centang: 'M5 12.5l4.2 4.2L19 7',
  peringatan: 'M12 8.5v5M12 16.6v.1M10.3 3.9L2.6 17.6A2 2 0 004.3 20.6h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  info: 'M12 11v6M12 7.5v.1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  tambah: 'M12 5v14M5 12h14',
  tutup: 'M6 6l12 12M18 6L6 18',
  'panah-kanan': 'M5 12h14M13 6l6 6-6 6',
  'panah-kiri': 'M19 12H5M11 6l-6 6 6 6',
  'chevron-bawah': 'M6 9l6 6 6-6',
  cari: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  menu: 'M4 7h16M4 12h16M4 17h10',
  ringkasan: 'M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z',
  gedung: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 9.5h.01M15 9.5h.01M9 12.5h.01M15 12.5h.01',
  umkm: 'M4 9.5L5.5 4h13L20 9.5M4 9.5a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0M4 9.5V20h16V9.5M9.5 20v-5h5v5',
  stok: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  siaran: 'M12 13.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM8.2 15.8a5.4 5.4 0 010-7.6M15.8 8.2a5.4 5.4 0 010 7.6M5.4 18.6a9.3 9.3 0 010-13.2M18.6 5.4a9.3 9.3 0 010 13.2',
  penjualan: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6',
  retur: 'M4 9h11a5 5 0 010 10H9M4 9l4-4M4 9l4 4',
  dana: 'M3 7.5A2.5 2.5 0 015.5 5H19v4M3 7.5V17a2 2 0 002 2h15V9H5.5A2.5 2.5 0 013 7.5zM16.5 14h.01',
  laporan: 'M14 3H6v18h12V7l-4-4zM14 3v4h4M9 13h6M9 17h4',
  pengaturan: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4.5v5M8 14.5v5',
  keluar: 'M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l-4-4 4-4M6 12h10',
  unduh: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  unggah: 'M12 15V4M7 9l5-5 5 5M5 20h14',
  berkas: 'M14 3H6v18h12V7l-4-4zM14 3v4h4',
  wa: 'M4 20l1.3-3.9A8 8 0 1112 20a8 8 0 01-3.9-1L4 20zM9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1a3.8 3.8 0 01-2-2l1-1-1-2L9 9.5z',
  jam: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  lantai: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  ubah: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  lewati: 'M5 5l9 7-9 7V5zM18 5v14',
  putar: 'M21 12a9 9 0 11-6.2-8.6',
  kalender: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
  mata: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  kunci: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 017 0V11',
  arah: 'M9 18l6-6-6-6',
  sasaran: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 16a4 4 0 100-8 4 4 0 000 8z',
  kinerja: 'M4 20h16M6 16l4-5 3 3 5-7M15 7h3v3',
  konten: 'M4 5h16v14H4zM10 9.5v5l4.5-2.5L10 9.5z',
  affiliate: 'M12 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM5.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM12 8v4M12 12l-4.5 3.2M12 12l4.5 3.2',
} as const;

export type NamaIkon = keyof typeof JALUR;

export function Ikon({ nama, className, label }: { nama: NamaIkon; className?: string; label?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={JALUR[nama]} />
    </svg>
  );
}
