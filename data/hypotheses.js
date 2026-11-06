// Hypotheses and their testable predictions.
//
// Prediction kinds (decide which roles are needed):
//   condition: an environmental state or change that should be present. Needs the panel set as Given.
//   pattern:   a biological or outcome pattern that should be seen. Needs the panel set as Outcome.
//   link:      a driver should change with or before an outcome. Needs driver Given and outcome Outcome.
//
// Test types:
//   state      normalised value vs. threshold (dir +1 above, -1 below)
//   trend      slope over window (dir +1 rising, -1 falling)
//   lead       driver changes in the window before t, outcome changes after t
//   covary     correlation of first differences over window (dir +1 same, -1 opposite)
//   volatility residual variability over window above threshold
//   trait      a trait row is present (level near 1) at t
//   event      a listed event ended within the lookback window before t
//
// spec: specificity 1 (weak, many hypotheses predict it) to 3 (distinctive).

window.CL_HYPS = [
  {
    id: "H1", name: "Oxygen threshold", family: "Bottom-up environment",
    summary: "Animals with large, active, predatory bodies needed atmospheric and oceanic O2 above a threshold. A rise in O2 opened the way for the radiation.",
    refs: ["canfield2007", "sperling2013", "chen2015", "stockey2024"],
    preds: [
      { id: "H1a", kind: "condition", test: "state", panel: "o2", dir: 1, thr: 0.3, scale: 0.12, spec: 2, text: "Atmospheric O2 at or above about 0.3 PAL" },
      { id: "H1b", kind: "condition", test: "state", panel: "globalredox", dir: -1, thr: 0.5, scale: 0.15, spec: 2, text: "Seafloor anoxia is limited (index below 0.5)" },
      { id: "H1c", kind: "link", test: "lead", a: "o2", adir: 1, b: "richness", bdir: 1, window: 10, spec: 3, text: "O2 rises before diversity rises" },
      { id: "H1d", kind: "condition", test: "state", panel: "localredox", dir: 1, thr: 0.45, scale: 0.12, spec: 1, text: "Animal habitats are reasonably well oxygenated" },
      { id: "H1e", kind: "pattern", test: "trait", panel: "traits_pred", row: "predation", spec: 1, text: "Predators (high O2 demand) are present" }
    ]
  },
  {
    id: "H2", name: "Redox instability and oxygen pulses", family: "Bottom-up environment",
    summary: "Repeated oxygenation and anoxia pulses drove bursts of origination and extinction, rather than one permanent step.",
    refs: ["wei2018", "he2019", "dahl2019", "wood2015", "wood2019", "alexander2025"],
    preds: [
      { id: "H2a", kind: "condition", test: "volatility", panel: "globalredox", thr: 0.035, scale: 0.03, window: 6, spec: 2, text: "Global redox is volatile around this time" },
      { id: "H2b", kind: "link", test: "covary", a: "globalredox", b: "richness", dir: -1, window: 8, spec: 3, text: "Less anoxia goes with more diversity (and vice versa)" },
      { id: "H2c", kind: "condition", test: "volatility", panel: "localredox", thr: 0.03, scale: 0.03, window: 6, spec: 1, text: "Local benthic redox is dynamic" },
      { id: "H2d", kind: "pattern", test: "volatility", panel: "richness", thr: 0.02, scale: 0.02, window: 6, spec: 1, text: "Diversity changes in pulses" }
    ]
  },
  {
    id: "H3", name: "Benthic diel oxygen stress", family: "Bottom-up environment",
    summary: "Warm, productive and flooded shelf seas with low background oxygen had large day-night O2 swings. Tolerating these swings selected for refined oxygen sensing and stem-cell control (Hammarlund et al. 2025).",
    refs: ["hammarlund2025", "hammarlund2018", "bowyer2024"],
    preds: [
      { id: "H3a", kind: "condition", test: "state", panel: "dfi", dir: 1, thr: 0.5, scale: 0.15, spec: 3, text: "Diel O2 stress index is high" },
      { id: "H3b", kind: "condition", test: "trend", panel: "sealevel", dir: 1, window: 5, scale: 0.12, spec: 1, text: "Sea level is rising (shelves flooding)" },
      { id: "H3c", kind: "condition", test: "state", panel: "temp", dir: 1, thr: 0.6, scale: 0.15, spec: 1, text: "Climate is warm" },
      { id: "H3d", kind: "condition", test: "state", panel: "localredox", dir: -1, thr: 0.45, scale: 0.12, spec: 2, text: "Background benthic O2 is low to intermediate" },
      { id: "H3e", kind: "link", test: "covary", a: "dfi", b: "richness", dir: 1, window: 10, spec: 2, text: "Diel stress and diversity change together" }
    ]
  },
  {
    id: "H4", name: "Nutrients and food supply", family: "Bottom-up environment",
    summary: "More nutrients from weathering and phosphogenesis raised primary productivity and food supply, which allowed larger and more diverse animal communities.",
    refs: ["stockey2024", "petersgaines2012", "reinhard2017", "servais2009"],
    preds: [
      { id: "H4a", kind: "condition", test: "trend", panel: "nutrients", dir: 1, window: 6, scale: 0.12, spec: 2, text: "Nutrient or productivity proxy is rising" },
      { id: "H4b", kind: "link", test: "lead", a: "nutrients", adir: 1, b: "richness", bdir: 1, window: 8, spec: 3, text: "Productivity rises before diversity" },
      { id: "H4c", kind: "pattern", test: "trait", panel: "traits_eco", row: "plankton", spec: 1, text: "Plankton-based food webs are present" },
      { id: "H4d", kind: "condition", test: "state", panel: "nutrients", dir: 1, thr: 0.5, scale: 0.15, spec: 1, text: "Productivity is high" }
    ]
  },
  {
    id: "H5", name: "Predation, eyes and armour (arms race)", family: "Biotic interactions",
    summary: "Predation and vision started an escalation between predators and prey, which drove skeletonisation, burrowing and diversification.",
    refs: ["nilsson2013", "zhangshu2021", "bambach2007", "zhuravlevwood2018"],
    preds: [
      { id: "H5a", kind: "pattern", test: "trait", panel: "traits_pred", row: "predation", spec: 1, text: "Predation evidence is present" },
      { id: "H5b", kind: "pattern", test: "trait", panel: "traits_pred", row: "eyes", spec: 2, text: "Image-forming eyes are present" },
      { id: "H5c", kind: "pattern", test: "trend", panel: "skeletal", dir: 1, window: 5, scale: 0.12, spec: 2, text: "Skeletons diversify rapidly" },
      { id: "H5d", kind: "pattern", test: "trait", panel: "traits_pred", row: "armour", spec: 1, text: "Defensive skeletons are present" },
      { id: "H5e", kind: "link", test: "lead", a: "traits_pred", arow: "predation", adir: 1, b: "skeletal", bdir: 1, window: 8, spec: 3, text: "Predation appears before the skeletal rise" }
    ]
  },
  {
    id: "H6", name: "Ecosystem engineering", family: "Biotic interactions",
    summary: "Burrowing and filter feeding changed sediments and water chemistry (the agronomic revolution), which created new niches and fed back on nutrient and oxygen cycles.",
    refs: ["manganobuatois2014", "buatois2018", "boyle2014", "erwin2011", "gougeon2025"],
    preds: [
      { id: "H6a", kind: "pattern", test: "trend", panel: "ichno", dir: 1, window: 5, scale: 0.12, spec: 1, text: "Trace-fossil diversity or depth is rising" },
      { id: "H6b", kind: "link", test: "lead", a: "ichno", adir: 1, b: "richness", bdir: 1, window: 8, spec: 3, text: "Burrowing rises before body-fossil diversity" },
      { id: "H6c", kind: "pattern", test: "trait", panel: "traits_eco", row: "tiering", spec: 2, text: "Deep infaunal tiering is present" },
      { id: "H6d", kind: "link", test: "covary", a: "ichno", b: "nutrients", dir: -1, window: 10, spec: 2, text: "More burrowing goes with lower productivity proxy (P retention in sediments, Boyle et al. 2014)" }
    ]
  },
  {
    id: "H7", name: "Developmental toolkit and stemness control", family: "Intrinsic biology",
    summary: "Genetic and developmental innovations, such as refined control of cell stemness under oxic conditions, made complex bodies possible. The environment was permissive rather than the trigger.",
    refs: ["hammarlund2018", "erwin2011", "paterson2019"],
    note: "Mainly tested with molecular clocks and comparative genomics, which are not yet in the app. Low coverage is expected.",
    preds: [
      { id: "H7x", kind: "external", test: "external", spec: 3, needs: "molecular clocks and comparative genomics", text: "Gene-regulatory and stemness innovations predate or coincide with the radiation" },
      { id: "H7a", kind: "pattern", test: "state", panel: "richness", variant: "origination", dir: 1, thr: 0.6, scale: 0.15, spec: 1, text: "Origination intensity is high" },
      { id: "H7b", kind: "condition", test: "state", panel: "localredox", dir: 1, thr: 0.35, scale: 0.12, spec: 1, text: "At least intermittently oxic habitats exist" },
      { id: "H7c", kind: "pattern", test: "trend", panel: "richness", dir: 1, window: 5, scale: 0.12, spec: 1, text: "Diversity rises" }
    ]
  },
  {
    id: "H8", name: "Sea level, habitat area and common cause", family: "Bottom-up environment",
    summary: "Transgressions flooded continents, increasing shallow-marine habitat and nutrient delivery. The same flooding also increases the preserved rock record, so part of the signal can be a common cause.",
    refs: ["bowyer2024", "petersgaines2012", "haq2008", "valentine1970"],
    preds: [
      { id: "H8a", kind: "condition", test: "trend", panel: "sealevel", dir: 1, window: 5, scale: 0.12, spec: 1, text: "Sea level is rising" },
      { id: "H8b", kind: "link", test: "covary", a: "sealevel", b: "richness", dir: 1, window: 10, spec: 3, text: "Sea level and diversity change together" },
      { id: "H8c", kind: "condition", test: "trend", panel: "sampling", dir: 1, window: 5, scale: 0.12, spec: 1, text: "Marine rock record is expanding" }
    ]
  },
  {
    id: "H9", name: "Continental fragmentation and provinciality", family: "Bottom-up environment",
    summary: "More separated continents produce more faunal provinces and more total diversity (Valentine and Moores 1970; Zaffos et al. 2017).",
    refs: ["valentine1970", "zaffos2017", "servais2009", "stigall2019"],
    preds: [
      { id: "H9a", kind: "condition", test: "state", panel: "geography", dir: 1, thr: 0.55, scale: 0.15, spec: 1, text: "Continents are fragmented" },
      { id: "H9b", kind: "link", test: "covary", a: "geography", b: "richness", dir: 1, window: 15, spec: 3, text: "Fragmentation and diversity change together" },
      { id: "H9c", kind: "condition", test: "trend", panel: "geography", dir: 1, window: 10, scale: 0.1, spec: 2, text: "Fragmentation is increasing" }
    ]
  },
  {
    id: "H10a", name: "Warming", family: "Climate",
    summary: "Warm climates raise metabolic rates and speciation rates, and post-glacial warming opened habitats.",
    refs: ["hearing2018", "scotese2021", "goldberg2021"],
    preds: [
      { id: "H10a1", kind: "condition", test: "trend", panel: "temp", dir: 1, window: 6, scale: 0.12, spec: 2, text: "Temperature is rising" },
      { id: "H10a2", kind: "condition", test: "state", panel: "temp", dir: 1, thr: 0.6, scale: 0.15, spec: 1, text: "Climate is warm" },
      { id: "H10a3", kind: "link", test: "covary", a: "temp", b: "richness", dir: 1, window: 10, spec: 3, text: "Warming goes with rising diversity" }
    ]
  },
  {
    id: "H10b", name: "Cooling", family: "Climate",
    summary: "Cooling from extreme hothouse conditions brought tropical seas into a range tolerable for more animals and steepened the latitudinal gradient. Proposed for the GOBE (Trotter et al. 2008; Rasmussen et al. 2016).",
    refs: ["trotter2008", "rasmussen2016", "goldberg2021", "rasmussen2019"],
    preds: [
      { id: "H10b1", kind: "condition", test: "trend", panel: "temp", dir: -1, window: 6, scale: 0.12, spec: 2, text: "Temperature is falling" },
      { id: "H10b2", kind: "link", test: "covary", a: "temp", b: "richness", dir: -1, window: 10, spec: 3, text: "Cooling goes with rising diversity" },
      { id: "H10b3", kind: "condition", test: "state", panel: "temp", dir: -1, thr: 0.75, scale: 0.15, spec: 1, text: "Climate is below extreme hothouse" }
    ]
  },
  {
    id: "H11", name: "Post-glacial recovery", family: "Climate",
    summary: "Glaciations (Gaskiers, later Hirnantian) reset ecosystems and were followed by warming, nutrient release and opportunistic radiation.",
    refs: ["hoffman2017", "rasmussen2019"],
    preds: [
      { id: "H11a", kind: "condition", test: "event", panel: "temp", events: ["gaskiers", "hirnantian"], lookback: 15, spec: 2, text: "A glaciation ended in the preceding 15 Myr" },
      { id: "H11b", kind: "pattern", test: "trend", panel: "richness", dir: 1, window: 5, scale: 0.12, spec: 1, text: "Diversity rises" },
      { id: "H11c", kind: "condition", test: "trend", panel: "temp", dir: 1, window: 6, scale: 0.12, spec: 1, text: "Warming follows the glaciation" }
    ]
  },
  {
    id: "H12", name: "Seawater chemistry and biomineralisation", family: "Bottom-up environment",
    summary: "Changes in seawater Ca and Mg/Ca made it easier, or more necessary, to build carbonate skeletons, which then enabled new body plans and defences.",
    refs: ["brennan2004", "porter2007", "cartwright2024", "petersgaines2012"],
    preds: [
      { id: "H12a", kind: "condition", test: "trend", panel: "chem", dir: -1, window: 8, scale: 0.12, spec: 2, text: "Mg/Ca is falling (Ca rising)" },
      { id: "H12b", kind: "link", test: "lead", a: "chem", adir: -1, b: "skeletal", bdir: 1, window: 8, spec: 3, text: "Seawater change comes before skeletal diversification" },
      { id: "H12c", kind: "pattern", test: "trend", panel: "skeletal", dir: 1, window: 5, scale: 0.12, spec: 1, text: "Skeletal taxa are rising" }
    ]
  },
  {
    id: "H13", name: "Preservation and sampling artefact (null)", family: "Null model",
    summary: "The apparent radiation partly reflects more preserved rock, more Lagerstätten and the onset of easily preserved skeletons, rather than real change in the rate of diversification.",
    refs: ["bowyer2024", "petersgaines2012", "macrostrat", "pbdb"],
    preds: [
      { id: "H13a", kind: "condition", test: "trend", panel: "sampling", dir: 1, window: 5, scale: 0.12, spec: 2, text: "Rock record is expanding" },
      { id: "H13b", kind: "link", test: "covary", a: "sampling", b: "richness", dir: 1, window: 10, spec: 3, text: "Rock record and diversity change together" },
      { id: "H13c", kind: "link", test: "covary", a: "sampling", b: "skeletal", dir: 1, window: 10, spec: 2, text: "Rock record and skeletal taxa change together" }
    ]
  }
];

