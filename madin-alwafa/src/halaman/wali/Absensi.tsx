import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePakai } from '../../lib/pakai';
import { GalatMuat, KepalaHalaman, Lencana, Memuat, Tombol, useJudul } from '../../ui/dasar';
import { CincinHadir } from './CincinHadir';
import { STATUS_HADIR, type StatusHadir } from '../../../shared/konstanta';
import { bulanIni, hariIni, namaBulan, namaSemester, tanggalHari } from '../../../shared/format';

interface Data {
  bulan: string;
  daftar: { tanggal: string; status: StatusHadir; keterangan: string | null }[];
  semester: { tahunAjaran: string; semester: number; hadir: number; sakit: number; izin: number; alpa: number; total: number } | null;
}

const geser = (bulan: string, n: number) => {
  const [y, m] = bulan.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

export default function AbsensiWali() {
  useJudul('Kehadiran');
  const [bulan, setBulan] = useState(bulanIni());
  const { data, galat, muatUlang } = usePakai<Data>(`/api/wali/absensi?bulan=${bulan}`);
  const [y, m] = bulan.split('-').map(Number);
  const jumlahHari = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const awal = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Senin = 0
  const peta = new Map(data?.daftar.map((d) => [d.tanggal, d]) ?? []);
  const tidakHadir = data?.daftar.filter((d) => d.status !== 'H') ?? [];
  const hari = hariIni();

  return (
    <>
      <KepalaHalaman kecil="الحضور" judul="Kehadiran" sub="Kehadiran ananda di setiap pertemuan madrasah, dicatat oleh ustadz/ustadzah." />
      {galat ? (
        <GalatMuat galat={galat} ulang={muatUlang} />
      ) : (
        <div className="grid-wali">
          <section className="kaca kaca--pad">
            <div className="kartu-judul">
              <Tombol varian="hantu" ukuran="kecil" ikon={<ChevronLeft />} onClick={() => setBulan(geser(bulan, -1))} aria-label="Bulan sebelumnya" />
              <h2>{namaBulan(bulan)}</h2>
              <Tombol varian="hantu" ukuran="kecil" ikon={<ChevronRight />} onClick={() => setBulan(geser(bulan, 1))} disabled={bulan >= bulanIni()} aria-label="Bulan berikutnya" />
            </div>
            {!data ? (
              <Memuat baris={5} tinggi={40} />
            ) : (
              <>
                <div className="kalender">
                  {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Ahd'].map((h) => (
                    <span key={h} className="kalender__hari">
                      {h}
                    </span>
                  ))}
                  {Array.from({ length: awal }, (_, i) => (
                    <span key={`k${i}`} />
                  ))}
                  {Array.from({ length: jumlahHari }, (_, i) => {
                    const t = `${bulan}-${String(i + 1).padStart(2, '0')}`;
                    const a = peta.get(t);
                    return (
                      <span key={t} className={`kalender__tgl ${a ? `kalender__tgl--${a.status}` : ''} ${t === hari ? 'kalender__tgl--kini' : ''}`} title={a ? `${STATUS_HADIR[a.status]}${a.keterangan ? ` · ${a.keterangan}` : ''}` : undefined}>
                        {i + 1}
                      </span>
                    );
                  })}
                </div>
                <div className="baris baris--bungkus kecil" style={{ gap: 6, marginTop: 14 }}>
                  {(Object.keys(STATUS_HADIR) as StatusHadir[]).map((s) => (
                    <span key={s} className="baris" style={{ gap: 6 }}>
                      <span className={`kalender__contoh kalender__tgl--${s}`} /> {STATUS_HADIR[s]}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>
          <section className="kaca kaca--pad tumpuk">
            {data?.semester && (
              <>
                <div className="kartu-judul" style={{ marginBottom: 0 }}>
                  <h2>
                    Semester {namaSemester(data.semester.semester)} {data.semester.tahunAjaran}
                  </h2>
                </div>
                <div className="baris" style={{ gap: 18 }}>
                  <CincinHadir k={data.semester} />
                  <div className="grid-2 ringkas-hadir isi-penuh" style={{ gap: 8 }}>
                    <div>
                      <b className="angka">{data.semester.hadir}</b>
                      <span>Hadir</span>
                    </div>
                    <div>
                      <b className="angka">{data.semester.izin}</b>
                      <span>Izin</span>
                    </div>
                    <div>
                      <b className="angka">{data.semester.sakit}</b>
                      <span>Sakit</span>
                    </div>
                    <div>
                      <b className="angka">{data.semester.alpa}</b>
                      <span>Alpa</span>
                    </div>
                  </div>
                </div>
              </>
            )}
            <div className="kartu-judul" style={{ margin: '6px 0 0' }}>
              <h2>Tidak hadir bulan ini</h2>
            </div>
            {tidakHadir.length ? (
              <div className="tumpuk tumpuk--rapat">
                {tidakHadir.map((t) => (
                  <div key={t.tanggal} className="baris baris--antara panel" style={{ padding: '10px 14px' }}>
                    <span style={{ display: 'grid' }}>
                      <span>{tanggalHari(t.tanggal)}</span>
                      {t.keterangan && <span className="redup-2 kecil">{t.keterangan}</span>}
                    </span>
                    <Lencana jenis={t.status === 'A' ? 'bahaya' : t.status === 'S' ? 'waspada' : 'info'}>{STATUS_HADIR[t.status]}</Lencana>
                  </div>
                ))}
              </div>
            ) : (
              <p className="redup">{data?.daftar.length ? 'Alhamdulillah, ananda hadir di semua pertemuan bulan ini.' : 'Belum ada catatan kehadiran bulan ini.'}</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
