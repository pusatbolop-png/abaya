import type { DataDenah, DataRuang } from './adegan';
import { statusRuang, type SesiRuang } from './Gedung3D';

/** Denah datar sebagai cadangan bila peramban tidak mendukung WebGL. Orientasinya sama dengan sketsa: pintu masuk di atas. */
export function Denah2D({
  ruangan,
  denah,
  sesi,
  dipilih,
  pilih,
}: {
  ruangan: DataRuang[];
  denah: DataDenah;
  sesi: SesiRuang[];
  dipilih: number | null;
  pilih: (id: number | null) => void;
}) {
  const pm = denah.pintuMasuk;
  return (
    <svg className="denah-2d" viewBox={`-0.5 -1.2 ${denah.lebar + 1} ${denah.panjang + 1.7}`} role="img" aria-label="Denah datar lantai ini, pintu masuk di sisi atas">
      <rect x="0" y="0" width={denah.lebar} height={denah.panjang} fill="#1f2622" stroke="#3a443e" strokeWidth="0.08" />
      <rect x={pm.x} y="-0.12" width={pm.lebar} height="0.24" fill="#f28a3c" />
      <text x={pm.x + pm.lebar / 2} y="-0.45" fill="#c9c3b6" fontSize="0.5" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif">
        Pintu masuk
      </text>
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
              stroke={berlangsung ? '#f28a3c' : '#56625a'}
              strokeWidth={berlangsung ? 0.12 : 0.05}
            />
            <text x={r.x + 0.4} y={r.z + 0.9} fill="#f28a3c" fontSize="0.45" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600">
              {r.kode}
            </text>
            <text x={r.x + 0.4} y={r.z + 1.55} fill="#f4f1ea" fontSize="0.5" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600">
              {r.nama}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
