import { useState } from 'react';
import { CalendarRange, CheckCircle2, Clock, Stethoscope, UserCheck, UserX } from 'lucide-react';
import { kirim } from '../../lib/api';
import { usePakai } from '../../lib/pakai';
import { useSesi } from '../../lib/sesi';
import { useToast } from '../../lib/toast';
import { Avatar, Bidang, GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, Modal, Tombol, useJudul } from '../../ui/dasar';
import { bulanIni, hariIni, namaBulan, tanggalHari } from '../../../shared/format';

type Status = 'H' | 'I' | 'S' | 'A';
const NAMA: Record<Status, string> = { H: 'Hadir', I: 'Izin', S: 'Sakit', A: 'Alpa' };
const WARNA: Record<Status, 'ok' | 'info' | 'waspada' | 'bahaya'> = { H: 'ok', I: 'info', S: 'waspada', A: 'bahaya' };

interface Saya {
  tanggal: string;
  jamSekarang: string;
  wajib: boolean;
  mengajar: { kelas: string; mapel: string; jamMulai: string }[];
  jamPertama: string | null;
  status: Status | null;
  jam: string | null;
  terlambat: boolean;
  keterangan: string | null;
}
interface Baris {
  id: number;
  nama: string;
  peran: string;
  mengajar: { kelas: string; mapel: string; jamMulai: string }[];
  jamPertama: string | null;
  wajib: boolean;
  status: Status | null;
  jam: string | null;
  terlambat: boolean;
  keterangan: string | null;
  dicatatOleh: string | null;
}

const jamTeks = (j: string | null) => (j ? j.replace(':', '.') : '');

/** Kartu absen untuk guru: satu ketukan untuk hadir, atau izin/sakit dengan keterangan. */
export function KartuAbsenSaya({ ringkas }: { ringkas?: boolean }) {
  const toast = useToast();
  const { data, muatUlang } = usePakai<Saya>('/api/admin/absen-guru/saya');
  const [izin, setIzin] = useState<'I' | 'S' | null>(null);
  const [ket, setKet] = useState('');
  const [sibuk, setSibuk] = useState(false);
  if (!data) return <div className="kerangka" style={{ height: 120 }} />;
  const absen = async (status: Status, keterangan?: string) => {
    setSibuk(true);
    try {
      await kirim('POST', '/api/admin/absen-guru/saya', { status, keterangan: keterangan ?? null });
      toast.tampil(status === 'H' ? 'Kehadiran tercatat. Selamat mengajar, barakallahu fiikum.' : 'Keterangan tercatat. Semoga Allah memudahkan.');
      setIzin(null);
      setKet('');
      muatUlang();
    } catch (e) {
      toast.galat(e);
    } finally {
      setSibuk(false);
    }
  };
  return (
    <section className={`kaca kaca--pad kartu-absen-saya ${data.status ? '' : 'kaca--emas'}`} aria-labelledby="judul-absen-saya">
      <div className="baris baris--antara baris--bungkus" style={{ gap: 10 }}>
        <div>
          <h2 id="judul-absen-saya" style={{ margin: 0, fontSize: 18 }}>
            Kehadiran saya hari ini
          </h2>
          <div className="redup-2 kecil">
            {tanggalHari(data.tanggal)}
            {data.jamPertama && ` · pelajaran pertama ${jamTeks(data.jamPertama)} WIB`}
          </div>
        </div>
        {data.status ? (
          <Lencana jenis={data.terlambat ? 'waspada' : WARNA[data.status]}>
            <CheckCircle2 /> {NAMA[data.status]}
            {data.jam && ` · ${jamTeks(data.jam)}`}
            {data.terlambat && ' · terlambat'}
          </Lencana>
        ) : (
          <Lencana jenis={data.wajib ? 'waspada' : undefined}>{data.wajib ? 'Belum absen' : 'Tidak ada jadwal mengajar'}</Lencana>
        )}
      </div>
      {!ringkas && data.mengajar.length > 0 && (
        <div className="baris baris--bungkus" style={{ gap: 6 }}>
          {data.mengajar.map((m, i) => (
            <Lencana key={i}>
              {jamTeks(m.jamMulai)} · {m.mapel} · {m.kelas}
            </Lencana>
          ))}
        </div>
      )}
      {!data.status && (
        <div className="baris baris--bungkus" style={{ gap: 8 }}>
          <Tombol varian="utama" ukuran="besar" ikon={<UserCheck />} sibuk={sibuk} onClick={() => absen('H')}>
            Absen hadir · {jamTeks(data.jamSekarang)}
          </Tombol>
          <Tombol ikon={<UserX />} onClick={() => setIzin('I')}>
            Izin
          </Tombol>
          <Tombol ikon={<Stethoscope />} onClick={() => setIzin('S')}>
            Sakit
          </Tombol>
        </div>
      )}
      {data.status && data.keterangan && <div className="redup kecil">Keterangan: {data.keterangan}</div>}
      {izin && (
        <Modal
          judul={izin === 'I' ? 'Izin tidak mengajar' : 'Sakit'}
          sub="Pengurus madrasah akan melihat keterangan ini untuk mengatur pengganti."
          tutup={() => setIzin(null)}
          onSubmit={() => absen(izin, ket)}
          kaki={
            <Tombol type="submit" varian="utama" sibuk={sibuk} disabled={!ket.trim()}>
              Kirim keterangan
            </Tombol>
          }
        >
          <Bidang label="Keterangan" wajib>
            <input className="masukan" value={ket} onChange={(e) => setKet(e.target.value)} placeholder={izin === 'I' ? 'Mis. keperluan keluarga' : 'Mis. demam'} required />
          </Bidang>
        </Modal>
      )}
    </section>
  );
}

