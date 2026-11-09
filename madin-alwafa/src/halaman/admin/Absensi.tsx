import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CalendarCheck2, CalendarRange, CheckCheck, Save } from 'lucide-react';
import { kirim } from '../../lib/api';
import { usePakai } from '../../lib/pakai';
import { useToast } from '../../lib/toast';
import type { Kelas } from '../../lib/tipe';
import { Avatar, GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, Tombol, useIngat, useJudul } from '../../ui/dasar';
import { STATUS_HADIR, type StatusHadir } from '../../../shared/konstanta';
import { bulanIni, hariIni, namaBulan, tanggalHari } from '../../../shared/format';

interface DataAbsen {
  kelas: { id: number; nama: string };
  tanggal: string;
  tersimpan: boolean;
  daftar: { santriId: number; nis: string; nama: string; jk: string; status: StatusHadir | null; keterangan: string | null }[];
}
interface Rekap {
  kelas: { id: number; nama: string };
  bulan: string;
  tanggal: string[];
  daftar: { id: number; nama: string; nis: string; jk: string; status: Record<string, StatusHadir>; H: number; I: number; S: number; A: number }[];
}

export default function Absensi() {
  useJudul('Absensi');
  const [param, setParam] = useSearchParams();
  const [kelasIngat, setKelasIngat] = useIngat('kelas-absen', '');
  const kelasId = param.get('kelas') ?? kelasIngat;
  const [mode, setMode] = useState<'isi' | 'rekap'>('isi');
  const [tanggal, setTanggal] = useState(hariIni());
  const [bulan, setBulan] = useState(bulanIni());
  const { data: kelas } = usePakai<{ daftar: Kelas[] }>('/api/admin/kelas');
  const kelasAktif = (kelas?.daftar ?? []).filter((k) => k.aktif);

  useEffect(() => {
    if (!kelasId && kelasAktif.length) setKelasIngat(String(kelasAktif[0].id));
  }, [kelasId, kelasAktif, setKelasIngat]);

  const pilihKelas = (v: string) => {
    setKelasIngat(v);
    const p = new URLSearchParams(param);
    p.set('kelas', v);
    setParam(p, { replace: true });
  };

  return (
    <>
      <KepalaHalaman kecil="Kegiatan belajar" judul="Absensi" sub="Catat kehadiran santri setiap pertemuan. Rekap otomatis masuk ke raport dan terlihat oleh wali." />
      <div className="saringan">
        <select className="masukan" value={kelasId} onChange={(e) => pilihKelas(e.target.value)} aria-label="Kelas">
          {!kelasId && <option value="">Pilih kelas</option>}
          {kelasAktif.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nama}
            </option>
          ))}
        </select>
        {mode === 'isi' ? (
          <input className="masukan angka" type="date" value={tanggal} max={hariIni()} onChange={(e) => setTanggal(e.target.value || hariIni())} aria-label="Tanggal" />
        ) : (
          <input className="masukan angka" type="month" value={bulan} max={bulanIni()} onChange={(e) => setBulan(e.target.value || bulanIni())} aria-label="Bulan" />
        )}
        <div className="segmen" role="tablist">
          <button role="tab" aria-selected={mode === 'isi'} onClick={() => setMode('isi')}>
            <CalendarCheck2 /> Isi absensi
          </button>
          <button role="tab" aria-selected={mode === 'rekap'} onClick={() => setMode('rekap')}>
            <CalendarRange /> Rekap bulanan
          </button>
        </div>
      </div>
      {!kelasId ? (
        <div className="kaca">
          <Kosong judul="Pilih kelas" pesan="Pilih kelas untuk mulai mengisi absensi." />
        </div>
      ) : mode === 'isi' ? (
        <IsiAbsensi key={`${kelasId}-${tanggal}`} kelasId={kelasId} tanggal={tanggal} />
      ) : (
        <RekapBulanan kelasId={kelasId} bulan={bulan} />
      )}
    </>
  );
}

