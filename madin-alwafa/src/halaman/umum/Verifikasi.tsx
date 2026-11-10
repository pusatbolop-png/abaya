import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BadgeCheck, CircleX, ScanSearch, Undo2 } from 'lucide-react';
import { usePakai } from '../../lib/pakai';
import type { Lembaga } from '../../lib/tipe';
import { Memuat, Tombol, useJudul } from '../../ui/dasar';
import { Lambang } from '../../ui/Lambang';
import { namaSemester, waktu } from '../../../shared/format';

interface Hasil {
  lembaga: Lembaga;
  hasil: 'asli' | 'ditarik' | 'tidak-ditemukan';
  raport?: { kode: string; nama: string; nis: string; kelas: string; tahunAjaran: string; semester: number; rataRata: number | null; jumlahMapel: number; diterbitkan: string };
}

export default function Verifikasi() {
  useJudul('Verifikasi raport');
  const { kode } = useParams();
  const navigasi = useNavigate();
  const [isian, setIsian] = useState(kode ?? '');
  const { data, memuat } = usePakai<Hasil>(kode ? `/api/publik/verifikasi/${encodeURIComponent(kode)}` : null);

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="kaca kaca--emas kaca--pad tumpuk" style={{ width: 'min(520px, 100%)', gap: 20 }}>
        <Link to="/" className="merek">
          <Lambang className="merek__lambang" />
          <span className="merek__teks">
            <span className="merek__nama">{data?.lembaga.singkatan ?? 'Madin Al Wafa’'}</span>
            <span className="merek__arab">{data?.lembaga.namaArab ?? 'مدرسة الوفاء الدينية'}</span>
          </span>
        </Link>
        <div className="tumpuk tumpuk--rapat">
          <h1 className="judul-hias" style={{ fontSize: 32 }}>
            Verifikasi raport
          </h1>
          <p className="redup kecil">Masukkan kode di kaki raport, atau pindai kode QR-nya dengan kamera ponsel.</p>
        </div>
        <form
          className="baris"
          onSubmit={(e) => {
            e.preventDefault();
            if (isian.trim()) navigasi(`/verifikasi/${encodeURIComponent(isian.trim().toUpperCase())}`);
          }}
        >
          <input
            className="masukan angka"
            value={isian}
            onChange={(e) => setIsian(e.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            spellCheck={false}
            aria-label="Kode verifikasi"
            style={{ letterSpacing: '0.12em', fontWeight: 600 }}
          />
          <Tombol type="submit" varian="utama" ikon={<ScanSearch />}>
            Periksa
          </Tombol>
        </form>
        {kode && memuat && <Memuat baris={2} />}
        {data?.hasil === 'asli' && data.raport && (
          <div className="pesan pesan--ok" style={{ display: 'grid', gap: 12 }}>
            <div className="baris">
              <BadgeCheck style={{ width: 28, height: 28, color: 'var(--ok)' }} />
              <div>
                <b style={{ fontSize: 16 }}>Raport asli</b>
                <div className="kecil redup">Diterbitkan {waktu(data.raport.diterbitkan)} WIB</div>
              </div>
            </div>
            <dl className="daftar-data">
              <dt>Nama</dt>
              <dd>{data.raport.nama}</dd>
              <dt>NIS</dt>
              <dd className="angka">{data.raport.nis}</dd>
              <dt>Kelas</dt>
              <dd>{data.raport.kelas}</dd>
              <dt>Semester</dt>
              <dd>
                {namaSemester(data.raport.semester)} {data.raport.tahunAjaran}
              </dd>
              <dt>Rata-rata</dt>
              <dd className="angka">
                {data.raport.rataRata?.toLocaleString('id-ID')} dari {data.raport.jumlahMapel} mata pelajaran
              </dd>
              <dt>Kode</dt>
              <dd className="angka">{data.raport.kode}</dd>
            </dl>
            <p className="kecil redup">Bandingkan data di atas dengan raport yang Anda pegang. Rincian nilai hanya bisa dilihat wali santri.</p>
          </div>
        )}
        {data?.hasil === 'ditarik' && (
          <div className="pesan pesan--waspada">
            <Undo2 />
            <div>
              <b>Raport sedang diperbaiki</b>
              <div className="kecil">Raport dengan kode ini ditarik pengurus untuk diperbaiki. Mintalah raport versi terbaru kepada madrasah.</div>
            </div>
          </div>
        )}
        {data?.hasil === 'tidak-ditemukan' && (
          <div className="pesan pesan--bahaya">
            <CircleX />
            <div>
              <b>Kode tidak dikenal</b>
              <div className="kecil">Periksa kembali kode yang Anda ketik. Bila sudah benar, raport ini tidak diterbitkan oleh {data.lembaga.nama}.</div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