export default function AbsenGuru() {
  const { pengurus } = useSesi();
  const admin = pengurus?.peran === 'admin';
  useJudul(admin ? 'Absensi guru' : 'Kehadiran saya');
  const [tab, setTab] = useState<'hari' | 'rekap'>('hari');
  const [tanggal, setTanggal] = useState(hariIni());
  const [bulan, setBulan] = useState(bulanIni());

  if (!admin) {
    return (
      <>
        <KepalaHalaman kecil="Guru" judul="Kehadiran saya" sub="Absen setiap hari mengajar, sebelum pelajaran pertama dimulai. Terlambat bila absen setelah jam pelajaran pertama." />
        <KartuAbsenSaya />
        <RekapBulan bulan={bulan} setBulan={setBulan} hanyaSaya={pengurus?.id} />
      </>
    );
  }
  return (
    <>
      <KepalaHalaman kecil="Kegiatan belajar" judul="Absensi guru" sub="Setiap guru yang mengajar hari itu wajib absen dari akunnya sendiri. Pengurus bisa mencatat atau membetulkan." />
      <div className="saringan">
        <div className="segmen" role="tablist">
          <button role="tab" aria-selected={tab === 'hari'} onClick={() => setTab('hari')}>
            <UserCheck /> Harian
          </button>
          <button role="tab" aria-selected={tab === 'rekap'} onClick={() => setTab('rekap')}>
            <CalendarRange /> Rekap bulanan
          </button>
        </div>
        {tab === 'hari' && <input className="masukan angka" type="date" value={tanggal} max={hariIni()} onChange={(e) => setTanggal(e.target.value || hariIni())} aria-label="Tanggal" />}
      </div>
      {tab === 'hari' ? <DaftarHari tanggal={tanggal} /> : <RekapBulan bulan={bulan} setBulan={setBulan} />}
    </>
  );
}

function DaftarHari({ tanggal }: { tanggal: string }) {
  const toast = useToast();
  const { data, galat, muatUlang } = usePakai<{ daftar: Baris[] }>(`/api/admin/absen-guru?tanggal=${tanggal}`);
  const [ubah, setUbah] = useState<Baris | null>(null);
  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!data) return <Memuat baris={5} />;
  if (!data.daftar.length)
    return (
      <div className="kaca">
        <Kosong ikon={<UserCheck />} judul="Tidak ada guru yang mengajar" pesan={`Tidak ada jadwal pelajaran pada ${tanggalHari(tanggal)}.`} />
      </div>
    );
  const h = (s: Status) => data.daftar.filter((g) => g.status === s).length;
  const belum = data.daftar.filter((g) => !g.status).length;
  return (
    <section className="kaca">
      <div className="kepala-panel">
        <div>
          <b>{tanggalHari(tanggal)}</b>
          <div className="redup-2 kecil">{data.daftar.length} guru wajib absen</div>
        </div>
        <div className="baris baris--bungkus" style={{ gap: 6 }}>
          <Lencana jenis="ok">{h('H')} hadir</Lencana>
          {data.daftar.some((g) => g.terlambat) && <Lencana jenis="waspada">{data.daftar.filter((g) => g.terlambat).length} terlambat</Lencana>}
          <Lencana jenis="info">{h('I') + h('S')} izin/sakit</Lencana>
          {h('A') > 0 && <Lencana jenis="bahaya">{h('A')} alpa</Lencana>}
          {belum > 0 && <Lencana>{belum} belum absen</Lencana>}
        </div>
      </div>
      <ul className="daftar-absen">
        {data.daftar.map((g) => (
          <li key={g.id}>
            <Avatar nama={g.nama} emas={g.peran === 'admin'} ukuran={36} />
            <div className="isi-penuh" style={{ display: 'grid', minWidth: 0 }}>
              <b className="potong">{g.nama}</b>
              <span className="redup-2 kecil potong">
                {g.mengajar.length ? g.mengajar.map((m) => `${jamTeks(m.jamMulai)} ${m.mapel} · ${m.kelas}`).join(', ') : 'Wali kelas'}
              </span>
            </div>
            {g.status ? (
              <Lencana jenis={g.terlambat ? 'waspada' : WARNA[g.status]}>
                {NAMA[g.status]}
                {g.jam && ` ${jamTeks(g.jam)}`}
                {g.terlambat && ' · terlambat'}
              </Lencana>
            ) : (
              <Lencana>
                <Clock /> Belum absen
              </Lencana>
            )}
            <Tombol ukuran="kecil" varian="hantu" onClick={() => setUbah(g)} aria-label={`Catat kehadiran ${g.nama}`}>
              Catat
            </Tombol>
          </li>
        ))}
      </ul>
      {ubah && (
        <CatatGuru
          g={ubah}
          tanggal={tanggal}
          tutup={() => setUbah(null)}
          selesai={() => {
            setUbah(null);
            toast.tampil(`Kehadiran ${ubah.nama} dicatat.`);
            muatUlang();
          }}
        />
      )}
    </section>
  );
}

