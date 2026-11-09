/*
 * rob-accessories.mjs - R.O.B.'s accessories as 3D objects the user sets up by hand, and that he then
 * works with (24 Oct 2026).
 *
 * The page (index.html) owns the robot, its rig and its motions; this module owns the parts: the
 * Gyromite set (two gyros, the spinner and its D cell, the gyro tray with Controller 2 and its two
 * levers, the holder, the Gyro Hands) and the Stack-Up set (five blocks, five block trays, the Block
 * Hands), the parts box they start in, the snap targets (the plinth's five numbered slots, cups,
 * mouths, caps, rings, pegs, the holder's slot, the battery bay, R.O.B.'s arms, the table), the
 * drag and drop (pointer: mouse and touch; keys: the hand cursor for a controller or a remote), a
 * small purpose-built physics (supports, falls, toppling, grabbing when the arms close, release when
 * they open, pushing, the gyros' spin, the levers), the saved layout, and a readout.
 *
 * Frame: three.js world metres, +y up, R.O.B. faces -z, +x is his right; slot k sits (3 - k) * 60
 * degrees to his LEFT (slot 1 at +120, the rig's LEFT is positive), on the plinth wall; a part's
 * working point (cup, mouth, cap, ring) stands at the hands' reach, R_work, measured from the rig.
 */
