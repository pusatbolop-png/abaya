(() => {
  const { products, varieties: V, brews, whatsapp, perusahaan } = window.DALWA;
  const $ = (s, el = document) => el.querySelector(s);
  const rp = n => 'Rp' + Math.round(n).toLocaleString('id-ID');
  const harga = p => p.price ? rp(p.price) : 'Tanya harga';
  const nama = p => `${V[p.variety].name} ${p.weight}`;
  const byId = id => products.find(p => p.id === id);
  const n = products.length;

  const runway = $('#panggung'), stage = $('#stage'), panel = $('#lookPanel');
  const state = { mode: 'idle', cur: 0, pos: 0, spin: 0, qty: 1 };
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => innerWidth <= 820;

  const scene = window.Scene3D && window.Scene3D({
    canvas: $('#gl'), stage, panel, cupSpot: $('#cupSpot'), products, varieties: V, state,
  });

  // Tanpa WebGL: kemasan tampil sebagai deretan gambar yang tetap bisa dipilih.
  if (!scene) {
    document.body.classList.add('no3d');
    stage.innerHTML = products.map((p, i) =>
      `<button class="flat" data-i="${i}" style="--s:${p.scale}"><img src="assets/${p.id}-depan.webp" alt="${nama(p)}"></button>`).join('');
    $('#cupSpot').innerHTML = `<img src="assets/${products[2].id}-foto.webp" alt="">`;
  }

  // ---------- panggung ----------
  const mod = i => ((i % n) + n) % n;
  function sync() {
    const p = products[state.cur];
    document.body.dataset.variety = p.variety;
    $('#nowName').textContent = nama(p);
    if (!scene) stage.querySelectorAll('.flat').forEach((b, i) => b.classList.toggle('on', i === state.cur));
  }
  function goTo(i) { state.cur = state.pos = mod(i); sync(); }
  function focus(i) {
    const was = state.mode === 'focus' && mod(i) === state.cur;
    if (scene && state.mode === 'focus') scene.normalize(state.cur);
    state.cur = state.pos = mod(i);
    state.mode = 'focus'; runway.dataset.state = 'focus';
    if (!was) { state.qty = 1; state.spin = calm ? 0 : Math.PI * 2; } // satu putaran penuh: memperlihatkan sisi belakang
    panel.setAttribute('aria-hidden', 'false');
    sync(); renderPanel();
    if (isMobile()) runway.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }
  function unfocus() {
    if (scene) scene.normalize(state.cur);
    state.mode = 'idle'; runway.dataset.state = 'idle'; state.spin = 0;
    panel.setAttribute('aria-hidden', 'true');
  }
  const step = d => (state.mode === 'idle' ? goTo(state.cur + d) : focus(state.cur + d));

  function renderPanel() {
    const p = products[state.cur], v = V[p.variety];
    $('#panelEyebrow').textContent = `100% ${v.name}`;
    $('#panelTitle').textContent = nama(p);
    $('#panelNote').textContent = v.desc;
    $('#panelNotes').innerHTML = v.notes.map(x => `<li>${x}</li>`).join('');
    $('#panelSizes').innerHTML = products.map((q, i) => q.variety === p.variety
      ? `<button class="size ${q === p ? 'on' : ''}" data-i="${i}" aria-pressed="${q === p}">${q.weight}</button>` : '').join('');
    $('#panelSpecs').innerHTML = [
      ['Jenis', 'Kopi bubuk (ground coffee)'], ['Sangrai', v.roast], ['Isi bersih', p.weight], ['Produsen', perusahaan],
    ].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
    const ph = $('#panelPhoto'); ph.src = `assets/${p.id}-foto.webp`; ph.alt = `Kemasan ${nama(p)} tampak depan dan belakang`;
    renderTotal();
  }
  function renderTotal() {
    const p = products[state.cur];
    $('#panelQtyN').textContent = state.qty;
    $('#lookTotal').textContent = p.price ? rp(p.price * state.qty) : 'Tanya harga';
  }
  $('#panelSizes').addEventListener('click', e => { if (e.target.dataset.i) focus(+e.target.dataset.i); });
  $('#panelQty').addEventListener('click', e => {
    if (!e.target.dataset.q) return;
    state.qty = Math.max(1, Math.min(99, state.qty + +e.target.dataset.q)); renderTotal();
  });
  $('#closeLook').addEventListener('click', unfocus);
  $('#prevBtn').addEventListener('click', () => step(-1));
  $('#nextBtn').addEventListener('click', () => step(1));
  $('#nowBtn').addEventListener('click', () => focus(state.cur));
  $('#addLook').addEventListener('click', () => { addToCart(products[state.cur].id, state.qty); toast(`${nama(products[state.cur])} masuk keranjang`); });
  $('#buyNow').addEventListener('click', () => { addToCart(products[state.cur].id, state.qty); openOrder(); });

  // seret: saat melingkar, cincin ikut jari; saat satu kemasan dibuka, kemasan itu berputar
  let drag = null, dragged = false;
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const per = isMobile() ? stage.clientWidth * .5 : Math.min(stage.clientWidth * .33, 520) * Math.sin(2 * Math.PI / n);
    drag = { x: e.clientX, pos: state.pos, spin: state.spin, per: Math.max(per, 80) }; dragged = false;
  });
  addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!dragged && Math.abs(dx) > 8) { dragged = true; stage.classList.add('dragging'); }
    if (!dragged) return;
    if (state.mode === 'idle') state.pos = drag.pos - dx / drag.per;
    else state.spin = drag.spin + dx * .012;
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null; stage.classList.remove('dragging');
    if (dragged && state.mode === 'idle') goTo(Math.round(state.pos));
  };
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);
  stage.addEventListener('click', e => {
    if (dragged) { dragged = false; return; }
    const i = scene ? scene.pick(e.clientX, e.clientY) : +(e.target.closest('.flat') || { dataset: {} }).dataset.i;
    if (!(i >= 0)) return;
    if (state.mode === 'idle' && isMobile() && i !== state.cur) goTo(i); else focus(i);
  });
  if (scene) stage.addEventListener('mousemove', e => { if (!drag) stage.classList.toggle('over', scene.pick(e.clientX, e.clientY) >= 0); });

  addEventListener('keydown', e => {
    if (document.body.classList.contains('order-open')) { if (e.key === 'Escape') closeOrder(); return; }
    if (document.body.classList.contains('cart-open')) { if (e.key === 'Escape') closeCart(); return; }
    if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'Escape' && state.mode === 'focus') unfocus();
  });

  // saat diam, cincin berputar sendiri; gerakan pengunjung mengulang hitungan
  let auto;
  function restartAuto() {
    clearInterval(auto);
    if (calm) return;
    auto = setInterval(() => {
      const busy = drag || document.hidden || document.body.classList.contains('cart-open') || document.body.classList.contains('order-open');
      if (state.mode === 'idle' && !busy && scrollY < innerHeight * .6) goTo(state.cur + 1);
    }, 3800);
  }
  ['pointerdown', 'keydown', 'wheel'].forEach(ev => addEventListener(ev, restartAuto, { passive: true }));
  restartAuto();

  // ---------- koleksi ----------
  $('#grid').innerHTML = Object.entries(V).map(([key, v]) => `
    <div class="variety" data-v="${key}">
      <div class="variety-info">
        <h3>${v.name}</h3>
        <p class="roast">${v.roast}</p>
        <p>${v.desc}</p>
        <ul class="notes">${v.notes.map(x => `<li>${x}</li>`).join('')}</ul>
      </div>
      <div class="cards">${products.map((p, i) => p.variety !== key ? '' : `
        <article class="card">
          <button class="card-img" data-look="${i}" aria-label="Lihat ${nama(p)} dalam 3D">
            <img src="assets/${p.id}-foto.webp" alt="Kemasan ${nama(p)}" loading="lazy" width="1152" height="768">
            <span class="stl">Putar kemasan 3D</span>
          </button>
          <div class="card-row">
            <div><h4>${nama(p)}</h4><p class="price">${harga(p)}</p></div>
            <button class="add" data-add="${p.id}" aria-label="Tambah ${nama(p)} ke keranjang">+</button>
          </div>
        </article>`).join('')}</div>
    </div>`).join('');
  $('#grid').addEventListener('click', e => {
    const add = e.target.closest('[data-add]'), look = e.target.closest('[data-look]');
    if (add) { addToCart(add.dataset.add, 1); toast(`${nama(byId(add.dataset.add))} masuk keranjang`); }
    else if (look) { runway.scrollIntoView({ behavior: 'smooth' }); setTimeout(() => focus(+look.dataset.look), 450); }
  });

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

  // ---------- keranjang ----------
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('dalwa-cart') || '[]').filter(c => byId(c.pid) && c.qty > 0); } catch { cart = []; }
  const saveCart = () => { try { localStorage.setItem('dalwa-cart', JSON.stringify(cart)); } catch {} };
  function addToCart(pid, qty) {
    const ex = cart.find(c => c.pid === pid);
    ex ? (ex.qty += qty) : cart.push({ pid, qty });
    saveCart(); renderCart();
    const b = $('#cartCount'); b.classList.add('bump'); setTimeout(() => b.classList.remove('bump'), 300);
    if (scene) scene.burst();
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
    $('#waNote').textContent = whatsapp ? 'WhatsApp terbuka di tab baru dengan pesan yang sudah terisi.'
      : 'Nomor admin belum dipasang di situs ini. Pilih kontak penjual di WhatsApp, atau salin pesannya.';
    showStep(true);
  });
  $('#waLink').addEventListener('click', () => { cart = []; saveCart(); renderCart(); toast('Lanjutkan pesanan di WhatsApp'); });
  $('#copyWa').addEventListener('click', () => {
    const ta = $('#waText'), ok = () => toast('Pesan disalin');
    const manual = () => { ta.focus(); ta.select(); toast('Pesan dipilih. Tekan salin di papan ketik.'); };
    try { navigator.clipboard.writeText(ta.value).then(ok, manual); } catch { manual(); }
  });

  let tt; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2400); }

  sync(); renderCart();
})();