// Role presets.
window.CL_PRESETS = [
  { id: "bottomup", name: "Environment given, biology outcome", desc: "Physical and chemical panels are the givens. Fossil panels are the outcomes to explain. This tests bottom-up hypotheses.",
    roles: { d13c: "given", richness: "outcome", skeletal: "outcome", ichno: "outcome", ediacara: "outcome", traits_pred: "outcome", traits_eco: "outcome", sampling: "given", sealevel: "given", geography: "given", temp: "given", nutrients: "given", chem: "given", localredox: "given", globalredox: "given", co2: "given", o2: "given", dfi: "given" } },
  { id: "biotic", name: "Biotic interactions", desc: "Early traits (predation, burrowing) are treated as givens, and later diversity is the outcome. This lets the biotic links be tested.",
    roles: { d13c: "given", richness: "outcome", skeletal: "outcome", ichno: "given", ediacara: "outcome", traits_pred: "given", traits_eco: "outcome", sampling: "given", sealevel: "given", geography: "given", temp: "given", nutrients: "outcome", chem: "given", localredox: "given", globalredox: "given", co2: "given", o2: "given", dfi: "given" } },
  { id: "feedback", name: "Feedback (biology given)", desc: "Biology is given and the environment is the outcome. Use this to ask whether animals changed the oceans (for example bioturbation and nutrients).",
    roles: { d13c: "outcome", richness: "given", skeletal: "given", ichno: "given", ediacara: "given", traits_pred: "given", traits_eco: "given", sampling: "given", sealevel: "given", geography: "given", temp: "given", nutrients: "outcome", chem: "given", localredox: "outcome", globalredox: "outcome", co2: "outcome", o2: "outcome", dfi: "off" } },
  { id: "tiera", name: "Best-constrained data only", desc: "Like the bottom-up preset, but panels whose default tier is C or D are switched off. Shows what can be said with the firmest data alone.",
    roles: { d13c: "given", richness: "outcome", skeletal: "outcome", ichno: "outcome", ediacara: "outcome", traits_pred: "outcome", traits_eco: "outcome", sampling: "given", sealevel: "given", geography: "given", temp: "off", nutrients: "given", chem: "off", localredox: "given", globalredox: "off", co2: "off", o2: "off", dfi: "off" } }
];

