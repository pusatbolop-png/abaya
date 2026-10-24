export class GalatApi extends Error {
  constructor(
    public status: number,
    pesan: string,
    public bidang: Record<string, string> = {},
  ) {
    super(pesan);
  }
}

type Metode = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

let saatSesiHabis: (() => void) | null = null;
export function ketikaSesiHabis(fn: () => void) {
  saatSesiHabis = fn;
}

export async function api<T = unknown>(metode: Metode, url: string, isi?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'x-pcc': '1', accept: 'application/json' };
  let body: BodyInit | undefined;
  if (isi instanceof FormData) body = isi;
  else if (isi !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(isi);
  }
  let res: Response;
  try {
    res = await fetch(url, { method: metode, headers, body, credentials: 'same-origin' });
  } catch {
    throw new GalatApi(0, 'Tidak bisa terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.');
  }
  const jenis = res.headers.get('content-type') ?? '';
  const data = jenis.includes('application/json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (res.status === 401 && url.startsWith('/api/') && !url.startsWith('/api/auth/')) saatSesiHabis?.();
    const g = data?.galat;
    throw new GalatApi(res.status, g?.pesan ?? 'Terjadi kendala. Coba lagi sebentar lagi.', g?.bidang ?? {});
  }
  return data as T;
}

export const ambil = <T,>(url: string) => api<T>('GET', url);
