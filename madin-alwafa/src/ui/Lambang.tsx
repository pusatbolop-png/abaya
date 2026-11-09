import { useId } from 'react';

/** Lambang Al-Wafa: bintang delapan (rub el hizb) berbingkai emas dengan kaligrafi الوفاء. */
export function Lambang({ className, warna = 'emas' }: { className?: string; warna?: 'emas' | 'hijau' }) {
  const id = useId().replace(/:/g, '');
  const hijau = warna === 'hijau';
  return (
    <svg className={className} viewBox="0 0 120 120" role="img" aria-label="Lambang Madin Al-Wafa">
      <defs>
        <linearGradient id={`e${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={hijau ? '#0b4634' : '#fbe9b9'} />
          <stop offset=".45" stopColor={hijau ? '#a47d2c' : '#d6b061'} />
          <stop offset="1" stopColor={hijau ? '#0b4634' : '#f3dda4'} />
        </linearGradient>
        <radialGradient id={`h${id}`} cx=".5" cy=".38" r=".7">
          <stop offset="0" stopColor={hijau ? '#fffaf0' : '#19815f'} />
          <stop offset="1" stopColor={hijau ? '#f3ead2' : '#06281e'} />
        </radialGradient>
      </defs>
      <g transform="translate(60 60)">
        <rect x="-40" y="-40" width="80" height="80" rx="6" fill={`url(#h${id})`} stroke={`url(#e${id})`} strokeWidth="3" />
        <rect x="-40" y="-40" width="80" height="80" rx="6" fill={`url(#h${id})`} stroke={`url(#e${id})`} strokeWidth="3" transform="rotate(45)" />
        <rect x="-40" y="-40" width="80" height="80" rx="6" fill="none" stroke={`url(#e${id})`} strokeWidth="1" opacity=".55" />
        <circle r="31" fill="none" stroke={`url(#e${id})`} strokeWidth="1.4" />
        <circle r="27.5" fill="none" stroke={`url(#e${id})`} strokeWidth=".6" opacity=".7" />
        {Array.from({ length: 8 }, (_, i) => (
          <circle key={i} r="1.6" cx="0" cy="-49" fill={`url(#e${id})`} transform={`rotate(${i * 45 + 22.5})`} />
        ))}
        <text
          y="9"
          textAnchor="middle"
          fontFamily="Amiri, 'Traditional Arabic', serif"
          fontSize="27"
          fontWeight="700"
          fill={`url(#e${id})`}
          direction="rtl"
        >
          الوفاء
        </text>
      </g>
    </svg>
  );
}

/** Sudut hias untuk lembar raport. */
export function SudutHias({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" aria-hidden>
      <path d="M2 30V2h28" strokeWidth="1.6" />
      <path d="M8 22V8h14" strokeWidth=".8" />
      <path d="M2 2l12 12" strokeWidth=".8" />
      <path d="M14 8.5l2.2 3.3 3.8 1-2.5 3 .2 3.9-3.7-1.4-3.7 1.4.2-3.9-2.5-3 3.8-1z" fill="currentColor" stroke="none" opacity=".8" transform="translate(4 4) scale(.7)" />
    </svg>
  );
}
