export class GalatApi extends Error {
  constructor(
    public status: number,
    pesan: string,
    public bidang: Record<string, string> = {},
  ) {
    super(pesan);
  }
}

type Metode = 'GET' | 'POST' | 'PUT' | 'DELETE';

let saatSesiHabis: (() => void) | null = null;
export function ketikaSesiHabis(fn: () => void) {
  saatSesiHabis = fn;
}

export async function api<T = unknown>(metode: Metode, url: string, isi?: unknown, sinyal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = { 'x-madin': '1', accept: 'application/json' };
  let body: BodyInit | undefined;
  if (isi !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(isi);
  }
  let res: Response;
  try {
    res = await fetch(url, { method: metode, headers, body, credentials: 'same-origin', signal: sinyal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new GalatApi(0, 'Tidak bisa terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.');
  }
  const jenis = res.headers.get('content-type') ?? '';
  const data = jenis.includes('application/json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth/')) saatSesiHabis?.();
    const g = data?.galat;
    throw new GalatApi(res.status, g?.pesan ?? 'Terjadi kendala. Coba lagi sebentar lagi.', g?.bidang ?? {});
  }
  return data as T;
}

export const kirim = <T = { ok: true }>(metode: Exclude<Metode, 'GET'>, url: string, isi?: unknown) => api<T>(metode, url, isi);

export function pesanGalat(e: unknown): string {
  if (e instanceof GalatApi) return e.message;
  return 'Terjadi kendala yang tidak terduga. Muat ulang halaman lalu coba lagi.';
}
