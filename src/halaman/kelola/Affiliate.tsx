import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useData } from '../../lib/data';
import { useInfo, useSesi, useToast } from '../../lib/konteks';
import { Area, Bidang, GalatMuat, KepalaHalaman, Konfirmasi, Kosong, Lembar, Masukan, Memuat, Pemberitahuan, Pilihan, Status, Tombol, useJudul, useKirim } from '../../ui/dasar';
import { angka, tampilWa, tanggal, tanggalWib } from '../../../shared/format';
import { PLATFORM_KONTEN, STATUS_AFFILIATE, type StatusAffiliate } from '../../../shared/konstanta';

interface BarisAffiliate {
  id: number;
  nama: string;
  whatsapp: string;
  kecamatan: string | null;
  platform: string;
  akun: string | null;
  status: StatusAffiliate;
  bergabung: string;
  catatan: string | null;
}

const nadaStatus = (s: StatusAffiliate) => (s === 'aktif' ? 'ok' : s === 'jeda' ? 'tunggu' : 'mati');

/** Affiliate Community (Pilar 6): pasukan affiliate lokal yang memperluas jangkauan produk Pasuruan. */
export function Affiliate() {
  useJudul('Affiliate');
  const { pengguna } = useSesi();
  const r = useData<{ daftar: BarisAffiliate[]; hitung: Record<string, number> }>('/api/affiliate');
  const [ubah, setUbah] = useState<BarisAffiliate | 'baru' | null>(null);
  const [hapus, setHapus] = useState<BarisAffiliate | null>(null);
  const hapusan = useKirim();
  const toast = useToast();

  return (
    <>
      <KepalaHalaman
        judul="Affiliate"
        keterangan="Komunitas affiliate lokal yang memasarkan produk UMKM binaan ke seluruh Indonesia. Affiliate aktif dihitung ke target tahun pertama."
        aksi={
          <Tombol ragam="utama" ikon="tambah" onClick={() => setUbah('baru')}>
            Daftarkan affiliate
          </Tombol>
        }
      />
      {r.galat && !r.data && <GalatMuat galat={r.galat} ulang={r.muatUlang} />}
      {!r.data && !r.galat && <Memuat />}
      {r.data && (
        <>
          <dl className="metrik-deret" style={{ ['--kolom' as string]: 3 }}>
            {(Object.keys(STATUS_AFFILIATE) as StatusAffiliate[]).map((s) => (
              <div className="metrik" key={s}>
                <dt>{STATUS_AFFILIATE[s]}</dt>
                <dd>
                  {angka(r.data!.hitung[s] ?? 0)}
                  <span className="satuan">orang</span>
                </dd>
              </div>
            ))}
          </dl>
          {r.data.daftar.length === 0 ? (
            <div className="bingkai-tabel">
              <Kosong
                judul="Belum ada affiliate terdaftar."
                aksi={
                  <Tombol kecil ikon="tambah" onClick={() => setUbah('baru')}>
                    Daftarkan affiliate
                  </Tombol>
                }
              >
                Daftarkan anggota komunitas beserta platform dan akunnya, agar materi promosi dari Content Factory bisa dibagikan tepat sasaran.
              </Kosong>
            </div>
          ) : (
            <div className="bingkai-tabel">
              <table className="tabel tabel-susun">
                <thead>
                  <tr>
                    <th scope="col">Nama</th>
                    <th scope="col">Platform</th>
                    <th scope="col">Kecamatan</th>
                    <th scope="col">Bergabung</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.data.daftar.map((a) => (
                    <tr key={a.id} className={a.status === 'berhenti' ? 'nonaktif' : undefined}>
                      <td data-label="">
                        <span className="tebal">{a.nama}</span>
                        <span className="sub angka">{tampilWa(a.whatsapp)}</span>
                      </td>
                      <td data-label="Platform">
                        {a.platform}
                        {a.akun && <span className="sub">{a.akun}</span>}
                      </td>
                      <td data-label="Kecamatan">{a.kecamatan ?? '—'}</td>
                      <td data-label="Bergabung" className="nowrap">
                        {tanggal(a.bergabung + 'T05:00:00Z')}
                      </td>
                      <td data-label="Status">
                        <Status nada={nadaStatus(a.status)}>{STATUS_AFFILIATE[a.status]}</Status>
                      </td>
                      <td data-label="" className="kanan nowrap">
                        <Tombol kecil ragam="halus" onClick={() => setUbah(a)} aria-label={`Ubah ${a.nama}`}>
                          Ubah
                        </Tombol>
                        {pengguna?.peran === 'admin' && (
                          <Tombol kecil ragam="halus" onClick={() => setHapus(a)} aria-label={`Hapus ${a.nama}`}>
                            Hapus
                          </Tombol>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <LembarAffiliate
        data={ubah}
        tutup={() => setUbah(null)}
        selesai={async () => {
          setUbah(null);
          await r.muatUlang();
        }}
      />
      <Konfirmasi
        buka={!!hapus}
        judul={`Hapus ${hapus?.nama ?? 'affiliate'}?`}
        label="Hapus affiliate"
        ragam="bahaya"
        sibuk={hapusan.sibuk}
        batal={() => setHapus(null)}
        ya={async () => {
          const ok = await hapusan.kirim(() => api('DELETE', `/api/affiliate/${hapus!.id}`));
          if (ok) {
            toast(`${hapus!.nama} dihapus dari daftar affiliate.`);
            setHapus(null);
            await r.muatUlang();
          } else toast('Affiliate belum terhapus. Periksa koneksi, lalu coba lagi.', 'galat');
        }}
      >
        <p>Gunakan hapus hanya untuk data yang salah input. Untuk affiliate yang tidak lagi aktif, ubah statusnya menjadi Berhenti agar riwayatnya tetap tercatat.</p>
      </Konfirmasi>
    </>
  );
}

function LembarAffiliate({ data, tutup, selesai }: { data: BarisAffiliate | 'baru' | null; tutup: () => void; selesai: () => Promise<void> }) {
  const toast = useToast();
  const { info } = useInfo();
  const kosong = { nama: '', whatsapp: '', kecamatan: '', platform: 'TikTok', akun: '', status: 'aktif', bergabung: tanggalWib(), catatan: '' };
  const [v, setV] = useState(kosong);
  const { sibuk, galat, bidang, kirim } = useKirim();
  useEffect(() => {
    if (data === 'baru') setV(kosong);
    else if (data)
      setV({
        nama: data.nama,
        whatsapp: tampilWa(data.whatsapp),
        kecamatan: data.kecamatan ?? '',
        platform: data.platform,
        akun: data.akun ?? '',
        status: data.status,
        bergabung: data.bergabung,
        catatan: data.catatan ?? '',
      });
  }, [data]);
  const atur = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const lama = data && data !== 'baru' ? data : null;
  const simpan = async () => {
    const ok = await kirim(() => (lama ? api('PUT', `/api/affiliate/${lama.id}`, v) : api('POST', '/api/affiliate', v)));
    if (ok) {
      toast(lama ? `Data ${v.nama} tersimpan.` : `${v.nama} terdaftar sebagai affiliate.`);
      await selesai();
    }
  };
  return (
    <Lembar
      buka={!!data}
      tutup={tutup}
      judul={lama ? `Ubah ${lama.nama}` : 'Daftarkan affiliate'}
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            {lama ? 'Simpan perubahan' : 'Daftarkan'}
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      <Bidang label="Nama lengkap" galat={bidang.nama}>
        {(a) => <Masukan {...a} value={v.nama} onChange={atur('nama')} maxLength={120} autoComplete="off" />}
      </Bidang>
      <div className="kisi-isian">
        <Bidang label="Nomor WhatsApp" galat={bidang.whatsapp}>
          {(a) => <Masukan {...a} value={v.whatsapp} onChange={atur('whatsapp')} inputMode="tel" placeholder="0812 3456 7890" />}
        </Bidang>
        <Bidang label="Kecamatan" opsional galat={bidang.kecamatan}>
          {(a) => (
            <Pilihan {...a} value={v.kecamatan} onChange={atur('kecamatan')}>
              <option value="">Pilih kecamatan</option>
              {(info?.kecamatan ?? []).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Pilihan>
          )}
        </Bidang>
        <Bidang label="Platform utama" galat={bidang.platform}>
          {(a) => (
            <Pilihan {...a} value={v.platform} onChange={atur('platform')}>
              {PLATFORM_KONTEN.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Pilihan>
          )}
        </Bidang>
        <Bidang label="Nama akun" opsional galat={bidang.akun}>
          {(a) => <Masukan {...a} value={v.akun} onChange={atur('akun')} maxLength={80} placeholder="@namaakun" />}
        </Bidang>
        <Bidang label="Tanggal bergabung" galat={bidang.bergabung}>
          {(a) => <Masukan {...a} type="date" value={v.bergabung} max={tanggalWib()} onChange={atur('bergabung')} />}
        </Bidang>
        <Bidang label="Status" galat={bidang.status}>
          {(a) => (
            <Pilihan {...a} value={v.status} onChange={atur('status')}>
              {Object.entries(STATUS_AFFILIATE).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Pilihan>
          )}
        </Bidang>
      </div>
      <Bidang label="Catatan" opsional galat={bidang.catatan}>
        {(a) => <Area {...a} value={v.catatan} onChange={atur('catatan')} rows={3} maxLength={500} />}
      </Bidang>
    </Lembar>
  );
}
