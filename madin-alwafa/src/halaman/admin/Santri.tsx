import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRightLeft, IdCard, Search, UserPlus, Users, X } from 'lucide-react';
import { urlFoto } from '../../lib/foto';
import { kirim } from '../../lib/api';
import { usePakai } from '../../lib/pakai';
import { useSaringan } from '../../lib/saringan';
import { useSesi } from '../../lib/sesi';
import { useToast } from '../../lib/toast';
import type { Kelas, Santri } from '../../lib/tipe';
import { Avatar, GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, Tombol, useJudul } from '../../ui/dasar';
import { FormSantri, KartuAkun, TampilAkun, type AkunBaru } from './santri-form';
import { PitaPendaftaran } from './Pendaftaran';
import { STATUS_SANTRI } from '../../../shared/konstanta';
import { waktu } from '../../../shared/format';

export default function DaftarSantri() {
  useJudul('Data santri');
  const { pengurus } = useSesi();
  const admin = pengurus?.peran === 'admin';
  const toast = useToast();
  const navigasi = useNavigate();
  const [param, aturParam] = useSaringan();
  const q = param.get('q') ?? '';
  const kelas = param.get('kelas') ?? '';
  const jk = param.get('jk') ?? '';
  const status = param.get('status') ?? 'aktif';
  const disaring = !!(q || kelas || jk || status !== 'aktif');
  const atur = (k: string, v: string) => aturParam({ [k]: v });
  const [cari, setCari] = useState(q);
  // Selaraskan kotak cari bila alamat berubah dari luar (tombol kembali, tautan).
  useEffect(() => setCari(q), [q]);

  const url = `/api/admin/santri?${new URLSearchParams({ q, kelas, jk, status }).toString()}`;
  const { data, galat, memuat, muatUlang } = usePakai<{ daftar: Santri[]; hitung: { total: number; putra: number; putri: number } }>(url);
  const { data: dataKelas } = usePakai<{ daftar: Kelas[] }>('/api/admin/kelas');

  const [form, setForm] = useState<'baru' | null>(null);
  const [akun, setAkun] = useState<AkunBaru | null>(null);
  const [kartu, setKartu] = useState(false);
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  const [tujuan, setTujuan] = useState('');
  const [sibukMassal, setSibukMassal] = useState(false);

  const daftar = useMemo(() => data?.daftar ?? [], [data]);
  const semuaDipilih = daftar.length > 0 && daftar.every((s) => pilih.has(s.id));

  const terapkanMassal = async () => {
    if (!tujuan) return;
    setSibukMassal(true);
    try {
      const [jenis, nilai] = tujuan.split(':');
      const isi = jenis === 'kelas' ? { ids: [...pilih], kelasId: nilai === 'kosong' ? null : Number(nilai) } : { ids: [...pilih], status: nilai };
      const r = await kirim<{ jumlah: number }>('POST', '/api/admin/santri/massal', isi);
      toast.tampil(`${r.jumlah} santri diperbarui.`);
      setPilih(new Set());
      setTujuan('');
      muatUlang();
    } catch (e) {
      toast.galat(e);
    } finally {
      setSibukMassal(false);
    }
  };

  return (
    <>
      <KepalaHalaman
        kecil="Santri & santriwati"
        judul="Data santri"
        sub={data ? `${data.hitung.total} santri aktif · ${data.hitung.putra} putra · ${data.hitung.putri} putri` : 'Memuat…'}
        aksi={
          admin && (
            <>
              <Tombol ikon={<IdCard />} onClick={() => setKartu(true)}>
                Kartu akun wali
              </Tombol>
              <Tombol varian="utama" ikon={<UserPlus />} onClick={() => setForm('baru')}>
                Tambah santri
              </Tombol>
            </>
          )
        }
      />

      <div className="saringan">
        <form
          className="masukan-ikon"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            atur('q', cari.trim());
          }}
        >
          <Search />
          <input className="masukan" value={cari} onChange={(e) => setCari(e.target.value)} onBlur={() => atur('q', cari.trim())} placeholder="Cari nama, NIS, atau wali" aria-label="Cari santri" />
        </form>
        <select className="masukan" value={kelas} onChange={(e) => atur('kelas', e.target.value)} aria-label="Kelas">
          <option value="">Semua kelas</option>
          {dataKelas?.daftar.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nama}
            </option>
          ))}
          <option value="tanpa">Belum masuk kelas</option>
        </select>
        <div className="segmen" role="tablist" aria-label="Jenis">
          {[
            ['', 'Semua'],
            ['L', 'Putra'],
            ['P', 'Putri'],
          ].map(([v, l]) => (
            <button key={v} role="tab" aria-selected={jk === v} onClick={() => atur('jk', v)}>
              {l}
            </button>
          ))}
        </div>
        <select className="masukan" value={status} onChange={(e) => atur('status', e.target.value === 'aktif' ? '' : e.target.value)} aria-label="Status">
          {Object.entries(STATUS_SANTRI).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
          <option value="semua">Semua status</option>
        </select>
      </div>

      {admin && <PitaPendaftaran berubah={muatUlang} />}

      {admin && pilih.size > 0 && (
        <div className="kaca kaca--rapat bilah-massal">
          <b>{pilih.size} dipilih</b>
          <select className="masukan masukan--kecil" value={tujuan} onChange={(e) => setTujuan(e.target.value)} aria-label="Tindakan massal">
            <option value="">Pilih tindakan…</option>
            <optgroup label="Pindahkan ke kelas">
              {dataKelas?.daftar
                .filter((k) => k.aktif)
                .map((k) => (
                  <option key={k.id} value={`kelas:${k.id}`}>
                    {k.nama}
                  </option>
                ))}
              <option value="kelas:kosong">Keluarkan dari kelas</option>
            </optgroup>
            <optgroup label="Ubah status">
              {Object.entries(STATUS_SANTRI).map(([k, v]) => (
                <option key={k} value={`status:${k}`}>
                  {v}
                </option>
              ))}
            </optgroup>
          </select>
          <Tombol ukuran="kecil" varian="utama" ikon={<ArrowRightLeft />} disabled={!tujuan} sibuk={sibukMassal} onClick={terapkanMassal}>
            Terapkan
          </Tombol>
          <Tombol ukuran="kecil" varian="hantu" ikon={<X />} onClick={() => setPilih(new Set())}>
            Batal
          </Tombol>
        </div>
      )}

      <section className="kaca">
        {galat ? (
          <GalatMuat galat={galat} ulang={muatUlang} />
        ) : !data && memuat ? (
          <div style={{ padding: 16 }}>
            <Memuat baris={6} />
          </div>
        ) : daftar.length === 0 ? (
          <Kosong
            ikon={<Users />}
            judul={disaring ? 'Tidak ada santri yang cocok' : 'Belum ada santri'}
            pesan={disaring ? 'Ubah kata kunci atau saringan.' : admin ? 'Tambahkan santri pertama. Akun wali santri dibuat otomatis.' : undefined}
            aksi={
              admin &&
              !disaring && (
                <Tombol varian="utama" ikon={<UserPlus />} onClick={() => setForm('baru')}>
                  Tambah santri
                </Tombol>
              )
            }
          />
        ) : (
          <div className="tabel-bungkus">
            <table className="tabel tabel--responsif">
              <thead>
                <tr>
                  {admin && (
                    <th style={{ width: 44 }}>
                      <input
                        type="checkbox"
                        className="kotak-pilih"
                        checked={semuaDipilih}
                        onChange={() => setPilih(semuaDipilih ? new Set() : new Set(daftar.map((s) => s.id)))}
                        aria-label="Pilih semua"
                      />
                    </th>
                  )}
                  <th>Santri</th>
                  <th>Kelas</th>
                  <th>Wali</th>
                  <th>Akun wali</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((s) => (
                  <tr key={s.id} className="bisa-klik" onClick={() => navigasi(`/admin/santri/${s.id}`)}>
                    {admin && (
                      <td onClick={(e) => e.stopPropagation()} data-sel="pilih">
                        <input
                          type="checkbox"
                          className="kotak-pilih"
                          checked={pilih.has(s.id)}
                          onChange={() => {
                            const p = new Set(pilih);
                            if (p.has(s.id)) p.delete(s.id);
                            else p.add(s.id);
                            setPilih(p);
                          }}
                          aria-label={`Pilih ${s.nama}`}
                        />
                      </td>
                    )}
                    <td data-sel="utama">
                      <div className="baris">
                        <Avatar nama={s.nama} jk={s.jk} ukuran={38} foto={urlFoto(s.id, s.fotoVersi)} />
                        <div style={{ display: 'grid', minWidth: 0 }}>
                          <b className="potong">{s.nama}</b>
                          <span className="redup-2 kecil angka">NIS {s.nis}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Kelas">{s.kelasNama ?? <span className="redup-2">–</span>}</td>
                    <td data-label="Wali">
                      <div style={{ display: 'grid' }}>
                        <span>{s.namaWali ?? s.namaAyah ?? '–'}</span>
                        {s.hpWali && <span className="redup-2 kecil angka">{s.hpWali}</span>}
                      </div>
                    </td>
                    <td data-label="Akun wali">
                      {s.masukTerakhir ? (
                        <span title={`Terakhir masuk ${waktu(s.masukTerakhir)}`}>
                          <Lencana jenis="ok" titik>
                            Aktif
                          </Lencana>
                        </span>
                      ) : (
                        <Lencana titik>Belum masuk</Lencana>
                      )}
                    </td>
                    <td data-label="Status">
                      <Lencana jenis={s.status === 'aktif' ? 'emas' : undefined}>{STATUS_SANTRI[s.status]}</Lencana>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {form && (
        <FormSantri
          tutup={() => setForm(null)}
          selesai={(a) => {
            setForm(null);
            muatUlang();
            if (a) setAkun(a);
          }}
        />
      )}
      {akun && <TampilAkun akun={akun} tutup={() => setAkun(null)} />}
      {kartu && (
        <KartuAkun
          tutup={() => {
            setKartu(false);
            muatUlang();
          }}
        />
      )}
    </>
  );
}
