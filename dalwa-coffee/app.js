(() => {
  const { products, varieties: V, brews, whatsapp } = window.DALWA;
  const $ = (s, el = document) => el.querySelector(s);
  const rp = n => 'Rp' + Math.round(n).toLocaleString('id-ID');
  const harga = p => p.price ? rp(p.price) : 'Tanya harga';
  const nama = p => `${V[p.variety].name} ${p.weight}`;
  const byId = id => products.find(p => p.id === id);

  const scene = window.Scene3D && window.Scene3D({
    canvas: $('#gl'),
    els: { grindAct: $('#grind'), grinder: $('#grinderSpot'), pourAct: $('#pour'), dripper: $('#dripperSpot'), pool: $('#poolSpot'), mug: $('#mugSpot') },
  });
  // Tanpa WebGL: foto produk menggantikan benda 3D.
  if (!scene) {
    document.body.classList.add('no3d');
    $('#grinderSpot').innerHTML = `<img src="assets/arabica-1kg-foto.webp" alt="Kemasan Dalwa Coffee Arabica">`;
    $('#dripperSpot').innerHTML = `<img src="assets/robusta-1kg-foto.webp" alt="Kemasan Dalwa Coffee Robusta">`;
  }

  $('#chatBtn').href = `https://wa.me/${whatsapp}`;
  $('#waNumber').textContent = '+' + whatsapp.replace(/^(62)(\d{3})(\d{4})(\d+)$/, '$1 $2-$3-$4');

  // ---------- kartu produk ----------
  // Kartu bisa dibalik untuk melihat sisi belakang kemasan.
  const card = p => {
    const v = V[p.variety];
    return `<article class="card" data-v="${p.variety}">
      <p class="card-label">${v.name}<span>${v.roast}</span></p>
      <button class="bag" data-flip aria-label="Balik kemasan ${nama(p)}" style="--s:${p.scale}">
        <span class="bag-in">
          <img src="assets/${p.id}-depan.webp" alt="Kemasan ${nama(p)} tampak depan" loading="lazy" width="560" height="1080">
          <img class="bk" src="assets/${p.back}.webp" alt="" loading="lazy" width="560" height="1080">
        </span>
      </button>
      <h3>${nama(p)}</h3>
      <p class="card-notes">${v.notes.join(' · ')}</p>
      <p class="price">${harga(p)}</p>
      <div class="card-btns">
        <button class="pill sm" data-buy="${p.id}">Beli</button>
        <button class="pill sm ghost" data-add="${p.id}" aria-label="Tambah ${nama(p)} ke keranjang">+ Keranjang</button>
      </div>
    </article>`;
  };
  const side = v => `<div class="side side-${v}">${products.filter(p => p.variety === v).map(card).join('')}</div>`;
  const cards = $('#cards');
  cards.innerHTML = side('arabica') + side('robusta');
  cards.addEventListener('click', e => {
    const flip = e.target.closest('[data-flip]'), buy = e.target.closest('[data-buy]'), add = e.target.closest('[data-add]');
    if (flip) flip.classList.toggle('flipped');
    if (buy) { addToCart(buy.dataset.buy, 1); openOrder(); }
    if (add) { addToCart(add.dataset.add, 1); toast(`${nama(byId(add.dataset.add))} masuk keranjang`); }
  });
  // titik penanda saat kartu digeser menyamping di layar sempit
  const all = [...cards.querySelectorAll('.card')];
  $('#dots').innerHTML = all.map(() => '<i></i>').join('');
  function markDot() {
    const mid = cards.getBoundingClientRect().left + cards.clientWidth / 2;
    let best = 0, bd = 1e9;
    all.forEach((c, i) => { const r = c.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid); if (d < bd) { bd = d; best = i; } });
    [...$('#dots').children].forEach((d, i) => d.classList.toggle('on', i === best));
  }
  cards.addEventListener('scroll', markDot, { passive: true }); markDot();

  // ---------- cara seduh ----------
  let brew = 0;
  function renderBrew() {
    $('#brewTabs').innerHTML = brews.map((b, i) => `<button role="tab" aria-selected="${i === brew}" data-b="${i}">${b.name}</button>`).join('');
    const b = brews[brew];
    $('#brewCard').innerHTML = [['Bubuk', b.dose], ['Air', b.water], ['Suhu', b.temp], ['Waktu', b.time]]
      .map(([a, c]) => `<div><dt>${a}</dt><dd>${c}</dd></div>`).join('') + `<p>${b.tip}</p>`;
  }
  $('#brewTabs').addEventListener('click', e => { if (e.target.dataset.b) { brew = +e.target.dataset.b; renderBrew(); } });
  renderBrew();

  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.body.classList.contains('order-open')) closeOrder();
    else if (document.body.classList.contains('cart-open')) closeCart();
  });

  // ---------- keranjang ----------
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('dalwa-cart') || '[]').filter(c => byId(c.pid) && c.qty > 0); } catch { cart = []; }
  const saveCart = () => { try { localStorage.setItem('dalwa-cart', JSON.stringify(cart)); } catch {} };
  function addToCart(pid, qty) {
    const ex = cart.find(c => c.pid === pid);
    ex ? (ex.qty += qty) : cart.push({ pid, qty });
    saveCart(); renderCart();
    const b = $('#cartCount'); b.classList.add('bump'); setTimeout(() => b.classList.remove('bump'), 300);
  }
  const subtotal = () => cart.every(c => byId(c.pid).price)
    ? rp(cart.reduce((t, c) => t + byId(c.pid).price * c.qty, 0)) : 'Dikonfirmasi admin';
  function renderCart() {
    $('#cartCount').textContent = cart.reduce((t, c) => t + c.qty, 0);
    $('#cartItems').innerHTML = cart.length ? cart.map((c, i) => {
      const p = byId(c.pid);
      return `<li class="li" data-k="${i}">
        <div class="thumb"><img src="assets/${p.id}-depan.webp" alt=""></div>
        <div>
          <div class="li-name">${nama(p)}</div>
          <div class="price">${harga(p)} · kopi bubuk</div>
          <div class="qty"><button data-q="-1" aria-label="Kurangi">−</button><span>${c.qty}</span><button data-q="1" aria-label="Tambah">+</button></div>
        </div>
        <button class="rm" data-rm>Hapus</button>
      </li>`;
    }).join('') : '<li class="empty">Keranjang masih kosong.<br>Pilih kopimu dulu.</li>';
    $('#cartTotal').textContent = cart.length ? subtotal() : rp(0);
    $('#checkout').disabled = !cart.length;
  }
  $('#cartItems').addEventListener('click', e => {
    const li = e.target.closest('.li'); if (!li) return;
    const c = cart[+li.dataset.k];
    if (e.target.dataset.q) c.qty += +e.target.dataset.q;
    if (e.target.hasAttribute('data-rm') || c.qty < 1) cart.splice(+li.dataset.k, 1);
    saveCart(); renderCart();
  });
  const openCart = () => { document.body.classList.add('cart-open'); $('#cart').setAttribute('aria-hidden', 'false'); };
  const closeCart = () => { document.body.classList.remove('cart-open'); $('#cart').setAttribute('aria-hidden', 'true'); };
  $('#cartBtn').addEventListener('click', openCart);
  $('#closeCart').addEventListener('click', closeCart);
  $('#scrim').addEventListener('click', closeCart);
  $('#checkout').addEventListener('click', () => { if (cart.length) { closeCart(); openOrder(); } });

  // ---------- formulir pesanan ----------
  const PROV = ['Aceh','Sumatera Utara','Sumatera Barat','Riau','Kepulauan Riau','Jambi','Sumatera Selatan','Kepulauan Bangka Belitung','Bengkulu','Lampung','DKI Jakarta','Banten','Jawa Barat','Jawa Tengah','DI Yogyakarta','Jawa Timur','Bali','Nusa Tenggara Barat','Nusa Tenggara Timur','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan','Kalimantan Timur','Kalimantan Utara','Sulawesi Utara','Gorontalo','Sulawesi Tengah','Sulawesi Barat','Sulawesi Selatan','Sulawesi Tenggara','Maluku','Maluku Utara','Papua','Papua Barat','Papua Barat Daya','Papua Tengah','Papua Pegunungan','Papua Selatan'];
  $('#provList').innerHTML = PROV.map(p => `<option value="${p}">`).join('');
  const order = $('#order'), form = $('#orderForm');
  const ADDR = ['nama', 'hp', 'provinsi', 'kota', 'kecamatan', 'kelurahan', 'jalan', 'no', 'rt', 'rw', 'kodepos', 'patokan'];

  function showStep(done) {
    $('#orderBody').hidden = $('#footForm').hidden = done;
    $('#orderDone').hidden = $('#footDone').hidden = !done;
    $('#orderTitle').textContent = done ? 'Kirim Pesanan' : 'Data Pengiriman';
  }
  function openOrder() {
    try { const a = JSON.parse(localStorage.getItem('dalwa-addr') || '{}'); ADDR.forEach(k => { if (a[k] && !form[k].value) form[k].value = a[k]; }); } catch {}
    $('#orderItems').innerHTML = cart.map(c => { const p = byId(c.pid);
      return `<li><span>${nama(p)} × ${c.qty}</span><span>${p.price ? rp(p.price * c.qty) : 'Tanya harga'}</span></li>`; }).join('');
    $('#orderSub').textContent = subtotal();
    $('#orderErr').textContent = '';
    showStep(false);
    document.body.classList.add('order-open'); order.setAttribute('aria-hidden', 'false');
  }
  function closeOrder() { document.body.classList.remove('order-open'); order.setAttribute('aria-hidden', 'true'); }
  $('#closeOrder').addEventListener('click', closeOrder);
  order.addEventListener('click', e => { if (e.target === order) closeOrder(); });

  const RULES = {
    hp: [/^(\+?62|0)8\d{7,12}$/, 'No. WhatsApp tidak valid (contoh: 081234567890)'],
    rt: [/^\d{1,3}$/, 'RT harus angka'],
    rw: [/^\d{1,3}$/, 'RW harus angka'],
    kodepos: [/^\d{5}$/, 'Kode pos harus 5 angka'],
  };
  form.addEventListener('input', e => e.target.classList.remove('err'));
  form.addEventListener('submit', e => {
    e.preventDefault();
    let first = null, msg = '';
    [...form.elements].forEach(el => {
      if (!el.name || el.type === 'radio') return;
      const v = el.value = el.value.trim().replace(/\s+/g, el.name === 'hp' ? '' : ' ');
      const rule = RULES[el.name];
      const bad = (el.required && !v) || (!!v && !!rule && !rule[0].test(v));
      el.classList.toggle('err', bad);
      if (bad && !first) { first = el; msg = v && rule ? rule[1] : 'Lengkapi kolom yang ditandai merah agar paket sampai.'; }
    });
    if (first) { $('#orderErr').textContent = msg; first.focus(); return; }
    const f = k => form[k].value;
    try { localStorage.setItem('dalwa-addr', JSON.stringify(Object.fromEntries(ADDR.map(k => [k, f(k)])))); } catch {}
    const text = [
      "Assalamu'alaikum, saya mau pesan Dalwa Coffee:",
      ...cart.map(c => { const p = byId(c.pid); return `• ${nama(p)} (bubuk) x${c.qty}${p.price ? ' — ' + rp(p.price * c.qty) : ''}`; }),
      `Subtotal: ${subtotal()} (belum termasuk ongkir)`,
      '', '*Penerima*', `${f('nama')} — ${f('hp')}`,
      '', '*Alamat*',
      `${f('jalan')} No. ${f('no')}, RT ${f('rt').padStart(3, '0')}/RW ${f('rw').padStart(3, '0')}`,
      `Kel. ${f('kelurahan')}, Kec. ${f('kecamatan')}`,
      `${f('kota')}, ${f('provinsi')} ${f('kodepos')}`,
      f('patokan') ? `Patokan: ${f('patokan')}` : null,
      '', `*Pembayaran:* ${form.bayar.value}`,
      f('catatan') ? `*Catatan:* ${f('catatan')}` : null,
    ].filter(l => l !== null).join('\n');
    $('#waText').value = text;
    $('#waLink').href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;
    showStep(true);
  });
  $('#waLink').addEventListener('click', () => { cart = []; saveCart(); renderCart(); toast('Lanjutkan pesanan di WhatsApp'); });
  $('#copyWa').addEventListener('click', () => {
    const ta = $('#waText'), ok = () => toast('Pesan disalin');
    const manual = () => { ta.focus(); ta.select(); toast('Pesan dipilih. Tekan salin di papan ketik.'); };
    try { navigator.clipboard.writeText(ta.value).then(ok, manual); } catch { manual(); }
  });

  let tt; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2400); }

  renderCart();
})();
