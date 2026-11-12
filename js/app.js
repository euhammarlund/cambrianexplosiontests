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
    res: null, binCache: new Map(), showHelp: false, tempoResp: "richness", flash: null,
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
  function fmtAge(v) { return v == null ? "–" : String(+v.toFixed(2)); }
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
  function invalidate() { state.heatCache = null; state.binCache = new Map(); }
  function resLabel(r) { return r ? `${r} Myr bins` : "Native (each curve at its data resolution)"; }
  // Resolution status of a panel: what the bins rest on.
  function resInfo(p) {
    if (p.kind !== "curve" && p.kind !== "derived") return null;
    const v = p.kind === "derived" ? p.variants[0] : E.variantOf(p, state);
    const d = E.dataRes(p, state), r = E.effRes(p, state), held = E.heldAt(p, state);
    const sketch = p.kind === "derived" || !v.status || v.status === "schematic";
    let cls, txt, tip;
    if (held) { cls = "held"; txt = `held at ${fmt(d)} Myr (data limit)`; tip = `You asked for ${state.res} Myr bins, but this curve only has information about every ${fmt(d)} Myr. Finer bins would be a mathematical division of a drawn line, so the panel stays at ${fmt(d)} Myr.`; }
    else if (sketch) { cls = "sketch"; txt = `${fmt(r)} Myr bins, schematic`; tip = `Schematic curve: control points about ${fmt(d)} Myr apart. The bins follow these points; they are not measurements at this resolution.${v.srcRes ? " " + v.srcRes + "." : ""}`; }
    else { cls = "data"; txt = `${fmt(r)} Myr bins, real data`; tip = `Bins rest on data: ${v.srcRes || "values from the source"}.`; }
    return { cls, txt, tip, d, r };
  }
  function resTag(p) { const i = resInfo(p); return i ? `<span class="res-tag ${i.cls}" title="${esc(i.tip)}">${esc(i.txt)}</span>` : ""; }
  function nHonour(r) { const cs = P.filter(p => p.kind === "curve"); return { n: cs.filter(p => E.dataRes(p, state) <= r + 1e-9).length, of: cs.length }; }
  // Older and younger edge of the shaded band around the bar: the bin in use, or the test window.
  function bandRange() {
    if (state.res) { const b = E.binBounds(E.binIndex(state.t, state.res), state.res); return b; }
    const W = curWindow(); return [state.t + W, state.t - W];
  }
  const TEMPO_LBL = { slow: "slow", intermediate: "intermediate", fast: "fast", response: "biological response" };

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
      <span class="tb-group"><span class="tb-lbl">Time bar</span><input type="number" id="t-in" class="num" step="0.5" min="440" max="640" value="${state.t}" aria-label="Time bar position in Ma"> Ma</span>
      <span class="tb-group"><span class="tb-lbl">View</span><span class="seg" role="group" aria-label="Visible time range">${T.zooms.map(z => `<button data-zoom="${z.id}" aria-pressed="${state.zoomId === z.id}" title="${z.range[0]} to ${z.range[1]} Ma">${z.name}</button>`).join("")}</span>
        ${full ? `<label>from <input type="number" id="z0" class="num" value="${state.zoom[0]}" step="5"></label><label>to <input type="number" id="z1" class="num" value="${state.zoom[1]}" step="5"> Ma</label>` : ""}</span>
      <span class="tb-group tb-roles"><label class="tb-lbl" for="preset">Roles: what is cause, what is response</label><select id="preset" aria-label="Roles: which panels are causes (Given) and which are responses (Outcome)">${window.CL_PRESETS.map(p => `<option value="${p.id}" ${p.id === state.preset ? "selected" : ""}>${esc(p.name)}</option>`).join("")}${state.preset === "custom" ? `<option value="custom" selected>Custom (set panel by panel)</option>` : ""}</select></span>
      <span class="tb-group"><span class="tb-lbl">Resolution</span><select id="res-sel" aria-label="Time resolution"><option value="" ${!state.res ? "selected" : ""}>Native: data resolution</option>${E.RESOLUTIONS.map(r => { const h = nHonour(r); return `<option value="${r}" ${state.res === r ? "selected" : ""} title="${h.n} of ${h.of} curves have data this fine; the rest are held at their data limit">${r} Myr (${h.n} of ${h.of} curves)</option>`; }).join("")}</select></span>
      <span class="tb-group"><span class="tb-lbl">Age model</span><select id="age-model" aria-label="Age model">${T.ageModels.map(m => `<option value="${m.id}" ${m.id === state.ageModel ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></span>
      <button class="btn" id="pin-btn">${state.pin != null ? `Unpin ${state.pin} Ma` : "Pin bar for comparison"}</button>
      <span class="spacer"></span>
      <button class="btn" id="help-btn" aria-expanded="${state.showHelp}">${state.showHelp ? "Hide help" : "How the controls work"}</button>
      <button class="btn" id="exp-csv">Export CSV</button>
      <button class="btn" id="exp-json">Export JSON</button>
      ${state.showHelp ? `<div class="tb-help">
        <div><b>Time bar</b> is the age you ask questions about. Drag the red line on any plot, click a plot, or type an age. Moving the bar never changes what is drawn.</div>
        <div><b>View</b> sets which stretch of time is drawn. The four buttons are fixed ranges. ${full ? "The from and to boxes set any range you like." : "In Full mode you can also type any range."} If the bar falls outside the new view, it moves to the nearest edge.</div>
        <div><b>Resolution</b> averages every curve into bins before the hypotheses are tested. A curve is never binned finer than its data: if you ask for 1 Myr and a curve only has a value every 10 Myr, that panel is held at 10 Myr and its label turns amber. Native uses each curve at its own data resolution. The numbers in the menu say how many curves really have data that fine. See the time-resolution ledger below the heatmap.</div>
        <div><b>Roles (most important control)</b> decide which panels are taken as given conditions or causes, and which are outcomes to explain. ${full ? "You can also change single panels with the Given, Outcome and Off buttons." : "In Guided mode roles come only from these presets."}</div>
        <div><b>Age model</b> switches between the ICS age of the Ediacaran–Cambrian boundary (538.8 Ma) and a younger boundary of about 535.5 Ma.</div>
        <div><b>Pin</b> keeps a dashed line at the current age so you can compare two ages in the sidebar.</div>
      </div>` : ""}`;
    $("#t-in").addEventListener("change", e => setT(parseFloat(e.target.value)));
    $("#res-sel").addEventListener("change", e => setRes(e.target.value ? parseFloat(e.target.value) : null));
    $("#help-btn").addEventListener("click", () => { state.showHelp = !state.showHelp; renderToolbar(); setHdrH(); });
    $$("[data-zoom]", tb).forEach(b => b.addEventListener("click", () => setZoom(b.dataset.zoom)));
    $("#age-model").addEventListener("change", e => { state.ageModel = e.target.value; invalidate(); renderAll(); });
    $("#preset").addEventListener("change", e => applyPreset(e.target.value));
    $("#pin-btn").addEventListener("click", () => { state.pin = state.pin != null ? null : state.t; LOG("pin", { t: state.pin }); renderToolbar(); renderStack(); renderHeat(); renderSide(); });
    if (full) {
      const zc = () => { const a = parseFloat($("#z0").value), b = parseFloat($("#z1").value); if (a > b + 5) { state.zoom = [Math.min(640, a), Math.max(440, b)]; state.zoomId = "custom"; state.t = clampT(state.t); invalidate(); renderAll(); } };
      $("#z0").addEventListener("change", zc); $("#z1").addEventListener("change", zc);
    }
    $("#exp-csv").addEventListener("click", exportCSV);
    $("#exp-json").addEventListener("click", exportJSON);
  }

  const LOG = (type, d) => { if (window.EV_LOG) window.EV_LOG.add(3, type, d); };
  function setRes(r) {
    LOG("resolution", { res: r });
    state.res = r; invalidate(); renderToolbar(); renderStack(); renderHeat(); renderSide(); renderTempo();
  }
  function setZoom(id) {
    const z = T.zooms.find(x => x.id === id); if (!z) return;
    LOG("view", { id, range: z.range });
    state.zoom = z.range.slice(); state.zoomId = id; state.t = clampT(state.t);
    invalidate(); renderToolbar(); renderStack(); renderHeat(); renderSide(); renderTempo();
  }
  function applyPreset(id) {
    const p = window.CL_PRESETS.find(x => x.id === id); if (!p) return;
    state.preset = id; state.roles = Object.assign({}, p.roles);
    LOG("preset", { id, name: p.name });
    invalidate(); renderToolbar(); renderStack(); renderHeat(); renderSide(); renderTempo();
  }
  function setT(t, light) {
    if (isNaN(t)) return;
    state.t = clampT(t);
    const inp = $("#t-in"); if (inp && document.activeElement !== inp) inp.value = state.t;
    updateBar();
    renderSide();
    clearTimeout(tempoT); tempoT = setTimeout(renderTempo, 180);
    clearTimeout(barLogT); barLogT = setTimeout(() => LOG("bar", { t: state.t }), 1500);
  }
  let tempoT = null, barLogT = null;

  // ---------- guide ----------
  function renderGuide() {
    const g = $("#guide");
    if (state.mode !== "guided") { g.innerHTML = state.flash ? `<div class="guide"><div><p class="flash">${esc(state.flash)}</p></div><div class="guide-nav"><button class="btn" id="g-x">Close</button></div></div>` : ""; const x = $("#g-x"); if (x) x.addEventListener("click", () => { state.flash = null; renderGuide(); }); return; }
    const steps = window.CL_GUIDE, s = steps[state.guideStep];
    g.innerHTML = `<div class="guide">
      <div><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p>
        ${state.flash ? `<p class="flash">${esc(state.flash)}</p>` : ""}
        <details class="rules"><summary>What Guided mode does, and what Full mode adds</summary>${guidedRulesHTML()}</details></div>
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
      if (a.res !== undefined) setRes(a.res);
      if (a.pin != null) { renderStack(); renderHeat(); renderSide(); }
      if (a.focus === "tempo") { const el = $("#tempo"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }
      if (a.focus === "importance") { const el = $("#imp-card"); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.style.outline = "2px solid var(--teal)"; setTimeout(() => el.style.outline = "", 1600); } }
    });
  }

  function guidedRulesHTML() {
    return `<table class="rules-t"><thead><tr><th>Setting</th><th>Guided</th><th>Full</th></tr></thead><tbody>
      <tr><td>Steps</td><td>Seven steps with buttons that set the time, view, roles and resolution for you</td><td>No steps; you set everything</td></tr>
      <tr><td>Roles (Given, Outcome, Off)</td><td>Only the four presets; single panels are locked</td><td>Presets plus panel-by-panel buttons</td></tr>
      <tr><td>Curve choice</td><td>Open: compare temperature, anoxia, O2 and CO2 curves</td><td>Open</td></tr>
      <tr><td>View</td><td>Four fixed ranges</td><td>Fixed ranges or any from–to range</td></tr>
      <tr><td>Time resolution</td><td>Native (data resolution) or 0.25 to 20 Myr bins, never finer than the data</td><td>Same</td></tr>
      <tr><td>Hypothesis weights</td><td>All equal (1.0), all included</td><td>Sliders from 0 to 2, include or exclude</td></tr>
      <tr><td>Test window</td><td>Automatic, set by age uncertainty</td><td>Manual override up to ±10 Myr</td></tr>
      <tr><td>Co-variation test</td><td>First differences (removes shared long-term trends)</td><td>First differences or raw levels</td></tr>
      <tr><td>Shared data</td><td>Warnings shown, no down-weighting</td><td>Optional down-weighting by half</td></tr>
      </tbody></table>
      <p class="sub">Guided mode keeps every student on the same rules, so groups can compare answers. Switching back from Full to Guided restores these settings.</p>`;
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
    const [b0, b1] = bandRange();
    s += `<rect class="winband" data-win x="${xOf(b0)}" y="0" width="${Math.max(1, xOf(b1) - xOf(b0))}" height="${h}"/>`;
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
      const rr = E.effRes(p, state), binned = !!rr;
      segs.forEach(seg => {
        const top = seg.map(s => `${xOf(s.t).toFixed(1)},${y(s.v.hi).toFixed(1)}`);
        const bot = seg.slice().reverse().map(s => `${xOf(s.t).toFixed(1)},${y(s.v.lo).toFixed(1)}`);
        body += `<polygon class="env faint" points="${top.concat(bot).join(" ")}"/>`;
        body += `<polyline class="curve drawn" points="${seg.map(s => `${xOf(s.t).toFixed(1)},${y(s.v.v).toFixed(1)}`).join(" ")}"><title>Line drawn between the entered points; not data</title></polyline>`;
      });
      if (binned) {
        const k0 = E.binIndex(state.zoom[0], rr), k1 = E.binIndex(state.zoom[1] + 1e-6, rr);
        for (let k = k0; k <= k1; k++) {
          const m = E.binMean(p, k, state, { r: rr }); if (!m) continue;
          const xa = Math.max(0, xOf(m.from)), xb = Math.min(plotW, xOf(m.to)); if (xb <= xa) continue;
          body += `<rect class="bin-env" x="${xa.toFixed(1)}" y="${y(m.hi).toFixed(1)}" width="${(xb - xa).toFixed(1)}" height="${Math.max(1, y(m.lo) - y(m.hi)).toFixed(1)}"/>`;
          body += `<line class="bin-line" x1="${xa.toFixed(1)}" x2="${xb.toFixed(1)}" y1="${y(m.v).toFixed(1)}" y2="${y(m.v).toFixed(1)}"><title>${m.from}–${m.to} Ma bin mean: ${fmtVal(m.v, variant)} ${esc(variant.unit)}</title></line>`;
        }
      }
      // entered points (sources), only when they are not too dense to read
      if (p.kind === "curve") {
        const pts = variant.points.map(q => ({ t: E.toDisplay(q[0], state.ageModel), v: q[1] })).filter(q => q.t <= state.zoom[0] && q.t >= state.zoom[1]);
        if (pts.length && pts.length <= 70) pts.forEach(q => { body += `<circle class="dpt" cx="${xOf(q.t).toFixed(1)}" cy="${y(q.v).toFixed(1)}" r="2.2"><title>Entered value ${fmtVal(q.v, variant)} ${esc(variant.unit)} at ${q.t} Ma</title></circle>`; });
      }
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
    const u = E.roleUsage(p.id), lock = state.mode === "guided";
    const lk = lock ? " In Guided mode, roles come from the Roles preset; switch to Full to change single panels." : "";
    const tg = `Given: ${p.short} is taken as a condition or possible cause. ${u.given.length} prediction${u.given.length === 1 ? "" : "s"} can use it this way.${lk}`;
    const to = `Outcome: ${p.short} is the response to be explained. ${u.outcome.length} prediction${u.outcome.length === 1 ? "" : "s"} can use it this way.${lk}`;
    const tf = `Off: ${p.short} is left out of every test.${lk}`;
    return `<span class="roles ${lock ? "locked" : ""}" role="group" aria-label="Role of ${esc(p.short)}">
      <button class="given" data-role="given" data-pid="${p.id}" aria-pressed="${r === "given"}" title="${esc(tg)}" ${lock ? "aria-disabled=\"true\"" : ""}>Given</button>
      <button class="outcome" data-role="outcome" data-pid="${p.id}" aria-pressed="${r === "outcome"}" title="${esc(to)}" ${lock ? "aria-disabled=\"true\"" : ""}>Outcome</button>
      <button class="off" data-role="off" data-pid="${p.id}" aria-pressed="${r === "off"}" title="${esc(tf)}" ${lock ? "aria-disabled=\"true\"" : ""}>Off</button></span>`;
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
    const labelw = narrow ? 0 : 168, metaw = narrow ? 0 : 252;
    plotW = Math.max(260, meas - labelw - metaw - 2);
    let head = `<div class="stack-head"><div>Parameter, from more to less constrained</div><div>Time (Ma, ${esc(T.chart)}), older on the left · ${state.res ? `${state.res} Myr bins where the data allow` : "native data resolution"}</div><div>At the bar · confidence · role · data</div></div>
      <div class="role-legend"><span class="rl given">Given</span> taken as a condition or possible cause <span class="rl outcome">Outcome</span> the response the question tries to explain <span class="rl off">Off</span> left out. Open a panel's data link to see which predictions each role makes testable.</div>
      <div class="res-legend"><b>Time resolution:</b> <span class="res-tag data">real data</span> bins rest on measured or digitised values at that spacing <span class="res-tag sketch">schematic</span> bins follow the control points of a simplified curve <span class="res-tag held">held at data limit</span> you asked for finer bins than the data, so the panel keeps its data resolution. Step lines are bin means; the thin dashed line only joins the points and is not data. Dots mark the values entered from the sources.</div>`;
    let html = "";
    const legend = head.slice(head.indexOf('<div class="role-legend">')); head = head.slice(0, head.indexOf('<div class="role-legend">')); html += legend;
    P.forEach(p => {
      const grp = p.group;
      const role = state.roles[p.id];
      const svg = p.kind === "framework" ? frameworkSVG() : p.kind === "traits" ? traitsSVG(p) : curveSVG(p);
      const variantSel = p.variants && p.variants.length > 1 ? `<select data-variant="${p.id}" aria-label="Curve for ${esc(p.short)}">${p.variants.map(v => `<option value="${v.id}" ${state.variants[p.id] === v.id ? "selected" : ""} title="${esc(v.name)}">${esc(v.name.replace(/\s*\([^)]*\)\s*$/, ""))}</option>`).join("")}</select>` : "";
      const tempo = p.tempo ? `<span class="tempo-tag ${p.tempo.cls}" title="${esc(p.tempo.note)}">${esc(TEMPO_LBL[p.tempo.cls])}</span>` : "";
      const row = `<div class="panel ${p.testable !== false && role === "off" ? "off" : ""}" data-panel="${p.id}">
        <div class="p-label"><span class="nm">${esc(p.name)}</span><span class="ty">${esc(p.group)} · ${esc(p.dataType)} · ${esc((p.kind === "curve" && E.variantOf(p, state).scale) || p.scale)}</span>${tempo}${resTag(p)}</div>
        <div class="p-plot" data-plot tabindex="0" aria-label="Timeline for ${esc(p.short)}. Use arrow keys to move the bar.">${svg}</div>
        <div class="p-meta">
          <div class="meta-top"><span class="val num" data-val="${p.id}"></span><span class="tier" data-tier="${p.id}" title="${esc(p.tierReason)}"></span></div>
          ${roleButtons(p)}
          ${variantSel}
          ${sourcesLine(p)}
        </div></div>`;
      if (p.kind === "framework") head += row; else html += row;
    });
    const sk = $("#sticky");
    sk.innerHTML = head;
    st.innerHTML = html;
    [sk, st].forEach(root => {
      $$("[data-role]", root).forEach(b => b.addEventListener("click", () => {
        if (state.mode === "guided") { state.flash = "In Guided mode, roles are set with the Roles presets in the toolbar. Switch to Full mode to change single panels."; renderGuide(); toast(state.flash); return; }
        state.roles[b.dataset.pid] = b.dataset.role; state.preset = "custom"; LOG("role", { panel: b.dataset.pid, role: b.dataset.role }); invalidate(); renderToolbar(); renderStack(); renderHeat(); renderSide(); renderTempo();
      }));
      $$("[data-variant]", root).forEach(s => s.addEventListener("change", () => { state.variants[s.dataset.variant] = s.value; { const pp = E.panelsById[s.dataset.variant]; const vv = pp.variants.find(x => x.id === s.value); LOG("curve", { panel: pp.id, id: s.value, name: `${pp.short}: ${vv ? vv.name : s.value}` }); } invalidate(); renderStack(); renderHeat(); renderSide(); renderTempo(); }));
      $$("[data-drawer]", root).forEach(b => b.addEventListener("click", () => openDrawer(b.dataset.drawer)));
      $$("[data-plot]", root).forEach(attachDrag);
    });
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
    const x = xOf(state.t), [b0, b1] = bandRange();
    $$("[data-bar]").forEach(l => { l.setAttribute("x1", x); l.setAttribute("x2", x); });
    $$("[data-win]").forEach(r => { r.setAttribute("x", xOf(b0)); r.setAttribute("width", Math.max(1, xOf(b1) - xOf(b0))); });
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
        if (true) {
          const m = E.binnedValueAt(p, state.t, state);
          el.innerHTML = m ? `${fmtVal(m.v, variant)} <span class="rng">${esc(variant.unit)}</span><br><span class="rng">mean of ${fmt(m.r)} Myr bin, ${fmtAge(m.from)}–${fmtAge(m.to)} Ma</span> ${trendArrow(p)}` : `<span class="rng">no data in this bin</span>`;
        } else {
          const v = E.valueAt(p, ics, state);
          el.innerHTML = v ? `${fmtVal(v.v, variant)} <span class="rng">${esc(variant.unit)}</span><br><span class="rng">range ${fmtVal(v.lo, variant)} to ${fmtVal(v.hi, variant)}</span> ${trendArrow(p)}` : `<span class="rng">no data at this time</span>`;
        }
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
      <p class="sub">${esc(per && per.name !== stg.name ? per.name + ", " : "")}${esc(stg.name)} (${esc(T.chart)}). Evaluation window ±${W} Myr ${state.windowOverride ? "(set manually)" : "(age uncertainty)"}.${state.ageModel !== "ab" ? ` ICS-equivalent age ${ics.toFixed(1)} Ma.` : ""}</p>
      <p class="sub">Resolution: ${state.res ? `${state.res} Myr bins requested. ${nHonour(state.res).n} of ${nHonour(state.res).of} curves have data this fine; the others are held at their own data resolution (amber labels).` : "native. Each curve is binned at the resolution of its own data, from 0.25 Myr (digitised diversity curves) to 20 Myr (sparse schematic curves)."} A test that compares two curves uses the coarser of the two.</p>
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

  function roleSection(p) {
    if (p.testable === false) return "";
    const u = E.roleUsage(p.id), r = state.roles[p.id] || "off";
    const li = list => list.length ? `<ul class="rlist">${list.map(x => `<li><b>${x.q.id}</b> ${esc(x.q.text)} <span class="sub">(${esc(x.h.name)})</span></li>`).join("")}</ul>` : "";
    const nm = esc(p.short);
    let txt = `<h4>Role in the question (now: ${r === "given" ? "Given" : r === "outcome" ? "Outcome" : "Off"})</h4>
      <p>The data are the same in every role. The role decides which question the data answer. As <b>Given</b>, ${nm} is taken as a condition or possible cause, and the app tests whether biology or chemistry responds to it. As <b>Outcome</b>, ${nm} is the response, and the app tests whether it changes as a hypothesis predicts. <b>Off</b> leaves it out of every test.</p>`;
    txt += `<p><span class="rl given">Given</span> makes ${u.given.length} prediction${u.given.length === 1 ? "" : "s"} testable${u.given.length ? ":" : "."}</p>${li(u.given)}`;
    txt += `<p><span class="rl outcome">Outcome</span> makes ${u.outcome.length} prediction${u.outcome.length === 1 ? "" : "s"} testable${u.outcome.length ? ":" : "."}</p>${li(u.outcome)}`;
    if (!u.given.length && u.outcome.length) txt += `<div class="warn">No current hypothesis treats ${nm} as a cause, so setting it to Given only makes ${u.outcome.length} predictions untestable. A hypothesis in which ${nm} drives something else (for example diversity begetting diversity) would have to be added first.</div>`;
    if (u.given.length && !u.outcome.length) txt += `<div class="warn">No current hypothesis tries to explain ${nm}, so setting it to Outcome only makes ${u.given.length} predictions untestable.</div>`;
    return txt;
  }

  // ---------- time-resolution ledger ----------
  function renderTempo() {
    const el = $("#tempo"); if (!el) return;
    if (state.view !== "timeline") return;
    const widths = [null].concat(E.RESOLUTIONS);
    const sup = E.supportByRes(state.t, state, widths);
    const hyps = H.filter(h => !state.hidden[h.id]);
    const cell = (v, cur) => `<td class="n${cur ? " cur" : ""}" style="background:${netColor(v)}">${(v >= 0 ? "+" : "") + v.toFixed(2)}</td>`;
    let tA = `<table class="tempo-t"><thead><tr><th>Hypothesis</th>${widths.map(r => `<th><button class="lnk" data-setres="${r || ""}" aria-pressed="${state.res === r}">${r ? r + " Myr" : "Native"}</button></th>`).join("")}</tr></thead><tbody>`;
    hyps.forEach(h => { tA += `<tr><td>${h.id} ${esc(h.name)}</td>${sup.map(x => cell(x.net[h.id], state.res === x.r)).join("")}</tr>`; });
    tA += `</tbody></table>`;
    // driver x resolution correlation with the chosen response over the view
    const respOpts = P.filter(p => p.kind === "curve" && E.roleUsage(p.id).outcome.length);
    if (!respOpts.some(p => p.id === state.tempoResp)) state.tempoResp = "richness";
    const drivers = P.filter(p => (p.kind === "curve" || p.kind === "derived") && p.id !== state.tempoResp && p.id !== "framework");
    const order = { slow: 0, intermediate: 1, fast: 2, response: 3 };
    drivers.sort((a, b) => (order[a.tempo && a.tempo.cls] || 0) - (order[b.tempo && b.tempo.cls] || 0));
    let tB = `<table class="tempo-t"><thead><tr><th>Parameter</th><th>Tempo</th>${E.RESOLUTIONS.map(r => `<th>${r} Myr</th>`).join("")}</tr></thead><tbody>`;
    drivers.forEach(d => {
      tB += `<tr><td>${esc(d.short)}</td><td><span class="tempo-tag ${d.tempo.cls}">${esc(TEMPO_LBL[d.tempo.cls])}</span></td>`;
      E.RESOLUTIONS.forEach(r => {
        const c = E.rangeCorr(d.id, state.tempoResp, state.zoom, r, state);
        if (c.held) tB += `<td class="n na held" title="The data of one of the two curves are coarser than ${r} Myr (held at ${c.used} Myr), so this column would only repeat a mathematical division">held</td>`;
        else if (c.r == null || c.n < 5) tB += `<td class="n na" title="Too few bins with data (${c.n})">–</td>`;
        else tB += `<td class="n${c.n < 8 ? " few" : ""}${state.res === r ? " cur" : ""}" style="background:${netColor(c.r)}" title="${c.n} bins with data${c.n < 8 ? "; few bins, treat with care" : ""}">${(c.r >= 0 ? "+" : "") + c.r.toFixed(2)}</td>`;
      });
      tB += `</tr>`;
    });
    tB += `</tbody></table>`;
    const hr = ["fan2020", "deng2021", "deng2023", "zhangsh2021"].map(id => { const r = refById[id]; const l = r && refLink(r); return l ? `<a href="${esc(l)}" target="_blank" rel="noopener">${esc(shortRef(id))}</a>` : esc(shortRef(id)); }).join(", ");
    el.innerHTML = `<div class="heat-head"><div><h3>Time-resolution ledger</h3><p>Every curve is averaged into bins before the hypotheses are tested, and no curve is binned finer than its data. Rasmussen et al. (2019) and Kröger et al. (2019) refined the binning to about 2.5 Myr on average; CONOP composites from South China reach about 20 to 30 kyr. Coarse bins favour slow, first-order drivers such as plate configuration; fast drivers such as climate steps or anoxic pulses can only show a link when the bins are shorter than the process.</p></div></div>
      <div class="tempo-grid">
        <div><h4>Support at ${state.t.toFixed(1)} Ma for each bin width</h4><p class="sub">Net support with the current roles and curves. Click a column to use that resolution on the timeline.</p>${tA}</div>
        <div><h4>Co-variation with <select id="tempo-resp" aria-label="Response parameter">${respOpts.map(p => `<option value="${p.id}" ${p.id === state.tempoResp ? "selected" : ""}>${esc(p.short)}</option>`).join("")}</select> over ${state.zoom[0]}–${state.zoom[1]} Ma</h4>
          <p class="sub">Pearson r of ${state.covaryMode === "levels" ? "bin means" : "first differences of bin means"} across the whole view (not only at the bar). Pale italic cells rest on fewer than 8 bins. Change the view to focus on one interval.</p>${tB}</div>
      </div>
      <p class="sub tempo-note">Cells marked "held" would need data finer than one of the two curves has, so they are not computed. The diversity panel now includes real high-resolution curves digitised from ${hr}; choose one in the Diversity panel to test fast drivers. Most environmental curves are still schematic, so many short-bin results are limited by the driver, not by diversity.</p>`;
    $$("[data-setres]", el).forEach(b => b.addEventListener("click", () => setRes(b.dataset.setres ? parseFloat(b.dataset.setres) : null)));
    $("#tempo-resp").addEventListener("change", e => { state.tempoResp = e.target.value; renderTempo(); });
  }

  // ---------- drawer ----------
  function openDrawer(pid) {
    const p = E.panelsById[pid];
    const v = p.kind === "curve" ? E.variantOf(p, state) : null;
    const prov = window.CL_PROVENANCE.filter(x => x.a === pid || x.b === pid);
    const usedBy = H.filter(h => h.preds.some(q => q.panel === pid || q.a === pid || q.b === pid));
    let html = `<h2>${esc(p.name)}</h2><p class="sub" style="color:var(--muted)">${esc(p.group)} · ${esc(p.dataType)} · ${esc(p.scale)}</p>
      <p>${esc(p.description)}</p>${p.caveat ? `<div class="warn">${esc(p.caveat)}</div>` : ""}
      ${roleSection(p)}
      ${p.tempo ? `<h4>Tempo of the process</h4><p><span class="tempo-tag ${p.tempo.cls}">${esc(TEMPO_LBL[p.tempo.cls])}</span> ${esc(p.tempo.note)}</p>` : ""}
      ${resInfo(p) ? `<h4>Time resolution of the data</h4><p><span class="res-tag ${resInfo(p).cls}">${esc(resInfo(p).txt)}</span> ${esc(resInfo(p).tip)} The app never bins this curve finer than ${fmt(resInfo(p).d)} Myr.</p>` : ""}
      <h4>Confidence</h4><p>${esc(p.tierReason)}</p>
      <table class="pts"><thead><tr><th>Interval (Ma, ICS)</th><th>Tier</th></tr></thead><tbody>${((v && v.tiers) || p.tiers).map(x => `<tr><td>${x.from} to ${x.to}</td><td><span class="tier ${x.tier}">${x.tier}</span></td></tr>`).join("")}</tbody></table>`;
    if (p.variants && p.variants.length && p.kind !== "framework") {
      html += `<h4>Curves available</h4><ul>${p.variants.map(x => `<li>${x.id === (v && v.id) ? "<b>" : ""}${esc(x.name)}${x.id === (v && v.id) ? "</b> (selected)" : ""}. ${x.refs ? "Data: " + x.refs.map(shortRef).map(esc).join("; ") : ""}</li>`).join("")}</ul>`;
    }
    if (p.rows) html += `<h4>Trait rows (first evidence, Ma)</h4><table class="pts"><thead><tr><th>Trait</th><th>Steps (age: level)</th><th>Sources</th></tr></thead><tbody>${p.rows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.steps.map(s => `${s[0]}: ${s[1]}`).join(", ")}</td><td>${r.refs.map(shortRef).map(esc).join("; ")}</td></tr>`).join("")}</tbody></table>`;
    if (p.sites) html += `<h4>Site records</h4><table class="pts"><thead><tr><th>Site</th><th>Ma</th><th>Note</th></tr></thead><tbody>${p.sites.map(s => `<tr><td>${esc(s.name)}</td><td>${s.from}–${s.to}</td><td style="text-align:left">${esc(s.note)} (${esc(shortRef(s.ref))})</td></tr>`).join("")}</tbody></table>`;
    if (v && v.note) html += `<div class="note-box">${esc(v.note)}</div>`;
    if (v && v.points.length) html += `<h4>${v.status === "digitised" ? `Values of the selected curve (digitised from the published figure, ${v.points.length} points)` : v.status === "data summary" ? "Values of the selected curve (read from the papers)" : "Control points of the selected curve (schematic)"}</h4><table class="pts"><thead><tr><th>Age (Ma)</th><th>Value</th><th>Low</th><th>High</th></tr></thead><tbody>${v.points.map(q => `<tr><td>${q[0]}</td><td>${fmtVal(q[1], v)}</td><td>${fmtVal(q[2], v)}</td><td>${fmtVal(q[3], v)}</td></tr>`).join("")}</tbody></table><p class="sub" style="color:var(--muted)">Unit: ${esc(v.unit)}. ${v.status === "digitised" ? "Read from the published figure with an image-analysis script. Low and high are a nominal ±10% band, not the published confidence interval. Ages are on GTS2020 as in the paper and restaged to ICS 2026." : v.status === "data summary" ? "Stage-level or interval-level values taken from the text and figures. Low and high are approximate ranges." : "These points are simplified for teaching and will be replaced by digitised data after checking."}</p>`;
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
    const rs = T.restage, ch = [];
    rs.from.forEach((x, i) => { if (x !== rs.to[i] && x <= 640 && x >= 440) ch.push([T.stages.concat(T.periods).find(st => Math.abs(st.from - rs.to[i]) < 1e-6), x, rs.to[i]]); });
    $("#view-method").innerHTML = `<div class="prose">
      <h2>What the app does</h2>
      <p>The timeline stacks parameters from the Ediacaran to the end of the Ordovician. Panels are ordered from the best constrained (chronostratigraphy, δ13C, fossil records) to the least constrained (model-based CO2 and O2, and a derived index). For any position of the time bar, the app tests a set of hypotheses for early animal diversification against the data in a time window around the bar.</p>

      <h2>Guided and Full modes</h2>
      <p>Both modes use the same data and the same scoring. Guided mode fixes the settings that most change the scores, so that a class of 40 students works under the same rules and can compare answers. Full mode opens every setting for exploration once the rules are understood.</p>
      ${guidedRulesHTML()}

      <h2>Time bar, view and resolution</h2>
      <ul>
        <li><b>Time bar</b>: the age you ask questions about. It is set by dragging, clicking a plot, the arrow keys, or the number box. It does not change what is drawn.</li>
        <li><b>View</b>: the stretch of time that is drawn. The four buttons are fixed ranges (640–440, 585–500, 555–505 and 500–440 Ma). In Full mode, the from and to boxes set any range. The view also sets the range used by the co-variation table in the time-resolution ledger.</li>
        <li><b>Resolution</b>: the bin width used to average every curve before testing (see below).</li>
      </ul>

      <h2>Given, Outcome and Off</h2>
      <p>The data in a panel are the same whatever its role. The role decides which question those data are used to answer.</p>
      <ul>
        <li><b>Given</b>: the panel is taken as a condition or a possible cause. Example: with temperature as Given, the app can test "temperature falls before diversity rises".</li>
        <li><b>Outcome</b>: the panel is the response the question tries to explain. Example: with diversity as Outcome, the app tests whether diversity rises when a hypothesis says it should.</li>
        <li><b>Off</b>: the panel is left out of every test, for example to see what can be concluded without it.</li>
      </ul>
      <p>Each prediction states which role it needs. A condition needs its panel as Given, a pattern needs its panel as Outcome, and a link needs the driver as Given and the response as Outcome. If the roles do not match, the prediction is marked untestable and the card says why. This keeps one record from being used as both cause and effect in the same question. In the current set of 13 hypotheses, diversity is only ever a response: setting it to Given makes 14 predictions untestable and adds none. Each panel's data drawer lists the predictions that each role makes testable.</p>

      <h2>Time resolution</h2>
      <p>Rasmussen et al. (2019) and Kröger et al. (2019) showed that the tempo of diversification is lost when diversity is counted in long time bins, and refined the binning to about 2.5 Myr on average. CONOP composites from South China (Fan et al. 2020; Deng et al. 2021, 2023; Zhang et al. 2021) reach resolutions of about 20 to 30 kyr. The resolution setting tests how much the answer depends on bin width.</p>
      <ul>
        <li><b>No resolution higher than the data.</b> Each curve has a data resolution: the spacing of its digitised points (0.25 or 0.5 Myr for the CONOP diversity curves) or of the control points of a simplified curve (5 to 20 Myr). The default setting, Native, bins every curve at its own data resolution. If you choose a finer bin width, curves with coarser data are held at their data limit and marked "held at data limit".</li>
        <li>Bins of equal length (0.25, 0.5, 1, 2, 2.5, 5, 10 or 20 Myr) are counted from 640 Ma. Each curve is drawn as its bin means (steps). A thin dashed line joins the data or control points and is not data. Dots mark the values that were entered.</li>
        <li>The label under each panel name says whether its bins rest on real data (green), follow a simplified curve (grey, dashed), or are held at the data limit (amber). A test that compares two curves uses the coarser of the two resolutions.</li>
        <li>Each test needs a minimum number of bins: a trend uses at least ±1.5 bins, a lead at least 2 bins on each side, volatility at least ±2 bins, and co-variation at least ±2.5 bins. With 20 Myr bins, a co-variation test therefore looks across about 100 Myr.</li>
        <li>Each panel has a tempo label: slow (first order, tens of Myr), intermediate (about 1 to 10 Myr), fast (1 Myr or less) or biological response. When bins are narrower than the spacing of a curve's control points, the panel says so, because the bins then show interpolation rather than data.</li>
        <li>The time-resolution ledger below the heatmap shows the support for each hypothesis at the bar for every bin width, and the co-variation of each parameter with a chosen response across the view for every bin width.</li>
        <li>Trait rows and event tests are not binned.</li>
      </ul>

      <h2>Data added in version 0.3</h2>
      <p>The diversity panel now offers four curves digitised from published figures: species richness from China (Fan et al. 2020, 0.5 Myr, 535 to 440 Ma, the default), South China (Deng et al. 2021, 0.25 Myr), the Furongian and Early Ordovician (Deng et al. 2023, 0.25 Myr) and the Ordovician of China (Zhang et al. 2021). The sampling panel has the sampling curve of Deng et al. (2021). Two new panels summarise the skeletal share of carbonate production (Pruss et al. 2010; Pruss and Clemente 2011; Pruss and Knoll 2017) and modes of life (Bambach et al. 2007, after Bambach 1983 and Droser and Bambach 2001). Digitised values are read from figures, not from the original data tables, and carry a nominal ±10% band. They are mostly regional.</p>

      <h2>The four stages of the lab</h2>
      <p>Stage 1 sorts Christian Rasmussen's determinant cards into abiotic and biotic camps. Stage 2 tests simple cause and effect ideas against the hypotheses and the data of this explorer, at the native resolution of the data, for the Cambrian explosion (545 to 505 Ma) and the GOBE (490 to 450 Ma). Stage 3 is this explorer. Stage 4 summarises the session. All steps, insights, opinions, tick answers and feedback are logged while the page is open and handed in as a readable PDF that also carries the full log in its metadata. Teachers log in on the teacher page (Teacher login in the footer), load many PDFs at once, and get an overview of the learning goals (self-rating next to what the logs show) and an overall PDF summary.</p>

      <h2>Confidence tiers</h2>
      <table><thead><tr><th>Tier</th><th>Meaning</th><th>Weight</th></tr></thead><tbody>
        <tr><td><span class="tier A">A</span></td><td>Direct, well-dated, many independent records</td><td>1.0</td></tr>
        <tr><td><span class="tier B">B</span></td><td>Good proxy or observation with known biases, or regional coverage</td><td>0.75</td></tr>
        <tr><td><span class="tier C">C</span></td><td>Indirect proxy, sparse data, or methods that disagree</td><td>0.5</td></tr>
        <tr><td><span class="tier D">D</span></td><td>Model output or derived index without direct proxy</td><td>0.3</td></tr></tbody></table>
      <p>A panel's tier can change through time, and alternative curves can have their own tiers. The badge on the right of each panel shows the tier at the bar.</p>

      <h2>Tests</h2>
      <ul>
        <li><b>State</b>: the mean normalised value in the window compared with a threshold.</li>
        <li><b>Trend</b>: the slope in the window (normalised units per 10 Myr, whatever the bin width).</li>
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
      <p>For each active panel, the app switches it off and recalculates every hypothesis. The total change in net support measures how much that parameter drives the current conclusions at the bar.</p>

      <h2>Double counting</h2>
      <p>Some panels share data or are calculated from each other (for example the diel oxygen index from temperature, sea level, TOC and benthic redox; TOC and redox statistics from the same shale compilation). The app warns when a hypothesis uses both, and in Full mode they can be down-weighted by half.</p>

      <h2>Chronostratigraphic chart and age models</h2>
      <p>Ages follow the ICS International Chronostratigraphic Chart v2026/06 (Cohen et al. 2025, updated). Version 0.1 used older boundary ages. To keep each data point in the same stratigraphic position, ages are moved piecewise linearly within each stage onto the new boundaries. The changed boundaries in 640–440 Ma are:</p>
      <table><thead><tr><th>Base of</th><th>Version 0.1 (Ma)</th><th>ICS 2026/06 (Ma)</th><th>Shift (Myr)</th></tr></thead><tbody>
        ${ch.map(([st, a, b]) => `<tr><td>${esc(st ? st.name : "")}</td><td>${a}</td><td>${b}</td><td>${(b - a >= 0 ? "+" : "") + (b - a).toFixed(2)}</td></tr>`).join("")}</tbody></table>
      <p>Positive shifts mean older. The largest change in the interval is the base of the Wuliuan, 2.5 Myr younger, which stretches Stage 4 and moves Burgess Shale-age data to about 506 Ma. The C/D age model is a schematic remap between fixed anchors at 551 and 529 Ma that moves the Ediacaran–Cambrian boundary from 538.8 to about 535.5 Ma, after the range of models in Bowyer et al. (2022). The default test window grows with age uncertainty: ±0.5 Myr in the Ordovician, ±1 Myr in the later Cambrian, ±1.5 Myr for 545 to 525 Ma, ±2 Myr for 580 to 545 Ma and ±3 Myr before 580 Ma.</p>

      <h2>Limits of version 0.5</h2>
      <ul>
        <li>Apart from the diversity, sampling, carbonate production and modes-of-life panels, the curves are simplified, schematic versions of published records. They show the shape and timing described in the sources but are not digitised data. They will be checked and replaced step by step.</li>
        <li>The digitised curves were read from published figures, not raw data, and come mainly from China. The other series are global summaries; molecular clocks are not yet included.</li>
        <li>The Stage 2 replies are simple summaries of the same tests. They are meant to start discussion, not to settle it.</li>
        <li>The scores rank hypotheses by consistency with the selected data. They are not probabilities, and they depend on the choice of roles, curves, bin widths and thresholds, which are shown openly so they can be discussed.</li>
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
    const rows = [["age_Ma", "age_model", "resolution_Myr", "hypothesis", "name", "net_support", "coverage", "consistency", "prediction", "kind", "status", "score", "detail_or_reason"]];
    res.forEach(r => r.results.forEach(x => rows.push([state.t, state.ageModel, state.res || "native", r.id, r.h.name, r.net.toFixed(3), r.coverage.toFixed(2), r.consistency == null ? "" : r.consistency.toFixed(2), x.text, x.kind, x.status, x.s == null ? "" : x.s.toFixed(3), x.s == null ? x.reason : x.detail])));
    download(`evoearth_${state.t}Ma.csv`, rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  }
  function exportJSON() {
    const res = E.evaluate(state.t, state).map(r => ({ id: r.id, name: r.h.name, net: r.net, coverage: r.coverage, consistency: r.consistency, verdict: r.verdict, predictions: r.results.map(x => ({ id: x.id, text: x.text, kind: x.kind, status: x.status, s: x.s, detail: x.detail || x.reason })) }));
    const settings = { chart: T.chart, resolution_Myr: state.res, t: state.t, ageModel: state.ageModel, roles: state.roles, variants: state.variants, weights: state.weights, provenancePenalty: state.provenancePenalty, windowOverride: state.windowOverride, covaryMode: state.covaryMode };
    download(`evoearth_${state.t}Ma.json`, JSON.stringify({ settings, results: res, importance: E.sensitivity(state.t, state) }, null, 2), "application/json");
  }

  // ---------- views, mode ----------
  function setView(v) {
    if (state.view !== v) LOG("tab", { view: v });
    state.view = v;
    $$(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.view === v));
    ["timeline", "hypotheses", "references", "method"].forEach(id => { $("#view-" + id).hidden = id !== v; });
    $("#toolbar").style.display = v === "timeline" ? "" : "none";
    setHdrH();
    if (v === "hypotheses") renderHyps();
    if (v === "references") renderRefs();
    if (v === "method") renderMethod();
    if (v === "timeline") { renderStack(); renderHeat(); renderSide(); renderTempo(); }
    window.scrollTo(0, 0);
  }
  $$(".tab").forEach(t => t.addEventListener("click", () => setView(t.dataset.view)));
  $$("[data-mode]").forEach(b => b.addEventListener("click", () => {
    const prev = state.mode;
    state.mode = b.dataset.mode; LOG("mode", { mode: state.mode });
    $$("[data-mode]").forEach(x => x.setAttribute("aria-pressed", x.dataset.mode === state.mode));
    state.flash = null;
    if (state.mode === "guided" && prev === "full") {
      const changed = [];
      if (Object.keys(state.weights).length || Object.values(state.hidden).some(Boolean)) changed.push("hypothesis weights");
      if (state.windowOverride) changed.push("test window");
      if (state.provenancePenalty) changed.push("shared-data weighting");
      if (state.covaryMode !== "diff") changed.push("co-variation test");
      if (state.preset === "custom") changed.push("panel roles (back to the bottom-up preset)");
      if (state.zoomId === "custom") changed.push("view range");
      state.weights = {}; state.hidden = {}; state.windowOverride = null; state.provenancePenalty = false; state.covaryMode = "diff";
      if (state.preset === "custom") { state.preset = "bottomup"; state.roles = Object.assign({}, window.CL_PRESETS[0].roles); }
      if (state.zoomId === "custom") { const z = T.zooms[0]; state.zoom = z.range.slice(); state.zoomId = z.id; state.t = clampT(state.t); }
      if (changed.length) state.flash = `Guided rules restored: ${changed.join(", ")}.`;
      invalidate();
      renderAll();
    } else {
      renderToolbar(); renderGuide(); renderStack(); renderSide();
    }
    if (state.view === "hypotheses") renderHyps();
    setHdrH();
  }));

  let toastT;
  function toast(msg) {
    let el = $("#toast"); if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), 3500);
  }
  if (window.ResizeObserver) new ResizeObserver(() => setHdrH()).observe(document.getElementById("hdr"));
  function setHdrH() { document.documentElement.style.setProperty("--hdrh", $("#hdr").offsetHeight + "px"); }

  function renderAll() { renderToolbar(); renderGuide(); renderStack(); renderHeat(); renderSide(); renderTempo(); setHdrH(); }

  let rT = null, lastW = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rT);
    rT = setTimeout(() => { setHdrH(); const w = $("#stack").clientWidth; if (state.view === "timeline" && Math.abs(w - lastW) > 4) { lastW = w; renderStack(); renderHeat(); } }, 150);
  });

  // Open the explorer with roles and a view set from a Stage 2 idea.
  function openForRelation(causes, effects, iv, label) {
    state.mode = "full";
    $$("[data-mode]").forEach(x => x.setAttribute("aria-pressed", x.dataset.mode === state.mode));
    state.roles = Object.assign({}, window.CL_PRESETS[0].roles);
    causes.forEach(id => { state.roles[id] = "given"; });
    effects.forEach(id => { state.roles[id] = "outcome"; });
    state.preset = "custom";
    if (effects.includes("richness")) state.variants.richness = iv && iv.id === "gobe" ? "deng2021" : "fan2020";
    if (iv) { state.zoom = [Math.min(640, iv.range[0] + 10), Math.max(440, iv.range[1] - 10)]; state.zoomId = "custom"; state.t = Math.round((iv.range[0] + iv.range[1]) / 2); }
    state.flash = `Opened from Stage 2 (${label}): ${causes.map(id => E.panelsById[id].short).join(", ")} set as Given, ${effects.map(id => E.panelsById[id].short).join(", ")} as Outcome. Full mode is on, so you can change roles, curves and resolution.`;
    LOG("from2", { causes, effects, interval: iv && iv.id });
    invalidate(); renderAll(); setView("timeline");
  }
  window.CL_APP = { state, setView, setZoom, applyPreset, setT, setRes, renderAll, invalidate, openForRelation, refresh() { setHdrH(); if (state.view === "timeline") { renderStack(); renderHeat(); renderSide(); renderTempo(); } else setView(state.view); } };

  renderAll();
  lastW = $("#stack").clientWidth;
  window.__CL_STATE = state;
})();
