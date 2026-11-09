import { useState } from 'react';
import { Copy, MessageCircle, Printer, Save } from 'lucide-react';
import { kirim } from '../../lib/api';
import { useKirim, usePakai } from '../../lib/pakai';
import { useToast } from '../../lib/toast';
import type { Kelas, Santri } from '../../lib/tipe';
import { Bidang, Modal, Pesan, Tombol } from '../../ui/dasar';
import { Lambang } from '../../ui/Lambang';
import { STATUS_SANTRI } from '../../../shared/konstanta';
import { tautanWa } from '../../../shared/format';

export interface AkunBaru {
  nama?: string;
  nis: string;
  sandi: string;
  hp: string | null;
  pesan: string;
}

const kosong = {
  nis: '',
  nama: '',
  jk: 'L' as 'L' | 'P',
  tempatLahir: '',
  tanggalLahir: '',
  alamat: '',
  namaAyah: '',
  namaIbu: '',
  namaWali: '',
  hpWali: '',
  kelasId: '' as string,
  status: 'aktif',
  tanggalMasuk: '',
};

export function FormSantri({ santri, tutup, selesai }: { santri?: Santri; tutup: () => void; selesai: (akun?: AkunBaru) => void }) {
  const toast = useToast();
  const { data: kelas } = usePakai<{ daftar: Kelas[] }>('/api/admin/kelas');
  const { sibuk, bidang, jalankan } = useKirim();
  const [f, setF] = useState(() =>
    santri
      ? {
          nis: santri.nis,
          nama: santri.nama,
          jk: santri.jk,
          tempatLahir: santri.tempatLahir ?? '',
          tanggalLahir: santri.tanggalLahir ?? '',
          alamat: santri.alamat ?? '',
          namaAyah: santri.namaAyah ?? '',
          namaIbu: santri.namaIbu ?? '',
          namaWali: santri.namaWali ?? '',
          hpWali: santri.hpWali ?? '',
          kelasId: santri.kelasId ? String(santri.kelasId) : '',
          status: santri.status,
          tanggalMasuk: santri.tanggalMasuk ?? '',
        }
      : kosong,
  );
  const ubah = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const simpan = () =>
    jalankan(async () => {
      const isi = { ...f, kelasId: f.kelasId ? Number(f.kelasId) : null };
      if (santri) {
        await kirim('PUT', `/api/admin/santri/${santri.id}`, isi);
        toast.tampil(`Data ${f.nama} disimpan.`);
        selesai();
      } else {
        const r = await kirim<AkunBaru & { id: number }>('POST', '/api/admin/santri', isi);
        toast.tampil(`${f.nama} ditambahkan dengan NIS ${r.nis}.`);
        selesai({ ...r, nama: f.nama });
      }
    }).catch(toast.galat);

  const kelasCocok = (kelas?.daftar ?? []).filter((k) => k.aktif && (k.bagian === 'campur' || k.bagian === (f.jk === 'L' ? 'putra' : 'putri')));

  return (
    <Modal
      judul={santri ? `Ubah data ${santri.nama}` : 'Tambah santri'}
      sub={santri ? `NIS ${santri.nis}` : 'Akun wali santri dibuat otomatis beserta sandi awalnya.'}
      tutup={tutup}
      lebar
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
      <div className="tumpuk">
        <div className="mikro redup-2">Identitas</div>
        <div className="grid-2">
          <Bidang label="Nama lengkap" wajib galat={bidang.nama} className="bentang-2">
            <input className="masukan" value={f.nama} onChange={ubah('nama')} required />
          </Bidang>
          <Bidang label="Jenis" wajib galat={bidang.jk} grup>
            <div className="segmen" role="radiogroup" style={{ width: '100%' }}>
              {(['L', 'P'] as const).map((j) => (
                <button key={j} type="button" role="radio" aria-checked={f.jk === j} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setF({ ...f, jk: j })}>
                  {j === 'L' ? 'Santri (putra)' : 'Santriwati (putri)'}
                </button>
              ))}
            </div>
          </Bidang>
          <Bidang label="NIS" galat={bidang.nis} bantu={santri ? undefined : 'Kosongkan untuk dibuat otomatis.'}>
            <input className="masukan angka" value={f.nis} onChange={ubah('nis')} placeholder="Otomatis" />
          </Bidang>
          <Bidang label="Tempat lahir" galat={bidang.tempatLahir}>
            <input className="masukan" value={f.tempatLahir} onChange={ubah('tempatLahir')} />
          </Bidang>
          <Bidang label="Tanggal lahir" galat={bidang.tanggalLahir}>
            <input className="masukan" type="date" value={f.tanggalLahir} onChange={ubah('tanggalLahir')} />
          </Bidang>
          <Bidang label="Alamat" galat={bidang.alamat} className="bentang-2">
            <input className="masukan" value={f.alamat} onChange={ubah('alamat')} />
          </Bidang>
        </div>
        <div className="mikro redup-2" style={{ marginTop: 8 }}>
          Madrasah
        </div>
        <div className="grid-3">
          <Bidang label="Kelas" galat={bidang.kelasId}>
            <select className="masukan" value={f.kelasId} onChange={ubah('kelasId')}>
              <option value="">Belum masuk kelas</option>
              {kelasCocok.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
          </Bidang>
          <Bidang label="Tanggal masuk" galat={bidang.tanggalMasuk}>
            <input className="masukan" type="date" value={f.tanggalMasuk} onChange={ubah('tanggalMasuk')} />
          </Bidang>
          <Bidang label="Status" galat={bidang.status}>
            <select className="masukan" value={f.status} onChange={ubah('status')}>
              {Object.entries(STATUS_SANTRI).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Bidang>
        </div>
        <div className="mikro redup-2" style={{ marginTop: 8 }}>
          Orang tua & wali
        </div>
        <div className="grid-2">
          <Bidang label="Nama ayah" galat={bidang.namaAyah}>
            <input className="masukan" value={f.namaAyah} onChange={ubah('namaAyah')} />
          </Bidang>
          <Bidang label="Nama ibu" galat={bidang.namaIbu}>
            <input className="masukan" value={f.namaIbu} onChange={ubah('namaIbu')} />
          </Bidang>
          <Bidang label="Nama wali" galat={bidang.namaWali} bantu="Kosongkan bila wali adalah ayah.">
            <input className="masukan" value={f.namaWali} onChange={ubah('namaWali')} />
          </Bidang>
          <Bidang label="Nomor HP/WhatsApp wali" galat={bidang.hpWali}>
            <input className="masukan angka" type="tel" inputMode="tel" value={f.hpWali} onChange={ubah('hpWali')} placeholder="08…" />
          </Bidang>
        </div>
      </div>
    </Modal>
  );
}

/** Menampilkan sandi wali yang baru dibuat, sekali saja, dengan tombol kirim WhatsApp. */
export function TampilAkun({ akun, tutup }: { akun: AkunBaru; tutup: () => void }) {
  const toast = useToast();
  return (
    <Modal
      judul="Akun wali santri"
      sub={akun.nama}
      tutup={tutup}
      kaki={
        <>
          <Tombol
            ikon={<Copy />}
            onClick={() => {
              navigator.clipboard
                .writeText(akun.pesan.replace(/\*/g, ''))
                .then(() => toast.tampil('Pesan disalin.'))
                .catch(() => toast.tampil('Salin tidak tersedia di peramban ini.', 'galat'));
            }}
          >
            Salin pesan
          </Tombol>
          {akun.hp && (
            <a className="tombol tombol--utama" href={tautanWa(akun.hp, akun.pesan)} target="_blank" rel="noreferrer">
              <MessageCircle /> Kirim ke WhatsApp wali
            </a>
          )}
        </>
      }
    >
      <div className="tumpuk">
        <div className="kartu-sandi">
          <div>
            <div className="mikro redup-2">NIS</div>
            <div className="kartu-sandi__nilai">{akun.nis}</div>
          </div>
          <div>
            <div className="mikro redup-2">Sandi</div>
            <div className="kartu-sandi__nilai">{akun.sandi}</div>
          </div>
        </div>
        <Pesan jenis="waspada">Sandi ini hanya ditampilkan sekali. Kirimkan ke wali sekarang, atau buat sandi baru nanti dari halaman santri.</Pesan>
      </div>
    </Modal>
  );
}

interface KartuAkunHasil {
  kelas: string;
  alamat: string;
  dilewati: number;
  daftar: { id: number; nama: string; nis: string; jk: string; sandi: string; hp: string | null; pesan: string }[];
}

/** Kartu akun wali satu kelas untuk dicetak dan dibagikan. */
export function KartuAkun({ tutup }: { tutup: () => void }) {
  const toast = useToast();
  const { data: kelas } = usePakai<{ daftar: Kelas[] }>('/api/admin/kelas');
  const [kelasId, setKelasId] = useState('');
  const [hasil, setHasil] = useState<KartuAkunHasil | null>(null);
  const { sibuk, jalankan } = useKirim();

  if (hasil)
    return (
      <Modal
        judul={`Kartu akun wali · ${hasil.kelas}`}
        sub={`${hasil.daftar.length} kartu${hasil.dilewati ? ` · ${hasil.dilewati} santri dilewati karena walinya sudah mengganti sandi` : ''}`}
        tutup={tutup}
        lebar
        kaki={
          <>
            <Tombol onClick={tutup}>Tutup</Tombol>
            <Tombol varian="utama" ikon={<Printer />} onClick={() => window.print()} disabled={!hasil.daftar.length}>
              Cetak kartu
            </Tombol>
          </>
        }
      >
        {hasil.daftar.length ? (
          <div className="tumpuk">
            <Pesan jenis="waspada">Sandi lama santri di daftar ini sudah tidak berlaku. Cetak atau kirim kartu ini sebelum menutup jendela.</Pesan>
            <div style={{ overflowX: 'auto' }}>
              <div className="area-cetak">
                <div className="kartu-akun-lembar">
                  {hasil.daftar.map((s) => (
                    <div key={s.id} className="kartu-akun">
                      <div className="kartu-akun__kepala">
                        <Lambang warna="hijau" />
                        <div>
                          <b>Akun wali santri</b>
                          <div style={{ fontSize: '8pt' }}>{hasil.kelas}</div>
                        </div>
                      </div>
                      <dl>
                        <dt>Nama</dt>
                        <dd>{s.nama}</dd>
                        <dt>NIS</dt>
                        <dd className="kartu-akun__sandi">{s.nis}</dd>
                        <dt>Sandi</dt>
                        <dd className="kartu-akun__sandi">{s.sandi}</dd>
                      </dl>
                      <small>Masuk di {hasil.alamat} · segera ganti sandi setelah masuk.</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="tumpuk tumpuk--rapat">
              <div className="mikro redup-2">Atau kirim satu per satu lewat WhatsApp</div>
              {hasil.daftar
                .filter((s) => s.hp)
                .map((s) => (
                  <a key={s.id} className="baris baris--antara panel" style={{ padding: '10px 14px', textDecoration: 'none', color: 'inherit' }} href={tautanWa(s.hp!, s.pesan)} target="_blank" rel="noreferrer">
                    <span>{s.nama}</span>
                    <span className="baris kecil" style={{ color: 'var(--ok)' }}>
                      <MessageCircle style={{ width: 16 }} /> Kirim
                    </span>
                  </a>
                ))}
            </div>
          </div>
        ) : (
          <Pesan jenis="info">Semua wali di kelas ini sudah mengganti sandinya. Buat sandi baru per santri dari halaman detail santri bila diperlukan.</Pesan>
        )}
      </Modal>
    );

  return (
    <Modal
      judul="Cetak kartu akun wali"
      sub="Sandi baru dibuat untuk santri yang walinya belum pernah mengganti sandi."
      tutup={tutup}
      onSubmit={() =>
        jalankan(async () => setHasil(await kirim<KartuAkunHasil>('POST', '/api/admin/santri/kartu-akun', { kelasId: Number(kelasId) }))).catch(toast.galat)
      }
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" varian="utama" sibuk={sibuk} disabled={!kelasId} ikon={<Printer />}>
            Buat kartu
          </Tombol>
        </>
      }
    >
      <div className="tumpuk">
        <Bidang label="Kelas" wajib>
          <select className="masukan" value={kelasId} onChange={(e) => setKelasId(e.target.value)} required>
            <option value="">Pilih kelas</option>
            {(kelas?.daftar ?? [])
              .filter((k) => k.aktif)
              .map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama} ({k.putra + k.putri} santri)
                </option>
              ))}
          </select>
        </Bidang>
        <Pesan jenis="waspada">Sandi awal yang pernah dibagikan untuk santri-santri ini akan diganti dengan yang baru.</Pesan>
      </div>
    </Modal>
  );
}
