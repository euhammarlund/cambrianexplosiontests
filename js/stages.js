// EvoEarth teaching stages: 1 Concepts, 2 Cause and effect, 3 Explorer (app.js), 4 Summary, plus Guide and Teacher pages.
(function () {
  const E = window.CL_ENGINE, H = window.CL_HYPS, P = window.CL_PANELS, LOG = window.EV_LOG, APP = window.CL_APP;
  const CARDS = window.EV_CARDS, OUT = window.EV_OUTCOME_CARDS, CAMPS = window.EV_CAMPS, IVS = window.EV_INTERVALS;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cardById = {}; CARDS.concat(OUT).forEach(c => { cardById[c.id] = c; });
  const hypById = {}; H.forEach(h => { hypById[h.id] = h; });
  const refById = {}; (window.CL_REFS || []).forEach(r => { refById[r.id] = r; });
  const OWN_DEF = "Your own card. There is no answer key or data series for it in EvoEarth; discuss it with your partner and a teacher.";
  function registerOwn(id, label) { cardById[id] = { id, label, custom: true, def: OWN_DEF, panels: [], hyps: [], camp: "own" }; return cardById[id]; }
  function addOwn(stage, label) {
    const id = "own_" + Date.now().toString(36); registerOwn(id, label);
    S.s1.custom.push({ id, label }); S.s1.place[id] = "pool"; LOG.add(stage, "custom", { id, label });
  }
  // Own cards take the colour of the camp the students put them in.
  function ownCamp(id) { const z = S.s1.place[id]; return z === "abiotic" || z === "biotic" ? z : "own"; }
  function refShort(id) {
    const r = refById[id]; if (!r) return null;
    const a = String(r.authors || "").split(",").map(x => x.trim()).filter(Boolean);
    const sur = x => x.replace(/\s+[A-Z][A-Z-]*$/, "").replace(/\s+et al\.?$/, "");
    const etal = /et al/.test(r.authors || "") || a.length > 2;
    const who = !a.length ? (r.title || id) : etal ? `${sur(a[0])} et al.` : a.length === 2 ? `${sur(a[0])} and ${sur(a[1])}` : sur(a[0]);
    return r.year ? `${who} (${r.year})` : who;
  }
  function hypRefs(h, n) { return (h.refs || []).map(refShort).filter(Boolean).slice(0, n || 4); }
  function hypTag(h) {
    const refs = hypRefs(h, 4);
    const tip = `<b>${esc(h.id)} ${esc(h.name)}</b><br>${esc(h.summary || "")}${refs.length ? `<br><br>Suggested or discussed by: ${esc(refs.join("; "))}` : ""}`;
    return `<span class="hyp-ref" tabindex="0" data-tip="${esc(tip)}"><b>${esc(h.id)}</b> ${esc(h.name)}</span>`;
  }
  const TIER_WORD = { A: "well constrained", B: "fairly well constrained", C: "loosely constrained", D: "speculative or modelled" };

  // ---------- shuffled pool order (stable per session) ----------
  function seeded(seed) { let x = 0; for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0; return () => { x = (x * 1103515245 + 12345) >>> 0; return x / 4294967296; }; }
  const rnd = seeded(LOG.data.session.id);
  const order = CARDS.map(c => c.id).sort(() => rnd() - 0.5);

  // ---------- state ----------
  const S = {
    stage: 1,
    s1: { place: {}, revealed: {}, custom: [], last: null, selected: null },
    s2: { cause: [], effect: [], iv: "both", trial: 0, last: null, selected: null }
  };
  order.forEach(id => { S.s1.place[id] = "pool"; });
  // Restore the Stage 1 board from the log, if any.
  (function restore() {
    LOG.data.events.filter(e => e.stage === 1).forEach(e => {
      if (e.type === "move" && e.data.card) S.s1.place[e.data.card] = e.data.to;
      if (e.type === "custom") { registerOwn(e.data.id, e.data.label); S.s1.custom.push({ id: e.data.id, label: e.data.label }); S.s1.place[e.data.id] = "pool"; }
      if (e.type === "check") { (e.data.misplaced || []).forEach(m => { S.s1.place[m.id] = m.to; }); (e.data.revealed || []).forEach(id => { S.s1.revealed[id] = true; }); }
      if (e.type === "reset") { Object.keys(S.s1.place).forEach(k => { S.s1.place[k] = "pool"; }); S.s1.revealed = {}; }
    });
    S.s2.trial = LOG.data.events.filter(e => e.stage === 2 && e.type === "check").length;
  })();

  // ---------- tooltip ----------
  const tip = document.createElement("div"); tip.className = "ev-tip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip);
  let tipFor = null;
  function showTip(el, html) {
    tip.innerHTML = html; tip.classList.add("on"); tipFor = el;
    const r = el.getBoundingClientRect(), tw = Math.min(320, window.innerWidth - 16);
    tip.style.maxWidth = tw + "px";
    const left = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left));
    tip.style.left = left + "px";
    const below = r.bottom + 8, th = tip.offsetHeight;
    tip.style.top = (below + th > window.innerHeight - 8 ? Math.max(8, r.top - th - 8) : below) + "px";
  }
  function hideTip(el) { if (!el || el === tipFor) { tip.classList.remove("on"); tipFor = null; } }
  function bindTips(root) {
    $$("[data-tip]", root).forEach(el => {
      const html = () => el.dataset.tip;
      el.addEventListener("mouseenter", () => showTip(el, html()));
      el.addEventListener("mouseleave", () => hideTip(el));
      el.addEventListener("focus", () => showTip(el, html()));
      el.addEventListener("blur", () => hideTip(el));
    });
  }
  window.addEventListener("scroll", () => hideTip(), { passive: true });

  // ---------- drag and drop (pointer events, works with touch) ----------
  function makeDraggable(root, onDrop, onTap) {
    $$("[data-card]", root).forEach(el => {
      let sx = 0, sy = 0, drag = null, pid = null;
      el.addEventListener("pointerdown", e => {
        if (e.button !== 0) return;
        sx = e.clientX; sy = e.clientY; pid = e.pointerId; drag = null;
        el.setPointerCapture(pid);
      });
      el.addEventListener("pointermove", e => {
        if (pid !== e.pointerId) return;
        if (!drag && Math.hypot(e.clientX - sx, e.clientY - sy) > 6) {
          hideTip();
          drag = el.cloneNode(true); drag.classList.add("ghost"); drag.style.width = el.offsetWidth + "px";
          document.body.appendChild(drag); el.classList.add("dragging");
        }
        if (drag) {
          drag.style.left = (e.clientX - el.offsetWidth / 2) + "px"; drag.style.top = (e.clientY - 18) + "px";
          if (e.clientY < 70) window.scrollBy(0, -14); else if (e.clientY > window.innerHeight - 50) window.scrollBy(0, 14);
          $$(".dropzone.over").forEach(z => z.classList.remove("over"));
          drag.style.display = "none"; const z = document.elementFromPoint(e.clientX, e.clientY); drag.style.display = "";
          const dz = z && z.closest(".dropzone"); if (dz) dz.classList.add("over");
        }
      });
      const end = e => {
        if (pid !== e.pointerId) return; pid = null;
        if (drag) {
          drag.style.display = "none"; const z = document.elementFromPoint(e.clientX, e.clientY); drag.remove(); drag = null;
          el.classList.remove("dragging"); $$(".dropzone.over").forEach(x => x.classList.remove("over"));
          el._dragged = true;
          const dz = z && z.closest(".dropzone"); if (dz) onDrop(el.dataset.card, dz.dataset.zone);
        }
      };
      el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
      el.addEventListener("click", e => { e.stopPropagation(); if (el._dragged) { el._dragged = false; return; } onTap(el.dataset.card); });
    });
    $$(".dropzone", root).forEach(z => {
      z.addEventListener("click", e => { if (e.target.closest("[data-card]")) return; z.dispatchEvent(new CustomEvent("zonetap", { bubbles: true, detail: z.dataset.zone })); });
      z.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && !e.target.closest("[data-card]")) { e.preventDefault(); z.dispatchEvent(new CustomEvent("zonetap", { bubbles: true, detail: z.dataset.zone })); } });
    });
  }

  // ---------- notes component ----------
  function notesHTML(stage, prompt) {
    const ev = LOG.data.events.filter(e => e.stage === stage && (e.type === "insight" || e.type === "feedback"));
    return `<div class="notes card" data-notes="${stage}">
      <div class="notes-grid">
        <div><label for="ins-${stage}"><b>Our insights</b><span class="hint">${esc(prompt)}</span></label>
          <textarea id="ins-${stage}" rows="3" placeholder="Write what you discussed or understood"></textarea>
          <button class="btn" data-save="insight">Save insight</button></div>
        <div><label for="fb-${stage}"><b>What is not working?</b><span class="hint">Tell the developers what was confusing, wrong or broken. This helps improve EvoEarth.</span></label>
          <textarea id="fb-${stage}" rows="3" placeholder="For example: a card text was unclear, a button did nothing"></textarea>
          <button class="btn" data-save="feedback">Send feedback</button></div>
      </div>
      ${ev.length ? `<ul class="notes-list">${ev.map(e => `<li><span class="tag ${e.type}">${e.type === "insight" ? "Insight" : "Feedback"}</span> ${esc(e.data.text)} <span class="when">${new Date(e.t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span></li>`).join("")}</ul>` : ""}
      <p class="hint">Saved notes go into your session log for the summary page and for the teachers.</p>
    </div>`;
  }
  function bindNotes(root, stage, rerender) {
    $$("[data-save]", root).forEach(b => b.addEventListener("click", () => {
      const kind = b.dataset.save, ta = $(kind === "insight" ? `#ins-${stage}` : `#fb-${stage}`, root);
      const text = ta.value.trim(); if (!text) { ta.focus(); return; }
      LOG.add(stage, kind, { text }); ta.value = ""; toast(kind === "insight" ? "Insight saved" : "Feedback sent to the log"); rerender();
    }));
  }
  function toast(msg) {
    let el = $("#toast"); if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 3000);
  }

  // =====================================================================
  // Stage 1: Concepts
  // =====================================================================
  function allS1() { return order.map(id => cardById[id]).concat(S.s1.custom.map(c => cardById[c.id])); }
  function cardHTML(c, opts) {
    opts = opts || {};
    const camp = c.custom ? ownCamp(c.id) : c.camp;
    const rev = opts.reveal ? ` rev-${camp}` : "";
    const tipTxt = `<b>${esc(c.label)}</b><br>${esc(c.def)}`;
    return `<button type="button" class="ccard${rev}${c.custom ? " custom" : ""}${opts.sel ? " sel" : ""}${c.added ? " added" : ""}" data-card="${esc(c.id)}" data-tip="${esc(tipTxt)}" aria-label="${esc(c.label)}. ${esc(c.def)}">${esc(c.label)}${opts.mark || ""}</button>`;
  }
  function renderS1() {
    const el = $("#stage-1");
    const cards = allS1();
    const inZone = z => cards.filter(c => S.s1.place[c.id] === z);
    const res = S.s1.last;
    const placed = cards.filter(c => !c.custom && S.s1.place[c.id] !== "pool").length;
    el.innerHTML = `
      <div class="st-head">
        <div><p class="kicker">Stage 1 of 4 · about 20 minutes · work in pairs</p><h1>Concepts: abiotic or biotic?</h1>
        <p class="lead">These cards come from Christian Rasmussen's teaching on the determinants of the two great radiations. Talk about each card with your partner. Hover over a card (or tap it) to read a short explanation. Then drag the cards into the camp where you think they belong. You can place as many or as few as you like before you ask EvoEarth to check.</p></div>
        <ol class="steps-mini"><li>Read and discuss a card</li><li>Drag it to Abiotic or Biotic</li><li>Press <b>Check our sorting</b></li><li>Write down what you learnt</li></ol>
      </div>
      <div class="card pool-card">
        <div class="pool-head"><h3>Pool of concepts <span class="count">${inZone("pool").length} cards</span></h3>
          <form class="own" id="own-form"><label for="own-in" class="sr">Add your own concept card</label><input id="own-in" maxlength="40" placeholder="Your own concept"><button class="btn" type="submit">Add card</button></form></div>
        <div class="dropzone pool" data-zone="pool" tabindex="0" aria-label="Pool of concept cards">${inZone("pool").map(c => cardHTML(c, { reveal: S.s1.revealed[c.id], sel: S.s1.selected === c.id })).join("") || `<p class="empty">All cards are placed.</p>`}</div>
        ${S.s1.selected ? `<p class="hint sel-hint">Selected: <b>${esc(cardById[S.s1.selected] ? cardById[S.s1.selected].label : S.s1.custom.find(c => c.id === S.s1.selected).label)}</b>. Tap a camp, or use <button class="btn" data-place="abiotic">Abiotic</button> <button class="btn" data-place="biotic">Biotic</button> <button class="btn" data-place="pool">Back to pool</button></p>` : `<p class="hint">Tip: you can also tap a card and then tap a camp.</p>`}
      </div>
      <div class="camps">
        ${["abiotic", "biotic"].map(k => `<div class="camp camp-${k}">
          <h2 class="camp-h" tabindex="0" data-tip="${esc(`<b>${CAMPS[k].name}</b><br>${CAMPS[k].tip}`)}">${CAMPS[k].name} <span class="i" aria-hidden="true">?</span></h2>
          <div class="dropzone" data-zone="${k}" tabindex="0" aria-label="${CAMPS[k].name} camp">${inZone(k).map(c => cardHTML(c, { reveal: S.s1.revealed[c.id], sel: S.s1.selected === c.id, mark: res && res.movedIds.includes(c.id) ? ` <span class="moved" title="Moved by the check">moved</span>` : "" })).join("") || `<p class="empty">Drop cards here</p>`}</div>
        </div>`).join("")}
      </div>
      <div class="s1-actions">
        <button class="btn primary big" id="s1-check" ${placed ? "" : "disabled"}>Check our sorting</button>
        <button class="btn" id="s1-reset">Put all cards back</button>
        <span class="hint">${placed} of ${CARDS.length} cards placed${LOG.data.events.filter(e => e.stage === 1 && e.type === "check").length ? ` · ${LOG.data.events.filter(e => e.stage === 1 && e.type === "check").length} checks so far` : ""}</span>
      </div>
      ${res ? s1ResultHTML(res) : ""}
      ${notesHTML(1, "What surprised you? Which cards were hard to place, and why?")}
      <div class="st-next"><button class="btn primary" data-go="2">Go to Stage 2: cause and effect →</button></div>`;
    bindTips(el);
    makeDraggable(el, (id, zone) => moveS1(id, zone), id => { S.s1.selected = S.s1.selected === id ? null : id; renderS1(); });
    if (!el._zt) { el.addEventListener("zonetap", e => onZoneTap1(e)); el._zt = true; }
    $$("[data-place]", el).forEach(b => b.addEventListener("click", () => onZoneTap1({ detail: b.dataset.place })));
    $("#s1-check").addEventListener("click", checkS1);
    $("#s1-reset").addEventListener("click", () => { Object.keys(S.s1.place).forEach(k => { S.s1.place[k] = "pool"; }); S.s1.revealed = {}; S.s1.last = null; LOG.add(1, "reset", {}); renderS1(); });
    $("#own-form").addEventListener("submit", e => {
      e.preventDefault(); const v = $("#own-in").value.trim(); if (!v) return;
      addOwn(1, v); renderS1();
    });
    bindNotes(el, 1, renderS1);
    bindGo(el);
  }
  function onZoneTap1(e) { if (!S.s1.selected) return; const id = S.s1.selected; S.s1.selected = null; moveS1(id, e.detail); }
  function moveS1(id, zone) {
    if (!zone || S.s1.place[id] === zone) { renderS1(); return; }
    const from = S.s1.place[id]; S.s1.place[id] = zone;
    const c = cardById[id] || S.s1.custom.find(x => x.id === id);
    LOG.add(1, "move", { card: id, label: c.label, from, to: zone });
    renderS1();
  }
  function checkS1() {
    const placedCards = CARDS.filter(c => S.s1.place[c.id] !== "pool");
    const mis = placedCards.filter(c => S.s1.place[c.id] !== c.camp);
    const correct = placedCards.length - mis.length;
    const misplaced = mis.map(c => ({ id: c.id, label: c.label, from: S.s1.place[c.id], to: c.camp }));
    mis.forEach(c => { S.s1.place[c.id] = c.camp; });
    placedCards.forEach(c => { S.s1.revealed[c.id] = true; });
    const debated = placedCards.filter(c => c.debated).map(c => c.id);
    const customPlaced = S.s1.custom.filter(c => S.s1.place[c.id] !== "pool").map(c => c.label);
    S.s1.last = { correct, placed: placedCards.length, misplaced, movedIds: mis.map(c => c.id), debated, customPlaced, unplaced: CARDS.length - placedCards.length };
    LOG.add(1, "check", { placed: placedCards.length, correct, total: CARDS.length, misplaced, revealed: placedCards.map(c => c.id), customPlaced });
    renderS1();
    const r = $("#s1-result"); if (r) r.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function s1ResultHTML(res) {
    const all = res.correct === res.placed;
    return `<div class="card result" id="s1-result" aria-live="polite">
      <h3>${all ? `All ${res.placed} placed cards were in the right camp.` : `${res.correct} of ${res.placed} placed cards were in the right camp. ${res.misplaced.length} ${res.misplaced.length === 1 ? "card was" : "cards were"} moved.`}</h3>
      <p class="hint">Checked cards are now coloured: <span class="swatch abiotic"></span>orange = abiotic, <span class="swatch biotic"></span>green = biotic, as in the printed card set.${res.unplaced ? ` ${res.unplaced} cards are still in the pool and were not checked.` : ""}</p>
      ${res.misplaced.length ? `<ul class="why-list">${res.misplaced.map(m => { const c = cardById[m.id]; return `<li><b>${esc(c.label)}</b> moved to ${CAMPS[c.camp].name}. ${esc(c.why)}${c.debated ? ` <span class="deb">Worth discussing: ${esc(c.debated)}</span>` : ""}</li>`; }).join("")}</ul>` : ""}
      ${res.debated.filter(id => !res.movedIds.includes(id)).length ? `<details><summary>Cards near the boundary between the camps (${res.debated.filter(id => !res.movedIds.includes(id)).length})</summary><ul class="why-list">${res.debated.filter(id => !res.movedIds.includes(id)).map(id => `<li><b>${esc(cardById[id].label)}</b>: ${esc(cardById[id].debated)}</li>`).join("")}</ul></details>` : ""}
      ${res.customPlaced.length ? `<p class="hint">Your own cards (${res.customPlaced.map(esc).join(", ")}) have no answer key. Discuss them with a teacher. They follow you to Stage 2.</p>` : ""}
      <p class="bridge">Many cards sit where life and environment meet: oxygen is made by life, burrowing changes seawater chemistry. Stage 2 asks how the cards affect each other.</p>
    </div>`;
  }

  // =====================================================================
  // Stage 2: Cause and effect
  // =====================================================================
  function panelsOf(card) { return (card.panels || []).map(s => { const [panel, row] = s.split(":"); return { panel, row, key: s }; }); }
  function curvePanelsOf(card) { return panelsOf(card).filter(x => !x.row && E.panelsById[x.panel] && (E.panelsById[x.panel].kind === "curve" || E.panelsById[x.panel].kind === "derived")); }
  function hypRoles(h) {
    const c = new Set(), f = new Set();
    h.preds.forEach(q => {
      if (q.kind === "condition") { c.add(q.panel); if (q.row) c.add(q.panel + ":" + q.row); }
      else if (q.kind === "pattern") { f.add(q.panel); if (q.row) f.add(q.panel + ":" + q.row); }
      else if (q.kind === "link") { c.add(q.a); if (q.arow) c.add(q.a + ":" + q.arow); f.add(q.b); if (q.brow) f.add(q.b + ":" + q.brow); }
    });
    return { c, f };
  }
  function matches(card, set) { return panelsOf(card).some(x => set.has(x.key) || (!x.row && set.has(x.panel))); }
  function causeIn(card, h, roles) { return (card.hyps || []).includes(h.id) || matches(card, roles.c); }
  function effectIn(card, roles) { return matches(card, roles.f); }

  function evalState(causeP, effectP) {
    const base = APP.state;
    const roles = Object.assign({}, window.CL_PRESETS[0].roles);
    causeP.forEach(id => { roles[id] = "given"; }); effectP.forEach(id => { roles[id] = "outcome"; });
    return { ageModel: base.ageModel, roles, variants: Object.assign({}, base.variants, effectP.includes("richness") ? {} : {}), weights: {}, hidden: {}, res: null, binCache: new Map(), covaryMode: "levels", provenancePenalty: false, windowOverride: null };
  }
  function meanNet(h, st, iv) {
    let s = 0, n = 0;
    for (let t = iv.range[0] - 2; t >= iv.range[1] + 2; t -= 4) { s += E.evalHyp(h, t, st).net; n++; }
    return n ? s / n : 0;
  }
  function word(x) { return x > 0.25 ? "supported" : x < -0.25 ? "contradicted" : "mixed"; }
  function dirWord(sl) { return sl == null ? "no data" : sl > 0.04 ? "rose" : sl < -0.04 ? "fell" : "stayed about the same"; }
  function firstAge(panel, row) { const r = E.panelsById[panel].rows.find(x => x.id === row); return r ? r.steps[0][0] : null; }

  // Simple data comparison for one cause card and one effect card in one interval.
  function dataCheck(cc, ec, iv, st) {
    const cp = curvePanelsOf(cc)[0], ep = curvePanelsOf(ec)[0];
    const ct = panelsOf(cc).find(x => x.row), et = panelsOf(ec).find(x => x.row);
    const out = { lines: [], agree: null, used: [] };
    if (cp && ep) {
      const A = E.panelsById[cp.panel], B = E.panelsById[ep.panel];
      const r = Math.max(E.effRes(A, st) || 0, E.effRes(B, st) || 0);
      const a = E.series(A, iv.range[0], iv.range[1], st, { r }), b = E.series(B, iv.range[0], iv.range[1], st, { r });
      const nb = a.filter((v, i) => v !== null && b[i] !== null).length;
      out.used.push(A.id, B.id);
      if (nb < 3) { out.lines.push(`There are too few overlapping data in ${iv.short} to compare ${A.short} and ${B.short} (the coarser curve has a value only every ${r} Myr, or one curve has no data here).`); return out; }
      const sign = cc.sign || (cp.panel === "globalredox" ? -1 : 1);
      const sa = E.slope(a), sb = E.slope(b), rr = E.pearson(a, b);
      const ca = sign * (sa || 0);
      out.lines.push(`${A.short} ${dirWord(sa)} and ${B.short} ${dirWord(sb)} during ${iv.name.split(" (")[0].toLowerCase().replace("great ordovician biodiversification event", "the GOBE").replace(/^cambrian/, "the Cambrian")} (${iv.short}).`);
      if (rr != null) {
        const same = rr * sign > 0;
        out.lines.push(`Compared in ${r} Myr steps, the two curves move ${Math.abs(rr) < 0.3 ? "mostly independently" : same ? "in the direction your idea predicts" : "in the opposite direction to your idea"} (r = ${rr.toFixed(2)}, ${nb} steps).`);
        out.agree = Math.abs(rr) < 0.3 ? 0 : same ? 1 : -1;
        if (Math.abs(ca) < 0.04 && out.agree === 1) out.agree = 0;
      } else {
        const flatA = Math.abs(sa || 0) <= 0.04, chB = Math.abs(sb || 0) > 0.04;
        out.lines.push(flatA && chB ? `${A.short} does not change in this curve here, so on its own it cannot explain the change in ${B.short}. But a smooth or coarse curve can hide short pulses (see the resolution note in Stage 3).` : `One of the curves is flat here, so EvoEarth cannot measure how the two move together.`);
        out.agree = flatA && chB ? -1 : 0;
      }
      return out;
    }
    if (ct && (ep || et)) {
      const age = firstAge(ct.panel, ct.row);
      const iv0 = iv.range[0], iv1 = iv.range[1];
      out.used.push(ct.panel);
      if (age == null) return out;
      const inIv = age <= iv0 + 5 && age >= iv1;
      if (et) {
        const age2 = firstAge(et.panel, et.row); out.used.push(et.panel);
        out.lines.push(`First evidence for ${cc.label.toLowerCase()}: about ${age} Ma. First evidence for ${ec.label.toLowerCase()}: about ${age2} Ma. ${age > age2 ? "The cause appears first, as your idea needs." : age === age2 ? "They appear at about the same time, so the order cannot be told apart." : "The effect appears first, which does not fit the idea that this cause started it."}`);
        out.agree = age > age2 ? 1 : age === age2 ? 0 : -1;
        return out;
      }
      const B = E.panelsById[ep.panel]; out.used.push(B.id);
      const r = E.effRes(B, st) || 1;
      const after = E.series(B, age, age - 10, st, { r }), before = E.series(B, age + 10, age, st, { r });
      const sa = E.slope(after);
      out.lines.push(`First evidence for ${cc.label.toLowerCase()} is about ${age} Ma${inIv ? "" : `, outside ${iv.short}`}. In the 10 Myr after that, ${B.short} ${dirWord(sa)}.`);
      out.agree = !inIv ? 0 : sa == null ? null : sa > 0.04 ? 1 : sa < -0.04 ? -1 : 0;
      if (before.some(v => v != null) && E.slope(before) > 0.04 && out.agree === 1) out.lines.push(`${B.short} was already rising before ${age} Ma, so the rise did not start with this trait.`);
      return out;
    }
    if (cp && et) {
      const A = E.panelsById[cp.panel]; const age = firstAge(et.panel, et.row); out.used.push(A.id, et.panel);
      const r = E.effRes(A, st) || 1;
      const b = E.series(A, age + 15, age, st, { r });
      const sa = E.slope(b), sign = cc.sign || (cp.panel === "globalredox" ? -1 : 1);
      out.lines.push(`${ec.label} first appears about ${age} Ma. In the 15 Myr before, ${A.short} ${dirWord(sa)}.`);
      out.agree = sa == null ? null : sign * sa > 0.04 ? 1 : sign * sa < -0.04 ? -1 : 0;
      return out;
    }
    const missing = [cc, ec].filter(c => !(c.panels || []).length).map(c => c.label);
    out.lines.push(missing.length ? `There is no data series for ${missing.join(" or ")} in EvoEarth yet, so the data cannot be compared.` : `These two cards cannot be compared directly with the data in EvoEarth yet.`);
    return out;
  }
  function qualityLines(ids, iv) {
    const mid = (iv.range[0] + iv.range[1]) / 2;
    return [...new Set(ids)].map(id => {
      const p = E.panelsById[id]; if (!p) return "";
      const st = APP.state, v = p.kind === "curve" ? E.variantOf(p, st) : null;
      const tier = E.tierAt(p, E.toICS(mid, st.ageModel), st);
      const kind = v ? (v.status === "digitised" ? "real data (digitised from a published figure)" : v.status === "data summary" ? "real data (values read from papers)" : "a simplified (schematic) curve") : p.kind === "traits" ? "first appearances of traits in the fossil record" : "a derived index";
      return `<li><b>${esc(p.short)}</b>: ${kind}; confidence ${tier} (${TIER_WORD[tier]}); ${esc((v && v.scale) || p.scale).toLowerCase()}.${p.caveat ? ` Caveat: ${esc(p.caveat)}` : ""}</li>`;
    }).join("");
  }
  function coMovers(ec, iv, exclude, st) {
    const ep = curvePanelsOf(ec)[0]; if (!ep) return [];
    const B = E.panelsById[ep.panel];
    return P.filter(p => (p.kind === "curve") && p.id !== B.id && !exclude.includes(p.id) && p.group !== "Biological").map(p => {
      const r = Math.max(E.effRes(p, st) || 0, E.effRes(B, st) || 0);
      const a = E.series(p, iv.range[0], iv.range[1], st, { r }), b = E.series(B, iv.range[0], iv.range[1], st, { r });
      const n = a.filter((v, i) => v !== null && b[i] !== null).length;
      return { p, r: n >= 4 ? E.pearson(a, b) : null, n };
    }).filter(x => x.r != null && Math.abs(x.r) >= 0.6).sort((x, y) => Math.abs(y.r) - Math.abs(x.r)).slice(0, 3);
  }

  function checkRelation() {
    const causes = S.s2.cause.map(id => cardById[id]), effects = S.s2.effect.map(id => cardById[id]);
    const ivs = S.s2.iv === "both" ? IVS : IVS.filter(i => i.id === S.s2.iv);
    const causeP = [...new Set(causes.flatMap(c => curvePanelsOf(c).map(x => x.panel).concat(panelsOf(c).filter(x => x.row).map(x => x.panel))))];
    const effectP = [...new Set(effects.flatMap(c => panelsOf(c).map(x => x.panel)))].filter(id => !causeP.includes(id));
    const st = evalState(causeP, effectP);
    const pairs = [];
    causes.forEach(cc => effects.forEach(ec => {
      const sup = [], rev = [], other = [];
      H.forEach(h => {
        const R = hypRoles(h);
        if (causeIn(cc, h, R) && effectIn(ec, R)) sup.push(h);
        else if (causeIn(cc, h, R)) other.push(h);
        if (matches(ec, R.c) && matches(cc, R.f)) rev.push(h);
      });
      const perIv = ivs.map(iv => {
        const d = dataCheck(cc, ec, iv, st);
        const nets = sup.map(h => ({ h, net: meanNet(h, st, iv) }));
        return { iv, d, nets };
      });
      pairs.push({ cc, ec, sup, rev, other, perIv });
    }));
    // verdict
    let dsum = 0, n = 0, nsum = 0, nn = 0, anyData = false, anyHyp = false, pos = false, neg = false;
    pairs.forEach(pr => {
      if (pr.sup.length) anyHyp = true;
      pr.perIv.forEach(x => {
        if (x.d.agree != null) { anyData = true; dsum += x.d.agree; n++; if (x.d.agree > 0.3) pos = true; if (x.d.agree < -0.3) neg = true; }
        x.nets.forEach(z => { nsum += z.net > 0.25 ? 1 : z.net < -0.25 ? -1 : 0; nn++; });
      });
    });
    let verdict, level;
    const dAvg = n ? dsum / n : 0, hAvg = nn ? nsum / nn : 0;
    const avg = n ? 0.7 * dAvg + 0.3 * hAvg : hAvg;
    const conflict = pos && neg;
    if (!anyHyp && !anyData) { verdict = "Not testable with EvoEarth yet"; level = 0; }
    else if (anyHyp && avg > 0.4 && !conflict) { verdict = "Supported by hypotheses and data"; level = 3; }
    else if (anyHyp && (avg >= -0.2 || conflict)) { verdict = "Proposed in the literature, data mixed"; level = 2; }
    else if (anyHyp) { verdict = "Proposed in the literature, but data disagree"; level = 1; }
    else if (avg > 0.4 && !conflict) { verdict = "Data move together, but no hypothesis proposes this"; level = 2; }
    else if (avg < -0.2) { verdict = "Data do not support this idea"; level = 1; }
    else { verdict = "Weak or unclear"; level = 1; }
    S.s2.trial += 1;
    const trial = S.s2.trial;
    S.s2.last = { trial, causes, effects, ivs, pairs, verdict, level, causeP, effectP, st };
    LOG.add(2, "check", { trial, causes: causes.map(c => c.label), effects: effects.map(c => c.label), interval: S.s2.iv, verdict, level, hyps: [...new Set(pairs.flatMap(p => p.sup.map(h => h.id)))] });
    renderS2();
    const r = $("#s2-result"); if (r) r.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function s2ResultHTML(R) {
    const lvlCls = ["l0", "l1", "l2", "l3"][R.level];
    const otherParams = new Set();
    R.pairs.forEach(pr => pr.sup.forEach(h => h.preds.forEach(q => { [q.panel, q.a, q.b].forEach(id => { if (id && !R.causeP.includes(id) && !R.effectP.includes(id) && E.panelsById[id] && E.panelsById[id].kind !== "framework") otherParams.add(id); }); })));
    const bio = R.effects.some(c => curvePanelsOf(c).some(x => E.panelsById[x.panel].group === "Biological") || panelsOf(c).some(x => x.row));
    let html = `<div class="card result s2r" id="s2-result" aria-live="polite">
      <div class="s2r-head"><span class="verdict ${lvlCls}">${esc(R.verdict)}</span><h3>Trial ${R.trial}: ${R.causes.map(c => esc(c.label)).join(" + ")} → ${R.effects.map(c => esc(c.label)).join(" + ")}</h3></div>`;
    R.pairs.forEach(pr => {
      html += `<div class="pair"><h4>${esc(pr.cc.label)} → ${esc(pr.ec.label)}</h4>`;
      const ex = pr.sup.find(h => hypRefs(h, 1).length);
      html += `<p><b>Do scientists propose this?</b> ${pr.sup.length ? `Yes. ${pr.sup.length === 1 ? "One hypothesis" : pr.sup.length + " hypotheses"} in EvoEarth ${pr.sup.length === 1 ? "links" : "link"} these: ${pr.sup.map(hypTag).join("; ")}.${ex ? ` For example, ${esc(hypRefs(ex, 1)[0])} discussed this in ${esc(ex.id)} ${esc(ex.name)}.` : ""} <span class="hint">Point at a hypothesis to see who suggested it.</span>` : pr.other.length ? `Not in this direction. ${esc(pr.cc.label)} is a driver in ${pr.other.slice(0, 3).map(hypTag).join("; ")}, but for other outcomes.` : `None of the 13 hypotheses in EvoEarth uses this link. That does not make it wrong; it may be new, or it may need data that are not in the model.`}</p>`;
      const ownIn = [pr.cc, pr.ec].filter(c => c.custom);
      if (ownIn.length) html += `<p class="loop"><b>Your own card:</b> ${ownIn.map(c => esc(c.label)).join(" and ")} ${ownIn.length > 1 ? "have" : "has"} no data series or hypothesis in EvoEarth yet. Use the opinion box below to argue for the link, and say what data could test it.</p>`;
      if (pr.rev.length) html += `<p class="loop"><b>Feedback?</b> Some hypotheses run the other way, with ${esc(pr.ec.label.toLowerCase())} affecting ${esc(pr.cc.label.toLowerCase())}: ${pr.rev.slice(0, 3).map(hypTag).join("; ")}. Cause and effect may go both ways.</p>`;
      html += `<div class="ivgrid">`;
      IVS.forEach(iv => {
        const x = pr.perIv.find(z => z.iv.id === iv.id);
        if (!x) { html += `<div class="ivbox ivblank" aria-hidden="true"></div>`; return; }
        html += `<div class="ivbox"><p class="ivname">${esc(x.iv.name)}, ${esc(x.iv.short)}</p><p><b>What do the data show?</b> ${x.d.lines.map(esc).join(" ")}</p>`;
        if (x.nets.length) html += `<p><b>In the full model:</b> ${x.nets.map(z => `${z.h.id} is ${word(z.net)} on average in this interval (net ${z.net >= 0 ? "+" : ""}${z.net.toFixed(2)})`).join("; ")}.</p>`;
        const ids = x.d.used; if (ids.length) html += `<details><summary>How good are these data?</summary><ul class="qual">${qualityLines(ids, x.iv)}</ul></details>`;
        const cm = coMovers(pr.ec, x.iv, R.causeP, R.st);
        if (cm.length) html += `<p class="hint">Other parameters that also move with ${esc(E.panelsById[curvePanelsOf(pr.ec)[0].panel].short)} here: ${cm.map(z => `${esc(z.p.short)} (r = ${z.r.toFixed(2)})`).join(", ")}.</p>`;
        html += `</div>`;
      });
      html += `</div></div>`;
    });
    html += `<div class="also"><h4>What else may be involved?</h4><ul>
      ${otherParams.size ? `<li>The hypotheses that propose your idea also depend on: ${[...otherParams].map(id => esc(E.panelsById[id].short)).join(", ")}.</li>` : ""}
      ${bio ? `<li>Sampling: more rock, better preservation or more study can make fossils look more diverse (hypothesis H13). Compare with the Sampling panel in Stage 3.</li>` : ""}
      <li>Two curves that move together do not prove that one causes the other. A third factor, such as sea level, can drive both (H8).</li>
      <li>Most environmental curves in EvoEarth are still simplified, with a value every 5 to 20 Myr. Short events can hide between the points.</li></ul></div>
      <div class="hungry"><p><b>Want to look closer?</b> In Stage 3 you can set ${R.causeP.length ? R.causeP.map(id => esc(E.panelsById[id].short)).join(", ") : "your cause"} as Given and ${R.effectP.length ? R.effectP.map(id => esc(E.panelsById[id].short)).join(", ") : "your effect"} as Outcome, switch between alternative curves (for example temperature), and test your idea with the high-resolution diversity data at 0.5 Myr.</p>
      ${R.causeP.length && R.effectP.length ? `<button class="btn primary" id="s2-open3">Explore this in Stage 3 →</button>` : `<p class="hint">One side of this idea has no data panel, so there is nothing to open in Stage 3 for it.</p>`}</div>
      <div class="opinion"><h4>What do you think of this reply?</h4>
        <div class="seg" role="radiogroup" aria-label="Your opinion">${["Agree", "Partly agree", "Disagree", "Not sure"].map(o => `<label><input type="radio" name="op" value="${o}"> ${o}</label>`).join("")}</div>
        <textarea id="op-why" rows="2" placeholder="Why? What would you test next?"></textarea>
        <button class="btn" id="op-save">Save our opinion</button>
      </div>
    </div>`;
    return html;
  }

  function renderS2() {
    const el = $("#stage-2");
    const used = new Set(S.s2.cause.concat(S.s2.effect));
    const chip = c => cardHTML(c, { reveal: true, sel: S.s2.selected === c.id });
    const own = S.s1.custom.map(c => cardById[c.id]);
    const groups = [["Abiotic", CARDS.filter(c => c.camp === "abiotic")], ["Biotic", CARDS.filter(c => c.camp === "biotic")], ["Outcomes (added for Stage 2)", OUT]].concat(own.length ? [["Your own cards", own]] : []);
    const trials = LOG.data.events.filter(e => e.stage === 2 && e.type === "check");
    el.innerHTML = `
      <div class="st-head">
        <div><p class="kicker">Stage 2 of 4 · about 30 minutes · work in pairs</p><h1>Cause and effect</h1>
        <p class="lead">Now suggest how the concepts may be linked. Put one or more cards as the <b>cause</b> and one or more as the <b>effect</b>, for example Warming → Biodiversity. Press <b>Check this idea</b>. EvoEarth tells you, in simple terms, whether scientists have proposed the link, what the data show, how good those data are, and what else may be involved. Try as many ideas as you like.</p></div>
        <ol class="steps-mini"><li>Choose cause and effect cards</li><li>Choose the radiation</li><li>Press <b>Check this idea</b></li><li>Say what you think of the reply</li></ol>
      </div>
      <div class="s2-grid">
        <div class="card s2-pool"><h3>Cards</h3><p class="hint">Drag a card to Cause or Effect, or tap a card and then tap a box. Hover for an explanation.</p>
          <div class="dropzone pool2" data-zone="pool" tabindex="0" aria-label="Card pool">${groups.map(([n, list]) => `<div class="grp"><p class="grp-h">${n}</p>${list.filter(c => !used.has(c.id)).map(chip).join("")}</div>`).join("")}</div>
          <form class="own" id="own2-form"><label for="own2-in" class="sr">Add your own card</label><input id="own2-in" maxlength="40" placeholder="Your own concept"><button class="btn" type="submit">Add card</button></form>
        </div>
        <div class="s2-build">
          <div class="card builder">
            <div class="slot"><h3>Cause</h3><div class="dropzone slotz" data-zone="cause" tabindex="0" aria-label="Cause box">${S.s2.cause.map(id => chip(cardById[id])).join("") || `<p class="empty">Drop cause cards here</p>`}</div></div>
            <div class="arrow" aria-hidden="true">→</div>
            <div class="slot"><h3>Effect</h3><div class="dropzone slotz" data-zone="effect" tabindex="0" aria-label="Effect box">${S.s2.effect.map(id => chip(cardById[id])).join("") || `<p class="empty">Drop effect cards here</p>`}</div></div>
          </div>
          ${S.s2.selected ? `<p class="hint sel-hint">Selected: <b>${esc(cardById[S.s2.selected].label)}</b>. Tap a box, or use <button class="btn" data-place="cause">Cause</button> <button class="btn" data-place="effect">Effect</button> <button class="btn" data-place="pool">Back to pool</button></p>` : ""}
          <div class="s2-opts card">
            <span class="lbl">Test it for</span>
            <div class="seg" role="radiogroup" aria-label="Interval">${[["both", "Both radiations"], ["ce", "Cambrian explosion"], ["gobe", "GOBE"]].map(([v, n]) => `<label><input type="radio" name="iv" value="${v}" ${S.s2.iv === v ? "checked" : ""}> ${n}</label>`).join("")}</div>
            <button class="btn primary big" id="s2-check" ${S.s2.cause.length && S.s2.effect.length ? "" : "disabled"}>Check this idea</button>
            <button class="btn" id="s2-clear">Clear</button>
          </div>
          ${trials.length ? `<div class="card hist"><h4>Your ideas so far</h4><ol>${trials.map(e => `<li>${esc(e.data.causes.join(" + "))} → ${esc(e.data.effects.join(" + "))} <span class="verdict sm l${e.data.level}">${esc(e.data.verdict)}</span></li>`).join("")}</ol></div>` : ""}
        </div>
      </div>
      ${S.s2.last ? s2ResultHTML(S.s2.last) : ""}
      ${notesHTML(2, "Which ideas held up, and which did not? Did you find a feedback loop?")}
      <div class="st-next"><button class="btn" data-go="1">← Stage 1</button><button class="btn primary" data-go="3">Go to Stage 3: EvoEarth explorer →</button></div>`;
    bindTips(el);
    makeDraggable(el, (id, zone) => moveS2(id, zone), id => { S.s2.selected = S.s2.selected === id ? null : id; renderS2(); });
    if (!el._zt) { el.addEventListener("zonetap", e => onZoneTap2(e)); el._zt = true; }
    $$("[data-place]", el).forEach(b => b.addEventListener("click", () => onZoneTap2({ detail: b.dataset.place })));
    $("#own2-form").addEventListener("submit", e => { e.preventDefault(); const v = $("#own2-in").value.trim(); if (!v) return; addOwn(2, v); renderS2(); });
    $$('input[name="iv"]', el).forEach(r => r.addEventListener("change", () => { S.s2.iv = r.value; }));
    $("#s2-check").addEventListener("click", checkRelation);
    $("#s2-clear").addEventListener("click", () => { S.s2.cause = []; S.s2.effect = []; S.s2.selected = null; renderS2(); });
    const o3 = $("#s2-open3");
    if (o3) o3.addEventListener("click", () => {
      const R = S.s2.last; LOG.add(2, "open3", { trial: R.trial });
      go(3); APP.openForRelation(R.causeP, R.effectP, R.ivs.length === 1 ? R.ivs[0] : R.ivs[0], `trial ${R.trial}`);
    });
    const os = $("#op-save");
    if (os) os.addEventListener("click", () => {
      const v = ($('input[name="op"]:checked', el) || {}).value, why = $("#op-why").value.trim();
      if (!v && !why) { toast("Choose an option or write a reason first"); return; }
      LOG.add(2, "opinion", { trial: S.s2.last.trial, opinion: v || "", text: why }); toast("Opinion saved"); $("#op-why").value = "";
    });
    bindNotes(el, 2, renderS2);
    bindGo(el);
  }
  function onZoneTap2(e) { if (!S.s2.selected) return; const id = S.s2.selected; S.s2.selected = null; moveS2(id, e.detail); }
  function moveS2(id, zone) {
    S.s2.cause = S.s2.cause.filter(x => x !== id); S.s2.effect = S.s2.effect.filter(x => x !== id);
    if (zone === "cause") S.s2.cause.push(id); else if (zone === "effect") S.s2.effect.push(id);
    renderS2();
  }

  // =====================================================================
  // Stage 4: tick questions (evaluation of the tool)
  // =====================================================================
  const LIKERT = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
  // Intended learning outcomes. The same list is in the student guide, in the tick questions
  // (self-rating) and in the teacher summary (self-rating next to what the log shows).
  const OUTCOMES = [
    { id: "o1", short: "Sort and connect drivers", self: "I can sort the drivers into abiotic and biotic, and explain how life and environment change each other.", evid: "Last Stage 1 check: at least 10 cards placed, 80% or more right" },
    { id: "o2", short: "Test cause and effect in both radiations", self: "I can state a cause and effect idea, test it against data, and compare the Cambrian explosion with the GOBE.", evid: "At least 2 ideas tested, at least one for both radiations" },
    { id: "o3", short: "Judge the quality of the data", self: "I can judge how good the data are: confidence grade, real data or simplified curve, global or regional, and time resolution.", evid: "Opened \"How good are these data?\" in Stage 2, or changed a curve or the resolution in Stage 3" },
    { id: "o4", short: "Separate correlation from causation", self: "I can explain why two curves that move together do not prove a cause, and name other explanations.", evid: "Gave a written reason with an opinion on a Stage 2 reply" },
    { id: "o5", short: "Compare hypotheses on the timeline", self: "I can use the timeline to compare hypotheses and say which parameters matter most and how well they are known.", evid: "Changed the roles in Stage 3 and looked at both radiations" },
    { id: "o6", short: "Argue and reflect", self: "I can argue for a view on what drove the radiations and describe how my thinking changed.", evid: "Wrote a reflection in Stage 4" }
  ];
  const SURVEY = {
    likert: [
      ...OUTCOMES.map(o => [o.id, o.self]),
      ["t1", "Discussing with my partner was important for what I learnt."],
      ["t2", "Stages 1 and 2 made the full explorer in Stage 3 easier to use."],
      ["t3", "EvoEarth made me want to look closer at the data."],
      ["t4", "I would like to use tools like EvoEarth in other courses."]
    ],
    familiar: ["Not at all", "A little", "Quite well", "Very well"],
    background: ["Geology or geoscience", "Biology", "Chemistry", "Physics", "Mixed (we differ)", "Other"],
    helped: ["Understanding the concepts", "Seeing how Earth and life affect each other", "Judging how good the data are", "Comparing hypotheses", "Reading timelines and resolution", "Discussing with my partner", "Asking new questions"]
  };
  function surveyHTML(prev) {
    const v = prev || {};
    return `<div class="card survey" id="survey"><h3>A few quick questions</h3>
      <p class="hint">Tick what fits best for you as a pair. The answers help us improve EvoEarth and study how it works in teaching.</p>
      <fieldset class="sv-row"><legend>Before today, how well did you know the Cambrian explosion and the GOBE?</legend><div class="sv-opts">${SURVEY.familiar.map((o, i) => `<label><input type="radio" name="sv-fam" value="${i + 1}" ${String(v.familiar) === String(i + 1) ? "checked" : ""}> ${o}</label>`).join("")}</div></fieldset>
      <fieldset class="sv-row"><legend>Our main background</legend><div class="sv-opts">${SURVEY.background.map(o => `<label><input type="radio" name="sv-bg" value="${esc(o)}" ${v.background === o ? "checked" : ""}> ${esc(o)}</label>`).join("")}</div></fieldset>
      <div class="sv-table-wrap"><table class="sv-table"><thead><tr><th scope="col">How much do you agree?</th>${LIKERT.map(l => `<th scope="col">${l}</th>`).join("")}</tr></thead><tbody>
        ${SURVEY.likert.map(([id, q], k) => `${k === 0 ? `<tr class="sv-grp"><th colspan="6">After the lab: the learning goals</th></tr>` : k === OUTCOMES.length ? `<tr class="sv-grp"><th colspan="6">About the tool</th></tr>` : ""}<tr><th scope="row">${esc(q)}</th>${LIKERT.map((l, i) => `<td><label><input type="radio" name="sv-${id}" value="${i + 1}" ${String((v.likert || {})[id]) === String(i + 1) ? "checked" : ""} aria-label="${esc(l)}"><span class="sv-m">${l}</span></label></td>`).join("")}</tr>`).join("")}
      </tbody></table></div>
      <fieldset class="sv-row"><legend>What did EvoEarth help you with most? Tick any.</legend><div class="sv-opts">${SURVEY.helped.map(o => `<label><input type="checkbox" name="sv-help" value="${esc(o)}" ${(v.helped || []).includes(o) ? "checked" : ""}> ${esc(o)}</label>`).join("")}</div></fieldset>
      <button class="btn primary" id="sv-save">Save our answers</button> ${prev ? `<span class="hint">Answers saved. You can change them and save again.</span>` : ""}
    </div>`;
  }
  function readSurvey(el) {
    const val = n => (($(`input[name="${n}"]:checked`, el) || {}).value) || null;
    const likert = {}; SURVEY.likert.forEach(([id]) => { const x = val("sv-" + id); if (x) likert[id] = +x; });
    return { familiar: val("sv-fam") ? +val("sv-fam") : null, background: val("sv-bg"), likert, helped: $$('input[name="sv-help"]:checked', el).map(x => x.value) };
  }

  // =====================================================================
  // Stage 4: Summary
  // =====================================================================
  // Suggested reading, chosen from the questions the group explored.
  const NOT_PAPER = new Set(["rasmussenlecture", "determinants", "megaguilds", "pbdb", "macrostrat", "ics2026", "gts2020", "mcarthur2020"]);
  const START_READS = ["servais2009", "sperling2013", "wood2019", "bowyer2024"];
  function suggestReading(d, n) {
    n = n || 4; d = d || LOG.data;
    const byLabel = {}; Object.values(cardById).forEach(c => { byLabel[c.label] = c; });
    const hs = {}, why = {}, topics = {};
    const addH = (id, w, reason) => { if (!hypById[id]) return; hs[id] = (hs[id] || 0) + w; if (reason && !why[id]) why[id] = reason; };
    d.events.filter(e => e.stage === 2 && e.type === "check").forEach(e => {
      const idea = `${(e.data.causes || []).join(" + ")} -> ${(e.data.effects || []).join(" + ")}`;
      (e.data.hyps || []).forEach(h => addH(h, 3, idea));
      (e.data.causes || []).concat(e.data.effects || []).forEach(l => { const c = byLabel[l]; if (!c) return; (c.hyps || []).forEach(h => addH(h, 1, l)); (c.panels || []).forEach(p => { topics[p] = (topics[p] || 0) + 1; }); });
    });
    d.events.filter(e => e.stage === 1 && e.type === "check").slice(-1).forEach(e => (e.data.misplaced || []).forEach(m => { const c = cardById[m.card] || byLabel[m.label]; if (c) (c.hyps || []).forEach(h => addH(h, 0.5, `the card ${c.label}`)); }));
    const score = {}, because = {};
    Object.entries(hs).forEach(([hid, w]) => (hypById[hid].refs || []).forEach((rid, k) => {
      if (!refById[rid] || NOT_PAPER.has(rid)) return;
      score[rid] = Math.max(score[rid] || 0, w / (1 + 0.6 * k));
      if (!because[rid] || w > because[rid].w) because[rid] = { w, hid, idea: why[hid] };
    }));
    Object.entries(score).forEach(([rid]) => (refById[rid].topics || []).forEach(t => { if (topics[t]) score[rid] += 0.1; }));
    const perH = {}, out = [], seen = new Set();
    const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
    [1, 2].forEach(cap => ranked.forEach(([rid]) => {
      if (out.length >= n || seen.has(rid)) return; const b = because[rid];
      if ((perH[b.hid] || 0) >= cap) return; perH[b.hid] = (perH[b.hid] || 0) + 1; seen.add(rid);
      const h = hypById[b.hid];
      out.push({ r: refById[rid], why: `Behind ${h.id} ${h.name}${b.idea ? `, which came up in: ${b.idea}` : ""}.` });
    }));
    const tested = d.events.some(e => e.stage === 2 && e.type === "check");
    if (tested && d.events.some(e => e.stage === 2 && e.type === "check" && e.data.interval !== "ce") && !out.some(x => x.r.id === "servais2009") && refById.servais2009) out.push({ r: refById.servais2009, why: "A short overview of the drivers of the GOBE, good for comparing with the Cambrian explosion." });
    if (!out.length) START_READS.forEach(id => { if (refById[id]) out.push({ r: refById[id], why: "A good starting point on the drivers of early animal evolution." }); });
    return out.slice(0, n + 1);
  }
  const refLink = r => r.url || (r.doi ? `https://doi.org/${r.doi}` : null);
  function readingHTML() {
    const L = suggestReading();
    return `<div class="card reading"><h3>Suggested reading</h3><p class="hint">Papers behind the hypotheses that came up in the ideas you tested. The full list is in the References tab of the explorer.</p>
      <ul class="read-list">${L.map(x => { const u = refLink(x.r); return `<li><b>${esc(refShort(x.r.id))}</b> ${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(x.r.title)}</a>` : esc(x.r.title)}${x.r.journal ? `${/[.?!]$/.test(x.r.title) ? "" : "."} <span class="hint">${esc(x.r.journal)}</span>` : ""}<br><span class="hint">${esc(x.why)}</span></li>`; }).join("")}</ul></div>`;
  }

  function summaryMD(Sm) {
    const L = [];
    L.push(`# EvoEarth session summary`, ``, `Group: ${Sm.session.group || "(not set)"}  `, `Members: ${Sm.session.members || "(not given)"}  `, `Started: ${new Date(Sm.session.started).toLocaleString("en-GB")}  `, `Active time: about ${Sm.minutes} minutes  `, `App: ${Sm.session.app}`, ``);
    L.push(`## How the session developed`, ...LOG.narrative(Sm).map(x => `- ${x}`), ``);
    L.push(`## Stage 1: concepts`);
    Sm.s1.checks.forEach((c, i) => L.push(`- Check ${i + 1}: ${c.correct} of ${c.placed} correct${c.misplaced.length ? `; moved: ${c.misplaced.map(m => m.label).join(", ")}` : ""}`));
    if (Sm.s1.custom.length) L.push(`- Own cards: ${Sm.s1.custom.join(", ")}`);
    Sm.s1.insights.forEach(x => L.push(`- Insight: ${x}`)); Sm.s1.feedback.forEach(x => L.push(`- Feedback: ${x}`)); L.push(``);
    L.push(`## Stage 2: cause and effect`);
    Sm.s2.trials.forEach(t => L.push(`- Trial ${t.id}: ${t.causes.join(" + ")} -> ${t.effects.join(" + ")}: ${t.verdict}${t.opinion ? `. Our opinion: ${t.opinion.opinion}${t.opinion.text ? ` (${t.opinion.text})` : ""}` : ""}`));
    Sm.s2.insights.forEach(x => L.push(`- Insight: ${x}`)); Sm.s2.feedback.forEach(x => L.push(`- Feedback: ${x}`)); L.push(``);
    L.push(`## Stage 3: explorer`, `- Changes made: ${Sm.s3.actions}`, `- Resolutions tried: ${Sm.s3.resolutions.join(", ") || "none"}`, `- Role settings tried: ${Sm.s3.presets.join(", ") || "none"}`, `- Curves chosen: ${Sm.s3.curves.join("; ") || "none"}`);
    Sm.s3.insights.forEach(x => L.push(`- Insight: ${x}`)); Sm.s3.feedback.forEach(x => L.push(`- Feedback: ${x}`)); L.push(``);
    if (Sm.s4.survey) { const v = Sm.s4.survey; L.push(`## Tick questions`, `- Familiarity before: ${v.familiar ? SURVEY.familiar[v.familiar - 1] : "-"}`, `- Background: ${v.background || "-"}`, ...SURVEY.likert.map(([id, q]) => `- ${q} ${v.likert && v.likert[id] ? LIKERT[v.likert[id] - 1] : "-"}`), `- Helped most with: ${(v.helped || []).join(", ") || "-"}`, ``); }
    L.push(`## Reflection`); Sm.s4.reflections.forEach(x => L.push(`- ${x}`)); Sm.s4.feedback.forEach(x => L.push(`- Feedback: ${x}`));
    return L.join("\n");
  }
  function renderS4() {
    const el = $("#stage-4");
    const Sm = LOG.summarise();
    const nar = LOG.narrative(Sm);
    const allFb = [].concat(Sm.s1.feedback.map(x => ["1", x]), Sm.s2.feedback.map(x => ["2", x]), Sm.s3.feedback.map(x => ["3", x]), Sm.s4.feedback.map(x => ["4", x]));
    const allIns = [].concat(Sm.s1.insights.map(x => ["1", x]), Sm.s2.insights.map(x => ["2", x]), Sm.s3.insights.map(x => ["3", x]));
    const bars = Sm.s1.checks.map((c, i) => `<div class="mbar"><span class="mlbl">Check ${i + 1}</span><span class="mtrack"><span class="mfill" style="width:${c.placed ? Math.round(100 * c.correct / c.placed) : 0}%"></span></span><span class="mval num">${c.correct}/${c.placed}</span></div>`).join("");
    el.innerHTML = `
      <div class="st-head"><div><p class="kicker">Stage 4 of 4 · before you leave</p><h1>Summary of your session</h1>
        <p class="lead">This page collects what you did and wrote in Stages 1 to 3. Read it together, answer the tick questions, add a short reflection, and then download the summary as a PDF and hand it in. The PDF is your proof that you have finished the lab.</p></div>
        <div class="sess card"><p><b>Group:</b> ${esc(Sm.session.group || "not set")}${Sm.session.members ? `<br><b>Members:</b> ${esc(Sm.session.members)}` : ""}<br><b>Time:</b> about ${Sm.minutes} min · ${Sm.nEvents} logged steps</p><button class="btn" id="s4-edit">Change group name</button></div>
      </div>
      <div class="s4-grid">
        <div class="card"><h3>How your session developed</h3><ul class="nar">${nar.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div class="card"><h3>Stage 1: sorting checks</h3>${bars || `<p class="hint">No checks yet.</p>`}${Sm.s1.oftenMisplaced.length ? `<p class="hint">Moved by the checks: ${Sm.s1.oftenMisplaced.map(x => esc(x[0])).join(", ")}</p>` : ""}</div>
        <div class="card wide"><h3>Stage 2: your cause and effect ideas</h3>${Sm.s2.trials.length ? `<table class="s4t"><thead><tr><th>#</th><th>Idea</th><th>EvoEarth reply</th><th>Your opinion</th></tr></thead><tbody>${Sm.s2.trials.map(t => `<tr><td>${t.id}</td><td>${esc(t.causes.join(" + "))} → ${esc(t.effects.join(" + "))}</td><td><span class="verdict sm l${t.level}">${esc(t.verdict)}</span></td><td>${t.opinion ? esc(t.opinion.opinion + (t.opinion.text ? ": " + t.opinion.text : "")) : "–"}</td></tr>`).join("")}</tbody></table>` : `<p class="hint">No ideas tested yet.</p>`}</div>
        <div class="card"><h3>Stage 3: explorer</h3><p>${Sm.s3.actions} changes. Resolutions: ${esc(Sm.s3.resolutions.join(", ") || "none")}. Role settings: ${esc(Sm.s3.presets.join(", ") || "none")}.</p>${Sm.s3.curves.length ? `<p class="hint">Curves chosen: ${esc(Sm.s3.curves.join("; "))}</p>` : ""}${Sm.s3.ages.length ? `<p class="hint">Ages looked at: ${[...new Set(Sm.s3.ages.map(a => Math.round(a)))].slice(-12).join(", ")} Ma</p>` : ""}</div>
        <div class="card"><h3>Your insights</h3>${allIns.length ? `<ul>${allIns.map(([s, x]) => `<li><span class="tag insight">Stage ${s}</span> ${esc(x)}</li>`).join("")}</ul>` : `<p class="hint">No insights saved yet.</p>`}</div>
        <div class="card"><h3>Your feedback on the tool</h3>${allFb.length ? `<ul>${allFb.map(([s, x]) => `<li><span class="tag feedback">Stage ${s}</span> ${esc(x)}</li>`).join("")}</ul>` : `<p class="hint">No feedback yet.</p>`}</div>
      </div>
      ${readingHTML()}
      ${surveyHTML(Sm.s4.survey)}
      <div class="card reflect"><label for="refl"><b>Reflection:</b> what changed in your thinking about the causes of the two radiations?</label>
        <textarea id="refl" rows="3"></textarea><button class="btn" id="refl-save">Save reflection</button>
        ${Sm.s4.reflections.length ? `<ul>${Sm.s4.reflections.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        <label for="fb-4" style="margin-top:10px;display:block"><b>Anything else that did not work?</b></label><textarea id="fb-4" rows="2"></textarea><button class="btn" id="fb4-save">Send feedback</button></div>
      <div class="card handin"><h3>Finish and hand in</h3>
        <p>When you are done, press <b>Download readable PDF</b> and upload the PDF where your teachers ask (for example in Absalon). The PDF shows this summary and also carries your full session log, so your teachers can read all the PDFs together. Do not edit or print the PDF to a new file, because that removes the log.</p>
        ${Sm.s4.survey ? "" : `<p class="hint">Please answer the tick questions above before you download.</p>`}
        <div class="hand-btns"><button class="btn primary big" id="s4-md">Download readable PDF</button><button class="btn" id="s4-new">Start a new session</button></div>
        ${LOG.stored ? "" : `<p class="warn">The log is kept only while this page is open. Download the PDF before you reload or close the page. If you work on after downloading, download it again at the end.</p>`}
      </div>`;
    $("#sv-save").addEventListener("click", () => {
      const a = readSurvey(el);
      if (!a.familiar && !a.background && !Object.keys(a.likert).length && !a.helped.length) { toast("Tick at least one answer first"); return; }
      LOG.add(4, "survey", a); toast("Answers saved"); renderS4(); const sv = $("#survey"); if (sv) sv.scrollIntoView({ block: "nearest" });
    });
    $("#refl-save").addEventListener("click", () => { const v = $("#refl").value.trim(); if (!v) return; LOG.add(4, "reflection", { text: v }); renderS4(); });
    $("#fb4-save").addEventListener("click", () => { const v = $("#fb-4").value.trim(); if (!v) return; LOG.add(4, "feedback", { text: v }); renderS4(); });
    $("#s4-edit").addEventListener("click", () => sessionDialog(true));
    $("#s4-md").addEventListener("click", async () => {
      const d = newPDF(); if (!d) return;
      LOG.add(4, "submit", { kind: "summary-pdf" });
      try {
        const packed = await LOG.packData();
        pdfSession(d, LOG.summarise(), true, packed);
        d.save(`evoearth_${slug(Sm.session.group)}_${new Date().toISOString().slice(0, 10)}.pdf`);
        LOG.markHandedIn(); toast("PDF downloaded. Upload it where your teachers ask.");
      } catch (e) { toast("Could not make the PDF in this browser"); }
    });
    $("#s4-new").addEventListener("click", () => { if (!confirm("Start a new session? Download the PDF first if you have not. The current log will be cleared from this browser.")) return; LOG.reset(); location.hash = "#stage1"; location.reload(); });
  }
  document.addEventListener("toggle", e => { const t = e.target; if (t && t.tagName === "DETAILS" && t.open && t.closest && t.closest("#s2-result")) LOG.add(2, "quality", {}); }, true);
  const slug = s => (s || "group").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "group";
  function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  // =====================================================================
  // PDF helpers (jsPDF, standard fonts, so text is reduced to Latin-1)
  // =====================================================================
  const clean = t => String(t == null ? "" : t).replace(/→/g, "->").replace(/[–—]/g, "-").replace(/δ/g, "d").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[^\x00-\xFF]/g, "?");
  function newPDF() {
    const J = window.jspdf && window.jspdf.jsPDF; if (!J) { toast("The PDF library did not load"); return null; }
    const d = new J({ unit: "pt", format: "a4" }); d._y = 56; return d;
  }
  const PW = 499, PX = 48;
  function ensure(d, h) { if (d._y + h > 790) { d.addPage(); d._y = 56; } }
  function pH(d, t, size) { size = size || 13; ensure(d, size + 24); d._y += 4; d.setFont("helvetica", "bold"); d.setFontSize(size); d.setTextColor(35, 32, 27); d.text(clean(t), PX, d._y); d._y += size + 5; }
  function pP(d, t, o) {
    o = o || {}; d.setFont("helvetica", o.bold ? "bold" : "normal"); d.setFontSize(o.size || 9.5); d.setTextColor(o.grey ? 107 : 35, o.grey ? 100 : 32, o.grey ? 90 : 27);
    const ind = o.indent || 0, lines = d.splitTextToSize(clean(t), PW - ind);
    lines.forEach((l, i) => { ensure(d, 13); if (o.bullet && i === 0) d.text("-", PX + ind - 8, d._y); d.text(l, PX + ind, d._y); d._y += 12.5; });
    d._y += 2.5; d.setTextColor(35, 32, 27);
  }
  const pLi = (d, t) => pP(d, t, { indent: 10, bullet: true });
  function pTable(d, head, body, widths) {
    const opts = { head: [head.map(clean)], body: body.map(r => r.map(clean)), startY: d._y, margin: { left: PX, right: PX }, styles: { fontSize: 8.5, cellPadding: 3.5, overflow: "linebreak" }, headStyles: { fillColor: [31, 111, 115], textColor: 255 }, alternateRowStyles: { fillColor: [246, 243, 236] } };
    if (widths) { opts.columnStyles = {}; widths.forEach((w, i) => { if (w) opts.columnStyles[i] = { cellWidth: w }; }); }
    if (typeof d.autoTable === "function") d.autoTable(opts); else if (window.jspdf && window.jspdf.autoTable) window.jspdf.autoTable(d, opts);
    d._y = (d.lastAutoTable ? d.lastAutoTable.finalY : d._y) + 12;
  }
  function pFooter(d, txt) {
    const n = d.getNumberOfPages();
    for (let i = 1; i <= n; i++) { d.setPage(i); d.setFont("helvetica", "normal"); d.setFontSize(7.5); d.setTextColor(120, 115, 105); d.text(clean(`${txt}  |  page ${i} of ${n}`), PX, 820); }
    d.setTextColor(35, 32, 27);
  }
  function pdfSession(d, Sm, standalone, packed) {
    pH(d, `EvoEarth session summary: ${Sm.session.group || "group not named"}`, 16);
    pP(d, `Members: ${Sm.session.members || "not given"}  |  Started: ${new Date(Sm.session.started).toLocaleString("en-GB")}  |  Active time: about ${Sm.minutes} min  |  ${Sm.nEvents} logged steps  |  ${Sm.session.app}`, { grey: true });
    pH(d, "How the session developed"); LOG.narrative(Sm).forEach(x => pLi(d, x));
    pH(d, "Stage 1: concepts");
    if (Sm.s1.checks.length) pTable(d, ["Check", "Correct", "Placed", "Moved by the check"], Sm.s1.checks.map((c, i) => [String(i + 1), String(c.correct), String(c.placed), c.misplaced.map(m => m.label).join(", ") || "-"]), [40, 50, 50]);
    else pP(d, "No sorting check was recorded.", { grey: true });
    if (Sm.s1.custom.length) pP(d, `Own cards: ${Sm.s1.custom.join(", ")}`);
    pH(d, "Stage 2: cause and effect");
    if (Sm.s2.trials.length) pTable(d, ["#", "Idea", "EvoEarth reply", "Opinion"], Sm.s2.trials.map(t => [String(t.id), `${t.causes.join(" + ")} -> ${t.effects.join(" + ")}`, t.verdict, t.opinion ? `${t.opinion.opinion || ""}${t.opinion.text ? ": " + t.opinion.text : ""}` : "-"]), [24, 170, 130]);
    else pP(d, "No idea was tested.", { grey: true });
    pH(d, "Stage 3: explorer");
    pP(d, `${Sm.s3.actions} changes. Resolutions: ${Sm.s3.resolutions.join(", ") || "none"}. Role settings: ${Sm.s3.presets.join(", ") || "none"}. Curves: ${Sm.s3.curves.join("; ") || "none"}.`);
    const ins = [].concat(Sm.s1.insights.map(x => ["1", x]), Sm.s2.insights.map(x => ["2", x]), Sm.s3.insights.map(x => ["3", x]));
    pH(d, "Insights"); if (ins.length) ins.forEach(([st, x]) => pLi(d, `Stage ${st}: ${x}`)); else pP(d, "None saved.", { grey: true });
    const v = Sm.s4.survey;
    pH(d, "Tick questions");
    if (v) {
      pP(d, `Familiarity before the lab: ${v.familiar ? SURVEY.familiar[v.familiar - 1] : "-"}  |  Background: ${v.background || "-"}`);
      pTable(d, ["Statement", "Answer"], SURVEY.likert.map(([id, q]) => [q, v.likert && v.likert[id] ? LIKERT[v.likert[id] - 1] : "-"]), [380]);
      pP(d, `Helped most with: ${(v.helped || []).join(", ") || "-"}`);
    } else pP(d, "Not answered.", { grey: true });
    pH(d, "Learning goals");
    pTable(d, ["Learning goal", "Your self-rating", "Seen in your log"], OUTCOMES.map(o => [o.short, v && v.likert && v.likert[o.id] ? LIKERT[v.likert[o.id] - 1] : "-", Sm.evid && Sm.evid[o.id] ? "Yes" : "Not yet"]), [260, 110]);
    pP(d, "Seen in your log means that the session log shows the matching activity. It is a guide for discussion, not a grade.", { grey: true });
    const rd = suggestReading(Sm.raw, 4);
    pH(d, "Suggested reading");
    rd.forEach(x => { const u = refLink(x.r); pLi(d, `${refShort(x.r.id)} ${x.r.title}${/[.?!]$/.test(x.r.title) ? "" : "."} ${x.r.journal || ""}${u ? ` ${u}` : ""}`); pP(d, x.why, { grey: true, indent: 10 }); });
    pH(d, "Reflection"); if (Sm.s4.reflections.length) Sm.s4.reflections.forEach(x => pLi(d, x)); else pP(d, "None saved.", { grey: true });
    const fb = [].concat(Sm.s1.feedback.map(x => ["1", x]), Sm.s2.feedback.map(x => ["2", x]), Sm.s3.feedback.map(x => ["3", x]), Sm.s4.feedback.map(x => ["4", x]));
    pH(d, "Feedback on the tool"); if (fb.length) fb.forEach(([st, x]) => pLi(d, `Stage ${st}: ${x}`)); else pP(d, "None given.", { grey: true });
    if (packed) {
      pP(d, "This PDF also carries the full EvoEarth session log, so that the teachers can read many PDFs together. Please hand in the file as it is.", { grey: true });
      d.setDocumentProperties({ title: `EvoEarth session summary: ${clean(Sm.session.group || "group")}`, subject: "EvoEarth session summary", author: clean(Sm.session.group || "EvoEarth"), creator: Sm.session.app, keywords: packed });
    }
    if (standalone) pFooter(d, `EvoEarth ${Sm.session.group || ""} summary, ${new Date().toLocaleDateString("en-GB")}`);
  }
  function pdfOverall(ok, user) {
    const d = newPDF(); if (!d) return null;
    const A = aggregate(ok);
    pH(d, "EvoEarth overall summary", 18);
    pP(d, `Geobiology lab, IGN and Globe Institute, University of Copenhagen. Generated ${new Date().toLocaleString("en-GB")} by ${user || "teacher"} from ${ok.length} student ${ok.length === 1 ? "PDF" : "PDFs"}.`, { grey: true });
    pH(d, "Overview");
    pLi(d, `${ok.length} ${ok.length === 1 ? "session" : "sessions"}, ${A.trials} cause and effect ${A.trials === 1 ? "trial" : "trials"}, median active time ${A.median} min.`);
    pLi(d, `Stage 1 accuracy: first check ${A.firstPct == null ? "-" : A.firstPct + "%"}, last check ${A.lastPct == null ? "-" : A.lastPct + "%"}.`);
    pLi(d, `Opinions on Stage 2 replies: ${Object.entries(A.ops).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}.`);
    pH(d, "Learning goals");
    pTable(d, ["Learning goal", "Seen in the log when", "Self-rating mean (n)", "Agreed", "Seen in the log"], A.outc.map(o => [o.short, o.evid, o.mean == null ? "-" : `${o.mean.toFixed(1)} (${o.n})`, o.n ? Math.round(100 * o.agree / o.n) + "%" : "-", `${o.seenPct}% (${o.seen} of ${ok.length})`]), [120, 170, 70, 45]);
    pP(d, "Self-rating is the mean of the matching \"I can...\" tick question. Agreed is the share answering 4 or 5. Seen in the log is the share of groups whose log shows the activity. Both are indicators, not grades.", { grey: true });
    pH(d, "Tick questions");
    if (A.sv.n) {
      pTable(d, ["Statement", "n", "Mean (1-5)"].concat(LIKERT.map((l, i) => String(i + 1))), A.sv.items.map(it => [it.q, String(it.n), it.mean == null ? "-" : it.mean.toFixed(1)].concat(it.dist.map(String))), [220, 24, 50]);
      pP(d, `Scale: ${LIKERT.map((l, i) => `${i + 1} ${l}`).join(", ")}.`, { grey: true });
      pP(d, `Background: ${Object.entries(A.sv.bg).map(([k, v]) => `${k} ${v}`).join(", ") || "-"}`);
      pP(d, `Familiarity before: ${Object.entries(A.sv.fam).map(([k, v]) => `${k} ${v}`).join(", ") || "-"}`);
      pP(d, `Helped most with: ${Object.entries(A.sv.helped).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") || "-"}`);
    } else pP(d, "No group answered the tick questions.", { grey: true });
    pH(d, "Most often misplaced cards");
    if (A.miss.length) pTable(d, ["Card", "Times moved"], A.miss.slice(0, 15).map(([k, v]) => [k, String(v)]), [300]); else pP(d, "None.", { grey: true });
    pH(d, "Cause and effect ideas tried");
    if (A.rel.length) pTable(d, ["Idea", "Groups", "EvoEarth reply", "Opinions"], A.rel.map(([k, v]) => [k, String(v.n), v.verdict, Object.entries(v.op).map(([a, b]) => `${a} ${b}`).join(", ") || "-"]), [190, 40, 130]); else pP(d, "None.", { grey: true });
    pH(d, "Sessions");
    pTable(d, ["Group", "Min", "Stage 1 checks", "Trials", "Stage 3 changes", "Insights", "Feedback"], A.sums.map(s => [s.session.group || "-", String(s.minutes), s.s1.checks.map(c => `${c.correct}/${c.placed}`).join(", ") || "-", String(s.s2.trials.length), String(s.s3.actions), String(s.s1.insights.length + s.s2.insights.length + s.s3.insights.length), String(s.s1.feedback.length + s.s2.feedback.length + s.s3.feedback.length + s.s4.feedback.length)]));
    pH(d, "All feedback on the tool");
    const fb = A.sums.flatMap(s => [].concat(s.s1.feedback.map(x => [1, x]), s.s2.feedback.map(x => [2, x]), s.s3.feedback.map(x => [3, x]), s.s4.feedback.map(x => [4, x])).map(([st, x]) => `${s.session.group}, stage ${st}: ${x}`));
    if (fb.length) fb.forEach(x => pLi(d, x)); else pP(d, "None.", { grey: true });
    pH(d, "All insights and reflections");
    const ins = A.sums.flatMap(s => [].concat(s.s1.insights.map(x => [1, x]), s.s2.insights.map(x => [2, x]), s.s3.insights.map(x => [3, x]), s.s4.reflections.map(x => ["4, reflection", x])).map(([st, x]) => `${s.session.group}, stage ${st}: ${x}`));
    if (ins.length) ins.forEach(x => pLi(d, x)); else pP(d, "None.", { grey: true });
    A.sums.forEach(Sm => { d.addPage(); d._y = 56; pdfSession(d, Sm, false); });
    pFooter(d, `EvoEarth overall summary, ${new Date().toLocaleDateString("en-GB")}`);
    return d;
  }

  // =====================================================================
  // Teacher page (login, then read the student PDFs, which carry the session log)
  // =====================================================================
  const TS = { key: null, user: null, files: [], busy: false };
  function renderTeacher() {
    const el = $("#stage-teacher");
    if (!TS.key) {
      el.innerHTML = `<div class="st-head"><div><p class="kicker">Teachers only</p><h1>Teacher login</h1>
        <p class="lead">Log in to read the PDFs that the students hand in, see what they did and how far they reached the learning goals, and download an overall summary.</p></div></div>
        <form class="card t-login" id="t-login" autocomplete="off">
          <label for="t-user">User</label><input id="t-user" maxlength="10" autocapitalize="characters" placeholder="Your initials">
          <label for="t-pw">Password</label><input id="t-pw" type="password" maxlength="60">
          <div class="hand-btns"><button class="btn primary big" type="submit" ${TS.busy ? "disabled" : ""}>${TS.busy ? "Checking..." : "Log in"}</button></div>
          <p class="warn" id="t-err" hidden></p>
          <details class="hint"><summary>Use a key file instead</summary><label class="btn">Load teacher key file <input type="file" id="t-key" accept=".json" hidden></label></details>
        </form>`;
      $("#t-login").addEventListener("submit", async e => {
        e.preventDefault(); if (TS.busy) return;
        const u = $("#t-user").value, pw = $("#t-pw").value, err = $("#t-err");
        if (!LOG.cryptoOK()) { err.hidden = false; err.textContent = "The login needs a secure (https) page."; return; }
        TS.busy = true; e.submitter && (e.submitter.textContent = "Checking...");
        try { const r = await LOG.teacherLogin(u, pw); TS.key = r.key; TS.user = r.user; TS.busy = false; renderTeacher(); }
        catch (x) { TS.busy = false; err.hidden = false; err.textContent = "Wrong user or password."; if (e.submitter) e.submitter.textContent = "Log in"; }
      });
      $("#t-key").addEventListener("change", async e => {
        try { const j = JSON.parse(await e.target.files[0].text()); TS.key = j.privateKey || j; TS.user = "key file"; renderTeacher(); } catch (x) { toast("That is not a valid key file"); }
      });
      return;
    }
    const ok = TS.files.filter(f => f.data);
    el.innerHTML = `<div class="st-head"><div><p class="kicker">Teachers only · logged in as ${esc(TS.user)}</p><h1>Session summaries</h1>
      <p class="lead">Load the PDFs that the students handed in (for example downloaded from Absalon). Select many at once. They are read in this browser; nothing is uploaded. Then read the overview or download the overall summary.</p></div>
      <div class="sess card"><p><b>${esc(TS.user)}</b><br>${ok.length} session${ok.length === 1 ? "" : "s"} loaded</p><button class="btn" id="t-out">Log out</button></div></div>
      <div class="card t-load">
        <label class="btn primary">Load student PDFs <input type="file" id="t-files" accept=".pdf,application/pdf,.evoearth" multiple hidden></label>
        <span class="hint">${TS.files.length ? `${ok.length} opened${TS.files.length - ok.length ? `, ${TS.files.length - ok.length} failed` : ""}. You can add more files at any time.` : "You can select many files at once."}</span>
        ${ok.length ? `<div class="hand-btns"><button class="btn primary" id="t-pdf">Overall summary with all sessions (PDF)</button><button class="btn" id="t-csv">All events (CSV)</button><button class="btn" id="t-json">Combined data (JSON)</button><button class="btn" id="t-clear">Clear loaded files</button></div>` : ""}
      </div>
      ${ok.length ? teacherOverview(ok) : ""}
      ${TS.files.filter(f => !f.data).map(f => `<p class="warn">${esc(f.name)}: ${esc(f.err)}</p>`).join("")}`;
    $("#t-out").addEventListener("click", () => { TS.key = null; TS.user = null; TS.files = []; renderTeacher(); });
    $("#t-files").addEventListener("change", async e => {
      for (const f of e.target.files) {
        try {
          let d;
          if (/\.evoearth$/i.test(f.name)) d = await LOG.unlock(JSON.parse(await f.text()), TS.key);
          else d = await LOG.readPDF(await f.arrayBuffer());
          const i = TS.files.findIndex(x => x.data && x.data.session.id === d.session.id);
          if (i >= 0) { if (d.events.length > TS.files[i].data.events.length) TS.files[i] = { name: f.name, data: d }; continue; }
          TS.files.push({ name: f.name, data: d });
        } catch (x) { TS.files.push({ name: f.name, err: /\.evoearth$/i.test(f.name) ? "could not be opened with this key" : `${x.message}. Use the PDF from the Download button in Stage 4, not a printed or edited copy.` }); }
      }
      renderTeacher();
    });
    if (ok.length) {
      $("#t-pdf").addEventListener("click", () => { const d = pdfOverall(ok, TS.user); if (d) d.save(`evoearth_overall_summary_${new Date().toISOString().slice(0, 10)}.pdf`); });
      $("#t-clear").addEventListener("click", () => { TS.files = []; renderTeacher(); });
      $("#t-csv").addEventListener("click", () => {
        const rows = [["group", "session_id", "time", "stage", "type", "data"]];
        ok.forEach(f => f.data.events.forEach(e => rows.push([f.data.session.group, f.data.session.id, e.t, e.stage, e.type, JSON.stringify(e.data)])));
        download("evoearth_all_events.csv", rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
      });
      $("#t-json").addEventListener("click", () => download("evoearth_combined.json", JSON.stringify(ok.map(f => f.data), null, 1), "application/json"));
      $$("[data-spdf]", el).forEach(b => b.addEventListener("click", async () => {
        const f = ok[+b.dataset.spdf], d = newPDF(); if (!d) return;
        pdfSession(d, LOG.summarise(f.data), true, await LOG.packData(f.data)); d.save(`evoearth_summary_${slug(f.data.session.group)}.pdf`);
      }));
    }
  }
  function aggregate(ok) {
    const sums = ok.map(f => LOG.summarise(f.data));
    const first = sums.filter(s => s.s1.checks.length).map(s => s.s1.checks[0]);
    const pct = a => a.length ? Math.round(100 * a.reduce((x, c) => x + c.correct, 0) / Math.max(1, a.reduce((x, c) => x + c.placed, 0))) : null;
    const lastC = sums.filter(s => s.s1.checks.length).map(s => s.s1.checks[s.s1.checks.length - 1]);
    const miss = {}; sums.forEach(s => s.s1.checks.forEach(c => c.misplaced.forEach(m => { miss[m.label] = (miss[m.label] || 0) + 1; })));
    const rel = {}; sums.forEach(s => s.s2.trials.forEach(t => { const k = `${t.causes.join(" + ")} → ${t.effects.join(" + ")}`; rel[k] = rel[k] || { n: 0, verdict: t.verdict, op: {} }; rel[k].n++; if (t.opinion && t.opinion.opinion) rel[k].op[t.opinion.opinion] = (rel[k].op[t.opinion.opinion] || 0) + 1; }));
    const ops = {}; sums.forEach(s => s.s2.trials.forEach(t => { if (t.opinion && t.opinion.opinion) ops[t.opinion.opinion] = (ops[t.opinion.opinion] || 0) + 1; }));
    const svs = sums.map(x => x.s4.survey).filter(Boolean);
    const cnt = arr => { const o = {}; arr.filter(Boolean).forEach(k => { o[k] = (o[k] || 0) + 1; }); return o; };
    const sv = {
      n: svs.length,
      items: SURVEY.likert.map(([id, q]) => { const v = svs.map(a => a.likert && a.likert[id]).filter(Boolean); return { id, q, n: v.length, mean: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, dist: [1, 2, 3, 4, 5].map(k => v.filter(x => x === k).length) }; }),
      bg: cnt(svs.map(a => a.background)), fam: cnt(svs.map(a => a.familiar ? SURVEY.familiar[a.familiar - 1] : null)), helped: cnt(svs.flatMap(a => a.helped || []))
    };
    const mins = sums.map(x => x.minutes).sort((a, b) => a - b);
    const outc = OUTCOMES.map(o => {
      const v = svs.map(a => a.likert && a.likert[o.id]).filter(Boolean);
      const e = sums.filter(x => x.evid && x.evid[o.id]).length;
      return { ...o, n: v.length, mean: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, agree: v.filter(x => x >= 4).length, seen: e, seenPct: sums.length ? Math.round(100 * e / sums.length) : 0 };
    });
    return { outc, sv, median: mins.length ? mins[Math.floor(mins.length / 2)] : 0, sums, firstPct: pct(first), lastPct: pct(lastC), miss: Object.entries(miss).sort((a, b) => b[1] - a[1]), rel: Object.entries(rel).sort((a, b) => b[1].n - a[1].n), ops, trials: sums.reduce((x, s) => x + s.s2.trials.length, 0), minutes: sums.map(s => s.minutes) };
  }
  function teacherOverview(ok) {
    const A = aggregate(ok);
    return `<div class="s4-grid">
      <div class="card"><h3>Overview</h3><p>${ok.length} ${ok.length === 1 ? "session" : "sessions"} · ${A.trials} cause and effect ${A.trials === 1 ? "trial" : "trials"} · median time ${A.median} min</p><p>Stage 1 accuracy: first check ${A.firstPct == null ? "–" : A.firstPct + "%"}, last check ${A.lastPct == null ? "–" : A.lastPct + "%"}.</p><p class="hint">Opinions on Stage 2 replies: ${Object.entries(A.ops).map(([k, v]) => `${esc(k)} ${v}`).join(", ") || "none"}</p></div>
      <div class="card"><h3>Most often misplaced cards</h3><ol>${A.miss.slice(0, 10).map(([k, v]) => `<li>${esc(k)} (${v})</li>`).join("") || "<li>none</li>"}</ol></div>
      <div class="card wide"><h3>Learning goals</h3><p class="hint">Self-rating: mean of the "I can..." tick questions (1 strongly disagree to 5 strongly agree) and the share that agreed. Seen in the log: share of groups whose log shows the activity. The two measures are indicators, not grades.</p>
        <table class="s4t"><thead><tr><th>Learning goal</th><th>Self-rating</th><th>Agreed (4 or 5)</th><th>Seen in the log</th></tr></thead><tbody>${A.outc.map(o => `<tr><td><b>${esc(o.short)}</b><br><span class="hint">${esc(o.evid)}</span></td><td>${o.mean == null ? "–" : o.mean.toFixed(1)} <span class="hint">(n ${o.n})</span></td><td>${o.n ? Math.round(100 * o.agree / o.n) + "%" : "–"}</td><td><span class="mtrack ob"><span class="mfill" style="width:${o.seenPct}%"></span></span> ${o.seenPct}% <span class="hint">(${o.seen} of ${ok.length})</span></td></tr>`).join("")}</tbody></table></div>
      <div class="card wide"><h3>Cause and effect ideas tried</h3><table class="s4t"><thead><tr><th>Idea</th><th>Groups</th><th>EvoEarth reply</th><th>Opinions</th></tr></thead><tbody>${A.rel.slice(0, 30).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${esc(v.verdict)}</td><td>${Object.entries(v.op).map(([a, b]) => `${esc(a)} ${b}`).join(", ") || "–"}</td></tr>`).join("")}</tbody></table></div>
      <div class="card wide"><h3>Tick questions</h3>${A.sv.n ? `<p class="hint">${A.sv.n} of ${ok.length} groups answered. Mean on a scale from 1 (strongly disagree) to 5 (strongly agree).</p>${A.sv.items.map(it => `<div class="mbar sv-bar"><span class="mlbl">${esc(it.q)}</span><span class="mtrack"><span class="mfill" style="width:${it.mean ? Math.round(100 * (it.mean - 1) / 4) : 0}%"></span></span><span class="mval num">${it.mean == null ? "–" : it.mean.toFixed(1)}</span></div>`).join("")}<p class="hint">Background: ${Object.entries(A.sv.bg).map(([k, v]) => `${esc(k)} ${v}`).join(", ") || "–"} · Helped most with: ${Object.entries(A.sv.helped).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} ${v}`).join(", ") || "–"}</p>` : `<p class="hint">No group has answered the tick questions yet.</p>`}</div>
      <div class="card wide"><h3>Sessions</h3><table class="s4t"><thead><tr><th>Group</th><th>Minutes</th><th>Stage 1 checks</th><th>Stage 2 trials</th><th>Stage 3 changes</th><th>Insights</th><th>Feedback</th><th>Summary</th></tr></thead><tbody>${A.sums.map((s, i) => `<tr><td>${esc(s.session.group)}</td><td>${s.minutes}</td><td>${s.s1.checks.map(c => `${c.correct}/${c.placed}`).join(", ") || "–"}</td><td>${s.s2.trials.length}</td><td>${s.s3.actions}</td><td>${s.s1.insights.length + s.s2.insights.length + s.s3.insights.length}</td><td>${s.s1.feedback.length + s.s2.feedback.length + s.s3.feedback.length + s.s4.feedback.length}</td><td><button class="btn" data-spdf="${i}">PDF</button></td></tr>`).join("")}</tbody></table></div>
      <div class="card wide"><h3>All feedback on the tool</h3><ul>${A.sums.flatMap(s => [].concat(s.s1.feedback.map(x => [1, x]), s.s2.feedback.map(x => [2, x]), s.s3.feedback.map(x => [3, x]), s.s4.feedback.map(x => [4, x])).map(([st, x]) => `<li><b>${esc(s.session.group)}</b>, stage ${st}: ${esc(x)}</li>`)).join("") || "<li>none</li>"}</ul></div>
      <div class="card wide"><h3>All insights and reflections</h3><ul>${A.sums.flatMap(s => [].concat(s.s1.insights.map(x => [1, x]), s.s2.insights.map(x => [2, x]), s.s3.insights.map(x => [3, x]), s.s4.reflections.map(x => ["4 reflection", x])).map(([st, x]) => `<li><b>${esc(s.session.group)}</b>, stage ${st}: ${esc(x)}</li>`)).join("") || "<li>none</li>"}</ul></div>
    </div>`;
  }
  function overallMD(ok) {
    const A = aggregate(ok);
    const L = [`# EvoEarth overall summary`, ``, `Sessions: ${ok.length}  `, `Stage 2 trials: ${A.trials}  `, `Stage 1 accuracy, first check: ${A.firstPct}%, last check: ${A.lastPct}%`, ``, `## Most often misplaced cards`, ...A.miss.map(([k, v]) => `- ${k}: ${v}`), ``, `## Cause and effect ideas`, ...A.rel.map(([k, v]) => `- ${k} (${v.n} groups): ${v.verdict}. Opinions: ${Object.entries(v.op).map(([a, b]) => `${a} ${b}`).join(", ") || "none"}`), ``, `## Feedback on the tool`];
    A.sums.forEach(s => [].concat(s.s1.feedback, s.s2.feedback, s.s3.feedback, s.s4.feedback).forEach(x => L.push(`- ${s.session.group}: ${x}`)));
    L.push(``, `## Insights and reflections`);
    A.sums.forEach(s => [].concat(s.s1.insights, s.s2.insights, s.s3.insights, s.s4.reflections).forEach(x => L.push(`- ${s.session.group}: ${x}`)));
    L.push(``, `## Session summaries`);
    ok.forEach(f => { L.push(``, f.data.summaryText || "", ``); });
    return L.join("\n");
  }

  // =====================================================================
  // Stage 3 notes (inside the explorer)
  // =====================================================================
  function renderS3Notes() {
    const el = $("#s3-notes"); if (!el) return;
    el.innerHTML = `<details class="s3n" ${S.s3open ? "open" : ""}><summary>Notes and feedback for Stage 3</summary>${notesHTML(3, "Which conclusions changed with the curve, the roles or the resolution?")}</details>`;
    $("details", el).addEventListener("toggle", e => { S.s3open = e.target.open; });
    bindNotes(el, 3, renderS3Notes);
  }

  // =====================================================================
  // Session dialog and routing
  // =====================================================================
  function sessionDialog(edit) {
    let d = $("#sess-dlg");
    if (!d) { d = document.createElement("dialog"); d.id = "sess-dlg"; d.className = "sess-dlg"; document.body.appendChild(d); }
    const s = LOG.data.session;
    d.innerHTML = `<form method="dialog" id="sess-form"><h2>Welcome to EvoEarth</h2>
      <p>You will work in pairs through four stages. Everything you do is saved in a session log. At the end you download a PDF summary and hand it in to your teachers.</p>
      <label>Group or pair name <input id="sg" required maxlength="40" value="${esc(s.group)}" placeholder="For example: Table 4"></label>
      <label>First names (optional) <input id="sm" maxlength="80" value="${esc(s.members)}" placeholder="For example: Ana and Bo"></label>
      <p class="hint">The log is kept only while this page is open. Do not reload or close the page before you have downloaded the PDF in Stage 4.</p>
      <div class="hand-btns"><button class="btn primary" value="ok">${edit ? "Save" : "Start with Stage 1"}</button>${edit ? `<button class="btn" value="cancel" formnovalidate>Cancel</button>` : `<button class="btn" value="s3" formnovalidate>Go straight to Stage 3: explorer</button>`}</div>
      ${edit ? "" : `<p class="hint">You can add a group name later with the button at the top right.</p>`}</form>`;
    $("#sess-form", d).addEventListener("submit", e => {
      if (e.submitter && e.submitter.value === "cancel") return;
      const g = $("#sg", d).value.trim();
      if (e.submitter && e.submitter.value === "s3") {
        if (g) { LOG.setSession({ group: g, members: $("#sm", d).value.trim() }); LOG.add(0, "session", { group: g }); renderChip(); }
        LOG.add(0, "skip", { to: 3 }); setTimeout(() => go("3"), 0); return;
      }
      if (!g) { e.preventDefault(); $("#sg", d).focus(); return; }
      LOG.setSession({ group: g, members: $("#sm", d).value.trim() }); LOG.add(0, "session", { group: g });
      renderChip(); if (S.stage === 4) renderS4();
    });
    // Non-modal, so the stage buttons in the header stay clickable (for example to go straight to Stage 3).
    let ov = $("#sess-ov"); if (!ov) { ov = document.createElement("div"); ov.id = "sess-ov"; ov.className = "sess-ov"; document.body.appendChild(ov); }
    ov.hidden = false; d.dataset.edit = edit ? "1" : "";
    d.addEventListener("close", () => { ov.hidden = true; }, { once: true });
    if (typeof d.show === "function") d.show(); else d.setAttribute("open", "");
    setTimeout(() => { const i = $("#sg", d); if (i) i.focus(); }, 0);
  }
  function closeSessionDialog(reason) {
    const d = $("#sess-dlg"); if (!d || !d.open) return;
    if (reason) LOG.add(0, "skip", { to: reason });
    d.close(); const ov = $("#sess-ov"); if (ov) ov.hidden = true;
  }
  function renderChip() {
    const c = $("#sess-chip"); if (!c) return;
    c.textContent = LOG.data.session.group ? `Group: ${LOG.data.session.group}` : "Set group";
  }
  function bindGo(root) { $$("[data-go]", root).forEach(b => b.addEventListener("click", () => go(b.dataset.go))); }
  const STAGES = ["1", "2", "3", "4", "guide", "teacher"];
  function go(st, fromHash) {
    st = String(st); if (!STAGES.includes(st)) st = "1";
    const prev = S.stage; S.stage = st === "guide" || st === "teacher" ? st : parseInt(st, 10);
    STAGES.forEach(x => { const sec = $(`#stage-${x}`); if (sec) sec.hidden = x !== st; });
    $$("[data-stage]").forEach(b => b.setAttribute("aria-current", b.dataset.stage === st ? "page" : "false"));
    const s3 = st === "3";
    $("#s3bar").hidden = !s3; $("#toolbar").style.display = s3 && APP.state.view === "timeline" ? "" : "none";
    if (prev !== S.stage) LOG.add(typeof S.stage === "number" ? S.stage : 0, "visit", { stage: st });
    if (st === "1") renderS1();
    if (st === "2") renderS2();
    if (st === "3") { APP.refresh(); renderS3Notes(); }
    if (st === "4") renderS4();
    if (st === "guide") renderGuidePage();
    if (st === "teacher") renderTeacher();
    const h = "#" + (st === "guide" || st === "teacher" ? st : "stage" + st);
    if (!fromHash && location.hash !== h) history.replaceState(null, "", h);
    document.documentElement.style.setProperty("--hdrh", $("#hdr").offsetHeight + "px");
    if (!fromHash) window.scrollTo(0, 0);
    hideTip();
  }
  function renderGuidePage() { $("#stage-guide").innerHTML = `<div class="guide-doc">${window.EV_GUIDE_HTML || "<p>Guide not loaded.</p>"}<p class="hint"><a href="EvoEarth_student_guide.md" download>Download this guide as a text file</a></p></div><div class="st-next"><button class="btn primary" data-go="1">Start Stage 1 →</button></div>`; bindGo($("#stage-guide")); }

  $$("[data-stage]").forEach(b => b.addEventListener("click", () => { closeSessionDialog(b.dataset.stage); go(b.dataset.stage); }));
  $("#sess-chip").addEventListener("click", () => sessionDialog(true));
  window.addEventListener("hashchange", () => go(fromHash(), true));
  function fromHash() { const h = location.hash.replace("#", ""); if (h === "teacher" || h === "guide") return h; const m = h.match(/^stage([1-4])$/); return m ? m[1] : "1"; }
  renderChip();
  go(fromHash(), true);
  if (!LOG.data.session.group && fromHash() !== "teacher" && fromHash() !== "guide") sessionDialog(false);
  window.EV_STAGES = { go, S };
})();
