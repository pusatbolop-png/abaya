import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { useData } from '../../lib/data';
import { useInfo, useSesi, useToast } from '../../lib/konteks';
import { Bidang, GalatMuat, KepalaHalaman, Lembar, Masukan, Memuat, Pemberitahuan, Pilihan, Status, Tombol, useKirim } from '../../ui/dasar';
import { Ikon } from '../../ui/Ikon';
import { tanggal } from '../../../shared/format';
import { JENIS_RUANGAN, PERAN, RUANG_SIARAN, SISI_PINTU, type JenisRuangan, type Peran } from '../../../shared/konstanta';

interface Ruang {
  id: number;
  kode: string;
  nama: string;
  jenis: JenisRuangan;
  lantai: number;
  x: number;
  z: number;
  lebar: number;
  panjang: number;
  kapasitas: number | null;
  sisiPintu: keyof typeof SISI_PINTU;
}
interface DataPengaturan {
  organisasi: { nama: string; singkat: string; naungan: string; alamat: string; whatsapp: string; email: string; jamLayanan: string };
  instansi: { kunci: string; instansi: string; dokumen: string; wajib: boolean }[];
  logo: string;
  logoBawaan: boolean;
  denahTerkonfirmasi: boolean;
  ruangan: Ruang[];
  pelat: { lebar: number; panjang: number; pintuMasuk: { x: number; lebar: number } };
}

const BAGIAN = [
  ['lembaga', 'Lembaga'],
  ['perizinan', 'Instansi perizinan'],
  ['ruangan', 'Ruangan'],
  ['pengguna', 'Pengguna'],
  ['akun', 'Akun saya'],
] as const;

