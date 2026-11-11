import { useEffect, useState } from 'react';
import { CalendarRange, CheckCircle2, History, IdCard, KeyRound, Landmark, Plus, RotateCcw, Save, ShieldCheck, UserPlus } from 'lucide-react';
import { kirim } from '../../lib/api';
import { useKirim, usePakai } from '../../lib/pakai';
import { useSesi } from '../../lib/sesi';
import { useToast } from '../../lib/toast';
import type { Periode } from '../../lib/tipe';
import { Avatar, Bidang, GalatMuat, KepalaHalaman, Lencana, Memuat, Modal, Pesan, Sakelar, Tombol, useIngat, useJudul, useKonfirmasi } from '../../ui/dasar';
import { PERAN_PENGURUS, type PeranPengurus } from '../../../shared/konstanta';
import { namaSemester, tanggalPendek, waktu } from '../../../shared/format';
import { uraiAturan } from '../../../shared/aturan';
import { Belakang } from '../../ui/KartuSantri';

interface DataPengaturan {
  pengaturan: {
    namaLembaga: string;
    namaArab: string;
    singkatan: string;
    naungan: string;
    slogan: string;
    alamat: string;
    kota: string;
    telepon: string;
    kepala: string;
    bobot: { harian: number; uts: number; uas: number };
    syahriahNominal: number;
    tampilPeringkat: boolean;
    tataTertib: string;
    kartuBerlaku: string;
  };
  lengkapi: { kunci: string; label: string }[];
}
interface AkunPengurus {
  id: number;
  nama: string;
  username: string;
  peran: PeranPengurus;
  hp: string | null;
  aktif: number;
  masukTerakhir: string | null;
}

type Tab = 'madrasah' | 'semester' | 'kartu' | 'akun' | 'riwayat';

export default function Pengaturan() {
  useJudul('Pengaturan');
  const { pengurus } = useSesi();
  const admin = pengurus?.peran === 'admin';
  const [tab, setTab] = useIngat<Tab>('tab-pengaturan', 'madrasah');
  const tabAman = !admin && (tab === 'akun' || tab === 'riwayat') ? 'madrasah' : tab;
  return (
    <>
      <KepalaHalaman kecil="Madrasah" judul="Pengaturan" sub={admin ? 'Identitas madrasah di kop raport, semester, cara menghitung nilai, dan akun pengurus.' : 'Hanya administrator yang bisa mengubah pengaturan.'} />
      <div className="segmen" role="tablist">
        <button role="tab" aria-selected={tabAman === 'madrasah'} onClick={() => setTab('madrasah')}>
          <Landmark /> Madrasah & nilai
        </button>
        <button role="tab" aria-selected={tabAman === 'semester'} onClick={() => setTab('semester')}>
          <CalendarRange /> Tahun ajaran
        </button>
        <button role="tab" aria-selected={tabAman === 'kartu'} onClick={() => setTab('kartu')}>
          <IdCard /> Kartu santri
        </button>
        {admin && (
          <button role="tab" aria-selected={tabAman === 'akun'} onClick={() => setTab('akun')}>
            <ShieldCheck /> Akun pengurus
          </button>
        )}
        {admin && (
          <button role="tab" aria-selected={tabAman === 'riwayat'} onClick={() => setTab('riwayat')}>
            <History /> Riwayat
          </button>
        )}
      </div>
      {tabAman === 'madrasah' && <TabMadrasah admin={admin} />}
      {tabAman === 'semester' && <TabSemester admin={admin} />}
      {tabAman === 'kartu' && <TabKartu admin={admin} />}
      {tabAman === 'akun' && <TabAkun />}
      {tabAman === 'riwayat' && <TabRiwayat />}
    </>
  );
}

