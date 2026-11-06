(function () {
  const E = window.CL_ENGINE, T = window.CL_TIME, P = window.CL_PANELS, H = window.CL_HYPS, R = window.CL_REFS;
  const refById = {}; R.forEach(r => { refById[r.id] = r; });
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const state = {
    view: "timeline", mode: "guided", guideStep: 0,
    t: 521, pin: null, zoom: [640, 440], zoomId: "all",
    ageModel: "ab", preset: "bottomup",
    roles: Object.assign({}, window.CL_PRESETS[0].roles),
    variants: {}, weights: {}, hidden: {},
    provenancePenalty: false, windowOverride: null, covaryMode: "diff",
    open: {}, heatCache: null
  };
  P.forEach(p => { if (p.variants) state.variants[p.id] = p.variants[0].id; });

  // ---------- helpers ----------
  function shortRef(id) {
    const r = refById[id]; if (!r) return id;
    if (/Database|Macrostrat/.test(r.authors) && !/,/.test(r.authors)) return r.authors;
    const first = r.authors.split(",")[0].trim().split(" ")[0];
    const multi = /,| et al/.test(r.authors) ? " et al." : "";
    return `${first}${multi} ${r.year}`;
  }
  function refLink(r) {
    if (r.doi) return `https://doi.org/${r.doi}`;
    return r.url || null;
  }
  function fullRef(r) {
    const link = refLink(r);
    return `${esc(r.authors)} (${r.year}). ${esc(r.title)}. <em class="j">${esc(r.journal)}</em>.${link ? ` <a href="${esc(link)}" target="_blank" rel="noopener">${esc(r.doi ? "doi:" + r.doi : link)}</a>` : ""}`;
  }
  function fmt(v) {
    if (v == null || isNaN(v)) return "–";
    const a = Math.abs(v);
    if (a >= 1000) return Math.round(v).toLocaleString("en-GB");
    if (a >= 100) return v.toFixed(0);
    if (a >= 10) return v.toFixed(1);
    if (a >= 1) return v.toFixed(2);
    if (a === 0) return "0";
    if (a < 0.01 && a > 0) return v.toPrecision(2);
    if (v > 0.7 && v < 0.72) return v.toFixed(5);
    return v.toFixed(2);
  }
  function fmtVal(v, variant) {
    if (variant && variant.norm && variant.norm[0] > 0.7 && variant.norm[1] < 0.72) return v.toFixed(5);
    return fmt(v);
  }
  function stageAt(icsAge) { return T.stages.find(s => icsAge <= s.from && icsAge > s.to) || T.stages[T.stages.length - 1]; }
  function periodAt(icsAge) { return T.periods.find(s => icsAge <= s.from && icsAge > s.to); }
  function curWindow() { return state.windowOverride || E.defaultWindow(state.t); }
  function netColor(n) {
    const c = Math.max(-1, Math.min(1, n));
    const mix = (a, b, f) => Math.round(a + (b - a) * f);
    const neu = [241, 235, 224], pos = [31, 111, 115], neg = [165, 80, 42];
    const tgt = c >= 0 ? pos : neg, f = Math.min(1, Math.abs(c) / 0.6);
    return `rgb(${mix(neu[0], tgt[0], f)},${mix(neu[1], tgt[1], f)},${mix(neu[2], tgt[2], f)})`;
  }
  function invalidate() { state.heatCache = null; }

  // ---------- geometry ----------
  let plotW = 600;
  function xOf(t) { return (state.zoom[0] - t) / (state.zoom[0] - state.zoom[1]) * plotW; }
  function tOf(x) { return state.zoom[0] - x / plotW * (state.zoom[0] - state.zoom[1]); }
  function clampT(t) { return Math.max(state.zoom[1], Math.min(state.zoom[0], Math.round(t * 10) / 10)); }

  function ticks() {
    const span = state.zoom[0] - state.zoom[1];
    const step = span > 150 ? 20 : span > 70 ? 10 : 5;
    const out = [];
    for (let t = Math.ceil(state.zoom[1] / step) * step; t <= state.zoom[0]; t += step) out.push(t);
    return out;
  }

  // ---------- toolbar ----------
  function renderToolbar() {
    const full = state.mode === "full";
    const tb = $("#toolbar");
    tb.innerHTML = `
      <label>Bar at <input type="number" id="t-in" class="num" step="0.5" min="440" max="640" value="${state.t}"> Ma</label>
      <span class="seg" role="group" aria-label="Zoom">${T.zooms.map(z => `<button data-zoom="${z.id}" aria-pressed="${state.zoomId === z.id}">${z.name}</button>`).join("")}</span>
      <label>Age model <select id="age-model">${T.ageModels.map(m => `<option value="${m.id}" ${m.id === state.ageModel ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>
      <label>Roles <select id="preset">${window.CL_PRESETS.map(p => `<option value="${p.id}" ${p.id === state.preset ? "selected" : ""}>${esc(p.name)}</option>`).join("")}${state.preset === "custom" ? `<option value="custom" selected>Custom</option>` : ""}</select></label>
      <button class="btn" id="pin-btn">${state.pin != null ? `Unpin ${state.pin} Ma` : "Pin bar for comparison"}</button>
      ${full ? `<label>From <input type="number" id="z0" class="num" value="${state.zoom[0]}" step="5"></label><label>to <input type="number" id="z1" class="num" value="${state.zoom[1]}" step="5"> Ma</label>` : ""}
      <span class="spacer"></span>
      <button class="btn" id="exp-csv">Export CSV</button>
      <button class="btn" id="exp-json">Export JSON</button>`;
    $("#t-in").addEventListener("change", e => setT(parseFloat(e.target.value)));
    $$("[data-zoom]", tb).forEach(b => b.addEventListener("click", () => setZoom(b.dataset.zoom)));
    $("#age-model").addEventListener("change", e => { state.ageModel = e.target.value; invalidate(); renderAll(); });
    $("#preset").addEventListener("change", e => applyPreset(e.target.value));
    $("#pin-btn").addEventListener("click", () => { state.pin = state.pin != null ? null : state.t; renderToolbar(); renderStack(); renderHeat(); renderSide(); });
    if (full) {
      const zc = () => { const a = parseFloat($("#z0").value), b = parseFloat($("#z1").value); if (a > b + 5) { state.zoom = [Math.min(640, a), Math.max(440, b)]; state.zoomId = "custom"; state.t = clampT(state.t); invalidate(); renderAll(); } };
      $("#z0").addEventListener("change", zc); $("#z1").addEventListener("change", zc);
    }
    $("#exp-csv").addEventListener("click", exportCSV);
    $("#exp-json").addEventListener("click", exportJSON);
  }

  function setZoom(id) {
    const z = T.zooms.find(x => x.id === id); if (!z) return;
    state.zoom = z.range.slice(); state.zoomId = id; state.t = clampT(state.t);
    invalidate(); renderToolbar(); renderStack(); renderHeat(); renderSide();
  }
  function applyPreset(id) {
    const p = window.CL_PRESETS.find(x => x.id === id); if (!p) return;
    state.preset = id; state.roles = Object.assign({}, p.roles);
    invalidate(); renderToolbar(); renderStack(); renderHeat(); renderSide();
  }
  function setT(t, light) {
    if (isNaN(t)) return;
    state.t = clampT(t);
    const inp = $("#t-in"); if (inp && document.activeElement !== inp) inp.value = state.t;
    updateBar();
    renderSide();
  }

  // ---------- guide ----------
  function renderGuide() {
    const g = $("#guide");
    if (state.mode !== "guided") { g.innerHTML = ""; return; }
    const steps = window.CL_GUIDE, s = steps[state.guideStep];
    g.innerHTML = `<div class="guide">
      <div><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div>
      <div class="guide-nav">
        ${s.action ? `<button class="btn primary" id="g-act">${esc(s.action.label)}</button>` : ""}
        <button class="btn" id="g-prev" ${state.guideStep === 0 ? "disabled" : ""}>Back</button>
        <button class="btn" id="g-next" ${state.guideStep === steps.length - 1 ? "disabled" : ""}>Next</button>
        <span class="guide-dots" aria-hidden="true">${steps.map((_, i) => `<span class="${i === state.guideStep ? "on" : ""}"></span>`).join("")}</span>
      </div></div>`;
    $("#g-prev").addEventListener("click", () => { state.guideStep = Math.max(0, state.guideStep - 1); renderGuide(); });
    $("#g-next").addEventListener("click", () => { state.guideStep = Math.min(steps.length - 1, state.guideStep + 1); renderGuide(); });
    const act = $("#g-act");
    if (act) act.addEventListener("click", () => {
      const a = s.action;
      if (a.preset) applyPreset(a.preset);
      if (a.zoom) setZoom(a.zoom);
      if (a.pin != null) { state.pin = a.pin; renderToolbar(); }
      if (a.t != null) setT(a.t);
      if (a.pin != null) { renderStack(); renderHeat(); renderSide(); }
      if (a.focus === "importance") { const el = $("#imp-card"); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.style.outline = "2px solid var(--teal)"; setTimeout(() => el.style.outline = "", 1600); } }
    });
  }

  // ---------- panel plots ----------
  function samplePanel(p, opts) {
    const N = Math.max(120, Math.min(400, Math.round(plotW / 2)));
    const out = [];
    for (let i = 0; i <= N; i++) {
      const t = state.zoom[0] - i / N * (state.zoom[0] - state.zoom[1]);
      const v = E.valueAt(p, E.toICS(t, state.ageModel), state, opts);
      out.push({ t, v });
    }
    return out;
  }

  function barLines(h) {
    let s = "";
    const W = curWindow();
    s += `<rect class="winband" data-win x="${xOf(state.t + W)}" y="0" width="${Math.max(1, xOf(state.t - W) - xOf(state.t + W))}" height="${h}"/>`;
    if (state.pin != null && state.pin <= state.zoom[0] && state.pin >= state.zoom[1]) s += `<line class="pin" x1="${xOf(state.pin)}" x2="${xOf(state.pin)}" y1="0" y2="${h}"/>`;
    s += `<line class="bar" data-bar x1="${xOf(state.t)}" x2="${xOf(state.t)}" y1="0" y2="${h}"/>`;
    return s;
  }
  function gridLines(h) { return ticks().map(t => `<line class="gridline" x1="${xOf(t)}" x2="${xOf(t)}" y1="0" y2="${h}"/>`).join(""); }

  function curveSVG(p) {
    const h = 74;
    const variant = p.kind === "derived" ? p.variants[0] : E.variantOf(p, state);
    const S = samplePanel(p);
    const tfv = v => variant.log ? Math.log10(Math.max(v, 1e-9)) : v;
    const vals = S.filter(s => s.v).flatMap(s => [tfv(s.v.lo), tfv(s.v.hi), tfv(s.v.v)]);
    let body = "";
    if (!vals.length) {
      body = `<text x="${plotW / 2}" y="${h / 2 + 4}" text-anchor="middle" fill="var(--faint)" font-size="12">No data for this curve in the selected range</text>`;
    } else {
      let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      const pad = (hi - lo) * 0.08 || 0.5; lo -= pad; hi += pad;
      const y = v => 6 + (1 - (tfv(v) - lo) / (hi - lo)) * (h - 12);
      // segments of contiguous data
      const segs = []; let cur = [];
      S.forEach(s => { if (s.v) cur.push(s); else if (cur.length) { segs.push(cur); cur = []; } });
      if (cur.length) segs.push(cur);
      segs.forEach(seg => {
        const top = seg.map(s => `${xOf(s.t).toFixed(1)},${y(s.v.hi).toFixed(1)}`);
        const bot = seg.slice().reverse().map(s => `${xOf(s.t).toFixed(1)},${y(s.v.lo).toFixed(1)}`);
        body += `<polygon class="env" points="${top.concat(bot).join(" ")}"/>`;
        body += `<polyline class="curve" points="${seg.map(s => `${xOf(s.t).toFixed(1)},${y(s.v.v).toFixed(1)}`).join(" ")}"/>`;
      });
      // sites for local redox
      if (p.sites) p.sites.forEach(st => {
        const x0 = xOf(E.toDisplay(st.from, state.ageModel)), x1 = xOf(E.toDisplay(st.to, state.ageModel));
        if (x1 < 0 || x0 > plotW) return;
        body += `<rect x="${x0}" y="${y(st.hi)}" width="${Math.max(3, x1 - x0)}" height="${Math.max(2, y(st.lo) - y(st.hi))}" fill="none" stroke="var(--rust)" stroke-width="1.2"><title>${esc(st.name)}: ${esc(st.note)} (${esc(shortRef(st.ref))})</title></rect>`;
      });
      if (p.markers) p.markers.forEach(m => {
        const x = xOf(E.toDisplay(m.age, state.ageModel)); if (x < 0 || x > plotW) return;
        body += `<path d="M${x},${h - 4} l-4,-7 h8 z" fill="var(--rust)"><title>${esc(m.label)}</title></path>`;
      });
      if (p.id === "sampling") T.lagerstatten.forEach(l => {
        const x = xOf(E.toDisplay(l.age, state.ageModel)); if (x < 0 || x > plotW) return;
        body += `<line x1="${x}" x2="${x}" y1="0" y2="8" stroke="var(--ink)" stroke-width="1.5"><title>${esc(l.name)} Lagerstätte, about ${l.age} Ma</title></line>`;
      });
      const toLbl = v => variant.log ? Math.pow(10, v) : v;
      body += `<g class="axis"><text x="4" y="14">${fmtVal(toLbl(hi - pad), variant)}</text><text x="4" y="${h - 5}">${fmtVal(toLbl(lo + pad), variant)}</text></g>`;
    }
    return `<svg height="${h}" viewBox="0 0 ${plotW} ${h}" role="img" aria-label="${esc(p.name)} curve">${gridLines(h)}${body}${barLines(h)}</svg>`;
  }

  function traitsSVG(p) {
    const rh = 15, h = p.rows.length * rh + 6;
    let body = "";
    p.rows.forEach((r, i) => {
      const y0 = 3 + i * rh;
      const N = 300;
      for (let k = 0; k < N; k++) {
        const t = state.zoom[0] - (k + 0.5) / N * (state.zoom[0] - state.zoom[1]);
        const l = E.traitLevel(r, E.toICS(t, state.ageModel));
        if (l > 0) body += `<rect x="${(k / N * plotW).toFixed(1)}" y="${y0 + 2}" width="${(plotW / N + 0.6).toFixed(1)}" height="${rh - 5}" fill="var(--line)" fill-opacity="${(0.15 + 0.7 * l).toFixed(2)}"/>`;
      }
      body += `<text x="4" y="${y0 + rh - 4}" font-size="12" fill="var(--ink)" paint-order="stroke" stroke="var(--surface)" stroke-width="3">${esc(r.name)}</text>`;
    });
    return `<svg height="${h}" viewBox="0 0 ${plotW} ${h}" role="img" aria-label="${esc(p.name)} traits">${gridLines(h)}${body}${barLines(h)}</svg>`;
  }

  function frameworkSVG() {
    const h = 104;
    let s = "";
    const band = (list, y, hh, useShort) => list.forEach(b => {
      const a = E.toDisplay(b.from, state.ageModel), c = E.toDisplay(b.to, state.ageModel);
      const x0 = Math.max(0, xOf(a)), x1 = Math.min(plotW, xOf(c));
      if (x1 <= 0 || x0 >= plotW) return;
      s += `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${hh}" fill="${b.color}" stroke="var(--surface)" stroke-width="0.8"><title>${esc(b.name)}: ${b.from}–${b.to} Ma (ICS)</title></rect>`;
      const w = x1 - x0, nm = useShort && w < b.name.length * 7 ? b.short : b.name;
      if (w > nm.length * 6.5 + 4) s += `<text x="${(x0 + x1) / 2}" y="${y + hh - 4}" text-anchor="middle" font-size="12" fill="#1d1b17">${esc(nm)}</text>`;
    });
    band(T.periods, 2, 18, false);
    band(T.stages.filter(x => x.name !== "Ediacaran" && x.name !== "Silurian"), 22, 18, true);
    // events in two lanes
    const lanes = { bio: 46, carbon: 46, extinction: 64, climate: 64 };
    const laneEnd = { 46: -1e9, 64: -1e9 };
    const ext = T.events.map(e => ({ id: e.id, y: lanes[e.kind] || 46, a: xOf(E.toDisplay(e.from, state.ageModel)) - 2, b: xOf(E.toDisplay(e.to, state.ageModel)) + 2 }));
    const rectsIn = (y, a, b, id) => ext.some(r => r.id !== id && r.y === y && r.b > a && r.a < b);
    T.events.slice().sort((p, q) => q.from - p.from).forEach(e => {
      const a = E.toDisplay(e.from, state.ageModel), c = E.toDisplay(e.to, state.ageModel);
      let x0 = xOf(a), x1 = xOf(c); if (x1 < 0 || x0 > plotW) return;
      if (x1 - x0 < 3) { const m = (x0 + x1) / 2; x0 = m - 1.5; x1 = m + 1.5; }
      const y = lanes[e.kind] || 46;
      const col = e.kind === "extinction" ? "var(--rust)" : e.kind === "climate" ? "#5b7fa6" : e.kind === "carbon" ? "#8a7a3c" : "var(--teal)";
      s += `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="14" fill="${col}" fill-opacity="0.85" rx="2"><title>${esc(e.name)}${e.note ? ": " + esc(e.note) : ""}</title></rect>`;
      const lbl = e.name.split(" /")[0];
      const tw = lbl.length * 6.3;
      if (x1 - x0 > tw + 6) { s += `<text x="${(x0 + x1) / 2}" y="${y + 11}" text-anchor="middle" font-size="12" fill="#fff">${esc(lbl)}</text>`; laneEnd[y] = x1; }
      else if (x1 + tw + 4 < plotW && x1 + 3 > laneEnd[y] + 6 && !rectsIn(y, x1 + 2, x1 + 6 + tw, e.id)) { s += `<text x="${x1 + 3}" y="${y + 11}" font-size="12" fill="var(--muted)">${esc(lbl)}</text>`; laneEnd[y] = x1 + 3 + tw; }
    });
    // axis ticks
    s += `<g class="axis">${ticks().map(t => `<line x1="${xOf(t)}" x2="${xOf(t)}" y1="${h - 20}" y2="${h - 14}" stroke="var(--faint)"/><text x="${xOf(t)}" y="${h - 2}" text-anchor="${xOf(t) < 12 ? "start" : xOf(t) > plotW - 12 ? "end" : "middle"}">${t}</text>`).join("")}</g>`;
    s += `<text x="${plotW - 4}" y="${h - 2}" text-anchor="end" font-size="12" fill="var(--faint)"></text>`;
    return `<svg height="${h}" viewBox="0 0 ${plotW} ${h}" role="img" aria-label="Chronostratigraphy">${s}${barLines(h)}</svg>`;
  }

  function roleButtons(p) {
    if (p.testable === false) return "";
    const r = state.roles[p.id] || "off";
    return `<span class="roles" role="group" aria-label="Role of ${esc(p.short)}">
      <button class="given" data-role="given" data-pid="${p.id}" aria-pressed="${r === "given"}" title="Treat as given (a condition)">Given</button>
      <button class="outcome" data-role="outcome" data-pid="${p.id}" aria-pressed="${r === "outcome"}" title="Treat as an outcome to explain">Outcome</button>
      <button class="off" data-role="off" data-pid="${p.id}" aria-pressed="${r === "off"}" title="Exclude from evaluation">Off</button></span>`;
  }
  function sourcesLine(p) {
    const ids = p.kind === "curve" ? (E.variantOf(p, state).refs || p.refs) : p.refs;
    const shown = ids.slice(0, 2).map(shortRef).join("; ");
    return `<button class="src" data-drawer="${p.id}">Data: ${esc(shown)}${ids.length > 2 ? ` +${ids.length - 2}` : ""}</button>`;
  }

  function renderStack() {
    const st = $("#stack");
    const meas = st.clientWidth || 900;
    const narrow = window.innerWidth <= 760;
    const labelw = narrow ? 0 : 168, metaw = narrow ? 0 : 236;
    plotW = Math.max(260, meas - labelw - metaw - 2);
    let html = `<div class="stack-head"><div>Parameter, from more to less constrained</div><div>Time (Ma), older on the left</div><div>At the bar, confidence, role, data</div></div>`;
    let lastGroup = null;
    P.forEach(p => {
      const grp = p.group;
      const role = state.roles[p.id];
      const svg = p.kind === "framework" ? frameworkSVG() : p.kind === "traits" ? traitsSVG(p) : curveSVG(p);
      const variantSel = p.variants && p.variants.length > 1 ? `<select data-variant="${p.id}" aria-label="Curve for ${esc(p.short)}">${p.variants.map(v => `<option value="${v.id}" ${state.variants[p.id] === v.id ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select>` : "";
      html += `<div class="panel ${p.testable !== false && role === "off" ? "off" : ""}" data-panel="${p.id}">
        <div class="p-label"><span class="nm">${esc(p.name)}</span><span class="ty">${esc(p.group)} · ${esc(p.dataType)} · ${esc(p.scale)}</span></div>
        <div class="p-plot" data-plot tabindex="0" aria-label="Timeline for ${esc(p.short)}. Use arrow keys to move the bar.">${svg}</div>
        <div class="p-meta">
          <div class="meta-top"><span class="val num" data-val="${p.id}"></span><span class="tier" data-tier="${p.id}" title="${esc(p.tierReason)}"></span></div>
          ${roleButtons(p)}
          ${variantSel}
          ${sourcesLine(p)}
        </div></div>`;
    });
    st.innerHTML = html;
    $$("[data-role]", st).forEach(b => b.addEventListener("click", () => { state.roles[b.dataset.pid] = b.dataset.role; state.preset = "custom"; invalidate(); renderToolbar(); renderStack(); renderHeat(); renderSide(); }));
    $$("[data-variant]", st).forEach(s => s.addEventListener("change", () => { state.variants[s.dataset.variant] = s.value; invalidate(); renderStack(); renderHeat(); renderSide(); }));
    $$("[data-drawer]", st).forEach(b => b.addEventListener("click", () => openDrawer(b.dataset.drawer)));
    $$("[data-plot]", st).forEach(attachDrag);
    updateMeta();
  }

  function attachDrag(el) {
    let dragging = false;
    const at = e => { const r = el.getBoundingClientRect(); return tOf((e.clientX - r.left) / r.width * plotW); };
    el.addEventListener("pointerdown", e => { dragging = true; el.setPointerCapture(e.pointerId); scheduleT(at(e)); });
    el.addEventListener("pointermove", e => { if (dragging) scheduleT(at(e)); });
    el.addEventListener("pointerup", () => { dragging = false; });
    el.addEventListener("pointercancel", () => { dragging = false; });
    el.addEventListener("keydown", e => {
      const step = e.shiftKey ? 5 : 0.5;
      if (e.key === "ArrowLeft") { e.preventDefault(); setT(state.t + step); }
      if (e.key === "ArrowRight") { e.preventDefault(); setT(state.t - step); }
    });
  }
  let pendingT = null, raf = null;
  function scheduleT(t) { pendingT = t; if (!raf) raf = requestAnimationFrame(() => { raf = null; setT(pendingT); }); }

  function updateBar() {
    const x = xOf(state.t), W = curWindow();
    $$("[data-bar]").forEach(l => { l.setAttribute("x1", x); l.setAttribute("x2", x); });
    $$("[data-win]").forEach(r => { r.setAttribute("x", xOf(state.t + W)); r.setAttribute("width", Math.max(1, xOf(state.t - W) - xOf(state.t + W))); });
    $$("[data-hbar]").forEach(l => { const hx = l.dataset.hbar === "pin" ? null : x; if (hx != null) { l.setAttribute("x1", hx); l.setAttribute("x2", hx); } });
    updateMeta();
  }

  function trendArrow(p) {
    const W = Math.max(2, curWindow());
    const a = E.valueAt(p, E.toICS(state.t + W, state.ageModel), state), b = E.valueAt(p, E.toICS(state.t - W, state.ageModel), state);
    if (!a || !b) return "";
    const d = b.n - a.n;
    if (Math.abs(d) < 0.03) return `<span class="trend" title="Change over ±${W} Myr">→ stable</span>`;
    return d > 0 ? `<span class="trend" title="Change over ±${W} Myr">↑ rising</span>` : `<span class="trend" title="Change over ±${W} Myr">↓ falling</span>`;
  }

  function updateMeta() {
    const ics = E.toICS(state.t, state.ageModel);
    P.forEach(p => {
      const el = $(`[data-val="${p.id}"]`), tEl = $(`[data-tier="${p.id}"]`);
      if (!el) return;
      const tier = E.tierAt(p, ics, state);
      tEl.className = `tier ${tier}`; tEl.textContent = tier;
      tEl.setAttribute("aria-label", `Confidence tier ${tier}`);
      if (p.kind === "framework") {
        const stg = stageAt(ics), ev = T.events.filter(e => ics <= e.from + 0.5 && ics >= e.to - 0.5);
        el.innerHTML = `${esc(stg.name)}${ev.length ? `<br><span class="rng">${esc(ev.map(e => e.name).join(", "))}</span>` : ""}`;
      } else if (p.kind === "traits") {
        const pres = p.rows.filter(r => E.traitLevel(r, ics) >= 0.75).length, first = p.rows.filter(r => { const l = E.traitLevel(r, ics); return l > 0 && l < 0.75; }).length;
        el.innerHTML = `${pres} of ${p.rows.length} established<br><span class="rng">${first} first or rare</span>`;
      } else {
        const variant = p.kind === "derived" ? p.variants[0] : E.variantOf(p, state);
        const v = E.valueAt(p, ics, state);
        el.innerHTML = v ? `${fmtVal(v.v, variant)} <span class="rng">${esc(variant.unit)}</span><br><span class="rng">range ${fmtVal(v.lo, variant)} to ${fmtVal(v.hi, variant)}</span> ${trendArrow(p)}` : `<span class="rng">no data at this time</span>`;
      }
    });
  }

  // ---------- heatmap ----------
  function renderHeat() {
    const el = $("#heat");
    const span = state.zoom[0] - state.zoom[1];
    const step = span > 120 ? 1 : 0.5;
    if (!state.heatCache) state.heatCache = E.heatmap(state, state.zoom, step);
    const hm = state.heatCache;
    const rh = 16, n = hm.ages.length, cw = plotW / n;
    const res = E.evaluate(state.t, state);
    const netNow = {}; res.forEach(r => { netNow[r.id] = r.net; });
    let rows = "";
    hm.rows.forEach(row => {
      let rects = "";
      row.values.forEach((v, i) => { rects += `<rect x="${(i * cw).toFixed(2)}" y="0" width="${(cw + 0.4).toFixed(2)}" height="${rh}" fill="${netColor(v)}"/>`; });
      rows += `<div class="heat-row"><div class="hl" title="${esc(row.name)}"><b>${row.id}</b> ${esc(row.name)}</div>
        <div class="p-plot" data-plot><svg height="${rh}" viewBox="0 0 ${plotW} ${rh}" preserveAspectRatio="none">${rects}${state.pin != null ? `<line class="pin" x1="${xOf(state.pin)}" x2="${xOf(state.pin)}" y1="0" y2="${rh}"/>` : ""}<line class="bar" data-bar x1="${xOf(state.t)}" x2="${xOf(state.t)}" y1="0" y2="${rh}"/></svg></div>
        <div class="hm num" data-heatnow="${row.id}">${(netNow[row.id] || 0).toFixed(2)}</div></div>`;
    });
    el.innerHTML = `<div class="heat-head"><div><h3>Support over time</h3><p>Net support of each hypothesis at every time step, with the current roles, curves and weights. Teal = supported, rust = contradicted, pale = weak, mixed or untestable. Click to move the bar.</p></div>
      <div class="legend"><span>Contradicted</span><span class="ramp"></span><span>Supported</span></div></div>${rows}
      <div class="heat-row"><div class="hl"></div><div><svg height="18" viewBox="0 0 ${plotW} 18"><g class="axis">${ticks().map(t => `<text x="${xOf(t)}" y="13" text-anchor="${xOf(t) < 12 ? "start" : xOf(t) > plotW - 12 ? "end" : "middle"}">${t}</text>`).join("")}</g></svg></div><div class="hm">net support at bar</div></div>`;
    $$("[data-plot]", el).forEach(attachDrag);
  }

  // ---------- sidebar ----------
  function renderSide() {
    const side = $("#side");
    const ics = E.toICS(state.t, state.ageModel);
    const stg = stageAt(ics), per = periodAt(ics);
    const W = curWindow();
    const res = E.evaluate(state.t, state);
    // update heat values
    res.forEach(r => { const c = $(`[data-heatnow="${r.id}"]`); if (c) c.textContent = r.net.toFixed(2); });
    const evNow = T.events.filter(e => ics <= e.from + W && ics >= e.to - W);
    let html = `<div class="card"><div class="now-age num">${state.t.toFixed(1)} Ma</div>
      <p class="sub">${esc(per && per.name !== stg.name ? per.name + ", " : "")}${esc(stg.name)}. Evaluation window ±${W} Myr ${state.windowOverride ? "(set manually)" : "(age uncertainty)"}.${state.ageModel !== "ab" ? ` ICS-equivalent age ${ics.toFixed(1)} Ma.` : ""}</p>
      ${evNow.length ? `<p class="sub">Near: ${esc(evNow.map(e => e.name).join(", "))}</p>` : ""}</div>`;

    html += `<div class="card"><h3>Hypotheses at this time</h3><p class="sub">Ranked by net support. Click a hypothesis to see each prediction.</p><ol class="hyp-list">`;
    res.forEach(r => {
      const n = r.net, w = Math.min(50, Math.abs(n) * 50);
      const bar = `<span style="${n >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`};background:${n >= 0 ? "var(--teal)" : "var(--rust)"}"></span>`;
      html += `<li class="hyp-item"><button data-hopen="${r.id}" aria-expanded="${!!state.open[r.id]}">
        <span class="hyp-id">${r.id}</span>
        <span class="hyp-name">${esc(r.h.name)}<span class="hyp-verdict">${esc(r.verdict)} · coverage ${Math.round(r.coverage * 100)}%</span></span>
        <span><span class="netbar">${bar}</span><span class="netval num">${n >= 0 ? "+" : ""}${n.toFixed(2)}</span></span></button>`;
      if (state.open[r.id]) {
        html += `<div class="hyp-detail"><p class="sub" style="margin:4px 0">${esc(r.h.summary)}</p>`;
        r.results.forEach(x => {
          html += `<div class="pred"><span class="dot ${x.status}" title="${x.status}"></span><div><span class="kind">${x.kind}</span> ${esc(x.text)}<br><span class="why">${x.s !== null ? `${esc(x.status)} (s = ${x.s.toFixed(2)}; ${esc(x.detail)}; tier ${x.tiers.join("/")}${x.penalised ? "; down-weighted for shared data" : ""})` : esc(x.reason)}</span></div></div>`;
        });
        if (r.consistency != null) html += `<p class="sub" style="margin-top:6px">Consistency of tested predictions: ${Math.round(r.consistency * 100)}%.</p>`;
        if (r.issues.length) html += `<div class="warn"><b>Possible double counting:</b> ${r.issues.map(i => esc(i.why)).join(" ")}${state.mode === "full" ? "" : " Switch to Full mode to down-weight."}</div>`;
        if (r.h.note) html += `<p class="sub" style="margin-top:6px">${esc(r.h.note)}</p>`;
        html += `</div>`;
      }
      html += `</li>`;
    });
    html += `</ol></div>`;

    if (state.pin != null) {
      const pr = E.evaluate(state.pin, state); const pm = {}; pr.forEach(r => { pm[r.id] = r.net; });
      html += `<div class="card"><h3>Compare ${state.pin} Ma with ${state.t.toFixed(1)} Ma</h3><table class="cmp"><thead><tr><th>Hypothesis</th><th>${state.pin}</th><th>${state.t.toFixed(1)}</th><th>Change</th></tr></thead><tbody>`;
      H.forEach(h => { const a = pm[h.id], b = (res.find(r => r.id === h.id) || {}).net; html += `<tr><td>${h.id} ${esc(h.name)}</td><td class="n" style="background:${netColor(a)}">${a.toFixed(2)}</td><td class="n" style="background:${netColor(b)}">${b.toFixed(2)}</td><td class="n">${(b - a >= 0 ? "+" : "") + (b - a).toFixed(2)}</td></tr>`; });
      html += `</tbody></table><p class="sub" style="margin-top:6px">Same roles and curves are used at both times.</p></div>`;
    }

    const sens = E.sensitivity(state.t, state).filter(s => s.total > 0.001).slice(0, 8);
    const mx = sens.length ? sens[0].total : 1;
    html += `<div class="card" id="imp-card"><h3>Which parameters matter here</h3><p class="sub">How much the net support of all hypotheses changes if one panel is removed (leave-one-out). Outcome panels that many hypotheses rely on, such as diversity, naturally rank high.</p>
      ${sens.length ? sens.map(s => `<div class="imp-row"><span>${esc(s.name)}</span><span class="imp-bar" style="width:${(s.total / mx * 100).toFixed(0)}%"></span><span class="num">${s.total.toFixed(2)}</span></div>`).join("") : `<p class="sub">No panel currently affects the scores.</p>`}
      ${sens.length ? `<p class="sub" style="margin-top:6px">Largest single effect: removing ${esc(sens[0].name)} changes ${sens[0].maxH} by ${sens[0].maxD >= 0 ? "+" : ""}${sens[0].maxD.toFixed(2)}.</p>` : ""}</div>`;

    if (state.mode === "full") {
      html += `<div class="card settings"><h3>Settings</h3>
        <label>Down-weight shared or derived data (×0.5) <input type="checkbox" id="s-prov" ${state.provenancePenalty ? "checked" : ""}></label>
        <label>Co-variation test <select id="s-cov"><option value="diff" ${state.covaryMode === "diff" ? "selected" : ""}>First differences</option><option value="levels" ${state.covaryMode === "levels" ? "selected" : ""}>Raw levels</option></select></label>
        <label>Window ±<input type="range" id="s-win" min="0" max="10" step="0.5" value="${state.windowOverride || 0}"><span class="num">${state.windowOverride ? state.windowOverride + " Myr" : "auto"}</span></label>
        <p class="sub">Hypothesis weights are set on the Hypotheses tab.</p></div>`;
    } else {
      html += `<div class="card"><h3>Practical 3: discussion questions</h3><ol class="qlist">${window.CL_QUESTIONS.map(q => `<li>${esc(q)}</li>`).join("")}</ol></div>`;
    }
    side.innerHTML = html;
    $$("[data-hopen]", side).forEach(b => b.addEventListener("click", () => { state.open[b.dataset.hopen] = !state.open[b.dataset.hopen]; renderSide(); }));
    if (state.mode === "full") {
      $("#s-prov").addEventListener("change", e => { state.provenancePenalty = e.target.checked; invalidate(); renderHeat(); renderSide(); });
      $("#s-cov").addEventListener("change", e => { state.covaryMode = e.target.value; invalidate(); renderHeat(); renderSide(); });
      $("#s-win").addEventListener("change", e => { const v = parseFloat(e.target.value); state.windowOverride = v > 0 ? v : null; invalidate(); renderStack(); renderHeat(); renderSide(); });
    }
  }

  // ---------- drawer ----------
  function openDrawer(pid) {
    const p = E.panelsById[pid];
    const v = p.kind === "curve" ? E.variantOf(p, state) : null;
    const prov = window.CL_PROVENANCE.filter(x => x.a === pid || x.b === pid);
    const usedBy = H.filter(h => h.preds.some(q => q.panel === pid || q.a === pid || q.b === pid));
    let html = `<h2>${esc(p.name)}</h2><p class="sub" style="color:var(--muted)">${esc(p.group)} · ${esc(p.dataType)} · ${esc(p.scale)}</p>
      <p>${esc(p.description)}</p>${p.caveat ? `<div class="warn">${esc(p.caveat)}</div>` : ""}
      <h4>Confidence</h4><p>${esc(p.tierReason)}</p>
      <table class="pts"><thead><tr><th>Interval (Ma, ICS)</th><th>Tier</th></tr></thead><tbody>${((v && v.tiers) || p.tiers).map(x => `<tr><td>${x.from} to ${x.to}</td><td><span class="tier ${x.tier}">${x.tier}</span></td></tr>`).join("")}</tbody></table>`;
    if (p.variants && p.variants.length && p.kind !== "framework") {
      html += `<h4>Curves available</h4><ul>${p.variants.map(x => `<li>${x.id === (v && v.id) ? "<b>" : ""}${esc(x.name)}${x.id === (v && v.id) ? "</b> (selected)" : ""}. ${x.refs ? "Data: " + x.refs.map(shortRef).map(esc).join("; ") : ""}</li>`).join("")}</ul>`;
    }
    if (p.rows) html += `<h4>Trait rows (first evidence, Ma)</h4><table class="pts"><thead><tr><th>Trait</th><th>Steps (age: level)</th><th>Sources</th></tr></thead><tbody>${p.rows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.steps.map(s => `${s[0]}: ${s[1]}`).join(", ")}</td><td>${r.refs.map(shortRef).map(esc).join("; ")}</td></tr>`).join("")}</tbody></table>`;
    if (p.sites) html += `<h4>Site records</h4><table class="pts"><thead><tr><th>Site</th><th>Ma</th><th>Note</th></tr></thead><tbody>${p.sites.map(s => `<tr><td>${esc(s.name)}</td><td>${s.from}–${s.to}</td><td style="text-align:left">${esc(s.note)} (${esc(shortRef(s.ref))})</td></tr>`).join("")}</tbody></table>`;
    if (v && v.points.length) html += `<h4>Control points of the selected curve (schematic)</h4><table class="pts"><thead><tr><th>Age (Ma)</th><th>Value</th><th>Low</th><th>High</th></tr></thead><tbody>${v.points.map(q => `<tr><td>${q[0]}</td><td>${fmtVal(q[1], v)}</td><td>${fmtVal(q[2], v)}</td><td>${fmtVal(q[3], v)}</td></tr>`).join("")}</tbody></table><p class="sub" style="color:var(--muted)">Unit: ${esc(v.unit)}. These points are simplified for teaching and will be replaced by digitised data after checking.</p>`;
    if (p.kind === "framework") html += `<h4>Events</h4><table class="pts"><thead><tr><th>Event</th><th>Ma (ICS)</th><th>Sources</th></tr></thead><tbody>${T.events.map(e => `<tr><td>${esc(e.name)}</td><td>${e.from}–${e.to}</td><td>${e.refs.map(shortRef).map(esc).join("; ")}</td></tr>`).join("")}</tbody></table><h4>Age models</h4><ul>${T.ageModels.map(m => `<li>${esc(m.name)}</li>`).join("")}</ul>`;
    if (prov.length) html += `<h4>Shared or derived data</h4><ul>${prov.map(x => `<li>${esc(E.panelsById[x.a].short)} and ${esc(E.panelsById[x.b].short)}: ${esc(x.why)}</li>`).join("")}</ul>`;
    if (usedBy.length) html += `<h4>Used by hypotheses</h4><p>${usedBy.map(h => `${h.id} ${esc(h.name)}`).join("; ")}</p>`;
    html += `<h4>Sources</h4><ul>${p.refs.map(id => refById[id]).filter(Boolean).map(r => `<li>${fullRef(r)}</li>`).join("")}</ul>`;
    $("#drawer-in").innerHTML = html;
    const d = $("#drawer");
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
  }
  $("#drawer-close").addEventListener("click", () => $("#drawer").close());
  $("#drawer").addEventListener("click", e => { if (e.target.id === "drawer") $("#drawer").close(); });

  // ---------- hypotheses tab ----------
  function predPanels(q) {
    if (q.kind === "external") return `<span class="chip ext">${esc(q.needs)}</span>`;
    const ids = q.kind === "link" ? [q.a, q.b] : [q.panel];
    return ids.map(id => esc(E.panelsById[id].short)).join(" → ");
  }
  function renderHyps() {
    const v = $("#view-hypotheses");
    const full = state.mode === "full";
    v.innerHTML = `<div class="prose" style="max-width:none;margin-bottom:12px"><h2>Hypotheses and their predictions</h2>
      <p>Each hypothesis is broken into predictions. A <span class="chip cond">condition</span> needs its panel set as Given, a <span class="chip patt">pattern</span> needs its panel set as Outcome, and a <span class="chip link">link</span> needs the driver Given and the outcome Outcome. Specificity (1 to 3) is how distinctive a prediction is: a rise in diversity is predicted by almost every hypothesis, so it carries little weight.${full ? " Use the sliders to change how much weight a hypothesis gets, or exclude it from the ranking." : " Switch to Full mode to change weights."}</p></div>
      <div class="hyp-grid">${H.map(h => `<article class="card hcard"><h3><span class="hyp-id">${h.id}</span> ${esc(h.name)}</h3><div class="fam">${esc(h.family)}</div><p>${esc(h.summary)}</p>${h.note ? `<p class="sub">${esc(h.note)}</p>` : ""}
        <table class="ptable"><thead><tr><th>Type</th><th>Prediction</th><th>Panels</th><th>Spec.</th></tr></thead><tbody>${h.preds.map(q => `<tr><td><span class="chip ${q.kind === "condition" ? "cond" : q.kind === "pattern" ? "patt" : q.kind === "link" ? "link" : "ext"}">${q.kind}</span></td><td>${esc(q.text)}</td><td>${predPanels(q)}</td><td class="num">${q.spec}</td></tr>`).join("")}</tbody></table>
        <p class="sub" style="margin-top:8px">Key sources: ${h.refs.map(id => { const r = refById[id]; const l = r && refLink(r); return l ? `<a href="${esc(l)}" target="_blank" rel="noopener">${esc(shortRef(id))}</a>` : esc(shortRef(id)); }).join("; ")}</p>
        ${full ? `<div class="wslider"><label for="w-${h.id}">Weight</label><input type="range" id="w-${h.id}" data-w="${h.id}" min="0" max="2" step="0.1" value="${state.weights[h.id] == null ? 1 : state.weights[h.id]}"><span class="num" data-wv="${h.id}">${(state.weights[h.id] == null ? 1 : state.weights[h.id]).toFixed(1)}</span><label style="margin-left:auto"><input type="checkbox" data-hide="${h.id}" ${state.hidden[h.id] ? "" : "checked"}> include</label></div>` : ""}
      </article>`).join("")}</div>`;
    $$("[data-w]", v).forEach(s => s.addEventListener("input", () => { state.weights[s.dataset.w] = parseFloat(s.value); $(`[data-wv="${s.dataset.w}"]`).textContent = parseFloat(s.value).toFixed(1); invalidate(); }));
    $$("[data-hide]", v).forEach(c => c.addEventListener("change", () => { state.hidden[c.dataset.hide] = !c.checked; }));
  }

  // ---------- references tab ----------
  function usage(id) {
    const panels = P.filter(p => (p.refs || []).includes(id) || (p.variants || []).some(v => (v.refs || []).includes(id)) || (p.rows || []).some(r => r.refs.includes(id)) || (p.sites || []).some(s => s.ref === id)).map(p => p.short);
    const hyps = H.filter(h => h.refs.includes(id)).map(h => h.id);
    return { panels, hyps };
  }
  function renderRefs() {
    const v = $("#view-references");
    const groups = Array.from(new Set(R.map(r => r.group)));
    v.innerHTML = `<div class="prose" style="max-width:none;margin-bottom:12px"><h2>References</h2>
      <p>All papers and datasets used for panels, curves and hypotheses (${R.length} entries). Status: <span class="status verified">verified</span> details were checked during the build; <span class="status zip">lecture archive</span> supplied in the course material; <span class="status to-verify">to verify</span> cited from the wider literature and still to be checked against the original. New papers can be added in <code>data/references.js</code>.</p></div>
      <div class="ref-tools"><input type="search" id="r-q" placeholder="Search author, title, journal or topic" aria-label="Search references">
        <select id="r-g" aria-label="Group"><option value="">All groups</option>${groups.map(g => `<option>${esc(g)}</option>`).join("")}</select>
        <select id="r-s" aria-label="Status"><option value="">All statuses</option><option value="verified">Verified</option><option value="zip">Lecture archive</option><option value="to verify">To verify</option></select>
        <span class="sub" id="r-n" style="color:var(--muted)"></span></div>
      <div id="r-list"></div>`;
    const draw = () => {
      const q = $("#r-q").value.toLowerCase(), g = $("#r-g").value, s = $("#r-s").value;
      const list = R.filter(r => (!g || r.group === g) && (!s || r.status === s) && (!q || `${r.authors} ${r.title} ${r.journal} ${r.year} ${(r.topics || []).join(" ")}`.toLowerCase().includes(q)));
      $("#r-n").textContent = `${list.length} shown`;
      let html = "";
      groups.forEach(gr => {
        const items = list.filter(r => r.group === gr).sort((a, b) => a.authors.localeCompare(b.authors) || a.year - b.year);
        if (!items.length) return;
        html += `<div class="ref-group"><h3>${esc(gr)}</h3>${items.map(r => { const u = usage(r.id); const link = refLink(r); return `<div class="ref"><div><div class="t">${esc(r.title)}</div><div class="m">${esc(r.authors)} (${r.year}). ${esc(r.journal)}.${link ? ` <a href="${esc(link)}" target="_blank" rel="noopener">${esc(r.doi ? "doi:" + r.doi : link)}</a>` : ""}</div></div><span class="status ${r.status.replace(" ", "-")}">${r.status === "zip" ? "lecture archive" : esc(r.status)}</span>${u.panels.length || u.hyps.length ? `<div class="used">Used in: ${[...u.panels, ...u.hyps].map(esc).join(", ")}</div>` : ""}</div>`; }).join("")}</div>`;
      });
      $("#r-list").innerHTML = html || `<p class="sub">No references match.</p>`;
    };
    ["r-q", "r-g", "r-s"].forEach(id => $("#" + id).addEventListener("input", draw));
    draw();
  }

  // ---------- method tab ----------
  function renderMethod() {
    $("#view-method").innerHTML = `<div class="prose">
      <h2>What the app does</h2>
      <p>The timeline stacks parameters from the Ediacaran to the end of the Ordovician. Panels are ordered from the best constrained (chronostratigraphy, δ13C, fossil records) to the least constrained (model-based CO2 and O2, and a derived index). For any position of the bar, the app evaluates a set of hypotheses for animal diversification against the data in a time window around the bar.</p>
      <h2>Confidence tiers</h2>
      <table><thead><tr><th>Tier</th><th>Meaning</th><th>Weight</th></tr></thead><tbody>
        <tr><td><span class="tier A">A</span></td><td>Direct, well-dated, many independent records</td><td>1.0</td></tr>
        <tr><td><span class="tier B">B</span></td><td>Good proxy or observation with known biases, or regional coverage</td><td>0.75</td></tr>
        <tr><td><span class="tier C">C</span></td><td>Indirect proxy, sparse data, or methods that disagree</td><td>0.5</td></tr>
        <tr><td><span class="tier D">D</span></td><td>Model output or derived index without direct proxy</td><td>0.3</td></tr></tbody></table>
      <p>A panel's tier can change through time, and alternative curves can have their own tiers. The badge on the right of each panel shows the tier at the bar.</p>
      <h2>Given and outcome</h2>
      <p>Each panel can be a Given (accepted as a condition), an Outcome (something to explain), or Off. Predictions of type condition need a Given panel, patterns need an Outcome panel, and links need a Given driver and an Outcome response. If roles do not match, the prediction is untestable and the card says why. This makes explicit that, for example, burrowing cannot be both the thing explained and the cause of diversity in the same question.</p>
      <h2>Tests</h2>
      <ul>
        <li><b>State</b>: the mean normalised value in the window compared with a threshold.</li>
        <li><b>Trend</b>: the slope in the window (normalised units per 10 Myr).</li>
        <li><b>Lead</b>: the driver changes in the window before the bar and the outcome changes after it.</li>
        <li><b>Co-variation</b>: Pearson correlation of first differences of the two series in the window (to avoid correlations that only reflect shared long-term trends, as in Rasmussen et al. 2019). Raw levels can be chosen in Full mode.</li>
        <li><b>Volatility</b>: residual variability around a linear trend in the window.</li>
        <li><b>Trait</b>: whether a trait is established at the bar.</li>
        <li><b>Event</b>: whether a glaciation ended within a set time before the bar.</li>
      </ul>
      <p>Each test gives a score s between −1 (contradicts) and +1 (supports). Values above 0.25 count as support and below −0.25 as contradiction.</p>
      <h2>Scores</h2>
      <p>The weight of a prediction is its specificity (1 to 3) × the tier weight of the weakest panel it uses × the user weight of the hypothesis. Net support is the weighted sum of scores divided by the summed specificity of all predictions, so untestable predictions pull a hypothesis towards zero rather than being ignored. Coverage is the share of a hypothesis (by specificity) that could be tested. Consistency is the weighted share of tested predictions that agree.</p>
      <h2>Importance of parameters</h2>
      <p>For each active panel, the app switches it off and recalculates every hypothesis. The total change in net support measures how much that parameter drives the current conclusions. This is a way to grade the relative importance of parameters at a given time.</p>
      <h2>Double counting</h2>
      <p>Some panels share data or are calculated from each other (for example the diel oxygen index from temperature, sea level, TOC and benthic redox; TOC and redox statistics from the same shale compilation). The app warns when a hypothesis uses both, and in Full mode they can be down-weighted by half.</p>
      <h2>Age models and windows</h2>
      <p>Data are stored on the ICS 2023 chart. The C/D option is a schematic remap between fixed anchors at 551 and 529 Ma that moves the Ediacaran–Cambrian boundary from 538.8 to about 535.5 Ma, after the range of models in Bowyer et al. (2022). The default window grows with age uncertainty: ±0.5 Myr in the Ordovician, ±1 Myr in the later Cambrian, ±1.5 Myr for 545 to 525 Ma, ±2 Myr for 580 to 545 Ma and ±3 Myr before 580 Ma.</p>
      <h2>Limits of version 0.1</h2>
      <ul>
        <li>All curves are simplified, schematic versions of published records. They show the shape and timing described in the sources but are not digitised data. They will be checked and replaced step by step.</li>
        <li>All series are global summaries; regional curves and molecular clocks are not yet included.</li>
        <li>The scores rank hypotheses by consistency with the selected data. They are not probabilities, and they depend on the choice of roles, curves and thresholds, which are shown openly so they can be discussed.</li>
      </ul></div>`;
  }

  // ---------- export ----------
  function download(name, text, type) {
    const b = new Blob([text], { type }); const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportCSV() {
    const res = E.evaluate(state.t, state);
    const rows = [["age_Ma", "age_model", "hypothesis", "name", "net_support", "coverage", "consistency", "prediction", "kind", "status", "score", "detail_or_reason"]];
    res.forEach(r => r.results.forEach(x => rows.push([state.t, state.ageModel, r.id, r.h.name, r.net.toFixed(3), r.coverage.toFixed(2), r.consistency == null ? "" : r.consistency.toFixed(2), x.text, x.kind, x.status, x.s == null ? "" : x.s.toFixed(3), x.s == null ? x.reason : x.detail])));
    download(`cambrian-ledger_${state.t}Ma.csv`, rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  }
  function exportJSON() {
    const res = E.evaluate(state.t, state).map(r => ({ id: r.id, name: r.h.name, net: r.net, coverage: r.coverage, consistency: r.consistency, verdict: r.verdict, predictions: r.results.map(x => ({ id: x.id, text: x.text, kind: x.kind, status: x.status, s: x.s, detail: x.detail || x.reason })) }));
    const settings = { t: state.t, ageModel: state.ageModel, roles: state.roles, variants: state.variants, weights: state.weights, provenancePenalty: state.provenancePenalty, windowOverride: state.windowOverride, covaryMode: state.covaryMode };
    download(`cambrian-ledger_${state.t}Ma.json`, JSON.stringify({ settings, results: res, importance: E.sensitivity(state.t, state) }, null, 2), "application/json");
  }

  // ---------- views, mode ----------
  function setView(v) {
    state.view = v;
    $$(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.view === v));
    ["timeline", "hypotheses", "references", "method"].forEach(id => { $("#view-" + id).hidden = id !== v; });
    $("#toolbar").style.display = v === "timeline" ? "" : "none";
    setHdrH();
    if (v === "hypotheses") renderHyps();
    if (v === "references") renderRefs();
    if (v === "method") renderMethod();
    if (v === "timeline") { renderStack(); renderHeat(); renderSide(); }
    window.scrollTo(0, 0);
  }
  $$(".tab").forEach(t => t.addEventListener("click", () => setView(t.dataset.view)));
  $$("[data-mode]").forEach(b => b.addEventListener("click", () => {
    state.mode = b.dataset.mode;
    $$("[data-mode]").forEach(x => x.setAttribute("aria-pressed", x.dataset.mode === state.mode));
    renderToolbar(); renderGuide(); renderSide();
    if (state.view === "hypotheses") renderHyps();
    setHdrH();
  }));

  function setHdrH() { document.documentElement.style.setProperty("--hdrh", $("#hdr").offsetHeight + "px"); }

  function renderAll() { renderToolbar(); renderGuide(); renderStack(); renderHeat(); renderSide(); setHdrH(); }

  let rT = null, lastW = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rT);
    rT = setTimeout(() => { setHdrH(); const w = $("#stack").clientWidth; if (state.view === "timeline" && Math.abs(w - lastW) > 4) { lastW = w; renderStack(); renderHeat(); } }, 150);
  });

  renderAll();
  lastW = $("#stack").clientWidth;
  window.__CL_STATE = state;
})();
