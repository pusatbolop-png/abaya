(() => {
  const { products, varieties: V, brews, perusahaan } = window.DALWA;
  let whatsapp = window.DALWA.whatsapp;
  const $ = (s, el = document) => el.querySelector(s);
  const rp = n => 'Rp' + Math.round(n).toLocaleString('id-ID');
  const harga = p => p.habis ? 'Stok habis' : p.price ? rp(p.price) : 'Tanya harga';
  const nama = p => `${V[p.variety].name} ${p.weight}`;
  const byId = id => products.find(p => p.id === id);
  const n = products.length;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => innerWidth <= 820;

  function setWhatsapp(nomor) {
    whatsapp = nomor;
    $('#chatBtn').href = `https://wa.me/${whatsapp}`;
    $('#waNumber').textContent = '+' + whatsapp.replace(/^(62)(\d{3})(\d{4})(\d+)$/, '$1 $2-$3-$4');
  }
  setWhatsapp(whatsapp);

  // ---------- panggung video ----------
  // Tiap kemasan adalah satu video yang latarnya sudah disamakan dengan warna halaman.
  // Hanya yang terdepan diputar; yang lain menampilkan gambar diamnya.
  const runway = $('#panggung'), stage = $('#stage'), panel = $('#lookPanel');
  const state = { mode: 'idle', cur: 0, pos: 0, qty: 1 };
  const models = products.map((p, i) => {
    const el = document.createElement('div');
    el.className = 'model enter';
    el.innerHTML = `<img src="assets/video/${p.id}.webp" alt="${nama(p)}" draggable="false">`;
    el.addEventListener('click', () => (i === state.cur || !isMobile() || state.mode === 'focus' ? focus(i) : goTo(i)));
    stage.appendChild(el);
    return { el, p };
  });
  const busy = () => document.body.classList.contains('cart-open') || document.body.classList.contains('order-open');
  const mod = i => ((i % n) + n) % n;

  // Satu pemutar dipakai bergantian. Ponsel sering memutar warna video sedikit berbeda dari warna halaman,
  // sehingga tepi bingkainya terlihat sebagai garis kotak. Karena itu tiap bingkai digambar lewat kanvas:
  // warna dinding dibaca dari tepi bingkai itu sendiri, lalu seluruh gambar digeser agar dinding
  // tepat sama dengan warna halaman. Isi gambarnya tidak diubah.
  const PAGE = [216 / 255, 209 / 255, 198 / 255]; // --bg
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920; canvas.className = 'clip';
  const gl = (() => {
    try {
      const g = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true }); // gambar terakhir tetap ada bila belum digambar ulang
      if (!g) return null;
      const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); return s; };
      const prog = g.createProgram();
      g.attachShader(prog, sh(g.VERTEX_SHADER, 'attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }'));
      g.attachShader(prog, sh(g.FRAGMENT_SHADER, 'precision mediump float; uniform sampler2D t; uniform vec3 k; varying vec2 uv;' +
        'void main(){ gl_FragColor = vec4(clamp(texture2D(t, uv).rgb * k, 0., 1.), 1.); }'));
      g.linkProgram(prog);
      if (!g.getProgramParameter(prog, g.LINK_STATUS)) return null;
      g.useProgram(prog);
      g.kLoc = g.getUniformLocation(prog, 'k'); g.uniform3fv(g.kLoc, [1, 1, 1]);
      g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
      const loc = g.getAttribLocation(prog, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
      g.bindTexture(g.TEXTURE_2D, g.createTexture());
      [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T].forEach(k => g.texParameteri(g.TEXTURE_2D, k, g.CLAMP_TO_EDGE));
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.clearColor(PAGE[0], PAGE[1], PAGE[2], 1); g.clear(g.COLOR_BUFFER_BIT);   // kanvas kosong sewarna halaman, bukan hitam
      return g;
    } catch (err) { return null; }
  })();
  const screen = gl ? canvas : video;   // tanpa WebGL, videonya sendiri yang ditampilkan
  if (!gl) video.className = 'clip'; else { video.className = 'feed'; document.body.appendChild(video); }

  let host = null, lastT = -1, raf = 0, ready = false;
  // Warna dinding = median piksel tepi (kolom kiri-kanan di 60% bagian atas, dan baris atas di luar sepertiga tengah).
  // Median dipakai agar biji, uap, atau bayangan yang lewat di tepi tidak ikut terbaca sebagai dinding.
  const probe = document.createElement('canvas'); probe.width = 36; probe.height = 64;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  let wall = null;
  function readWall() {
    try {
      pctx.drawImage(video, 0, 0, 36, 64);
      const d = pctx.getImageData(0, 0, 36, 64).data, ch = [[], [], []];
      const take = (x, y) => { const o = (y * 36 + x) * 4; ch[0].push(d[o]); ch[1].push(d[o + 1]); ch[2].push(d[o + 2]); };
      for (let y = 0; y < 38; y++) { take(0, y); take(1, y); take(34, y); take(35, y); }
      for (let x = 0; x < 12; x++) { take(x, 0); take(x, 1); take(35 - x, 0); take(35 - x, 1); }
      const med = ch.map(c => { c.sort((p, q) => p - q); return c[c.length >> 1] / 255; });
      if (med.some(v => v < .5)) return;                       // bukan dinding terang: abaikan bingkai ini
      wall = wall ? wall.map((v, i) => v * .7 + med[i] * .3) : med;
      gl.uniform3fv(gl.kLoc, wall.map((v, i) => Math.min(1.25, Math.max(.8, PAGE[i] / v))));
    } catch (err) { /* kanvas tidak bisa dibaca: gambar tampil tanpa penyesuaian */ }
  }
  video.addEventListener('playing', () => { ready = true; if (!gl && host) host.classList.add('playing'); });
  video.addEventListener('ended', () => {
    if (state.mode === 'idle' && !drag && !document.hidden && !busy()) goTo(state.cur + 1);
    else { video.currentTime = 0; video.play().catch(() => {}); }
  });
  function draw() {
    raf = requestAnimationFrame(draw);
    if (!ready || video.readyState < 2 || video.currentTime === lastT) return;
    lastT = video.currentTime;
    readWall();
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video); } catch (err) { return; }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (host) host.classList.add('playing');
  }
  function play() {
    const m = models[state.cur], src = `assets/video/${m.p.id}.mp4`;
    // kemasan yang sama dan videonya sedang jalan (misalnya saat detailnya dibuka): biarkan, jangan diulang dari awal
    if (host === m.el && video.src.endsWith(src) && !video.paused && !video.ended && !calm && !document.hidden) return;
    cancelAnimationFrame(raf);
    if (host) host.classList.remove('playing');
    if (calm || document.hidden) { video.pause(); return; }
    host = m.el; host.appendChild(screen); lastT = -1; ready = false; wall = null;
    if (gl) gl.clear(gl.COLOR_BUFFER_BIT);
    if (!video.src.endsWith(src)) video.src = src; else video.currentTime = 0;
    video.play().catch(() => {});
    if (gl) draw();
  }
  document.addEventListener('visibilitychange', play);
  // bila peramban menahan putar otomatis, sentuhan pertama pengunjung memulai videonya
  addEventListener('pointerdown', () => { if (video.paused && !calm) video.play().catch(() => {}); }, { once: true });

  function layout() {
    const W = stage.clientWidth, H = stage.clientHeight, R = runway.clientHeight, mob = isMobile();
    const focusOn = state.mode === 'focus', panelW = mob ? 0 : panel.offsetWidth;
    const h = Math.min(H * (mob ? 1 : .86), (mob ? W * 1.02 : W * .23) * 16 / 9), w = h * 9 / 16;
    const Rx = Math.min(W * .4, 620);
    models.forEach((m, i) => {
      let d = mod(i - state.pos); if (d > n / 2) d -= n;
      const ad = Math.abs(d);
      let x, y = 0, s, z, op = 1, blur = 0, dim = ad > .5;
      if (!focusOn) {
        if (mob) { x = W / 2 + d * W * .82; s = 1 - .22 * Math.min(1, ad); z = 10 - Math.round(ad); if (ad > 1.5) op = 0; }
        else {
          const th = d * 2 * Math.PI / n, t = (Math.cos(th) + 1) / 2;
          x = W / 2 + Rx * Math.sin(th); s = .5 + .5 * Math.pow(t, 1.4); y = -H * .07 * (1 - t);
          op = t > .5 ? 1 : 0; z = Math.round(t * 100); // barisan belakang disembunyikan: letaknya persis di belakang kemasan samping
        }
      } else {
        const areaW = W - panelW, cx = areaW / 2;
        if (mob) {
          const sheet = Math.min(.8, panel.offsetHeight / R) || .58, avail = R * (1 - sheet) - 20;
          s = ad < .5 ? Math.min(1, avail / h) : .4; y = -(stage.offsetTop + H - R * (1 - sheet)) - 10; x = cx + d * W * .7;
        } else { s = ad < .5 ? Math.min(1.12, H * .94 / h) : .6; x = cx + d * Math.max(areaW * .42, w * 1.1); }
        z = ad < .5 ? 10 : 5 - Math.round(ad); if (ad > 1.5) op = 0;
      }
      m.el.style.width = w + 'px'; m.el.style.height = h + 'px';
      m.el.style.transform = `translate(${x - w / 2}px, ${y}px) scale(${s})`;
      m.el.style.zIndex = z; m.el.style.opacity = op;
      m.el.style.filter = blur ? `blur(${blur.toFixed(1)}px)` : '';
      m.el.classList.toggle('dim', dim);
    });
  }

  function sync() { $('#nowName').textContent = nama(products[state.cur]); play(); layout(); }
  function goTo(i) { state.cur = state.pos = mod(i); sync(); }
  function focus(i) {
    const same = state.mode === 'focus' && mod(i) === state.cur;
    state.cur = state.pos = mod(i); state.mode = 'focus'; runway.dataset.state = 'focus'; document.body.classList.add('focus');
    if (!same) state.qty = 1;
    panel.setAttribute('aria-hidden', 'false');
    renderPanel(); sync();
    if (isMobile()) { requestAnimationFrame(layout); runway.scrollIntoView({ block: 'end', behavior: 'smooth' }); }
  }
  function unfocus() { state.mode = 'idle'; runway.dataset.state = 'idle'; document.body.classList.remove('focus'); panel.setAttribute('aria-hidden', 'true'); layout(); }
  const step = d => (state.mode === 'idle' ? goTo(state.cur + d) : focus(state.cur + d));

  function renderPanel() {
    const p = products[state.cur], v = V[p.variety];
    $('#panelEyebrow').textContent = `100% ${v.name}`;
    $('#panelTitle').textContent = nama(p);
    $('#panelNote').textContent = v.desc;
    $('#panelNotes').innerHTML = v.notes.map(x => `<li>${x}</li>`).join('');
    $('#panelSizes').innerHTML = products.map((q, i) => q.variety === p.variety
      ? `<button class="size ${q === p ? 'on' : ''}" data-i="${i}" aria-pressed="${q === p}">${q.weight}</button>` : '').join('');
    $('#panelSpecs').innerHTML = [['Jenis', 'Kopi bubuk (ground coffee)'], ['Sangrai', v.roast], ['Isi bersih', p.weight], ['Produsen', perusahaan]]
      .map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
    const ph = $('#panelPhoto'); ph.src = `assets/${v.back}.webp`; ph.alt = `Sisi belakang kemasan ${v.name}`;
    renderTotal();
  }
  function renderTotal() {
    const p = products[state.cur];
    $('#panelQtyN').textContent = state.qty;
    $('#lookTotal').textContent = p.habis ? 'Stok habis' : p.price ? rp(p.price * state.qty) : 'Tanya harga';
    $('#buyNow').disabled = $('#addLook').disabled = !!p.habis;
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

  // geser: cincin mengikuti jari, lalu berhenti di kemasan terdekat
  let drag = null, dragged = false;
  stage.addEventListener('dragstart', e => e.preventDefault());
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const per = isMobile() ? stage.clientWidth * .82 : Math.min(stage.clientWidth * .4, 620) * Math.sin(2 * Math.PI / n);
    drag = { x: e.clientX, pos: state.pos, per: Math.max(per, 80) }; dragged = false;
  });
  addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!dragged && Math.abs(dx) > 8) { dragged = true; stage.classList.add('dragging'); }
    if (dragged && state.mode === 'idle') { state.pos = drag.pos - dx / drag.per; layout(); }
  });
  const endDrag = e => {
    if (!drag) return;
    const dx = e.clientX - drag.x; drag = null; stage.classList.remove('dragging');
    if (!dragged) return;
    if (state.mode === 'idle') goTo(Math.round(state.pos));
    else if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  };
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);
  stage.addEventListener('click', e => { if (dragged) { e.stopPropagation(); dragged = false; } }, true);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 80); });

  // ---------- koleksi ----------
  const renderGrid = () => $('#grid').innerHTML = products.map((p, i) => `
    <article class="card" data-v="${p.variety}">
      <button class="card-img" data-look="${i}" aria-label="Putar video ${nama(p)}">
        <img src="assets/kemasan/${p.id}.webp" alt="Kemasan ${nama(p)}" loading="lazy">
        <span class="stl">Putar video</span>
      </button>
      <div class="card-row">
        <div><p class="tag">${V[p.variety].roast}</p><h3>${nama(p)}</h3><p class="price">${harga(p)}</p></div>
        <button class="add" data-add="${p.id}" aria-label="Tambah ${nama(p)} ke keranjang" ${p.habis ? 'disabled' : ''}>+</button>
      </div>
    </article>`).join('');
  renderGrid();
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

  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.body.classList.contains('order-open')) closeOrder();
    else if (document.body.classList.contains('cart-open')) closeCart();
    else if (state.mode === 'focus') unfocus();
  });

  // ---------- keranjang ----------
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('dalwa-cart') || '[]').filter(c => byId(c.pid) && c.qty > 0); } catch { cart = []; }
  const saveCart = () => { try { localStorage.setItem('dalwa-cart', JSON.stringify(cart)); } catch {} };
  function addToCart(pid, qty) {
    if (byId(pid).habis) { toast('Maaf, kemasan ini sedang habis'); return; }
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
        <div class="thumb"><img src="assets/kemasan/${p.id}.webp" alt=""></div>
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
    $('#orderTitle').textContent = done ? 'Pesanan Diterima' : 'Data Pengiriman';
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
    const kirim = $('#orderForm button[type="submit"]');
    kirim.disabled = true; kirim.textContent = 'Mengirim pesanan…'; $('#orderErr').textContent = '';
    const data = {
      items: cart.map(c => ({ id: c.pid, qty: c.qty })),
      penerima: { nama: f('nama'), hp: f('hp') },
      alamat: Object.fromEntries(['provinsi', 'kota', 'kecamatan', 'kelurahan', 'jalan', 'no', 'rt', 'rw', 'kodepos', 'patokan'].map(k => [k, f(k)])),
      bayar: form.bayar.value, catatan: f('catatan'), situs: form.situs ? form.situs.value : '',
    };
    fetch('/api/pesanan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
      .then(r => r.json().catch(() => ({})).then(isi => ({ ok: r.ok, isi })))
      .then(({ ok, isi }) => {
        if (!ok || !isi.kode) throw new Error(isi.galat || 'Pesanan belum terkirim. Periksa sambungan internet lalu coba lagi.');
        $('#doneCode').textContent = isi.kode;
        $('#doneItems').innerHTML = (isi.items || []).map(x => `<li><span>${x.nama} × ${x.jumlah}</span><span>${rp(x.harga * x.jumlah)}</span></li>`).join('');
        $('#doneSub').textContent = rp(isi.subtotal || 0);
        $('#donePay').textContent = data.bayar;
        cart = []; saveCart(); renderCart();
        showStep(true);
      })
      .catch(err => { $('#orderErr').textContent = err.message === 'Failed to fetch' ? 'Pesanan belum terkirim. Periksa sambungan internet lalu coba lagi.' : err.message; })
      .finally(() => { kirim.disabled = false; kirim.textContent = 'Buat pesanan'; });
  });
  $('#doneClose').addEventListener('click', closeOrder);

  // harga, stok, dan nomor WhatsApp terbaru diatur dari dasbor admin; data.js hanya cadangan
  fetch('/api/toko').then(r => r.ok ? r.json() : null).then(t => {
    if (!t || !Array.isArray(t.produk)) return;
    t.produk.forEach(x => { const p = byId(x.id); if (p) { p.price = x.harga; p.habis = !x.aktif; } });
    if (t.whatsapp) setWhatsapp(t.whatsapp);
    renderGrid(); renderCart(); renderTotal();
    if (state.mode === 'focus') renderPanel();
  }).catch(() => {});

  let tt; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2400); }

  renderCart();
  // masuk dari kanan, lalu video terdepan mulai diputar
  requestAnimationFrame(() => {
    const W = stage.clientWidth;
    models.forEach(m => { m.el.style.transform = `translate(${W + 200}px, 0) scale(.6)`; });
    stage.offsetHeight;
    models.forEach((m, i) => { m.el.classList.remove('enter'); m.el.style.transitionDelay = (i * 90) + 'ms'; });
    sync();
    setTimeout(() => models.forEach(m => (m.el.style.transitionDelay = '')), 1600);
  });
})();
