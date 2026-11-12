// EvoEarth session log.
// The log is kept in memory while the page is open. Nothing is stored or sent elsewhere.
// The students hand in a readable PDF summary. The full log is embedded in the PDF
// (compressed and base64 encoded in the document metadata), so that the Teacher page (#teacher)
// can read many PDFs at once and quantify the outcomes. Older "locked" .evoearth files can still be opened.
(function () {
  const VERSION = "0.5";
  const now = () => new Date().toISOString();
  const rid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

  let handedIn = false;

  function blank() {
    return { session: { id: rid(), group: "", members: "", course: "Geobiology, IGN / Globe Institute, University of Copenhagen", started: now(), app: "EvoEarth " + VERSION }, events: [] };
  }
  let data = blank();
  window.addEventListener("beforeunload", e => { if (!handedIn && data.events.filter(x => x.type !== "visit").length > 2) { e.preventDefault(); e.returnValue = ""; } });

  const listeners = [];
  function save() { handedIn = false; }
  function add(stage, type, payload) {
    const ev = { t: now(), stage, type, data: payload || {} };
    data.events.push(ev); save(); listeners.forEach(f => { try { f(ev); } catch (e) { /* ignore */ } });
    return ev;
  }
  function reset() { data = blank(); save(); }

  // ---------- summary (shared by Stage 4 and the Teacher page) ----------
  function summarise(d) {
    d = d || data;
    const ev = d.events;
    const by = (st, ty) => ev.filter(e => e.stage === st && (!ty || e.type === ty));
    const checks1 = by(1, "check");
    const s1 = {
      checks: checks1.map(e => ({ t: e.t, placed: e.data.placed, correct: e.data.correct, total: e.data.total, misplaced: e.data.misplaced || [] })),
      moves: by(1, "move").length,
      custom: ev.filter(e => e.type === "custom").map(e => e.data.label),
      insights: by(1, "insight").map(e => e.data.text),
      feedback: by(1, "feedback").map(e => e.data.text)
    };
    const miss = {}; checks1.forEach(e => (e.data.misplaced || []).forEach(m => { miss[m.label] = (miss[m.label] || 0) + 1; }));
    s1.oftenMisplaced = Object.entries(miss).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const trials = by(2, "check");
    const opinions = by(2, "opinion");
    const s2 = {
      trials: trials.map(e => ({ t: e.t, id: e.data.trial, causes: e.data.causes, effects: e.data.effects, verdict: e.data.verdict, level: e.data.level, opinion: (opinions.filter(o => o.data.trial === e.data.trial).pop() || {}).data })),
      insights: by(2, "insight").map(e => e.data.text),
      feedback: by(2, "feedback").map(e => e.data.text),
      toStage3: by(2, "open3").length
    };
    const s3ev = ev.filter(e => e.stage === 3);
    const kinds = {}; s3ev.forEach(e => { kinds[e.type] = (kinds[e.type] || 0) + 1; });
    const s3 = {
      actions: s3ev.length, kinds,
      presets: [...new Set(s3ev.filter(e => e.type === "preset").map(e => e.data.name || e.data.id))],
      resolutions: [...new Set(s3ev.filter(e => e.type === "resolution").map(e => e.data.res == null ? "native" : e.data.res + " Myr"))],
      curves: [...new Set(s3ev.filter(e => e.type === "curve").map(e => e.data.name))],
      ages: s3ev.filter(e => e.type === "bar").map(e => e.data.t),
      insights: by(3, "insight").map(e => e.data.text),
      feedback: by(3, "feedback").map(e => e.data.text)
    };
    const sv = by(4, "survey").pop();
    const s4 = { reflections: by(4, "reflection").map(e => e.data.text), feedback: by(4, "feedback").map(e => e.data.text), survey: sv ? sv.data : null };
    const visits = ev.filter(e => e.type === "visit").map(e => e.stage);
    const first = ev.length ? ev[0].t : d.session.started, last = ev.length ? ev[ev.length - 1].t : d.session.started;
    const minutes = Math.max(0, Math.round((new Date(last) - new Date(first)) / 60000));
    const lastC = s1.checks[s1.checks.length - 1];
    const inCE = a => a <= 545 && a >= 505, inGB = a => a <= 490 && a >= 450;
    const evid = {
      o1: !!(lastC && lastC.placed >= 10 && lastC.correct / lastC.placed >= 0.8),
      o2: s2.trials.length >= 2 && trials.some(e => e.data.interval === "both"),
      o3: by(2, "quality").length > 0 || s3.curves.length > 0 || s3.resolutions.length > 0,
      o4: opinions.some(o => (o.data.text || "").trim().length >= 15),
      o5: s3.presets.length > 0 && s3.ages.some(inCE) && s3.ages.some(inGB),
      o6: s4.reflections.some(x => x.trim().length >= 30)
    };
    return { session: d.session, minutes, visits, s1, s2, s3, s4, evid, nEvents: ev.length, handedIn: ev.some(e => e.type === "submit"), raw: d };
  }

  // A short readable account of how the session developed.
  function narrative(S) {
    const out = [];
    const c = S.s1.checks;
    if (c.length) {
      const a = c[0], b = c[c.length - 1];
      out.push(c.length === 1 ? `Stage 1: you checked your sorting once and had ${a.correct} of ${a.placed} cards in the right camp.` : `Stage 1: you checked your sorting ${c.length} times. The first time ${a.correct} of ${a.placed} cards were in the right camp, the last time ${b.correct} of ${b.placed}.`);
      if (S.s1.oftenMisplaced.length) out.push(`Cards that moved most often: ${S.s1.oftenMisplaced.map(x => x[0]).join(", ")}.`);
    } else out.push("Stage 1: no sorting check was recorded.");
    const t = S.s2.trials;
    if (t.length) {
      out.push(`Stage 2: you tested ${t.length} cause and effect ${t.length === 1 ? "idea" : "ideas"}.`);
      const firstT = t[0], lastT = t[t.length - 1];
      out.push(`You started with ${firstT.causes.join(" + ")} → ${firstT.effects.join(" + ")} (${firstT.verdict.toLowerCase().replace("evoearth","EvoEarth")})${t.length > 1 ? ` and ended with ${lastT.causes.join(" + ")} → ${lastT.effects.join(" + ")} (${lastT.verdict.toLowerCase().replace("evoearth","EvoEarth")})` : ""}.`);
      const multi = t.filter(x => x.causes.length + x.effects.length > 2).length;
      if (multi) out.push(`${multi} of your ideas combined more than one cause or effect.`);
    } else out.push("Stage 2: no cause and effect idea was tested.");
    if (S.s3.actions) out.push(`Stage 3: you made ${S.s3.actions} changes in the explorer${S.s3.resolutions.length ? `, tried resolution ${S.s3.resolutions.join(", ")}` : ""}${S.s3.presets.length ? ` and the role settings ${S.s3.presets.join(", ")}` : ""}.`);
    else out.push("Stage 3: the explorer was not used yet.");
    return out;
  }

  // ---------- locking ----------
  const b64 = buf => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function teacherLogin(user, pw) {
    const L = window.EV_TEACHER_LOGIN; if (!L) throw new Error("no login data");
    const u = String(user || "").trim().toUpperCase();
    if (!L.users.includes(u)) throw new Error("unknown user");
    const subtle = window.crypto.subtle;
    const base = await subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    const k = await subtle.deriveKey({ name: "PBKDF2", salt: unb64(L.salt), iterations: L.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const pt = await subtle.decrypt({ name: "AES-GCM", iv: unb64(L.iv) }, k, unb64(L.data));
    return { user: u, key: JSON.parse(new TextDecoder().decode(pt)) };
  }
  function cryptoOK() { return !!(window.crypto && window.crypto.subtle && window.EV_TEACHER_KEY); }
  async function lock(obj) {
    const subtle = window.crypto.subtle;
    const pub = await subtle.importKey("jwk", window.EV_TEACHER_KEY.publicKey, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
    const aes = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
    const raw = await subtle.exportKey("raw", aes);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(JSON.stringify(obj)));
    const wk = await subtle.encrypt({ name: "RSA-OAEP" }, pub, raw);
    return { format: "evoearth-locked-v1", kid: window.EV_TEACHER_KEY.kid, alg: "RSA-OAEP-256 + AES-GCM-256", created: now(), group: obj.session.group, key: b64(wk), iv: b64(iv), data: b64(ct) };
  }
  async function unlock(file, privJwk) {
    const subtle = window.crypto.subtle;
    const pri = await subtle.importKey("jwk", privJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
    const raw = await subtle.decrypt({ name: "RSA-OAEP" }, pri, unb64(file.key));
    const aes = await subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
    const pt = await subtle.decrypt({ name: "AES-GCM", iv: unb64(file.iv) }, aes, unb64(file.data));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  // ---------- data embedded in the student PDF ----------
  const TAG = "EVOEARTH-DATA-v1";
  async function packData(src) {
    src = src || data;
    const json = JSON.stringify({ format: "evoearth-data-v1", session: src.session, events: src.events });
    const bytes = new TextEncoder().encode(json);
    if (window.CompressionStream) {
      try { const buf = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer(); return `${TAG}-gz:${b64(buf)}:END`; } catch (e) { /* fall through */ }
    }
    return `${TAG}-raw:${b64(bytes)}:END`;
  }
  async function readPDF(buf) {
    const u = new Uint8Array(buf); let txt = "";
    for (let i = 0; i < u.length; i += 0x8000) txt += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    const all = [...txt.matchAll(/EVOEARTH-DATA-v1-(gz|raw):([A-Za-z0-9+\/=]+):END/g)];
    if (!all.length) throw new Error("no EvoEarth data in this PDF");
    const m = all[all.length - 1];
    let bytes = unb64(m[2]);
    if (m[1] === "gz") {
      if (!window.DecompressionStream) throw new Error("this browser cannot read compressed data");
      bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
    }
    const d = JSON.parse(new TextDecoder().decode(bytes));
    if (!d || !d.session || !Array.isArray(d.events)) throw new Error("the EvoEarth data in this PDF are damaged");
    return d;
  }

  window.EV_LOG = {
    VERSION,
    get data() { return data; },
    get stored() { return false; },
    markHandedIn() { handedIn = true; },
    teacherLogin,
    add, reset, save, summarise, narrative, lock, unlock, cryptoOK, packData, readPDF,
    setSession(fields) { Object.assign(data.session, fields); save(); },
    on(f) { listeners.push(f); }
  };
})();
