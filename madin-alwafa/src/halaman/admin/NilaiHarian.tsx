import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, CalendarCheck2, CheckCheck, CircleCheck, Clock, Lock, Save } from 'lucide-react';
import { kirim } from '../../lib/api';
import { urlFoto } from '../../lib/foto';
import { usePakai } from '../../lib/pakai';
import { useSaringan } from '../../lib/saringan';
import { useSesi } from '../../lib/sesi';
import { useToast } from '../../lib/toast';
import { Avatar, Bilah, GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, Tombol, useJudul } from '../../ui/dasar';
import { STATUS_HADIR, type StatusHadir } from '../../../shared/konstanta';
import { hariIni, tanggalHari } from '../../../shared/format';

export interface Pelajaran {
  kelasId: number;
  kelas: string;
  mapelId: number;
  mapel: string;
  mapelArab: string | null;
  jamMulai: string;
  jamSelesai: string;
  pengajar: string | null;
  waliKelas: string | null;
  anggota: number;
  tidakHadir: number;
  wajib: number;
  terisi: number;
  lengkap: boolean;
  absensiTerisi: boolean;
}
interface Status {
  tanggal: string;
  hariIni: string;
  jamSekarang: string;
  batas: string;
  libur: boolean;
  saya: string;
  pelajaran: Pelajaran[];
  lengkap: number;
}
interface Isi {
  kelas: { id: number; nama: string; waliKelas: string | null };
  mapel: { id: number; nama: string; namaArab: string | null; pengajar: string | null };
  tanggal: string;
  batas: string;
  daftar: { santriId: number; nis: string; nama: string; jk: string; fotoVersi: string | null; nilai: number | null; absen: StatusHadir | null; keterangan: string | null; jumlah: number; rata: number | null; terkunci: boolean }[];
}