export function Pengaturan() {
  const { pengguna } = useSesi();
  const admin = pengguna?.peran === 'admin';
  const [cari, setCari] = useSearchParams();
  const r = useData<DataPengaturan>(admin ? '/api/pengaturan' : null);
  const bagian = admin ? (cari.get('bagian') ?? 'lembaga') : 'akun';

  if (!admin) {
    return (
      <>
        <KepalaHalaman judul="Pengaturan" keterangan="Pengaturan lembaga dikelola administrator. Di sini Anda bisa mengganti kata sandi." />
        <AkunSaya />
      </>
    );
  }

  const d = r.data;
  const kurang = d
    ? [
        !d.organisasi.whatsapp && { label: 'Nomor WhatsApp resmi', ke: 'lembaga' },
        d.instansi.some((i) => !i.instansi) && { label: `Nama instansi perizinan (${d.instansi.filter((i) => !i.instansi).length} belum diisi)`, ke: 'perizinan' },
        !d.denahTerkonfirmasi && { label: 'Ukuran ruangan sesuai gambar kerja gedung', ke: 'ruangan' },
        !d.organisasi.alamat && { label: 'Alamat gedung', ke: 'lembaga' },
      ].filter(Boolean)
    : [];

  return (
    <>
      <KepalaHalaman judul="Pengaturan" keterangan="Profil lembaga, instansi perizinan, denah ruangan, dan akun pengguna." />
      {kurang.length > 0 && (
        <section className="kelengkapan" aria-labelledby="judul-lengkap">
          <h2 id="judul-lengkap">Lengkapi sebelum diluncurkan</h2>
          <p className="redup kecil">Data berikut tampil di halaman publik dan denah 3D. Isi dengan data resmi.</p>
          <ul>
            {(kurang as { label: string; ke: string }[]).map((k) => (
              <li key={k.label}>
                <span className="lingkar" aria-hidden="true" />
                <span>{k.label}</span>
                <button type="button" className="tautan-teks" onClick={() => setCari({ bagian: k.ke }, { replace: true })}>
                  Isi sekarang
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="bilah-saring">
        <div className="segmen" role="tablist" aria-label="Bagian pengaturan">
          {BAGIAN.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={bagian === k} onClick={() => setCari({ bagian: k }, { replace: true })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {r.galat && !d && <GalatMuat galat={r.galat} ulang={r.muatUlang} />}
      {!d && !r.galat && bagian !== 'akun' && bagian !== 'pengguna' && <Memuat />}
      <div className="isi-pengaturan">
        {d && bagian === 'lembaga' && <Lembaga d={d} selesai={r.muatUlang} />}
        {d && bagian === 'perizinan' && <Perizinan d={d} selesai={r.muatUlang} />}
        {d && bagian === 'ruangan' && <Ruangan d={d} selesai={r.muatUlang} />}
        {bagian === 'pengguna' && <Pengguna />}
        {bagian === 'akun' && <AkunSaya />}
      </div>
    </>
  );
}

function Lembaga({ d, selesai }: { d: DataPengaturan; selesai: () => Promise<void> }) {
  const toast = useToast();
  const { muatUlang } = useInfo();
  const [o, setO] = useState(d.organisasi);
  const { sibuk, galat, bidang, kirim } = useKirim();
  const logo = useKirim();
  const p = (k: keyof typeof o) => ({ value: o[k] ?? '', onChange: (e: { target: { value: string } }) => setO((x) => ({ ...x, [k]: e.target.value })) });

  const simpan = async () => {
    const ok = await kirim(() => api('PUT', '/api/pengaturan/organisasi', o));
    if (ok) {
      toast('Profil lembaga tersimpan.');
      await Promise.all([selesai(), muatUlang()]);
    }
  };
  const unggahLogo = async (f: File) => {
    const fd = new FormData();
    fd.append('logo', f);
    const ok = await logo.kirim(() => api('POST', '/api/pengaturan/logo', fd));
    if (ok) {
      toast('Logo tersimpan dan langsung dipakai di seluruh halaman.');
      await Promise.all([selesai(), muatUlang()]);
    }
  };
  const hapusLogo = async () => {
    const ok = await logo.kirim(() => api('DELETE', '/api/pengaturan/logo'));
    if (ok) {
      toast('Logo unggahan dihapus. Lambang resmi PCC dipakai kembali.');
      await Promise.all([selesai(), muatUlang()]);
    }
  };

  return (
    <div className="dua-kolom lebar-kiri">
      <form
        className="bagian"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void simpan();
        }}
      >
        <h2>Profil lembaga</h2>
        {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
        <div className="kisi-isian">
          <Bidang label="Nama lembaga" galat={bidang.nama} className="penuh">
            {(a) => <Masukan {...a} {...p('nama')} />}
          </Bidang>
          <Bidang label="Singkatan" galat={bidang.singkat} petunjuk="Dipakai sebagai tanda bila logo belum ada.">
            {(a) => <Masukan {...a} {...p('singkat')} maxLength={12} />}
          </Bidang>
          <Bidang label="Pemerintah daerah penaung">
            {(a) => <Masukan {...a} {...p('naungan')} />}
          </Bidang>
          <Bidang label="Alamat gedung" className="penuh">
            {(a) => <Masukan {...a} {...p('alamat')} autoComplete="street-address" />}
          </Bidang>
          <Bidang label="Nomor WhatsApp resmi" galat={bidang.whatsapp} petunjuk="Tampil di halaman publik dan dipakai pendaftar untuk bertanya.">
            {(a) => <Masukan {...a} {...p('whatsapp')} inputMode="tel" placeholder="0812 3456 7890" />}
          </Bidang>
          <Bidang label="Email resmi" galat={bidang.email} opsional>
            {(a) => <Masukan {...a} {...p('email')} type="email" />}
          </Bidang>
          <Bidang label="Jam layanan" className="penuh">
            {(a) => <Masukan {...a} {...p('jamLayanan')} />}
          </Bidang>
        </div>
        <div>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            Simpan profil lembaga
          </Tombol>
        </div>
      </form>
      <section className="bagian">
        <h2>Logo</h2>
        {logo.galat && <Pemberitahuan nada="galat">{logo.galat}</Pemberitahuan>}
        <div className="pratinjau-logo">
          <img src={d.logo} alt={`Logo ${d.organisasi.nama}`} />
        </div>
        <p className="redup kecil">
          {d.logoBawaan
            ? 'Lambang resmi PCC sudah terpasang. Ganti bila tersedia berkas beresolusi lebih tinggi: SVG atau PNG berlatar transparan, paling besar 5 MB.'
            : 'Logo unggahan dipakai di kepala halaman. Hapus untuk kembali ke lambang resmi PCC bawaan.'}
        </p>
        <div className="deret-tombol">
          <label className="tombol tombol-kedua tombol-kecil">
            <Ikon nama="unggah" />
            Ganti logo
            <input
              type="file"
              className="sr-only"
              accept=".svg,.png,.webp,.jpg,.jpeg,image/svg+xml,image/png,image/webp,image/jpeg"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void unggahLogo(f);
                e.target.value = '';
              }}
            />
          </label>
          {!d.logoBawaan && (
            <Tombol kecil ragam="halus" sibuk={logo.sibuk} onClick={hapusLogo}>
              Kembali ke lambang bawaan
            </Tombol>
          )}
        </div>
      </section>
    </div>
  );
}

function Perizinan({ d, selesai }: { d: DataPengaturan; selesai: () => Promise<void> }) {
  const toast = useToast();
  const { muatUlang } = useInfo();
  const [daftar, setDaftar] = useState(d.instansi);
  const { sibuk, galat, bidang, kirim } = useKirim();
  const ubah = (i: number, v: Partial<(typeof daftar)[number]>) => setDaftar((x) => x.map((y, j) => (j === i ? { ...y, ...v } : y)));
  const simpan = async () => {
    const ok = await kirim(() => api('PUT', '/api/pengaturan/instansi', daftar));
    if (ok) {
      toast('Instansi perizinan tersimpan.');
      await Promise.all([selesai(), muatUlang()]);
    }
  };
  return (
    <form
      className="bagian"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void simpan();
      }}
    >
      <div className="kepala-bagian">
        <h2>Instansi perizinan</h2>
        <p>Dokumen izin yang diminta saat pendaftaran dan diverifikasi saat seleksi, beserta instansinya.</p>
      </div>
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      <ol className="daftar-instansi">
        {daftar.map((i, n) => (
          <li key={i.kunci}>
            <span className="nomor angka" aria-hidden="true">
              {n + 1}
            </span>
            <div className="kisi-isian">
              <Bidang label="Nama dokumen" galat={bidang[`${n}.dokumen`]}>
                {(a) => <Masukan {...a} value={i.dokumen} onChange={(e) => ubah(n, { dokumen: e.target.value })} />}
              </Bidang>
              <Bidang label="Instansi" petunjuk={i.instansi ? 'Instansi yang menerbitkan atau memverifikasi dokumen ini.' : 'Belum diisi. Tampil sebagai “akan diumumkan” di formulir.'}>
                {(a) => <Masukan {...a} value={i.instansi} onChange={(e) => ubah(n, { instansi: e.target.value })} placeholder="Nama resmi instansi" />}
              </Bidang>
              <label className="centang penuh">
                <input type="checkbox" checked={i.wajib} onChange={(e) => ubah(n, { wajib: e.target.checked })} />
                <span>Wajib dilampirkan dan terverifikasi sebelum UMKM diterima</span>
              </label>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <Tombol type="submit" ragam="utama" sibuk={sibuk}>
          Simpan instansi perizinan
        </Tombol>
      </div>
    </form>
  );
}

function Ruangan({ d, selesai }: { d: DataPengaturan; selesai: () => Promise<void> }) {
  const toast = useToast();
  const [lantai, setLantai] = useState(1);
  const [ubah, setUbah] = useState<Ruang | null>(null);
  const konfirmasi = useKirim();
  const ruang = d.ruangan.filter((r) => r.lantai === lantai);
  const totalLuas = ruang.reduce((a, r) => a + r.lebar * r.panjang, 0);
  const tumpang = ruang.filter((a) => ruang.some((b) => b.id !== a.id && a.x < b.x + b.lebar && b.x < a.x + a.lebar && a.z < b.z + b.panjang && b.z < a.z + a.panjang));

  const tandai = async (v: boolean) => {
    const ok = await konfirmasi.kirim(() => api('PUT', '/api/pengaturan/denah', { terkonfirmasi: v }));
    if (ok) {
      toast(v ? 'Denah ditandai sesuai gambar kerja.' : 'Tanda kesesuaian denah dicabut.');
      await selesai();
    }
  };

  return (
    <section className="bagian">
      <div className="kepala-bagian">
        <h2>Ruangan dan ukuran</h2>
        <p>
          Pelat lantai {d.pelat.lebar} × {d.pelat.panjang} m. Posisi diukur dari sudut kiri depan gedung, sama seperti sketsa denah: pintu masuk di sisi atas.
        </p>
      </div>
      {d.denahTerkonfirmasi ? (
        <Pemberitahuan nada="ok">
          Ukuran sudah ditandai sesuai gambar kerja gedung.{' '}
          <button type="button" className="tautan-teks" onClick={() => tandai(false)}>
            Cabut tanda
          </button>
        </Pemberitahuan>
      ) : (
        <Pemberitahuan nada="tunggu">
          Ukuran di bawah masih perkiraan kerja. Cocokkan dengan gambar kerja atau hasil ukur di lokasi, lalu tandai sesuai.{' '}
          <button type="button" className="tautan-teks" onClick={() => tandai(true)}>
            Tandai sudah sesuai
          </button>
        </Pemberitahuan>
      )}
      {tumpang.length > 0 && (
        <Pemberitahuan nada="galat">
          {tumpang.map((r) => r.nama).join(', ')} saling bertumpuk. Geser posisi atau kecilkan ukurannya agar denah 3D tampil benar.
        </Pemberitahuan>
      )}
      <div className="bilah-saring">
        <div className="segmen" role="group" aria-label="Pilih lantai">
          {[...new Set(d.ruangan.map((r) => r.lantai))].map((n) => (
            <button key={n} type="button" aria-pressed={n === lantai} onClick={() => setLantai(n)}>
              Lantai {n}
            </button>
          ))}
        </div>
        <span className="redup kecil angka">Luas ruangan {String(Math.round(totalLuas)).replace('.', ',')} m²</span>
      </div>
      <div className="dua-kolom lebar-kiri">
        <div className="bingkai-tabel">
          <table className="tabel tabel-susun">
            <thead>
              <tr>
                <th scope="col">Ruangan</th>
                <th scope="col" className="angka">
                  Ukuran (m)
                </th>
                <th scope="col" className="angka">
                  Posisi (m)
                </th>
                <th scope="col" className="angka">
                  Kapasitas
                </th>
                <th scope="col">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ruang.map((r) => (
                <tr key={r.id}>
                  <td data-label="">
                    <span className="tebal">{r.nama}</span>
                    <span className="sub">
                      {r.kode} · {JENIS_RUANGAN[r.jenis]}
                    </span>
                  </td>
                  <td data-label="Ukuran (m)" className="angka">
                    {String(r.lebar).replace('.', ',')} × {String(r.panjang).replace('.', ',')}
                  </td>
                  <td data-label="Posisi (m)" className="angka redup">
                    {String(r.x).replace('.', ',')}; {String(r.z).replace('.', ',')}
                  </td>
                  <td data-label="Kapasitas" className="angka">
                    {r.kapasitas ?? '—'}
                  </td>
                  <td data-label="" className="kanan">
                    <Tombol kecil ragam="halus" onClick={() => setUbah(r)}>
                      Ubah
                    </Tombol>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <figure className="denah-mini">
          <svg viewBox={`-0.4 -1.3 ${d.pelat.lebar + 0.8} ${d.pelat.panjang + 1.7}`} role="img" aria-label={`Denah lantai ${lantai}, pintu masuk di sisi atas`}>
            <text x={d.pelat.pintuMasuk.x + d.pelat.pintuMasuk.lebar / 2} y="-0.5" fontSize="0.6" fill="#5c6058" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif">
              Pintu masuk
            </text>
            <rect x="0" y="0" width={d.pelat.lebar} height={d.pelat.panjang} fill="#fbf9f5" stroke="#1d221f" strokeWidth="0.08" />
            {lantai === 1 && <rect x={d.pelat.pintuMasuk.x} y="-0.1" width={d.pelat.pintuMasuk.lebar} height="0.2" fill="#b24c0b" />}
            {ruang.map((r) => (
              <g key={r.id}>
                <rect
                  x={r.x + 0.05}
                  y={r.z + 0.05}
                  width={r.lebar - 0.1}
                  height={r.panjang - 0.1}
                  fill={tumpang.includes(r) ? '#f5e1db' : RUANG_SIARAN.includes(r.jenis) ? '#e3ebe2' : '#ece7dc'}
                  stroke={ubah?.id === r.id ? '#b24c0b' : '#b9b09f'}
                  strokeWidth={ubah?.id === r.id ? 0.14 : 0.05}
                />
                <text x={r.x + 0.4} y={r.z + 1.1} fontSize="0.62" fill="#1d221f" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600">
                  {r.kode}
                </text>
              </g>
            ))}
          </svg>
          <figcaption className="redup mikro">Pratinjau denah lantai {lantai}. Hijau: studio siaran.</figcaption>
        </figure>
      </div>
      <LembarRuang ruang={ubah} pelat={d.pelat} tutup={() => setUbah(null)} selesai={selesai} />
    </section>
  );
}

function LembarRuang({ ruang, pelat, tutup, selesai }: { ruang: Ruang | null; pelat: { lebar: number; panjang: number }; tutup: () => void; selesai: () => Promise<void> }) {
  const toast = useToast();
  const [v, setV] = useState({ nama: '', lebar: '', panjang: '', x: '', z: '', kapasitas: '', sisiPintu: 'depan' });
  const { sibuk, galat, bidang, kirim } = useKirim();
  useEffect(() => {
    if (ruang)
      setV({
        nama: ruang.nama,
        lebar: String(ruang.lebar).replace('.', ','),
        panjang: String(ruang.panjang).replace('.', ','),
        x: String(ruang.x).replace('.', ','),
        z: String(ruang.z).replace('.', ','),
        kapasitas: ruang.kapasitas ? String(ruang.kapasitas) : '',
        sisiPintu: ruang.sisiPintu,
      });
  }, [ruang]);
  const angkaKoma = (s: string) => Number(s.replace(',', '.'));
  const p = (k: keyof typeof v) => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value.replace(/[^\d,.]/g, '') })) });
  const simpan = async () => {
    const ok = await kirim(() =>
      api('PUT', `/api/pengaturan/ruangan/${ruang!.id}`, {
        nama: v.nama,
        lebar: angkaKoma(v.lebar),
        panjang: angkaKoma(v.panjang),
        x: angkaKoma(v.x),
        z: angkaKoma(v.z),
        kapasitas: v.kapasitas ? Number(v.kapasitas) : null,
        sisi_pintu: v.sisiPintu,
      }),
    );
    if (ok) {
      toast(`Ukuran ${v.nama} tersimpan. Denah 3D ikut diperbarui.`);
      tutup();
      await selesai();
    }
  };
  return (
    <Lembar
      buka={!!ruang}
      tutup={tutup}
      judul={ruang ? `Ubah ${ruang.kode}` : ''}
      keterangan={`Satuan meter. Gunakan koma untuk desimal, misalnya 6,5. Batas gedung ${pelat.lebar} × ${pelat.panjang} m.`}
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            Simpan ruangan
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      <Bidang label="Nama ruangan" galat={bidang.nama}>
        {(a) => <Masukan {...a} value={v.nama} onChange={(e) => setV((x) => ({ ...x, nama: e.target.value }))} />}
      </Bidang>
      <div className="kisi-isian">
        <Bidang label="Lebar (sumbu kiri–kanan)" galat={bidang.lebar}>
          {(a) => <Masukan {...a} {...p('lebar')} inputMode="decimal" className="angka" />}
        </Bidang>
        <Bidang label="Panjang (sumbu depan–belakang)" galat={bidang.panjang}>
          {(a) => <Masukan {...a} {...p('panjang')} inputMode="decimal" className="angka" />}
        </Bidang>
        <Bidang label="Jarak dari dinding kiri" galat={bidang.x}>
          {(a) => <Masukan {...a} {...p('x')} inputMode="decimal" className="angka" />}
        </Bidang>
        <Bidang label="Jarak dari dinding depan" galat={bidang.z}>
          {(a) => <Masukan {...a} {...p('z')} inputMode="decimal" className="angka" />}
        </Bidang>
        <Bidang label="Sisi pintu" galat={bidang.sisi_pintu}>
          {(a) => (
            <Pilihan {...a} value={v.sisiPintu} onChange={(e) => setV((x) => ({ ...x, sisiPintu: e.target.value }))}>
              {Object.entries(SISI_PINTU).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Pilihan>
          )}
        </Bidang>
        <Bidang label="Kapasitas orang" opsional>
          {(a) => <Masukan {...a} value={v.kapasitas} onChange={(e) => setV((x) => ({ ...x, kapasitas: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" className="angka" />}
        </Bidang>
      </div>
    </Lembar>
  );
}

interface BarisPengguna {
  id: number;
  nama: string;
  email: string;
  peran: Peran;
  aktif: number;
  dibuat: string;
}

function Pengguna() {
  const r = useData<{ daftar: BarisPengguna[] }>('/api/pengguna');
  const { pengguna } = useSesi();
  const toast = useToast();
  const [baru, setBaru] = useState(false);
  const [reset, setReset] = useState<BarisPengguna | null>(null);

  const ubahAktif = async (u: BarisPengguna) => {
    try {
      await api('PATCH', `/api/pengguna/${u.id}`, { aktif: !u.aktif });
      toast(u.aktif ? `Akun ${u.nama} dinonaktifkan.` : `Akun ${u.nama} diaktifkan kembali.`);
      await r.muatUlang();
    } catch (e) {
      toast((e as Error).message, 'galat');
    }
  };

  return (
    <section className="bagian">
      <div className="kepala-bagian">
        <h2>Pengguna</h2>
        <Tombol kecil ikon="tambah" onClick={() => setBaru(true)}>
          Tambah pengguna
        </Tombol>
      </div>
      <p className="redup kecil">Petugas studio mencatat stok, sesi live, penjualan, dan retur. Seleksi UMKM, pencairan dana, dan pengaturan hanya untuk administrator.</p>
      {r.galat && !r.data && <GalatMuat galat={r.galat} ulang={r.muatUlang} />}
      {!r.data && !r.galat && <Memuat />}
      {r.data && (
        <div className="bingkai-tabel">
          <table className="tabel tabel-susun">
            <thead>
              <tr>
                <th scope="col">Nama</th>
                <th scope="col">Peran</th>
                <th scope="col">Status</th>
                <th scope="col">Dibuat</th>
                <th scope="col">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {r.data.daftar.map((u) => (
                <tr key={u.id} className={u.aktif ? undefined : 'nonaktif'}>
                  <td data-label="">
                    <span className="tebal">
                      {u.nama}
                      {u.id === pengguna?.id && <span className="redup"> (Anda)</span>}
                    </span>
                    <span className="sub">{u.email}</span>
                  </td>
                  <td data-label="Peran">{PERAN[u.peran]}</td>
                  <td data-label="Status">{u.aktif ? <Status nada="ok">Aktif</Status> : <Status nada="mati">Nonaktif</Status>}</td>
                  <td data-label="Dibuat">{tanggal(u.dibuat)}</td>
                  <td data-label="" className="kanan">
                    {u.id !== pengguna?.id && (
                      <div className="deret-tombol" style={{ justifyContent: 'flex-end' }}>
                        <Tombol kecil ragam="halus" onClick={() => setReset(u)}>
                          Atur ulang sandi
                        </Tombol>
                        <Tombol kecil ragam="halus" onClick={() => ubahAktif(u)}>
                          {u.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                        </Tombol>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LembarPengguna buka={baru} tutup={() => setBaru(false)} selesai={r.muatUlang} />
      <LembarResetSandi pengguna={reset} tutup={() => setReset(null)} />
    </section>
  );
}

function LembarPengguna({ buka, tutup, selesai }: { buka: boolean; tutup: () => void; selesai: () => Promise<void> }) {
  const toast = useToast();
  const [v, setV] = useState({ nama: '', email: '', peran: 'petugas', sandi: '' });
  const { sibuk, galat, bidang, kirim, atur } = useKirim();
  useEffect(() => {
    if (buka) {
      setV({ nama: '', email: '', peran: 'petugas', sandi: '' });
      atur(null);
    }
  }, [buka, atur]);
  const p = (k: keyof typeof v) => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value })) });
  const simpan = async () => {
    const ok = await kirim(() => api('POST', '/api/pengguna', v));
    if (ok) {
      toast(`Akun ${v.nama} dibuat. Sampaikan kata sandi awal secara langsung.`);
      tutup();
      await selesai();
    }
  };
  return (
    <Lembar
      buka={buka}
      tutup={tutup}
      judul="Tambah pengguna"
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            Buat akun
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      <Bidang label="Nama" galat={bidang.nama}>
        {(a) => <Masukan {...a} {...p('nama')} />}
      </Bidang>
      <Bidang label="Email" galat={bidang.email}>
        {(a) => <Masukan {...a} {...p('email')} type="email" autoComplete="off" />}
      </Bidang>
      <Bidang label="Peran">
        {(a) => (
          <Pilihan {...a} {...p('peran')}>
            <option value="petugas">{PERAN.petugas}</option>
            <option value="admin">{PERAN.admin}</option>
          </Pilihan>
        )}
      </Bidang>
      <Bidang label="Kata sandi awal" galat={bidang.sandi} petunjuk="Minimal 10 karakter, gabungan huruf dan angka.">
        {(a) => <Masukan {...a} {...p('sandi')} type="password" autoComplete="new-password" />}
      </Bidang>
    </Lembar>
  );
}

function LembarResetSandi({ pengguna, tutup }: { pengguna: BarisPengguna | null; tutup: () => void }) {
  const toast = useToast();
  const [sandi, setSandi] = useState('');
  const { sibuk, galat, bidang, kirim, atur } = useKirim();
  useEffect(() => {
    if (pengguna) {
      setSandi('');
      atur(null);
    }
  }, [pengguna, atur]);
  const simpan = async () => {
    const ok = await kirim(() => api('PATCH', `/api/pengguna/${pengguna!.id}`, { sandi }));
    if (ok) {
      toast(`Kata sandi ${pengguna!.nama} diatur ulang.`);
      tutup();
    }
  };
  return (
    <Lembar
      buka={!!pengguna}
      tutup={tutup}
      judul="Atur ulang kata sandi"
      keterangan={pengguna?.nama}
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            Simpan kata sandi baru
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      <Bidang label="Kata sandi baru" galat={bidang.sandi} petunjuk="Minimal 10 karakter, gabungan huruf dan angka.">
        {(a) => <Masukan {...a} type="password" autoComplete="new-password" value={sandi} onChange={(e) => setSandi(e.target.value)} />}
      </Bidang>
    </Lembar>
  );
}

function AkunSaya() {
  const toast = useToast();
  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');
  const { sibuk, galat, bidang, kirim } = useKirim();
  return (
    <form
      className="bagian sempit"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await kirim(() => api('POST', '/api/auth/ganti-sandi', { lama, baru }));
        if (ok) {
          toast('Kata sandi Anda sudah diganti.');
          setLama('');
          setBaru('');
        }
      }}
    >
      <h2>Ganti kata sandi</h2>
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      <Bidang label="Kata sandi saat ini" galat={bidang.lama}>
        {(a) => <Masukan {...a} type="password" autoComplete="current-password" value={lama} onChange={(e) => setLama(e.target.value)} />}
      </Bidang>
      <Bidang label="Kata sandi baru" galat={bidang.baru} petunjuk="Minimal 10 karakter, gabungan huruf dan angka.">
        {(a) => <Masukan {...a} type="password" autoComplete="new-password" value={baru} onChange={(e) => setBaru(e.target.value)} />}
      </Bidang>
      <div>
        <Tombol type="submit" ragam="utama" sibuk={sibuk}>
          Simpan kata sandi baru
        </Tombol>
      </div>
    </form>
  );
}
