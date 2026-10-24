import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useData } from '../../lib/data';
import { useInfo, useToast } from '../../lib/konteks';
import { GalatMuat, KepalaHalaman, Kosong, Masukan, Memuat, onKlikBaris, Status, Tombol } from '../../ui/dasar';
import { Ikon } from '../../ui/Ikon';
import { tanggal } from '../../../shared/format';
import { STATUS_UMKM, type StatusUmkm } from '../../../shared/konstanta';

interface Baris {
  id: number;
  kode: string;
  namaUsaha: string;
  pemilik: string;
  kategori: string;
  kecamatan: string;
  status: StatusUmkm;
  dibuat: string;
  izinTerverifikasi: number;
  izinMenunggu: number;
  jumlahProduk: number;
}

export const nadaUmkm = (s: StatusUmkm) => (s === 'diterima' ? 'ok' : s === 'ditolak' ? 'mati' : s === 'perlu_perbaikan' ? 'galat' : 'tunggu');

export function DaftarUmkm() {
  const [cari, setCari] = useSearchParams();
  const status = cari.get('status') ?? '';
  const [q, setQ] = useState(cari.get('q') ?? '');
  const navigasi = useNavigate();
  const toast = useToast();
  const { info } = useInfo();
  const url = `/api/umkm?${new URLSearchParams({ ...(status && { status }), ...(cari.get('q') && { q: cari.get('q')! }) })}`;
  const r = useData<{ daftar: Baris[]; hitung: Record<string, number> }>(url);
  const total = Object.values(r.data?.hitung ?? {}).reduce((a, b) => a + b, 0);
  const jumlahIzin = info?.instansi.length ?? 3;

  const salinTautan = async () => {
    const tautan = `${window.location.origin}/daftar`;
    try {
      await navigator.clipboard.writeText(tautan);
      toast('Tautan formulir pendaftaran tersalin.');
    } catch {
      toast(`Salin tautan ini secara manual: ${tautan}`, 'galat');
    }
  };

  const aturStatus = (s: string) => {
    const b = new URLSearchParams(cari);
    if (s) b.set('status', s);
    else b.delete('status');
    setCari(b, { replace: true });
  };

  return (
    <>
      <KepalaHalaman
        judul="UMKM dan seleksi"
        keterangan="Tinjau pendaftaran, verifikasi dokumen izin, dan putuskan hasil kurasi."
        aksi={
          <Tombol ikon="berkas" onClick={salinTautan}>
            Salin tautan formulir
          </Tombol>
        }
      />
      <div className="bilah-saring">
        <div className="segmen" role="group" aria-label="Saring menurut status">
          <button type="button" aria-pressed={!status} onClick={() => aturStatus('')}>
            Semua <span className="hitung">{total}</span>
          </button>
          {(Object.keys(STATUS_UMKM) as StatusUmkm[]).map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => aturStatus(s)}>
              {STATUS_UMKM[s]} <span className="hitung">{r.data?.hitung[s] ?? 0}</span>
            </button>
          ))}
        </div>
        <form
          role="search"
          className="kotak-cari"
          onSubmit={(e) => {
            e.preventDefault();
            const b = new URLSearchParams(cari);
            if (q.trim()) b.set('q', q.trim());
            else b.delete('q');
            setCari(b, { replace: true });
          }}
        >
          <Ikon nama="cari" />
          <Masukan aria-label="Cari nama usaha, pemilik, atau kode" placeholder="Cari nama usaha, pemilik, atau kode" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </div>

      {r.galat && !r.data && <GalatMuat galat={r.galat} ulang={r.muatUlang} />}
      {!r.data && !r.galat && <Memuat />}
      {r.data && r.data.daftar.length === 0 && (
        <div className="bingkai-tabel">
          {total === 0 ? (
            <Kosong
              judul="Belum ada pendaftaran UMKM."
              aksi={
                <Tombol kecil ikon="berkas" onClick={salinTautan}>
                  Salin tautan formulir
                </Tombol>
              }
            >
              Bagikan tautan formulir pendaftaran ke UMKM binaan. Pendaftaran yang masuk akan muncul di sini untuk diseleksi.
            </Kosong>
          ) : (
            <Kosong
              judul="Tidak ada UMKM yang cocok."
              aksi={
                <Tombol
                  kecil
                  onClick={() => {
                    setQ('');
                    setCari({}, { replace: true });
                  }}
                >
                  Tampilkan semua UMKM
                </Tombol>
              }
            >
              Ubah kata kunci atau pilih status lain.
            </Kosong>
          )}
        </div>
      )}
      {r.data && r.data.daftar.length > 0 && (
        <div className="bingkai-tabel">
          <table className="tabel tabel-susun">
            <thead>
              <tr>
                <th scope="col">Usaha</th>
                <th scope="col">Kategori</th>
                <th scope="col">Dokumen izin</th>
                <th scope="col" className="angka">
                  Produk
                </th>
                <th scope="col">Status</th>
                <th scope="col">Terdaftar</th>
              </tr>
            </thead>
            <tbody>
              {r.data.daftar.map((u) => (
                <tr key={u.id} {...onKlikBaris(navigasi, `/kelola/umkm/${u.id}`)}>
                  <td data-label="">
                    <Link to={`/kelola/umkm/${u.id}`} className="utama">
                      {u.namaUsaha}
                    </Link>
                    <span className="sub">
                      {u.pemilik} · <span className="mono">{u.kode}</span>
                    </span>
                  </td>
                  <td data-label="Kategori">
                    {u.kategori}
                    <span className="sub">{u.kecamatan}</span>
                  </td>
                  <td data-label="Dokumen izin">
                    <span className="angka">
                      {u.izinTerverifikasi} dari {jumlahIzin} terverifikasi
                    </span>
                    {u.izinMenunggu > 0 && <span className="sub">{u.izinMenunggu} menunggu diperiksa</span>}
                  </td>
                  <td data-label="Produk" className="angka">
                    {u.jumlahProduk}
                  </td>
                  <td data-label="Status">
                    <Status nada={nadaUmkm(u.status)}>{STATUS_UMKM[u.status]}</Status>
                  </td>
                  <td data-label="Terdaftar" className="nowrap">
                    {tanggal(u.dibuat)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
