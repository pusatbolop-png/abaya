import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, BadgeCheck, Download, FileText, LayoutList, Quote } from 'lucide-react';
import { usePakai } from '../../lib/pakai';
import type { DataRaport } from '../../lib/tipe';
import { Bilah, GalatMuat, Lencana, Memuat, Tombol, useIngat, useJudul } from '../../ui/dasar';
import { KertasSkala } from '../raport/KertasSkala';
import { LembarRaport } from '../raport/LembarRaport';
import { predikat } from '../../../shared/konstanta';
import { namaSemester, waktu } from '../../../shared/format';

export default function LihatRaport() {
  const { periodeId } = useParams();
  const { data: d, galat, muatUlang } = usePakai<DataRaport>(`/api/wali/raport/${periodeId}`);
  const [tab, setTab] = useIngat<'ringkasan' | 'lembar'>('tab-raport-wali', 'ringkasan');
  const [cetak, setCetak] = useState(false);
  useJudul(d ? `Raport ${namaSemester(d.periode.semester)} ${d.periode.tahunAjaran}` : 'Raport');

  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!d) return <Memuat baris={4} tinggi={110} />;
  const p = d.rataRata !== null ? predikat(d.rataRata) : null;

  const unduh = () => {
    // Lembar raport harus ada di halaman sebelum dialog cetak dibuka.
    setCetak(true);
    setTimeout(() => {
      window.print();
      setCetak(false);
    }, 350);
  };

  return (
    <>
      <div className="baris baris--antara baris--bungkus">
        <Link to="/wali/raport" className="tautan-kembali">
          <ArrowLeft /> Semua raport
        </Link>
        <div className="baris">
          <div className="segmen" role="tablist">
            <button role="tab" aria-selected={tab === 'ringkasan'} onClick={() => setTab('ringkasan')}>
              <LayoutList /> Ringkasan
            </button>
            <button role="tab" aria-selected={tab === 'lembar'} onClick={() => setTab('lembar')}>
              <FileText /> Lembar raport
            </button>
          </div>
          <Tombol varian="utama" ikon={<Download />} onClick={unduh} aria-label="Unduh PDF">
            <span className="sembunyi-ponsel">Unduh PDF</span>
          </Tombol>
        </div>
      </div>

      <section className="kaca kaca--emas kaca--kilau kepala-raport-wali">
        <div className="tumpuk tumpuk--rapat isi-penuh" style={{ gap: 6 }}>
          <div className="kepala-halaman__kecil">
            Semester {namaSemester(d.periode.semester)} · {d.periode.tahunAjaran}
          </div>
          <h1 className="judul-hias" style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>
            {d.santri.nama}
          </h1>
          <div className="redup kecil">
            {d.kelas?.nama} · NIS {d.santri.nis} · wali kelas {d.kelas?.waliKelas ?? '–'}
          </div>
          {d.kode && (
            <div className="baris" style={{ gap: 6, marginTop: 4 }}>
              <Lencana jenis="ok">
                <BadgeCheck /> Terverifikasi · {d.kode}
              </Lencana>
            </div>
          )}
        </div>
        <div className="kepala-raport-wali__nilai">
          <div className="angka-besar">{d.rataRata?.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) ?? '–'}</div>
          {p && <div className="arab teks-emas" style={{ fontSize: 28, lineHeight: 1.3 }}>{p.arab}</div>}
          <div className="redup-2 kecil">
            rata-rata{d.peringkat && ` · peringkat ${d.peringkat}/${d.jumlahSantri}`}
          </div>
        </div>
      </section>

      {tab === 'ringkasan' && !cetak ? (
        <div className="grid-wali">
          <section className="kaca kaca--pad bentang-penuh-wali">
            <div className="kartu-judul">
              <h2>Nilai mata pelajaran</h2>
              <span className="redup-2 kecil">KKM per pelajaran ditandai garis</span>
            </div>
            <div className="daftar-nilai-wali">
              {d.mapel.map((m) => (
                <div key={m.mapelId} className="nilai-wali">
                  <div className="baris baris--antara">
                    <div style={{ display: 'grid', minWidth: 0 }}>
                      <b className="potong">{m.nama}</b>
                      <span className="redup-2 kecil potong">{m.kitab ?? ''}</span>
                    </div>
                    <div className="baris" style={{ gap: 10 }}>
                      {m.namaArab && (
                        <span className="arab redup sembunyi-ponsel" style={{ fontSize: 18 }}>
                          {m.namaArab}
                        </span>
                      )}
                      <b className={`angka nilai-wali__angka ${m.tuntas === false ? 'nilai-akhir--kurang' : ''}`}>{m.akhir ?? '–'}</b>
                    </div>
                  </div>
                  <div className="nilai-wali__bilah">
                    <Bilah persen={m.akhir ?? 0} jenis={m.tuntas === false ? 'waspada' : 'emas'} label={`Nilai ${m.nama}`} />
                    <span className="nilai-wali__kkm" style={{ left: `${m.kkm}%` }} title={`KKM ${m.kkm}`} />
                  </div>
                  <div className="redup-2 kecil">
                    {m.predikat} <span className="arab">{m.predikatArab}</span> · {m.terbilang}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="kaca kaca--pad">
            <div className="kartu-judul">
              <h2>Kepribadian</h2>
            </div>
            <div className="tumpuk tumpuk--rapat">
              {d.kepribadian.map((k) => (
                <div key={k.kunci} className="baris baris--antara panel" style={{ padding: '10px 14px' }}>
                  <span>
                    {k.label}{' '}
                    <span className="arab redup-2" style={{ fontSize: 16 }}>
                      {k.arab}
                    </span>
                  </span>
                  <span className="baris" style={{ gap: 8 }}>
                    <span className="redup kecil">{k.keterangan}</span>
                    <span className="huruf-sikap">{k.nilai}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="kaca kaca--pad">
            <div className="kartu-judul">
              <h2>Ketidakhadiran</h2>
              <span className="redup-2 kecil">{d.kehadiran.total} pertemuan</span>
            </div>
            <div className="grid-3 ringkas-hadir">
              <div>
                <b className="angka">{d.kehadiran.sakit}</b>
                <span>Sakit</span>
              </div>
              <div>
                <b className="angka">{d.kehadiran.izin}</b>
                <span>Izin</span>
              </div>
              <div>
                <b className="angka">{d.kehadiran.alpa}</b>
                <span>Tanpa ket.</span>
              </div>
            </div>
            {d.hafalan.length > 0 && (
              <>
                <div className="kartu-judul" style={{ margin: '18px 0 10px' }}>
                  <h2>Capaian hafalan</h2>
                </div>
                <ul className="daftar-centang">
                  {d.hafalan.map((h, i) => (
                    <li key={i}>
                      {h.materi} <span className="redup-2 kecil">· {h.predikat}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="kaca kaca--pad bentang-penuh-wali catatan-wali">
            <Quote className="catatan-wali__ikon" />
            <div className="tumpuk tumpuk--rapat">
              <div className="mikro redup-2">Catatan wali kelas</div>
              <p className="judul-hias" style={{ fontSize: 24, lineHeight: 1.35, fontWeight: 500 }}>
                {d.catatan ?? 'Tidak ada catatan.'}
              </p>
              <span className="redup kecil">— {d.kelas?.waliKelas ?? 'Wali kelas'}</span>
              {d.keputusan && (
                <div style={{ marginTop: 10 }}>
                  <Lencana jenis="emas">{d.keputusan}</Lencana>
                </div>
              )}
            </div>
          </section>
          <p className="redup-2 kecil bentang-penuh-wali" style={{ textAlign: 'center' }}>
            Diterbitkan {waktu(d.diterbitkan)} WIB oleh {d.lembaga.nama}.
          </p>
        </div>
      ) : (
        <div className="area-cetak">
          <KertasSkala>
            <LembarRaport d={d} />
          </KertasSkala>
        </div>
      )}
      <p className="redup-2 kecil sembunyi-cetak" style={{ textAlign: 'center' }}>
        Untuk menyimpan PDF, tekan <b>Unduh PDF</b> lalu pilih <i>Simpan sebagai PDF</i> di jendela cetak.
      </p>
    </>
  );
}
