import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, BookOpenCheck, KeyRound, MessageCircle, Pencil, ScrollText, Trash2 } from 'lucide-react';
import { kirim } from '../../lib/api';
import { usePakai } from '../../lib/pakai';
import { useSesi } from '../../lib/sesi';
import { useToast } from '../../lib/toast';
import type { Santri } from '../../lib/tipe';
import { Avatar, GalatMuat, Lencana, LencanaJk, Memuat, TautanTombol, Tombol, useJudul, useKonfirmasi } from '../../ui/dasar';
import { FormSantri, TampilAkun, type AkunBaru } from './santri-form';
import { PREDIKAT_HAFALAN, STATUS_SANTRI, type PredikatHafalan } from '../../../shared/konstanta';
import { namaBulanPendek, namaSemester, rupiah, tanggalPanjang, tanggalPendek, tautanWa, waktu } from '../../../shared/format';

interface Detail {
  santri: Santri & { waliKelas: string | null };
  periode: { id: number; tahunAjaran: string; semester: number } | null;
  kehadiran: { hadir: number; sakit: number; izin: number; alpa: number; total: number } | null;
  raport: { periode_id: number; tahun_ajaran: string; semester: number; status: string; kode: string | null; diterbitkan: string | null; dibaca_wali: string | null }[];
  hafalan: { id: number; tanggal: string; jenis: string; materi: string; predikat: PredikatHafalan; penyimak: string | null }[];
  syahriah: { tahunAjaran: string; bulan: { bulan: string; bayar: { nominal: number; tanggal_bayar: string } | null }[] } | null;
}