function CatatGuru({ g, tanggal, tutup, selesai }: { g: Baris; tanggal: string; tutup: () => void; selesai: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>(g.status ?? 'H');
  const [ket, setKet] = useState(g.keterangan ?? '');
  const [sibuk, setSibuk] = useState(false);
  const simpan = async () => {
    setSibuk(true);
    try {
      await kirim('PUT', `/api/admin/absen-guru/${g.id}`, { tanggal, status, keterangan: ket || null });
      selesai();
    } catch (e) {
      toast.galat(e);
      setSibuk(false);
    }
  };
  return (
    <Modal
      judul={`Kehadiran ${g.nama}`}
      sub={tanggalHari(tanggal)}
      tutup={tutup}
      onSubmit={simpan}
      kaki={
        <Tombol type="submit" varian="utama" sibuk={sibuk}>
          Simpan
        </Tombol>
      }
    >
      <div className="tumpuk">
        <Bidang label="Status" grup>
          <div className="segmen" role="radiogroup" style={{ width: '100%' }}>
            {(Object.keys(NAMA) as Status[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setStatus(s)} style={{ flex: 1, justifyContent: 'center' }}>
                {NAMA[s]}
              </button>
            ))}
          </div>
        </Bidang>
        <Bidang label="Keterangan">
          <input className="masukan" value={ket} onChange={(e) => setKet(e.target.value)} placeholder="Mis. digantikan Ust. …" />
        </Bidang>
      </div>
    </Modal>
  );
}

function RekapBulan({ bulan, setBulan, hanyaSaya }: { bulan: string; setBulan: (b: string) => void; hanyaSaya?: number }) {
  const { data, galat, muatUlang } = usePakai<{ daftar: { id: number; nama: string; H: number; I: number; S: number; A: number; terlambat: number }[] }>(`/api/admin/absen-guru/rekap?bulan=${bulan}`);
  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  const daftar = (data?.daftar ?? []).filter((r) => (hanyaSaya ? r.id === hanyaSaya : r.H + r.I + r.S + r.A > 0));
  return (
    <section className="kaca">
      <div className="kepala-panel">
        <div>
          <b>Rekap {namaBulan(bulan)}</b>
          <div className="redup-2 kecil">Hadir, terlambat, izin, sakit, dan alpa</div>
        </div>
        <input className="masukan masukan--kecil angka" style={{ width: 'auto' }} type="month" value={bulan} max={bulanIni()} onChange={(e) => setBulan(e.target.value || bulanIni())} aria-label="Bulan" />
      </div>
      {!data ? (
        <div style={{ padding: 16 }}>
          <Memuat baris={4} />
        </div>
      ) : !daftar.length ? (
        <Kosong judul="Belum ada catatan bulan ini" />
      ) : (
        <div className="tabel-bungkus">
          <table className="tabel">
            <thead>
              <tr>
                <th>Guru</th>
                <th className="tengah">Hadir</th>
                <th className="tengah">Terlambat</th>
                <th className="tengah">Izin</th>
                <th className="tengah">Sakit</th>
                <th className="tengah">Alpa</th>
                <th className="kanan">Kehadiran</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((r) => {
                const total = r.H + r.I + r.S + r.A;
                return (
                  <tr key={r.id}>
                    <td>
                      <b>{r.nama}</b>
                    </td>
                    <td className="tengah angka">{r.H}</td>
                    <td className="tengah angka">{r.terlambat}</td>
                    <td className="tengah angka">{r.I}</td>
                    <td className="tengah angka">{r.S}</td>
                    <td className="tengah angka">{r.A}</td>
                    <td className="kanan angka tebal">{total ? Math.round((r.H / total) * 100) : 0}%</td>
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
