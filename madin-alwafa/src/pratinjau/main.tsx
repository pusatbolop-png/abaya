// Titik masuk pratinjau: nyalakan server di peramban, lalu muat aplikasi yang sama dengan versi terpasang.
import { nyalakan } from './mesin';

const akar = document.getElementById('akar')!;
akar.innerHTML =
  '<div class="memuat-pratinjau" role="status"><div class="memuat-pratinjau__cincin"></div>' +
  '<b>Menyiapkan pratinjau Madin Al Wafa’…</b><span>Membuat data contoh santri, nilai, dan raport di peramban Anda.</span></div>';

// Tempat terbit pratinjau tidak mengizinkan jendela cetak; jelaskan alih-alih diam.
window.print = () => {
  const wadah = document.createElement('div');
  wadah.className = 'toast-wadah';
  wadah.innerHTML =
    '<div class="toast"><span>Cetak dan simpan PDF tidak tersedia di pratinjau ini. Di aplikasi yang terpasang di server madrasah, tombol ini membuka jendela cetak dan <i>Simpan sebagai PDF</i>.</span></div>';
  document.body.appendChild(wadah);
  setTimeout(() => wadah.remove(), 6500);
};

(async () => {
  try {
    await nyalakan();
    await import('../main');
  } catch (e) {
    console.error(e);
    akar.innerHTML =
      '<div class="memuat-pratinjau" role="alert"><b>Pratinjau gagal dimuat.</b><span>Muat ulang halaman ini, atau buka dengan peramban lain (Chrome, Safari, atau Edge versi terbaru).</span></div>';
  }
})();
