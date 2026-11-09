/** Cincin persentase kehadiran. */
export function CincinHadir({ k, ukuran = 112 }: { k: { hadir: number; total: number }; ukuran?: number }) {
  const persen = k.total ? Math.round((k.hadir / k.total) * 100) : 0;
  const r = 44;
  const keliling = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" width={ukuran} height={ukuran} role="img" aria-label={`Kehadiran ${persen}%`} style={{ flex: 'none' }}>
      <defs>
        <linearGradient id="cincin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fe6c4" />
          <stop offset="1" stopColor="#d6b061" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="9" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="url(#cincin)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(keliling * persen) / 100} ${keliling}`}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill="#f2f6f3" fontSize="24" fontFamily="'Cormorant Garamond', serif" fontWeight="700">
        {persen}%
      </text>
      <text x="50" y="68" textAnchor="middle" fill="rgba(230,241,235,.55)" fontSize="8.5" fontFamily="'Plus Jakarta Sans Variable', sans-serif">
        hadir
      </text>
    </svg>
  );
}
