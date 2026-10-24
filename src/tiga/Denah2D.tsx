import type { DataRuang } from './adegan';
import { statusRuang, type SesiRuang } from './Gedung3D';

/** Denah datar sebagai cadangan bila peramban tidak mendukung WebGL. */
export function Denah2D({ ruangan, sesi, dipilih, pilih }: { ruangan: DataRuang[]; sesi: SesiRuang[]; dipilih: number | null; pilih: (id: number | null) => void }) {
  return (
    <svg className="denah-2d" viewBox="-0.5 -0.5 25 17" role="img" aria-label="Denah datar lantai ini">
      <rect x="0" y="0" width="24" height="16" fill="#1f2622" stroke="#3a443e" strokeWidth="0.08" />
      {ruangan.map((r) => {
        const { berlangsung } = statusRuang(r, sesi);
        const aktif = dipilih === r.id;
        return (
          <g key={r.id} onClick={() => pilih(aktif ? null : r.id)} style={{ cursor: 'pointer' }}>
            <rect
              x={r.x + 0.08}
              y={r.z + 0.08}
              width={r.lebar - 0.16}
              height={r.panjang - 0.16}
              fill={aktif ? '#3b4a40' : '#2a332e'}
              stroke={berlangsung ? '#e3a27c' : '#56625a'}
              strokeWidth={berlangsung ? 0.12 : 0.05}
            />
            <text x={r.x + 0.5} y={r.z + 1.1} fill="#e3a27c" fontSize="0.55" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600">
              {r.kode}
            </text>
            <text x={r.x + 0.5} y={r.z + 1.9} fill="#f4f1ea" fontSize="0.62" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600">
              {r.nama}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
