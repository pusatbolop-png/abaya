import emblem from '../aset/logo-emblem.webp';
import lengkap from '../aset/logo-lengkap.webp';

/** Emblem Al Wafa’ Islamic Center (buku terbuka dan tiga tetes: Aesthetic, Ethic, Logic). */
export function Lambang({ className }: { className?: string }) {
  return <img className={className} src={emblem} alt="Logo Al Wafa’" draggable={false} />;
}

/** Logo lengkap: emblem, tulisan Al Wafa’ Islamic Center, dan Bangil Pasuruan. Untuk latar gelap/tosca. */
export function LogoLengkap({ className }: { className?: string }) {
  return <img className={className} src={lengkap} alt="Al Wafa’ Islamic Center, Bangil Pasuruan" draggable={false} />;
}

/** Sudut hias untuk lembar raport. */
export function SudutHias({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" aria-hidden>
      <path d="M2 30V2h28" strokeWidth="1.6" />
      <path d="M8 22V8h14" strokeWidth=".8" />
      <path d="M2 2l12 12" strokeWidth=".8" />
      <path d="M14 8.5l2.2 3.3 3.8 1-2.5 3 .2 3.9-3.7-1.4-3.7 1.4.2-3.9-2.5-3 3.8-1z" fill="currentColor" stroke="none" opacity=".8" transform="translate(4 4) scale(.7)" />
    </svg>
  );
}
