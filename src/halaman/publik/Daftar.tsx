import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useInfo, useToast } from '../../lib/konteks';
import { api } from '../../lib/api';
import { Area, Bidang, Masukan, Pemberitahuan, PilihBerkas, Pilihan, Tombol, useJudul, useKirim } from '../../ui/dasar';
import { Ikon } from '../../ui/Ikon';
import { normalisasiWa, tautanWa, tampilWa } from '../../../shared/format';
import { BATAS_BERKAS_BYTE } from '../../../shared/konstanta';

type Isian = Record<string, string>;

const AWAL: Isian = {
  nama_usaha: '',
  kategori: '',
  deskripsi: '',
  media_sosial: '',
  pemilik: '',
  whatsapp: '',
  email: '',
  alamat: '',
  kecamatan: '',
  bank: '',
  no_rekening: '',
  atas_nama: '',
};

const BAGIAN = [
  ['usaha', 'Tentang usaha'],
  ['kontak', 'Pemilik dan kontak'],
  ['lokasi', 'Lokasi usaha'],
  ['izin', 'Dokumen izin'],
  ['rekening', 'Rekening pencairan'],
] as const;

function periksaLokal(d: Isian, setuju: boolean, berkas: Record<string, File | null>, nomor: Record<string, string>, instansi: { kunci: string; dokumen: string; wajib: boolean }[]) {
  const g: Record<string, string> = {};
  if (!d.nama_usaha.trim()) g.nama_usaha = 'Nama usaha wajib diisi.';
  if (!d.kategori) g.kategori = 'Pilih kategori usaha.';
  if (d.deskripsi.trim().length < 20) g.deskripsi = 'Ceritakan produk Anda minimal 20 karakter.';
  if (!d.pemilik.trim()) g.pemilik = 'Nama pemilik wajib diisi.';
  if (!d.whatsapp.trim()) g.whatsapp = 'Nomor WhatsApp wajib diisi.';
  else if (!/^628\d{7,12}$/.test(normalisasiWa(d.whatsapp))) g.whatsapp = 'Nomor WhatsApp tidak dikenali. Tulis seperti 0812 3456 7890.';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) g.email = 'Alamat email tidak valid. Contoh: nama@contoh.id';
  if (!d.alamat.trim()) g.alamat = 'Alamat usaha wajib diisi.';
  if (!d.kecamatan.trim()) g.kecamatan = 'Kecamatan wajib diisi.';
  for (const i of instansi) {
    const f = berkas[i.kunci];
    if (f && f.size > BATAS_BERKAS_BYTE) g[`izin_${i.kunci}_berkas`] = 'Berkas lebih dari 5 MB. Perkecil ukurannya lalu pilih ulang.';
    else if (f && !/\.(pdf|jpe?g|png)$/i.test(f.name)) g[`izin_${i.kunci}_berkas`] = 'Gunakan berkas PDF, JPG, atau PNG.';
    if (i.wajib && !f && !nomor[i.kunci]?.trim()) g[`izin_${i.kunci}_nomor`] = `${i.dokumen} wajib dilampirkan. Isi nomornya atau unggah berkasnya.`;
  }
  if (!setuju) g.persetujuan = 'Centang pernyataan ini untuk melanjutkan.';
  return g;
}

