import { CalendarClock } from 'lucide-react';
import { usePakai } from '../../lib/pakai';
import { GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, useJudul } from '../../ui/dasar';
import { HARI } from '../../../shared/konstanta';
import { hariIni } from '../../../shared/format';

interface Data {
  kelas: string | null;
  waliKelas: string | null;
  jadwal: { hari: number; jamMulai: string; jamSelesai: string; mapel: string; mapelArab: string | null; kitab: string | null; pengajar: string | null }[];
  mapel: { nama: string; namaArab: string | null; kitab: string | null; pengajar: string | null }[];
}

export default function JadwalWali() {
  useJudul('Jadwal');
  const { data, galat, muatUlang } = usePakai<Data>('/api/wali/jadwal');
  const kini = new Date(`${hariIni()}T12:00:00Z`).getUTCDay() || 7;
  return (
    <>
      <KepalaHalaman kecil="الجدول الدراسي" judul="Jadwal pelajaran" sub={data?.kelas ? `${data.kelas} · wali kelas ${data.waliKelas ?? '–'}` : undefined} />
      {galat ? (
        <GalatMuat galat={galat} ulang={muatUlang} />
      ) : !data ? (
        <Memuat baris={4} />
      ) : !data.jadwal.length ? (
        <div className="kaca">
          <Kosong ikon={<CalendarClock />} judul="Jadwal belum diatur" pesan="Jadwal pelajaran kelas ananda belum diisi madrasah." />
        </div>
      ) : (
        <>
          <div className="grid-jadwal">
            {[6, 7, 1, 2, 3, 4, 5]
              .filter((h) => data.jadwal.some((j) => j.hari === h))
              .map((h) => (
                <section key={h} className={`kaca kaca--pad ${h === kini ? 'kaca--emas' : ''}`}>
                  <div className="kartu-judul">
                    <h2>{HARI[h]}</h2>
                    {h === kini && <Lencana jenis="emas">Hari ini</Lencana>}
                  </div>
                  <div className="tumpuk tumpuk--rapat">
                    {data.jadwal
                      .filter((j) => j.hari === h)
                      .map((j, i) => (
                        <div key={i} className="panel" style={{ padding: '10px 12px', display: 'grid', gap: 2 }}>
                          <div className="baris baris--antara">
                            <b>{j.mapel}</b>
                            {j.mapelArab && (
                              <span className="arab" style={{ fontSize: 17, color: 'var(--emas-300)' }}>
                                {j.mapelArab}
                              </span>
                            )}
                          </div>
                          <span className="redup-2 kecil angka">
                            {j.jamMulai}–{j.jamSelesai}
                            
                          </span>
                        </div>
                      ))}
                  </div>
                </section>
              ))}
          </div>
          <section className="kaca kaca--pad">
            <div className="kartu-judul">
              <h2>Pelajaran & kitab</h2>
            </div>
            <div className="tabel-bungkus">
              <table className="tabel">
                <tbody>
                  {data.mapel.map((m) => (
                    <tr key={m.nama}>
                      <td>
                        <b>{m.nama}</b>
                        {m.namaArab && (
                          <span className="arab redup" style={{ fontSize: 17, marginInlineStart: 10 }}>
                            {m.namaArab}
                          </span>
                        )}
                      </td>
                      <td className="redup">{m.kitab ?? '–'}</td>
                      
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