export default function DetailSantri() {
  const { id } = useParams();
  const { pengurus } = useSesi();
  const admin = pengurus?.peran === 'admin';
  const toast = useToast();
  const tanya = useKonfirmasi();
  const navigasi = useNavigate();
  const { data, galat, muatUlang } = usePakai<Detail>(`/api/admin/santri/${id}`);
  const [ubah, setUbah] = useState(false);
  const [akun, setAkun] = useState<AkunBaru | null>(null);
  useJudul(data?.santri.nama ?? 'Santri');

  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!data) return <Memuat baris={4} tinggi={110} />;
  const s = data.santri;

  const sandiBaru = async () => {
    const ya = await tanya({
      judul: 'Buat sandi baru untuk wali?',
      pesan: `Sandi lama wali ${s.nama} tidak berlaku lagi dan wali perlu masuk ulang di semua perangkat.`,
      ya: 'Buat sandi baru',
    });
    if (!ya) return;
    try {
      const r = await kirim<AkunBaru>('POST', `/api/admin/santri/${s.id}/sandi`);
      setAkun({ ...r, nama: s.nama });
      muatUlang();
    } catch (e) {
      toast.galat(e);
    }
  };

  const hapus = async () => {
    const ya = await tanya({ judul: `Hapus ${s.nama}?`, pesan: 'Data santri dihapus permanen. Bila santri sudah punya riwayat, ubah statusnya menjadi Keluar atau Pindah.', ya: 'Hapus', bahaya: true });
    if (!ya) return;
    try {
      await kirim('DELETE', `/api/admin/santri/${s.id}`);
      toast.tampil(`${s.nama} dihapus.`);
      navigasi('/admin/santri', { replace: true });
    } catch (e) {
      toast.galat(e);
    }
  };

  const k = data.kehadiran;
  const persenHadir = k?.total ? Math.round((k.hadir / k.total) * 100) : null;

  return (
    <>
      <Link to="/admin/santri" className="tautan-kembali">
        <ArrowLeft /> Data santri
      </Link>

      <section className="kaca kaca--emas kaca--pad kaca--kilau profil-santri">
        <Avatar nama={s.nama} jk={s.jk} ukuran={84} />
        <div className="tumpuk tumpuk--rapat isi-penuh">
          <div className="baris baris--bungkus" style={{ gap: 8 }}>
            <LencanaJk jk={s.jk} />
            <Lencana jenis={s.status === 'aktif' ? 'emas' : undefined}>{STATUS_SANTRI[s.status]}</Lencana>
            {s.masukTerakhir ? <Lencana jenis="ok">Wali aktif · {waktu(s.masukTerakhir)}</Lencana> : <Lencana>Wali belum masuk</Lencana>}
          </div>
          <h1 className="judul-hias" style={{ fontSize: 'clamp(30px, 4vw, 40px)' }}>
            {s.nama}
          </h1>
          <div className="redup angka">
            NIS {s.nis} · {s.kelasNama ?? 'Belum masuk kelas'}
            {s.waliKelas && <> · Wali kelas {s.waliKelas}</>}
          </div>
        </div>
        {admin && (
          <div className="baris baris--bungkus profil-santri__aksi">
            <Tombol ikon={<Pencil />} onClick={() => setUbah(true)}>
              Ubah data
            </Tombol>
            <Tombol ikon={<KeyRound />} onClick={sandiBaru}>
              Sandi baru wali
            </Tombol>
            <Tombol varian="hantu" ikon={<Trash2 />} onClick={hapus} aria-label="Hapus santri" title="Hapus santri" />
          </div>
        )}
      </section>

      <div className="grid-2">
        <section className="kaca kaca--pad">
          <div className="kartu-judul">
            <h2>Biodata</h2>
          </div>
          <dl className="daftar-data">
            <dt>Tempat, tanggal lahir</dt>
            <dd>{[s.tempatLahir, s.tanggalLahir && tanggalPanjang(s.tanggalLahir)].filter(Boolean).join(', ') || '–'}</dd>
            <dt>Alamat</dt>
            <dd>{s.alamat ?? '–'}</dd>
            <dt>Tanggal masuk</dt>
            <dd>{tanggalPanjang(s.tanggalMasuk)}</dd>
            <dt>Ayah</dt>
            <dd>{s.namaAyah ?? '–'}</dd>
            <dt>Ibu</dt>
            <dd>{s.namaIbu ?? '–'}</dd>
            <dt>Wali</dt>
            <dd>{s.namaWali ?? s.namaAyah ?? '–'}</dd>
            <dt>HP wali</dt>
            <dd>
              {s.hpWali ? (
                <a href={tautanWa(s.hpWali, `Assalamu'alaikum, Bapak/Ibu wali ${s.nama}. `)} target="_blank" rel="noreferrer" className="baris" style={{ gap: 6, display: 'inline-flex' }}>
                  <MessageCircle style={{ width: 16 }} />
                  {s.hpWali}
                </a>
              ) : (
                '–'
              )}
            </dd>
          </dl>
        </section>

        <section className="kaca kaca--pad tumpuk">
          <div className="kartu-judul" style={{ marginBottom: 0 }}>
            <h2>Kehadiran semester ini</h2>
            {persenHadir !== null && <Lencana jenis={persenHadir >= 90 ? 'ok' : persenHadir >= 75 ? 'waspada' : 'bahaya'}>{persenHadir}% hadir</Lencana>}
          </div>
          {k ? (
            <div className="grid-4 ringkas-hadir">
              <div>
                <b className="angka">{k.hadir}</b>
                <span>Hadir</span>
              </div>
              <div>
                <b className="angka">{k.izin}</b>
                <span>Izin</span>
              </div>
              <div>
                <b className="angka">{k.sakit}</b>
                <span>Sakit</span>
              </div>
              <div>
                <b className="angka">{k.alpa}</b>
                <span>Alpa</span>
              </div>
            </div>
          ) : (
            <p className="redup kecil">Belum ada semester aktif.</p>
          )}
          {data.syahriah && admin && (
            <>
              <div className="kartu-judul" style={{ margin: '8px 0 0' }}>
                <h2>Syahriah {data.syahriah.tahunAjaran}</h2>
              </div>
              <div className="bulan-mini">
                {data.syahriah.bulan.map((b) => (
                  <span key={b.bulan} className={b.bayar ? 'lunas' : ''} title={b.bayar ? `${rupiah(b.bayar.nominal)} · ${tanggalPendek(b.bayar.tanggal_bayar)}` : 'Belum dibayar'}>
                    {namaBulanPendek(b.bulan)}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="grid-2">
        <section className="kaca kaca--pad">
          <div className="kartu-judul">
            <h2>Raport</h2>
            <ScrollText className="redup-2" style={{ width: 18 }} />
          </div>
          <div className="tumpuk tumpuk--rapat">
            {data.raport.map((r) => (
              <Link key={r.periode_id} to={`/admin/raport/${s.id}/${r.periode_id}`} className="baris panel baris-tautan">
                <div className="isi-penuh">
                  <b>
                    Semester {namaSemester(r.semester)} {r.tahun_ajaran}
                  </b>
                  <div className="redup-2 kecil">
                    {r.status === 'terbit' ? `Terbit ${waktu(r.diterbitkan)} · ${r.dibaca_wali ? 'sudah dibuka wali' : 'belum dibuka wali'}` : 'Belum diterbitkan'}
                  </div>
                </div>
                <Lencana jenis={r.status === 'terbit' ? 'ok' : 'waspada'}>{r.status === 'terbit' ? 'Terbit' : 'Draf'}</Lencana>
              </Link>
            ))}
            {!data.raport.length && <p className="redup kecil">Belum ada semester.</p>}
          </div>
        </section>

        <section className="kaca kaca--pad">
          <div className="kartu-judul">
            <h2>Hafalan terbaru</h2>
            <TautanTombol to={`/admin/hafalan?santri=${s.id}`} ukuran="kecil" ikon={<BookOpenCheck />}>
              Catat setoran
            </TautanTombol>
          </div>
          <ol className="linimasa">
            {data.hafalan.map((h) => (
              <li key={h.id}>
                <span className={`linimasa__titik linimasa__titik--${h.predikat}`} />
                <div className="isi-penuh">
                  <div>
                    <b>{h.materi}</b> <span className="redup-2 kecil">· {h.jenis}</span>
                  </div>
                  <div className="redup-2 kecil">
                    {tanggalPanjang(h.tanggal)} · {PREDIKAT_HAFALAN[h.predikat]}
                    {h.penyimak && ` · ${h.penyimak}`}
                  </div>
                </div>
              </li>
            ))}
            {!data.hafalan.length && <p className="redup kecil">Belum ada setoran.</p>}
          </ol>
        </section>
      </div>

      {ubah && (
        <FormSantri
          santri={s}
          tutup={() => setUbah(false)}
          selesai={() => {
            setUbah(false);
            muatUlang();
          }}
        />
      )}
      {akun && <TampilAkun akun={akun} tutup={() => setAkun(null)} />}
    </>
  );
}