function TabMadrasah({ admin }: { admin: boolean }) {
  const toast = useToast();
  const { muatUlang: muatSesi } = useSesi();
  const { data, galat, muatUlang } = usePakai<DataPengaturan>('/api/admin/pengaturan');
  const { sibuk, bidang, jalankan } = useKirim();
  const [f, setF] = useState<DataPengaturan['pengaturan'] | null>(null);
  useEffect(() => {
    if (data) setF(data.pengaturan);
  }, [data]);
  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!data || !f) return <Memuat baris={4} tinggi={80} />;
  const totalBobot = f.bobot.harian + f.bobot.uts + f.bobot.uas;
  const teks = (k: keyof DataPengaturan['pengaturan']) => ({ value: String(f[k] ?? ''), onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });
  const simpan = () =>
    jalankan(async () => {
      await kirim('PUT', '/api/admin/pengaturan', f);
      toast.tampil('Pengaturan disimpan.');
      muatUlang();
      muatSesi();
    }).catch(toast.galat);

  return (
    <form
      className="tumpuk tumpuk--lebar"
      onSubmit={(e) => {
        e.preventDefault();
        simpan();
      }}
    >
      {data.lengkapi.length > 0 && (
        <Pesan jenis="waspada" judul="Lengkapi sebelum raport diterbitkan">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {data.lengkapi.map((l) => (
              <li key={l.kunci}>{l.label}</li>
            ))}
          </ul>
        </Pesan>
      )}
      <fieldset disabled={!admin} className="grid-2" style={{ border: 0, padding: 0, margin: 0, alignItems: 'start' }}>
        <section className="kaca kaca--pad tumpuk">
          <div className="kartu-judul" style={{ marginBottom: 0 }}>
            <h2>Identitas madrasah</h2>
          </div>
          <Bidang label="Nama madrasah" wajib galat={bidang.namaLembaga}>
            <input className="masukan" {...teks('namaLembaga')} />
          </Bidang>
          <Bidang label="Nama dalam huruf Arab" galat={bidang.namaArab}>
            <input className="masukan arab" dir="rtl" style={{ fontSize: 20 }} {...teks('namaArab')} />
          </Bidang>
          <div className="grid-2">
            <Bidang label="Nama singkat" wajib galat={bidang.singkatan}>
              <input className="masukan" {...teks('singkatan')} />
            </Bidang>
            <Bidang label="Telepon" galat={bidang.telepon}>
              <input className="masukan angka" {...teks('telepon')} />
            </Bidang>
          </div>
          <div className="grid-2">
            <Bidang label="Lembaga induk" galat={bidang.naungan} bantu="Tampil di kop raport.">
              <input className="masukan" {...teks('naungan')} />
            </Bidang>
            <Bidang label="Semboyan" galat={bidang.slogan}>
              <input className="masukan" {...teks('slogan')} />
            </Bidang>
          </div>
          <Bidang label="Alamat" galat={bidang.alamat} bantu="Tampil di kop raport.">
            <textarea className="masukan" rows={2} {...teks('alamat')} />
          </Bidang>
          <div className="grid-2">
            <Bidang label="Kota penandatanganan" galat={bidang.kota}>
              <input className="masukan" {...teks('kota')} placeholder="Mis. Bangil" />
            </Bidang>
            <Bidang label="Kepala madrasah" galat={bidang.kepala}>
              <input className="masukan" {...teks('kepala')} />
            </Bidang>
          </div>
        </section>

        <div className="tumpuk">
          <section className="kaca kaca--pad tumpuk">
            <div className="kartu-judul" style={{ marginBottom: 0 }}>
              <h2>Bobot nilai akhir</h2>
              <Lencana jenis={totalBobot === 100 ? 'ok' : 'bahaya'}>Jumlah {totalBobot}%</Lencana>
            </div>
            <p className="redup kecil">Nilai akhir = rata-rata berbobot. Isi 0 untuk komponen yang tidak dipakai; misalnya UAS 100% bila madrasah hanya memakai satu nilai.</p>
            <div className="grid-3">
              {(
                [
                  ['harian', 'Harian'],
                  ['uts', 'UTS'],
                  ['uas', 'UAS'],
                ] as const
              ).map(([k, l]) => (
                <Bidang key={k} label={`${l} (%)`}>
                  <input
                    className="masukan angka"
                    inputMode="numeric"
                    value={f.bobot[k]}
                    onChange={(e) => setF({ ...f, bobot: { ...f.bobot, [k]: Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 0 } })}
                  />
                </Bidang>
              ))}
            </div>
            {bidang.bobot && <span className="bidang__galat">{bidang.bobot}</span>}
            <div className="baris panel" style={{ padding: '12px 14px' }}>
              <div className="isi-penuh">
                <b>Tampilkan peringkat kelas</b>
                <div className="redup-2 kecil">Peringkat tampil di raport dan aplikasi wali.</div>
              </div>
              <Sakelar nyala={f.tampilPeringkat} ubah={(v) => setF({ ...f, tampilPeringkat: v })} label="Tampilkan peringkat" />
            </div>
          </section>
          <section className="kaca kaca--pad tumpuk">
            <div className="kartu-judul" style={{ marginBottom: 0 }}>
              <h2>Syahriah</h2>
            </div>
            <Bidang label="Iuran per bulan (Rp)" bantu="Isian awal saat mencatat pembayaran.">
              <input className="masukan angka" inputMode="numeric" value={f.syahriahNominal} onChange={(e) => setF({ ...f, syahriahNominal: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
            </Bidang>
          </section>
        </div>
      </fieldset>
      {admin && (
        <div>
          <Tombol type="submit" varian="utama" ukuran="besar" ikon={<Save />} sibuk={sibuk} disabled={totalBobot !== 100}>
            Simpan pengaturan
          </Tombol>
        </div>
      )}
    </form>
  );
}

function TabSemester({ admin }: { admin: boolean }) {
  const toast = useToast();
  const tanya = useKonfirmasi();
  const { data, galat, muatUlang } = usePakai<{ daftar: Periode[] }>('/api/admin/periode');
  const [form, setForm] = useState<Periode | 'baru' | null>(null);
  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!data) return <Memuat />;
  const aktifkan = async (p: Periode) => {
    if (!(await tanya({ judul: `Aktifkan semester ${namaSemester(p.semester)} ${p.tahunAjaran}?`, pesan: 'Absensi, nilai, raport, dan aplikasi wali akan memakai semester ini sebagai semester berjalan.', ya: 'Aktifkan' }))) return;
    try {
      await kirim('POST', `/api/admin/periode/${p.id}/aktifkan`);
      toast.tampil('Semester aktif diganti.');
      muatUlang();
    } catch (e) {
      toast.galat(e);
    }
  };
  return (
    <section className="kaca">
      <div className="kepala-panel">
        <div>
          <b>Tahun ajaran & semester</b>
          <div className="redup-2 kecil">Rentang tanggal semester dipakai untuk rekap kehadiran dan hafalan di raport.</div>
        </div>
        {admin && (
          <Tombol varian="utama" ukuran="kecil" ikon={<Plus />} onClick={() => setForm('baru')}>
            Semester baru
          </Tombol>
        )}
      </div>
      <div className="tabel-bungkus">
        <table className="tabel">
          <thead>
            <tr>
              <th>Semester</th>
              <th>Rentang</th>
              <th>Pembagian raport</th>
              <th className="tengah">Raport terbit</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.daftar.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="baris">
                    <b>
                      {namaSemester(p.semester)} {p.tahunAjaran}
                    </b>
                    {!!p.aktif && (
                      <Lencana jenis="ok">
                        <CheckCircle2 /> Aktif
                      </Lencana>
                    )}
                  </div>
                </td>
                <td className="redup angka nowrap">
                  {tanggalPendek(p.mulai)} – {tanggalPendek(p.selesai)}
                </td>
                <td className="redup angka">{tanggalPendek(p.tanggalRaport)}</td>
                <td className="tengah angka">{p.raportTerbit}</td>
                <td className="kanan nowrap">
                  {admin && (
                    <>
                      {!p.aktif && (
                        <Tombol ukuran="kecil" varian="hantu" onClick={() => aktifkan(p)}>
                          Aktifkan
                        </Tombol>
                      )}
                      <Tombol ukuran="kecil" varian="hantu" onClick={() => setForm(p)}>
                        Ubah
                      </Tombol>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && (
        <FormPeriode
          p={form === 'baru' ? undefined : form}
          tutup={() => setForm(null)}
          selesai={() => {
            setForm(null);
            muatUlang();
          }}
        />
      )}
    </section>
  );
}

function FormPeriode({ p, tutup, selesai }: { p?: Periode; tutup: () => void; selesai: () => void }) {
  const toast = useToast();
  const { sibuk, bidang, jalankan } = useKirim();
  const tahun = new Date().getFullYear();
  const [f, setF] = useState({
    tahunAjaran: p?.tahunAjaran ?? `${tahun}/${tahun + 1}`,
    semester: p?.semester ?? 1,
    mulai: p?.mulai ?? `${tahun}-07-13`,
    selesai: p?.selesai ?? `${tahun}-12-19`,
    tanggalRaport: p?.tanggalRaport ?? '',
  });
  const simpan = () =>
    jalankan(async () => {
      if (p) await kirim('PUT', `/api/admin/periode/${p.id}`, f);
      else await kirim('POST', '/api/admin/periode', f);
      toast.tampil('Semester disimpan.');
      selesai();
    }).catch(toast.galat);
  return (
    <Modal
      judul={p ? 'Ubah semester' : 'Semester baru'}
      tutup={tutup}
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" varian="utama" sibuk={sibuk} ikon={<Save />}>
            Simpan
          </Tombol>
        </>
      }
    >
      <div className="grid-2">
        <Bidang label="Tahun ajaran" wajib galat={bidang.tahunAjaran}>
          <input className="masukan angka" value={f.tahunAjaran} onChange={(e) => setF({ ...f, tahunAjaran: e.target.value })} placeholder="2026/2027" />
        </Bidang>
        <Bidang label="Semester" wajib>
          <select className="masukan" value={f.semester} onChange={(e) => setF({ ...f, semester: Number(e.target.value) as 1 | 2 })}>
            <option value={1}>1 (Ganjil)</option>
            <option value={2}>2 (Genap)</option>
          </select>
        </Bidang>
        <Bidang label="Mulai" wajib galat={bidang.mulai}>
          <input className="masukan" type="date" value={f.mulai} onChange={(e) => setF({ ...f, mulai: e.target.value })} />
        </Bidang>
        <Bidang label="Selesai" wajib galat={bidang.selesai}>
          <input className="masukan" type="date" value={f.selesai} onChange={(e) => setF({ ...f, selesai: e.target.value })} />
        </Bidang>
        <Bidang label="Tanggal pembagian raport" galat={bidang.tanggalRaport} bantu="Tanggal yang tertulis di atas tanda tangan raport." className="bentang-2">
          <input className="masukan" type="date" value={f.tanggalRaport} onChange={(e) => setF({ ...f, tanggalRaport: e.target.value })} />
        </Bidang>
      </div>
    </Modal>
  );
}

function TabAkun() {
  const toast = useToast();
  const tanya = useKonfirmasi();
  const { pengurus } = useSesi();
  const { data, galat, muatUlang } = usePakai<{ daftar: AkunPengurus[] }>('/api/admin/pengurus');
  const [form, setForm] = useState<AkunPengurus | 'baru' | null>(null);
  const [sandi, setSandi] = useState<{ username: string; sandi: string } | null>(null);
  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!data) return <Memuat />;
  const reset = async (a: AkunPengurus) => {
    if (!(await tanya({ judul: `Buat sandi baru untuk ${a.nama}?`, pesan: 'Sandi lama tidak berlaku dan akun ini keluar dari semua perangkat.', ya: 'Buat sandi baru' }))) return;
    try {
      setSandi(await kirim('POST', `/api/admin/pengurus/${a.id}/sandi`));
    } catch (e) {
      toast.galat(e);
    }
  };
  return (
    <section className="kaca">
      <div className="kepala-panel">
        <div>
          <b>Akun pengurus</b>
          <div className="redup-2 kecil">Administrator mengelola semua data. Ustadz/ustadzah mengisi absensi, nilai, hafalan, dan isian raport.</div>
        </div>
        <Tombol varian="utama" ukuran="kecil" ikon={<UserPlus />} onClick={() => setForm('baru')}>
          Tambah akun
        </Tombol>
      </div>
      <div className="tabel-bungkus">
        <table className="tabel tabel--responsif">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Peran</th>
              <th>Terakhir masuk</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.daftar.map((a) => (
              <tr key={a.id} style={{ opacity: a.aktif ? 1 : 0.55 }}>
                <td data-sel="utama">
                  <div className="baris">
                    <Avatar nama={a.nama} emas={a.peran === 'admin'} ukuran={36} />
                    <div style={{ display: 'grid' }}>
                      <b>
                        {a.nama} {a.id === pengurus?.id && <span className="redup-2 kecil">(Anda)</span>}
                      </b>
                      <span className="redup-2 kecil">@{a.username}</span>
                    </div>
                  </div>
                </td>
                <td data-label="Peran">
                  <Lencana jenis={a.peran === 'admin' ? 'emas' : 'info'}>{PERAN_PENGURUS[a.peran]}</Lencana> {!a.aktif && <Lencana>Nonaktif</Lencana>}
                </td>
                <td className="redup kecil" data-label="Terakhir masuk">
                  {a.masukTerakhir ? waktu(a.masukTerakhir) : 'Belum pernah'}
                </td>
                <td className="kanan nowrap">
                  {a.id !== pengurus?.id && (
                    <Tombol ukuran="kecil" varian="hantu" ikon={<KeyRound />} onClick={() => reset(a)}>
                      Sandi baru
                    </Tombol>
                  )}
                  <Tombol ukuran="kecil" varian="hantu" onClick={() => setForm(a)}>
                    Ubah
                  </Tombol>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && (
        <FormAkun
          a={form === 'baru' ? undefined : form}
          tutup={() => setForm(null)}
          selesai={(s) => {
            setForm(null);
            muatUlang();
            if (s) setSandi(s);
          }}
        />
      )}
      {sandi && (
        <Modal judul="Sandi akun pengurus" tutup={() => setSandi(null)} kaki={<Tombol onClick={() => setSandi(null)}>Selesai</Tombol>}>
          <div className="tumpuk">
            <div className="kartu-sandi">
              <div>
                <div className="mikro redup-2">Nama pengguna</div>
                <div className="kartu-sandi__nilai">{sandi.username}</div>
              </div>
              <div>
                <div className="mikro redup-2">Sandi</div>
                <div className="kartu-sandi__nilai">{sandi.sandi}</div>
              </div>
            </div>
            <Pesan jenis="waspada">Sandi ini hanya ditampilkan sekali. Minta pemilik akun menggantinya setelah masuk.</Pesan>
          </div>
        </Modal>
      )}
    </section>
  );
}

function FormAkun({ a, tutup, selesai }: { a?: AkunPengurus; tutup: () => void; selesai: (s?: { username: string; sandi: string }) => void }) {
  const toast = useToast();
  const { sibuk, bidang, jalankan } = useKirim();
  const [f, setF] = useState({ nama: a?.nama ?? '', username: a?.username ?? '', peran: a?.peran ?? 'ustadz', hp: a?.hp ?? '', aktif: a ? !!a.aktif : true });
  const simpan = () =>
    jalankan(async () => {
      if (a) {
        await kirim('PUT', `/api/admin/pengurus/${a.id}`, f);
        toast.tampil('Akun diperbarui.');
        selesai();
      } else {
        const r = await kirim<{ username: string; sandi: string }>('POST', '/api/admin/pengurus', f);
        toast.tampil('Akun dibuat.');
        selesai(r);
      }
    }).catch(toast.galat);
  return (
    <Modal
      judul={a ? `Ubah akun ${a.nama}` : 'Tambah akun pengurus'}
      sub={a ? undefined : 'Sandi awal dibuat otomatis dan ditampilkan sekali.'}
      tutup={tutup}
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" varian="utama" sibuk={sibuk} ikon={<Save />}>
            Simpan
          </Tombol>
        </>
      }
    >
      <div className="grid-2">
        <Bidang label="Nama" wajib galat={bidang.nama} className="bentang-2">
          <input className="masukan" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} placeholder="Ust. …" required />
        </Bidang>
        <Bidang label="Nama pengguna" wajib galat={bidang.username}>
          <input className="masukan" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoCapitalize="none" required />
        </Bidang>
        <Bidang label="Peran" wajib>
          <select className="masukan" value={f.peran} onChange={(e) => setF({ ...f, peran: e.target.value as PeranPengurus })}>
            {Object.entries(PERAN_PENGURUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Bidang>
        <Bidang label="Nomor HP" galat={bidang.hp}>
          <input className="masukan angka" value={f.hp} onChange={(e) => setF({ ...f, hp: e.target.value })} />
        </Bidang>
        {a && (
          <div className="baris panel" style={{ padding: '12px 14px', alignSelf: 'end' }}>
            <span className="isi-penuh">Akun aktif</span>
            <Sakelar nyala={f.aktif} ubah={(v) => setF({ ...f, aktif: v })} label="Akun aktif" />
          </div>
        )}
      </div>
    </Modal>
  );
}

function TabRiwayat() {
  const { data, galat, muatUlang } = usePakai<{ daftar: { id: number; waktu: string; pelaku: string; aksi: string; detail: string | null }[] }>('/api/admin/log');
  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!data) return <Memuat />;
  return (
    <section className="kaca kaca--pad">
      <ol className="linimasa">
        {data.daftar.map((a) => (
          <li key={a.id}>
            <span className="linimasa__titik" />
            <div className="isi-penuh">
              <div>
                <b>{a.pelaku}</b> <span className="redup">{a.aksi.charAt(0).toLowerCase() + a.aksi.slice(1)}</span>
                {a.detail && <span className="redup-2"> — {a.detail}</span>}
              </div>
              <div className="redup-2 kecil">{waktu(a.waktu)} WIB</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Sisi belakang kartu santri: tata tertib yang bisa ditulis ulang madrasah, dengan pratinjau langsung. */
function TabKartu({ admin }: { admin: boolean }) {
  const toast = useToast();
  const { lembaga } = useSesi();
  const { data, galat, muatUlang } = usePakai<DataPengaturan & { tataTertibAwal?: string }>('/api/admin/pengaturan');
  const { sibuk, bidang, jalankan } = useKirim();
  const [f, setF] = useState<{ tataTertib: string; kartuBerlaku: string } | null>(null);
  useEffect(() => {
    if (data && !f) setF({ tataTertib: data.pengaturan.tataTertib, kartuBerlaku: data.pengaturan.kartuBerlaku });
  }, [data, f]);
  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!f) return <Memuat baris={3} tinggi={120} />;
  const aturan = uraiAturan(f.tataTertib);
  const jumlah = aturan.reduce((n, b) => n + b.butir.length, 0);
  const simpan = () =>
    jalankan(async () => {
      await kirim('PUT', '/api/admin/pengaturan/kartu', f);
      toast.tampil('Tata tertib kartu santri disimpan.');
      muatUlang();
    }).catch(toast.galat);
  return (
    <div className="grid-kartu-atur">
      <section className="kaca kaca--pad tumpuk">
        <div className="kartu-judul" style={{ marginBottom: 0 }}>
          <h2>Tata tertib di balik kartu</h2>
          <Lencana jenis={jumlah > 14 ? 'waspada' : 'info'}>{jumlah} butir</Lencana>
        </div>
        <Pesan judul="Masih draf">
          Isi di bawah adalah contoh dari aplikasi. Ganti dengan tata tertib resmi dari madrasah; kartu semua santri ikut berubah begitu disimpan.
        </Pesan>
        <Bidang
          label="Tata tertib"
          galat={bidang.tataTertib}
          bantu="Satu butir per baris. Baris yang diakhiri titik dua (mis. Larangan:) menjadi judul bagian. Paling enak dibaca 8–12 butir."
        >
          <textarea className="masukan" rows={16} value={f.tataTertib} onChange={(e) => setF({ ...f, tataTertib: e.target.value })} disabled={!admin} spellCheck />
        </Bidang>
        <Bidang label="Masa berlaku kartu" galat={bidang.kartuBerlaku}>
          <input className="masukan" value={f.kartuBerlaku} onChange={(e) => setF({ ...f, kartuBerlaku: e.target.value })} disabled={!admin} />
        </Bidang>
        {admin && (
          <div className="baris baris--bungkus" style={{ gap: 8 }}>
            <Tombol varian="utama" ikon={<Save />} sibuk={sibuk} onClick={simpan}>
              Simpan
            </Tombol>
            <Tombol varian="hantu" ikon={<RotateCcw />} onClick={() => setF({ tataTertib: data!.pengaturan.tataTertib, kartuBerlaku: data!.pengaturan.kartuBerlaku })}>
              Batalkan perubahan
            </Tombol>
          </div>
        )}
      </section>
      <section className="kaca kaca--pad tumpuk pratinjau-kartu">
        <div className="kartu-judul" style={{ marginBottom: 0 }}>
          <h2>Pratinjau</h2>
          <span className="redup-2 kecil">Sisi belakang</span>
        </div>
        <div className="pratinjau-kartu__wadah">
          <div className="kartu">
            <Belakang d={{ aturan, lembaga }} />
          </div>
        </div>
        {jumlah > 14 && <span className="kecil" style={{ color: 'var(--waspada, #f5c66b)' }}>Butir terlalu banyak: sebagian bisa terpotong saat dicetak. Ringkas menjadi 12 butir atau kurang.</span>}
      </section>
    </div>
  );
}