export function Daftar() {
  useJudul('Daftarkan usaha');
  const { info } = useInfo();
  const navigasi = useNavigate();
  const [d, setD] = useState<Isian>(AWAL);
  const [setuju, setSetuju] = useState(false);
  const [berkas, setBerkas] = useState<Record<string, File | null>>({});
  const [nomor, setNomor] = useState<Record<string, string>>({});
  const { sibuk, galat, bidang, kirim, atur } = useKirim();
  const ringkasan = useRef<HTMLDivElement>(null);
  const instansi = info?.instansi ?? [];

  const ubah = (k: string) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));
  const p = (k: string) => ({ value: d[k], onChange: ubah(k), name: k });

  const fokusGalat = (g: Record<string, string>) => {
    requestAnimationFrame(() => {
      const pertama = Object.keys(g)[0];
      const el = document.querySelector<HTMLElement>(`[name="${pertama}"]`);
      if (el) el.focus();
      else ringkasan.current?.focus();
    });
  };

  const kirimFormulir = async (e: FormEvent) => {
    e.preventDefault();
    const g = periksaLokal(d, setuju, berkas, nomor, instansi);
    if (Object.keys(g).length) {
      atur('Ada isian yang perlu diperbaiki. Periksa kolom yang ditandai.', g);
      fokusGalat(g);
      return;
    }
    const f = new FormData();
    Object.entries(d).forEach(([k, v]) => f.append(k, v));
    f.append('persetujuan', 'ya');
    for (const i of instansi) {
      if (nomor[i.kunci]) f.append(`izin_${i.kunci}_nomor`, nomor[i.kunci]);
      const b = berkas[i.kunci];
      if (b) f.append(`izin_${i.kunci}_berkas`, b);
    }
    const hasil = await kirim(() => api<{ kode: string }>('POST', '/api/publik/daftar', f));
    if (hasil) navigasi(`/daftar/terkirim/${hasil.kode}`);
    else requestAnimationFrame(() => ringkasan.current?.focus());
  };

  return (
    <div className="halaman-formulir">
      <aside className="formulir-samping">
        <h1>Daftarkan usaha Anda</h1>
        <p className="redup">Sekitar sepuluh menit. Data Anda hanya dipakai untuk kurasi dan pencairan hasil penjualan.</p>
        <nav aria-label="Bagian formulir">
          <ol>
            {BAGIAN.map(([id, label], i) => (
              <li key={id}>
                <a href={`#${id}`}>
                  <span className="angka">{i + 1}</span>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>

      <form className="formulir" onSubmit={kirimFormulir} noValidate>
        <div ref={ringkasan} tabIndex={-1} className="ringkasan-galat">
          {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
        </div>

        <fieldset id="usaha">
          <legend>
            <span className="angka">1</span> Tentang usaha
          </legend>
          <div className="kisi-isian">
            <Bidang label="Nama usaha" galat={bidang.nama_usaha} className="penuh">
              {(a) => <Masukan {...a} {...p('nama_usaha')} autoComplete="organization" />}
            </Bidang>
            <Bidang label="Kategori" galat={bidang.kategori}>
              {(a) => (
                <Pilihan {...a} {...p('kategori')}>
                  <option value="">Pilih kategori</option>
                  {(info?.kategori ?? []).map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </Pilihan>
              )}
            </Bidang>
            <Bidang label="Akun media sosial atau toko daring" opsional petunjuk="Misalnya @kopilereng atau tautan toko.">
              {(a) => <Masukan {...a} {...p('media_sosial')} />}
            </Bidang>
            <Bidang
              label="Ceritakan produk Anda"
              galat={bidang.deskripsi}
              className="penuh"
              petunjuk="Apa yang dijual, bahan utamanya, dan berapa banyak yang bisa Anda produksi per minggu."
            >
              {(a) => <Area {...a} {...p('deskripsi')} rows={4} maxLength={1500} />}
            </Bidang>
          </div>
        </fieldset>

        <fieldset id="kontak">
          <legend>
            <span className="angka">2</span> Pemilik dan kontak
          </legend>
          <div className="kisi-isian">
            <Bidang label="Nama pemilik" galat={bidang.pemilik} className="penuh">
              {(a) => <Masukan {...a} {...p('pemilik')} autoComplete="name" />}
            </Bidang>
            <Bidang label="Nomor WhatsApp" galat={bidang.whatsapp} petunjuk="Hasil kurasi dikabarkan lewat nomor ini.">
              {(a) => <Masukan {...a} {...p('whatsapp')} inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" />}
            </Bidang>
            <Bidang label="Email" opsional galat={bidang.email}>
              {(a) => <Masukan {...a} {...p('email')} type="email" autoComplete="email" />}
            </Bidang>
          </div>
        </fieldset>

        <fieldset id="lokasi">
          <legend>
            <span className="angka">3</span> Lokasi usaha
          </legend>
          <div className="kisi-isian">
            <Bidang label="Alamat" galat={bidang.alamat} className="penuh">
              {(a) => <Area {...a} {...p('alamat')} rows={2} autoComplete="street-address" />}
            </Bidang>
            <Bidang label="Kecamatan" galat={bidang.kecamatan}>
              {(a) => <Masukan {...a} {...p('kecamatan')} list="daftar-kecamatan" autoComplete="address-level3" />}
            </Bidang>
            <datalist id="daftar-kecamatan">
              {(info?.kecamatan ?? []).map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </div>
        </fieldset>

        <fieldset id="izin">
          <legend>
            <span className="angka">4</span> Dokumen izin
          </legend>
          <p className="redup kecil">Isi nomor izin, unggah berkasnya, atau keduanya. Berkas PDF, JPG, atau PNG paling besar 5 MB.</p>
          <div className="daftar-izin">
            {instansi.map((i) => (
              <div key={i.kunci} className="izin-baris">
                <div className="izin-judul">
                  <h3>{i.dokumen}</h3>
                  <p className="redup kecil">
                    {i.instansi || 'Instansi penerbit akan diumumkan'} · {i.wajib ? 'wajib' : 'bila ada'}
                  </p>
                </div>
                <Bidang label="Nomor izin" galat={bidang[`izin_${i.kunci}_nomor`]} opsional={!i.wajib}>
                  {(a) => (
                    <Masukan
                      {...a}
                      name={`izin_${i.kunci}_nomor`}
                      value={nomor[i.kunci] ?? ''}
                      onChange={(e) => setNomor((x) => ({ ...x, [i.kunci]: e.target.value }))}
                    />
                  )}
                </Bidang>
                <Bidang label="Berkas" opsional galat={bidang[`izin_${i.kunci}_berkas`]}>
                  {(a) => (
                    <PilihBerkas
                      {...a}
                      name={`izin_${i.kunci}_berkas`}
                      berkas={berkas[i.kunci] ?? null}
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      ubah={(f) => setBerkas((x) => ({ ...x, [i.kunci]: f }))}
                    />
                  )}
                </Bidang>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset id="rekening">
          <legend>
            <span className="angka">5</span> Rekening pencairan
          </legend>
          <p className="redup kecil">Boleh dilengkapi nanti, tetapi wajib ada sebelum dana pertama disalurkan.</p>
          <div className="kisi-isian">
            <Bidang label="Bank" opsional>
              {(a) => <Masukan {...a} {...p('bank')} placeholder="Misalnya Bank Jatim" />}
            </Bidang>
            <Bidang label="Nomor rekening" opsional>
              {(a) => <Masukan {...a} {...p('no_rekening')} inputMode="numeric" />}
            </Bidang>
            <Bidang label="Nama pemilik rekening" opsional className="penuh">
              {(a) => <Masukan {...a} {...p('atas_nama')} />}
            </Bidang>
          </div>
        </fieldset>

        <div className="formulir-akhir">
          <label className="centang">
            <input type="checkbox" name="persetujuan" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} aria-invalid={bidang.persetujuan ? true : undefined} />
            <span>Saya menyatakan data dan dokumen yang saya kirim benar, dan bersedia dihubungi tim PCC untuk proses kurasi.</span>
          </label>
          {bidang.persetujuan && (
            <p className="pesan-galat">
              <Ikon nama="peringatan" />
              <span>{bidang.persetujuan}</span>
            </p>
          )}
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            Kirim pendaftaran
          </Tombol>
        </div>
      </form>
    </div>
  );
}

export function DaftarTerkirim() {
  useJudul('Pendaftaran terkirim');
  const { kode = '' } = useParams();
  const { info } = useInfo();
  const toast = useToast();
  const wa = info?.organisasi.whatsapp;
  const salin = async () => {
    try {
      await navigator.clipboard.writeText(kode);
      toast('Kode pendaftaran tersalin.');
    } catch {
      toast('Kode tidak bisa disalin otomatis. Catat kode secara manual.', 'galat');
    }
  };
  return (
    <div className="halaman-sempit terkirim">
      <p className="tanda-berhasil">
        <Ikon nama="centang" />
        Pendaftaran diterima
      </p>
      <h1>Terima kasih. Tim kurasi akan meninjau usaha Anda.</h1>
      <div className="kode-besar">
        <span className="redup kecil">Kode pendaftaran</span>
        <strong className="angka">{kode}</strong>
        <Tombol kecil onClick={salin}>
          Salin kode
        </Tombol>
      </div>
      <ol className="langkah-lanjut">
        <li>Simpan kode ini. Anda memerlukannya untuk mengecek status bersama nomor WhatsApp yang didaftarkan.</li>
        <li>Tim PCC memeriksa dokumen izin dan menilai produk. Bila ada yang perlu diperbaiki, kami kabari lewat WhatsApp.</li>
        <li>Setelah diterima, Anda dijadwalkan menitipkan stok pertama di gudang konsinyasi.</li>
      </ol>
      <div className="deret-tombol">
        <Link to="/status" className="tombol tombol-utama">
          Cek status pendaftaran
        </Link>
        {wa && (
          <a className="tombol tombol-kedua" href={tautanWa(wa, `Halo PCC, saya baru mendaftar dengan kode ${kode}.`)} target="_blank" rel="noopener noreferrer">
            Hubungi {tampilWa(wa)}
          </a>
        )}
      </div>
    </div>
  );
}
