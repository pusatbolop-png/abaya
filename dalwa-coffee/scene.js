// Adegan 3D: satu kanvas menetap di atas halaman, tembus pandang.
// Tiap benda ditambatkan ke sebuah elemen halaman: posisi dan ukurannya dihitung dari kotak elemen itu pada tiap frame,
// jadi benda 3D ikut bergulir bersama teks. Kemajuan gulir menggerakkan ceritanya:
//   e (0..1) penggiling terurai dan bubuk jatuh; p (0..1) bubuk masuk dripper, air dituang, kopi menetes.
window.Scene3D = function (opt) {
  const T = window.THREE;
  if (!T) return null;
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas: opt.canvas, antialias: true, alpha: true }); } catch (err) { return null; }
  const el = opt.els, calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FOV = 30, DIST = 14, PI = Math.PI;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(FOV, 1, .1, 100);
  camera.position.z = DIST;

  // pantulan ruangan: bola krem dengan beberapa bidang terang sebagai jendela
  (() => {
    const es = new T.Scene();
    es.add(new T.Mesh(new T.SphereGeometry(20, 32, 16), new T.MeshBasicMaterial({ color: 0x8f7f6a, side: T.BackSide })));
    const panel = (w, h, x, y, z, i) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(i, i * .96, i * .88), side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
    };
    panel(10, 10, -10, 9, 9, 3); panel(5, 12, 12, 3, 7, 1.5); panel(18, 5, 0, 14, -4, 1.2);
    const floor = new T.Mesh(new T.CircleGeometry(20, 24), new T.MeshBasicMaterial({ color: 0x4a362a }));
    floor.rotation.x = -PI / 2; floor.position.y = -7; es.add(floor);
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(es, .04).texture; pm.dispose();
  })();
  scene.add(new T.HemisphereLight(0xffffff, 0xcdb89c, .3));
  const key = new T.DirectionalLight(0xfff0dc, .9); key.position.set(-5, 7, 8); scene.add(key);

  let vw = 1, vh = 1, k = 1;
  function resize() {
    vw = innerWidth; vh = innerHeight;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    k = 2 * Math.tan(FOV * PI / 360) * DIST / vh;
  }
  resize(); addEventListener('resize', resize);
  const wx = px => (px - vw / 2) * k, wy = py => -(py - vh / 2) * k;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
  const seg = (v, a, b) => smooth((v - a) / (b - a));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const V2 = pts => pts.map(a => new T.Vector2(a[0], a[1]));
  const std = o => { if (o.envMapIntensity === undefined) o.envMapIntensity = .45; return new T.MeshStandardMaterial(o); };
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const lathe = (pts, n = 48) => new T.LatheGeometry(V2(pts), n);

  // ---------- bahan ----------
  const steel = std({ color: 0xd6d3ce, metalness: 1, roughness: .2, envMapIntensity: 1 });
  const dark = std({ color: 0x1d1b1a, metalness: .35, roughness: .45, side: T.DoubleSide });
  const glass = new T.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: .03, transparent: true, opacity: .16, side: T.DoubleSide, depthWrite: false, envMapIntensity: 1.3 });
  const paper = std({ color: 0xf3e7d2, roughness: 1, side: T.DoubleSide });
  const terra = std({ color: 0xa9532c, roughness: .85, envMapIntensity: .2 });
  const coffee = std({ color: 0x140703, roughness: .3, metalness: 0, envMapIntensity: .18 });
  const blob = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  })();
  const shadow = (parent, w, y, x = 0) => {
    const m = add(parent, new T.PlaneGeometry(w, w * .13), new T.MeshBasicMaterial({ map: blob, color: 0x3a2416, transparent: true, opacity: .5, depthWrite: false }), x, y, 0);
    m.renderOrder = -1; return m;
  };
  const steamOf = (parent, n, x, y) => {
    const list = [];
    for (let i = 0; i < n; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: blob, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      parent.add(s); list.push({ s, ph: i / n, off: rnd(-.25, .25), x, y });
    }
    return list;
  };
  const steamTick = (list, time, amount) => list.forEach(o => {
    const u = calm ? o.ph : (time * .17 + o.ph) % 1;
    o.s.position.set(o.x + o.off + Math.sin(u * 5 + o.ph * 9) * .2, o.y + u * 1.7, .3);
    o.s.scale.setScalar(.4 + u * 1.1); o.s.material.opacity = Math.sin(u * PI) * .34 * amount;
  });

  // ---------- biji kopi ----------
  const beanGeo = (() => {
    const g = new T.SphereGeometry(1, 18, 12), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) * .62, y = p.getY(i) * .44, z = p.getZ(i);
      if (y > 0) y -= .2 * Math.exp(-Math.pow(x / .13, 2)) * (1 - z * z * .6);
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); return g;
  })();
  const beanMat = std({ color: 0xffffff, roughness: .45, envMapIntensity: .25 });
  const dummy = new T.Object3D(), col = new T.Color();
  function beanPile(parent, n, place) {
    const im = new T.InstancedMesh(beanGeo, beanMat, n);
    for (let i = 0; i < n; i++) {
      place(dummy.position); dummy.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); dummy.scale.setScalar(rnd(.13, .17));
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, col.setHSL(rnd(.04, .07), rnd(.5, .7), rnd(.035, .08)));
    }
    parent.add(im); return im;
  }

  // ---------- penggiling ----------
  const G = new T.Group(); scene.add(G);
  const foot = add(G, new T.CylinderGeometry(.86, .9, .12, 48), dark, 0, -2.04);
  const shellGeo = a => new T.CylinderGeometry(.8, .8, 1.7, 32, 1, false, a, PI);
  const shellR = add(G, shellGeo(0), dark), shellL = add(G, shellGeo(PI), dark);
  const collar = add(G, new T.CylinderGeometry(.86, .86, .16, 48), steel);
  const lever = add(collar, new T.CylinderGeometry(.03, .03, .7, 8), dark, 1.15, 0, 0); lever.rotation.z = PI / 2;
  const dial = new T.Group(); G.add(dial);
  const ring = add(dial, new T.CylinderGeometry(.52, .52, .12, 48), steel); ring.rotation.x = PI / 2;
  const faceTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#1b1a19'; x.fillRect(0, 0, 256, 256); x.translate(128, 128); x.strokeStyle = '#e9e2d6'; x.lineCap = 'round';
    for (let i = 0; i < 24; i++) { x.lineWidth = i % 6 ? 2 : 5; x.beginPath(); x.moveTo(0, -96); x.lineTo(0, i % 6 ? -84 : -72); x.stroke(); x.rotate(PI / 12); }
    x.fillStyle = '#e9e2d6'; x.fillRect(-16, -6, 32, 12);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  })();
  add(dial, new T.CircleGeometry(.45, 48), std({ map: faceTex, roughness: .5, metalness: .2 }), 0, 0, .065);
  const burr = new T.Group(); G.add(burr);
  add(burr, new T.CylinderGeometry(.5, .62, .28, 40), dark, 0, .5);
  add(burr, new T.CylinderGeometry(.3, .5, .3, 40), steel, 0, .22);
  add(burr, new T.CylinderGeometry(.14, .14, .5, 16), steel, 0, -.1);
  const cone = add(burr, new T.CylinderGeometry(.22, .52, .55, 14, 1), std({ color: 0xbdb6ad, metalness: 1, roughness: .32, flatShading: true, envMapIntensity: 1 }), 0, -.45);
  const hopper = new T.Group(); G.add(hopper);
  add(hopper, lathe([[.3, -.2], [.34, -.05], [.95, .5], [.95, 1.45]]), glass).renderOrder = 5;
  add(hopper, new T.TorusGeometry(.95, .045, 10, 48), dark, 0, 1.45).rotation.x = PI / 2;
  beanPile(hopper, 150, p => {
    const h = rnd(-.12, .78), rm = h < .5 ? .28 + (h + .12) / .62 * .56 : .84, r = rm * Math.sqrt(Math.random()), a = rnd(0, 6.28);
    p.set(Math.cos(a) * r, h, Math.sin(a) * r);
  });
  const NF = 46, fall = new T.InstancedMesh(beanGeo, beanMat, NF), fd = [];
  for (let i = 0; i < NF; i++) {
    fd.push({ ph: Math.random(), ox: rnd(-1, 1), oz: rnd(-.4, .4), s: rnd(.14, .18), ax: rnd(-3, 3), ay: rnd(-3, 3) });
    fall.setColorAt(i, col.setHSL(rnd(.04, .07), rnd(.5, .7), rnd(.035, .08)));
  }
  fall.frustumCulled = false; G.add(fall);

  // ---------- bubuk yang jatuh ----------
  const NP = vw <= 820 ? 700 : 1500, pd = [];
  const pGeo = new T.BufferGeometry(), pPos = new Float32Array(NP * 3);
  for (let i = 0; i < NP; i++) pd.push({ u: Math.random(), ph: rnd(0, 6.28), r: Math.pow(Math.random(), 1.6), sp: rnd(.16, .3), j: rnd(-1, 1) });
  pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
  const grounds = new T.Points(pGeo, new T.PointsMaterial({ color: 0x3d1d0d, size: .11, map: blob, transparent: true, depthWrite: false, sizeAttenuation: true }));
  grounds.frustumCulled = false; scene.add(grounds);

  // ---------- dripper, teko, kendi ----------
  const D = new T.Group(); scene.add(D);
  add(D, lathe([[.13, .04], [1, 1.2], [1.08, 1.4]]), paper);
  add(D, lathe([[.16, 0], [1.05, 1.15]]), glass).renderOrder = 5;
  add(D, new T.TorusGeometry(1.05, .035, 8, 48), glass, 0, 1.15).rotation.x = PI / 2;
  add(D, new T.CylinderGeometry(.7, .7, .05, 40), glass, 0, -.02).renderOrder = 5;
  const dHandle = add(D, new T.TorusGeometry(.3, .04, 8, 24, PI * 1.1), glass, 1.02, .55); dHandle.rotation.z = -PI * .55;
  const bedMat = std({ color: 0x3d1d0d, roughness: 1, envMapIntensity: .15 });
  const bed = add(D, new T.CircleGeometry(1, 40), bedMat); bed.rotation.x = -PI / 2;
  const mound = add(D, new T.ConeGeometry(.45, .28, 24), bedMat);
  add(D, lathe([[0, -1.75], [.8, -1.75], [.86, -1.62], [.86, -.72], [.6, -.2], [.63, -.05]]), glass).renderOrder = 6;
  const sHandle = add(D, new T.TorusGeometry(.42, .045, 8, 24, PI * 1.1), glass, .9, -1.1); sHandle.rotation.z = -PI * .55;
  const liquidGeo = new T.CylinderGeometry(.82, .78, 1, 40); liquidGeo.translate(0, .5, 0);
  const liquid = add(D, liquidGeo, coffee, 0, -1.72);
  shadow(D, 3.2, -1.78);
  const drops = [0, 1, 2].map(() => add(D, new T.SphereGeometry(.045, 10, 8), coffee));
  const water = add(D, new T.CylinderGeometry(.03, .045, 1, 10), new T.MeshPhysicalMaterial({ color: 0xeaf4ff, roughness: .05, transparent: true, opacity: .55, depthWrite: false }));
  const dSteam = steamOf(D, 6, 0, 1.2);
  const K = new T.Group(); D.add(K);
  const TIP = new T.Vector3(.5, 2.95, 0);
  const curve = new T.CatmullRomCurve3([[3.2, 2.2, 0], [2.5, 2.15, 0], [2.0, 2.55, 0], [1.55, 3.15, 0], [1.0, 3.42, 0], [.62, 3.28, 0], [.5, 2.95, 0]].map(a => new T.Vector3(a[0], a[1], a[2])));
  add(K, new T.TubeGeometry(curve, 60, .065, 12), steel);
  add(K, lathe([[0, 0], [.95, 0], [1, .1], [.82, 1.5], [.55, 1.62], [0, 1.62]]), steel, 4, 1.7);
  add(K, new T.SphereGeometry(.12, 16, 12), dark, 4, 3.4);
  const J = new T.Group(); D.add(J);
  add(J, lathe([[0, 0], [.5, 0], [.82, .45], [.8, .95], [.42, 1.45], [.5, 1.72], [.44, 1.72], [.36, 1.45]]), terra, -2.75, -1.75);
  const jHandle = add(J, new T.TorusGeometry(.3, .07, 10, 24, PI * 1.1), terra, -3.5, -.75); jHandle.rotation.z = PI * .45;
  add(J, lathe([[0, 0], [.3, 0], [.5, .26], [.46, .26], [.28, .05], [0, .05]], 32), terra, -1.75, -1.75, .5);
  const bowlBeans = new T.Group(); bowlBeans.position.set(-1.75, -1.75, .5); J.add(bowlBeans);
  beanPile(bowlBeans, 14, p => { const a = rnd(0, 6.28), r = rnd(0, .3); p.set(Math.cos(a) * r, rnd(.18, .3), Math.sin(a) * r); });
  shadow(J, 2.4, -1.78, -2.6);

  // ---------- genangan kopi dan aliran ----------
  const P = new T.Group(); scene.add(P);
  const poolGeo = new T.PlaneGeometry(30, 4, 150, 28), pool = add(P, poolGeo, std({ color: 0x150803, roughness: .16, metalness: 0, envMapIntensity: .3 }));
  const TILT = 1.34; pool.rotation.x = -TILT;
  const base = poolGeo.attributes.position.array.slice();
  const HIT = new T.Vector3(0, .4, 0), hitW = new T.Vector3();
  const stream = add(scene, new T.CylinderGeometry(.035, .03, 1, 10), coffee);

  // ---------- cangkir ----------
  const M = new T.Group(), mugTurn = new T.Group(); M.add(mugTurn); scene.add(M);
  const glaze = std({ color: 0xeadfcd, roughness: .32, side: T.DoubleSide });
  add(mugTurn, lathe([[0, 0], [.42, 0], [.5, .04], [.68, .5], [.72, .95], [.7, 1], [.64, 1], [.6, .9], [.42, .1], [0, .1]]), glaze);
  add(mugTurn, lathe([[0, -.004], [.428, -.004], [.508, .038], [.6, .3], [.634, .34]]), std({ color: 0x8a5d3d, roughness: .9, envMapIntensity: .2 }));
  const mHandle = add(mugTurn, new T.TorusGeometry(.25, .06, 12, 28, PI * 1.2), glaze, .8, .55); mHandle.rotation.z = -PI * .6;
  add(mugTurn, new T.CircleGeometry(.62, 40), coffee, 0, .9).rotation.x = -PI / 2;
  const crema = add(mugTurn, new T.RingGeometry(.5, .62, 40), std({ color: 0x6b4423, roughness: .6, envMapIntensity: .2 }), 0, .902); crema.rotation.x = -PI / 2;
  M.rotation.x = .3; shadow(M, 2.6, -.03);
  const mSteam = steamOf(M, 6, 0, 1);

  function place(g, r, modelH, centerY) {
    const s = r.height * k / modelH;
    g.scale.setScalar(s); g.position.set(wx(r.left + r.width / 2), wy(r.top + r.height / 2) - centerY * s, 0);
    return s;
  }
  const near = (r, m = 1) => r.bottom > -vh * m && r.top < vh * (1 + m);

  // ---------- frame ----------
  let px = 0, sx = 0;
  addEventListener('pointermove', ev => { px = ev.clientX / vw - .5; }, { passive: true });
  const A = new T.Vector3(), B = new T.Vector3();
  let last = performance.now(), time = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now; if (!calm) time += dt;
    sx += (px - sx) * (1 - Math.exp(-dt * 4));
    const mob = vw <= 820;

    // kemajuan cerita dari posisi gulir
    const ra = el.grindAct.getBoundingClientRect(), rb = el.pourAct.getBoundingClientRect();
    const e = smooth(-ra.top / (vh * .75));
    const p = clamp((vh * .55 - rb.top) / (rb.height - vh * .5));

    // penggiling
    const rg = el.grinder.getBoundingClientRect();
    G.visible = near(rg, 1.2);
    if (G.visible) {
      place(G, rg, 3.9, -.3);
      G.rotation.y = -.25 + sx * .5;
      hopper.position.y = e * 1.25;
      shellR.position.set(e * 1.5, -1.15 + e * .1, 0); shellR.rotation.y = e * .55;
      shellL.position.set(-e * 1.5, -1.15 + e * .1, 0); shellL.rotation.y = -e * .55;
      collar.position.y = -.24 + e * .55; collar.rotation.y = e * 1.2;
      dial.position.set(-e * 2.3, -1.15 + e * .9, .84 - e * .2); dial.rotation.set(0, -e * .9, e * .7);
      foot.position.y = -2.04 - e * .45;
      burr.position.y = -.75 + e * .1; cone.rotation.y = time * 3;
      for (let i = 0; i < NF; i++) {
        const f = fd[i], u = (time * .38 + f.ph) % 1, y = 6.2 - u * 5.4 + hopper.position.y;
        const hide = i / NF > 1 - e * 1.6;
        dummy.position.set(f.ox * (.12 + (1 - u) * .45), y, f.oz);
        dummy.rotation.set(time * f.ax, time * f.ay, f.ph * 6);
        dummy.scale.setScalar(hide ? 0 : f.s * Math.min(1, (1 - u) * 8)); dummy.updateMatrix(); fall.setMatrixAt(i, dummy.matrix);
      }
      fall.instanceMatrix.needsUpdate = true;
    }

    // dripper
    const rd = el.dripper.getBoundingClientRect();
    D.visible = near(rd, 1);
    const fillG = seg(p, .02, .3), wet = seg(p, .36, .6), pour = seg(p, .3, .36) * (1 - seg(p, .72, .78));
    const drip = seg(p, .5, .58), fill = seg(p, .5, 1);
    const bedY = .28 + fillG * .34;
    if (D.visible) {
      place(D, rd, mob ? 6.4 : 5.6, .75);
      D.rotation.y = sx * .25;
      bed.position.y = bedY; bed.scale.setScalar(.1 + bedY * .76);
      mound.position.y = bedY + .1 - wet * .2; mound.scale.setScalar(.2 + fillG * .8 * (1 - wet * .7));
      bedMat.color.setHex(0x3d1d0d).lerp(col.setHex(0x120602), wet); bedMat.roughness = 1 - wet * .7;
      K.position.set((1 - seg(p, .12, .3)) * 5 + seg(p, .8, .95) * 5, mob ? -.5 : 0, 0);
      J.visible = !mob;
      const len = TIP.y + K.position.y - bedY;
      water.visible = pour > .01; water.scale.set(1, Math.max(.001, len * pour), 1);
      water.position.set(TIP.x + K.position.x - .16 * pour, TIP.y + K.position.y - len * pour / 2, 0); water.rotation.z = -.14;
      liquid.scale.y = .02 + fill * .82; liquid.visible = fill > .01;
      drops.forEach((d, i) => {
        const u = (time * 1.3 + i / 3) % 1, top = -.05, bot = -1.7 + liquid.scale.y;
        d.visible = drip > .5 && p < .98; d.position.y = top + (bot - top) * u * u;
      });
      steamTick(dSteam, time, wet * (1 - seg(p, .85, 1)));
    }

    // bubuk dari penggiling ke dripper
    const showG = e > .3 && p < .5;
    grounds.visible = showG;
    if (showG) {
      G.updateMatrixWorld(); D.updateMatrixWorld();
      A.set(0, -1.45, 0).applyMatrix4(G.matrixWorld); B.set(0, bedY, 0).applyMatrix4(D.matrixWorld);
      if (!D.visible) B.set(A.x, A.y - vh * k * 1.6, 0);
      const head = clamp((e - .3) / .55), tail = seg(p, .26, .46), L = A.y - B.y, w = G.scale.x;
      for (let i = 0; i < NP; i++) {
        const q = pd[i], u = (q.u + time * q.sp) % 1;
        if (u > head || u < tail) { pPos[i * 3 + 1] = 1e4; continue; }
        const spread = (.1 + .34 * Math.sin(u * PI) * q.r) * w, y = A.y - L * u * u * .5 - L * u * .5;
        pPos[i * 3] = A.x + (B.x - A.x) * u + Math.sin(u * L * .9 + q.ph * .3 + time * .6) * spread + q.j * spread * .5;
        pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = Math.cos(u * L * .9 + q.ph) * spread * .6;
      }
      pGeo.attributes.position.needsUpdate = true;
      grounds.material.size = .1 * Math.max(.6, w);
    }

    // genangan kopi
    const rp = el.pool.getBoundingClientRect();
    P.visible = rp.top > -vh * .6 && rp.top < vh * 1.4;
    stream.visible = false;
    if (P.visible) {
      const s = Math.max(vw * k / 10, .9);
      P.scale.setScalar(s); P.position.set(wx(rp.left + rp.width / 2), wy(rp.top) + 2 * Math.cos(TILT) * s, 0);
      const pos = poolGeo.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        const dx = base[i] - HIT.x, dy = (base[i + 1] - HIT.y) * 2.2, d = Math.sqrt(dx * dx + dy * dy);
        pos[i + 2] = Math.sin(d * 5 - time * 5) * .09 * Math.exp(-d * .55) + Math.sin(base[i] * .7 + time * .8) * .03;
      }
      poolGeo.attributes.position.needsUpdate = true; poolGeo.computeVertexNormals();
      P.updateMatrixWorld(); hitW.copy(HIT).applyMatrix4(pool.matrixWorld);
      const top = D.visible ? Math.min(wy(-40), D.position.y - 1.72 * D.scale.x) : wy(-40);
      if (p > .7 && top > hitW.y) {
        stream.visible = true; stream.scale.set(P.scale.x, top - hitW.y, P.scale.x);
        stream.position.set(hitW.x, (top + hitW.y) / 2, hitW.z);
      }
    }

    // cangkir
    const rm = el.mug.getBoundingClientRect();
    M.visible = rm.height > 0 && near(rm, .3);
    if (M.visible) {
      place(M, rm, 1.75, .5);
      mugTurn.rotation.y = -.5 - sx * 1.2 + Math.sin(time * .5) * .08;
      steamTick(mSteam, time, 1);
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  return {};
};
