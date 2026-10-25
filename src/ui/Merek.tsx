import { Link } from 'react-router';
import { useInfo } from '../lib/konteks';

export function Merek({ ke = '/', ringkas }: { ke?: string; ringkas?: boolean }) {
  const { info } = useInfo();
  const nama = info?.organisasi.nama ?? 'Pasuruan Creative Center';
  const logo = info?.logo ?? '/merek/lambang-pcc.png';
  return (
    <Link to={ke} className="merek" aria-label={`${nama}, ke beranda`}>
      <img className="tanda" src={logo} alt="" width={23} height={40} />
      {!ringkas && (
        <span className="nama">
          <strong>{nama}</strong>
          <span>{info ? info.organisasi.naungan : 'Pemerintah Kabupaten Pasuruan'}</span>
        </span>
      )}
    </Link>
  );
}
