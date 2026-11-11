import { useCallback, useEffect, useRef, useState, type PointerEvent as PE } from 'react';
import { Camera, ImageUp, RotateCw, Save, Trash2, ZoomIn } from 'lucide-react';
import { bacaGambar } from '../lib/foto';
import { useToast } from '../lib/toast';
import { Modal, Tombol, useKonfirmasi } from './dasar';

type Gambar = ImageBitmap | HTMLImageElement;
const LEBAR_HASIL = 600; // foto disimpan 600×800 (pas foto 3×4)
const TINGGI_HASIL = 800;

/**
 * Ambil foto santri dari kamera ponsel (langsung selfie) atau galeri, lalu potong 3:4.
 * Geser dengan jari/tetikus, perbesar dengan cubitan, roda tetikus, atau penggeser.
 */
export function AmbilFoto({
  nama,
  adaFoto,
  simpan,
  hapus,
  tutup,
}: {
  nama: string;
  adaFoto: boolean;
  simpan: (dataUrl: string) => Promise<void>;
  hapus?: () => Promise<void>;
  tutup: () => void;
}) {
  const toast = useToast();
  const tanya = useKonfirmasi();
  const [gambar, setGambar] = useState<Gambar | null>(null);
  const [zoom, setZoom] = useState(1);
  const [geser, setGeser] = useState({ x: 0, y: 0 });
  const [putar, setPutar] = useState(0);
  const [sibuk, setSibuk] = useState(false);
  const kanvas = useRef<HTMLCanvasElement>(null);
  const bingkai = useRef<HTMLDivElement>(null);
  const kamera = useRef<HTMLInputElement>(null);
  const galeri = useRef<HTMLInputElement>(null);
  const jari = useRef(new Map<number, { x: number; y: number }>());
  const awalCubit = useRef<{ jarak: number; zoom: number } | null>(null);

  // Ukuran gambar setelah diputar.
  const ukuran = useCallback((g: Gambar) => (putar % 180 === 0 ? { w: g.width, h: g.height } : { w: g.height, h: g.width }), [putar]);

  const batasi = useCallback(
    (p: { x: number; y: number }, z: number, W: number, H: number) => {
      if (!gambar) return p;
      const { w, h } = ukuran(gambar);
      const s = Math.max(W / w, H / h) * z;
      const mx = Math.max(0, (w * s - W) / 2);
      const my = Math.max(0, (h * s - H) / 2);
      return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
    },
    [gambar, ukuran],
  );

  /** Gambar ke kanvas berukuran W×H dengan transformasi saat ini (skala geser sebanding). */
  const lukis = useCallback(
    (ctx: CanvasRenderingContext2D, W: number, H: number, faktor: number) => {
      if (!gambar) return;
      const { w, h } = ukuran(gambar);
      const s = Math.max(W / w, H / h) * zoom;
      ctx.fillStyle = '#0b3b3d';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2 + geser.x * faktor, H / 2 + geser.y * faktor);
      ctx.rotate((putar * Math.PI) / 180);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(gambar, (-gambar.width * s) / 2, (-gambar.height * s) / 2, gambar.width * s, gambar.height * s);
      ctx.restore();
    },
    [gambar, zoom, geser, putar, ukuran],
  );

  useEffect(() => {
    const c = kanvas.current;
    if (!c || !gambar) return;
    const W = c.clientWidth;
    const H = c.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    lukis(ctx, W, H, 1);
  }, [gambar, lukis]);

  const pilihBerkas = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.tampil('Pilih berkas foto (JPG atau PNG).', 'galat');
      return;
    }
    try {
      const g = await bacaGambar(f);
      setGambar(g);
      setZoom(1);
      setGeser({ x: 0, y: 0 });
      setPutar(0);
    } catch {
      toast.tampil('Foto tidak bisa dibuka. Coba ambil ulang atau pilih foto lain.', 'galat');
    }
  };

  const ubahZoom = (z: number) => {
    const c = kanvas.current;
    const nz = Math.min(4, Math.max(1, z));
    setZoom(nz);
    if (c) setGeser((g) => batasi(g, nz, c.clientWidth, c.clientHeight));
  };

  const tekan = (e: PE<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    jari.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (jari.current.size === 2) {
      const [a, b] = [...jari.current.values()];
      awalCubit.current = { jarak: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const gerak = (e: PE<HTMLCanvasElement>) => {
    const lama = jari.current.get(e.pointerId);
    if (!lama) return;
    jari.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const c = e.currentTarget;
    if (jari.current.size === 2 && awalCubit.current) {
      const [a, b] = [...jari.current.values()];
      ubahZoom(awalCubit.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / awalCubit.current.jarak));
    } else if (jari.current.size === 1) {
      setGeser((g) => batasi({ x: g.x + e.clientX - lama.x, y: g.y + e.clientY - lama.y }, zoom, c.clientWidth, c.clientHeight));
    }
  };
  const lepas = (e: PE<HTMLCanvasElement>) => {
    jari.current.delete(e.pointerId);
    if (jari.current.size < 2) awalCubit.current = null;
  };

  const simpanFoto = async () => {
    const c = kanvas.current;
    if (!c || !gambar) return;
    setSibuk(true);
    try {
      const hasil = document.createElement('canvas');
      hasil.width = LEBAR_HASIL;
      hasil.height = TINGGI_HASIL;
      lukis(hasil.getContext('2d')!, LEBAR_HASIL, TINGGI_HASIL, LEBAR_HASIL / c.clientWidth);
      let mutu = 0.88;
      let data = hasil.toDataURL('image/jpeg', mutu);
      while (data.length > 560_000 && mutu > 0.5) data = hasil.toDataURL('image/jpeg', (mutu -= 0.1));
      await simpan(data);
      toast.tampil(`Foto ${nama} tersimpan.`);
      tutup();
    } catch (e) {
      toast.galat(e);
    } finally {
      setSibuk(false);
    }
  };

  const hapusFoto = async () => {
    if (!hapus || !(await tanya({ judul: 'Hapus foto?', pesan: `Foto ${nama} dihapus dari aplikasi dan kartu santri.`, ya: 'Hapus', bahaya: true }))) return;
    try {
      await hapus();
      toast.tampil('Foto dihapus.');
      tutup();
    } catch (e) {
      toast.galat(e);
    }
  };

  return (
    <Modal
      judul={gambar ? 'Atur posisi foto' : adaFoto ? 'Ganti foto santri' : 'Foto santri'}
      sub={gambar ? 'Geser dan perbesar sampai wajah pas di dalam garis oval.' : nama}
      tutup={tutup}
      kaki={
        gambar ? (
          <>
            <Tombol varian="hantu" onClick={() => setGambar(null)} disabled={sibuk}>
              Ulangi
            </Tombol>
            <Tombol varian="utama" ikon={<Save />} sibuk={sibuk} onClick={simpanFoto}>
              Simpan foto
            </Tombol>
          </>
        ) : adaFoto && hapus ? (
          <Tombol varian="hantu" ikon={<Trash2 />} onClick={hapusFoto}>
            Hapus foto
          </Tombol>
        ) : undefined
      }
    >
      <input ref={kamera} type="file" accept="image/*" capture="user" hidden onChange={(e) => (pilihBerkas(e.target.files?.[0]), (e.target.value = ''))} aria-label="Ambil foto dengan kamera" />
      <input ref={galeri} type="file" accept="image/*" hidden onChange={(e) => (pilihBerkas(e.target.files?.[0]), (e.target.value = ''))} aria-label="Pilih foto dari galeri" />
      {!gambar ? (
        <div className="foto-pilih">
          <button type="button" className="foto-pilih__tombol foto-pilih__tombol--utama" onClick={() => kamera.current?.click()}>
            <Camera />
            <b>Ambil foto</b>
            <span>Buka kamera ponsel (selfie)</span>
          </button>
          <button type="button" className="foto-pilih__tombol" onClick={() => galeri.current?.click()}>
            <ImageUp />
            <b>Pilih dari galeri</b>
            <span>Foto yang sudah ada</span>
          </button>
          <ul className="foto-pilih__saran">
            <li>Wajah menghadap kamera, tidak tertutup.</li>
            <li>Latar polos dan cahaya cukup, sebaiknya dekat jendela.</li>
            <li>Berpakaian rapi seperti saat ke madrasah.</li>
          </ul>
        </div>
      ) : (
        <div className="foto-potong">
          <div ref={bingkai} className="foto-potong__bingkai">
            <canvas
              ref={kanvas}
              onPointerDown={tekan}
              onPointerMove={gerak}
              onPointerUp={lepas}
              onPointerCancel={lepas}
              onWheel={(e) => ubahZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
              aria-label="Pratinjau foto; geser untuk mengatur posisi"
              role="img"
            />
            <svg className="foto-potong__panduan" viewBox="0 0 300 400" aria-hidden preserveAspectRatio="none">
              <defs>
                <mask id="lubang-wajah">
                  <rect width="300" height="400" fill="#fff" />
                  <ellipse cx="150" cy="158" rx="84" ry="108" fill="#000" />
                </mask>
              </defs>
              <rect width="300" height="400" fill="rgba(2,24,26,.42)" mask="url(#lubang-wajah)" />
              <ellipse cx="150" cy="158" rx="84" ry="108" fill="none" stroke="rgba(248,238,219,.85)" strokeWidth="1.5" strokeDasharray="6 5" />
            </svg>
          </div>
          <div className="foto-potong__alat">
            <ZoomIn aria-hidden />
            <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => ubahZoom(Number(e.target.value))} aria-label="Perbesar foto" />
            <Tombol
              varian="hantu"
              ukuran="kecil"
              ikon={<RotateCw />}
              onClick={() => {
                setPutar((p) => (p + 90) % 360);
                setGeser({ x: 0, y: 0 });
              }}
              aria-label="Putar foto"
              title="Putar 90°"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