export async function createAccessories({ THREE, GLTFLoader, scene, camera, controls, dom, node, RIG, getPose, setHands, getHands, url = './accessories.glb', log = () => {} }) {
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const rad = d => d * Math.PI / 180;
  const MM = 0.001;
  const SLOT_DEG = { 1: 120, 2: 60, 3: 0, 4: -60, 5: -120 };
  const BLOCK_COLOURS = { red: 0xc62828, white: 0xececec, blue: 0x1f3fbf, yellow: 0xe0c020, green: 0x1e8a3a };
  const BLOCK_ORDER = ['red', 'white', 'blue', 'yellow', 'green'];     // the manual's starting stack, top to bottom
  const G = 2.5;                       // m/s^2: a toy's fall, slowed so the eye follows it (FITTED)
  const SPIN_UP_S = 3, SPIN_S = 90, SPIN_UNHELD = 0.7, SPIN_STAND = 0.1;   // FITTED (section 9a; the booklet's "may not obtain full speed")
  const TABLE_SPOTS = [[-0.30, -0.26], [0.30, -0.26], [-0.34, 0.02], [0.34, 0.02], [-0.22, -0.40], [0.22, -0.40]];   // x, z (m)
  const BOX_AT = { x: 0.60, z: -0.26 };   // the parts box: to his right, in front (the viewer's left)

  // ------------------------------------------------------------------ load
  const gltf = await new Promise((res, rej) => new GLTFLoader().load(url, res, undefined, rej));
  const accRoot = gltf.scene.getObjectByName('ACC_Root');
  const EX = JSON.parse(accRoot.userData.acc);
  const D = EX.derived, MOD = EX.model_mm;
  const templates = {};
  for (const c of accRoot.children) templates[c.name] = c;
  for (const t of Object.values(templates)) { t.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); if (t.parent) t.parent.remove(t); }
  const tmplAcc = name => JSON.parse(templates[name].userData.acc);
  if (templates.ACC_Pad2) restylePad2(templates.ACC_Pad2);   // 2 Nov 2026: Controller 2 drawn as the site's NES pad icon
  if (templates.ACC_DCell) restyleDCell(templates.ACC_DCell);   // 2 Nov 2026: the D cell dressed as a Duracell

  /* THE D CELL AS A DURACELL (2 Nov 2026, "R.O.B.'s battery looks like a Duracell"). The
     build's plain blue-grey cylinder gets a printed label, drawn here on a small canvas (512 x 896,
     no image file): the black body with DURACELL in heavy white capitals and a small line under it,
     the copper top third shading to gold toward the + end with a dark + on it, and a thin metal ring
     at each end. The word and the + are printed twice, half a turn apart, so one side always shows.
     As on the real cell the word reads toward the + end. The shape is the build's own: the same
     points and triangles, only turned half round about the upright through the part's origin (its
     bottom centre, so its footprint, its box place, the bay and every behaviour are as before), so
     that the + end lies on the viewer's right in the box and the word reads the right way up from
     the front. The sides get a label position (u along the cell, v around it) and smooth normals
     (the build's flat facets showed as bands through the print); the ends keep theirs. */
  function restyleDCell(tmpl) {
    const body = tmpl.getObjectByName('ACC_DCell_body'); if (!body || !body.geometry) return;
    for (const m of tmpl.children) if (m.isMesh && m.geometry) m.geometry.rotateY(Math.PI);   // the + end (pip) to -x
    const geo = body.geometry, P = geo.attributes.position, N = geo.attributes.normal;
    geo.computeBoundingBox();
    const bb = geo.boundingBox, x0 = bb.min.x, L = bb.max.x - bb.min.x, yc = (bb.min.y + bb.max.y) / 2;
    const uv = new Float32Array(P.count * 2);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i) - yc, z = P.getZ(i), nx = N.getX(i);
      const along = (bb.max.x - x) / L;                    // 0 at the - end (+x), 1 at the + end (-x)
      if (Math.abs(nx) > 0.5) { uv[2 * i] = nx > 0 ? 0.004 : 0.996; uv[2 * i + 1] = 0.5; continue; }   // an end: its metal
      // around: 0.5 straight at the viewer (-z), up the front is up the label; the join is at the back
      let a = Math.atan2(y, -z);
      const an = Math.atan2(N.getY(i), -N.getZ(i));       // this side face's own middle: its corners stay on its side of the join
      if (a - an > Math.PI) a -= 2 * Math.PI; else if (an - a > Math.PI) a += 2 * Math.PI;
      uv[2 * i] = along; uv[2 * i + 1] = 0.5 + a / (2 * Math.PI);
      const r = Math.hypot(y, z) || 1; N.setXYZ(i, 0, y / r, z / r);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    N.needsUpdate = true;
    // the label: x along the cell (left = the - end), y around it (canvas top = v 1, the back)
    const W = 512, H = 896, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const metal = g.createLinearGradient(0, 0, 0, H); metal.addColorStop(0, '#9a9da2'); metal.addColorStop(0.5, '#d4d6da'); metal.addColorStop(1, '#9a9da2');
    const cx = Math.round(0.66 * W), ring = Math.max(3, Math.round(0.012 * W));
    g.fillStyle = '#121212'; g.fillRect(0, 0, W, H);
    const cu = g.createLinearGradient(cx, 0, W - ring, 0);
    cu.addColorStop(0, '#6f3313'); cu.addColorStop(0.4, '#9c501f'); cu.addColorStop(0.8, '#bd7a33'); cu.addColorStop(1, '#cfa250');
    g.fillStyle = cu; g.fillRect(cx, 0, W - cx, H);
    g.fillStyle = 'rgba(255,236,200,0.18)'; g.fillRect(cx, 0, 3, H);   // a fine bright edge where the copper starts
    g.fillStyle = metal; g.fillRect(0, 0, ring, H); g.fillRect(W - ring, 0, ring, H);
    const rows = [H * 0.5 - H * 0.07, H * 0.0 - H * 0.07];   // the word's middle: a little above the front, and half a turn on
    for (const r0 of rows) for (const yy of [r0, r0 + H]) {
      // DURACELL: heavy capitals, stretched to fill the black part
      const fs = 92, left = ring + 0.05 * W, room = cx - left - 0.05 * W;
      g.save(); g.translate(left, yy); g.font = `900 ${fs}px "Arial Black", "Segoe UI Black", "Helvetica Neue", Arial, sans-serif`;
      g.textBaseline = 'middle'; g.textAlign = 'left';
      const tw = g.measureText('DURACELL').width; g.scale(room / tw, 1);
      g.fillStyle = '#f4f4f2'; g.fillText('DURACELL', 0, 0); g.restore();
      // a copper rule and a small line of print under it
      g.fillStyle = '#c4702f'; g.fillRect(left, yy + fs * 0.62, room, 5);
      g.font = `700 30px "Segoe UI", Arial, Helvetica, sans-serif`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#b9b9b6';
      g.fillText('ALKALINE  D  1.5V', left, yy + fs * 0.62 + 30);
      // + on the copper
      const pcx = (cx + W - ring) / 2, arm = 34, th = 15;
      g.fillStyle = '#1a1208'; g.fillRect(pcx - arm, yy - th / 2, arm * 2, th); g.fillRect(pcx - th / 2, yy - arm, th, arm * 2);
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    tex.wrapT = THREE.RepeatWrapping;                     // around the cell: the join at the back runs on
    body.material = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.38, metalness: 0 });
    body.material.name = 'ACC_DCell_label';
  }

  /* CONTROLLER 2 (2 Nov 2026, "the controller in Gyromite is not styled against the icon NES
     controller"). The build's plain white slab is replaced at load by a pad drawn after the site's own
     NES controller icon (images/consoles/nes.webp) and the real pad: a light grey body with rounded
     edges, the dark face plate set in a grey border, the black cross on the left, the two grey bars,
     the red SELECT / START lettering and the grey plate with the two dark pills in the middle, the red
     Nintendo lettering and the two red round buttons on their grey squares on the right with B and A
     under them, and the cable leaving the top edge above the cross. Only the look changes: the part's
     width, height and thickness (acc.w, acc.h, acc.t), its origin (bottom centre, the face toward -z),
     its footprint in the box and every behaviour (the holder, the levers, Turn) are as before. The
     face is drawn once on a small canvas (704 x 274) and the rest is a few hundred triangles, so it
     costs nothing to render. Seen from the face, the cross is on the left and A is the rightmost
     button, as on the real pad (the build had them the other way round). */
  function restylePad2(tmpl) {
    const acc = JSON.parse(tmpl.userData.acc);
    const w = acc.w, h = acc.h, t = acc.t;                 // mm: 146.3 x 63.7 x 21.2
    const X = u => -u * MM;                                // u: across the face as the viewer sees it, right positive
    const std = (color, rough = 0.55, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
    const mesh = (name, geo, mat) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = m.receiveShadow = true; tmpl.add(m); return m; };
    const roundRect = (sh, x0, y0, sw, sy, r) => { sh.moveTo(x0 + r, y0); sh.lineTo(x0 + sw - r, y0); sh.quadraticCurveTo(x0 + sw, y0, x0 + sw, y0 + r); sh.lineTo(x0 + sw, y0 + sy - r); sh.quadraticCurveTo(x0 + sw, y0 + sy, x0 + sw - r, y0 + sy); sh.lineTo(x0 + r, y0 + sy); sh.quadraticCurveTo(x0, y0 + sy, x0, y0 + sy - r); sh.lineTo(x0, y0 + r); sh.quadraticCurveTo(x0, y0, x0 + r, y0); return sh; };
    for (const m of tmpl.children.slice()) { tmpl.remove(m); if (m.geometry) m.geometry.dispose(); }
    // the body: a rounded slab, grey (the build's pad grey); the extrusion's bevel rounds every edge
    const bev = 2.6 * MM;
    const body = new THREE.ExtrudeGeometry(roundRect(new THREE.Shape(), -w / 2 * MM + bev, bev, w * MM - 2 * bev, h * MM - 2 * bev, 5 * MM), { depth: t * MM - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev - 0.05 * MM, bevelSegments: 3, curveSegments: 6 });
    body.translate(0, 0, -(t / 2 * MM - bev));
    mesh('ACC_Pad2_body', body, std(0xa9a9a4, 0.6));
    // the face plate: a thin rounded panel set 5.5 mm in from the body's edge, with the icon's layout drawn on it
    const m0 = 5.5, pw = w - 2 * m0, ph = h - 2 * m0, zf = -(t / 2 + 0.3) * MM;
    const cv = document.createElement('canvas'); const s = 704 / pw; cv.width = 704; cv.height = Math.round(ph * s);
    const g = cv.getContext('2d');
    const px = (u, v) => [(u + pw / 2) * s, (ph - v) * s];   // plate coordinates (u from its centre, v from its bottom) to canvas pixels
    const rr = (u, v, sw, sy, r, fill, stroke, lw) => { const [x, y] = px(u - sw / 2, v + sy / 2); g.beginPath(); g.roundRect(x, y, sw * s, sy * s, r * s); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = (lw || 0.8) * s; g.stroke(); } };
    const text = (str, u, v, mm, style, italic) => { const [x, y] = px(u, v); g.font = `${italic ? 'italic ' : ''}bold ${mm * s}px "Segoe UI", Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = style; g.fillText(str, x, y); };
    g.fillStyle = '#242424'; g.fillRect(0, 0, cv.width, cv.height);
    const ud = -0.30 * w, uc = -0.045 * w, cw = 0.28 * w, ur = 0.29 * w, uB = 0.22 * w, uA = 0.36 * w, vb = 0.42 * ph;
    rr(ud, ph / 2, 31, 31, 3, '#111111', '#5c5c5c', 1.0);                       // the cross's dark square with its light rim
    for (const v of [0.885 * ph, 0.765 * ph, 0.185 * ph, 0.075 * ph]) rr(uc, v, cw, 4.4, 1.2, '#9c9c99');   // the grey bars
    text('SELECT    START', uc, 0.62 * ph, 4.0, '#d9362b');
    rr(uc, vb, cw, 11.6, 2.2, '#cfcfcb', '#8d8d89', 0.6);                       // the pills' plate
    text('Nintendo', ur, 0.74 * ph, 5.6, '#d9362b', true);
    for (const u of [uB, uA]) rr(u, vb, 19, 19, 2.2, '#cfcfcb', '#8d8d89', 0.6);  // the buttons' squares
    text('B', uB, 0.17 * ph, 3.8, '#d9362b'); text('A', uA, 0.17 * ph, 3.8, '#d9362b');
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const plate = new THREE.ShapeGeometry(roundRect(new THREE.Shape(), -pw / 2 * MM, 0, pw * MM, ph * MM, 3.5 * MM), 6);
    { const uv = plate.attributes.uv, p = plate.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) / MM + pw / 2) / pw, p.getY(i) / MM / ph); }
    const plateM = mesh('ACC_Pad2_face', plate, std(0xffffff, 0.7, { map: tex }));
    plateM.rotation.y = Math.PI; plateM.position.set(0, m0 * MM, zf);          // turned to face -z: the canvas's left is the viewer's left
    plateM.castShadow = false;
    // the cross: two black bars standing 1.6 mm proud of the plate (nothing stands further out than the build's buttons did, 2 mm, so the footprint is unchanged)
    const black = std(0x161616, 0.5);
    const vd = (m0 + ph / 2) * MM, zc = zf - 0.8 * MM;
    mesh('ACC_Pad2_cross_v', new THREE.BoxGeometry(8.6 * MM, 26 * MM, 1.6 * MM), black).position.set(X(ud), vd, zc);
    mesh('ACC_Pad2_cross_h', new THREE.BoxGeometry(26 * MM, 8.6 * MM, 1.6 * MM), black).position.set(X(ud), vd, zc);
    // A and B: red round buttons, 1.6 mm proud, on their grey squares
    const red = std(0xd8301f, 0.35);
    const vbtn = (m0 + vb) * MM;
    for (const [name, u] of [['B', uB], ['A', uA]]) { const b = mesh('ACC_Pad2_button' + name, new THREE.CylinderGeometry(7.4 * MM, 7.6 * MM, 1.6 * MM, 32), red); b.rotation.x = Math.PI / 2; b.position.set(X(u), vbtn, zf - 0.8 * MM); }
    // Select and Start: two dark pills lying across the grey plate, sunk so 1.5 mm shows
    const pill = std(0x2b2b2b, 0.5);
    for (const [name, u] of [['Select', uc - 8], ['Start', uc + 8]]) { const c = mesh('ACC_Pad2_' + name, new THREE.CapsuleGeometry(2.4 * MM, 8.5 * MM, 4, 12), pill); c.rotation.z = Math.PI / 2; c.position.set(X(u), vbtn, zf + 0.9 * MM); }
    // the cable: a grey boss on the top edge above the cross, the cord rising and bending back (it stays inside the part's footprint)
    const boss = mesh('ACC_Pad2_boss', new THREE.BoxGeometry(10 * MM, 3 * MM, 6 * MM), std(0xa9a9a4, 0.6)); boss.position.set(X(ud + 4), (h + 1.5) * MM, 0);
    const path = new THREE.QuadraticBezierCurve3(V3(X(ud + 4), (h + 2) * MM, 0), V3(X(ud + 4), (h + 11) * MM, 0.5 * MM), V3(X(ud + 4), (h + 7) * MM, 9 * MM));
    mesh('ACC_Pad2_cord', new THREE.TubeGeometry(path, 8, 1.6 * MM, 8, false), std(0x3a3a3c, 0.7));
    tmpl.userData.acc = JSON.stringify(acc);
  }

  // the robot's numbers, measured live from the rig (checked against the build's)
  const lift = node.ROB_Lift, turntable = node.ROB_Turntable;
  const gripLocal = (() => {
    // the hands' grip point in ROB_Lift's frame: the mid-plane, the hands' forward centre, their height centre (arms closed)
    const armL = node.ROB_ArmL, armR = node.ROB_ArmR;
    const saved = [armL && armL.rotation.y, armR && armR.rotation.y];
    if (armL) armL.rotation.y = 0; if (armR) armR.rotation.y = 0;          // closed: the holding pose
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const n of ['ROB_HandL_gyro', 'ROB_HandR_gyro']) { const o = node[n]; if (o) { const was = o.visible; o.visible = true; box.expandByObject(o); o.visible = was; } }
    const c = box.getCenter(V3());
    c.x = 0;
    const loc = lift.worldToLocal(c.clone());
    if (armL) armL.rotation.y = saved[0]; if (armR) armR.rotation.y = saved[1];
    scene.updateMatrixWorld(true);
    return loc;
  })();
  const gripWorld = (out = V3()) => { scene.updateMatrixWorld(true); return lift.localToWorld(out.copy(gripLocal)); };
  {
    const g = gripWorld();
    const Rw = Math.hypot(g.x, g.z) * 1000, top = g.y * 1000;
    const dR = Math.abs(Rw - D.R_work), dT = Math.abs(top - D.grip_top);
    log(`accessories: grip ${Rw.toFixed(1)} mm out, ${top.toFixed(1)} mm up at the top stop (build: ${D.R_work.toFixed(1)}, ${D.grip_top.toFixed(1)}${dR > 1 || dT > 1 ? ' DIFFERS' : ''})`);
  }
  const pitch = RIG.lift.travel_m / (RIG.lift.stops - 1);
  const gripY = i => D.grip_top * MM - pitch * i;

  // ------------------------------------------------------------- the world
  const group = new THREE.Group(); group.name = 'accessories'; scene.add(group);
  const parts = [];                 // every part of the current set
  let setName = 'none';
  const listeners = [];
  const notify = () => { for (const f of listeners) try { f(); } catch (_) {} save(); };

  const box = clone('ACC_Box'); box.position.set(BOX_AT.x, 0, BOX_AT.z); box.visible = false; group.add(box);
  const boxAcc = tmplAcc('ACC_Box');
  /* THE BOX LEAVES WHEN THE SET IS READY (10 Nov 2026: the box goes away once the set is correctly set
     up and the game asks to play again, so the view zooms back on R.O.B. directly). boxAway(true)
     lifts the box a little, shrinks it and fades it out over BOX_FADE seconds (in update), then hides it, so the picture
     can be framed on R.O.B. and his set; done() runs when it has gone. boxBack() puts it back at once: reset (Play again,
     Back in box) and every new set. While it is away nothing can be put in it. */
  const BOX_FADE = 0.6;
  let boxK = 0, boxGoal = 0, boxDone = null;   // 0 here, 1 gone
  const boxMats = []; box.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) boxMats.push({ m, t: m.transparent, o: m.opacity }); });
  function boxPaint() {
    const e = boxK * boxK * (3 - 2 * boxK);
    box.position.y = 0.03 * e; box.scale.setScalar(1 - 0.15 * e);
    for (const r of boxMats) { const tr = r.t || boxK > 0; if (r.m.transparent !== tr) { r.m.transparent = tr; r.m.needsUpdate = true; } r.m.opacity = r.o * (1 - e); }
    box.visible = setName !== 'none' && boxK < 1;
  }
  function boxAway(away, done) { boxGoal = away ? 1 : 0; boxDone = done || null; if (boxK === boxGoal && boxDone) { const f = boxDone; boxDone = null; try { f(); } catch (_) {} } }
  function boxBack() { boxK = 0; boxGoal = 0; boxDone = null; boxPaint(); }

  function clone(name) {
    const t = templates[name];
    const c = t.clone(true);
    c.traverse(o => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); } });
    c.userData.acc = t.userData.acc;
    return c;
  }
  function meshesOf(o) { const out = []; o.traverse(m => { if (m.isMesh) out.push(m); }); return out; }

  // a part: { id, kind, obj, acc, support: {type, ...}, spin, fallen, held, yaw, vy }
  function makePart(id, kind, tmpl, extra = {}) {
    const obj = clone(tmpl);
    obj.name = 'part:' + id;
    const p = { id, kind, obj, tmpl, acc: JSON.parse(obj.userData.acc), support: { type: 'box' }, spin: 0, fallen: false, held: false, yaw: 0, vy: 0, ...extra };
    obj.userData.part = p;
    if (kind === 'block') { for (const m of meshesOf(obj)) if (m.name.startsWith('ACC_Block_body')) m.material.color.setHex(BLOCK_COLOURS[p.colour]); }
    group.add(obj);
    parts.push(p);
    return p;
  }

  function buildSet(name) {
    for (const p of parts) group.remove(p.obj);
    parts.length = 0;
    setName = name;
    boxBack();   // shows it for a set, hides it for none
    if (name === 'gyro') {
      makePart('gyro1', 'gyro', 'ACC_Gyro'); makePart('gyro2', 'gyro', 'ACC_Gyro');
      makePart('spinner', 'spinner', 'ACC_Spinner', { on: false }); makePart('dcell', 'dcell', 'ACC_DCell');
      makePart('gyrotray', 'gyrotray', 'ACC_GyroTray', { capsSwapped: false }); makePart('pad2', 'pad2', 'ACC_Pad2', { upsideDown: false });
      makePart('holder', 'holder', 'ACC_GyroHolder'); makePart('hands', 'hands', 'ACC_HandsGyro', { which: 'gyro' });
    } else if (name === 'block') {
      for (const c of BLOCK_ORDER) makePart('block_' + c, 'block', 'ACC_Block', { colour: c });
      for (let i = 1; i <= 5; i++) makePart('tray' + i, 'blocktray', 'ACC_BlockTray');
      makePart('hands', 'hands', 'ACC_HandsBlock', { which: 'block' });
    }
    layoutBox();
    if (getHands() !== 'bare') setHands('bare');
  }
  // the box: parts laid out as the booklet's parts picture, left to right
  const FOOT = { gyrotray: [0.22, 0.22], holder: [0.18, 0.15], spinner: [0.10, 0.12], blocktray: [0.10, 0.13], pad2: [0.15, 0.04], gyro: [0.11, 0.08], block: [0.05, 0.05], dcell: [0.08, 0.05], hands: [0.06, 0.07] };
  /* 2 Nov 2026 ("the components bleed out of the box"): the parts are packed by the room
     they really take up. Each is first put down in the box as before (a slot part turned half round,
     a gyro on its side), its footprint is measured from its own shape, and it is then moved to the
     first free spot, front row first, from the end nearest R.O.B., inside the box's walls (3 mm) with
     a small gap between parts. The old rows used guessed sizes (FOOT) and an offset for the slot
     parts that put the gyro tray 46 mm over the wall. */
  const BOX_WALL = 0.003;
  function layoutBox() {
    const inBox = parts.filter(p => p.support.type === 'box').sort((a, b) => (FOOT[b.kind][0] * FOOT[b.kind][1]) - (FOOT[a.kind][0] * FOOT[a.kind][1]));
    const w = boxAcc.w * MM, d = boxAcc.d * MM, pad = 0.008;
    const x0 = BOX_AT.x - w / 2 + BOX_WALL + pad, x1 = BOX_AT.x + w / 2 - BOX_WALL - pad;
    const z0 = BOX_AT.z - d / 2 + BOX_WALL + pad, z1 = BOX_AT.z + d / 2 - BOX_WALL - pad;
    const placed = [];
    const clash = (x, z, fw, fd) => placed.some(r => x < r.x + r.w + pad - 1e-6 && r.x < x + fw + pad - 1e-6 && z < r.z + r.d + pad - 1e-6 && r.z < z + fd + pad - 1e-6);
    for (const p of inBox) {
      const pos = V3(BOX_AT.x, boxAcc.floor * MM, BOX_AT.z);
      if (p.acc.slots) { placeLoose(p, pos, 'stand', { type: 'box' }); p.obj.rotation.set(0, Math.PI + (p.acc.slots === 2 ? -rad(30) : 0), 0); p.obj.updateMatrixWorld(true); }
      else placeLoose(p, pos, p.kind === 'gyro' ? 'lying' : 'stand', { type: 'box' });
      const b = new THREE.Box3().setFromObject(p.obj, true);   // precise: from the shape's points (a turned part's rough box is far too big and off centre)
      const fw = b.max.x - b.min.x, fd = b.max.z - b.min.z;
      const cands = [[x0, z0]];
      for (const r of placed) cands.push([r.x + r.w + pad, r.z], [r.x, r.z + r.d + pad], [x0, r.z + r.d + pad]);
      cands.sort((a, c) => a[1] - c[1] || a[0] - c[0]);
      let spot = cands.find(([x, z]) => x + fw <= x1 + 1e-6 && z + fd <= z1 + 1e-6 && !clash(x, z, fw, fd));
      if (!spot) { spot = [x0, z0]; log(`box: no room for ${label(p)}`); }
      p.obj.position.x += spot[0] - b.min.x; p.obj.position.z += spot[1] - b.min.z;
      p.obj.updateMatrixWorld(true);
      placed.push({ x: spot[0], z: spot[1], w: fw, d: fd });
    }
  }

  // ------------------------------------------------------- placing things
  function slotPos(k) {
    const a = rad(SLOT_DEG[k]); const r = D.slot_r[k] * MM;
    return V3(-r * Math.sin(a), D.plinth_top * MM, -r * Math.cos(a));
  }
  /* a slot part sits with its origin on the turn axis, rotated to its slot (two-slot parts span slot k and k-1) */
  function placeSlot(p, k) {
    p.support = { type: 'slot', slot: k };
    p.obj.position.set(0, 0, 0);
    p.obj.rotation.set(0, rad(SLOT_DEG[k]), 0);
    p.fallen = false;
    p.obj.updateMatrixWorld(true);
  }
  function placeLoose(p, pos, how, support) {
    p.support = support; p.held = false; p.vy = 0;
    p.obj.position.copy(pos);
    if (how === 'lying') { p.fallen = true; lieDown(p); if (support.type === 'box') { const b = new THREE.Box3().setFromObject(p.obj); const c = b.getCenter(V3()); p.obj.position.x += pos.x - c.x; p.obj.position.z += pos.z - c.z; } }
    else { p.fallen = false; p.obj.rotation.set(0, p.yaw || 0, 0); if (p.kind === 'gyro') p.obj.rotation.set(0, 0, 0); }
    p.obj.updateMatrixWorld(true);
  }
  function lieDown(p) {
    // on its side: tipped 80 degrees, then dropped so its lowest point rests on the surface
    const y = p.obj.position.y;
    p.obj.rotation.set(rad(65), p.yaw || 0, 0);     // a fallen top rests on its rim and its upper spindle tip
    p.obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(p.obj);
    p.obj.position.y += y - b.min.y;
    // not into the plinth: a part that lies down against it is pushed out past its wall
    const c = b.getCenter(V3()); const r = Math.hypot(c.x, c.z); const half = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2;
    const wall = D.slot_r[3] * MM + 0.004;
    if (r - half < wall && y < D.plinth_top * MM + 0.001) { const k = (wall + half - r) / Math.max(r, 1e-6); p.obj.position.x += c.x * k; p.obj.position.z += c.z * k; }
    p.obj.updateMatrixWorld(true);
  }
  const partWorld = (p, local) => { p.obj.updateMatrixWorld(true); return p.obj.localToWorld(local.clone()); };
  const polarLocal = (r, deg, z) => V3(-r * MM * Math.sin(rad(deg)), z * MM, -r * MM * Math.cos(rad(deg)));   // in a slot part's own frame

  // ------------------------------------------------------------ targets
  /* Every place a part can go, as it stands now. {id, type, pos(world), accepts(part), occupant, part(owner), slot(s)} */
  let tcache = null;                 // valid inside one update() only
  function targets() {
    if (tcache) return tcache;
    const out = targetsNow();
    if (inUpdate) tcache = out;
    return out;
  }
  let inUpdate = false;
  function targetsNow() {
    const out = [];
    const occupiedSlots = new Set();
    for (const p of parts) if (p.support.type === 'slot') { occupiedSlots.add(p.support.slot); if (p.acc.slots === 2) occupiedSlots.add(p.support.slot - 1); }
    for (let k = 1; k <= 5; k++) {
      const free1 = !occupiedSlots.has(k), free2 = free1 && k >= 2 && !occupiedSlots.has(k - 1);
      out.push({ id: 'slot' + k, type: 'slot', slot: k, pos: slotPos(k), free1, free2,
        accepts: q => q.acc.slots && (q.acc.slots === 1 ? free1 : free2) && q.support.type !== 'slot' || (q.support.type === 'slot' && q.support.slot !== k && (q.acc.slots === 1 ? free1 : free2)) });
    }
    for (const p of parts) {
      if (p.support.type !== 'slot') continue;
      if (p.kind === 'holder') p.acc.cups.forEach((c, i) => out.push({ id: p.id + '.cup' + i, type: 'cup', owner: p, pos: partWorld(p, polarLocal(c.r, c.deg, c.floor)), rim: c.rim * MM, accepts: q => q.kind === 'gyro', occupant: occupantOf(p.id + '.cup' + i) }));
      if (p.kind === 'spinner') { const m = p.acc.mouth; out.push({ id: p.id + '.mouth', type: 'mouth', owner: p, pos: partWorld(p, polarLocal(m.r, m.deg, m.floor)), accepts: q => q.kind === 'gyro', occupant: occupantOf(p.id + '.mouth') });
        const b = p.acc.bay; out.push({ id: p.id + '.bay', type: 'bay', owner: p, pos: partWorld(p, V3(b.x * MM, b.z * MM, -b.y * MM)), accepts: q => q.kind === 'dcell', occupant: occupantOf(p.id + '.bay') }); }
      if (p.kind === 'gyrotray') {
        for (const [name, lv] of Object.entries(p.acc.levers)) out.push({ id: p.id + '.cap' + name, type: 'cap', owner: p, lever: name, colour: capColour(p, name), pos: partWorld(p, polarLocal(lv.r, lv.deg, lv.cap_top - D.press)), accepts: q => q.kind === 'gyro', occupant: occupantOf(p.id + '.cap' + name) });
        const h = p.acc.holder; out.push({ id: p.id + '.holder', type: 'holder', owner: p, pos: partWorld(p, V3(h.x * MM, h.top * MM, -h.y * MM)), yaw: rad(h.deg), accepts: q => q.kind === 'pad2', occupant: occupantOf(p.id + '.holder') });
      }
      if (p.kind === 'blocktray') { const r = p.acc.ring; out.push({ id: p.id + '.ring', type: 'ring', owner: p, pos: partWorld(p, polarLocal(r.r, r.deg, r.floor)), rim: r.rim * MM, accepts: q => q.kind === 'block', occupant: occupantOf(p.id + '.ring') }); }
    }
    // the top of every standing block is a peg
    for (const p of parts) if (p.kind === 'block' && !p.fallen && !p.held && p.support.type !== 'box' && p.support.type !== 'air') {
      const top = p.obj.position.clone(); top.y += p.acc.h * MM;
      out.push({ id: p.id + '.peg', type: 'peg', owner: p, pos: top, accepts: q => q.kind === 'block' && q !== p, occupant: occupantOf(p.id + '.peg') });
    }
    TABLE_SPOTS.forEach(([x, z], i) => out.push({ id: 'table' + i, type: 'table', pos: V3(x, 0, z), accepts: q => !q.acc.slots || true, occupant: parts.find(q => q.support.type === 'table' && q.support.spot === i) || null }));
    out.push({ id: 'box', type: 'box', pos: V3(BOX_AT.x, boxAcc.floor * MM, BOX_AT.z), accepts: q => boxGoal === 0 && q.support.type !== 'box' });
    const hb = new THREE.Box3(); for (const n of ['ROB_HandL_gyro', 'ROB_HandR_gyro']) { const o = node[n]; if (o) { const was = o.visible; o.visible = true; hb.expandByObject(o); o.visible = was; } }
    out.push({ id: 'arms', type: 'arms', pos: hb.getCenter(V3()), accepts: q => q.kind === 'hands' && q.support.type !== 'arms' });
    return out;
  }
  const occupantOf = tid => parts.find(q => q.support.target === tid) || null;
  const capColour = (tray, lever) => (lever === 'A') !== !!tray.capsSwapped ? 'blue' : 'red';   // A blue, B red; Turn swaps the caps

  /* Put a part on a target (it fits: the caller checked accepts). */
  function placeOn(p, t) {
    tcache = null;
    if (t.type === 'slot') { placeSlot(p, t.slot); }
    else if (t.type === 'box') { p.support = { type: 'box' }; layoutBox(); }
    else if (t.type === 'table') { placeLoose(p, V3(t.pos.x, 0, t.pos.z), p.kind === 'gyro' ? 'lying' : 'stand', { type: 'table', spot: TABLE_SPOTS.findIndex(([x, z]) => x === t.pos.x && z === t.pos.z) }); if (p.acc.slots) { p.obj.position.set(t.pos.x, 0, t.pos.z); p.obj.rotation.set(0, p.yaw || 0, 0); } }
    else if (t.type === 'arms') { p.support = { type: 'arms' }; p.obj.visible = false; setHands(p.which); }
    else if (t.type === 'holder') { placeLoose(p, t.pos.clone(), 'stand', { type: 'holder', target: t.id }); p.obj.rotation.set(0, t.yaw + Math.PI, p.upsideDown ? Math.PI : 0); if (p.upsideDown) { p.obj.position.y += p.acc.h * MM; } p.obj.updateMatrixWorld(true); }
    else if (t.type === 'bay') { placeLoose(p, t.pos.clone(), 'stand', { type: 'bay', target: t.id }); p.obj.rotation.set(0, t.owner.obj.rotation.y, 0); p.obj.updateMatrixWorld(true); }
    else { // cup, mouth, cap, ring, peg: seated, standing
      const seated = p.kind === 'gyro' ? (p.spin > SPIN_STAND || t.type !== 'cap') : true;   // a cup or the mouth holds a still gyro by its spindle; a cap does not
      placeLoose(p, t.pos.clone(), seated ? 'stand' : 'lying', { type: t.type, target: t.id, owner: t.owner && t.owner.id });
      if (!seated) { p.support = { type: 'air' }; p.vy = 0; }   // a still gyro set on a cup falls off it
    }
    if (p.support.type !== 'arms') p.obj.visible = true;
    notify();
  }
  function takeOff(p) {
    if (p.support.type === 'arms') { setHands('bare'); p.obj.visible = true; }
    p.support = { type: 'air' };
  }

  // ------------------------------------------------------------- physics
  const grabbable = p => (p.kind === 'gyro' && getHands() === 'gyro') || (p.kind === 'block' && getHands() === 'block');
  let heldPart = null, lastArmsTarget = 1, armsMin = 0;
  const gap = f => (RIG.arms.gap_closed_m || 0.0182) + f * ((RIG.arms.gap_open_m || 0.07) - (RIG.arms.gap_closed_m || 0.0182));
  function clampArms(f) { return Math.max(f, armsMin); }
  function tryGrab() {
    if (heldPart) return;
    const g = gripWorld();
    for (const p of parts) {
      if (!grabbable(p) || p.held || p.support.type === 'box' || p.support.type === 'air' || p.fallen) continue;
      const c = p.obj.position;
      const dz = p.kind === 'gyro' ? p.acc.grip_z * MM : p.acc.h * MM / 2;   // the spot the hands take: the upper spindle's middle, the block's middle
      const dx = Math.hypot(c.x - g.x, c.z - g.z), dy = Math.abs(c.y + dz - g.y);
      const tolH = p.kind === 'gyro' ? 0.014 : 0.012, tolV = p.kind === 'gyro' ? 0.022 : 0.010;
      if (dx < tolH && dy < tolV) {
        heldPart = p; p.held = true; p.heldFrom = p.support; p.support = { type: 'hand' };
        lift.attach(p.obj);
        if (p.kind === 'block') { let on = parts.find(q => q.kind === 'block' && q.support.target === p.id + '.peg'); while (on) { on.riding = p.id; lift.attach(on.obj); on = parts.find(q => q.kind === 'block' && q.support.target === on.id + '.peg'); } }
        armsMin = p.kind === 'block' ? Math.max(0, (p.acc.r * 2 * MM - gap(0)) / (gap(1) - gap(0))) : 0;
        log(`R.O.B. holds ${label(p)}`);
        notify();
        return;
      }
    }
  }
  function release() {
    const p = heldPart; if (!p) return;
    heldPart = null; p.held = false; armsMin = 0;
    group.attach(p.obj);
    for (const q of parts) if (q.riding === p.id || (q.riding && parts.find(r => r.id === q.riding && r.riding))) { q.riding = null; group.attach(q.obj); q.obj.rotation.set(0, q.obj.rotation.y, 0); }
    p.obj.rotation.set(0, p.kind === 'gyro' ? 0 : p.obj.rotation.y, 0);
    p.support = { type: 'air' }; p.vy = 0;
    // straight over a seat within 8 mm: it drops in (the fall does the rest)
    log(`R.O.B. lets go of ${label(p)}`);
    notify();
  }
  /* what is under a falling part: the highest surface under its footprint, and whether that is a seat */
  function landing(p) {
    const c = p.obj.position; const r = p.kind === 'gyro' ? p.acc.disc_r * MM : (p.kind === 'block' ? p.acc.r * MM : 0.03);
    let best = { y: 0, seat: null, flat: true, what: 'table' };
    const consider = (y, seat, flat, what) => { if (y > best.y - 1e-6 && y <= c.y + (seat ? 0.006 : 0.002)) best = { y, seat, flat, what }; };
    // the plinth top (a hexagon: use the wall radius at the part's angle)
    const ang = Math.atan2(-c.x, -c.z); const rr = Math.hypot(c.x, c.z);
    const wall = D.slot_r[3] * MM; if (rr < wall - r * 0.5) consider(D.plinth_top * MM, null, false, 'plinth');
    if (boxGoal === 0 && Math.abs(c.x - BOX_AT.x) < boxAcc.w * MM / 2 && Math.abs(c.z - BOX_AT.z) < boxAcc.d * MM / 2) consider(boxAcc.floor * MM, null, true, 'box');
    for (const t of targets()) {
      if (t.type === 'slot' || t.type === 'box' || t.type === 'table' || t.type === 'arms' || t.type === 'holder' || t.type === 'bay') continue;
      const d = Math.hypot(t.pos.x - c.x, t.pos.z - c.z);
      if (t.accepts(p) && !t.occupant && d < 0.009 && !(t.type === 'cap' && p.kind === 'gyro' && p.spin <= SPIN_STAND)) consider(t.pos.y, t, true, t.type);   // a cap seats a spinning gyro only
      else if (t.type === 'cup' || t.type === 'ring') { if (d < (t.type === 'ring' ? 0.05 : 0.014) + r) consider(t.rim, null, false, t.type + ' rim'); }
      else if (t.type === 'cap') { if (d < 0.02 + r) consider(t.pos.y + 0.004, null, false, 'cap'); }
      else if (t.type === 'mouth') { if (d < 0.02 + r) consider(t.pos.y + 0.01, null, false, 'drum'); }
      else if (t.type === 'peg') { if (d < t.owner.acc.r * MM + r) consider(t.pos.y, null, false, 'a block'); }
    }
    for (const q of parts) {   // other loose things: a gyro's disc, a toppled part
      if (q === p || q.held || q.support.type === 'box' || q.support.type === 'slot' || q.support.type === 'arms') continue;
      if (q.kind === 'gyro' && !q.fallen) { const d = Math.hypot(q.obj.position.x - c.x, q.obj.position.z - c.z); if (d < q.acc.disc_r * MM + r) consider(q.obj.position.y + q.acc.disc_top * MM, null, false, 'a gyro'); }
    }
    return best;
  }
  function fall(p, dt) {
    p.vy += G * dt;
    const L = landing(p);
    const ny = p.obj.position.y - p.vy * dt;
    if (ny <= L.y) {
      p.obj.position.y = L.y; p.vy = 0;
      if (L.seat) { placeOn(p, L.seat); log(`${label(p)} lands in ${L.seat.type} ${L.seat.id}`); return; }
      const standsOnFlat = L.flat && p.kind !== 'gyro';
      if (standsOnFlat) { p.support = L.what === 'box' ? { type: 'box' } : { type: 'loose', on: L.what }; p.fallen = false; p.obj.rotation.set(0, p.obj.rotation.y, 0); }
      else { p.support = { type: 'loose', on: L.what }; p.fallen = true; p.spin = 0; lieDown(p); log(`${label(p)} falls over on ${L.what}`); }
      p.obj.updateMatrixWorld(true);
      notify();
    } else p.obj.position.y = ny;
  }
  /* a held part sweeping into a standing loose part knocks it over */
  function pushes(dt) {
    const h = heldPart; if (!h) return;
    const hp = h.obj.getWorldPosition(V3());
    const hr = h.kind === 'gyro' ? h.acc.disc_r * MM : h.acc.r * MM;
    const hy0 = hp.y + (h.kind === 'gyro' ? h.acc.disc_top * MM - MOD.gyro_disc_t * MM : 0), hy1 = hp.y + (h.kind === 'gyro' ? h.acc.height * MM : h.acc.h * MM);
    for (const q of parts) {
      if (q === h || q.held || q.fallen || q.support.type === 'box' || q.support.type === 'slot' || q.support.type === 'arms' || q.support.type === 'air') continue;
      if (q.kind !== 'gyro' && q.kind !== 'block' && q.kind !== 'pad2' && q.kind !== 'dcell') continue;
      const qp = q.obj.position; const qr = q.kind === 'gyro' ? q.acc.disc_r * MM : (q.kind === 'block' ? q.acc.r * MM : 0.03);
      const qy0 = qp.y + (q.kind === 'gyro' ? q.acc.disc_top * MM - MOD.gyro_disc_t * MM : 0), qy1 = qp.y + (q.kind === 'gyro' ? q.acc.height * MM : (q.kind === 'block' ? q.acc.h * MM : 0.06));
      if (q.riding) continue;
      if (Math.hypot(hp.x - qp.x, hp.z - qp.z) < hr + qr - 0.004 && hy0 < qy1 - 0.002 && hy1 > qy0 + 0.002) {
        // knocked: it and anything stacked on it go loose and fall
        const sweep = [q]; for (const s of parts) if (s.kind === 'block' && s.support.target === q.id + '.peg') sweep.push(s);
        const away = V3(qp.x - hp.x, 0, qp.z - hp.z); if (away.length() < 1e-4) away.set(1, 0, 0); away.normalize().multiplyScalar((hr + qr) * 0.8);   // shoved clear of its seat
        for (const s of sweep) { s.support = { type: 'air' }; s.vy = 0.05; s.obj.position.x += away.x + (Math.random() - 0.5) * 0.006; s.obj.position.z += away.z + (Math.random() - 0.5) * 0.006; s.knocked = true; }
        log(`R.O.B. knocks ${label(q)}`);
      }
    }
  }
  function spinnerRuns(sp) { if (!sp.on) return false; const cell = parts.find(q => q.kind === 'dcell' && q.support.target === sp.id + '.bay'); return !!cell; }
  function stepSpin(dt) {
    for (const g of parts) {
      if (g.kind !== 'gyro') continue;
      const inMouth = g.support.type === 'mouth' || (g.held && (() => { const p = gripWorld(); const sp = parts.find(q => q.kind === 'spinner' && q.support.type === 'slot'); if (!sp) return false; const t = targets().find(x => x.id === sp.id + '.mouth'); return t && Math.hypot(t.pos.x - p.x, t.pos.z - p.z) < 0.012 && Math.abs(p.y - (t.pos.y + g.acc.grip_z * MM)) < 0.006; })());
      const sp = parts.find(q => q.kind === 'spinner' && q.support.type === 'slot');
      if (inMouth && sp && spinnerRuns(sp) && !g.fallen) { const top = g.held ? 1 : SPIN_UNHELD; if (g.spin < top) g.spin = Math.min(top, g.spin + dt / SPIN_UP_S); else g.spin = Math.max(0, g.spin - dt / SPIN_S); }
      else if (g.spin > 0) { g.spin = Math.max(0, g.spin - dt / SPIN_S); if (g.spin < SPIN_STAND && !g.held && !g.fallen && (g.support.type === 'cap' || g.support.type === 'cup' || g.support.type === 'loose' || g.support.type === 'table')) { if (g.support.type !== 'cup') { g.support = { type: 'air' }; g.vy = 0; g.obj.position.y += 0.001; log(`${label(g)} slows and falls over`); } } }
      const spinNode = g.obj.getObjectByName('ACC_Gyro_spin'); if (spinNode && g.spin > 0) spinNode.rotation.y += dt * g.spin * 60;
    }
  }
  /* the trays' levers: a standing spinning gyro on a cap, or a held gyro pressed down on it at the low stop */
  function levers() {
    const tray = parts.find(q => q.kind === 'gyrotray' && q.support.type === 'slot');
    const out = { A: false, B: false, blue: false, red: false, padOk: false };
    if (!tray) return out;
    const pad = parts.find(q => q.kind === 'pad2' && q.support.target === tray.id + '.holder');
    out.padOk = !!pad && !pad.upsideDown;
    const g = heldPart && heldPart.kind === 'gyro' ? gripWorld() : null;
    for (const [name, lv] of Object.entries(tray.acc.levers)) {
      const t = targets().find(x => x.id === tray.id + '.cap' + name);
      let pressed = !!(t && t.occupant && !t.occupant.fallen);
      if (!pressed && g && t) { const dh = Math.hypot(t.pos.x - g.x, t.pos.z - g.z); const want = t.pos.y + heldPart.acc.grip_z * MM; if (dh < 0.014 && g.y <= want + 0.004) pressed = true; }
      const piv = tray.obj.getObjectByName('ACC_GyroTray_lever' + name);
      if (piv) piv.rotation.x = pressed ? -Math.atan2(D.press * MM, lv.L * MM) : 0;
      const colour = capColour(tray, name);
      if (pressed) { out[colour] = true; if (out.padOk) out[colour === 'blue' ? 'A' : 'B'] = true; }
    }
    return out;
  }
  let lastLevers = { A: false, B: false };
  let lastPose = null;
  function update(now, dt) {
    dt = Math.min(0.05, dt || 0.016);
    if (boxK !== boxGoal) {   // the box leaving or coming back (boxAway)
      boxK = boxGoal > boxK ? Math.min(1, boxK + dt / BOX_FADE) : Math.max(0, boxK - dt / BOX_FADE); boxPaint();
      if (boxK === boxGoal && boxDone) { const f = boxDone; boxDone = null; try { f(); } catch (_) {} }
    }
    inUpdate = true; tcache = null;
    try { updateInner(now, dt); } finally { inUpdate = false; tcache = null; }
  }
  function updateInner(now, dt) {
    const pose = getPose();
    // grabbing: the arms have just finished closing (or stopped on the part)
    if (pose.armsTarget === 0 && !pose.movingArms && lastPose && (lastPose.movingArms || lastPose.armsTarget !== 0)) tryGrab();
    if (pose.armsTarget === 1 && lastArmsTarget === 0 && heldPart) release();
    lastArmsTarget = pose.armsTarget;
    if (heldPart && (pose.movingTurn || pose.movingLift)) pushes(dt);
    for (const p of parts) if (p.support.type === 'air') { tcache = null; fall(p, dt); for (const q of parts) if (q.riding === p.id && p.support.type !== 'air') { q.riding = null; } }
    stepSpin(dt);
    const lv = levers();
    if (lv.A !== lastLevers.A || lv.B !== lastLevers.B) { lastLevers = lv; notify(); }
    // the spinner's ring sinks while a spindle is in its mouth
    for (const sp of parts) if (sp.kind === 'spinner') { const ring = sp.obj.getObjectByName('ACC_Spinner_ring'); const inM = parts.some(q => q.kind === 'gyro' && q.support.target === sp.id + '.mouth'); if (ring) ring.position.y = inM ? -D.press * MM : 0; const sw = sp.obj.getObjectByName('ACC_Spinner_switch'); if (sw) sw.position.x = sp.on ? 0.004 : 0; }
    lastPose = pose;
    cursorPulse(now);
  }

  // ------------------------------------------------------------ set-up: pointer
  let setupOn = false, drag = null, hover = null;
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  const pickables = () => parts.filter(p => p.support.type !== 'arms' && !p.held).flatMap(p => meshesOf(p.obj));
  const partAt = (x, y) => {
    const r = dom.getBoundingClientRect(); ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickables(), false);
    if (hits.length) { let o = hits[0].object; while (o && !o.userData.part) o = o.parent; return o ? o.userData.part : null; }
    // the hands on R.O.B.: hit his hand meshes
    const hp = parts.find(p => p.kind === 'hands' && p.support.type === 'arms');
    if (hp) { const hm = ['ROB_HandL_' + hp.which, 'ROB_HandR_' + hp.which].map(n => node[n]).filter(Boolean); if (ray.intersectObjects(hm, true).length) return hp; }
    return null;
  };
  const groundHit = (x, y, planeY) => { const r = dom.getBoundingClientRect(); ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const pl = new THREE.Plane(V3(0, 1, 0), -planeY); const out = V3(); return ray.ray.intersectPlane(pl, out) ? out : null; };
  function legalTargets(p) { return targets().filter(t => t.accepts(p) && !(t.occupant && t.occupant !== p) && !(t.type === 'slot' && p.support.type === 'slot' && p.support.slot === t.slot)); }
  function nearestTarget(p, pos, maxD) {
    let best = null, bd = maxD;
    for (const t of legalTargets(p)) { const d = Math.hypot(t.pos.x - pos.x, t.pos.z - pos.z); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  function nearestTargetScreen(p, x, y, maxPx = 40) {
    let best = null, bd = maxPx;
    for (const t of legalTargets(p)) { const sp = toScreen(t.pos); const d = Math.hypot(sp.x - x, sp.y - y); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  function pickUp(p, by) {
    if (p.held) return false;
    const from = { support: p.support, pos: p.obj.position.clone(), rot: p.obj.rotation.clone() };
    takeOff(p);
    p.support = { type: by, from };
    p.fallen = false; p.obj.rotation.set(0, p.yaw || 0, 0); p.obj.visible = true;
    highlight(p, true); showGhost(p);
    return true;
  }
  function putBack(p) { const f = p.support.from; if (!f) return; p.obj.position.copy(f.pos); p.obj.rotation.copy(f.rot); p.support = f.support; if (f.support.type === 'arms') { p.obj.visible = false; setHands(p.which); } highlight(p, false); hideGhost(); }
  function dropAt(p, pos) {
    const t = nearestTarget(p, pos, 0.03);
    highlight(p, false); hideGhost();
    if (t) { placeOn(p, t); log(`${label(p)} placed: ${t.id}`); return t; }
    if (p.acc.slots) { placeLoose(p, V3(pos.x, 0, pos.z), 'stand', { type: 'loose', on: 'table' }); p.obj.rotation.set(0, p.yaw || 0, 0); notify(); return null; }
    p.obj.position.set(pos.x, Math.max(pos.y, 0.0), pos.z); p.support = { type: 'air' }; p.vy = 0;
    return null;
  }
  function onPointerDown(e) {
    if (!setupOn || drag || cursor) return;
    const p = partAt(e.clientX, e.clientY); if (!p) return;
    const base = p.obj.position.y;
    const hit = groundHit(e.clientX, e.clientY, base); if (!hit) return;
    pickUp(p, 'drag');
    drag = { p, planeY: base, off: V3(p.obj.position.x - hit.x, 0, p.obj.position.z - hit.z), id: e.pointerId };
    p.obj.position.y = base + 0.03;
    controls.enabled = false; dom.setPointerCapture && dom.setPointerCapture(e.pointerId);
    e.preventDefault(); e.stopPropagation();
  }
  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.id) { if (setupOn && !drag && !cursor) { const p = partAt(e.clientX, e.clientY); if (p !== hover) { if (hover) highlight(hover, false); hover = p; if (p) highlight(p, true, 0.5); } } return; }
    const hit = groundHit(e.clientX, e.clientY, drag.planeY); if (!hit) return;
    const p = drag.p; p.obj.position.set(hit.x + drag.off.x, drag.planeY + 0.03, hit.z + drag.off.z);
    const t = nearestTargetScreen(p, e.clientX, e.clientY);
    drag.last = { x: e.clientX, y: e.clientY };
    preview(p, t);
    e.preventDefault();
  }
  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const p = drag.p; const x = e.clientX || (drag.last && drag.last.x), y = e.clientY || (drag.last && drag.last.y);
    drag = null; controls.enabled = true; hideSnap(); previewAt = null;
    const t = nearestTargetScreen(p, x, y);
    highlight(p, false); hideGhost();
    log(`drop of ${label(p)} at ${Math.round(x)},${Math.round(y)} (${e.type}, ${e.pointerType}): ${t ? t.id : 'no target within 40 px'}`);
    if (t) { placeOn(p, t); log(`${label(p)} placed: ${t.id}`); return; }
    const hit = groundHit(x, y, 0) || p.obj.position.clone();
    if (p.acc.slots) { placeLoose(p, V3(hit.x, 0, hit.z), 'stand', { type: 'loose', on: 'table' }); p.obj.rotation.set(0, p.yaw || 0, 0); notify(); return; }
    p.obj.position.set(hit.x, Math.max(p.obj.position.y, 0.0), hit.z); p.support = { type: 'air' }; p.vy = 0;
  }
  let previewAt = null;
  function preview(p, t) {
    if (t && (!previewAt || previewAt.id !== t.id)) { previewAt = t; snapGhost(t, p); }
    else if (!t && previewAt) { previewAt = null; hideSnap(); }
  }
  dom.addEventListener('pointerdown', onPointerDown, { capture: true });
  dom.addEventListener('pointermove', onPointerMove, { capture: true });
  dom.addEventListener('pointerup', onPointerUp, { capture: true });
  dom.addEventListener('pointercancel', onPointerUp, { capture: true });
  dom.addEventListener('wheel', e => { if (drag) { turn(drag.p); e.preventDefault(); } }, { passive: false, capture: true });

  // ------------------------------------------------------------ set-up: the hand cursor (keys)
  /* Left / Right step through the parts; OK picks one up; Left / Right then step through its legal targets
     (the part previews at each); OK places; Back puts it back; Up / Down turn it. */
  let cursor = null;      // { phase: 'parts'|'targets', i, p, list }
  const cursorList = () => parts.filter(p => !p.held);
  function cursorStart() { const l = cursorList(); if (!l.length) return; cursor = { phase: 'parts', i: 0, list: l }; cursorShow(); }
  function cursorShow() {
    for (const p of parts) highlight(p, false);
    if (!cursor) { hideGhost(); hideSnap(); return; }
    if (cursor.phase === 'parts') { const p = cursor.list[cursor.i]; highlight(p, true, 0.6); if (p.support.type === 'arms') { highlightHands(true); } }
    else { const t = cursor.list[cursor.i]; const p = cursor.p; p.obj.position.set(t.pos.x, t.pos.y + 0.03, t.pos.z); if (t.type === 'slot') { p.obj.position.set(0, 0.03, 0); p.obj.rotation.set(0, rad(SLOT_DEG[t.slot]), 0); } else p.obj.rotation.set(0, (t.yaw || 0) + (p.yaw || 0), 0); snapGhost(t, p); highlight(p, true); }
  }
  function cursorKey(key) {
    if (!cursor) return false;
    const n = cursor.list.length;
    if (key === 'ArrowLeft' || key === 'ArrowRight') { cursor.i = (cursor.i + (key === 'ArrowRight' ? 1 : -1) + n) % n; cursorShow(); return true; }
    if (key === 'ArrowUp' || key === 'ArrowDown') { const p = cursor.phase === 'parts' ? cursor.list[cursor.i] : cursor.p; turn(p); cursorShow(); return true; }
    if (key === 'Enter' || key === ' ') {
      if (cursor.phase === 'parts') { const p = cursor.list[cursor.i]; const lt = legalTargets(p); if (!lt.length) return true; pickUp(p, 'cursor'); cursor = { phase: 'targets', i: 0, p, list: lt }; cursorShow(); }
      else { const t = cursor.list[cursor.i]; const p = cursor.p; hideGhost(); hideSnap(); highlight(p, false); placeOn(p, t); log(`${label(p)} placed: ${t.id}`); cursor = { phase: 'parts', i: Math.max(0, cursorList().indexOf(p)), list: cursorList() }; cursorShow(); }
      return true;
    }
    if (key === 'Escape' || key === 'Backspace') {
      if (cursor.phase === 'targets') { putBack(cursor.p); cursor = { phase: 'parts', i: Math.max(0, cursorList().indexOf(cursor.p)), list: cursorList() }; cursorShow(); return true; }
      cursor = null; cursorShow(); setup(false); return true;
    }
    return false;
  }
  function key(e) {
    if (!setupOn) return false;
    if (!cursor && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ')) { cursorStart(); if (e.key === 'Enter' || e.key === ' ') return true; }
    if (!cursor && e.key === 'r' && drag) { turn(drag.p); return true; }
    return cursorKey(e.key);
  }
  function turn(p) {
    if (p.kind === 'gyrotray') { p.capsSwapped = !p.capsSwapped; const a = p.obj.getObjectByName('ACC_GyroTray_capA'), b = p.obj.getObjectByName('ACC_GyroTray_capB'); if (a && b) { const ma = a.material; a.material = b.material; b.material = ma; } log(`gyro tray: caps swapped (${capColour(p, 'A')} on the first post)`); }
    else if (p.kind === 'pad2') { p.upsideDown = !p.upsideDown; if (p.support.type === 'holder') { const t = targets().find(x => x.id === p.support.target); if (t) placeOn(p, t); } else { p.obj.rotation.z = p.upsideDown ? Math.PI : 0; p.obj.position.y = p.support.type === 'drag' || p.support.type === 'cursor' ? p.obj.position.y : p.obj.position.y; } log(`Controller 2: ${p.upsideDown ? 'upside down' : 'the right way up'}`); }
    else if (p.kind === 'spinner') { p.on = !p.on; log(`spinner switch ${p.on ? 'on' : 'off'}`); }
    else { p.yaw = ((p.yaw || 0) + Math.PI / 3) % (Math.PI * 2); if (!p.fallen && p.support.type !== 'slot') p.obj.rotation.y = p.yaw; }
    notify();
  }

  // ------------------------------------------------------------ highlights, ghosts
  function highlight(p, on, strength = 0.9) { for (const m of meshesOf(p.obj)) { if (!m.material.emissive) continue; if (on) { m.material.emissive.setHex(0x8a2a1e); m.material.emissiveIntensity = strength; } else { m.material.emissive.setHex(0x000000); m.material.emissiveIntensity = 0; } } }
  function highlightHands(on) { for (const n of ['ROB_HandL_gyro', 'ROB_HandR_gyro', 'ROB_HandL_block', 'ROB_HandR_block']) { const o = node[n]; if (o && o.material && o.material.emissive) { o.material.emissive.setHex(on ? 0x8a2a1e : 0); o.material.emissiveIntensity = on ? 0.6 : 0; } } }
  let pulseT = 0; function cursorPulse(now) { if (!cursor && !drag) return; pulseT = now; const k = 0.55 + 0.35 * Math.sin(now * 5); const p = cursor ? (cursor.phase === 'parts' ? cursor.list[cursor.i] : cursor.p) : drag.p; for (const m of meshesOf(p.obj)) if (m.material.emissive) m.material.emissiveIntensity = k; }
  let ghost = null, snapMark = null, ghostsOn = true;
  const RECOMMENDED = { spinner: t => t.type === 'slot' && t.slot === 1, holder: t => t.type === 'slot' && t.slot === 5, gyrotray: t => t.type === 'slot' && t.slot === 3, blocktray: t => t.type === 'slot', hands: t => t.type === 'arms', pad2: t => t.type === 'holder', dcell: t => t.type === 'bay', gyro: t => t.type === 'cup', block: t => t.type === 'ring' && /tray3/.test(t.id) || t.type === 'peg' };
  function showGhost(p) {
    hideGhost(); if (!ghostsOn) return;
    const f = RECOMMENDED[p.kind]; if (!f) return;
    const t = legalTargets(p).find(f); if (!t) return;
    ghost = clone(p.tmpl); ghost.traverse(o => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0.28; o.material.depthWrite = false; o.castShadow = false; if (p.kind === 'block') o.material.color.setHex(BLOCK_COLOURS[p.colour]); } });
    if (t.type === 'slot') { ghost.position.set(0, 0, 0); ghost.rotation.set(0, rad(SLOT_DEG[t.slot]), 0); }
    else if (t.type === 'arms') { ghost = null; return; }
    else { ghost.position.copy(t.pos); ghost.rotation.set(0, t.yaw || 0, 0); }
    group.add(ghost);
  }
  function hideGhost() { if (ghost) { group.remove(ghost); ghost = null; } }
  function snapGhost(t, p) { hideSnap(); const r = t.type === 'slot' ? 0.03 : 0.028; snapMark = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 32), new THREE.MeshBasicMaterial({ color: 0xd9534f, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false })); snapMark.rotation.x = -Math.PI / 2; snapMark.position.copy(t.pos); snapMark.position.y += 0.002; snapMark.renderOrder = 9; group.add(snapMark); }
  function hideSnap() { if (snapMark) { group.remove(snapMark); snapMark = null; } }

  // ------------------------------------------------------------ save, state, api
  const KEY = 'cw.rob.setup.v1';
  let loading = false;
  function save() {
    if (loading || setName === 'none') return;
    try {
      const all = JSON.parse(localStorage.getItem(KEY) || '{}');
      const plain = sp => { const s = sp && (sp.type === 'drag' || sp.type === 'cursor') && sp.from ? sp.from.support : sp; if (!s || s.type === 'air' || s.type === 'hand') return { type: 'table', spot: -1 }; return { type: s.type, slot: s.slot, target: s.target, spot: s.spot, on: s.on }; };
      all[setName] = parts.map(p => ({ id: p.id, support: plain(p.held ? p.heldFrom : p.support), pos: p.obj.position.toArray().map(v => +v.toFixed(4)), yaw: p.yaw || 0, fallen: p.fallen, capsSwapped: p.capsSwapped, upsideDown: p.upsideDown, on: p.on }));
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch (_) {}
  }
  function load() {
    let rec = null; try { rec = (JSON.parse(localStorage.getItem(KEY) || '{}'))[setName]; } catch (_) {}
    if (!rec) return false;
    loading = true;
    try {
      // slot parts first, then what stands on them
      const order = rec.slice().sort((a, b) => (a.support.type === 'slot' ? 0 : 1) - (b.support.type === 'slot' ? 0 : 1));
      for (const r of order) {
        const p = parts.find(q => q.id === r.id); if (!p) continue;
        p.yaw = r.yaw || 0; if (r.capsSwapped) { p.capsSwapped = false; turn(p); } if (r.upsideDown) p.upsideDown = true; if (r.on) p.on = true;
        const s = r.support || { type: 'box' };
        if (s.type === 'slot') placeSlot(p, s.slot);
        else if (s.type === 'arms') { const t = targets().find(x => x.type === 'arms'); if (t) placeOn(p, t); }
        else if (s.target) { const t = targets().find(x => x.id === s.target); if (t && t.accepts(p) && !t.occupant) placeOn(p, t); else p.support = { type: 'box' }; }
        else if (s.type === 'table' || s.type === 'loose') { placeLoose(p, V3(r.pos[0], r.pos[1], r.pos[2]), r.fallen ? 'lying' : 'stand', s); if (p.acc.slots) p.obj.rotation.set(0, p.yaw, 0); }
        else p.support = { type: 'box' };
      }
      layoutBox();
    } finally { loading = false; }
    return true;
  }
  function reset() { boxBack(); for (const p of parts) { if (p.support.type === 'arms') setHands('bare'); p.support = { type: 'box' }; p.held = false; p.spin = 0; p.fallen = false; p.yaw = 0; p.obj.visible = true; if (p.kind === 'gyrotray' && p.capsSwapped) turn(p); p.upsideDown = false; p.on = false; p.obj.rotation.set(0, 0, 0); } if (heldPart) { group.attach(heldPart.obj); heldPart = null; armsMin = 0; } hideGhost(); hideSnap(); cursor = null; layoutBox(); notify(); log('everything back in the box'); }
  function standGyros() { for (const g of parts) if (g.kind === 'gyro' && (g.fallen || g.support.type === 'loose' || g.support.type === 'air')) { const cup = targets().find(t => t.type === 'cup' && !t.occupant); if (cup) { placeOn(g, cup); } else { const spot = targets().find(t => t.type === 'table' && !t.occupant); g.spin = 0; placeLoose(g, V3(spot.pos.x, 0, spot.pos.z), 'stand', { type: 'table', spot: TABLE_SPOTS.findIndex(([x, z]) => x === spot.pos.x) }); g.fallen = false; } } notify(); }
  function setup(on) { setupOn = !!on; if (!setupOn) { if (drag) { dropAt(drag.p, drag.p.obj.position); drag = null; controls.enabled = true; } if (cursor) { if (cursor.phase === 'targets') putBack(cursor.p); cursor = null; cursorShow(); } if (hover) { highlight(hover, false); hover = null; } } notify(); }
  const label = p => p.kind === 'block' ? `the ${p.colour} block` : p.kind === 'gyro' ? `gyro ${p.id.slice(-1)}` : p.kind === 'blocktray' ? `block tray ${p.id.slice(-1)}` : ({ spinner: 'the spinner', dcell: 'the D cell', gyrotray: 'the gyro tray', pad2: 'Controller 2', holder: 'the gyro holder', hands: `the ${p.which === 'gyro' ? 'Gyro' : 'Block'} Hands` })[p.kind] || p.id;
  function where(p) {
    const s = p.held ? { type: 'hand' } : p.support;
    switch (s.type) {
      case 'box': return 'in the box'; case 'hand': return "in R.O.B.'s hands"; case 'arms': return "on R.O.B.'s arms"; case 'air': return 'falling';
      case 'slot': return p.acc.slots === 2 ? `in slots ${s.slot} and ${s.slot - 1}` : `in slot ${s.slot}`;
      case 'table': return (p.fallen ? 'lying ' : '') + 'on the table';
      case 'loose': return (p.fallen ? 'lying on ' : 'on ') + s.on;
      default: { const t = targets().find(x => x.id === s.target); const own = t && t.owner; return `${p.fallen ? 'lying at' : 'in'} ${t ? t.type : s.type}${own ? ' of ' + label(own) : ''}${t && t.type === 'cap' ? ' (' + t.colour + ')' : ''}`; }
    }
  }
  function stacks() {
    const out = {};
    for (let k = 1; k <= 5; k++) {
      const tray = parts.find(p => p.kind === 'blocktray' && p.support.type === 'slot' && p.support.slot === k);
      if (!tray) { out[k] = null; continue; }
      const list = []; let on = parts.find(p => p.kind === 'block' && p.support.target === tray.id + '.ring' && !p.fallen);
      while (on) { list.push(on.colour); on = parts.find(p => p.kind === 'block' && p.support.target === on.id + '.peg' && !p.fallen); }
      out[k] = list;   // bottom to top
    }
    return out;
  }
  /* THE PLAY TIME GAME (2 Nov 2026): every part of the set with the place it belongs, from
     the set's own model (RECOMMENDED above, the ghost each part shows when picked up): Gyromite, the
     Gyro Hands on his arms, the spinner in slot 1 with the D cell in it, the gyro tray in slot 3 with
     Controller 2 in its holder the right way up, the gyro holder in slot 5, and each gyro in the
     holder or spinning on a tray cap; Stack-Up, the Block Hands on his arms, the five trays in the
     base's slots, and the five blocks stacked on the middle tray (slot 3) in the booklet's order
     (BLOCK_ORDER, top to bottom: red on top, green at the bottom). done: in its place now. */
  function goals() {
    const out = [];
    const name = p => { const s = label(p).replace(/^the /, ''); return s.charAt(0).toUpperCase() + s.slice(1); };
    const slotWords = (p, k) => p.acc.slots === 2 ? `in slots ${k} and ${k - 1} of his base` : `in slot ${k} of his base`;
    const add = (p, where, done) => out.push({ id: p.id, name: name(p), where, done: !!done && !p.held });
    const by = k => parts.filter(p => p.kind === k);
    const s = p => p.support;
    for (const p of by('hands')) add(p, "on R.O.B.'s arms", s(p).type === 'arms');
    if (setName === 'gyro') {
      for (const p of by('spinner')) add(p, slotWords(p, 1), s(p).type === 'slot' && s(p).slot === 1);
      for (const p of by('dcell')) add(p, "in the spinner's battery holder", s(p).type === 'bay');
      for (const p of by('gyrotray')) add(p, slotWords(p, 3), s(p).type === 'slot' && s(p).slot === 3);
      for (const p of by('pad2')) add(p, "in the gyro tray's holder, the right way up", s(p).type === 'holder' && !p.upsideDown);
      for (const p of by('holder')) add(p, slotWords(p, 5), s(p).type === 'slot' && s(p).slot === 5);
      for (const p of by('gyro')) add(p, 'in the gyro holder, or spinning on a tray cap', (s(p).type === 'cup' || s(p).type === 'cap') && !p.fallen);
    } else if (setName === 'block') {
      for (const p of by('blocktray')) add(p, 'in any slot of his base', s(p).type === 'slot');
      const want = BLOCK_ORDER.slice().reverse();   // bottom to top
      const st = stacks()[3] || [];
      const tray3 = parts.find(p => p.kind === 'blocktray' && p.support.type === 'slot' && p.support.slot === 3);
      const free = !tray3 ? ' (put a tray in slot 3 first)' : '';
      want.forEach((c, i) => { const p = parts.find(q => q.kind === 'block' && q.colour === c); if (!p) return;
        const where = i === 0 ? 'at the bottom, on the tray in slot 3' + free : (i === want.length - 1 ? `on top, on the ${want[i - 1]} block` : `on the ${want[i - 1]} block`);
        add(p, where, st.length > i && want.slice(0, i + 1).every((x, j) => st[j] === x)); });
    }
    return out;
  }
  function state() {
    const lv = levers();
    return { set: setName, setup: setupOn, cursor: cursor ? cursor.phase : null, dragging: !!drag, held: heldPart ? heldPart.id : null,
      pad2: (lv.A ? 1 : 0) | (lv.B ? 2 : 0), levers: lv, hands: getHands(),
      parts: parts.map(p => ({ id: p.id, kind: p.kind, where: where(p), support: p.support.type, target: p.support.target || p.support.slot || null, spin: +p.spin.toFixed(2), fallen: p.fallen, pos: p.obj.getWorldPosition(V3()).toArray().map(v => +(v * 1000).toFixed(1)), rot: (() => { const e = new THREE.Euler().setFromQuaternion(p.obj.getWorldQuaternion(new THREE.Quaternion()), 'YXZ'); return [e.x, e.y, e.z].map(v => +(v * 180 / Math.PI).toFixed(2)); })(), colour: p.colour, upsideDown: p.upsideDown, on: p.on })),
      stacks: setName === 'block' ? stacks() : null, inBox: parts.filter(p => p.support.type === 'box').length, grip: gripWorld().toArray().map(v => +(v * 1000).toFixed(1)) };
  }
  /* scripted placing for the proofs: target by id ('slot3', 'holder.cup0', 'gyrotray.capA', 'tray3.ring', 'block_red.peg', 'table0', 'box', 'arms') */
  function place(id, targetId) {
    const p = parts.find(q => q.id === id); if (!p) return 'no part ' + id;
    const t = targets().find(x => x.id === targetId); if (!t) return 'no target ' + targetId;
    if (!t.accepts(p) || (t.occupant && t.occupant !== p)) return 'not allowed: ' + targetId;
    takeOff(p); placeOn(p, t); return 'ok';
  }
  function applyUrl(search) {
    const q = new URLSearchParams(search);
    if (q.get('set')) setSet(q.get('set'));
    if (q.get('setup') === '1') setup(true);
    if (q.get('ghosts') === '0') ghostsOn = false;
  }
  function toScreen(w) { const r = dom.getBoundingClientRect(); const v = w.clone().project(camera); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, visible: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 }; }
  function setSet(name) { if (!['none', 'gyro', 'block'].includes(name)) return; buildSet(name); if (!load()) layoutBox(); if (heldPart) { heldPart = null; armsMin = 0; } notify(); }

  return {
    setSet, get set() { return setName; }, boxAway, get boxGone() { return boxK; }, goals, setup, get inSetup() { return setupOn; }, key, update, clampArms, reset, standGyros, place, state, targets: () => targets().map(t => ({ id: t.id, type: t.type, pos: t.pos.toArray().map(v => +(v * 1000).toFixed(1)), occupied: !!t.occupant })),
    legalTargets: id => { const p = parts.find(q => q.id === id); return p ? legalTargets(p).map(t => t.id) : []; },
    turn: id => { const p = parts.find(q => q.id === id); if (p) turn(p); }, spin: (id, v) => { const p = parts.find(q => q.id === id); if (p) p.spin = v; },
    onChange: f => listeners.push(f), applyUrl, ghosts: on => { ghostsOn = !!on; }, pad2: () => { const lv = levers(); return (lv.A ? 1 : 0) | (lv.B ? 2 : 0); }, group, EX,
    cursorStart, get cursor() { return cursor; }, label: id => { const p = parts.find(q => q.id === id); return p ? label(p) : id; },
    /* client-pixel positions for scripted pointer tests: a part's grab point, a target's spot */
    screenOf: id => { const p = parts.find(q => q.id === id); if (!p) return null;
      const cands = [];
      const lw = l => p.obj.localToWorld(l.clone());
      if (p.kind === 'gyro') cands.push(lw(V3(0, p.acc.disc_top * MM, 0)), lw(V3(p.acc.disc_r * MM * 0.5, p.acc.disc_top * MM, 0)));
      else if (p.kind === 'block') cands.push(lw(V3(0, p.acc.h * MM, 0)), lw(V3(0, p.acc.h * MM / 2, p.acc.r * MM)));
      else if (p.kind === 'spinner') cands.push(lw(polarLocal(D.R_work, 0, p.acc.drum_top)), lw(polarLocal(D.R_work, 0, 15)));
      else if (p.kind === 'gyrotray') { for (const lv of Object.values(p.acc.levers)) cands.push(lw(polarLocal(lv.r, lv.deg, lv.cap_top))); cands.push(lw(V3(p.acc.holder.x * MM, p.acc.holder.top * MM, -p.acc.holder.y * MM))); }
      else if (p.kind === 'holder') for (const c of p.acc.cups) cands.push(lw(polarLocal(c.r, c.deg, c.floor - 8)), lw(polarLocal(c.r + 9, c.deg, c.floor / 2)));
      else if (p.kind === 'blocktray') { const r = p.acc.ring; cands.push(lw(polarLocal(r.r, r.deg, r.floor)), lw(polarLocal(r.r - r.r_in - 1, r.deg, r.rim))); }
      else if (p.kind === 'pad2') cands.push(lw(V3(0, p.acc.h * MM / 2, p.acc.t * MM / 2)), lw(V3(0, p.acc.h * MM / 2, -p.acc.t * MM / 2)));
      else if (p.kind === 'dcell') cands.push(lw(V3(0, p.acc.d * MM, 0)));
      else cands.push(lw(V3(0, 0.02, 0)), lw(V3(0.024, 0.02, 0)));
      const meshes = meshesOf(p.obj);
      for (const w of cands) { const sp = toScreen(w); if (!sp.visible) continue; const r = dom.getBoundingClientRect(); ndc.set(((sp.x - r.left) / r.width) * 2 - 1, -((sp.y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(pickables(), false)[0]; if (hit && meshes.includes(hit.object)) return sp; }
      return Object.assign(toScreen(cands[0]), { visible: false, hidden: true }); },
    screenOfTarget: tid => { const t = targets().find(x => x.id === tid); return t ? toScreen(t.pos) : null; },
    setSetQuiet: name => { buildSet(name); layoutBox(); },
    _dbg: () => ({ grip: gripWorld().toArray(), held: heldPart && heldPart.id, heldPos: heldPart && heldPart.obj.getWorldPosition(V3()).toArray(), lastPose, armsMin }),
  };
}
