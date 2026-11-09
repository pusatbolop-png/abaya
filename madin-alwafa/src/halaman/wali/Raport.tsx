import { Link } from 'react-router';
import { ChevronRight, Hourglass, ScrollText } from 'lucide-react';
import { usePakai } from '../../lib/pakai';
import { GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, Pesan, useJudul } from '../../ui/dasar';
import { predikat } from '../../../shared/konstanta';
import { namaSemester, tanggalPendek } from '../../../shared/format';

interface Item {
  periodeId: number;
  tahunAjaran: string;
  semester: number;
  kelas: string | null;
  rataRata: number | null;
  peringkat: number | null;
  jumlahSantri: number;
  diterbitkan: string;
  baru: boolean;
}

export default function RaportWali() {
  useJudul('Raport');
  const { data, galat, muatUlang } = usePakai<{ daftar: Item[]; menunggu: boolean }>('/api/wali/raport');
  return (
    <>
      <KepalaHalaman kecil="كشف نتائج الدراسة" judul="Raport" sub="Raport yang sudah diterbitkan madrasah. Buka untuk melihat rincian nilai, mengunduh PDF, atau mencetaknya." />
      {galat ? (
        <GalatMuat galat={galat} ulang={muatUlang} />
      ) : !data ? (
        <Memuat baris={3} tinggi={96} />
      ) : (
        <>
          {data.menunggu && (
            <Pesan jenis="info">
              <span className="baris" style={{ gap: 8 }}>
                <Hourglass style={{ width: 16 }} /> Raport semester berjalan sedang disiapkan dan akan muncul di sini setelah diterbitkan.
              </span>
            </Pesan>
          )}
          {data.daftar.length ? (
            <div className="tumpuk">
              {data.daftar.map((r) => {
                const p = r.rataRata !== null ? predikat(r.rataRata) : null;
                return (
                  <Link key={r.periodeId} to={`/wali/raport/${r.periodeId}`} className="kaca kaca--pad kartu-raport-daftar">
                    <div className="kartu-raport-daftar__nilai">
                      <span className="angka-besar" style={{ fontSize: 40 }}>
                        {r.rataRata?.toLocaleString('id-ID', { maximumFractionDigits: 1 }) ?? '–'}
                      </span>
                      {p && <span className="arab teks-emas">{p.arab}</span>}
                    </div>
                    <div className="isi-penuh tumpuk tumpuk--rapat" style={{ gap: 4 }}>
                      <div className="baris baris--bungkus" style={{ gap: 6 }}>
                        <b style={{ fontSize: 17 }}>
                          Semester {namaSemester(r.semester)} {r.tahunAjaran}
                        </b>
                        {r.baru && <Lencana jenis="emas">Baru</Lencana>}
                      </div>
                      <span className="redup kecil">
                        {r.kelas}
                        {r.peringkat && ` · peringkat ${r.peringkat} dari ${r.jumlahSantri}`} · terbit {tanggalPendek(r.diterbitkan.slice(0, 10))}
                      </span>
                    </div>
                    <ChevronRight className="redup-2" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="kaca">
              <Kosong ikon={<ScrollText />} judul="Belum ada raport" pesan="Raport akan tampil di sini setelah diterbitkan oleh madrasah." />
            </div>
          )}
        </>
      )}
    </>
  );
}
