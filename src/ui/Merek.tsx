import { Link } from 'react-router';
import { useInfo } from '../lib/konteks';

export function Merek({ ke = '/', ringkas }: { ke?: string; ringkas?: boolean }) {
  const { info } = useInfo();
  const nama = info?.organisasi.nama ?? 'Pasuruan Creative Center';
  const singkat = info?.organisasi.singkat ?? 'PCC';
  return (
    <Link to={ke} className="merek" aria-label={`${nama}, ke beranda`}>
      <span className={['tanda', info?.logo && 'ada-logo'].filter(Boolean).join(' ')} aria-hidden="true">
        {info?.logo ? <img src={info.logo} alt="" /> : singkat}
      </span>
      {!ringkas && (
        <span className="nama">
          <strong>{nama}</strong>
          <span>{info ? info.organisasi.naungan : 'Pemerintah Kabupaten Pasuruan'}</span>
        </span>
      )}
    </Link>
  );
}
