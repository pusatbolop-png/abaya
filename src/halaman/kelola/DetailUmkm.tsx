import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { api } from '../../lib/api';
import { useData } from '../../lib/data';
import { useInfo, useSesi, useToast } from '../../lib/konteks';
import { Area, Bidang, GalatMuat, KepalaHalaman, Kosong, Lembar, Masukan, MasukanRupiah, Memuat, Pemberitahuan, PilihBerkas, Pilihan, Status, Tombol, Uang, useKirim } from '../../ui/dasar';
import { Ikon } from '../../ui/Ikon';
import { angka, tanggal, tanggalJam, tautanWa, tampilWa } from '../../../shared/format';
import { KRITERIA_SELEKSI, STATUS_IZIN, STATUS_UMKM, STOK_MENIPIS, type StatusIzin, type StatusUmkm } from '../../../shared/konstanta';
import { nadaUmkm } from './DaftarUmkm';

interface Izin {
  kunci: string;
  dokumen: string;
  instansi: string;
  wajib: boolean;
  nomor: string | null;
  adaBerkas: boolean;
  berkasNama: string | null;
  status: StatusIzin;
  catatan: string | null;
  diperiksa: string | null;
}
interface Produk {
  id: number;
  nama: string;
  sku: string;
  harga: number;
  satuan: string;
  aktif: number;
  stok: number;
  terjual: number;
}
export interface DetailUmkmData {
  id: number;
  kode: string;
  namaUsaha: string;
  pemilik: string;
  whatsapp: string;
  email: string | null;
  alamat: string;
  kecamatan: string;
  kategori: string;
  deskripsi: string;
  mediaSosial: string | null;
  bank: string | null;
  noRekening: string | null;
  atasNama: string | null;
  status: StatusUmkm;
  skor: Record<string, number> | null;
  catatanSeleksi: string | null;
  diputuskan: string | null;
  diputuskanOleh: string | null;
  dibuat: string;
  izin: Izin[];
  produk: Produk[];
  dana: { siapCair: number; sudahDibayar: number; menungguTransfer: number; neto: number };
}

const nadaIzin = (s: StatusIzin) => (s === 'terverifikasi' ? 'ok' : s === 'tidak_valid' ? 'galat' : s === 'diunggah' ? 'tunggu' : 'mati');

function pesanWa(u: DetailUmkmData, lembaga: string) {
  const sapa = `Halo ${u.pemilik},`;
  switch (u.status) {
    case 'diterima':
      return `${sapa} selamat! ${u.namaUsaha} lolos kurasi ${lembaga}. Kami akan menghubungi Anda untuk jadwal penitipan stok pertama. Kode pendaftaran: ${u.kode}.`;
    case 'perlu_perbaikan':
      return `${sapa} pendaftaran ${u.namaUsaha} (${u.kode}) perlu dilengkapi: ${u.catatanSeleksi ?? ''} Balas pesan ini bila ada pertanyaan.`;
    case 'ditolak':
      return `${sapa} terima kasih telah mendaftar di ${lembaga}. ${u.namaUsaha} belum lolos kurasi kali ini. Catatan tim: ${u.catatanSeleksi ?? ''}`;
    default:
      return `${sapa} pendaftaran ${u.namaUsaha} (${u.kode}) sudah kami terima dan sedang dalam antrean kurasi ${lembaga}.`;
  }
}

