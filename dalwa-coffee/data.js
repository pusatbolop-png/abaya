// Data toko Dalwa Coffee.
// ISI DULU SEBELUM DIPAKAI BERJUALAN:
//   1. whatsapp : nomor admin format 62…, contoh '6281234567890'. Selama kosong, pembeli memilih kontak sendiri di WhatsApp.
//   2. price    : harga tiap kemasan dalam rupiah, contoh 85000. Selama 0, situs menulis "Tanya harga".
// Rasa, tingkat sangrai, dan berat diambil dari tulisan di kemasan.

window.DALWA = {
  whatsapp: '',
  perusahaan: 'PT. Dalwa Anugrah Hasaniyyah',

  varieties: {
    arabica: {
      name: 'Arabica', roast: 'Medium Roast', notes: ['Bright', 'Smooth', 'Balanced'],
      desc: 'Rasa cerah dan lembut dengan keseimbangan yang enak diminum tanpa gula.',
      accent: '#d2452a', side: '#3a1810',
    },
    robusta: {
      name: 'Robusta', roast: 'Medium Dark Roast', notes: ['Bold', 'Thick', 'Nutty'],
      desc: 'Seduhan tegas dan kental dengan gurih kacang, cocok untuk kopi susu dan tubruk.',
      accent: '#3f66f0', side: '#131a48',
    },
  },

  // scale = ukuran kemasan di panggung 3D dibanding kemasan 1 kg.
  products: [
    { id: 'arabica-250g', variety: 'arabica', weight: '250 g', grams: 250,  scale: .8,  price: 0, back: 'arabica-belakang' },
    { id: 'arabica-420g', variety: 'arabica', weight: '420 g', grams: 420,  scale: .9,  price: 0, back: 'arabica-belakang' },
    { id: 'arabica-1kg',  variety: 'arabica', weight: '1 kg',  grams: 1000, scale: 1,   price: 0, back: 'arabica-belakang' },
    { id: 'robusta-250g', variety: 'robusta', weight: '250 g', grams: 250,  scale: .8,  price: 0, back: 'robusta-250g-belakang' },
    { id: 'robusta-1kg',  variety: 'robusta', weight: '1 kg',  grams: 1000, scale: 1,   price: 0, back: 'robusta-1kg-belakang' },
  ],

  // Takaran umum untuk kopi bubuk; sesuaikan dengan selera.
  brews: [
    { name: 'Tubruk',       dose: '10 g', water: '150 ml', temp: '92–96 °C', time: '4 menit',   tip: 'Tuang air, aduk sekali, tunggu ampas turun.' },
    { name: 'V60',          dose: '15 g', water: '225 ml', temp: '90–93 °C', time: '2:30–3:00', tip: 'Basahi bubuk 30 detik, lalu tuang berputar perlahan.' },
    { name: 'French press', dose: '15 g', water: '250 ml', temp: '93 °C',    time: '4 menit',   tip: 'Tekan pelan dan langsung tuang ke cangkir.' },
    { name: 'Kopi susu',    dose: '18 g', water: '120 ml', temp: '93 °C',    time: '4 menit',   tip: 'Seduh pekat, saring, tambah susu dan gula aren.' },
  ],
};
