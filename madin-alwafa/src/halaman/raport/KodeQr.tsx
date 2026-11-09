import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Kode QR SVG yang dibuat di peramban (tanpa layanan luar). */
export function KodeQr({ teks, warna = '#0b4634' }: { teks: string; warna?: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let batal = false;
    QRCode.toString(teks, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: warna, light: '#ffffff00' } })
      .then((s) => {
        if (!batal) setSvg(s);
      })
      .catch(() => setSvg(''));
    return () => {
      batal = true;
    };
  }, [teks, warna]);
  return <div className="qr" aria-label="Kode QR verifikasi" role="img" dangerouslySetInnerHTML={{ __html: svg }} />;
}