const sama = (a: string | null | undefined, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();
const menit = (j: string) => Number(j.slice(0, 2)) * 60 + Number(j.slice(3, 5));

/** Sisa waktu sampai batas input, mis. "sisa 1 jam 25 menit". */
export function sisaWaktu(jam: string, batas: string) {
  const sisa = menit(batas) - menit(jam);
  if (sisa <= 0) return null;
  const j = Math.floor(sisa / 60);
  return `sisa ${j ? `${j} jam ` : ''}${sisa % 60} menit`;
}

export default function NilaiHarian() {
  useJudul('Nilai harian');
  const { pengurus } = useSesi();
  const [param, aturParam] = useSaringan();
  const tanggal = param.get('tanggal') ?? hariIni();
  const kelas = param.get('kelas');
  const mapel = param.get('mapel');
  const [semua, setSemua] = useState(pengurus?.peran === 'admin');
  const { data, galat, muatUlang } = usePakai<Status>(`/api/admin/harian?tanggal=${tanggal}`);

  if (kelas && mapel) return <IsiNilai kelasId={kelas} mapelId={mapel} tanggal={tanggal} kembali={() => aturParam({ kelas: null, mapel: null }, { ganti: false })} />;

  const milikSaya = (p: Pelajaran) => !!data && (sama(p.pengajar, data.saya) || sama(p.waliKelas, data.saya));
  const daftar = data ? (semua ? data.pelajaran : data.pelajaran.filter(milikSaya)) : [];
  const hariIniPilih = data?.tanggal === data?.hariIni;
  const sisa = data && hariIniPilih ? sisaWaktu(data.jamSekarang, data.batas) : null;

  return (
    <>
      <KepalaHalaman
        kecil="Kegiatan belajar"
        judul="Nilai harian"
        sub={`Nilai setiap pelajaran yang diajarkan hari ini, paling lambat pukul ${data?.batas.replace(':', '.') ?? '21.00'} WIB. Nilai harian semester di raport dihitung otomatis dari rata-ratanya.`}
      />
      <div className="saringan">
        <input
          className="masukan angka"
          type="date"
          value={tanggal}
          max={hariIni()}
          onChange={(e) => aturParam({ tanggal: e.target.value && e.target.value !== hariIni() ? e.target.value : null })}
          aria-label="Tanggal"
        />
        <div className="segmen" role="tablist" aria-label="Pelajaran yang ditampilkan">
          <button role="tab" aria-selected={!semua} onClick={() => setSemua(false)}>
            Pelajaran saya
          </button>
          <button role="tab" aria-selected={semua} onClick={() => setSemua(true)}>
            Semua pelajaran
          </button>
        </div>
        {data && hariIniPilih && (
          <Lencana jenis={sisa ? 'emas' : 'bahaya'}>
            <Clock /> {sisa ? `Batas ${data.batas.replace(':', '.')} WIB · ${sisa}` : `Batas ${data.batas.replace(':', '.')} WIB sudah lewat`}
          </Lencana>
        )}
      </div>
      {galat ? (
        <GalatMuat galat={galat} ulang={muatUlang} />
      ) : !data ? (
        <Memuat baris={4} tinggi={110} />
      ) : !data.pelajaran.length ? (
        <div className="kaca">
          <Kosong ikon={<CalendarCheck2 />} judul="Tidak ada pelajaran" pesan={`Tidak ada jadwal pelajaran pada ${tanggalHari(tanggal)}.`} />
        </div>
      ) : !daftar.length ? (
        <div className="kaca">
          <Kosong
            ikon={<CalendarCheck2 />}
            judul="Anda tidak mengajar pada hari ini"
            pesan="Pelajaran dicocokkan dengan nama pengajar di menu Kelas & pelajaran."
            aksi={
              <Tombol onClick={() => setSemua(true)}>Lihat semua pelajaran</Tombol>
            }
          />
        </div>
      ) : (
        <>
          <div className="redup kecil">
            {tanggalHari(tanggal)} · {daftar.filter((p) => p.lengkap).length} dari {daftar.length} pelajaran lengkap
          </div>
          <div className="grid-pelajaran">
            {daftar.map((p) => (
              <KartuPelajaran key={`${p.kelasId}-${p.mapelId}`} p={p} buka={() => aturParam({ kelas: String(p.kelasId), mapel: String(p.mapelId) }, { ganti: false })} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function KartuPelajaran({ p, buka }: { p: Pelajaran; buka?: () => void }) {
  return (
    <section className={`kaca kaca--pad kartu-pelajaran ${p.lengkap ? 'kartu-pelajaran--lengkap' : ''}`}>
      <div className="baris baris--antara" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <b className="potong" style={{ display: 'block', fontSize: 16 }}>
            {p.mapel}
          </b>
          <span className="redup-2 kecil">
            {p.kelas} · {p.jamMulai.replace(':', '.')}–{p.jamSelesai.replace(':', '.')}
          </span>
        </div>
        {p.lengkap ? (
          <Lencana jenis="ok">
            <CircleCheck /> Lengkap
          </Lencana>
        ) : (
          <Lencana jenis="waspada">Belum lengkap</Lencana>
        )}
      </div>
      <div className="redup kecil">{p.pengajar ?? 'Pengajar belum diatur'}</div>
      <Bilah persen={p.wajib ? (p.terisi / p.wajib) * 100 : 0} jenis={p.lengkap ? 'emas' : 'waspada'} label={`Nilai ${p.mapel} ${p.kelas} terisi`} />
      <div className="baris baris--antara kecil">
        <span className="angka">
          {p.terisi}/{p.wajib} santri dinilai{p.tidakHadir ? ` · ${p.tidakHadir} tidak hadir` : ''}
        </span>
        {!p.absensiTerisi && (
          <Link to={`/admin/absensi?kelas=${p.kelasId}`} className="kecil">
            Absensi belum diisi
          </Link>
        )}
      </div>
      {buka && (
        <Tombol varian={p.lengkap ? undefined : 'utama'} ukuran="kecil" onClick={buka} aria-label={`Isi nilai ${p.mapel} ${p.kelas}`}>
          {p.lengkap ? 'Lihat / ubah nilai' : 'Isi nilai'}
        </Tombol>
      )}
    </section>
  );
}

function IsiNilai({ kelasId, mapelId, tanggal, kembali }: { kelasId: string; mapelId: string; tanggal: string; kembali: () => void }) {
  const toast = useToast();
  const { data, galat, muatUlang } = usePakai<Isi>(`/api/admin/harian/isi?kelas=${kelasId}&mapel=${mapelId}&tanggal=${tanggal}`);
  const [isian, setIsian] = useState<Record<number, string>>({});
  const [semuaNilai, setSemuaNilai] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [berubah, setBerubah] = useState(false);
  useEffect(() => {
    if (!data) return;
    setIsian(Object.fromEntries(data.daftar.map((d) => [d.santriId, d.nilai?.toString() ?? ''])));
    setBerubah(false);
  }, [data]);
  const hadir = useMemo(() => (data?.daftar ?? []).filter((d) => !d.absen || d.absen === 'H'), [data]);
  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!data) return <Memuat baris={6} />;
  const salah = (v: string) => v !== '' && (Number(v) > 100 || !/^\d+$/.test(v));
  const terisi = hadir.filter((d) => isian[d.santriId]).length;

  const simpan = async () => {
    if (data.daftar.some((d) => salah(isian[d.santriId] ?? ''))) {
      toast.tampil('Nilai harus angka 0–100.', 'galat');
      return;
    }
    setSibuk(true);
    try {
      const r = await kirim<{ berubah: number }>('PUT', '/api/admin/harian', {
        kelasId: data.kelas.id,
        mapelId: data.mapel.id,
        tanggal,
        daftar: data.daftar.filter((d) => !d.terkunci).map((d) => ({ santriId: d.santriId, nilai: isian[d.santriId] ? Number(isian[d.santriId]) : null })),
      });
      toast.tampil(r.berubah ? `Nilai ${data.mapel.nama} ${data.kelas.nama} tersimpan. Nilai harian semester ikut diperbarui.` : 'Tidak ada perubahan.');
      muatUlang();
    } catch (e) {
      toast.galat(e);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <>
      <Tombol varian="hantu" ikon={<ArrowLeft />} onClick={kembali} style={{ justifySelf: 'start' }}>
        Semua pelajaran
      </Tombol>
      <section className="kaca">
        <div className="kepala-panel">
          <div>
            <b style={{ fontSize: 18 }}>
              {data.mapel.nama}{' '}
              {data.mapel.namaArab && (
                <span className="arab" style={{ fontSize: 18, color: 'var(--emas-300)' }} lang="ar">
                  {data.mapel.namaArab}
                </span>
              )}
            </b>
            <div className="redup-2 kecil">
              {data.kelas.nama} · {tanggalHari(tanggal)} · {data.mapel.pengajar ?? 'pengajar belum diatur'}
            </div>
          </div>
          <div className="baris baris--bungkus" style={{ gap: 6 }}>
            <input
              className="masukan masukan--kecil angka"
              style={{ width: 76 }}
              inputMode="numeric"
              placeholder="80"
              value={semuaNilai}
              onChange={(e) => setSemuaNilai(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
              aria-label="Nilai untuk semua santri yang hadir"
            />
            <Tombol
              ukuran="kecil"
              ikon={<CheckCheck />}
              disabled={!semuaNilai || salah(semuaNilai)}
              onClick={() => {
                setIsian({ ...isian, ...Object.fromEntries(hadir.filter((d) => !d.terkunci && !isian[d.santriId]).map((d) => [d.santriId, semuaNilai])) });
                setBerubah(true);
              }}
            >
              Isi yang kosong
            </Tombol>
          </div>
        </div>
        <ul className="daftar-absen">
          {data.daftar.map((d, i) => {
            const tidak = d.absen && d.absen !== 'H';
            const v = isian[d.santriId] ?? '';
            return (
              <li key={d.santriId} className={tidak ? 'redup' : ''}>
                <span className="redup-2 angka kecil" style={{ width: 22 }}>
                  {i + 1}
                </span>
                <Avatar nama={d.nama} jk={d.jk} ukuran={36} foto={urlFoto(d.santriId, d.fotoVersi)} />
                <div className="isi-penuh" style={{ display: 'grid', minWidth: 0 }}>
                  <b className="potong">
                    {d.nama} {d.terkunci && <Lock style={{ width: 13, color: 'var(--emas-300)' }} aria-label="Raport sudah terbit" />}
                  </b>
                  <span className="redup-2 kecil">
                    {tidak ? `${STATUS_HADIR[d.absen!]}${d.keterangan ? ` · ${d.keterangan}` : ''}` : d.absen ? 'Hadir' : 'Belum diabsen'}
                    {d.jumlah > 0 && ` · rata-rata ${d.rata} dari ${d.jumlah} pertemuan`}
                  </span>
                </div>
                <input
                  className="masukan masukan--kecil masukan-nilai angka"
                  inputMode="numeric"
                  value={v}
                  disabled={d.terkunci}
                  placeholder={tidak ? '–' : ''}
                  aria-invalid={salah(v) || undefined}
                  aria-label={`Nilai ${d.nama}`}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => {
                    setIsian({ ...isian, [d.santriId]: e.target.value.replace(/[^\d]/g, '').slice(0, 3) });
                    setBerubah(true);
                  }}
                />
              </li>
            );
          })}
        </ul>
        <div className="kaki-simpan">
          <div className="baris baris--bungkus kecil" style={{ gap: 6 }}>
            <Lencana jenis={terisi >= hadir.length && hadir.length ? 'ok' : 'waspada'}>
              {terisi}/{hadir.length} santri hadir dinilai
            </Lencana>
            {berubah && <Lencana jenis="waspada">Belum disimpan</Lencana>}
          </div>
          <Tombol varian="utama" ikon={<Save />} sibuk={sibuk} onClick={simpan}>
            Simpan nilai
          </Tombol>
        </div>
      </section>
    </>
  );
}
