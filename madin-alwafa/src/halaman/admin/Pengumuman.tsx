import { useState } from 'react';
import { Megaphone, Pencil, Plus, Save, Star, Trash2 } from 'lucide-react';
import { kirim } from '../../lib/api';
import { useKirim, usePakai } from '../../lib/pakai';
import { useSesi } from '../../lib/sesi';
import { useToast } from '../../lib/toast';
import type { Kelas, Pengumuman as TPengumuman } from '../../lib/tipe';
import { Bidang, GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, Modal, Sakelar, Tombol, useJudul, useKonfirmasi } from '../../ui/dasar';
import { SASARAN_PENGUMUMAN } from '../../../shared/konstanta';
import { waktu } from '../../../shared/format';

export function labelSasaran(p: TPengumuman) {
  if (p.sasaran.startsWith('kelas:')) return `Kelas ${p.kelas ?? ''}`;
  return SASARAN_PENGUMUMAN[p.sasaran as keyof typeof SASARAN_PENGUMUMAN] ?? p.sasaran;
}

export default function Pengumuman() {
  useJudul('Pengumuman');
  const { pengurus } = useSesi();
  const admin = pengurus?.peran === 'admin';
  const toast = useToast();
  const tanya = useKonfirmasi();
  const { data, galat, muatUlang } = usePakai<{ daftar: TPengumuman[] }>('/api/admin/pengumuman');
  const [form, setForm] = useState<TPengumuman | 'baru' | null>(null);

  const hapus = async (p: TPengumuman) => {
    if (!(await tanya({ judul: 'Hapus pengumuman?', pesan: p.judul, ya: 'Hapus', bahaya: true }))) return;
    try {
      await kirim('DELETE', `/api/admin/pengumuman/${p.id}`);
      toast.tampil('Pengumuman dihapus.');
      muatUlang();
    } catch (e) {
      toast.galat(e);
    }
  };

  return (
    <>
      <KepalaHalaman
        kecil="Kabar madrasah"
        judul="Pengumuman"
        sub="Pengumuman tampil di beranda aplikasi wali santri. Pilih sasaran: semua wali, putra, putri, atau satu kelas."
        aksi={
          admin && (
            <Tombol varian="utama" ikon={<Plus />} onClick={() => setForm('baru')}>
              Tulis pengumuman
            </Tombol>
          )
        }
      />
      {galat ? (
        <GalatMuat galat={galat} ulang={muatUlang} />
      ) : !data ? (
        <Memuat baris={3} tinggi={120} />
      ) : !data.daftar.length ? (
        <div className="kaca">
          <Kosong ikon={<Megaphone />} judul="Belum ada pengumuman" />
        </div>
      ) : (
        <div className="tumpuk">
          {data.daftar.map((p) => (
            <article key={p.id} className={`kaca kaca--pad kartu-pengumuman ${p.penting ? 'kaca--emas' : ''}`}>
              <div className="baris baris--antara baris--atas">
                <div className="tumpuk tumpuk--rapat" style={{ gap: 6 }}>
                  <div className="baris baris--bungkus" style={{ gap: 6 }}>
                    {!!p.penting && (
                      <Lencana jenis="emas">
                        <Star /> Penting
                      </Lencana>
                    )}
                    <Lencana>{labelSasaran(p)}</Lencana>
                  </div>
                  <h2 style={{ fontSize: 18 }}>{p.judul}</h2>
                </div>
                {admin && (
                  <div className="baris" style={{ gap: 4 }}>
                    <Tombol varian="hantu" ukuran="kecil" ikon={<Pencil />} onClick={() => setForm(p)} aria-label="Ubah" />
                    <Tombol varian="hantu" ukuran="kecil" ikon={<Trash2 />} onClick={() => hapus(p)} aria-label="Hapus" />
                  </div>
                )}
              </div>
              <p className="redup" style={{ whiteSpace: 'pre-line', marginTop: 10 }}>
                {p.isi}
              </p>
              <div className="redup-2 kecil" style={{ marginTop: 12 }}>
                {p.penulis ?? 'Pengurus'} · {waktu(p.terbit)} WIB
              </div>
            </article>
          ))}
        </div>
      )}
      {form && (
        <FormPengumuman
          p={form === 'baru' ? undefined : form}
          tutup={() => setForm(null)}
          selesai={() => {
            setForm(null);
            muatUlang();
          }}
        />
      )}
    </>
  );
}

function FormPengumuman({ p, tutup, selesai }: { p?: TPengumuman; tutup: () => void; selesai: () => void }) {
  const toast = useToast();
  const { data: kelas } = usePakai<{ daftar: Kelas[] }>('/api/admin/kelas');
  const { sibuk, bidang, jalankan } = useKirim();
  const [f, setF] = useState({ judul: p?.judul ?? '', isi: p?.isi ?? '', sasaran: p?.sasaran ?? 'semua', penting: !!p?.penting });
  const simpan = () =>
    jalankan(async () => {
      if (p) await kirim('PUT', `/api/admin/pengumuman/${p.id}`, f);
      else await kirim('POST', '/api/admin/pengumuman', f);
      toast.tampil(p ? 'Pengumuman diperbarui.' : 'Pengumuman diterbitkan.');
      selesai();
    }).catch(toast.galat);
  return (
    <Modal
      judul={p ? 'Ubah pengumuman' : 'Tulis pengumuman'}
      tutup={tutup}
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" varian="utama" ikon={<Save />} sibuk={sibuk}>
            {p ? 'Simpan' : 'Terbitkan'}
          </Tombol>
        </>
      }
    >
      <div className="tumpuk">
        <Bidang label="Judul" wajib galat={bidang.judul}>
          <input className="masukan" value={f.judul} onChange={(e) => setF({ ...f, judul: e.target.value })} required />
        </Bidang>
        <Bidang label="Isi" wajib galat={bidang.isi}>
          <textarea className="masukan" rows={6} value={f.isi} onChange={(e) => setF({ ...f, isi: e.target.value })} required />
        </Bidang>
        <Bidang label="Sasaran" galat={bidang.sasaran}>
          <select className="masukan" value={f.sasaran} onChange={(e) => setF({ ...f, sasaran: e.target.value })}>
            {Object.entries(SASARAN_PENGUMUMAN).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
            <optgroup label="Satu kelas">
              {kelas?.daftar.map((k) => (
                <option key={k.id} value={`kelas:${k.id}`}>
                  Wali santri {k.nama}
                </option>
              ))}
            </optgroup>
          </select>
        </Bidang>
        <div className="baris panel" style={{ padding: '12px 14px' }}>
          <div className="isi-penuh">
            <b>Tandai penting</b>
            <div className="redup-2 kecil">Pengumuman penting tampil paling atas dengan bingkai emas.</div>
          </div>
          <Sakelar nyala={f.penting} ubah={(v) => setF({ ...f, penting: v })} label="Penting" />
        </div>
      </div>
    </Modal>
  );
}
