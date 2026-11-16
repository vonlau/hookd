/* Hookd prototype: pages, search and the player controls. */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('hookd-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('hookd-' + k, JSON.stringify(v)); } catch (e) { /* storage is optional */ } }
  };
  const prefs = { terms: store.get('terms', 'us'), left: store.get('left', false), look: store.get('look', 'clay'), speed: store.get('speed', 0.5), repeat: store.get('repeat', true) };
  const done = new Set(store.get('done', []));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pathMode = false, query = '', player = null;

  /* ---------- content ---------- */
  const TERMS = {
    us: { sc: 'single crochet', dc: 'double crochet', sl: 'slip stitch', Sl: 'Slip stitch', SC: 'sc', DC: 'dc', SL: 'sl st' },
    uk: { sc: 'double crochet', dc: 'treble crochet', sl: 'slip stitch', Sl: 'Slip stitch', SC: 'dc', DC: 'tr', SL: 'ss' }
  };
  const tx = s => s.replace(/\{(\w+)\}/g, (m, k) => TERMS[prefs.terms][k] || m);
  const other = () => prefs.terms === 'us' ? 'uk' : 'us';
  const STITCHES = [
    { id: 'slip-knot', scene: 'knot', us: 'Slip knot', uk: 'Slip knot', abbr: { us: '', uk: '' }, blurb: 'The starting loop that holds the yarn on your hook.', keys: ['starting loop', 'first loop', 'start', 'begin', 'knot', 'how to start'] },
    { id: 'chain', scene: 'chain', us: 'Chain', uk: 'Chain', abbr: { us: 'ch', uk: 'ch' }, blurb: 'A row of linked loops. Almost every project starts with one.', keys: ['chain stitch', 'foundation chain', 'starting chain', 'first row', 'base'] },
    { id: 'single-crochet', scene: 'sc', us: 'Single crochet', uk: 'Double crochet', abbr: { us: 'sc', uk: 'dc' }, blurb: 'The shortest, most common stitch. Dense and sturdy.', keys: ['basic stitch', 'short stitch', 'first stitch'] },
    { id: 'double-crochet', scene: 'dc', us: 'Double crochet', uk: 'Treble crochet', abbr: { us: 'dc', uk: 'tr' }, blurb: 'A tall stitch, about twice the height of the shortest one.', keys: ['tall stitch'] },
    { id: 'slip-stitch', scene: 'sl', us: 'Slip stitch', uk: 'Slip stitch', abbr: { us: 'sl st', uk: 'ss' }, blurb: 'A flat stitch for joining rounds and moving along without adding height.', keys: ['join', 'joining', 'close a round', 'slst'] },
    { id: 'magic-ring', scene: 'magic', us: 'Magic ring', uk: 'Magic ring', abbr: { us: 'MR', uk: 'MR' }, blurb: 'An adjustable loop for starting circles with no hole in the middle.', keys: ['magic circle', 'magic loop', 'adjustable ring', 'start a circle', 'amigurumi start'] }
  ];
  const PROJECT = { id: 'project-flower', title: 'Five-petal flower', blurb: 'A small flower made in one round. Uses the magic ring, chain, a tall stitch and slip stitch.', keys: ['flower', 'petal', 'first project', 'applique', 'beginner project'] };
  const ARTICLES = {
    'lesson-need': { title: 'What you need: hook and yarn', blurb: 'One hook, one ball of yarn, scissors and a blunt needle.', keys: ['tools', 'supplies', 'materials', 'hook size', 'which yarn', 'what to buy'], group: 'Start here' },
    'lesson-hold': { title: 'Holding the hook and yarn', blurb: 'Two common grips and how to keep even tension.', keys: ['grip', 'tension', 'hands', 'how to hold', 'pencil', 'knife'], group: 'Start here' },
    'help-loops': { title: 'Which loop do I go into?', blurb: 'Front loop, back loop or both, and why the loop on the hook never counts.', keys: ['front loop', 'back loop', 'both loops', 'where does the hook go', 'flo', 'blo', 'wrong stitch'], group: 'Help' },
    'help-mistakes': { title: 'Common beginner mistakes', blurb: 'Why edges wander, stitches tighten and counts drift, with fixes.', keys: ['mistake', 'wrong', 'too tight', 'edges', 'crooked', 'count', 'uneven', 'fix'], group: 'Help' },
    'help-terms': { title: 'Abbreviations and US/UK terms', blurb: 'What sc, dc and tr mean, and how US and UK names differ.', keys: ['abbreviation', 'glossary', 'us', 'uk', 'terms', 'hdc', 'tr', 'yo', 'yoh', 'st', 'rnd'], group: 'Help' },
    'help-left': { title: 'Left-handed crochet', blurb: 'Mirror every model with one switch.', keys: ['left handed', 'lefty', 'mirror', 'left hand'], group: 'Help' },
    'about-site': { title: 'About this site', blurb: 'Why Hookd teaches with 3D models and what this prototype can and cannot do.', keys: ['about', 'hookd', 'why', 'prototype'], group: 'About' },
    'about-contact': { title: 'Contact and feedback', blurb: 'Tell us what was unclear.', keys: ['contact', 'feedback', 'email', 'report'], group: 'About' }
  };
  const LESSONS = [
    { route: 'lesson-need', kind: 'Read' }, { route: 'lesson-hold', kind: 'Read' },
    { route: 'stitch-slip-knot', kind: '3D stitch' }, { route: 'stitch-chain', kind: '3D stitch' },
    { route: 'stitch-single-crochet', kind: '3D stitch' }, { route: 'stitch-double-crochet', kind: '3D stitch' },
    { route: 'project-flower', kind: '3D project' }
  ];
  const stitchOf = route => STITCHES.find(s => 'stitch-' + s.id === route);
  const sName = st => st[prefs.terms];
  const sAbbr = st => st.abbr[prefs.terms];
  function titleOf(route) {
    const st = stitchOf(route);
    return st ? sName(st) : route === PROJECT.id ? 'First project: five-petal flower' : ARTICLES[route].title;
  }
  const blurbOf = route => { const st = stitchOf(route); return st ? st.blurb : route === PROJECT.id ? PROJECT.blurb : ARTICLES[route].blurb; };

  /* crochet chart symbols, used as icons */
  const SYM = {
    'slip-knot': '<path d="M6 36c9 0 12-5 16-12 4-8 13-9 14-2s-9 11-14 4"/><path d="M22 26c3 6 9 10 20 10"/>',
    'chain': '<ellipse cx="24" cy="24" rx="15" ry="7.5"/>',
    'single-crochet': '<path d="M12 12l24 24M36 12L12 36"/>',
    'double-crochet': '<path d="M24 10v30M13 10h22M17 28l14-7"/>',
    'slip-stitch': '<circle cx="24" cy="24" r="6" fill="currentColor"/>',
    'magic-ring': '<circle cx="24" cy="22" r="12"/><path d="M15 31c-2 5-6 8-10 9"/>',
    'flower': [0, 1, 2, 3, 4].map(k => `<ellipse cx="24" cy="11.5" rx="6.5" ry="9" transform="rotate(${k * 72} 24 24)"/>`).join('') + '<circle cx="24" cy="24" r="3.5"/>',
    'page': '<path d="M13 7h16l7 7v27H13zM29 7v7h7M18 23h12M18 30h12"/>'
  };
  const sym = (name, cls = 'sym') => `<svg class="${cls}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SYM[name] || SYM.page}</svg>`;
  const symFor = route => { const st = stitchOf(route); return sym(st ? st.id : route === PROJECT.id ? 'flower' : 'page'); };

  /* ---------- search ---------- */
  const nq = s => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  function scoreNames(q, names) {
    let best = 0;
    for (const n of names.map(nq).filter(Boolean)) {
      if (n === q) best = Math.max(best, 100);
      else if (n.startsWith(q) && q.length > 1) best = Math.max(best, 80);
      else if (q.length > 2 && (n.includes(q) || q.includes(n) && n.length > 3)) best = Math.max(best, 60);
      else if (q.length > 2 && q.split(' ').every(t => t.length > 1 && n.includes(t))) best = Math.max(best, 45);
    }
    return best;
  }
  function search(raw) {
    const q = nq(raw); if (!q) return [];
    const out = [], cur = prefs.terms, oth = other(), sys = { us: 'US', uk: 'UK' };
    for (const st of STITCHES) {
      const route = 'stitch-' + st.id;
      const a = scoreNames(q, [st[cur], st.abbr[cur], st[cur] + ' stitch']);
      const b = st[oth] !== st[cur] || st.abbr[oth] !== st.abbr[cur] ? scoreNames(q, [st[oth], st.abbr[oth]]) - 8 : 0;
      const k = scoreNames(q, st.keys) - 15;
      const score = Math.max(a, b, k);
      if (score <= 0) continue;
      let note = '';
      if (b > a && b >= k) note = `${sys[oth]} "${st[oth].toLowerCase()}"${st.abbr[oth] ? ' (' + st.abbr[oth] + ')' : ''} is this stitch. You are viewing ${sys[cur]} terms, where it is called ${st[cur].toLowerCase()}.`;
      out.push({ route, score, type: 'Stitch', note });
    }
    const p = Math.max(scoreNames(q, [PROJECT.title]), scoreNames(q, PROJECT.keys) - 10);
    if (p > 0) out.push({ route: PROJECT.id, score: p, type: 'Project', note: '' });
    for (const id in ARTICLES) {
      const a = ARTICLES[id], sc = Math.max(scoreNames(q, [a.title]), scoreNames(q, a.keys) - 12);
      if (sc > 0) out.push({ route: id, score: sc - 5, type: a.group, note: '' });
    }
    return out.sort((x, y) => y.score - x.score);
  }
  function resultList(items) {
    return `<ul class="results">${items.map(r => `<li><a href="#${r.route}">${symFor(r.route)}<div>
      <div class="row"><h3>${esc(r.route === PROJECT.id ? PROJECT.title : titleOf(r.route))}</h3><span class="tag plain">${r.type}</span>${abbrTag(r.route)}</div>
      <p>${esc(tx(blurbOf(r.route)))}</p>${r.note ? `<p class="note"><span class="note-dot"></span>${esc(r.note)}</p>` : ''}</div></a></li>`).join('')}</ul>`;
  }
  const abbrTag = route => { const st = stitchOf(route); return st && sAbbr(st) ? `<span class="tag">${sAbbr(st)}</span>` : ''; };
  const EXAMPLES = ['dc', 'treble', 'starting loop', 'flower', 'which loop'];
  const searchBox = (id, big) => `<form class="search" role="search" data-search>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>
      <input id="${id}" type="search" autocomplete="off" aria-label="Search stitches, projects and help" placeholder="Search a stitch, a project or a question" value="${esc(query)}"${big ? '' : ''}>
    </form>
    <div class="chips"><span class="muted">Try</span>${EXAMPLES.map(e => `<button type="button" class="chip-btn" data-example="${e}">${e}</button>`).join('')}</div>`;
  function liveResults() {
    const box = $('#live'); if (!box) return;
    const res = search(query), home = !!$('#q-home');
    if (!nq(query)) { box.innerHTML = home ? '' : '<p class="muted">Type a stitch name, an abbreviation like <span class="mono">sc</span>, or a plain question like "starting loop".</p>'; return; }
    if (!res.length) { box.innerHTML = `<p>Nothing for "${esc(query)}" yet. This prototype has 6 stitches, 1 project and 4 help pages. <a href="#stitches">See all stitches</a>.</p>`; return; }
    const shown = home ? res.slice(0, 4) : res;
    box.innerHTML = `<p class="muted" aria-live="polite">${res.length} result${res.length === 1 ? '' : 's'} for "${esc(query)}" in ${prefs.terms.toUpperCase()} terms</p>` + resultList(shown) +
      (home && res.length > 4 ? `<p><a href="#search">See all ${res.length} results</a></p>` : '');
  }

  /* ---------- pages ---------- */
  const crumbs = (...parts) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="#home">Home</a>${parts.map(p => `<span>/</span>${p}`).join('')}</nav>`;
  const stitchCard = st => `<a class="card" href="#stitch-${st.id}">${sym(st.id)}<div class="row"><h3>${sName(st)}</h3>${sAbbr(st) ? `<span class="tag">${sAbbr(st)}</span>` : ''}</div><p>${esc(st.blurb)}</p></a>`;
  const projectCard = () => `<a class="card project" href="#project-flower">${sym('flower')}<h3>${PROJECT.title}</h3><p>9 steps. One round. About 15 minutes.</p></a>`;
  const laterCard = (t, d) => `<div class="card project later">${sym('page')}<div class="row"><h3>${t}</h3><span class="tag plain">Later</span></div><p>${d}</p></div>`;

  const pages = {
    home: () => `<div class="stack-lg">
      <section class="hero">
        <p class="eyebrow">Hookd: crochet in 3D</p>
        <h1>Crochet you can turn around.</h1>
        <p class="lede">Every stitch is a 3D model. Pause on any step, drag to look from any side, and see exactly where the hook goes.</p>
        ${searchBox('q-home', true)}
        <div id="live" class="stack"></div>
      </section>
      <a class="start-link" href="#start"><div><strong>New to crochet? Start here</strong><br><span>7 short lessons, from picking a hook to your first flower.</span></div><em>Begin lesson 1 →</em></a>
      <section class="stack"><h2>Projects to explore</h2>
        <div class="grid">${projectCard()}${laterCard('Granny square', 'Not in this prototype.')}${laterCard('Coaster', 'Not in this prototype.')}</div>
      </section>
      <section class="stack"><div class="row" style="justify-content:space-between"><h2>Stitches</h2><a href="#stitches">All 6 stitches</a></div>
        <div class="grid">${STITCHES.slice(0, 4).map(stitchCard).join('')}</div>
      </section></div>`,

    search: () => `<div class="stack">${crumbs('Search')}<h1>Search</h1>${searchBox('q-page')}<div id="live" class="stack"></div></div>`,

    start: () => {
      const next = LESSONS.find(l => !done.has(l.route)) || LESSONS[0];
      return `<div class="stack">${crumbs('Start here')}<h1>Start here</h1>
        <p class="lede">Seven lessons in order. Each one opens a page you can also find in the library, so nothing is hidden behind the path.</p>
        <div class="row"><a class="btn" data-path href="#${next.route}">${done.size ? 'Continue' : 'Begin'}: ${esc(titleOf(next.route))}</a>
          <span class="muted">${LESSONS.filter(l => done.has(l.route)).length} of 7 done on this device</span></div>
        <ol class="path">${LESSONS.map((l, i) => `<li class="${done.has(l.route) ? 'done' : ''}"><div class="rail"><span class="num">${done.has(l.route) ? '✓' : i + 1}</span></div>
          <a data-path href="#${l.route}"><div class="row"><h3>${esc(titleOf(l.route))}</h3><span class="tag plain">${l.kind}</span></div><p>${esc(tx(blurbOf(l.route)))}</p></a></li>`).join('')}</ol></div>`;
    },

    stitches: () => `<div class="stack">${crumbs('Stitches')}<h1>Stitches</h1>
      <p class="lede">Six stitches, each as a 3D model you can pause and turn. Names are shown in ${prefs.terms.toUpperCase()} terms.</p>
      <div class="grid">${STITCHES.map(stitchCard).join('')}</div>
      <p class="muted">Coming later: half double crochet and treble (US terms).</p></div>`,

    projects: () => `<div class="stack">${crumbs('Projects')}<h1>Projects</h1>
      <p class="lede">Step-by-step 3D tutorials with the written pattern alongside.</p>
      <div class="grid">${projectCard()}${laterCard('Granny square', 'Planned after launch.')}${laterCard('Coaster', 'Planned after launch.')}${laterCard('Small amigurumi', 'Planned after launch.')}</div></div>`,

    help: () => listPage('Help', 'Short answers to the things beginners get stuck on.', ['help-loops', 'help-mistakes', 'help-terms', 'help-left']),
    about: () => listPage('About', '', ['about-site', 'about-contact']),

    'lesson-need': () => article('lesson-need', `
      <p class="lede">You need very little to begin. Buy one hook and one ball of yarn, not a set.</p>
      <h2>The hook</h2>
      <p>Start with a <strong>5 mm hook</strong> (US size H-8). It is large enough to see your stitches and small enough to control. Aluminium hooks are cheap and the yarn slides easily on them.</p>
      <h2>The yarn</h2>
      <ul><li><strong>Medium weight.</strong> Look for "worsted", "aran" or the number 4 on the label.</li>
      <li><strong>Smooth.</strong> Fluffy or textured yarn hides the loops you need to see.</li>
      <li><strong>Light colour.</strong> Dark yarn makes it hard to tell one stitch from the next.</li>
      <li><strong>Acrylic or cotton.</strong> Both are inexpensive and forgiving when you undo your work.</li></ul>
      <p>The yarn label lists a recommended hook size. If it says 5 mm, the hook and yarn match.</p>
      <h2>Two small extras</h2>
      <ul><li>Scissors.</li><li>A blunt yarn needle, for weaving in the ends when a project is finished.</li></ul>`),

    'lesson-hold': () => article('lesson-hold', `
      <p class="lede">There is no single correct grip. Try both and keep the one that feels steady.</p>
      <p class="notice">Hookd models show only the hook and the yarn, with no hands in the way. This page is the one place where hands are described.</p>
      <h2>The hook hand</h2>
      <ul><li><strong>Pencil grip:</strong> hold the hook like a pencil, thumb and index finger on the flat part of the shaft.</li>
      <li><strong>Knife grip:</strong> hold the hook like a table knife, with your hand over the top.</li></ul>
      <h2>The yarn hand</h2>
      <p>Your other hand feeds the yarn and holds the work. Run the yarn over your index finger and let it pass between your other fingers so it drags slightly. That drag is called tension. Pinch the work just below the hook with your thumb and middle finger.</p>
      <h2>Tension</h2>
      <p>If your stitches are so tight that the hook will not go in, loosen your grip on the yarn. Even tension comes with practice, so do not worry about it in your first hour.</p>
      <p>Left-handed? Swap the hands and <a href="#help-left">switch the models to left-handed</a>.</p>`),

    'help-loops': () => article('help-loops', `
      <p class="lede">Unless a pattern says otherwise, the hook goes under <strong>both loops</strong> at the top of the stitch.</p>
      <figure><svg viewBox="0 0 520 190" role="img" aria-label="Side view of the top of a stitch. The hook passes under both the front loop and the back loop." style="width:100%;height:auto;color:var(--ink)">
        <path d="M150 140V95M250 140V95" stroke="currentColor" stroke-width="3" opacity=".35"/>
        <circle cx="150" cy="72" r="20" fill="none" stroke="currentColor" stroke-width="8"/><circle cx="250" cy="72" r="20" fill="none" stroke="currentColor" stroke-width="8"/>
        <path d="M60 112H330" stroke="#F2B100" stroke-width="8" stroke-linecap="round"/><path d="M318 98l22 14-22 14" fill="none" stroke="#F2B100" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <g fill="currentColor" font-family="Figtree, sans-serif" font-size="15" text-anchor="middle"><text x="150" y="20">front loop</text><text x="150" y="40">(nearest you)</text>
        <text x="250" y="40">back loop</text><text x="200" y="172">the hook goes under both</text></g></svg>
        <figcaption>Looking along the row, from the side. Gold shows the path of the hook.</figcaption></figure>
      <h2>Find the V</h2>
      <p>Look down at the top edge of your work. Each stitch ends in a sideways V. The side of the V nearest you is the front loop. The far side is the back loop.</p>
      <h2>Three rules</h2>
      <ul><li><strong>Both loops is the default.</strong> Patterns write FLO (front loop only) or BLO (back loop only) when they want something else.</li>
      <li><strong>The loop on your hook never counts.</strong> It is not a stitch and you never work into it.</li>
      <li><strong>One V, one stitch.</strong> If your hook is under a single strand, you have split the V. Back out and go under both.</li></ul>
      <p>In every Hookd model, gold marks the exact spot. Open <a href="#stitch-single-crochet">${tx('{sc}')}</a> and use the Top view to see the V from above.</p>`),

    'help-mistakes': () => article('help-mistakes', `
      <p class="lede">Almost everyone makes these in their first week. Each has a simple fix.</p>
      <h3>My edges slope inward</h3><p>You are skipping the last stitch of the row. It is easy to miss because it tilts sideways. Count your stitches at the end of every row.</p>
      <h3>My work is getting wider</h3><p>You are putting two stitches into one V, usually at the start of a row. Count again.</p>
      <h3>I cannot get the hook into the stitch</h3><p>Your stitches are too tight. Loosen your hold on the yarn, or move up one hook size while you learn.</p>
      <h3>My stitches look split or stringy</h3><p>The hook is going through the middle of the yarn or under only one loop. See <a href="#help-loops">Which loop do I go into?</a></p>
      <h3>My chain twists</h3><p>Keep the Vs facing you as you work back along the chain. A twisted chain is still usable for practice.</p>
      <h3>The pattern does not match what I am making</h3><p>Check whether the pattern uses US or UK terms. The same name means a different stitch. See <a href="#help-terms">Abbreviations and US/UK terms</a>.</p>`),

    'help-terms': () => article('help-terms', `
      <p class="lede">US and UK patterns use the same words for different stitches. Always check which one a pattern uses before you start.</p>
      <p>You are viewing <strong>${prefs.terms.toUpperCase()} terms</strong>. Switch at the top of any page.</p>
      <div class="table-scroll"><table><thead><tr><th>US term</th><th>US</th><th>UK term</th><th>UK</th><th>On Hookd</th></tr></thead><tbody>
        <tr><td>chain</td><td class="mono">ch</td><td>chain</td><td class="mono">ch</td><td><a href="#stitch-chain">Open</a></td></tr>
        <tr><td>slip stitch</td><td class="mono">sl st</td><td>slip stitch</td><td class="mono">ss</td><td><a href="#stitch-slip-stitch">Open</a></td></tr>
        <tr><td>single crochet</td><td class="mono">sc</td><td>double crochet</td><td class="mono">dc</td><td><a href="#stitch-single-crochet">Open</a></td></tr>
        <tr><td>half double crochet</td><td class="mono">hdc</td><td>half treble</td><td class="mono">htr</td><td class="muted">Later</td></tr>
        <tr><td>double crochet</td><td class="mono">dc</td><td>treble</td><td class="mono">tr</td><td><a href="#stitch-double-crochet">Open</a></td></tr>
        <tr><td>treble</td><td class="mono">tr</td><td>double treble</td><td class="mono">dtr</td><td class="muted">Later</td></tr>
        <tr><td>yarn over</td><td class="mono">yo</td><td>yarn over hook</td><td class="mono">yoh</td><td class="muted">In every stitch</td></tr>
        <tr><td>skip</td><td class="mono">sk</td><td>miss</td><td class="mono">miss</td><td></td></tr>
        <tr><td>gauge</td><td></td><td>tension</td><td></td><td></td></tr></tbody></table></div>
      <h2>Other abbreviations</h2>
      <ul><li><span class="mono">st, sts</span> stitch, stitches</li><li><span class="mono">MR</span> magic ring</li><li><span class="mono">rnd</span> round</li>
      <li><span class="mono">rep</span> repeat</li><li><span class="mono">FLO, BLO</span> front loop only, back loop only</li><li><span class="mono">* </span> repeat the instructions after the star</li></ul>
      <p>A quick test: if a pattern contains <span class="mono">sc</span>, it is written in US terms. UK patterns have no single crochet.</p>`),

    'help-left': () => article('help-left', `
      <p class="lede">Left-handed crochet is a mirror image of right-handed crochet. Hookd can mirror every model for you.</p>
      <p><button class="btn" type="button" data-toggle-left>${prefs.left ? 'Switch back to right-handed' : 'Switch to left-handed'}</button></p>
      <p>You can also change this at the top of any page. Your choice is remembered on this device.</p>
      <h2>What changes</h2>
      <ul><li>The hook is in your left hand and the yarn in your right.</li><li>You work from left to right along a row, and clockwise around a ring.</li><li>Every model, camera angle and gold marker is mirrored.</li></ul>
      <h2>What stays the same</h2>
      <ul><li>The written pattern. Stitch names, counts and abbreviations are identical.</li><li>The order of steps in every stitch.</li></ul>`),

    'about-site': () => article('about-site', `
      <p class="lede">Hookd teaches beginners to crochet with interactive 3D models instead of video.</p>
      <p>It began with one person learning alone and rewinding the same ten seconds of video over and over. A video has one camera angle and one speed. A 3D model has neither limit: you can stop on any step, turn the stitch around, and see exactly which loop the hook goes under.</p>
      <h2>How every model works</h2>
      <ul><li>One action per step, named in plain words.</li><li>Gold always marks where the hook goes.</li><li>Each step plays when you open it, at half speed.</li><li>Only the hook and yarn are shown. No hands.</li></ul>
      <h2>This is a prototype</h2>
      <ul><li>Stitch shapes are simplified and placed by hand. They have not yet been checked by an experienced crocheter.</li>
      <li>The models show the order of actions and where the hook goes. They do not yet show the exact path of every strand.</li>
      <li>Three looks (Flat, Realistic, Clay) are included so they can be compared. One will be chosen.</li>
      <li>Photos of each step in real yarn are planned.</li></ul>`),

    'about-contact': () => article('about-contact', `
      <p class="lede">Tell us where you got stuck. The most useful feedback names the stitch and the step.</p>
      <form class="form" id="fb-form">
        <label for="fb-what">What were you trying to learn?<input id="fb-what" type="text" placeholder="For example: double crochet, step 6"></label>
        <label for="fb-msg">What was unclear?<textarea id="fb-msg" rows="5" required></textarea></label>
        <div><button class="btn" type="submit">Send feedback</button></div>
        <p class="notice" id="fb-out" hidden></p>
      </form>`)
  };
  function listPage(title, lede, ids) {
    return `<div class="stack">${crumbs(title)}<h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}
      <div class="grid">${ids.map(id => `<a class="card" href="#${id}"><h3>${ARTICLES[id].title}</h3><p>${ARTICLES[id].blurb}</p></a>`).join('')}</div></div>`;
  }
  function lessonBar(route) {
    const i = LESSONS.findIndex(l => l.route === route);
    if (i < 0 || !(pathMode || route.startsWith('lesson-'))) return '';
    const prev = LESSONS[i - 1], next = LESSONS[i + 1];
    return `<div class="lesson-bar"><span><a data-path href="#start">Start here</a> · Lesson ${i + 1} of 7</span><span class="row">
      ${prev ? `<a data-path href="#${prev.route}">← ${esc(titleOf(prev.route))}</a>` : ''}
      ${next ? `<a data-path href="#${next.route}">Next: ${esc(titleOf(next.route))} →</a>` : '<span>Last lesson</span>'}</span></div>`;
  }
  function article(id, body) {
    const a = ARTICLES[id], sec = { 'Start here': 'start', Help: 'help', About: 'about' }[a.group];
    return `<div class="stack">${crumbs(`<a href="#${sec}">${a.group}</a>`, esc(a.title))}${lessonBar(id)}<article class="article"><h1>${a.title}</h1>${body}</article>${lessonBar(id)}</div>`;
  }

  /* ---------- player ---------- */
  const ICON = {
    prev: '<path d="M6 5v14M19 5l-9 7 9 7z"/>', next: '<path d="M18 5v14M5 5l9 7-9 7z"/>',
    play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>', pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/>',
    replay: '<path d="M4.5 12a7.5 7.5 0 1 0 2.6-5.7M4 4v5h5"/>'
  };
  const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
  const seg = (name, label, opts, val) => `<span class="ctl"><span class="seg-label" id="lbl-${name}">${label}</span><span class="seg" role="group" aria-labelledby="lbl-${name}">${opts.map(o => `<button type="button" data-${name}="${o[0]}" aria-pressed="${String(o[0]) === String(val)}">${o[1]}</button>`).join('')}</span></span>`;
  const PATTERN = [['Rnd 1: '], ['MR', 0], [', *'], ['ch 2', 1], [', '], ['2 {DC} in ring', 2], [', '], ['ch 2', 3], [', '], ['{SL} in ring', 4], ['; '], ['rep from * 4 more times', 5], ['. (5 petals)\n'],
    ['Finish: '], ['pull tail to close ring', 6], ['. '], ['Fasten off', 7], [', '], ['weave in ends', 8], ['.']];

  function playerHTML(name, isProject) {
    return `<section class="player" aria-label="3D player">
      <div class="stage-col">
        <div class="stage" id="stage" data-look="${prefs.look}">
          <canvas id="cv" tabindex="0" role="img" aria-label="3D model of ${esc(name)}. Drag to rotate, scroll or pinch to zoom, arrow keys to turn."></canvas>
          <div class="overlay target-label" id="tlabel" hidden></div>
          <div class="overlay counter" id="counter"></div>
          <button class="reset" type="button" data-view="reset">Reset view</button>
          <div class="overlay hint">Drag to look around. Scroll or pinch to zoom.</div>
        </div>
        <div class="transport">
          <button class="icon-btn" type="button" id="b-prev" aria-label="Previous step">${icon('prev')}</button>
          <button class="icon-btn main" type="button" id="b-play" aria-label="Pause">${icon('pause')}</button>
          <button class="icon-btn" type="button" id="b-replay" aria-label="Replay this step">${icon('replay')}</button>
          <button class="icon-btn" type="button" id="b-next" aria-label="Next step">${icon('next')}</button>
          <input class="scrub" id="scrub" type="range" min="0" max="1000" value="0" aria-label="Position in this step">
        </div>
        <div class="options">
          ${seg('speed', 'Speed', [[0.25, '0.25×'], [0.5, '0.5×'], [1, '1×']], prefs.speed)}
          ${seg('view', 'View', [['front', 'Front'], ['top', 'Top'], ['side', 'Side'], ['back', 'Back']], '')}
          ${seg('look', 'Look', [['flat', 'Flat'], ['realistic', 'Realistic'], ['clay', 'Clay']], prefs.look)}
          <label class="check" for="rep"><input id="rep" type="checkbox"${prefs.repeat ? ' checked' : ''}>Repeat step</label>
        </div>
        <p class="proto-note">Prototype model. Shapes are simplified and not yet checked by an experienced crocheter.</p>
      </div>
      <div class="steps-col"><ol class="steps" id="steps"></ol>
        ${isProject ? `<div class="pattern"><div class="row" style="justify-content:space-between"><h3>Written pattern</h3><span class="tag plain">${prefs.terms.toUpperCase()} terms</span></div><div class="lines" id="pattern"></div><p class="proto-note"><a href="#help-terms">What the abbreviations mean</a></p></div>` : ''}
      </div></section>`;
  }

  function mountPlayer(scene, route) {
    const el = $('#stage'), cv = $('#cv');
    if (!window.Hookd3D || !Hookd3D.ok()) return fail(el);
    const def = Hookd3D.getDef(scene);
    let stage;
    try { stage = new Hookd3D.Stage(el, cv, def); } catch (e) { return fail(el); }
    const P = { i: 0, t: 0, playing: !reduced, hold: 0, raf: 0, last: 0 };
    const UNIT = 1.15, tl = $('#tlabel'), counter = $('#counter'), scrub = $('#scrub'), bPlay = $('#b-play');
    stage.setLook(prefs.look); stage.setLeft(prefs.left); stage.setView('reset');
    Object.assign(stage.cam, stage.goal);
    stage.onGrab = () => setPlaying(false);
    stage.onLabel = (pos, text) => {
      if (!pos) { tl.hidden = true; return; }
      tl.hidden = false; if (tl.textContent !== text) tl.textContent = text;
      const w = tl.offsetWidth, x = Math.max(6, Math.min(el.clientWidth - w - 6, pos[0] - w / 2));
      tl.style.transform = `translate(${x}px, ${Math.max(40, pos[1] - 62)}px)`;
    };
    function setPlaying(on) {
      P.playing = on; P.hold = 0;
      bPlay.innerHTML = icon(on ? 'pause' : 'play'); bPlay.setAttribute('aria-label', on ? 'Pause' : 'Play');
    }
    function show() {
      const s = Hookd3D.stateAt(def, P.i, P.t), st = def.steps[P.i];
      stage.draw(s, st.label ? tx(st.label) : '');
      const c = def.counter(s); if (counter.textContent !== c) counter.textContent = c;
      if (document.activeElement !== scrub) scrub.value = Math.round(P.t * 1000);
    }
    function renderSteps() {
      $('#steps').innerHTML = def.steps.map((st, i) => `<li class="${i === P.i ? 'cur' : i < P.i ? 'past' : ''}">
        <button type="button" data-step="${i}"${i === P.i ? ' aria-current="step"' : ''}><span class="n">${i + 1}</span><span class="t">${esc(tx(st.title))}</span></button>
        ${i === P.i ? `<div class="body"><p>${esc(tx(st.text))}</p><div class="photo-slot">Photo of this step in real yarn: planned, not in this prototype.</div></div>` : ''}</li>`).join('');
      $('#b-prev').disabled = P.i === 0; $('#b-next').disabled = P.i === def.steps.length - 1;
      const pat = $('#pattern');
      if (pat) pat.innerHTML = PATTERN.map(([t, n]) => n === undefined ? esc(t).replace('\n', '<br>') : `<mark class="${n === P.i ? 'on' : n < P.i ? 'was' : ''}">${esc(tx(t))}</mark>`).join('');
    }
    function go(i) {
      P.i = Math.max(0, Math.min(def.steps.length - 1, i)); P.t = 0; setPlaying(!reduced); renderSteps(); show();
      if (P.i === def.steps.length - 1 && !done.has(route)) { done.add(route); store.set('done', [...done]); }
    }
    function tick(now) {
      P.raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - (P.last || now)) / 1000); P.last = now;
      if (P.playing) {
        if (P.hold > 0) { P.hold -= dt; if (P.hold <= 0) { P.t = 0; show(); } }
        else {
          P.t = Math.min(1, P.t + dt * prefs.speed / (def.steps[P.i].dur * UNIT)); show();
          if (P.t >= 1) { if (prefs.repeat) P.hold = 1.2; else setPlaying(false); }
        }
      }
      stage.frame(now);
    }
    const root = $('.player');
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const d = b.dataset;
      if (d.step !== undefined) go(+d.step);
      else if (b.id === 'b-prev') go(P.i - 1);
      else if (b.id === 'b-next') go(P.i + 1);
      else if (b.id === 'b-replay') { P.t = 0; setPlaying(true); show(); }
      else if (b.id === 'b-play') { if (!P.playing && P.t >= 1) P.t = 0; setPlaying(!P.playing); show(); }
      else if (d.view) stage.setView(d.view);
      else if (d.speed) { prefs.speed = +d.speed; store.set('speed', prefs.speed); press(b); }
      else if (d.look) { prefs.look = d.look; store.set('look', d.look); stage.setLook(d.look); press(b); }
    });
    const press = b => b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    scrub.addEventListener('input', () => { setPlaying(false); P.t = scrub.value / 1000; show(); });
    $('#rep').addEventListener('change', e => { prefs.repeat = e.target.checked; store.set('repeat', prefs.repeat); if (prefs.repeat && P.t >= 1 && P.playing) P.hold = 0.3; });
    const mq = window.matchMedia('(prefers-color-scheme: dark)'), onTheme = () => stage.setLook(prefs.look);
    mq.addEventListener && mq.addEventListener('change', onTheme);
    go(0); P.raf = requestAnimationFrame(tick);
    player = { stop() { cancelAnimationFrame(P.raf); mq.removeEventListener && mq.removeEventListener('change', onTheme); stage.dispose(); }, setLeft: on => stage.setLeft(on) || stage.setView('reset'), debug: { P, stage, def, go, show, setPlaying } };
  }
  function fail(el) { el.insertAdjacentHTML('beforeend', '<div class="fallback"><p>The 3D view needs WebGL, which is not available in this browser. The written steps still work.</p></div>'); }

  function stitchPage(st) {
    const o = other(), diff = st[o] !== st[prefs.terms];
    return `<div class="stack">${crumbs('<a href="#stitches">Stitches</a>', esc(sName(st)))}${lessonBar('stitch-' + st.id)}
      <div class="stack" style="gap:6px"><div class="row"><h1>${sName(st)}</h1>${sAbbr(st) ? `<span class="tag">${sAbbr(st)}</span>` : ''}</div>
      <p class="lede">${esc(st.blurb)}${diff ? ` In ${o.toUpperCase()} patterns this stitch is called ${st[o].toLowerCase()} (${st.abbr[o]}).` : ''}</p></div>
      ${playerHTML(sName(st), false)}
      <p class="muted">Not sure where the hook goes? <a href="#help-loops">Which loop do I go into?</a></p></div>`;
  }
  function projectPage() {
    return `<div class="stack">${crumbs('<a href="#projects">Projects</a>', PROJECT.title)}${lessonBar(PROJECT.id)}
      <div class="stack" style="gap:6px"><h1>${PROJECT.title}</h1>
      <p class="lede">One round, five petals. You will use the <a href="#stitch-magic-ring">magic ring</a>, <a href="#stitch-chain">chain</a>, <a href="#stitch-double-crochet">${tx('{dc}')}</a> and <a href="#stitch-slip-stitch">slip stitch</a>.</p></div>
      ${playerHTML(PROJECT.title, true)}</div>`;
  }

  /* ---------- router ---------- */
  function render() {
    const route = (location.hash || '#home').slice(1) || 'home', main = $('#view');
    if (player) { player.stop(); player = null; }
    const st = stitchOf(route);
    let html, scene = null;
    if (st) { html = stitchPage(st); scene = st.scene; }
    else if (route === PROJECT.id) { html = projectPage(); scene = 'flower'; }
    else if (pages[route]) html = pages[route]();
    else html = `<div class="stack"><h1>Page not found</h1><p>That page is not part of this prototype. <a href="#home">Go to the homepage</a>.</p></div>`;
    main.innerHTML = html;
    if (scene) mountPlayer(scene, route);
    if (ARTICLES[route] && route.startsWith('lesson-') && !done.has(route)) { done.add(route); store.set('done', [...done]); }
    const sec = st ? 'stitches' : route.startsWith('project') ? 'projects' : route.startsWith('help') ? 'help' : route.startsWith('about') ? 'about' : route.startsWith('lesson') ? 'start' : route;
    document.querySelectorAll('.nav a').forEach(a => { a.getAttribute('href') === '#' + sec ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
    document.title = route === 'home' ? 'Hookd' : ((st || route === PROJECT.id || ARTICLES[route]) ? titleOf(route) : $('h1', main).textContent) + ' · Hookd';
    liveResults();
  }
  function syncPrefs() {
    document.querySelectorAll('[data-terms]').forEach(b => b.setAttribute('aria-pressed', b.dataset.terms === prefs.terms));
    document.querySelectorAll('[data-hand]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.hand === 'left') === prefs.left));
  }
  function setLeft(on) { prefs.left = on; store.set('left', on); syncPrefs(); }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (a) { pathMode = a.hasAttribute('data-path'); return; }
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.terms) { prefs.terms = b.dataset.terms; store.set('terms', prefs.terms); syncPrefs(); render(); }
    else if (b.dataset.hand) { setLeft(b.dataset.hand === 'left'); player ? player.setLeft(prefs.left) : render(); }
    else if (b.hasAttribute('data-toggle-left')) { setLeft(!prefs.left); render(); }
    else if (b.dataset.example) { query = b.dataset.example; const i = $('[data-search] input'); if (i) { i.value = query; i.focus(); } liveResults(); }
  });
  document.addEventListener('input', e => { if (e.target.closest('[data-search]')) { query = e.target.value; liveResults(); } });
  document.addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.closest('[data-search]')) { if (location.hash !== '#search') location.hash = 'search'; }
    else if (e.target.id === 'fb-form') { const o = $('#fb-out'); o.hidden = false; o.textContent = 'Nothing was sent. This prototype has no way to receive messages yet.'; }
  });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); const m = $('#view'); m.focus({ preventScroll: true }); });
  syncPrefs(); render();
  window.HookdApp = { get player() { return player; } };
})();