// Guided steps for students.
window.CL_GUIDE = [
  { title: "1. Read the timeline", body: "Each row is one parameter, from the best constrained at the top to the least constrained at the bottom. The coloured letter on the right is the confidence tier (A strongest, D weakest). Click the source line under a panel to see the data behind it.", action: { label: "Show 640 to 440 Ma", zoom: "all" } },
  { title: "2. Move the bar", body: "Drag the red bar, or click anywhere on a plot. The values at the bar appear on the right of each panel, and the hypothesis ranking updates. Try the White Sea–Nama turnover at 550 Ma.", action: { label: "Go to 550 Ma", t: 550, zoom: "ce" } },
  { title: "3. Decide what is given", body: "Every panel is either a Given (something you accept as the setting), an Outcome (something to explain), or Off. The default treats the environment as given and biology as the outcome. Each hypothesis can only be tested where its predictions match these roles.", action: { label: "Use bottom-up preset", preset: "bottomup" } },
  { title: "4. Ask the hypotheses", body: "Move to 521 Ma (start of Cambrian Stage 3). Each hypothesis card shows which predictions are supported (green), contradicted (red) or untestable (grey), and how much of the hypothesis could be tested (coverage).", action: { label: "Go to 521 Ma", t: 521, zoom: "ce" } },
  { title: "5. Compare two radiations", body: "Practical 3 asks: What fuelled the Cambrian explosion and the GOBE, and were the drivers the same? Pin the bar at 521 Ma, then move to 465 Ma (Darriwilian) and compare.", action: { label: "Pin 521, go to 465", pin: 521, t: 465, zoom: "all" } },
  { title: "6. Grade the parameters", body: "The importance chart shows how much the ranking changes if one panel is removed. A parameter that moves many scores is doing a lot of the work. Then switch a temperature or oxygen curve and see which conclusions survive.", action: { label: "Open the importance chart", focus: "importance" } }
];

window.CL_QUESTIONS = [
  "Which causal drivers are more likely, in your opinion, for the Cambrian explosion?",
  "Did the same drivers operate during the GOBE, or are there differences?",
  "Which conclusions change when you switch the temperature curve or the oxygen curve?",
  "Which hypotheses cannot be tested with the current data, and what data would be needed?",
  "How much of the diversity rise could be explained by sampling alone (H13)?"
];
