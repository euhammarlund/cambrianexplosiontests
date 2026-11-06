// Cambrian Ledger evaluation engine. Pure functions, no DOM access.
(function () {
  const TIER_W = { A: 1, B: 0.75, C: 0.5, D: 0.3 };
  const STEP = 0.5; // Myr sampling step

  const panelsById = {};
  window.CL_PANELS.forEach(p => { panelsById[p.id] = p; });

  // ---------- age model ----------
  function remap(age, anchors, inverse) {
    // anchors: [[icsAge, modelAge], ...] sorted old -> young
    const a = anchors.map(x => inverse ? [x[1], x[0]] : x);
    if (age > a[0][0] || age < a[a.length - 1][0]) return age;
    for (let i = 0; i < a.length - 1; i++) {
      const [x0, y0] = a[i], [x1, y1] = a[i + 1];
      if (age <= x0 && age >= x1) {
        if (x0 === x1) return y0;
        return y0 + (age - x0) * (y1 - y0) / (x1 - x0);
      }
    }
    return age;
  }
  function getModel(id) { return window.CL_TIME.ageModels.find(m => m.id === id) || window.CL_TIME.ageModels[0]; }
  function toDisplay(icsAge, modelId) { return remap(icsAge, getModel(modelId).anchors, false); }
  function toICS(displayAge, modelId) { return remap(displayAge, getModel(modelId).anchors, true); }

  function defaultWindow(t) {
    const r = window.CL_TIME.windowRules.find(w => t <= w.from && t > w.to);
    return r ? r.w : 1;
  }

  // ---------- data access ----------
  function variantOf(panel, state, override) {
    const vid = override || state.variants[panel.id];
    return panel.variants.find(v => v.id === vid) || panel.variants[0];
  }
  function tf(v, log) { return log ? Math.log10(Math.max(v, 1e-9)) : v; }

  // Interpolated raw value at ICS age. Returns {v, lo, hi} or null.
  function interp(points, age, log) {
    if (!points || !points.length) return null;
    const oldest = points[0][0], youngest = points[points.length - 1][0];
    if (age > oldest + 1e-9 || age < youngest - 1e-9) return null;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i], p1 = points[i + 1];
      if (age <= p0[0] && age >= p1[0]) {
        const f = p0[0] === p1[0] ? 0 : (p0[0] - age) / (p0[0] - p1[0]);
        const mix = k => {
          const a = tf(p0[k], log), b = tf(p1[k], log);
          const r = a + (b - a) * f;
          return log ? Math.pow(10, r) : r;
        };
        return { v: mix(1), lo: mix(2), hi: mix(3) };
      }
    }
    if (Math.abs(age - youngest) < 1e-9) { const p = points[points.length - 1]; return { v: p[1], lo: p[2], hi: p[3] }; }
    return null;
  }

  function normalise(v, variant) {
    const n = variant.norm || [0, 1];
    const x = tf(v, variant.log);
    return (x - n[0]) / (n[1] - n[0]);
  }

  function traitLevel(row, age) {
    let lvl = 0;
    for (const [a, l] of row.steps) { if (age <= a) lvl = l; }
    return lvl;
  }

  // Derived benthic diel O2 fluctuation index
  function dfiAt(age, state) {
    const tP = panelsById.temp, sP = panelsById.sealevel, nP = panelsById.nutrients, rP = panelsById.localredox;
    let tv = variantOf(tP, state);
    let t = interp(tv.points, age, tv.log);
    if (!t) { tv = tP.variants.find(v => v.id === "climate"); t = interp(tv.points, age); }
    const sv = sP.variants[0], s = interp(sv.points, age);
    const nv = nP.variants.find(v => v.id === "toc"), n = interp(nv.points, age);
    const rv = rP.variants[0], r = interp(rv.points, age);
    if (!t || !s || !n || !r) return null;
    const c = x => Math.max(0, Math.min(1, x));
    const f = (w, p, o, fl) => w * (0.5 + 0.5 * p) * (1 - o) * (0.5 + 0.5 * fl);
    const w = c(normalise(t.v, tv)), p = c(normalise(n.v, nv)), o = c(r.v), fl = c(normalise(s.v, sv));
    const v = f(w, p, o, fl);
    const lo = f(c(normalise(t.lo, tv)), c(normalise(n.lo, nv)), c(r.hi), c(normalise(s.lo, sv)));
    const hi = f(c(normalise(t.hi, tv)), c(normalise(n.hi, nv)), c(r.lo), c(normalise(s.hi, sv)));
    return { v, lo, hi };
  }

  // Value at ICS age for a panel (raw units). For traits, row needed.
  function valueAt(panel, age, state, opts) {
    opts = opts || {};
    if (panel.kind === "traits") {
      const row = panel.rows.find(r => r.id === opts.row) || panel.rows[0];
      const l = traitLevel(row, age);
      return { v: l, lo: l, hi: l, n: l };
    }
    if (panel.kind === "derived") {
      const d = dfiAt(age, state);
      if (!d) return null;
      const variant = panel.variants[0];
      return Object.assign(d, { n: normalise(d.v, variant) });
    }
    const variant = variantOf(panel, state, opts.variant);
    const r = interp(variant.points, age, variant.log);
    if (!r) return null;
    r.n = normalise(r.v, variant);
    return r;
  }

  // Normalised series over [from (older), to (younger)] in display ages.
  function series(panel, tFrom, tTo, state, opts) {
    const out = [];
    for (let t = tFrom; t >= tTo - 1e-9; t -= STEP) {
      const v = valueAt(panel, toICS(t, state.ageModel), state, opts);
      out.push(v ? v.n : null);
    }
    return out;
  }

  function slope(arr) {
    // per 10 Myr, arr ordered old -> young, step STEP
    const pts = arr.map((v, i) => [i * STEP, v]).filter(p => p[1] !== null);
    if (pts.length < 3) return null;
    const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
    let num = 0, den = 0;
    pts.forEach(([x, y]) => { num += (x - mx) * (y - my); den += (x - mx) * (x - mx); });
    return den === 0 ? 0 : (num / den) * 10;
  }
  function coverageOK(arr) { return arr.filter(v => v !== null).length >= Math.max(3, arr.length * 0.6); }
  function diffs(arr) { const d = []; for (let i = 1; i < arr.length; i++) d.push(arr[i] === null || arr[i - 1] === null ? null : arr[i] - arr[i - 1]); return d; }
  function pearson(a, b) {
    const pairs = a.map((x, i) => [x, b[i]]).filter(p => p[0] !== null && p[1] !== null);
    if (pairs.length < 4) return null;
    const n = pairs.length, ma = pairs.reduce((s, p) => s + p[0], 0) / n, mb = pairs.reduce((s, p) => s + p[1], 0) / n;
    let sab = 0, saa = 0, sbb = 0;
    pairs.forEach(([x, y]) => { sab += (x - ma) * (y - mb); saa += (x - ma) ** 2; sbb += (y - mb) ** 2; });
    if (saa < 1e-12 || sbb < 1e-12) return null;
    return sab / Math.sqrt(saa * sbb);
  }
  function residualSD(arr) {
    const pts = arr.map((v, i) => [i, v]).filter(p => p[1] !== null);
    if (pts.length < 4) return null;
    const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
    let num = 0, den = 0;
    pts.forEach(([x, y]) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
    const b = den ? num / den : 0;
    const res = pts.map(([x, y]) => y - (my + b * (x - mx)));
    return Math.sqrt(res.reduce((s, r) => s + r * r, 0) / n);
  }
  const tanh = Math.tanh;

  function tierAt(panel, icsAge, state) {
    const variant = panel.kind === "curve" ? variantOf(panel, state) : null;
    const list = (variant && variant.tiers) || panel.tiers;
    const r = list.find(x => icsAge <= x.from && icsAge >= x.to) || panel.tiers.find(x => icsAge <= x.from && icsAge >= x.to);
    return r ? r.tier : (list[list.length - 1] || {}).tier || "D";
  }

  function roleOf(id, state) { return state.roles[id] || "off"; }

  // Evaluate a single prediction at display time t.
  function evalPred(pred, t, state, ctx) {
    const W = state.windowOverride || defaultWindow(t);
    const res = { id: pred.id, text: pred.text, kind: pred.kind, spec: pred.spec, s: null, status: "untestable", reason: "", panels: [] };
    if (pred.test === "external") { res.reason = `Needs data not yet in the app (${pred.needs})`; return res; }
    const need = [];
    if (pred.kind === "link") { need.push([pred.a, "given"]); need.push([pred.b, "outcome"]); }
    else need.push([pred.panel, pred.kind === "condition" ? "given" : "outcome"]);
    for (const [pid, role] of need) {
      res.panels.push(pid);
      const r = roleOf(pid, state);
      if (r === "off") { res.reason = `${panelsById[pid].short} is switched off`; return res; }
      if (r !== role) { res.reason = `Role conflict: needs ${panelsById[pid].short} as ${role === "given" ? "Given" : "Outcome"}, set as ${r === "given" ? "Given" : "Outcome"}`; return res; }
    }
    const P = id => panelsById[id];
    let s = null, detail = "";
    const win = (w) => Math.max(W, w || 0);
    try {
      if (pred.test === "state") {
        const p = P(pred.panel), w = W;
        const arr = series(p, t + w, t - w, state, { variant: pred.variant, row: pred.row });
        if (!coverageOK(arr)) { res.reason = `No ${p.short} data at this time`; return res; }
        const m = arr.filter(v => v !== null).reduce((a, b) => a + b, 0) / arr.filter(v => v !== null).length;
        s = tanh(pred.dir * (m - pred.thr) / (pred.scale || 0.15));
        detail = `normalised ${m.toFixed(2)} vs threshold ${pred.thr}`;
      } else if (pred.test === "trend") {
        const p = P(pred.panel), w = win(pred.window);
        const arr = series(p, t + w, t - w, state, { variant: pred.variant });
        if (!coverageOK(arr)) { res.reason = `No ${p.short} data around this time`; return res; }
        const sl = slope(arr);
        s = tanh(pred.dir * sl / (pred.scale || 0.12));
        detail = `slope ${sl >= 0 ? "+" : ""}${sl.toFixed(2)} per 10 Myr (normalised)`;
      } else if (pred.test === "lead") {
        const L = win(pred.window);
        const a = series(P(pred.a), t + L, t, state, { row: pred.arow });
        const b = series(P(pred.b), t, t - L, state, { row: pred.brow });
        if (!coverageOK(a) || !coverageOK(b)) { res.reason = `Missing data before or after this time`; return res; }
        const sa = tanh(pred.adir * slope(a) / 0.12), sb = tanh(pred.bdir * slope(b) / 0.12);
        s = Math.min(sa, sb);
        detail = `driver before: ${sa.toFixed(2)}, outcome after: ${sb.toFixed(2)}`;
      } else if (pred.test === "covary") {
        const L = win(pred.window);
        const a = series(P(pred.a), t + L, t - L, state, {});
        const b = series(P(pred.b), t + L, t - L, state, {});
        if (!coverageOK(a) || !coverageOK(b)) { res.reason = `Missing data in the window`; return res; }
        const r = state.covaryMode === "levels" ? pearson(a, b) : pearson(diffs(a), diffs(b));
        if (r === null) { res.reason = `One series is flat in the window`; return res; }
        s = pred.dir * r;
        detail = `r = ${r.toFixed(2)} (${state.covaryMode === "levels" ? "levels" : "first differences"}, ±${L} Myr)`;
      } else if (pred.test === "volatility") {
        const p = P(pred.panel), w = win(pred.window);
        const arr = series(p, t + w, t - w, state, {});
        if (!coverageOK(arr)) { res.reason = `No ${p.short} data around this time`; return res; }
        const sd = residualSD(arr);
        s = tanh((sd - pred.thr) / (pred.scale || 0.03));
        detail = `residual variability ${sd.toFixed(3)} vs ${pred.thr}`;
      } else if (pred.test === "trait") {
        const p = P(pred.panel);
        const l = traitLevel(p.rows.find(r => r.id === pred.row), toICS(t, state.ageModel));
        s = l * 2 - 1;
        detail = `trait level ${l}`;
      } else if (pred.test === "event") {
        const ics = toICS(t, state.ageModel);
        const ev = window.CL_TIME.events.filter(e => pred.events.includes(e.id) && e.to >= ics && e.to <= ics + pred.lookback);
        s = ev.length ? 1 - (ev[0].to - ics) / pred.lookback * 0.5 : -0.6;
        detail = ev.length ? `${ev[0].name} ended ${(ev[0].to - ics).toFixed(1)} Myr earlier` : "no glaciation in the lookback window";
      }
    } catch (e) { res.reason = "Evaluation error"; return res; }
    if (s === null || isNaN(s)) { res.reason = "Not enough data"; return res; }
    res.s = Math.max(-1, Math.min(1, s));
    res.detail = detail;
    res.status = res.s > 0.25 ? "supports" : res.s < -0.25 ? "contradicts" : "neutral";
    // weight
    const ics = toICS(t, state.ageModel);
    const tiers = res.panels.map(pid => tierAt(P(pid), ics, state));
    const tw = Math.min.apply(null, tiers.map(x => TIER_W[x]));
    res.tiers = tiers;
    let w = pred.spec * tw;
    res.weight = w;
    return res;
  }

  function provenanceIssues(results) {
    const used = new Set();
    results.filter(r => r.s !== null).forEach(r => r.panels.forEach(p => used.add(p)));
    return window.CL_PROVENANCE.filter(x => used.has(x.a) && used.has(x.b));
  }

  function evalHyp(h, t, state) {
    const uw = state.weights[h.id] == null ? 1 : state.weights[h.id];
    const results = h.preds.map(p => evalPred(p, t, state));
    const issues = provenanceIssues(results);
    if (state.provenancePenalty && issues.length) {
      const flagged = new Set(); issues.forEach(i => { flagged.add(i.a); flagged.add(i.b); });
      results.forEach(r => { if (r.s !== null && r.panels.some(p => flagged.has(p))) { r.weight *= 0.5; r.penalised = true; } });
    }
    const specAll = h.preds.reduce((s, p) => s + p.spec, 0);
    const tested = results.filter(r => r.s !== null);
    const specTested = tested.reduce((s, r) => s + r.spec, 0);
    const sw = tested.reduce((s, r) => s + r.weight, 0);
    const consistency = sw ? tested.reduce((s, r) => s + r.weight * (r.s + 1) / 2, 0) / sw : null;
    const net = specAll ? uw * tested.reduce((s, r) => s + r.weight * r.s, 0) / specAll : 0;
    const coverage = specTested / specAll;
    let verdict;
    if (coverage < 0.35) verdict = "Mostly untestable with these roles";
    else if (net > 0.25) verdict = "Supported at this time";
    else if (net < -0.25) verdict = "Contradicted at this time";
    else verdict = "Mixed or weak evidence";
    return { id: h.id, h, results, consistency, coverage, net, verdict, issues, nSupport: tested.filter(r => r.status === "supports").length, nContra: tested.filter(r => r.status === "contradicts").length, nUntest: results.length - tested.length };
  }

  function evaluate(t, state) {
    const hyps = window.CL_HYPS.filter(h => !state.hidden || !state.hidden[h.id]);
    const out = hyps.map(h => evalHyp(h, t, state));
    out.sort((a, b) => b.net - a.net);
    return out;
  }

  // Net support over time for heatmap.
  function heatmap(state, range, step) {
    step = step || 1;
    const rows = window.CL_HYPS.map(h => ({ id: h.id, name: h.name, values: [] }));
    const ages = [];
    for (let t = range[0]; t >= range[1]; t -= step) ages.push(t);
    ages.forEach(t => {
      window.CL_HYPS.forEach((h, i) => { rows[i].values.push(evalHyp(h, t, state).net); });
    });
    return { ages, rows };
  }

  // Leave-one-out importance of each active panel at time t.
  function sensitivity(t, state) {
    const base = {};
    window.CL_HYPS.forEach(h => { base[h.id] = evalHyp(h, t, state).net; });
    const out = [];
    window.CL_PANELS.forEach(p => {
      if (p.testable === false) return;
      if (roleOf(p.id, state) === "off") return;
      const s2 = Object.assign({}, state, { roles: Object.assign({}, state.roles, { [p.id]: "off" }) });
      let total = 0, maxH = null, maxD = 0;
      window.CL_HYPS.forEach(h => {
        const d = evalHyp(h, t, s2).net - base[h.id];
        total += Math.abs(d);
        if (Math.abs(d) > Math.abs(maxD)) { maxD = d; maxH = h.id; }
      });
      out.push({ id: p.id, name: p.short, total, maxH, maxD });
    });
    out.sort((a, b) => b.total - a.total);
    return out;
  }

  window.CL_ENGINE = { TIER_W, STEP, panelsById, toDisplay, toICS, defaultWindow, valueAt, variantOf, interp, normalise, traitLevel, tierAt, evalPred, evalHyp, evaluate, heatmap, sensitivity, dfiAt };
})();
