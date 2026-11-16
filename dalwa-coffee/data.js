// Data toko Dalwa Coffee.
//   whatsapp : nomor admin format 62…
//   price    : harga tiap kemasan dalam rupiah. SEMUA MASIH HARGA SEMENTARA Rp400.000; ganti dengan harga sebenarnya.
// Rasa, tingkat sangrai, dan berat diambil dari tulisan di kemasan.

window.DALWA = {
  whatsapp: '6287818181330',
  perusahaan: 'PT. Dalwa Anugrah Hasaniyyah',

  varieties: {
    arabica: {
      name: 'Arabica', roast: 'Medium Roast', notes: ['Bright', 'Smooth', 'Balanced'],
      desc: 'Rasa cerah dan lembut dengan keseimbangan yang enak diminum tanpa gula.',
      back: 'arabica-belakang',
    },
    robusta: {
      name: 'Robusta', roast: 'Medium Dark Roast', notes: ['Bold', 'Thick', 'Nutty'],
      desc: 'Seduhan tegas dan kental dengan gurih kacang, cocok untuk kopi susu dan tubruk.',
      back: 'robusta-250g-belakang',
    },
  },

  // Satu kemasan = satu video di panggung (assets/video/<id>.mp4 dan .jpg sebagai gambar diamnya).
  products: [
    { id: 'arabica-250g', variety: 'arabica', weight: '250 g', price: 400000 },
    { id: 'arabica-420g', variety: 'arabica', weight: '420 g', price: 400000 },
    { id: 'arabica-1kg',  variety: 'arabica', weight: '1 kg',  price: 400000 },
    { id: 'robusta-250g', variety: 'robusta', weight: '250 g', price: 400000 },
    { id: 'robusta-420g', variety: 'robusta', weight: '420 g', price: 400000 },
    { id: 'robusta-1kg',  variety: 'robusta', weight: '1 kg',  price: 400000 },
  ],

  // Takaran umum untuk kopi bubuk; sesuaikan dengan selera.
  brews: [
    { name: 'Tubruk',       dose: '10 g', water: '150 ml', temp: '92–96 °C', time: '4 menit',   tip: 'Tuang air, aduk sekali, tunggu ampas turun.' },
    { name: 'V60',          dose: '15 g', water: '225 ml', temp: '90–93 °C', time: '2:30–3:00', tip: 'Basahi bubuk 30 detik, lalu tuang berputar perlahan.' },
    { name: 'French press', dose: '15 g', water: '250 ml', temp: '93 °C',    time: '4 menit',   tip: 'Tekan pelan dan langsung tuang ke cangkir.' },
    { name: 'Kopi susu',    dose: '18 g', water: '120 ml', temp: '93 °C',    time: '4 menit',   tip: 'Seduh pekat, saring, tambah susu dan gula aren.' },
  ],
};
