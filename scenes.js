/* Hookd prototype: 3D stage and stitch animations.
   Every stitch is a list of steps. Each step is a list of tweens over a flat state object;
   a scene's draw function turns that state into yarn strands (tubes) each frame.
   Shapes are schematic and positioned by hand. They have not been checked against real crochet. */
(function () {
  'use strict';
  const PI = Math.PI, DEG = PI / 180, SP = 0.55, YARN = 0.055, RR = 0.14;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const mix = (a, b, k) => typeof a === 'number' ? a + (b - a) * k : [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const norm = a => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = k => k * k * (3 - 2 * k);
  const clone = o => { const r = {}; for (const k in o) r[k] = Array.isArray(o[k]) ? o[k].slice() : o[k]; return r; };

  /* Hook axis: from the tip toward the handle. The hook comes in from the front right. */
  const D0 = norm([0.5, 0.15, 0.85]);
  const HV = norm(add([0, 1, 0], mul(D0, -D0[1])));      // "up" across the shaft
  const HS = mul(cross(D0, HV), -1);                      // side of the shaft facing the work
  const ring = (s, slot, deg, rr) => {
    const c = add(s.tip, mul(D0, slot));
    return add(c, add(mul(HS, Math.cos(deg * DEG) * rr), mul(HV, Math.sin(deg * DEG) * rr)));
  };
  /* A loop on the hook: a teardrop from its base in the fabric up around the shaft. */
  function loopPts(s, slot, base) {
    const rr = slot > 0 ? RR : RR * Math.max(0.35, 1 + slot * 2.2);
    return [add(base, mul(HS, 0.03)), ring(s, slot, -50, rr), ring(s, slot, 20, rr), ring(s, slot, 90, rr),
      ring(s, slot, 160, rr), ring(s, slot, 230, rr), add(base, mul(HS, -0.03))];
  }
  /* The working yarn. w wraps it over the hook (a yarn over); c closes that wrap into a loop. */
  function workPts(s, feed) {
    const a = s.wb, line = f => mix(a, feed, f), R = d => ring(s, s.ws, d, RR);
    const open5 = mix(R(160), feed, 0.33), open6 = mix(R(160), feed, 0.66);
    return [a,
      mix(line(1 / 7), R(-50), s.w), mix(line(2 / 7), R(20), s.w), mix(line(3 / 7), R(90), s.w), mix(line(4 / 7), R(160), s.w),
      mix(line(5 / 7), mix(open5, R(230), s.c), s.w), mix(line(6 / 7), mix(open6, add(a, mul(HS, -0.05)), s.c), s.w), feed];
  }
  /* The top of a stitch: a flat link, the "V" you count. */
  function link(c, ax, bx, k = 1) {
    const p = [];
    for (let i = 0; i < 6; i++) {
      const t = i * 60 * DEG;
      p.push(add(c, add(mul(ax, Math.cos(t) * 0.36 * k), mul(bx, Math.sin(t) * 0.15 * k))));
    }
    return p;
  }
  const rowLink = (x, y, k) => link([x, y, 0], [1, 0.06, 0], [0, 0, 1], k);

  /* ---------- step compiler ---------- */
  function compile(def) {
    let s = clone(def.init);
    for (const st of def.steps) {
      if (st.pre) Object.assign(s, clone(st.pre));
      st.start = clone(s);
      st.dur = st.tw.reduce((n, t) => n + t[0], 0) || 1;
      for (const [, to] of st.tw) {
        for (const k in to) if (!(k in s)) console.warn('Hookd: unknown state key', k);
        Object.assign(s, clone(to));
      }
    }
    return def;
  }
  function stateAt(def, i, t) {
    const st = def.steps[i], s = clone(st.start), T = clamp(t) * st.dur;
    let acc = 0;
    for (const [d, to] of st.tw) {
      if (d === 0) { if (T >= acc) { Object.assign(s, clone(to)); continue; } break; }
      if (T >= acc + d) { Object.assign(s, clone(to)); acc += d; continue; }
      if (T > acc) { const k = ease((T - acc) / d); for (const key in to) s[key] = mix(s[key], to[key], k); }
      break;
    }
    return s;
  }
  const loopsOn = s => s.hookOn > 0.5 ? [0, 1, 2].filter(i => s['l' + i + 'o'] > 0.5).length : 0;
  const loopState = { l0s: 0.75, l0b: [0, 0, 0], l0o: 0, l1s: 0.5, l1b: [0, 0, 0], l1o: 0, l2s: 0.5, l2b: [0, 0, 0], l2o: 0 };
  const hookState = { tip: [0, 0, 0], roll: PI, hookOn: 1, w: 0, c: 0, ws: 0.16, wb: [0, 0, 0], ar: 0, tg: 0, tp: [0, 0, 0], spin: 0 };
  function hookStrands(s, out, feed, work) {
    for (let i = 0; i < 3; i++) {
      const o = s['l' + i + 'o'];
      if (o > 0.02) out.push({ p: loopPts(s, s['l' + i + 's'], s['l' + i + 'b']), c: 'a', r: o });
    }
    if (work) out.push({ p: workPts(s, feed), c: 'a' });
  }

  /* ---------- rows: chain, single crochet, double crochet, slip stitch ---------- */
  function rowDef(kind) {
    const H = { sc: 0.55, dc: 1.3, sl: 0.18, ch: 0 }[kind], chain = kind === 'ch';
    const Bl = chain ? [SP * 0.5, 0, 0] : [SP, H, 0], s0 = kind === 'dc' ? 0.95 : 0.75;
    const R = add(add(Bl, [-0.35, 0.4, 0.2]), mul(D0, -s0)), Rn = add(R, [-SP, 0, 0]);
    const T = [0, -0.13, 0], A = add(T, mul(D0, 0.55)), I = add(T, mul(D0, -0.5));
    const U = [-0.2, H * 0.6 + 0.4, -0.2], top = [0, H, 0], z = [0, 0, 0];
    const feed = [-1.9, H + 1.6, -0.9];
    const init = Object.assign({}, hookState, loopState, { tip: R, l0s: s0, l0b: Bl, l0o: 1, wb: Bl, g: 0 });
    const yo = more => [1, Object.assign({ w: 1, roll: PI, ar: 1 }, more)];
    const insert = [[1, { tip: A, roll: 1.4 }], [1, { tip: I }]];
    const txt = {
      insert: 'Push the hook under both loops of the next stitch, from front to back. Gold marks the spot.',
      yo: 'Bring the yarn over the hook from back to front. The arrow shows the direction.',
      next: 'The gold mark shows where the next stitch goes.'
    };
    let steps;
    if (kind === 'ch') {
      const nb = [-SP * 0.5, 0, 0];
      steps = [
        { title: 'Start with a loop on the hook', text: 'This is the loop from your slip knot. It never counts as a stitch.', tw: [[1, { roll: 2.2 }], [1, { roll: PI }]] },
        { title: 'Yarn over', text: txt.yo, tw: [yo()] },
        { title: 'Pull through the loop', text: 'Draw the yarn through the loop that is on the hook. The old loop slides off and becomes a chain.',
          tw: [[1, { tip: add(R, mul(D0, 0.5)), l0s: -0.3, c: 1, wb: nb, ar: 0 }], [0.5, { l0o: 0, g: 1 }], [0, { l0s: 0.16, l0b: nb, l0o: 1, w: 0, c: 0 }], [0.7, { l0s: s0, tip: Rn }]] },
        { title: 'One chain made', text: 'Each chain looks like a V. Repeat steps 2 and 3 for every chain your pattern asks for. Count the Vs, not the loop on the hook.', tw: [[1, { roll: 2.6 }], [1, { roll: PI }]] }
      ];
    } else if (kind === 'sc') {
      steps = [
        { title: 'Insert the hook', text: txt.insert, label: 'Insert here: under both loops', pre: { tg: 1 }, tw: insert },
        { title: 'Yarn over', text: txt.yo, tw: [yo({ tg: 0 })] },
        { title: 'Pull up a loop', text: 'Draw the yarn back through the stitch. You now have 2 loops on the hook.',
          tw: [[1.2, { tip: U, c: 1, wb: z, ar: 0 }], [0, { l1s: 0.16, l1b: z, l1o: 1, w: 0, c: 0 }], [0.6, { l1s: 0.45 }]] },
        { title: 'Yarn over again', text: txt.yo, tw: [yo()] },
        { title: 'Pull through both loops', text: 'Draw the yarn through both loops in one motion. 1 loop stays on the hook.',
          tw: [[1, { tip: add(U, mul(D0, 0.5)), l0s: -0.3, l1s: -0.3, c: 1, wb: top, ar: 0 }], [0.5, { l0o: 0, l1o: 0, g: 1 }], [0, { l0s: 0.16, l0b: top, l0o: 1, w: 0, c: 0 }], [0.7, { l0s: s0, tip: Rn }]] },
        { title: 'One {sc} made', text: txt.next, label: 'Next stitch goes here', pre: { tp: [-SP, 0, 0] }, tw: [[1, { tg: 1 }]] }
      ];
    } else if (kind === 'dc') {
      const mid = [0, H * 0.55, 0];
      steps = [
        { title: 'Yarn over first', text: 'Before you insert the hook, wrap the yarn over it once. This wrap counts as a loop: 2 loops on the hook.',
          tw: [yo(), [0.5, { c: 1, ar: 0 }], [0, { l1s: 0.16, l1b: Bl, l1o: 1, w: 0, c: 0 }], [0.5, { l1s: 0.7 }]] },
        { title: 'Insert the hook', text: txt.insert, label: 'Insert here: under both loops', pre: { tg: 1 }, tw: insert },
        { title: 'Yarn over', text: txt.yo, tw: [yo({ tg: 0 })] },
        { title: 'Pull up a loop', text: 'Draw the yarn back through the stitch. You now have 3 loops on the hook.',
          tw: [[1.2, { tip: U, c: 1, wb: z, ar: 0 }], [0, { l2s: 0.16, l2b: z, l2o: 1, w: 0, c: 0 }], [0.6, { l2s: 0.45 }]] },
        { title: 'Yarn over', text: txt.yo, tw: [yo()] },
        { title: 'Pull through 2 loops', text: 'Draw the yarn through the first 2 loops only. 2 loops stay on the hook.',
          tw: [[1, { tip: add(U, mul(D0, 0.3)), l2s: -0.3, l1s: -0.3, l0s: 0.75, c: 1, wb: mid, ar: 0 }], [0.5, { l2o: 0, l1o: 0, g: 0.5 }], [0, { l1s: 0.16, l1b: mid, l1o: 1, w: 0, c: 0 }], [0.6, { l1s: 0.45, tip: U }]] },
        { title: 'Yarn over', text: txt.yo, tw: [yo()] },
        { title: 'Pull through the last 2 loops', text: 'Draw the yarn through both remaining loops. 1 loop stays on the hook.',
          tw: [[1, { tip: add(U, mul(D0, 0.5)), l1s: -0.3, l0s: -0.3, c: 1, wb: top, ar: 0 }], [0.5, { l1o: 0, l0o: 0, g: 1 }], [0, { l0s: 0.16, l0b: top, l0o: 1, w: 0, c: 0 }], [0.7, { l0s: s0, tip: Rn }]] },
        { title: 'One {dc} made', text: txt.next, label: 'Next stitch goes here', pre: { tp: [-SP, 0, 0] }, tw: [[1, { tg: 1 }]] }
      ];
    } else {
      steps = [
        { title: 'Insert the hook', text: txt.insert, label: 'Insert here: under both loops', pre: { tg: 1 }, tw: insert },
        { title: 'Yarn over', text: txt.yo, tw: [yo({ tg: 0 })] },
        { title: 'Pull through everything', text: 'Draw the yarn through the stitch and through the loop on the hook in one motion. A {sl} adds almost no height.',
          tw: [[1.2, { tip: U, c: 1, wb: top, l0s: -0.3, ar: 0 }], [0.4, { l0o: 0, g: 1 }], [0, { l0s: 0.16, l0b: top, l0o: 1, w: 0, c: 0 }], [0.6, { l0s: s0, tip: Rn }]] },
        { title: 'One {sl} made', text: txt.next, label: 'Next stitch goes here', pre: { tp: [-SP, 0, 0] }, tw: [[1, { tg: 1 }]] }
      ];
    }
    function stitch(out, x, g) {
      if (g <= 0.01) return;
      if (kind === 'sc') {
        for (const sd of [-1, 1]) out.push({ p: [[x, 0.05, 0.07], [x + sd * 0.05, H * 0.5, 0.1], [x + sd * 0.13, H - 0.03, 0.03]], c: 'a', u: clamp(g * 1.5) });
      } else if (kind === 'dc') {
        for (const ph of [0, PI]) {
          const p = [];
          for (let i = 0; i <= 5; i++) { const a = ph + i * 1.5; p.push([x + Math.cos(a) * 0.06, 0.05 + (H - 0.08) * i / 5, 0.03 + Math.sin(a) * 0.06]); }
          out.push({ p, c: 'a', u: clamp(g) });
        }
      }
      const k = kind === 'dc' ? clamp((g - 0.8) / 0.2) : clamp((g - 0.5) / 0.5);
      if (k > 0.02) out.push({ p: rowLink(x, H, k), c: 'a', closed: true, r: k });
    }
    function draw(s) {
      const out = [];
      if (chain) {
        for (let k = 1; k <= 3; k++) out.push({ p: rowLink(SP * k, -0.035 * k * k, 1), c: 'a', closed: true });
        out.push({ p: link([SP * 4 - 0.05, -0.6, 0], [0.5, -0.3, 0], [0, 0, 1], 0.6), c: 'a', closed: true, r: 1.5 });
        out.push({ p: [[SP * 4, -0.7, 0], [SP * 4 + 0.2, -1.1, 0.05], [SP * 4 + 0.1, -1.6, 0.1]], c: 'a' });
        if (s.g > 0.02) out.push({ p: rowLink(0, 0, s.g), c: 'a', closed: true, r: s.g });
      } else {
        for (let k = -3; k <= 2; k++) out.push({ p: rowLink(SP * k, 0, 1), c: 'b', closed: true });
        stitch(out, SP, 1); stitch(out, SP * 2, 1); stitch(out, 0, s.g);
      }
      hookStrands(s, out, feed, true);
      return out;
    }
    return compile({ init, steps, draw, counter: s => 'Loops on hook: ' + loopsOn(s),
      cam: chain ? { az: -24, el: 34, dist: 5.2, tgt: [0.35, 0.05, 0] } : { az: -30, el: 22, dist: 5.4, tgt: [-0.1, H * 0.45 + 0.25, 0] }, floor: -0.75 });
  }

  /* ---------- slip knot ---------- */
  function knotDef() {
    const C = [-0.1, 0.85, 0], Kc = [-0.05, 0.6, 0], back = [0.02, 0.78, -0.27];
    const S0 = [[-1.8, 0.1, 0], [-1.35, 0.05, 0], [-0.9, 0.1, 0], [-0.45, 0.05, 0], [0, 0.1, 0], [0.45, 0.05, 0], [0.9, 0.1, 0], [1.35, 0.05, 0], [1.8, 0.1, 0]];
    const S1 = [[-1.7, -0.5, 0.05], [-0.7, -0.25, 0.05], [0.3, 0.3, 0.08], [0.35, 0.95, 0.04], [-0.1, 1.25, 0], [-0.55, 0.95, -0.04], [-0.5, 0.35, -0.1], [0.0, 0.76, -0.28], [1.7, 1.0, -0.35]];
    const S2 = S1.map((p, i) => i === 0 ? [-1.3, -0.7, 0.05] : i === 8 ? [1.6, 1.25, -0.4] : i === 1 ? [-0.55, 0.05, 0.05] : mix(Kc, p, 0.24));
    const in1 = add(C, mul(D0, -0.55));
    const init = Object.assign({}, hookState, loopState, { m: 0, k: 0, hookOn: 0, tip: add(C, mul(D0, 0.9)), l0s: 0.16, l0b: back, tp: C });
    const steps = [
      { title: 'Make a loop', text: 'About 15 cm from the end, cross the yarn over itself to make a loop. Let the long strand from the ball rest behind the loop.', tw: [[1.6, { m: 1 }]] },
      { title: 'Put the hook through the loop', text: 'Go in from the front, straight through the middle.', label: 'Hook goes through here',
        tw: [[0.6, { hookOn: 1, tg: 1 }], [1.2, { tip: in1, roll: 1.4 }]] },
      { title: 'Catch the yarn from the ball', text: 'Hook the long strand, the one that leads to the ball. The short tail stays where it is.', label: 'Catch this strand',
        pre: { tp: back }, tw: [[1, { roll: PI, tip: add(in1, [0.1, -0.1, 0]) }]] },
      { title: 'Pull it through', text: 'Draw that strand back through the loop. You now have a new loop on the hook.',
        tw: [[0.3, { l0o: 1, tg: 0 }], [1.2, { tip: add(C, add(mul(D0, 0.25), [0, 0.2, 0])) }]] },
      { title: 'Tighten', text: 'Pull both ends gently so the knot slides up to the hook. Keep it loose enough to move freely along the hook.',
        tw: [[1.4, { k: 1, l0b: Kc, l0s: 0.7, tip: add(add(Kc, [-0.35, 0.4, 0.2]), mul(D0, -0.7)) }]] }
    ];
    function draw(s) {
      const out = [{ p: S0.map((p, i) => mix(mix(p, S1[i], s.m), S2[i], s.k)), c: 'a' }];
      hookStrands(s, out, null, false);
      return out;
    }
    return compile({ init, steps, draw, counter: s => 'Loops on hook: ' + loopsOn(s), cam: { az: -14, el: 12, dist: 6.4, tgt: [0, 0.55, 0] }, floor: -1 });
  }

  /* ---------- work in a ring: magic ring and the five-petal flower ---------- */
  const rp = (deg, r, z = 0) => [Math.cos(deg * DEG) * r, Math.sin(deg * DEG) * r, z];
  const FEED = [-1.9, 1.9, -0.9];
  const ringState = Object.assign({}, hookState, loopState, { R: 0.6, rg: 1, tl: 0, cut: 0, ba: 110, br: 0, dip: 0, ms: 0, g0: 0, p0: 0, p1: 0, p2: 0, p3: 0, p4: 0 });
  function drawRing(s, flower) {
    const out = [], R = s.R, pts = [];
    for (let i = 0; i <= 12; i++) pts.push(rp(250 + i * 30, R, i % 2 ? 0.02 : -0.02));
    out.push({ p: pts, c: 'b', u: s.rg });
    const t0 = rp(250, R);
    out.push({ p: [t0, add(t0, [-0.25 - 0.2 * s.tl, -0.3 - 0.3 * s.tl, 0.08]), add(t0, [-0.5 - 0.5 * s.tl, -0.75 - 0.6 * s.tl, 0.12])], c: 'b' });
    const base = rp(s.ba, R + s.br, 0.05);
    s.l0b = base; s.wb = base;
    s.tip = mix(add(add(base, [-0.3, 0.35, 0.25]), mul(D0, -0.75)), mul(D0, -0.5), s.dip);
    if (flower) {
      for (let k = 0; k < 5; k++) {
        const p = s['p' + k], th = 90 + 72 * k;
        if (p <= 0.01) continue;
        const o = [[-24, 0], [-23, 0.4], [-20, 0.75], [-8, 0.92], [8, 0.92], [22, 0.75], [30, 0.4], [36, 0]].map(q => rp(th + q[0], R + q[1], 0.04));
        const u = p < 1 ? p * 2 / 7 : p < 3 ? (2 + (p - 1)) / 7 : (4 + (p - 3) * 3) / 7;
        out.push({ p: o, c: 'a', u: clamp(u) });
        for (const [a, from] of [[-8, 1], [8, 2]]) {
          const g = clamp(p - from);
          if (g > 0.02) out.push({ p: [rp(th + a, R, 0.06), rp(th + a - 3, R + 0.45, 0.1), rp(th + a, R + 0.9, 0.06)], c: 'a', u: g });
        }
      }
    } else {
      if (s.g0 > 0.02) { const c = rp(110, R + 0.2, 0.05); out.push({ p: link(c, norm(c), [0.94, 0.34, 0], 0.55 * s.g0), c: 'a', closed: true, r: s.g0 }); }
      for (let k = 0; k < 5; k++) {
        const g = clamp(s.ms - k), a = 160 + 62 * k;
        if (g <= 0.02) continue;
        out.push({ p: [rp(a, R, 0.05), rp(a + 4, R + 0.22, 0.09), rp(a, R + 0.42, 0.05)], c: 'a', u: g });
        const c = rp(a, R + 0.45, 0.05), rad = norm(c);
        if (g > 0.5) out.push({ p: link(c, [-rad[1], rad[0], 0], rad, 0.7 * g), c: 'a', closed: true, r: g });
      }
    }
    hookStrands(s, out, mix(FEED, add(base, [0.45, -0.5, 0.1]), s.cut), true);
    return out;
  }
  function magicDef() {
    const yo = more => [1, Object.assign({ w: 1, roll: PI, ar: 1 }, more)];
    const tw7 = [];
    for (let k = 0; k < 5; k++) tw7.push([0.4, { dip: 1 }], [0.5, { dip: 0, ms: k + 1, ba: 160 + 62 * k + 40, br: 0.42 }]);
    const steps = [
      { title: 'Make the ring', text: 'Wrap the yarn into a ring, crossing the long strand over the short tail. Hold the crossing between your fingers.', tw: [[1.5, { rg: 1 }], [0.6, { hookOn: 1 }]] },
      { title: 'Insert the hook into the ring', text: 'Go through the middle of the ring, front to back.', label: 'Insert here: into the ring', pre: { tg: 1 }, tw: [[1.2, { dip: 1, roll: 1.4 }]] },
      { title: 'Yarn over', text: 'Bring the yarn over the hook from back to front.', tw: [yo({ tg: 0 })] },
      { title: 'Pull up a loop', text: 'Draw the yarn back through the ring. 1 loop on the hook.', tw: [[1.2, { dip: 0, c: 1, ar: 0 }], [0, { l0s: 0.16, l0o: 1, w: 0, c: 0 }], [0.6, { l0s: 0.75 }]] },
      { title: 'Yarn over', text: 'Wrap the yarn over the hook again.', tw: [yo()] },
      { title: 'Pull through: chain 1', text: 'Draw the yarn through the loop on the hook. This chain locks the ring so it cannot come undone.',
        tw: [[1, { l0s: -0.3, c: 1, br: 0.4, ar: 0 }], [0.4, { l0o: 0, g0: 1 }], [0, { l0s: 0.16, l0o: 1, w: 0, c: 0 }], [0.6, { l0s: 0.75 }]] },
      { title: 'Work your stitches into the ring', text: 'Every stitch of the first round goes into the middle of the ring, over both the ring and the tail. Here: 5 {sc}.', label: 'Each stitch goes in here', pre: { tg: 1 }, tw: tw7 },
      { title: 'Pull the tail to close', text: 'Pull the short tail. The ring closes and the stitches gather into a tight circle with no hole.', tw: [[0.4, { tg: 0 }], [1.6, { R: 0.22, tl: 1 }]] }
    ];
    return compile({ init: Object.assign({}, ringState, { rg: 0.04, hookOn: 0 }), steps, draw: s => drawRing(s, false),
      counter: s => 'Loops on hook: ' + loopsOn(s), cam: { az: -14, el: 8, dist: 6.2, tgt: [-0.1, 0.25, 0] }, floor: -1.9 });
  }
  function flowerDef() {
    const th = k => 90 + 72 * k, tw6 = [];
    for (let k = 1; k < 5; k++) {
      const p = 'p' + k;
      tw6.push([0.4, { [p]: 1, ba: th(k) - 20, br: 0.75 }], [0.25, { dip: 1 }], [0.35, { dip: 0, [p]: 3, ba: th(k) + 8, br: 0.92 }],
        [0.3, { [p]: 3.6, ba: th(k) + 26, br: 0.45 }], [0.25, { dip: 1 }], [0.25, { dip: 0, [p]: 4, ba: th(k) + 36, br: 0.12 }]);
    }
    const into = 'Insert here: into the ring';
    const steps = [
      { title: 'Start with a magic ring', text: 'Make a magic ring and chain 1 to lock it. Every stitch of this flower goes into the middle of the ring.', label: 'All stitches go in here', tw: [[1, { tg: 1 }], [1, { tg: 0 }]] },
      { title: 'Chain 2', text: 'Two chains make the first side of the petal.', tw: [[1.4, { p0: 1, ba: th(0) - 20, br: 0.75 }]] },
      { title: '2 {dc} into the ring', text: 'Work 2 {dc} stitches, both into the middle of the ring. They form the tall centre of the petal.', label: into, pre: { tg: 1 },
        tw: [[0.6, { dip: 1 }], [0.7, { dip: 0, p0: 2, ba: th(0) - 8, br: 0.92 }], [0.6, { dip: 1 }], [0.7, { dip: 0, p0: 3, ba: th(0) + 8 }]] },
      { title: 'Chain 2', text: 'Two more chains bring you back down the other side of the petal.', tw: [[1.2, { p0: 3.6, ba: th(0) + 26, br: 0.45, tg: 0 }]] },
      { title: '{Sl} into the ring', text: 'A {sl} into the ring pins the petal down. Petal 1 is done.', label: into, pre: { tg: 1 }, tw: [[0.7, { dip: 1 }], [0.7, { dip: 0, p0: 4, ba: th(0) + 36, br: 0.12 }]] },
      { title: 'Make 4 more petals', text: 'Repeat the last four steps four more times: chain 2, 2 {dc} into the ring, chain 2, {sl} into the ring.', label: into, tw: tw6 },
      { title: 'Pull the tail to close the ring', text: 'Pull the short tail until the hole in the middle disappears and the petals sit side by side.', tw: [[0.3, { tg: 0 }], [1.7, { R: 0.17, tl: 1 }]] },
      { title: 'Fasten off', text: 'Cut the yarn about 10 cm from the hook. Yarn over and pull the cut end all the way through the loop.', tw: [[1, { cut: 1 }], [0.8, { l0o: 0 }], [0.6, { hookOn: 0 }]] },
      { title: 'Weave in the ends', text: 'Thread each tail onto a yarn needle and run it through the back of the stitches. Your flower is finished.', tw: [[3, { spin: 1 }]] }
    ];
    return compile({ init: Object.assign({}, ringState, { R: 0.5, l0o: 1, ba: 66, br: 0.15 }), steps, draw: s => drawRing(s, true),
      counter: s => 'Petals: ' + [0, 1, 2, 3, 4].filter(k => s['p' + k] >= 4).length + ' of 5',
      cam: { az: -10, el: 6, dist: 7.2, tgt: [0, 0.1, 0] }, floor: -1.9 });
  }

  const defs = {};
  const makers = { knot: knotDef, chain: () => rowDef('ch'), sc: () => rowDef('sc'), dc: () => rowDef('dc'), sl: () => rowDef('sl'), magic: magicDef, flower: flowerDef };
  const getDef = name => defs[name] || (defs[name] = makers[name]());

  /* ---------- rendering ---------- */
  const LOOKS = {
    flat:      { a: '#2F6BFF', b: '#9DB8FF', hook: '#8A8FB8', fat: 1, amb: 0.9, sun: 0.35 },
    realistic: { a: '#2C8C7A', b: '#B9D8C8', hook: '#C9CCD6', fat: 1, amb: 0.55, sun: 0.95 },
    clay:      { a: '#8C9BF0', b: '#CDB9F3', hook: '#DDB980', fat: 1.3, amb: 0.75, sun: 0.6 }
  };
  function tubeGeo(S, Rd) {
    const n = (S + 1) * (Rd + 1), g = new THREE.BufferGeometry(), idx = [];
    for (let i = 0; i < S; i++) for (let j = 0; j < Rd; j++) { const a = i * (Rd + 1) + j, b = a + Rd + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    g.userData = { S, Rd };
    return g;
  }
  function fillTube(g, pts, rad, uEnd, closed) {
    const { S, Rd } = g.userData, V = THREE.Vector3;
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new V(p[0], p[1], p[2])), !!closed, 'centripetal');
    const P = []; for (let i = 0; i <= S; i++) P.push(curve.getPoint(uEnd * i / S));
    const pos = g.attributes.position.array, nor = g.attributes.normal.array, uv = g.attributes.uv.array;
    const T = new V(1, 0, 0), N = new V(), B = new V(), tmp = new V();
    let has = false, len = 0, o = 0, q = 0;
    for (let i = 0; i <= S; i++) {
      tmp.subVectors(P[Math.min(i + 1, S)], P[Math.max(i - 1, 0)]);
      if (tmp.lengthSq() > 1e-12) T.copy(tmp).normalize();
      if (!has) { N.crossVectors(T, Math.abs(T.y) < 0.9 ? new V(0, 1, 0) : new V(1, 0, 0)).normalize(); has = true; }
      else { N.addScaledVector(T, -N.dot(T)); if (N.lengthSq() < 1e-10) N.set(0, 0, 1); N.normalize(); }
      B.crossVectors(T, N);
      if (i) len += P[i].distanceTo(P[i - 1]);
      const e = Math.min(i, S - i);
      const r = (typeof rad === 'function' ? rad(P[i]) : rad) * (closed ? 1 : e === 0 ? 0.2 : e === 1 ? 0.8 : 1);
      for (let j = 0; j <= Rd; j++) {
        const a = j / Rd * PI * 2, cs = Math.cos(a), sn = Math.sin(a);
        const nx = cs * N.x + sn * B.x, ny = cs * N.y + sn * B.y, nz = cs * N.z + sn * B.z;
        pos[o] = P[i].x + nx * r; pos[o + 1] = P[i].y + ny * r; pos[o + 2] = P[i].z + nz * r;
        nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz; o += 3;
        uv[q++] = len * 5; uv[q++] = j / Rd;
      }
    }
    g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = g.attributes.uv.needsUpdate = true;
  }
  function plyTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = '#9a9a9a'; x.lineWidth = 7;
    for (let i = -64; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }

  class Stage {
    constructor(el, canvas, def) {
      this.el = el; this.def = def; this.left = false; this.state = null; this.label = '';
      const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(34, 4 / 3, 0.1, 60);
      this.root = new THREE.Group(); this.scene.add(this.root);
      this.amb = new THREE.HemisphereLight(0xffffff, 0xb8b4d0, 0.8); this.scene.add(this.amb);
      this.sun = new THREE.DirectionalLight(0xffffff, 0.6); this.sun.position.set(-2.5, 6, 4);
      this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
      Object.assign(this.sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 16 });
      this.sun.shadow.radius = 5; this.scene.add(this.sun);
      this.floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.16 }));
      this.floor.rotation.x = -PI / 2; this.floor.position.y = def.floor; this.floor.receiveShadow = true; this.scene.add(this.floor);
      this.pool = []; this.ply = plyTexture();
      /* hook: a tapered shaft that curls into a small crook at the tip */
      const hg = tubeGeo(90, 10);
      fillTube(hg, [[3.9, 0, 0], [3, 0, 0], [2.1, 0, 0], [1.9, 0, 0], [1, 0, 0], [0.4, 0, 0], [0.14, 0, 0], [-0.02, -0.05, 0], [-0.03, -0.15, 0], [0.05, -0.21, 0], [0.15, -0.2, 0]],
        p => p.y < -0.02 ? 0.045 : p.x > 2.05 ? 0.12 : p.x > 1.85 ? 0.07 + (p.x - 1.85) * 0.25 : 0.07, 1, false);
      this.hook = new THREE.Mesh(hg, new THREE.MeshStandardMaterial()); this.hook.castShadow = true; this.hook.frustumCulled = false;
      this.root.add(this.hook);
      const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...D0), new THREE.Vector3(...HV), new THREE.Vector3(...cross(D0, HV)));
      this.hookQ = new THREE.Quaternion().setFromRotationMatrix(m);
      /* gold target */
      const gold = new THREE.MeshBasicMaterial({ color: 0xF2B100, transparent: true, depthTest: false });
      this.target = new THREE.Group();
      this.target.add(new THREE.Mesh(new THREE.RingGeometry(0.15, 0.21, 40), gold), new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), gold));
      this.target.children.forEach(c => { c.renderOrder = 10; });
      this.goldMat = gold; this.root.add(this.target);
      /* wrap arrow */
      this.arrowMat = new THREE.MeshBasicMaterial({ color: 0x1D1A38, transparent: true });
      this.arrow = new THREE.Mesh(tubeGeo(24, 6), this.arrowMat); this.arrow.frustumCulled = false;
      this.arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 14), this.arrowMat);
      this.root.add(this.arrow, this.arrowHead);
      this.cam = Object.assign({}, def.cam); this.goal = Object.assign({}, def.cam);
      this.setLook('clay'); this.resize();
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el);
      this.bind(canvas);
    }
    mats(name) {
      const L = LOOKS[name], yarn = col => name === 'flat' ? new THREE.MeshLambertMaterial({ color: col })
        : new THREE.MeshStandardMaterial({ color: col, roughness: name === 'clay' ? 1 : 0.85, metalness: 0, map: name === 'realistic' ? this.ply : null, bumpMap: name === 'realistic' ? this.ply : null, bumpScale: 0.02 });
      const hook = name === 'flat' ? new THREE.MeshLambertMaterial({ color: L.hook, transparent: true, opacity: 0.45 })
        : name === 'realistic' ? new THREE.MeshPhongMaterial({ color: L.hook, shininess: 140, specular: 0xffffff })
        : new THREE.MeshStandardMaterial({ color: L.hook, roughness: 0.75 });
      return { a: yarn(L.a), b: yarn(L.b), hook };
    }
    setLook(name) {
      this.look = name; this.L = LOOKS[name]; this.m = this.mats(name);
      this.hook.material = this.m.hook; this.hook.castShadow = name !== 'flat';
      this.amb.intensity = this.L.amb; this.sun.intensity = this.L.sun;
      this.floor.visible = name !== 'flat';
      this.pool.forEach(mesh => { mesh.userData.c = null; });
      this.el.dataset.look = name;
      this.arrowMat.color.set(getComputedStyle(this.el).color);
      this.dirty = true;
    }
    setLeft(on) { this.left = on; this.root.scale.x = on ? -1 : 1; this.dirty = true; }
    setView(v) {
      const d = this.def.cam, k = this.left ? -1 : 1;
      const views = { front: { az: 0, el: 6 }, top: { az: 0, el: 80 }, side: { az: 78 * k, el: 10 }, back: { az: 180, el: 12 }, reset: { az: d.az * k, el: d.el, dist: d.dist } };
      Object.assign(this.goal, views[v]);
    }
    resize() {
      const w = this.el.clientWidth || 600, h = this.el.clientHeight || 450;
      this.renderer.setSize(w, h, false); this.camera.aspect = w / h;
      this.camera.fov = w / h < 1.1 ? 42 : 34; this.camera.updateProjectionMatrix(); this.dirty = true;
    }
    bind(canvas) {
      const pts = new Map(); let pinch = 0;
      const grab = () => { this.onGrab && this.onGrab(); };
      canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); pinch = 0; grab(); });
      canvas.addEventListener('pointermove', e => {
        const p = pts.get(e.pointerId); if (!p) return;
        if (pts.size === 1) {
          this.goal.az = this.cam.az = this.cam.az - (e.clientX - p[0]) * 0.45;
          this.goal.el = this.cam.el = clamp(this.cam.el + (e.clientY - p[1]) * 0.45, -85, 85);
        }
        p[0] = e.clientX; p[1] = e.clientY;
        if (pts.size === 2) {
          const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (pinch) this.goal.dist = this.cam.dist = clamp(this.cam.dist * pinch / d, 2.5, 13);
          pinch = d;
        }
      });
      const up = e => { pts.delete(e.pointerId); pinch = 0; };
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('wheel', e => { e.preventDefault(); this.goal.dist = clamp(this.goal.dist * (1 + Math.sign(e.deltaY) * 0.1), 2.5, 13); }, { passive: false });
      canvas.addEventListener('keydown', e => {
        const k = { ArrowLeft: ['az', 12], ArrowRight: ['az', -12], ArrowUp: ['el', 8], ArrowDown: ['el', -8] }[e.key];
        if (k) { e.preventDefault(); grab(); this.goal[k[0]] += k[1]; this.goal.el = clamp(this.goal.el, -85, 85); }
        if (e.key === '+' || e.key === '=') this.goal.dist = clamp(this.goal.dist * 0.9, 2.5, 13);
        if (e.key === '-') this.goal.dist = clamp(this.goal.dist * 1.1, 2.5, 13);
      });
    }
    draw(s, label) { this.state = s; this.label = label || ''; this.dirty = true; }
    frame(time) {
      const c = this.cam, g = this.goal;
      for (const k of ['az', 'el', 'dist']) { const d = g[k] - c[k]; if (Math.abs(d) > 0.001) { c[k] += d * 0.16; this.dirty = true; } }
      const s = this.state; if (!s) return;
      if (this.dirty) {
        const strands = this.def.draw(s);
        strands.forEach((st, i) => {
          let mesh = this.pool[i];
          if (!mesh) { mesh = this.pool[i] = new THREE.Mesh(tubeGeo(40, 8)); mesh.frustumCulled = false; mesh.castShadow = true; this.root.add(mesh); }
          const u = st.u === undefined ? 1 : st.u;
          mesh.visible = u > 0.01;
          if (!mesh.visible) return;
          if (mesh.userData.c !== st.c) { mesh.material = this.m[st.c]; mesh.userData.c = st.c; }
          fillTube(mesh.geometry, st.p, YARN * this.L.fat * (st.r === undefined ? 1 : Math.max(0.05, st.r)), u, st.closed);
        });
        for (let i = strands.length; i < this.pool.length; i++) this.pool[i].visible = false;
        /* hook */
        this.hook.visible = s.hookOn > 0.03;
        this.hook.position.set(...add(s.tip, mul(D0, (1 - s.hookOn) * 4)));
        this.hook.quaternion.copy(this.hookQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), s.roll));
        /* arrow: over the hook, from the back to the front */
        const av = s.ar > 0.05 && s.hookOn > 0.5; this.arrow.visible = this.arrowHead.visible = av;
        if (av) {
          const sl = s.ws + 0.34, pts = [165, 130, 90, 50, 15].map(d => ring(s, sl, d, 0.36));
          fillTube(this.arrow.geometry, pts, 0.022, 1, false);
          const end = ring(s, sl, 6, 0.36), dir = norm(add(end, mul(ring(s, sl, 30, 0.36), -1)));
          this.arrowHead.position.set(...end);
          this.arrowHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir));
          this.arrowMat.opacity = s.ar;
        }
        this.root.rotation.y = s.spin * PI * 2;
        this.dirty = false;
      }
      const t = this.def.cam.tgt, az = c.az * DEG, el = c.el * DEG;
      this.camera.position.set(t[0] * (this.left ? -1 : 1) + c.dist * Math.sin(az) * Math.cos(el), t[1] + c.dist * Math.sin(el), t[2] + c.dist * Math.cos(az) * Math.cos(el));
      this.camera.lookAt(t[0] * (this.left ? -1 : 1), t[1], t[2]);
      this.target.visible = s.tg > 0.03;
      let lab = null;
      if (this.target.visible) {
        this.target.position.set(...s.tp); this.target.quaternion.copy(this.camera.quaternion);
        if (this.left) this.target.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0));
        this.target.scale.setScalar(1 + 0.12 * Math.sin(time / 260)); this.goldMat.opacity = s.tg;
      }
      this.renderer.render(this.scene, this.camera);
      if (this.target.visible && s.tg > 0.5 && this.label) {
        const v = this.root.localToWorld(new THREE.Vector3(...s.tp)).project(this.camera);
        lab = [(v.x + 1) / 2 * this.el.clientWidth, (1 - v.y) / 2 * this.el.clientHeight];
      }
      this.onLabel && this.onLabel(lab, this.label);
    }
    dispose() {
      this.ro.disconnect();
      this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      this.renderer.dispose();
    }
  }

  window.Hookd3D = { getDef, stateAt, Stage, ok: () => !!window.THREE };
})();
