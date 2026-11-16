(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const rp = n => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STATUS = [['baru', 'Baru'], ['dikonfirmasi', 'Dikonfirmasi'], ['dikemas', 'Dikemas'], ['dikirim', 'Dikirim'], ['selesai', 'Selesai'], ['batal', 'Batal']];
  const LABEL = Object.fromEntries(STATUS);
  const pill = s => `<span class="pill" data-s="${s}">${LABEL[s] || s}</span>`;
  const wib = (iso, opsi) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', ...opsi });
  const tgl = iso => wib(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const NAMA_PRODUK = { 'arabica-250g': 'Arabica 250 g', 'arabica-420g': 'Arabica 420 g', 'arabica-1kg': 'Arabica 1 kg', 'robusta-250g': 'Robusta 250 g', 'robusta-420g': 'Robusta 420 g', 'robusta-1kg': 'Robusta 1 kg' };

  let tt; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2400); };

  async function api(path, opsi = {}) {
    const r = await fetch('/api/admin/' + path, { credentials: 'same-origin', ...opsi,
      headers: opsi.body ? { 'content-type': 'application/json' } : {} });
    const isi = await r.json().catch(() => ({}));
    if (r.status === 401 && path !== 'masuk') { tampilMasuk(); throw new Error(isi.galat || 'Silakan masuk dulu.'); }
    if (!r.ok) throw new Error(isi.galat || 'Gagal memuat data.');
    return isi;
  }

  // ---------- masuk ----------
  function tampilMasuk() { $('#app').hidden = true; $('#login').hidden = false; $('#sandi').focus(); }
  function tampilDasbor() { $('#login').hidden = true; $('#app').hidden = false; route(); }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true; $('#loginErr').textContent = '';
    try { await api('masuk', { method: 'POST', body: JSON.stringify({ sandi: $('#sandi').value }) }); $('#sandi').value = ''; tampilDasbor(); }
    catch (err) { $('#loginErr').textContent = err.message; }
    finally { btn.disabled = false; }
  });
  $('#keluar').addEventListener('click', async () => { try { await api('keluar', { method: 'POST' }); } catch {} tampilMasuk(); });

  // ---------- navigasi ----------
  const TABS = ['ringkasan', 'pesanan', 'produk', 'pengaturan'];
  function route() {
    const tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'ringkasan';
    TABS.forEach(t => { $('#v-' + t).hidden = t !== tab; $(`[data-tab="${t}"]`).classList.toggle('on', t === tab); });
    ({ ringkasan: muatRingkasan, pesanan: muatPesanan, produk: muatProduk, pengaturan: muatPengaturan })[tab]();
  }
  addEventListener('hashchange', () => { if (!$('#app').hidden) route(); });

  // ---------- ringkasan ----------
  let jumlahStatus = {};
  function badge(n) { const b = $('#badgeBaru'); b.hidden = !n; b.textContent = n; document.title = n ? `(${n}) Dalwa Admin` : 'Dalwa Admin'; }
  async function muatRingkasan() {
    try {
      const d = await api('ringkasan'); jumlahStatus = d.status || {};
      badge(jumlahStatus.baru || 0);
      $('#tBaru').textContent = jumlahStatus.baru || 0;
      $('#tHari').textContent = d.hari_ini;
      $('#tBulan').textContent = d.bulan_ini.n;
      $('#tOmzet').textContent = rp(d.bulan_ini.omzet);
      $('#terbaru').innerHTML = d.terbaru.length ? d.terbaru.map(p => `<li><button data-kode="${esc(p.kode)}"><b>${esc(p.kode)}</b><span class="sub">${esc(p.nama)} · ${tgl(p.dibuat)}</span></button><span class="num">${rp(p.subtotal)}</span>${pill(p.status)}</li>`).join('')
        : '<li class="sub">Belum ada pesanan.</li>';
      $('#laris').innerHTML = d.laris.length ? d.laris.map(x => `<li><span>${esc(x.nama)}</span><span class="num">${x.jumlah} pcs</span></li>`).join('') : '<li class="sub">Belum ada penjualan bulan ini.</li>';
      $('#perStatus').innerHTML = STATUS.map(([s]) => `<li>${pill(s)} <span class="num">${jumlahStatus[s] || 0}</span></li>`).join('');
    } catch (err) { toast(err.message); }
  }
  $('#terbaru').addEventListener('click', e => { const b = e.target.closest('[data-kode]'); if (b) bukaDetail(b.dataset.kode); });

  // ---------- pesanan ----------
  const f = { status: '', q: '', halaman: 1 };
  function renderChips() {
    const semua = Object.values(jumlahStatus).reduce((a, b) => a + b, 0);
    $('#filterStatus').innerHTML = [['', 'Semua', semua], ...STATUS.map(([s, l]) => [s, l, jumlahStatus[s] || 0])]
      .map(([s, l, n]) => `<button role="tab" data-s="${s}" aria-selected="${f.status === s}">${l} <i>${n}</i></button>`).join('');
  }
  async function muatPesanan() {
    try {
      const ring = await api('ringkasan'); jumlahStatus = ring.status || {}; badge(jumlahStatus.baru || 0); renderChips();
      const d = await api(`pesanan?status=${f.status}&q=${encodeURIComponent(f.q)}&halaman=${f.halaman}`);
      $('#baris').innerHTML = d.baris.map(p => `<tr data-kode="${esc(p.kode)}" class="${p.status === 'baru' ? 'is-baru' : ''}">
        <td class="c-kode"><span class="kode">${esc(p.kode)}</span></td>
        <td class="c-tgl">${tgl(p.dibuat)}</td>
        <td class="c-nama">${esc(p.nama)}<span class="sub">${esc(p.kota)} · ${esc(p.hp)}</span></td>
        <td class="c-isi isi">${esc(p.ringkas)}</td>
        <td class="c-total num">${rp(p.subtotal + (p.ongkir || 0))}${p.ongkir == null ? '<span class="sub">+ ongkir</span>' : ''}</td>
        <td class="c-status">${pill(p.status)}</td></tr>`).join('');
      $('#kosong').hidden = d.baris.length > 0;
      const halTotal = Math.max(1, Math.ceil(d.total / d.per));
      $('#hal').textContent = `${d.halaman} / ${halTotal}`;
      $('#prev').disabled = d.halaman <= 1; $('#next').disabled = d.halaman >= halTotal;
      $('.pager').hidden = halTotal <= 1;
    } catch (err) { toast(err.message); }
  }
  $('#filterStatus').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; f.status = b.dataset.s; f.halaman = 1; muatPesanan(); });
  let ct; $('#cari').addEventListener('input', e => { clearTimeout(ct); ct = setTimeout(() => { f.q = e.target.value.trim(); f.halaman = 1; muatPesanan(); }, 300); });
  $('#prev').addEventListener('click', () => { f.halaman--; muatPesanan(); });
  $('#next').addEventListener('click', () => { f.halaman++; muatPesanan(); });
  $('#baris').addEventListener('click', e => { const tr = e.target.closest('tr[data-kode]'); if (tr) bukaDetail(tr.dataset.kode); });

  // ---------- detail pesanan ----------
  $('#dStatus').innerHTML = STATUS.map(([s, l]) => `<option value="${s}">${l}</option>`).join('');
  let aktif = null;
  const alamatTeks = a => `${a.jalan} No. ${a.no}, RT ${a.rt.padStart(3, '0')}/RW ${a.rw.padStart(3, '0')}, Kel. ${a.kelurahan}, Kec. ${a.kecamatan}, ${a.kota}, ${a.provinsi} ${a.kodepos}`;
  function isiDetail(p) {
    aktif = p;
    $('#dKode').textContent = p.kode;
    $('#dTgl').textContent = wib(p.dibuat, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB';
    $('#dItems').innerHTML = p.items.map(i => `<li><span>${esc(i.nama)} × ${i.jumlah}</span><span class="num">${rp(i.harga * i.jumlah)}</span></li>`).join('');
    $('#dSub').textContent = rp(p.subtotal);
    $('#dOngkirTampil').textContent = p.ongkir == null ? 'Belum diisi' : rp(p.ongkir);
    $('#dTotal').textContent = rp(p.subtotal + (p.ongkir || 0));
    $('#dBayar').textContent = p.bayar;
    $('#dNama').textContent = p.nama; $('#dHp').textContent = p.hp;
    $('#dAlamat').textContent = alamatTeks(p.alamat) + (p.alamat.patokan ? ` (patokan: ${p.alamat.patokan})` : '');
    $('#dCatatan').textContent = p.catatan ? `Catatan pembeli: ${p.catatan}` : '';
    $('#dStatus').value = p.status; $('#dOngkir').value = p.ongkir ?? ''; $('#dKurir').value = p.kurir || ''; $('#dResi').value = p.resi || ''; $('#dCatAdmin').value = p.catatan_admin || '';
    $('#dErr').textContent = '';
    const hp = p.hp.replace(/^\+/, '').replace(/^0/, '62');
    const pesan = [`Halo ${p.nama}, terima kasih sudah memesan Dalwa Coffee.`, `Nomor pesanan: ${p.kode}`,
      ...p.items.map(i => `• ${i.nama} × ${i.jumlah}`), `Subtotal: ${rp(p.subtotal)}`,
      p.ongkir != null ? `Ongkos kirim: ${rp(p.ongkir)}\nTotal: ${rp(p.subtotal + p.ongkir)}` : null,
      `Pembayaran: ${p.bayar}`, p.resi ? `No. resi ${p.kurir || ''}: ${p.resi}` : null].filter(Boolean).join('\n');
    $('#dChat').href = `https://wa.me/${hp}?text=${encodeURIComponent(pesan)}`;
  }
  async function bukaDetail(kode) {
    try { isiDetail(await api('pesanan/' + encodeURIComponent(kode))); document.body.classList.add('drawer-open'); $('#drawer').setAttribute('aria-hidden', 'false'); }
    catch (err) { toast(err.message); }
  }
  function tutupDetail() { document.body.classList.remove('drawer-open'); $('#drawer').setAttribute('aria-hidden', 'true'); }
  $('#tutup').addEventListener('click', tutupDetail); $('#scrim').addEventListener('click', tutupDetail);
  addEventListener('keydown', e => { if (e.key === 'Escape') tutupDetail(); });
  $('#dSalin').addEventListener('click', () => {
    const t = `${aktif.nama} (${aktif.hp})\n${alamatTeks(aktif.alamat)}`;
    navigator.clipboard.writeText(t).then(() => toast('Alamat disalin'), () => toast('Tidak bisa menyalin otomatis. Pilih teks alamat lalu salin.'));
  });
  $('#dForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true; $('#dErr').textContent = '';
    const o = $('#dOngkir').value.replace(/\D/g, '');
    try {
      const p = await api('pesanan/' + encodeURIComponent(aktif.kode), { method: 'PATCH', body: JSON.stringify({
        status: $('#dStatus').value, ongkir: o === '' ? null : Number(o), kurir: $('#dKurir').value, resi: $('#dResi').value, catatan_admin: $('#dCatAdmin').value }) });
      isiDetail(p); toast('Pesanan disimpan');
      if (!$('#v-pesanan').hidden) muatPesanan(); else muatRingkasan();
    } catch (err) { $('#dErr').textContent = err.message; }
    finally { btn.disabled = false; }
  });

  // ---------- produk ----------
  async function muatProduk() {
    try {
      const daftar = await api('produk');
      $('#produk').innerHTML = daftar.map(p => `<form class="p-row ${p.aktif ? '' : 'off'}" data-id="${esc(p.id)}">
        <img src="../assets/kemasan/${esc(p.id)}.webp" alt="">
        <div><h3>${esc(NAMA_PRODUK[p.id] || `${p.varian} ${p.berat}`)}</h3><span class="sub">${p.aktif ? 'Tampil di toko' : 'Ditandai habis'}</span></div>
        <div class="ctrl">
          <input name="harga" inputmode="numeric" value="${p.harga}" aria-label="Harga ${esc(NAMA_PRODUK[p.id] || p.id)} (Rp)">
          <label class="switch"><input type="checkbox" name="aktif" ${p.aktif ? 'checked' : ''}> Tersedia</label>
          <button class="btn sm" type="submit">Simpan</button>
        </div></form>`).join('');
    } catch (err) { toast(err.message); }
  }
  $('#produk').addEventListener('submit', async e => {
    e.preventDefault();
    const fm = e.target, btn = fm.querySelector('button'); btn.disabled = true;
    try {
      const p = await api('produk/' + fm.dataset.id, { method: 'PATCH', body: JSON.stringify({ harga: Number(fm.harga.value.replace(/\D/g, '')), aktif: fm.aktif.checked }) });
      fm.classList.toggle('off', !p.aktif); fm.querySelector('.sub').textContent = p.aktif ? 'Tampil di toko' : 'Ditandai habis'; fm.harga.value = p.harga;
      toast(`${NAMA_PRODUK[p.id] || p.id}: ${rp(p.harga)}${p.aktif ? '' : ', habis'}`);
    } catch (err) { toast(err.message); }
    finally { btn.disabled = false; }
  });

  // ---------- pengaturan ----------
  async function muatPengaturan() {
    try { const s = await api('pengaturan'); $('#setWa').value = s.whatsapp; } catch (err) { toast(err.message); }
  }
  $('#setForm').addEventListener('submit', async e => {
    e.preventDefault(); $('#setErr').textContent = '';
    try { const s = await api('pengaturan', { method: 'PUT', body: JSON.stringify({ whatsapp: $('#setWa').value }) }); $('#setWa').value = s.whatsapp; toast('Nomor WhatsApp disimpan'); }
    catch (err) { $('#setErr').textContent = err.message; }
  });

  // pesanan baru dicek tiap menit selama dasbor terbuka
  setInterval(async () => {
    if ($('#app').hidden || document.hidden) return;
    try { const d = await api('ringkasan'); const n = (d.status || {}).baru || 0; if (n > (jumlahStatus.baru || 0)) toast('Ada pesanan baru'); jumlahStatus = d.status || {}; badge(n); } catch {}
  }, 60000);

  api('saya').then(tampilDasbor, err => { tampilMasuk(); if (!/masuk dulu/.test(err.message)) $('#loginErr').textContent = err.message; });
})();
