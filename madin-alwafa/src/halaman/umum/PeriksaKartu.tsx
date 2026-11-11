import { Link, useParams } from 'react-router';
import { BadgeCheck, CircleAlert, CircleX } from 'lucide-react';
import { usePakai } from '../../lib/pakai';
import type { Lembaga } from '../../lib/tipe';
import { Memuat, useJudul } from '../../ui/dasar';
import { Lambang } from '../../ui/Lambang';
import { STATUS_SANTRI } from '../../../shared/konstanta';

interface Hasil {
  lembaga: Lembaga;
  hasil: 'sah' | 'tidak-aktif' | 'tidak-ditemukan';
  santri?: { nama: string; nis: string; jk: string; kelas: string | null; status: keyof typeof STATUS_SANTRI; kode: string };
}

/** Halaman yang terbuka saat QR di kartu santri dipindai. */
export default function PeriksaKartu() {
  useJudul('Periksa kartu santri');
  const { kode } = useParams();
  const { data } = usePakai<Hasil>(`/api/publik/kartu/${encodeURIComponent(kode ?? '')}`);
  const s = data?.santri;
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="kaca kaca--emas kaca--pad tumpuk" style={{ width: 'min(480px, 100%)', gap: 20 }}>
        <Link to="/" className="merek">
          <Lambang className="merek__lambang" />
          <span className="merek__teks">
            <span className="merek__nama">{data?.lembaga.singkatan ?? 'Madin Al Wafa’'}</span>
            <span className="merek__arab">{data?.lembaga.namaArab ?? 'مدرسة الوفاء الدينية'}</span>
          </span>
        </Link>
        <h1 className="judul-hias" style={{ fontSize: 30 }}>
          Kartu santri
        </h1>
        {!data ? (
          <Memuat baris={2} />
        ) : data.hasil === 'tidak-ditemukan' || !s ? (
          <div className="pesan pesan--bahaya">
            <CircleX />
            <div>
              <b>Kartu tidak dikenal</b>
              <div className="kecil">Kode kartu ini tidak terdaftar di {data.lembaga.nama}.</div>
            </div>
          </div>
        ) : (
          <div className={`pesan ${data.hasil === 'sah' ? 'pesan--ok' : 'pesan--waspada'}`} style={{ display: 'grid', gap: 12 }}>
            <div className="baris">
              {data.hasil === 'sah' ? <BadgeCheck style={{ width: 28, height: 28, color: 'var(--ok)' }} /> : <CircleAlert style={{ width: 28, height: 28 }} />}
              <div>
                <b style={{ fontSize: 16 }}>{data.hasil === 'sah' ? 'Kartu sah · santri aktif' : `Santri berstatus ${STATUS_SANTRI[s.status].toLowerCase()}`}</b>
                <div className="kecil redup">{data.lembaga.nama}</div>
              </div>
            </div>
            <dl className="daftar-data">
              <dt>Nama</dt>
              <dd>{s.nama}</dd>
              <dt>NIS</dt>
              <dd className="angka">{s.nis}</dd>
              <dt>Kelas</dt>
              <dd>{s.kelas ?? '–'}</dd>
              <dt>Kode kartu</dt>
              <dd className="angka">{`${s.kode.slice(0, 4)}-${s.kode.slice(4, 8)}-${s.kode.slice(8)}`}</dd>
            </dl>
            <p className="kecil redup">Cocokkan nama dan foto di kartu dengan pemegangnya.</p>
          </div>
        )}
      </div>
    </main>
  );
}
