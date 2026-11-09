// Chronostratigraphic framework. Ages in Ma on the ICS International Chronostratigraphic
// Chart v2026/06 (Cohen et al. 2025, updated). Colours follow the ICS chart convention
// (approximate hex values).
//
// Data points in panels.js and the events below were entered in version 0.1 on the older
// boundary ages listed in "restage.from". At load time the engine moves every age so that it
// keeps its position within its stage (piecewise linear between boundaries), which places
// all data on the 2026/06 boundaries in "restage.to".
window.CL_TIME = {
  chart: "ICS 2026/06",
  range: [640, 440],
  restage: {
    from: [720, 635, 538.8, 529, 521, 514.5, 509, 504.5, 500.5, 497, 494.2, 491, 486.85, 477.7, 470, 467.3, 458.4, 453, 445.2, 443.8, 419.2],
    to:   [720, 635, 538.8, 529, 521, 514.5, 506.5, 504.5, 500.5, 497, 494.2, 491, 486.85, 477.1, 471.3, 469.4, 458.2, 452.8, 445.2, 443.1, 419.62]
  },
  periods: [
    { name: "Cryogenian", from: 720, to: 635, color: "#FEBF4E" },
    { name: "Ediacaran", from: 635, to: 538.8, color: "#FED96A" },
    { name: "Cambrian", from: 538.8, to: 486.85, color: "#7FA056" },
    { name: "Ordovician", from: 486.85, to: 443.1, color: "#009270" },
    { name: "Silurian", from: 443.1, to: 419.62, color: "#B3E1B6" }
  ],
  stages: [
    { name: "Ediacaran", short: "Edi", from: 635, to: 538.8, color: "#FED96A" },
    { name: "Fortunian", short: "Fort", from: 538.8, to: 529, color: "#99B575" },
    { name: "Stage 2", short: "S2", from: 529, to: 521, color: "#A6BA80" },
    { name: "Stage 3", short: "S3", from: 521, to: 514.5, color: "#A6C583" },
    { name: "Stage 4", short: "S4", from: 514.5, to: 506.5, color: "#B3CA8E" },
    { name: "Wuliuan", short: "Wu", from: 506.5, to: 504.5, color: "#B3D492" },
    { name: "Drumian", short: "Dr", from: 504.5, to: 500.5, color: "#BFD99D" },
    { name: "Guzhangian", short: "Gu", from: 500.5, to: 497, color: "#CCDFAA" },
    { name: "Paibian", short: "Pa", from: 497, to: 494.2, color: "#CCEBAE" },
    { name: "Jiangshanian", short: "Ji", from: 494.2, to: 491, color: "#D9F0BB" },
    { name: "Stage 10", short: "S10", from: 491, to: 486.85, color: "#E6F5C9" },
    { name: "Tremadocian", short: "Tre", from: 486.85, to: 477.1, color: "#33A97E" },
    { name: "Floian", short: "Flo", from: 477.1, to: 471.3, color: "#41B087" },
    { name: "Dapingian", short: "Dap", from: 471.3, to: 469.4, color: "#66C092" },
    { name: "Darriwilian", short: "Dar", from: 469.4, to: 458.2, color: "#74C69C" },
    { name: "Sandbian", short: "San", from: 458.2, to: 452.8, color: "#8CD094" },
    { name: "Katian", short: "Kat", from: 452.8, to: 445.2, color: "#99D69F" },
    { name: "Hirnantian", short: "Hir", from: 445.2, to: 443.1, color: "#A6DBAB" },
    { name: "Silurian", short: "Sil", from: 443.1, to: 419.62, color: "#B3E1B6" }
  ],
  // Events drawn as bands on the framework panel. Ages approximate, entered on the v0.1 scale
  // and restaged at load time (see above).
  events: [
    { id: "gaskiers", name: "Gaskiers glaciation", from: 580.2, to: 579.6, kind: "climate", refs: ["hoffman2017", "gts2020"], note: "Short-lived regional glaciation, under 1 Myr." },
    { id: "shuram", name: "Shuram excursion", from: 574, to: 567, kind: "carbon", refs: ["bowyer2022"], note: "Largest negative δ13C excursion in Earth history; age model dependent." },
    { id: "avalon", name: "Avalon assemblage", from: 575, to: 560, kind: "bio", refs: ["darroch2018", "evans2022"] },
    { id: "whitesea", name: "White Sea assemblage", from: 560, to: 550, kind: "bio", refs: ["evans2022"] },
    { id: "nama", name: "Nama assemblage", from: 550, to: 539, kind: "bio", refs: ["evans2022", "wood2015"] },
    { id: "wsn", name: "White Sea–Nama turnover", from: 551, to: 549, kind: "extinction", refs: ["evans2022"], note: "First recognised animal extinction; about 80% genus loss in the compiled dataset." },
    { id: "bace", name: "BACE / Kotlin crisis", from: 539.5, to: 538.3, kind: "extinction", refs: ["bowyer2022", "chanchai2025"], note: "Basal Cambrian carbon isotope excursion and last Ediacaran biota." },
    { id: "sinsk", name: "Sinsk event", from: 514, to: 512, kind: "extinction", refs: ["zhuravlevwood2018", "bowyer2024"], note: "Anoxic event and archaeocyath reef decline." },
    { id: "spice", name: "SPICE", from: 497, to: 494, kind: "carbon", refs: ["saltzman2011"], note: "Positive δ13C excursion, Paibian." },
    { id: "gobe", name: "GOBE main pulse", from: 468, to: 458, kind: "bio", refs: ["stigall2019", "rasmussen2016", "rasmussen2019"], note: "Darriwilian acceleration of genus richness." },
    { id: "hirnantian", name: "Hirnantian glaciation / LOME", from: 445.2, to: 443.8, kind: "extinction", refs: ["hammarlund2012", "rasmussen2019", "ics2026"] }
  ],
  // Exceptional preservation sites. Ages approximate (v0.1 scale, restaged at load time).
  lagerstatten: [
    { name: "Mistaken Point", age: 565 },
    { name: "White Sea", age: 555 },
    { name: "Nama", age: 545 },
    { name: "Chengjiang", age: 518 },
    { name: "Sirius Passet", age: 518 },
    { name: "Emu Bay", age: 513 },
    { name: "Burgess Shale", age: 508 },
    { name: "Orsten", age: 497 },
    { name: "Fezouata", age: 478 },
    { name: "Soom Shale", age: 444 }
  ],
  // Age models. Data are stored on the ICS chart. Model "cd" remaps ages between
  // two fixed anchors so that the ICS boundary 538.8 Ma plots at about 535.5 Ma.
  ageModels: [
    { id: "ab", name: "Models A/B (ICS, E–C boundary 538.8 Ma)", anchors: [[551, 551], [538.8, 538.8], [529, 529]], refs: ["bowyer2022", "ics2026"] },
    { id: "cd", name: "Models C/D (younger boundary, about 535.5 Ma, schematic)", anchors: [[551, 551], [538.8, 535.5], [529, 529]], refs: ["bowyer2022", "myrow2024"] }
  ],
  // Default half-width of the evaluation window (Myr), reflecting age uncertainty.
  windowRules: [
    { from: 640, to: 580, w: 3 },
    { from: 580, to: 545, w: 2 },
    { from: 545, to: 525, w: 1.5 },
    { from: 525, to: 487, w: 1 },
    { from: 487, to: 440, w: 0.5 }
  ],
  zooms: [
    { id: "all", name: "Ediacaran to Ordovician", range: [640, 440] },
    { id: "ec", name: "Ediacaran–Cambrian transition", range: [585, 500] },
    { id: "ce", name: "Cambrian explosion", range: [555, 505] },
    { id: "ord", name: "Late Cambrian to Ordovician", range: [500, 440] }
  ]
};
