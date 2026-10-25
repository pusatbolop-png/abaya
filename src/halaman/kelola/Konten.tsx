import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { useData } from '../../lib/data';
import { useToast } from '../../lib/konteks';
import { Bidang, GalatMuat, KepalaHalaman, Konfirmasi, Kosong, Lembar, Masukan, Memuat, Pemberitahuan, Pilihan, Tombol, useJudul, useKirim } from '../../ui/dasar';
import { angka, tanggal, tanggalWib } from '../../../shared/format';
import { JENIS_KONTEN, PLATFORM_KONTEN, type JenisKonten } from '../../../shared/konstanta';

interface BarisKonten {
  id: number;
  jenis: JenisKonten;
  judul: string;
  platform: string | null;
  tautan: string | null;
  tanggal: string;
  umkmId: number | null;
  namaUsaha: string | null;
  produk: string | null;
}

const namaBulan = (b: string) => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(b + '-01T00:00:00Z'));

/** Content Factory (Pilar 4): catatan konten yang diproduksi untuk UMKM binaan. */
export function Konten() {
  useJudul('Content Factory');
  const [cari, setCari] = useSearchParams();
  const bulan = cari.get('bulan') ?? tanggalWib().slice(0, 7);
  const r = useData<{ daftar: BarisKonten[]; hitung: Record<string, number> }>(`/api/konten?bulan=${bulan}`);
  const [baru, setBaru] = useState(cari.get('baru') === '1');
  const [hapus, setHapus] = useState<BarisKonten | null>(null);
  const hapusan = useKirim();
  const toast = useToast();
  const total = Object.values(r.data?.hitung ?? {}).reduce((a, b) => a + b, 0);

  return (
    <>
      <KepalaHalaman
        judul="Content Factory"
        keterangan="Catat setiap video pendek, foto produk, UGC, dan materi affiliate yang diproduksi. Jumlahnya dihitung ke target konten tahunan."
        aksi={
          <Tombol ragam="utama" ikon="tambah" onClick={() => setBaru(true)}>
            Catat konten
          </Tombol>
        }
      />
      <div className="bilah-saring">
        <label className="label-sebaris">
          <span>Bulan</span>
          <Masukan type="month" value={bulan} max={tanggalWib().slice(0, 7)} onChange={(e) => e.target.value && setCari({ bulan: e.target.value }, { replace: true })} />
        </label>
      </div>
      {r.galat && !r.data && <GalatMuat galat={r.galat} ulang={r.muatUlang} />}
      {!r.data && !r.galat && <Memuat />}
      {r.data && (
        <>
          <dl className="metrik-deret" style={{ ['--kolom' as string]: 5 }}>
            <div className="metrik">
              <dt>Total {namaBulan(bulan)}</dt>
              <dd>{angka(total)}</dd>
            </div>
            {(Object.keys(JENIS_KONTEN) as JenisKonten[]).map((j) => (
              <div className="metrik" key={j}>
                <dt>{JENIS_KONTEN[j]}</dt>
                <dd>{angka(r.data!.hitung[j] ?? 0)}</dd>
              </div>
            ))}
          </dl>
          {r.data.daftar.length === 0 ? (
            <div className="bingkai-tabel">
              <Kosong
                judul={`Belum ada konten tercatat pada ${namaBulan(bulan)}.`}
                aksi={
                  <Tombol kecil ikon="tambah" onClick={() => setBaru(true)}>
                    Catat konten
                  </Tombol>
                }
              >
                Setiap konten yang selesai diproduksi atau tayang dicatat di sini, lengkap dengan UMKM, produk, dan tautannya.
              </Kosong>
            </div>
          ) : (
            <div className="bingkai-tabel">
              <table className="tabel tabel-susun">
                <thead>
                  <tr>
                    <th scope="col">Konten</th>
                    <th scope="col">Jenis</th>
                    <th scope="col">UMKM dan produk</th>
                    <th scope="col">Tanggal</th>
                    <th scope="col">
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.data.daftar.map((k) => (
                    <tr key={k.id}>
                      <td data-label="">
                        {k.tautan ? (
                          <a href={k.tautan} target="_blank" rel="noopener noreferrer" className="tebal">
                            {k.judul}
                          </a>
                        ) : (
                          <span className="tebal">{k.judul}</span>
                        )}
                        {k.platform && <span className="sub">{k.platform}</span>}
                      </td>
                      <td data-label="Jenis">{JENIS_KONTEN[k.jenis] ?? k.jenis}</td>
                      <td data-label="UMKM">
                        {k.namaUsaha ?? <span className="redup">Konten PCC</span>}
                        {k.produk && <span className="sub">{k.produk}</span>}
                      </td>
                      <td data-label="Tanggal" className="nowrap">
                        {tanggal(k.tanggal + 'T05:00:00Z')}
                      </td>
                      <td data-label="" className="kanan">
                        <Tombol kecil ragam="halus" onClick={() => setHapus(k)} aria-label={`Hapus ${k.judul}`}>
                          Hapus
                        </Tombol>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <LembarKonten
        buka={baru}
        tutup={() => setBaru(false)}
        selesai={async (b) => {
          setBaru(false);
          if (b !== bulan) setCari({ bulan: b }, { replace: true });
          else await r.muatUlang();
        }}
      />
      <Konfirmasi
        buka={!!hapus}
        judul="Hapus catatan konten?"
        label="Hapus catatan"
        ragam="bahaya"
        sibuk={hapusan.sibuk}
        batal={() => setHapus(null)}
        ya={async () => {
          const ok = await hapusan.kirim(() => api('DELETE', `/api/konten/${hapus!.id}`));
          if (ok) {
            toast(`Catatan "${hapus!.judul}" dihapus.`);
            setHapus(null);
            await r.muatUlang();
          } else toast('Catatan belum terhapus. Periksa koneksi, lalu coba lagi.', 'galat');
        }}
      >
        <p>“{hapus?.judul}” tidak lagi dihitung ke target konten. Kontennya sendiri di platform tidak terpengaruh.</p>
      </Konfirmasi>
    </>
  );
}

function LembarKonten({ buka, tutup, selesai }: { buka: boolean; tutup: () => void; selesai: (bulan: string) => Promise<void> }) {
  const toast = useToast();
  const kosong = { jenis: 'video', judul: '', umkm: '', produk: '', platform: 'TikTok', tautan: '', tanggal: tanggalWib(), jumlah: '1' };
  const [v, setV] = useState(kosong);
  const umkm = useData<{ daftar: { id: number; namaUsaha: string }[] }>(buka ? '/api/umkm?status=diterima' : null);
  const produk = useData<{ daftar: { id: number; nama: string }[] }>(buka && v.umkm ? `/api/produk?umkm_id=${v.umkm}` : null);
  const { sibuk, galat, bidang, kirim } = useKirim();
  const atur = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value, ...(k === 'umkm' ? { produk: '' } : {}) }));
  const simpan = async () => {
    const ok = await kirim(() =>
      api('POST', '/api/konten', {
        jenis: v.jenis,
        judul: v.judul,
        umkm_id: v.umkm ? Number(v.umkm) : null,
        produk_id: v.produk ? Number(v.produk) : null,
        platform: v.platform || null,
        tautan: v.tautan,
        tanggal: v.tanggal,
        jumlah: Number(v.jumlah) || 1,
      }),
    );
    if (ok) {
      toast(Number(v.jumlah) > 1 ? `${v.jumlah} konten tercatat.` : 'Konten tercatat.');
      const b = v.tanggal.slice(0, 7);
      setV(kosong);
      await selesai(b);
    }
  };
  return (
    <Lembar
      buka={buka}
      tutup={tutup}
      judul="Catat konten"
      keterangan="Satu catatan untuk satu konten. Gunakan jumlah bila beberapa konten serupa selesai sekaligus."
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            Simpan konten
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      <Bidang label="Judul atau topik" galat={bidang.judul}>
        {(a) => <Masukan {...a} value={v.judul} onChange={atur('judul')} maxLength={160} placeholder="Contoh: Unboxing kopi robusta Arjuno" />}
      </Bidang>
      <div className="kisi-isian">
        <Bidang label="Jenis konten" galat={bidang.jenis}>
          {(a) => (
            <Pilihan {...a} value={v.jenis} onChange={atur('jenis')}>
              {Object.entries(JENIS_KONTEN).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Pilihan>
          )}
        </Bidang>
        <Bidang label="Platform" galat={bidang.platform}>
          {(a) => (
            <Pilihan {...a} value={v.platform} onChange={atur('platform')}>
              {PLATFORM_KONTEN.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Pilihan>
          )}
        </Bidang>
        <Bidang label="UMKM" opsional galat={bidang.umkm_id}>
          {(a) => (
            <Pilihan {...a} value={v.umkm} onChange={atur('umkm')}>
              <option value="">Konten umum PCC</option>
              {umkm.data?.daftar.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.namaUsaha}
                </option>
              ))}
            </Pilihan>
          )}
        </Bidang>
        <Bidang label="Produk" opsional galat={bidang.produk_id}>
          {(a) => (
            <Pilihan {...a} value={v.produk} onChange={atur('produk')} disabled={!v.umkm}>
              <option value="">{v.umkm ? 'Semua produk' : 'Pilih UMKM dulu'}</option>
              {produk.data?.daftar.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama}
                </option>
              ))}
            </Pilihan>
          )}
        </Bidang>
        <Bidang label="Tanggal selesai atau tayang" galat={bidang.tanggal}>
          {(a) => <Masukan {...a} type="date" value={v.tanggal} max={tanggalWib()} onChange={atur('tanggal')} />}
        </Bidang>
        <Bidang label="Jumlah konten" galat={bidang.jumlah}>
          {(a) => <Masukan {...a} value={v.jumlah} inputMode="numeric" className="angka" onChange={(e) => setV((x) => ({ ...x, jumlah: e.target.value.replace(/\D/g, '').slice(0, 2) }))} />}
        </Bidang>
      </div>
      <Bidang label="Tautan konten" opsional galat={bidang.tautan}>
        {(a) => <Masukan {...a} type="url" value={v.tautan} onChange={atur('tautan')} placeholder="https://" />}
      </Bidang>
    </Lembar>
  );
}
