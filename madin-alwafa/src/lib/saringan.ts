import { useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Saringan yang disimpan di alamat (?kelas=…&q=…).
 *
 * Bentuk fungsi dari setSearchParams milik react-router menerima nilai dari
 * render terakhir, sehingga dua perubahan beruntun sebelum layar diperbarui
 * (mis. kosongkan pencarian lalu ganti kelas) saling menimpa. Hook ini
 * menyimpan nilai terbaru di ref agar setiap perubahan dibangun di atas
 * perubahan sebelumnya.
 */
export function useSaringan() {
  const [param, setParam] = useSearchParams();
  const terkini = useRef(param);
  terkini.current = param;

  const atur = useCallback(
    (ubah: Record<string, string | null | undefined>, opsi: { ganti?: boolean } = {}) => {
      const p = new URLSearchParams(terkini.current);
      for (const [k, v] of Object.entries(ubah)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      if (p.toString() === terkini.current.toString()) return;
      terkini.current = p;
      setParam(p, { replace: opsi.ganti ?? true });
    },
    [setParam],
  );

  return [param, atur] as const;
}
