import { useEffect, useState } from 'react';
import { PRATINJAU } from './pratinjau';

/** Alamat foto santri; berversi sehingga peramban boleh menyimpannya lama dan tetap segar saat foto diganti. */
export const urlFoto = (santriId: number | null | undefined, versi: string | null | undefined) =>
  santriId && versi ? `/api/foto/santri/${santriId}?v=${versi}` : null;

// Di pratinjau tanpa server, <img src="/api/…"> tidak melewati server di memori, jadi foto diambil lewat fetch
// lalu dijadikan alamat blob. Satu blob per alamat dipakai bersama semua avatar.
const simpanan = new Map<string, Promise<string | null>>();
function blobDariApi(url: string) {
  let janji = simpanan.get(url);
  if (!janji) {
    janji = fetch(url, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b ? URL.createObjectURL(b) : null))
      .catch(() => null);
    simpanan.set(url, janji);
  }
  return janji;
}

export function useSumberFoto(url: string | null): string | null {
  const [blob, setBlob] = useState<{ url: string; src: string | null } | null>(null);
  useEffect(() => {
    if (!PRATINJAU || !url) return;
    let batal = false;
    blobDariApi(url).then((src) => {
      if (!batal) setBlob({ url, src });
    });
    return () => {
      batal = true;
    };
  }, [url]);
  if (!url) return null;
  if (!PRATINJAU) return url;
  return blob?.url === url ? blob.src : null;
}

/** Ubah berkas gambar menjadi bitmap yang sudah mengikuti orientasi kamera (EXIF). */
export async function bacaGambar(berkas: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(berkas, { imageOrientation: 'from-image' });
    } catch {
      /* lanjut ke cara lama */
    }
  }
  const url = URL.createObjectURL(berkas);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