export function DetailUmkm() {
  const { id } = useParams();
  const r = useData<DetailUmkmData>(`/api/umkm/${id}`);
  const { info } = useInfo();
  const { pengguna } = useSesi();
  const [lembarIzin, setLembarIzin] = useState<Izin | null>(null);
  const [lembarProduk, setLembarProduk] = useState<Produk | 'baru' | null>(null);
  const [lembarData, setLembarData] = useState(false);
  const u = r.data;
  const admin = pengguna?.peran === 'admin';

  if (r.galat && !u) return <GalatMuat galat={r.galat} ulang={r.muatUlang} />;
  if (!u) return <Memuat />;

  const rekeningLengkap = !!(u.bank && u.noRekening && u.atasNama);
  const lembaga = info?.organisasi.singkat ?? 'PCC';

  return (
    <>
      <KepalaHalaman
        remah={{ ke: '/kelola/umkm', label: 'UMKM dan seleksi' }}
        judul={u.namaUsaha}
        keterangan={
          <>
            <span className="mono">{u.kode}</span> · {u.kategori} · {u.kecamatan} · terdaftar {tanggal(u.dibuat)}
          </>
        }
        aksi={
          <>
            <a className="tombol tombol-kedua" href={tautanWa(u.whatsapp, pesanWa(u, lembaga))} target="_blank" rel="noopener noreferrer">
              <Ikon nama="wa" />
              Kabari lewat WhatsApp
            </a>
            <Tombol ikon="ubah" onClick={() => setLembarData(true)}>
              Ubah data
            </Tombol>
          </>
        }
      />
      <div className="status-besar">
        <Status nada={nadaUmkm(u.status)}>{STATUS_UMKM[u.status]}</Status>
        {u.diputuskan && (
          <span className="redup kecil">
            diputuskan {tanggalJam(u.diputuskan)}
            {u.diputuskanOleh ? ` oleh ${u.diputuskanOleh}` : ''}
          </span>
        )}
      </div>

      <div className="dua-kolom lebar-kiri">
        <div>
          <section className="bagian" aria-labelledby="judul-izin">
            <div className="kepala-bagian">
              <h2 id="judul-izin">Dokumen izin</h2>
              <p>Izin wajib harus terverifikasi sebelum UMKM bisa diterima.</p>
            </div>
            <ul className="daftar-izin-kelola">
              {u.izin.map((i) => (
                <li key={i.kunci}>
                  <div className="izin-info">
                    <h3>
                      {i.dokumen}
                      {i.wajib && <span className="label-wajib">wajib</span>}
                    </h3>
                    <p className="redup kecil">{i.instansi || 'Instansi belum diatur di Pengaturan'}</p>
                    <p className="kecil">
                      {i.nomor ? (
                        <>
                          Nomor <span className="mono">{i.nomor}</span>
                        </>
                      ) : (
                        <span className="redup">Nomor belum diisi</span>
                      )}
                      {i.adaBerkas && (
                        <>
                          {' · '}
                          <a href={`/api/umkm/${u.id}/izin/${i.kunci}/berkas`} target="_blank" rel="noopener noreferrer">
                            Lihat berkas{i.berkasNama ? ` ${i.berkasNama}` : ''}
                          </a>
                        </>
                      )}
                    </p>
                    {i.catatan && <p className="kecil catatan">Catatan: {i.catatan}</p>}
                  </div>
                  <div className="izin-aksi">
                    <Status nada={nadaIzin(i.status)}>{STATUS_IZIN[i.status]}</Status>
                    <Tombol kecil onClick={() => setLembarIzin(i)}>
                      Periksa
                    </Tombol>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <PanelSeleksi u={u} admin={admin} selesai={r.muatUlang} />

          <section className="bagian" aria-labelledby="judul-produk">
            <div className="kepala-bagian">
              <h2 id="judul-produk">Produk</h2>
              {u.status === 'diterima' && (
                <Tombol kecil ikon="tambah" onClick={() => setLembarProduk('baru')}>
                  Tambah produk
                </Tombol>
              )}
            </div>
            {u.status !== 'diterima' ? (
              <p className="redup kecil">Produk bisa ditambahkan setelah UMKM diterima dalam seleksi.</p>
            ) : u.produk.length === 0 ? (
              <div className="bingkai-tabel">
                <Kosong
                  judul="Belum ada produk."
                  aksi={
                    <Tombol kecil ikon="tambah" onClick={() => setLembarProduk('baru')}>
                      Tambah produk pertama
                    </Tombol>
                  }
                >
                  Catat produk yang dititipkan beserta harga jual dan jumlah stok awal.
                </Kosong>
              </div>
            ) : (
              <div className="bingkai-tabel">
                <table className="tabel tabel-susun">
                  <thead>
                    <tr>
                      <th scope="col">Produk</th>
                      <th scope="col" className="angka">
                        Harga
                      </th>
                      <th scope="col" className="angka">
                        Stok
                      </th>
                      <th scope="col" className="angka">
                        Terjual
                      </th>
                      <th scope="col">
                        <span className="sr-only">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.produk.map((p) => (
                      <tr key={p.id} className={p.aktif ? undefined : 'nonaktif'}>
                        <td data-label="">
                          <span className="tebal">{p.nama}</span>
                          <span className="sub">
                            <span className="mono">{p.sku}</span>
                            {!p.aktif && ' · tidak dijual'}
                          </span>
                        </td>
                        <td data-label="Harga" className="angka">
                          <Uang n={p.harga} />
                        </td>
                        <td data-label="Stok" className={['angka', p.stok <= STOK_MENIPIS && 'teks-peringatan'].filter(Boolean).join(' ')}>
                          {angka(p.stok)} {p.satuan}
                        </td>
                        <td data-label="Terjual" className="angka">
                          {angka(p.terjual)}
                        </td>
                        <td data-label="" className="kanan">
                          <Tombol kecil ragam="halus" onClick={() => setLembarProduk(p)}>
                            Ubah
                          </Tombol>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="kolom-samping">
          <section className="bagian">
            <h2>Profil usaha</h2>
            <dl className="keterangan">
              <dt>Pemilik</dt>
              <dd>{u.pemilik}</dd>
              <dt>WhatsApp</dt>
              <dd>
                <a href={tautanWa(u.whatsapp)} target="_blank" rel="noopener noreferrer">
                  {tampilWa(u.whatsapp)}
                </a>
              </dd>
              {u.email && (
                <>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${u.email}`}>{u.email}</a>
                  </dd>
                </>
              )}
              <dt>Alamat</dt>
              <dd>
                {u.alamat}, Kec. {u.kecamatan}
              </dd>
              {u.mediaSosial && (
                <>
                  <dt>Media sosial</dt>
                  <dd>{u.mediaSosial}</dd>
                </>
              )}
            </dl>
            <p className="deskripsi">{u.deskripsi}</p>
          </section>
          <section className="bagian">
            <h2>Rekening pencairan</h2>
            {rekeningLengkap ? (
              <dl className="keterangan">
                <dt>Bank</dt>
                <dd>{u.bank}</dd>
                <dt>Nomor</dt>
                <dd className="mono">{u.noRekening}</dd>
                <dt>Atas nama</dt>
                <dd>{u.atasNama}</dd>
              </dl>
            ) : (
              <Pemberitahuan nada="tunggu">
                Data rekening belum lengkap. Dana tidak bisa dicairkan sampai bank, nomor rekening, dan nama pemilik rekening diisi.{' '}
                <button type="button" className="tautan-teks" onClick={() => setLembarData(true)}>
                  Lengkapi sekarang
                </button>
              </Pemberitahuan>
            )}
          </section>
          {u.status === 'diterima' && (
            <section className="bagian">
              <h2>Dana</h2>
              <dl className="keterangan">
                <dt>Siap dicairkan</dt>
                <dd className="angka tebal">
                  <Uang n={u.dana.siapCair} />
                </dd>
                <dt>Menunggu transfer</dt>
                <dd className="angka">
                  <Uang n={u.dana.menungguTransfer} />
                </dd>
                <dt>Sudah ditransfer</dt>
                <dd className="angka">
                  <Uang n={u.dana.sudahDibayar} />
                </dd>
              </dl>
            </section>
          )}
        </aside>
      </div>

      <LembarIzin umkmId={u.id} izin={lembarIzin} tutup={() => setLembarIzin(null)} selesai={r.muatUlang} />
      <LembarProduk umkmId={u.id} produk={lembarProduk} tutup={() => setLembarProduk(null)} selesai={r.muatUlang} />
      <LembarDataUmkm u={u} buka={lembarData} tutup={() => setLembarData(false)} selesai={r.muatUlang} />
    </>
  );
}

function PanelSeleksi({ u, admin, selesai }: { u: DetailUmkmData; admin: boolean; selesai: () => Promise<void> }) {
  const toast = useToast();
  const [ubah, setUbah] = useState(u.status === 'diajukan');
  const [skor, setSkor] = useState<Record<string, number>>(u.skor ?? {});
  const [keputusan, setKeputusan] = useState<string>(u.status === 'diajukan' ? '' : u.status);
  const [catatan, setCatatan] = useState(u.catatanSeleksi ?? '');
  const { sibuk, galat, bidang, kirim, atur } = useKirim();

  useEffect(() => {
    setUbah(u.status === 'diajukan');
    setSkor(u.skor ?? {});
    setKeputusan(u.status === 'diajukan' ? '' : u.status);
    setCatatan(u.catatanSeleksi ?? '');
  }, [u.status, u.skor, u.catatanSeleksi]);

  const rata = KRITERIA_SELEKSI.every((k) => skor[k.kunci])
    ? KRITERIA_SELEKSI.reduce((a, k) => a + skor[k.kunci], 0) / KRITERIA_SELEKSI.length
    : null;
  const labelSimpan = keputusan === 'diterima' ? 'Terima UMKM ini' : keputusan === 'perlu_perbaikan' ? 'Minta perbaikan' : keputusan === 'ditolak' ? 'Tandai tidak lolos' : 'Simpan keputusan';

  const simpan = async () => {
    const g: Record<string, string> = {};
    for (const k of KRITERIA_SELEKSI) if (!skor[k.kunci]) g[`skor.${k.kunci}`] = `Beri nilai ${k.label.toLowerCase()}.`;
    if (!keputusan) g.keputusan = 'Pilih keputusan seleksi.';
    if (keputusan && keputusan !== 'diterima' && !catatan.trim()) g.catatan = 'Tuliskan catatan agar pendaftar tahu alasannya dan apa yang perlu dilakukan.';
    if (Object.keys(g).length) return atur('Lengkapi penilaian sebelum menyimpan keputusan.', g);
    const ok = await kirim(() => api('POST', `/api/umkm/${u.id}/seleksi`, { keputusan, skor, catatan }));
    if (ok) {
      toast(`Keputusan seleksi ${u.namaUsaha} tersimpan. Kabari pendaftar lewat WhatsApp.`);
      await selesai();
    }
  };

  if (!ubah) {
    return (
      <section className="bagian" aria-labelledby="judul-seleksi">
        <div className="kepala-bagian">
          <h2 id="judul-seleksi">Seleksi</h2>
          {admin && (
            <Tombol kecil onClick={() => setUbah(true)}>
              Ubah keputusan
            </Tombol>
          )}
        </div>
        <div className="ringkas-seleksi">
          {u.skor && (
            <dl className="skor-ringkas">
              {KRITERIA_SELEKSI.map((k) => (
                <div key={k.kunci}>
                  <dt>{k.label}</dt>
                  <dd className="angka">{u.skor![k.kunci]} / 5</dd>
                </div>
              ))}
            </dl>
          )}
          {u.catatanSeleksi && <p className="catatan">{u.catatanSeleksi}</p>}
        </div>
      </section>
    );
  }

  if (!admin) {
    return (
      <section className="bagian">
        <h2>Seleksi</h2>
        <p className="redup kecil">Keputusan seleksi diambil oleh administrator. Anda tetap bisa memeriksa dokumen izin.</p>
      </section>
    );
  }

  return (
    <section className="bagian panel-seleksi" aria-labelledby="judul-seleksi">
      <div className="kepala-bagian">
        <h2 id="judul-seleksi">Seleksi</h2>
        {rata !== null && <p className="angka">Rata-rata {rata.toFixed(1).replace('.', ',')} dari 5</p>}
      </div>
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      <div className="kriteria">
        {KRITERIA_SELEKSI.map((k) => (
          <fieldset key={k.kunci} className="skala">
            <legend>{k.label}</legend>
            <div className="pilihan-skala">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n}>
                  <input type="radio" name={`skor-${k.kunci}`} value={n} checked={skor[k.kunci] === n} onChange={() => setSkor((s) => ({ ...s, [k.kunci]: n }))} />
                  <span className="angka">{n}</span>
                </label>
              ))}
            </div>
            {bidang[`skor.${k.kunci}`] && (
              <p className="pesan-galat">
                <Ikon nama="peringatan" />
                <span>{bidang[`skor.${k.kunci}`]}</span>
              </p>
            )}
          </fieldset>
        ))}
        <p className="redup mikro">1 sangat kurang, 3 cukup, 5 sangat baik.</p>
      </div>
      <fieldset className="keputusan">
        <legend>Keputusan</legend>
        <div className="pilihan-keputusan">
          {(
            [
              ['diterima', 'Terima', 'Masuk program dan bisa menitipkan stok.'],
              ['perlu_perbaikan', 'Perlu perbaikan', 'Pendaftar melengkapi dulu, lalu ditinjau ulang.'],
              ['ditolak', 'Tidak lolos', 'Tidak dilanjutkan pada periode ini.'],
            ] as const
          ).map(([nilai, label, ket]) => (
            <label key={nilai} className="opsi-keputusan">
              <input type="radio" name="keputusan" value={nilai} checked={keputusan === nilai} onChange={() => setKeputusan(nilai)} />
              <span>
                <span className="tebal">{label}</span>
                <span className="redup kecil">{ket}</span>
              </span>
            </label>
          ))}
        </div>
        {bidang.keputusan && (
          <p className="pesan-galat">
            <Ikon nama="peringatan" />
            <span>{bidang.keputusan}</span>
          </p>
        )}
      </fieldset>
      <Bidang
        label="Catatan untuk pendaftar"
        opsional={keputusan === 'diterima'}
        galat={bidang.catatan}
        petunjuk="Catatan ini terlihat oleh pendaftar di halaman Cek status."
      >
        {(a) => <Area {...a} value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3} />}
      </Bidang>
      <div className="deret-tombol">
        <Tombol ragam="utama" sibuk={sibuk} onClick={simpan}>
          {labelSimpan}
        </Tombol>
        {u.status !== 'diajukan' && <Tombol onClick={() => setUbah(false)}>Batal</Tombol>}
      </div>
    </section>
  );
}

function LembarIzin({ umkmId, izin, tutup, selesai }: { umkmId: number; izin: Izin | null; tutup: () => void; selesai: () => Promise<void> }) {
  const toast = useToast();
  const [status, setStatus] = useState<StatusIzin>('terverifikasi');
  const [nomor, setNomor] = useState('');
  const [catatan, setCatatan] = useState('');
  const [berkas, setBerkas] = useState<File | null>(null);
  const { sibuk, galat, bidang, kirim, atur } = useKirim();

  useEffect(() => {
    if (!izin) return;
    setStatus(izin.status === 'belum_ada' || izin.status === 'diunggah' ? 'terverifikasi' : izin.status);
    setNomor(izin.nomor ?? '');
    setCatatan(izin.catatan ?? '');
    setBerkas(null);
    atur(null);
  }, [izin, atur]);

  const simpan = async () => {
    if (status === 'tidak_valid' && !catatan.trim()) return atur('Tuliskan alasannya.', { catatan: 'Tuliskan alasan agar UMKM tahu apa yang perlu diperbaiki.' });
    const ok = await kirim(async () => {
      if (berkas) {
        const f = new FormData();
        f.append('berkas', berkas);
        await api('POST', `/api/umkm/${umkmId}/izin/${izin!.kunci}/berkas`, f);
      }
      return api('PUT', `/api/umkm/${umkmId}/izin/${izin!.kunci}`, { status, nomor, catatan });
    });
    if (ok) {
      toast(`Status ${izin!.dokumen} tersimpan.`);
      tutup();
      await selesai();
    }
  };

  return (
    <Lembar
      buka={!!izin}
      tutup={tutup}
      judul={izin ? `Periksa ${izin.dokumen}` : ''}
      keterangan={izin?.instansi || undefined}
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            Simpan hasil pemeriksaan
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      {izin?.adaBerkas ? (
        <a className="tautan-panah" href={`/api/umkm/${umkmId}/izin/${izin.kunci}/berkas`} target="_blank" rel="noopener noreferrer">
          Buka berkas yang diunggah
          <Ikon nama="panah-kanan" />
        </a>
      ) : (
        <p className="redup kecil">Pendaftar belum mengunggah berkas. Anda bisa mengunggahnya di sini setelah menerima salinan.</p>
      )}
      <Bidang label="Nomor izin" opsional>
        {(a) => <Masukan {...a} value={nomor} onChange={(e) => setNomor(e.target.value)} />}
      </Bidang>
      <Bidang label="Hasil pemeriksaan">
        {(a) => (
          <Pilihan {...a} value={status} onChange={(e) => setStatus(e.target.value as StatusIzin)}>
            <option value="terverifikasi">Terverifikasi, sesuai dengan data instansi</option>
            <option value="tidak_valid">Tidak valid, perlu diperbaiki</option>
            <option value="diunggah">Belum diperiksa</option>
            <option value="belum_ada">Belum ada dokumen</option>
          </Pilihan>
        )}
      </Bidang>
      <Bidang label="Catatan" opsional={status !== 'tidak_valid'} galat={bidang.catatan}>
        {(a) => <Area {...a} value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3} />}
      </Bidang>
      <Bidang label="Ganti atau tambah berkas" opsional petunjuk="PDF, JPG, atau PNG paling besar 5 MB.">
        {(a) => <PilihBerkas {...a} berkas={berkas} ubah={setBerkas} accept=".pdf,.jpg,.jpeg,.png" />}
      </Bidang>
    </Lembar>
  );
}

function LembarProduk({ umkmId, produk, tutup, selesai }: { umkmId: number; produk: Produk | 'baru' | null; tutup: () => void; selesai: () => Promise<void> }) {
  const toast = useToast();
  const baru = produk === 'baru';
  const [nama, setNama] = useState('');
  const [harga, setHarga] = useState<number | ''>('');
  const [satuan, setSatuan] = useState('pcs');
  const [stokAwal, setStokAwal] = useState('');
  const [aktif, setAktif] = useState(true);
  const { sibuk, galat, bidang, kirim, atur } = useKirim();

  useEffect(() => {
    if (!produk) return;
    atur(null);
    if (produk === 'baru') {
      setNama('');
      setHarga('');
      setSatuan('pcs');
      setStokAwal('');
      setAktif(true);
    } else {
      setNama(produk.nama);
      setHarga(produk.harga);
      setSatuan(produk.satuan);
      setAktif(!!produk.aktif);
    }
  }, [produk, atur]);

  const simpan = async () => {
    const g: Record<string, string> = {};
    if (!nama.trim()) g.nama = 'Nama produk wajib diisi.';
    if (harga === '') g.harga = 'Isi harga jual.';
    if (stokAwal && !/^\d+$/.test(stokAwal)) g.stok_awal = 'Stok awal harus bilangan bulat.';
    if (Object.keys(g).length) return atur('Ada isian yang perlu diperbaiki.', g);
    const ok = await kirim(() =>
      baru
        ? api('POST', '/api/produk', { umkm_id: umkmId, nama, harga, satuan, stok_awal: Number(stokAwal || 0) })
        : api('PATCH', `/api/produk/${(produk as Produk).id}`, { nama, harga, satuan, aktif }),
    );
    if (ok) {
      toast(baru ? `Produk ${nama} ditambahkan.` : `Produk ${nama} diperbarui.`);
      tutup();
      await selesai();
    }
  };

  return (
    <Lembar
      buka={!!produk}
      tutup={tutup}
      judul={baru ? 'Tambah produk' : 'Ubah produk'}
      keterangan={baru ? 'SKU dibuat otomatis dari kode UMKM.' : undefined}
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            {baru ? 'Simpan produk' : 'Simpan perubahan'}
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      <Bidang label="Nama produk" galat={bidang.nama} petunjuk="Sertakan ukuran atau varian, misalnya Kopi Robusta 200 g.">
        {(a) => <Masukan {...a} value={nama} onChange={(e) => setNama(e.target.value)} />}
      </Bidang>
      <div className="kisi-isian">
        <Bidang label="Harga jual" galat={bidang.harga}>
          {(a) => <MasukanRupiah {...a} nilai={harga} ubah={setHarga} />}
        </Bidang>
        <Bidang label="Satuan">
          {(a) => <Masukan {...a} value={satuan} onChange={(e) => setSatuan(e.target.value)} placeholder="pcs, botol, pak" />}
        </Bidang>
      </div>
      {baru ? (
        <Bidang label="Stok awal yang dititipkan" opsional galat={bidang.stok_awal} petunjuk="Dicatat sebagai barang masuk dari UMKM.">
          {(a) => <Masukan {...a} value={stokAwal} onChange={(e) => setStokAwal(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="angka" />}
        </Bidang>
      ) : (
        <label className="centang">
          <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
          <span>
            Produk masih dijual
            <span className="petunjuk" style={{ display: 'block' }}>
              Matikan bila UMKM menarik produk ini. Riwayat penjualannya tetap tersimpan.
            </span>
          </span>
        </label>
      )}
    </Lembar>
  );
}

function LembarDataUmkm({ u, buka, tutup, selesai }: { u: DetailUmkmData; buka: boolean; tutup: () => void; selesai: () => Promise<void> }) {
  const toast = useToast();
  const { info } = useInfo();
  const [d, setD] = useState<Record<string, string>>({});
  const { sibuk, galat, bidang, kirim } = useKirim();

  useEffect(() => {
    if (!buka) return;
    setD({
      nama_usaha: u.namaUsaha,
      pemilik: u.pemilik,
      whatsapp: u.whatsapp,
      email: u.email ?? '',
      alamat: u.alamat,
      kecamatan: u.kecamatan,
      kategori: u.kategori,
      deskripsi: u.deskripsi,
      media_sosial: u.mediaSosial ?? '',
      bank: u.bank ?? '',
      no_rekening: u.noRekening ?? '',
      atas_nama: u.atasNama ?? '',
    });
  }, [buka, u]);

  const p = (k: string) => ({ value: d[k] ?? '', onChange: (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value })) });
  const simpan = async () => {
    const ok = await kirim(() => api('PATCH', `/api/umkm/${u.id}`, d));
    if (ok) {
      toast(`Data ${d.nama_usaha} tersimpan.`);
      tutup();
      await selesai();
    }
  };

  return (
    <Lembar
      buka={buka}
      tutup={tutup}
      judul="Ubah data UMKM"
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            Simpan data UMKM
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      <Bidang label="Nama usaha" galat={bidang.nama_usaha}>
        {(a) => <Masukan {...a} {...p('nama_usaha')} />}
      </Bidang>
      <div className="kisi-isian">
        <Bidang label="Pemilik" galat={bidang.pemilik}>
          {(a) => <Masukan {...a} {...p('pemilik')} />}
        </Bidang>
        <Bidang label="WhatsApp" galat={bidang.whatsapp}>
          {(a) => <Masukan {...a} {...p('whatsapp')} inputMode="tel" />}
        </Bidang>
        <Bidang label="Email" opsional galat={bidang.email}>
          {(a) => <Masukan {...a} {...p('email')} type="email" />}
        </Bidang>
        <Bidang label="Kategori" galat={bidang.kategori}>
          {(a) => (
            <Pilihan {...a} {...p('kategori')}>
              {(info?.kategori ?? []).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Pilihan>
          )}
        </Bidang>
      </div>
      <Bidang label="Alamat" galat={bidang.alamat}>
        {(a) => <Area {...a} {...p('alamat')} rows={2} />}
      </Bidang>
      <div className="kisi-isian">
        <Bidang label="Kecamatan" galat={bidang.kecamatan}>
          {(a) => <Masukan {...a} {...p('kecamatan')} />}
        </Bidang>
        <Bidang label="Media sosial" opsional>
          {(a) => <Masukan {...a} {...p('media_sosial')} />}
        </Bidang>
      </div>
      <Bidang label="Deskripsi" galat={bidang.deskripsi}>
        {(a) => <Area {...a} {...p('deskripsi')} rows={3} />}
      </Bidang>
      <hr className="garis-pemisah" />
      <h3>Rekening pencairan</h3>
      <div className="kisi-isian">
        <Bidang label="Bank" opsional>
          {(a) => <Masukan {...a} {...p('bank')} />}
        </Bidang>
        <Bidang label="Nomor rekening" opsional>
          {(a) => <Masukan {...a} {...p('no_rekening')} inputMode="numeric" />}
        </Bidang>
        <Bidang label="Nama pemilik rekening" opsional className="penuh">
          {(a) => <Masukan {...a} {...p('atas_nama')} />}
        </Bidang>
      </div>
    </Lembar>
  );
}