function IsiAbsensi({ kelasId, tanggal }: { kelasId: string; tanggal: string }) {
  const toast = useToast();
  const { data, galat, muatUlang } = usePakai<DataAbsen>(`/api/admin/absensi?kelas=${kelasId}&tanggal=${tanggal}`);
  const [isian, setIsian] = useState<Record<number, { status: StatusHadir; keterangan: string }>>({});
  const [sibuk, setSibuk] = useState(false);
  const [berubah, setBerubah] = useState(false);

  useEffect(() => {
    if (!data) return;
    setIsian(Object.fromEntries(data.daftar.map((d) => [d.santriId, { status: d.status ?? 'H', keterangan: d.keterangan ?? '' }])));
    setBerubah(false);
  }, [data]);

  const hitung = useMemo(() => {
    const h: Record<StatusHadir, number> = { H: 0, I: 0, S: 0, A: 0 };
    Object.values(isian).forEach((v) => h[v.status]++);
    return h;
  }, [isian]);

  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!data) return <Memuat baris={6} />;
  if (!data.daftar.length)
    return (
      <div className="kaca">
        <Kosong judul="Kelas ini belum punya santri" pesan="Masukkan santri ke kelas ini dari halaman Data santri." />
      </div>
    );

  const ubah = (id: number, v: Partial<{ status: StatusHadir; keterangan: string }>) => {
    setIsian({ ...isian, [id]: { ...isian[id], ...v } });
    setBerubah(true);
  };

  const simpan = async () => {
    setSibuk(true);
    try {
      await kirim('PUT', '/api/admin/absensi', {
        kelasId: Number(kelasId),
        tanggal,
        daftar: data.daftar.map((d) => ({ santriId: d.santriId, status: isian[d.santriId].status, keterangan: isian[d.santriId].status === 'H' ? null : isian[d.santriId].keterangan })),
      });
      toast.tampil(`Absensi ${data.kelas.nama} tersimpan: ${hitung.H} hadir, ${hitung.I + hitung.S + hitung.A} tidak hadir.`);
      muatUlang();
    } catch (e) {
      toast.galat(e);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <section className="kaca">
      <div className="kepala-panel">
        <div>
          <b>{data.kelas.nama}</b>
          <div className="redup-2 kecil">{tanggalHari(tanggal)}</div>
        </div>
        <div className="baris baris--bungkus" style={{ gap: 6 }}>
          {data.tersimpan && !berubah ? <Lencana jenis="ok">Tersimpan</Lencana> : <Lencana jenis="waspada">{data.tersimpan ? 'Ada perubahan' : 'Belum disimpan'}</Lencana>}
          <Tombol
            ukuran="kecil"
            ikon={<CheckCheck />}
            onClick={() => {
              setIsian(Object.fromEntries(Object.keys(isian).map((k) => [k, { status: 'H' as StatusHadir, keterangan: '' }])));
              setBerubah(true);
            }}
          >
            Semua hadir
          </Tombol>
        </div>
      </div>
      <ul className="daftar-absen">
        {data.daftar.map((d, i) => {
          const v = isian[d.santriId];
          if (!v) return null;
          return (
            <li key={d.santriId}>
              <span className="redup-2 angka kecil" style={{ width: 22 }}>
                {i + 1}
              </span>
              <Avatar nama={d.nama} jk={d.jk} ukuran={36} />
              <div className="isi-penuh" style={{ display: 'grid' }}>
                <b className="potong">{d.nama}</b>
                <span className="redup-2 kecil angka">{d.nis}</span>
              </div>
              {v.status !== 'H' && (
                <input
                  className="masukan masukan--kecil keterangan-absen"
                  value={v.keterangan}
                  onChange={(e) => ubah(d.santriId, { keterangan: e.target.value })}
                  placeholder="Keterangan"
                  aria-label={`Keterangan ${d.nama}`}
                />
              )}
              <div className="pilih-hadir" role="group" aria-label={`Kehadiran ${d.nama}`}>
                {(Object.keys(STATUS_HADIR) as StatusHadir[]).map((s) => (
                  <button key={s} type="button" data-s={s} aria-pressed={v.status === s} title={STATUS_HADIR[s]} onClick={() => ubah(d.santriId, { status: s })}>
                    {s}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="kaki-simpan">
        <div className="baris baris--bungkus kecil" style={{ gap: 6 }}>
          <Lencana jenis="ok">{hitung.H} hadir</Lencana>
          <Lencana jenis="info">{hitung.I} izin</Lencana>
          <Lencana jenis="waspada">{hitung.S} sakit</Lencana>
          <Lencana jenis="bahaya">{hitung.A} alpa</Lencana>
        </div>
        <Tombol varian="utama" ikon={<Save />} sibuk={sibuk} onClick={simpan}>
          Simpan absensi
        </Tombol>
      </div>
    </section>
  );
}

function RekapBulanan({ kelasId, bulan }: { kelasId: string; bulan: string }) {
  const { data, galat, muatUlang } = usePakai<Rekap>(`/api/admin/absensi/rekap?kelas=${kelasId}&bulan=${bulan}`);
  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!data) return <Memuat baris={6} />;
  return (
    <section className="kaca">
      <div className="kepala-panel">
        <div>
          <b>{data.kelas.nama}</b>
          <div className="redup-2 kecil">
            {namaBulan(bulan)} · {data.tanggal.length} pertemuan
          </div>
        </div>
      </div>
      {!data.tanggal.length ? (
        <Kosong judul="Belum ada absensi bulan ini" />
      ) : (
        <div className="tabel-bungkus">
          <table className="tabel tabel--rapat tabel-rekap">
            <thead>
              <tr>
                <th className="kolom-tetap">Santri</th>
                {data.tanggal.map((t) => (
                  <th key={t} className="tengah angka">
                    {Number(t.slice(8))}
                  </th>
                ))}
                <th className="tengah">H</th>
                <th className="tengah">I</th>
                <th className="tengah">S</th>
                <th className="tengah">A</th>
                <th className="kanan">%</th>
              </tr>
            </thead>
            <tbody>
              {data.daftar.map((s) => {
                const total = s.H + s.I + s.S + s.A;
                return (
                  <tr key={s.id}>
                    <td className="kolom-tetap">
                      <span className="potong" style={{ display: 'block', maxWidth: 190 }}>
                        {s.nama}
                      </span>
                    </td>
                    {data.tanggal.map((t) => (
                      <td key={t} className="tengah">
                        <span className={`sel-hadir sel-hadir--${s.status[t] ?? 'kosong'}`}>{s.status[t] && s.status[t] !== 'H' ? s.status[t] : ''}</span>
                      </td>
                    ))}
                    <td className="tengah angka">{s.H}</td>
                    <td className="tengah angka">{s.I}</td>
                    <td className="tengah angka">{s.S}</td>
                    <td className="tengah angka">{s.A}</td>
                    <td className="kanan angka tebal">{total ? Math.round((s.H / total) * 100) : 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
