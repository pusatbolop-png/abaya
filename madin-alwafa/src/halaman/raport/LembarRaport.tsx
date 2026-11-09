import type { DataRaport } from '../../lib/tipe';
import { Lambang, SudutHias } from '../../ui/Lambang';
import { KodeQr } from './KodeQr';
import { hariIni, namaSemester, tanggalHijriah, tanggalPanjang } from '../../../shared/format';

const titik = '........................';

/** Lembar raport A4. Dipakai pengurus (pratinjau/cetak) dan wali santri (lihat/unduh). */
export function LembarRaport({ d }: { d: DataRaport }) {
  const tanggal = d.periode.tanggalRaport ?? (d.diterbitkan ? d.diterbitkan.slice(0, 10) : hariIni());
  const alamatVerifikasi = d.kode ? `${location.origin}/verifikasi/${d.kode}` : '';
  const kurang = (m: DataRaport['mapel'][number]) => m.akhir !== null && m.akhir < m.kkm;
  const s = d.santri;

  return (
    <article className="lembar" aria-label={`Raport ${s.nama}`}>
      <SudutHias className="lembar__sudut lembar__sudut--1" />
      <SudutHias className="lembar__sudut lembar__sudut--2" />
      <SudutHias className="lembar__sudut lembar__sudut--3" />
      <SudutHias className="lembar__sudut lembar__sudut--4" />
      <Lambang className="lembar__tanda-air" warna="hijau" />
      {d.status !== 'terbit' && <div className="lembar__draf">DRAF</div>}

      <div className="lembar__isi">
        <header className="kop">
          <Lambang className="kop__lambang" warna="hijau" />
          <div className="kop__tengah">
            {d.lembaga.namaArab && <div className="kop__arab">{d.lembaga.namaArab}</div>}
            <div className="kop__nama">{d.lembaga.nama}</div>
            <div className="kop__alamat">
              {[d.lembaga.alamat, d.lembaga.telepon && `Telp. ${d.lembaga.telepon}`].filter(Boolean).join(' · ') || 'Alamat madrasah belum diisi'}
            </div>
          </div>
          <div />
        </header>

        <div className="judul-raport">
          <h2>LAPORAN HASIL BELAJAR SANTRI</h2>
          <div className="arab">كشف نتائج الدراسة</div>
          <p>
            Semester {namaSemester(d.periode.semester)} · Tahun Ajaran {d.periode.tahunAjaran}
          </p>
        </div>

        <section className="identitas">
          <dl>
            <dt>Nama santri</dt>
            <dd>:</dd>
            <dd>{s.nama}</dd>
            <dt>Nomor induk</dt>
            <dd>:</dd>
            <dd>{s.nis}</dd>
            <dt>Tempat, tgl. lahir</dt>
            <dd>:</dd>
            <dd>{[s.tempatLahir, s.tanggalLahir && tanggalPanjang(s.tanggalLahir)].filter(Boolean).join(', ') || '–'}</dd>
          </dl>
          <dl>
            <dt>Kelas</dt>
            <dd>:</dd>
            <dd>{d.kelas?.nama ?? '–'}</dd>
            <dt>Semester</dt>
            <dd>:</dd>
            <dd>
              {d.periode.semester} ({namaSemester(d.periode.semester)})
            </dd>
            <dt>Wali kelas</dt>
            <dd>:</dd>
            <dd>{d.kelas?.waliKelas ?? '–'}</dd>
          </dl>
        </section>

        <table className="tabel-raport">
          <thead>
            <tr>
              <th className="no">No</th>
              <th style={{ textAlign: 'left' }}>
                Mata pelajaran <span className="arab">المواد الدراسية</span>
              </th>
              <th className="angka-r">KKM</th>
              <th className="nilai-r">
                Nilai <span className="arab">الدرجة</span>
              </th>
              <th className="pred-r">
                Predikat <span className="arab">التقدير</span>
              </th>
              <th style={{ textAlign: 'left' }}>Terbilang</th>
            </tr>
          </thead>
          <tbody>
            {d.mapel.map((m, i) => (
              <tr key={m.mapelId}>
                <td className="no">{i + 1}</td>
                <td>
                  <div className="mapel-ganda">
                    <span>{m.nama}</span>
                    {m.namaArab && <span className="arab">{m.namaArab}</span>}
                  </div>
                </td>
                <td className="angka-r">{m.kkm}</td>
                <td className={`nilai-r ${kurang(m) ? 'nilai-r--kurang' : ''}`}>{m.akhir ?? '–'}</td>
                <td className="pred-r">
                  {m.predikat ? (
                    <div className="mapel-ganda">
                      <span>
                        {m.huruf} · {m.predikat}
                      </span>
                      <span className="arab">{m.predikatArab}</span>
                    </div>
                  ) : (
                    '–'
                  )}
                </td>
                <td className="terbilang-r">{m.terbilang ?? '–'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Jumlah nilai</td>
              <td className="nilai-r">{d.jumlah ?? '–'}</td>
              <td colSpan={2} className="terbilang-r">
                Rata-rata: <b>{d.rataRata !== null ? d.rataRata.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'}</b>
                {d.tampilPeringkat && d.peringkat !== null && (
                  <>
                    {' '}
                    · Peringkat ke-<b>{d.peringkat}</b> dari {d.jumlahSantri} santri
                  </>
                )}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="dua-kolom">
          <section>
            <div className="subjudul-r">
              Kepribadian <span className="arab">السلوك</span>
            </div>
            <table className="tabel-raport tabel-raport--kecil">
              <tbody>
                {d.kepribadian.map((k) => (
                  <tr key={k.kunci}>
                    <td>
                      <div className="mapel-ganda">
                        <span>{k.label}</span>
                        <span className="arab">{k.arab}</span>
                      </div>
                    </td>
                    <td className="angka-r" style={{ fontWeight: 700 }}>
                      {k.nilai ?? '–'}
                    </td>
                    <td>{k.keterangan ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section>
            <div className="subjudul-r">
              Ketidakhadiran <span className="arab">الغياب</span>
            </div>
            <table className="tabel-raport tabel-raport--kecil">
              <tbody>
                <tr>
                  <td>Sakit</td>
                  <td className="angka-r">{d.kehadiran.sakit}</td>
                  <td>hari</td>
                </tr>
                <tr>
                  <td>Izin</td>
                  <td className="angka-r">{d.kehadiran.izin}</td>
                  <td>hari</td>
                </tr>
                <tr>
                  <td>Tanpa keterangan</td>
                  <td className="angka-r">{d.kehadiran.alpa}</td>
                  <td>hari</td>
                </tr>
                <tr>
                  <td>Kehadiran</td>
                  <td className="angka-r" colSpan={2} style={{ textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {d.kehadiran.total ? `${Math.round((d.kehadiran.hadir / d.kehadiran.total) * 100)}% (${d.kehadiran.hadir}/${d.kehadiran.total})` : '–'}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        <div className={d.hafalan.length ? 'dua-kolom' : undefined}>
          <section>
            <div className="subjudul-r">
              Catatan wali kelas <span className="arab">ملاحظات</span>
            </div>
            <div className="kotak-r">{d.catatan ?? <span style={{ color: '#9aa69f' }}>Belum ada catatan.</span>}</div>
          </section>
          {d.hafalan.length > 0 && (
            <section>
              <div className="subjudul-r">
                Capaian hafalan <span className="arab">المحفوظات</span>
              </div>
              <div className="kotak-r">
                <ul className="daftar-hafalan">
                  {d.hafalan.slice(0, 4).map((h, i) => (
                    <li key={i}>{h.materi}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>

        <section className="ttd">
          <div className="ttd__keputusan">{d.periode.semester === 2 && <div className="kotak-r kotak-r--emas">Keputusan: {d.keputusan ?? titik}</div>}</div>
          <div className="ttd__tempat">
            {d.lembaga.kota || titik}, {tanggalPanjang(tanggal)}
            <br />
            <span style={{ color: '#5c6a63' }}>{tanggalHijriah(tanggal)}</span>
          </div>
          <div className="ttd__kolom">
            <span>Wali santri</span>
            <span />
            <span className="ttd__nama ttd__kosong">{titik}</span>
          </div>
          <div className="ttd__kolom">
            <span>Wali kelas</span>
            <span />
            <span className="ttd__nama">{d.kelas?.waliKelas ?? titik}</span>
          </div>
          <div className="ttd__kolom">
            <span>Kepala madrasah</span>
            <span />
            <span className="ttd__nama">{d.lembaga.kepala || titik}</span>
          </div>
        </section>

        <footer className="kaki-raport">
          {d.kode ? (
            <>
              <div className="kaki-raport__qr">
                <KodeQr teks={alamatVerifikasi} />
              </div>
              <div style={{ display: 'grid', gap: '0.6mm' }}>
                <span>
                  Kode verifikasi <span className="kaki-raport__kode">{d.kode}</span>
                </span>
                <span>
                  Pindai kode QR atau buka <b>{location.host}/verifikasi</b> untuk memastikan raport ini asli dan diterbitkan oleh {d.lembaga.singkatan}.
                </span>
              </div>
            </>
          ) : (
            <span>Raport ini masih draf dan belum diterbitkan. Kode verifikasi diberikan saat raport diterbitkan.</span>
          )}
        </footer>
      </div>
    </article>
  );
}
