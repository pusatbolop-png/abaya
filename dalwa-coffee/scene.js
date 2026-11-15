// Adegan 3D: satu kanvas di belakang seluruh halaman.
// Isinya kemasan yang berdiri melingkar di panggung, biji kopi yang melayang, dan cangkir beruap di bagian Cara Seduh.
// Benda 3D ditambatkan ke elemen halaman: posisinya dihitung dari kotak elemen itu di layar pada tiap frame.
window.Scene3D = function (opt) {
  const T = window.THREE;
  if (!T) return null;
  const { canvas, stage, panel, cupSpot, products, varieties, state } = opt;
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return null; }

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FOV = 30, DIST = 14, BAG_H = 1.93;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(FOV, 1, .1, 100);
  camera.position.z = DIST;

  scene.add(new T.HemisphereLight(0xfff1de, 0x24130b, .95));
  const key = new T.DirectionalLight(0xffe3c0, 1.25); key.position.set(4, 6, 9); scene.add(key);
  const rim = new T.DirectionalLight(0x9db4ff, .55); rim.position.set(-7, 3, -5); scene.add(rim);

  let vw = 1, vh = 1, k = 1; // k: satuan dunia per piksel pada bidang z = 0
  function resize() {
    vw = innerWidth; vh = innerHeight;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    k = 2 * Math.tan(FOV * Math.PI / 360) * DIST / vh;
  }
  resize(); addEventListener('resize', resize);
  const wx = px => (px - vw / 2) * k, wy = py => -(py - vh / 2) * k;

  // ---------- kemasan ----------
  // Kotak yang dipipihkan ke arah segel atas dan sedikit menggembung di tengah, seperti pouch berisi.
  function bagGeometry() {
    const g = new T.BoxGeometry(1, BAG_H, .4, 12, 24, 6), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = y / BAG_H + .5;
      let d = t > .9 ? .05 : t > .7 ? .05 + .95 * Math.pow((.9 - t) / .2, .8) : 1;
      if (t < .05) d *= .82 + .18 * (t / .05);
      const belly = .78 + .3 * Math.cos(x * Math.PI) * Math.sin(Math.min(1, t / .7) * Math.PI);
      p.setZ(i, z * d * belly);
      if (t > .7) p.setX(i, x * (1 + .02 * (t - .7) / .3));
    }
    g.computeVertexNormals();
    return g;
  }
  const geo = bagGeometry(), loader = new T.TextureLoader();
  const tex = name => {
    const t = loader.load(`assets/${name}.webp`);
    t.encoding = T.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  const blob = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  })();

  const bags = products.map((p, i) => {
    const side = new T.Color(varieties[p.variety].side);
    const mat = c => new T.MeshStandardMaterial({ color: c, roughness: .55, metalness: .08 });
    const sideM = mat(side); sideM.roughness = .8; const front = mat(0xffffff), back = mat(0xffffff);
    front.map = tex(p.id + '-depan'); back.map = tex(p.back);
    const mesh = new T.Mesh(geo, [sideM, sideM, sideM, sideM, front, back]);
    const shadow = new T.Mesh(new T.PlaneGeometry(1.7, .2),
      new T.MeshBasicMaterial({ map: blob, color: 0x000000, transparent: true, opacity: .55, depthWrite: false }));
    shadow.position.y = -BAG_H / 2 - .02;
    const group = new T.Group(); group.add(shadow, mesh); scene.add(group);
    return { p, i, group, mesh, side, mats: [sideM, front, back], c: null };
  });

  const wrap = d => { const n = bags.length; d = ((d % n) + n) % n; return d > n / 2 ? d - n : d; };
  const tgt = { x: 0, y: 0, z: 0, s: 0, ry: 0, tint: 1 };

  function target(b, r, time) {
    const n = bags.length, mob = vw <= 820, focus = state.mode === 'focus';
    const d = wrap(b.i - state.pos), ad = Math.abs(d), sel = ad < .5;
    const panelW = !mob && focus ? panel.offsetWidth : 0;
    const cx = r.left + (r.width - panelW) / 2;
    let H = mob ? Math.min(r.height * .46, r.width * .5 * BAG_H) : Math.min(r.height * .56, r.width * .16 * BAG_H);
    let floor = r.bottom - (mob ? 96 : 104);
    tgt.z = 0; tgt.tint = 1; tgt.ry = 0;
    let x = cx, sc = b.p.scale;

    if (!focus) {
      if (mob) {
        x = cx + d * r.width * .5; tgt.z = -ad * 1.6; tgt.tint = 1 - .55 * Math.min(1, ad);
        tgt.ry = -d * .5; if (ad > 1.5) sc = 0;
      } else {
        const th = d * 2 * Math.PI / n, Rx = Math.min(r.width * .33, 520), f = (Math.cos(th) + 1) / 2;
        x = cx + Rx * Math.sin(th); tgt.z = -Rx * k * .8 * (1 - Math.cos(th));
        tgt.tint = .3 + .7 * Math.pow(f, 1.4); tgt.ry = th * .55;
        floor -= (1 - f) * r.height * .1;
      }
      if (!calm) tgt.ry += Math.sin(time * .7 + b.i) * .06;
    } else if (sel) {
      if (mob) {
        const avail = r.height - Math.min(r.height * .8, panel.offsetHeight) - 16;
        H = Math.max(120, avail * .88) / b.p.scale; floor = r.top + avail;
      } else H = Math.min(r.height * .74, (r.width - panelW) * .4 * BAG_H) / b.p.scale * Math.min(1, b.p.scale + .1);
      tgt.ry = state.spin + (calm ? 0 : Math.sin(time * .8) * .1);
    } else {
      x = cx + d * (r.width - panelW) * .42; tgt.z = -4; tgt.tint = .16;
      tgt.ry = -d * .4; if (mob || ad > 1.5) sc = 0;
    }
    tgt.s = H * k / BAG_H * sc;
    tgt.x = wx(x); tgt.y = wy(floor) + tgt.s * BAG_H / 2;
    // benda di belakang bidang z = 0 tampak mengecil ke tengah layar; geser agar alasnya tetap di lantai panggung
    const persp = DIST / (DIST - tgt.z);
    tgt.x /= persp; tgt.y = (wy(floor) / persp) + tgt.s * BAG_H / 2;
  }

  // ---------- biji kopi ----------
  const beanGeo = (() => {
    const g = new T.SphereGeometry(1, 22, 16), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) * .62, y = p.getY(i) * .44, z = p.getZ(i);
      if (y > 0) y -= .2 * Math.exp(-Math.pow(x / .13, 2)) * (1 - z * z * .6);
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); return g;
  })();
  const N = vw <= 820 ? 34 : 72, RX = 11, RY = 7;
  const beans = new T.InstancedMesh(beanGeo, new T.MeshStandardMaterial({ color: 0xffffff, roughness: .42, metalness: .05 }), N);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const bd = [], dummy = new T.Object3D(), col = new T.Color();
  for (let i = 0; i < N; i++) {
    const z = rnd(-11, -1);
    bd.push({ x: rnd(-RX, RX), y: rnd(-RY, RY), z, s: rnd(.11, .24), sp: rnd(.05, .22), par: .25 + (z + 11) / 10 * .55,
      rx: rnd(0, 6), ry: rnd(0, 6), ax: rnd(-.5, .5), ay: rnd(-.5, .5), ph: rnd(0, 6), vx: 0, vy: 0, ox: 0, oy: 0 });
    beans.setColorAt(i, col.setHSL(rnd(.045, .075), rnd(.5, .7), rnd(.06, .13)));
  }
  scene.add(beans);
  function burst() {
    if (calm) return;
    bd.forEach(b => { const a = Math.random() * 6.28, f = rnd(1.5, 5); b.vx += Math.cos(a) * f; b.vy += Math.sin(a) * f + 1.5; });
  }

  // ---------- cangkir ----------
  const cup = new T.Group(), cupTurn = new T.Group(); cup.add(cupTurn); scene.add(cup);
  const cer = new T.MeshStandardMaterial({ color: 0xbfae96, roughness: .38, metalness: .02, side: T.DoubleSide });
  const profile = [[0, 0], [.5, 0], [.56, .05], [.78, .86], [.82, 1], [.77, 1], [.73, .88], [.5, .1], [0, .1]].map(a => new T.Vector2(a[0], a[1]));
  cupTurn.add(new T.Mesh(new T.LatheGeometry(profile, 48), cer));
  const handle = new T.Mesh(new T.TorusGeometry(.27, .065, 12, 28, Math.PI * 1.25), cer);
  handle.position.set(.76, .52, 0); handle.rotation.z = -Math.PI * .62; cupTurn.add(handle);
  const coffee = new T.Mesh(new T.CircleGeometry(.75, 40), new T.MeshStandardMaterial({ color: 0x0b0402, roughness: .25, metalness: 0 }));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = .84; cupTurn.add(coffee);
  const crema = new T.Mesh(new T.RingGeometry(.6, .75, 40), new T.MeshStandardMaterial({ color: 0x4e2f14, roughness: .5 }));
  crema.rotation.x = -Math.PI / 2; crema.position.y = .845; cupTurn.add(crema);
  const saucer = new T.Mesh(new T.CylinderGeometry(1.25, .85, .09, 48), new T.MeshStandardMaterial({ color: 0x6e604f, roughness: .45 })); saucer.position.y = -.045; cup.add(saucer);
  cup.rotation.x = .42;
  const steam = [];
  for (let i = 0; i < 7; i++) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: blob, color: 0xf3e6d3, transparent: true, opacity: 0, depthWrite: false }));
    cup.add(s); steam.push({ s, ph: i / 7, off: rnd(-.25, .25) });
  }

  // ---------- pointer ----------
  let px = 0, py = 0, sx = 0, sy = 0;
  addEventListener('pointermove', e => { px = e.clientX / vw - .5; py = e.clientY / vh - .5; }, { passive: true });
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function pick(clientX, clientY) {
    ndc.set(clientX / vw * 2 - 1, -(clientY / vh) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(bags.filter(b => b.group.visible).map(b => b.mesh))[0];
    return hit ? bags.findIndex(b => b.mesh === hit.object) : -1;
  }

  // ---------- frame ----------
  let last = performance.now(), time = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now; time += dt;
    const ease = 1 - Math.exp(-dt * 5.5);
    sx += (px - sx) * ease; sy += (py - sy) * ease;

    const r = stage.getBoundingClientRect(), onStage = r.bottom > -100 && r.top < vh + 100;
    bags.forEach(b => {
      target(b, r, time);
      if (!b.c) b.c = { x: tgt.x + vw * k * (.7 + b.i * .12), y: tgt.y, z: tgt.z, s: tgt.s, ry: tgt.ry - 1.2, tint: tgt.tint };
      const c = b.c;
      for (const key in tgt) c[key] += (tgt[key] - c[key]) * ease;
      b.group.visible = onStage && c.s > .01;
      b.group.position.set(c.x, c.y, c.z); b.group.scale.setScalar(Math.max(c.s, .0001));
      b.mesh.rotation.y = c.ry + sx * .25; b.mesh.rotation.x = sy * .08;
      b.mats[0].color.copy(b.side).multiplyScalar(c.tint); b.mats[1].color.setScalar(c.tint); b.mats[2].color.setScalar(c.tint);
    });

    const scroll = scrollY * k;
    for (let i = 0; i < N; i++) {
      const b = bd[i];
      b.ox += b.vx * dt; b.oy += b.vy * dt; b.vx *= 1 - dt * 2.2; b.vy *= 1 - dt * 2.2;
      b.ox *= 1 - dt * .25; b.oy *= 1 - dt * .25;
      const t = calm ? 0 : time;
      let y = b.y + t * b.sp + scroll * b.par + b.oy;
      y = ((y + RY) % (2 * RY) + 2 * RY) % (2 * RY) - RY;
      dummy.position.set(b.x + Math.sin(t * .3 + b.ph) * .35 + b.ox - sx * b.par * 1.4, y + sy * b.par * .8, b.z);
      dummy.rotation.set(b.rx + t * b.ax, b.ry + t * b.ay, b.ph);
      dummy.scale.setScalar(b.s); dummy.updateMatrix(); beans.setMatrixAt(i, dummy.matrix);
    }
    beans.instanceMatrix.needsUpdate = true;

    const cr = cupSpot.getBoundingClientRect();
    cup.visible = cr.width > 0 && cr.bottom > 0 && cr.top < vh;
    if (cup.visible) {
      const s = Math.min(cr.width, cr.height) * k / 3.4;
      cup.scale.setScalar(s); cup.position.set(wx(cr.left + cr.width / 2), wy(cr.top + cr.height * .8), 0);
      cupTurn.rotation.y = (calm ? .6 : time * .35) - sx * .8;
      steam.forEach(o => {
        const u = calm ? o.ph : (time * .16 + o.ph) % 1;
        o.s.position.set(o.off + Math.sin(u * 5 + o.ph * 9) * .22, 1 + u * 1.9, Math.cos(u * 4 + o.ph * 7) * .2);
        o.s.scale.setScalar(.45 + u * 1.1); o.s.material.opacity = Math.sin(u * Math.PI) * .2;
      });
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return { pick, burst, normalize(i) { const c = bags[i].c; if (c) c.ry = ((c.ry + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; } };
};
