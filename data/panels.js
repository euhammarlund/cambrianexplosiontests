// Parameter panels, ordered from more to less constrained (default tiers).
// All curves are SIMPLIFIED, SCHEMATIC digitisations meant for teaching and for
// testing the logic of the app. Each control point is [ageMa, value, low, high]
// on the version 0.1 age scale. The engine restages them to the ICS 2026/06 chart at load time
// (see timescale.js). They must be checked against the cited data, step by step.
//
// tempo: how fast the process itself operates. slow = first order, tens of Myr;
// intermediate = about 1 to 10 Myr; fast = can change within 1 Myr or less;
// response = a biological record that can respond at any rate.
//
// tiers: list of {from, to, tier} in Ma (older -> younger). Tier weights A=1, B=0.75, C=0.5, D=0.3.
// norm: [low, high] maps a value to a 0-1 scale used by the hypothesis tests.
// log: true means interpolation and normalisation are done on log10 values.

window.CL_PANELS = [
  {
    id: "framework", name: "Chronostratigraphy and events", short: "Time frame", group: "Framework",
    kind: "framework", dataType: "Stratigraphy", scale: "Global", defaultRole: "off", testable: false,
    tiers: [{ from: 640, to: 551, tier: "B" }, { from: 551, to: 529, tier: "B" }, { from: 529, to: 440, tier: "A" }],
    tierReason: "Radiometric ages are tight in the Ordovician and later Cambrian. Ediacaran and Fortunian ages depend on δ13C correlation and the chosen age model.",
    description: "Periods, stages, major events and Lagerstätten. Age model choice shifts data between 551 and 529 Ma.",
    refs: ["ics2026", "gts2020", "bowyer2022", "myrow2024", "evans2022", "zhuravlevwood2018", "rasmussenlecture"],
    variants: [{ id: "ics", name: "ICS 2026/06 chart", unit: "", points: [] }]
  },
  {
    id: "d13c", name: "Carbonate carbon isotopes (δ13C)", short: "δ13C", group: "Chemical",
    kind: "curve", dataType: "Proxy", scale: "Global composite", tempo: { cls: "fast", note: "Excursions last about 0.1 to 3 Myr; the background trend changes over tens of Myr." }, defaultRole: "given",
    tiers: [{ from: 640, to: 551, tier: "B" }, { from: 551, to: 529, tier: "B" }, { from: 529, to: 440, tier: "A" }],
    tierReason: "Many sections and a long research history. The Ediacaran composite is partly built by correlation, so it is not fully independent of the age model.",
    description: "The backbone used to correlate sections. Large negative excursions (Shuram, BACE) and positive excursions (SPICE, Hirnantian) mark carbon-cycle perturbations.",
    caveat: "Used to build the Ediacaran and Terreneuvian age models, so testing δ13C against age-dependent patterns is partly circular.",
    refs: ["bowyer2022", "maloof2010", "saltzman2011", "gts2020"],
    variants: [{
      id: "composite", name: "Global δ13C composite (schematic)", unit: "‰ VPDB", norm: [-10, 6], status: "schematic", refs: ["bowyer2022", "gts2020"],
      points: [[640, -2, -4, 0], [630, 2, 0, 4], [610, 5, 3, 7], [590, 4, 2, 6], [580, 2, 0, 4], [574, -6, -9, -4], [570, -10, -12, -7], [567, -3, -5, 0], [560, 2, 0, 4], [552, 3, 1, 5], [548, 4, 2, 6], [542, 1, -1, 3], [539, -6, -8, -3], [537, -2, -4, 0], [533, 2, 0, 4], [530, -1, -3, 1], [526, 3, 1, 5], [524, 4, 2, 6], [521, 0, -2, 2], [519, 2, 0, 3.5], [516, -1, -2.5, 0.5], [513, -2, -3.5, -0.5], [509, -1, -2, 0.5], [504, 0, -1, 1], [500, -0.5, -1.5, 0.5], [496, 4, 3, 5], [493, 0.5, -0.5, 1.5], [487, -1, -2, 0], [480, -0.5, -1.5, 0.5], [470, 0, -1, 1], [465, 1.5, 0.5, 2.5], [460, 0.5, -0.5, 1.5], [453, 1.5, 0.5, 2.5], [448, 0.5, -0.5, 1.5], [445, 5, 3.5, 6.5], [443.8, 1, 0, 2], [440, 0.5, -0.5, 1.5]]
    }]
  },
  {
    id: "richness", name: "Marine animal diversity", short: "Diversity", group: "Biological",
    kind: "curve", dataType: "Observation", scale: "Global", tempo: { cls: "response", note: "Diversity can change within a few hundred kyr (extinctions) or over tens of Myr (accumulation)." }, defaultRole: "outcome",
    tiers: [{ from: 640, to: 541, tier: "C" }, { from: 541, to: 487, tier: "B" }, { from: 487, to: 440, tier: "A" }],
    tierReason: "Ordovician genus richness is estimated with sampling-standardised capture-recapture methods. Cambrian and Ediacaran counts are raw or partly standardised compilations.",
    description: "Richness through time. Four curves are now based on real data, digitised from published high-resolution analyses (Fan et al. 2020; Deng et al. 2021, 2023; Zhang et al. 2021). These are mainly Chinese sections, so they are regional. The global genus curve, origination and life expectancy are still schematic. Rasmussen et al. 2019 describe a cascading trend of radiations that is paused by the Late Ordovician extinctions.",
    caveat: "Raw counts follow rock volume and Lagerstätten. Compare with the sampling panel before trusting a rise.",
    refs: ["fan2020", "deng2021", "deng2023", "zhangsh2021", "rasmussen2019", "kroger2019", "na2015", "zhangshu2021", "paterson2019", "pbdb"],
    variants: [
      { id: "fan2020", name: "Species richness, China, CONOP (Fan et al. 2020, digitised Fig. 1A)", unit: "species", norm: [0, 550], status: "digitised", dataRes: 0.5, srcRes: "about 26 kyr in the published CONOP composite; digitised here at 0.5 Myr", scale: "Mainly Chinese sections (Geobiodiversity Database)", refs: ["fan2020"],
        tiers: [{ from: 540, to: 487, tier: "B" }, { from: 487, to: 439, tier: "A" }],
        note: "Real data: species richness from 11,000 species in about 3,000 sections, ordered by CONOP. The early Cambrian part rests on fewer sections.",
        points: window.CL_DIG.fan2020 },
      { id: "deng2021", name: "Species richness, South China, CONOP (Deng et al. 2021, digitised Fig. 4)", unit: "species", norm: [0, 400], status: "digitised", dataRes: 0.25, srcRes: "about 21 kyr in the published analysis; digitised here at 0.25 Myr", scale: "Regional (South China)", refs: ["deng2021"],
        tiers: [{ from: 510, to: 487, tier: "B" }, { from: 487, to: 431, tier: "A" }],
        note: "Real data, regional. Shows the GOBE as a stepwise rise from the Floian with a peak in the Darriwilian, and the two pulses of the Late Ordovician extinction.",
        points: window.CL_DIG.deng2021 },
      { id: "deng2023", name: "Species richness, middle to late Cambrian, South China (Deng et al. 2023, digitised Fig. 2A)", unit: "species", norm: [0, 120], status: "digitised", dataRes: 0.25, srcRes: "about 22 kyr in the published analysis; digitised here at 0.25 Myr", scale: "Regional (South China)", refs: ["deng2023"],
        tiers: [{ from: 505, to: 479, tier: "B" }],
        note: "Real data, regional. No Furongian biodiversity gap: two extinctions (Guzhangian to Paibian, about 45% loss; Jiangshanian, about 55% loss) and a recovery into the early Ordovician. The authors relate richness to redox change.",
        points: window.CL_DIG.deng2023 },
      { id: "zhang2021", name: "Trilobite species, South China (Zhang et al. 2021, digitised Fig. 4A)", unit: "species", norm: [0, 75], status: "digitised", dataRes: 0.5, srcRes: "about 60 kyr in the published composite, smoothed with a 0.3 Myr window; digitised here at 0.25 Myr and treated as 0.5 Myr", scale: "Regional (South China), one clade", refs: ["zhangsh2021"],
        tiers: [{ from: 511, to: 489, tier: "B" }],
        note: "Real data for trilobites only. Peak near 499 Ma and about 50% loss at the end of the Guzhangian.",
        points: window.CL_DIG.zhang2021 },
      { id: "genera", name: "Genus richness, global (schematic compilation)", unit: "genera", norm: [0, 1600], status: "schematic", refs: ["na2015", "zhangshu2021", "rasmussen2019"],
        points: [[575, 25, 15, 40], [560, 35, 20, 55], [550, 30, 15, 45], [545, 20, 10, 30], [539, 25, 15, 40], [533, 70, 40, 100], [529, 120, 80, 160], [524, 250, 180, 320], [518, 430, 330, 520], [514, 360, 280, 440], [512, 300, 230, 380], [508, 370, 290, 450], [500, 400, 320, 480], [494, 420, 340, 500], [487, 460, 380, 540], [478, 650, 550, 760], [470, 850, 730, 970], [465, 1100, 960, 1240], [460, 1300, 1150, 1450], [453, 1500, 1350, 1650], [447, 1550, 1400, 1700], [444, 1000, 850, 1150], [440, 1050, 900, 1200]] },
      { id: "origination", name: "Origination intensity (relative, schematic)", unit: "index", norm: [0, 1], status: "schematic", refs: ["kroger2019", "zhuravlevwood2018"],
        points: [[545, 0.3, 0.1, 0.5], [536, 0.6, 0.4, 0.8], [526, 0.8, 0.6, 1], [519, 1, 0.8, 1], [514, 0.4, 0.2, 0.6], [510, 0.3, 0.15, 0.5], [503, 0.5, 0.3, 0.7], [495, 0.6, 0.4, 0.8], [485, 0.6, 0.45, 0.75], [475, 0.7, 0.55, 0.85], [468, 0.8, 0.65, 0.95], [462, 0.9, 0.75, 1], [456, 0.6, 0.45, 0.75], [450, 0.5, 0.35, 0.65], [445, 0.2, 0.1, 0.35], [440, 0.4, 0.25, 0.55]] },
      { id: "longevity", name: "Genus life expectancy, 90% survival (Kröger et al. 2019, schematic)", unit: "Myr", norm: [0, 15], status: "schematic", refs: ["kroger2019"],
        points: [[520, 3, 2, 4.5], [505, 4, 3, 5.5], [492, 5, 4, 6.5], [482, 8, 6, 10], [472, 11, 9, 13], [460, 12, 10, 14], [448, 10, 8, 12], [443, 8, 6, 10]] }
    ]
  },
  {
    id: "skeletal", name: "Skeletal fossils and biomineralisation", short: "Skeletons", group: "Biological",
    kind: "curve", dataType: "Observation", scale: "Regional to global", tempo: { cls: "response", note: "Skeletal radiations and the Sinsk decline unfold over about 1 to 5 Myr." }, defaultRole: "outcome",
    tiers: [{ from: 640, to: 551, tier: "C" }, { from: 551, to: 510, tier: "B" }, { from: 510, to: 440, tier: "B" }],
    tierReason: "Skeletal fossils preserve well and are well dated on the Siberian Platform. The record is strongly regional before Stage 3.",
    description: "Zhuravlev and Wood (2018) describe two phases: a late Ediacaran to early Fortunian phase of first skeletons, and a Stage 2 to Stage 3 phase of rapid skeletal diversification that ends with the Sinsk event.",
    refs: ["zhuravlevwood2018", "wood2019", "cartwright2024", "porter2007", "maloof2010"],
    variants: [
      { id: "siberia", name: "Skeletal species, Siberian Platform (schematic, after Zhuravlev & Wood 2018)", unit: "species", norm: [0, 260], status: "schematic", refs: ["zhuravlevwood2018"],
        points: [[551, 2, 1, 4], [546, 4, 2, 6], [541, 6, 3, 9], [538.5, 10, 6, 15], [535, 25, 15, 35], [531, 45, 30, 60], [529, 70, 50, 90], [525, 130, 100, 160], [521, 200, 160, 240], [518, 240, 200, 280], [515, 250, 210, 290], [513, 150, 110, 190], [510, 140, 100, 180]] },
      { id: "global", name: "Skeletal genera, global (schematic)", unit: "genera", norm: [0, 1400], status: "schematic", refs: ["zhangshu2021", "rasmussen2019"],
        points: [[551, 3, 1, 6], [541, 10, 5, 15], [535, 50, 30, 70], [529, 110, 80, 140], [521, 260, 200, 320], [515, 320, 260, 380], [512, 250, 190, 310], [505, 300, 240, 360], [495, 350, 280, 420], [487, 400, 330, 470], [475, 650, 550, 750], [465, 1000, 870, 1130], [455, 1300, 1150, 1450], [446, 1350, 1200, 1500], [444, 850, 720, 980], [440, 900, 770, 1030]] }
    ]
  },
  {
    id: "carbprod", name: "Skeletal share of carbonate production", short: "Skeletal carbonate", group: "Biological",
    kind: "curve", dataType: "Observation", scale: "Regional (Laurentia)", tempo: { cls: "response", note: "Measured per stage or formation, so changes are resolved at about 5 to 10 Myr." }, defaultRole: "outcome",
    tiers: [{ from: 520, to: 458, tier: "B" }],
    tierReason: "Point counts of thousands of thin-section points from many Laurentian sections. Real data, but regional and averaged per stage.",
    description: "Percentage of carbonate rock volume made by skeletons. Cambrian to Tremadocian carbonates are skeleton-poor (median about 3 to 5%). Skeletal input rises about four-fold by the Floian to Middle Ordovician (about 15 to 18%). Pruss et al. 2010 (Ibex area, Utah, and a Laurentian compilation) and Pruss and Clemente 2011 (western Newfoundland). Abundance does not rise smoothly with diversity.",
    caveat: "Values are stage-level means read from the papers. Within a stage the line is only drawn between these means; it is not resolved.",
    refs: ["pruss2010", "prussclemente2011", "prussknoll2017"],
    variants: [
      { id: "laurentia", name: "Skeletal % of carbonate, Laurentia (Pruss et al. 2010; Pruss & Clemente 2011)", unit: "% of carbonate", norm: [0, 25], status: "data summary", dataRes: 5, srcRes: "stage-level means (about 5 to 10 Myr per value)", refs: ["pruss2010", "prussclemente2011"],
        points: [[515, 3, 1, 6], [505, 3, 1, 6], [497, 3, 1, 6], [490, 3.5, 1, 7], [484, 4, 1, 8], [475, 17, 10, 24], [469, 16, 10, 23], [462, 15, 9, 22]] }
    ]
  },
  {
    id: "ichno", name: "Trace fossils and bioturbation", short: "Ichnology", group: "Biological",
    kind: "curve", dataType: "Observation", scale: "Global", tempo: { cls: "response", note: "Burrowing depth and diversity increase stepwise over several Myr." }, defaultRole: "outcome",
    tiers: [{ from: 640, to: 560, tier: "C" }, { from: 560, to: 487, tier: "B" }, { from: 487, to: 440, tier: "B" }],
    tierReason: "Trace fossils are abundant and in situ. Global ichnodiversity counts are compiled from many sections, and Ediacaran attributions are debated.",
    description: "Ichnogenera rise by about 433% from the late Ediacaran (about 10 ichnogenera) into the Fortunian, followed by about 40% further increase (Mángano and Buatois 2014). Bioturbation depth and intensity rise later, in Stage 2 to Stage 3 (the agronomic revolution).",
    refs: ["manganobuatois2014", "buatois2018", "buatois2014", "gougeon2025", "boyle2014"],
    variants: [
      { id: "ichnogenera", name: "Ichnogenera (schematic, after Mángano & Buatois 2014)", unit: "ichnogenera", norm: [0, 140], status: "schematic", refs: ["manganobuatois2014", "buatois2018"],
        points: [[565, 4, 2, 6], [555, 7, 4, 10], [545, 10, 7, 13], [539, 14, 10, 18], [533, 35, 25, 45], [529, 53, 43, 63], [521, 74, 62, 86], [512, 80, 68, 92], [500, 85, 72, 98], [487, 95, 80, 110], [475, 110, 95, 125], [465, 130, 112, 148], [452, 140, 120, 160], [444, 130, 110, 150], [440, 132, 112, 152]] },
      { id: "depth", name: "Maximum bioturbation depth (schematic)", unit: "cm", log: true, norm: [-1, 2], status: "schematic", refs: ["manganobuatois2014", "gougeon2025", "boyle2014"],
        points: [[560, 0.3, 0.1, 0.5], [545, 0.5, 0.2, 1], [539, 1, 0.5, 2], [533, 2, 1, 4], [529, 4, 2, 8], [521, 8, 4, 15], [512, 10, 5, 18], [500, 12, 6, 20], [487, 15, 8, 25], [470, 25, 12, 40], [455, 35, 18, 55], [440, 35, 18, 55]] }
    ]
  },
  {
    id: "ediacara", name: "Ediacara-type biota", short: "Ediacara biota", group: "Biological",
    kind: "curve", dataType: "Observation", scale: "Global", tempo: { cls: "response", note: "Assemblage turnovers take about 1 to 10 Myr." }, defaultRole: "outcome",
    tiers: [{ from: 640, to: 576, tier: "C" }, { from: 576, to: 538, tier: "B" }, { from: 538, to: 440, tier: "C" }],
    tierReason: "The genus database is well curated (Evans et al. 2022). Ages of assemblages and the last occurrences are uncertain by a few Myr.",
    description: "Avalon, White Sea and Nama assemblages. Genus richness falls from about 70 genera in the White Sea assemblage to 14 in the Nama assemblage, a loss of about 80% (Evans et al. 2022).",
    refs: ["evans2022", "darroch2018", "wood2015", "bowyer2022"],
    variants: [{
      id: "genera", name: "Ediacara-type genera (schematic, after Evans et al. 2022)", unit: "genera", norm: [0, 70], status: "schematic", refs: ["evans2022"],
      points: [[580, 0, 0, 2], [575, 20, 12, 28], [565, 30, 20, 40], [560, 50, 40, 60], [555, 70, 60, 80], [551, 60, 50, 70], [549, 18, 12, 24], [545, 14, 10, 18], [541, 10, 6, 14], [538.6, 3, 0, 6], [537, 0, 0, 2]]
    }]
  },
  {
    id: "traits_pred", name: "Predation, defence and sensing", short: "Predation and eyes", group: "Biological",
    kind: "traits", dataType: "Observation", scale: "Global", tempo: { cls: "response", note: "First appearances are point events; establishment takes several Myr." }, defaultRole: "outcome",
    tiers: [{ from: 640, to: 529, tier: "C" }, { from: 529, to: 440, tier: "B" }],
    tierReason: "First appearances are minimum ages. Early evidence (borings, spines) is sparse and sometimes debated.",
    description: "Presence of traits through time: 0 = absent, 0.5 = first or rare evidence, 1 = established. Read across rows, not as a curve.",
    refs: ["zhangshu2021", "nilsson2013", "sperling2013", "bambach2007", "servais2010", "eibye2014"],
    rows: [
      { id: "predation", name: "Predation evidence (borings, grasping spines)", steps: [[550, 0.5], [535, 1]], refs: ["zhangshu2021", "bambach2007"] },
      { id: "armour", name: "Mineralised armour and defensive skeletons", steps: [[550, 0.5], [529, 1]], refs: ["zhuravlevwood2018", "cartwright2024"] },
      { id: "eyes", name: "Image-forming eyes", steps: [[521, 0.5], [518, 1]], refs: ["nilsson2013", "zhangshu2021"] },
      { id: "benthicpred", name: "Large benthic and nektobenthic predators", steps: [[521, 0.5], [518, 1]], refs: ["zhangshu2021"] },
      { id: "pelagicpred", name: "Pelagic predators (radiodonts, later cephalopods)", steps: [[518, 0.5], [495, 0.75], [475, 1]], refs: ["zhangshu2021", "servais2010"] },
      { id: "durophagy", name: "Shell-crushing predation", steps: [[515, 0.5], [465, 1]], refs: ["bambach2007"] }
    ]
  },
  {
    id: "traits_eco", name: "Feeding modes, tiering and reefs", short: "Ecospace", group: "Biological",
    kind: "traits", dataType: "Observation", scale: "Global", tempo: { cls: "response", note: "Ecospace filling proceeds over tens of Myr." }, defaultRole: "outcome",
    tiers: [{ from: 640, to: 529, tier: "C" }, { from: 529, to: 440, tier: "B" }],
    tierReason: "Ecological modes are inferred from morphology and traces. Ordovician ecospace is better documented than the Ediacaran.",
    description: "Lecture point: suspension feeders dominate Ordovician benthos, whereas detritus feeders dominate the Cambrian. 0 = absent, 0.5 = first or rare, 1 = established.",
    refs: ["servais2009", "servais2010", "bambach2007", "droserbambach2001", "bambach2002", "prussknoll2017", "manganobuatois2014", "rasmussenlecture"],
    rows: [
      { id: "grazing", name: "Grazing and deposit feeding", steps: [[555, 0.5], [535, 0.8], [525, 1]], refs: ["manganobuatois2014", "darroch2018"] },
      { id: "suspension", name: "Benthic suspension feeding", steps: [[550, 0.3], [529, 0.6], [480, 0.8], [465, 1]], refs: ["manganobuatois2014", "servais2010"] },
      { id: "tiering", name: "Deep infaunal tiering", steps: [[529, 0.5], [515, 0.75], [470, 1]], refs: ["manganobuatois2014", "buatois2018"] },
      { id: "plankton", name: "Zooplankton and plankton-based food webs", steps: [[518, 0.5], [490, 0.75], [478, 1]], refs: ["servais2009", "servais2010"] },
      { id: "phyto", name: "Diverse phytoplankton (acritarchs)", steps: [[600, 0.5], [560, 0.3], [530, 0.5], [500, 0.7], [478, 1]], refs: ["servais2009"] },
      { id: "reefs", name: "Metazoan reefs", steps: [[548, 0.3], [539, 0], [525, 0.8], [513, 0.3], [470, 0.7], [460, 1]], refs: ["wood2019", "zhuravlevwood2018", "stigall2019"] }
    ]
  },
  {
    id: "modes", name: "Modes of life (ecospace use)", short: "Modes of life", group: "Biological",
    kind: "curve", dataType: "Observation", scale: "Global", tempo: { cls: "response", note: "Counted for a few broad intervals only, about 20 to 60 Myr apart." }, defaultRole: "outcome",
    tiers: [{ from: 580, to: 541, tier: "C" }, { from: 541, to: 445, tier: "B" }],
    tierReason: "Counts of occupied modes of life (tiering, motility, feeding) for broad intervals. Real compilation, very coarse in time.",
    description: "Number of modes of life used by animals (Bambach et al. 2007; Bambachian megaguilds, Droser and Bambach 2001). Soft-part faunas: about 4 in the early Ediacaran, 12 in the late Ediacaran, 30 by the early to middle Cambrian. Skeletal faunas: about 2, then 19, then 30 by the Late Ordovician. Bambach et al. 2002 show that the proportions of functional groups set up in the early Paleozoic stayed stable for about 200 Myr.",
    caveat: "Only four time points. The line between them is drawn, not measured.",
    refs: ["bambach2007", "megaguilds", "droserbambach2001", "bambach2002"],
    variants: [
      { id: "soft", name: "Modes of life, soft-part faunas (after Bambach et al. 2007)", unit: "modes", norm: [0, 40], status: "data summary", dataRes: 20, srcRes: "three broad intervals (early Ediacaran, late Ediacaran, early to middle Cambrian)", refs: ["bambach2007", "megaguilds"],
        points: [[575, 4, 2, 6], [550, 12, 9, 15], [510, 30, 26, 34]] },
      { id: "skel", name: "Modes of life, skeletal faunas (after Bambach et al. 2007)", unit: "modes", norm: [0, 40], status: "data summary", dataRes: 20, srcRes: "four broad intervals (early and late Ediacaran, early to middle Cambrian, Late Ordovician)", refs: ["bambach2007", "megaguilds"],
        points: [[575, 0, 0, 1], [550, 2, 0, 4], [510, 19, 15, 23], [450, 30, 26, 34]] }
    ]
  },
  {
    id: "sampling", name: "Preservation and sampling", short: "Sampling", group: "Confounder",
    kind: "curve", dataType: "Observation", scale: "Global", tempo: { cls: "intermediate", note: "Rock volume changes with sequence-scale sea-level cycles, about 1 to 10 Myr." }, defaultRole: "given",
    tiers: [{ from: 640, to: 541, tier: "C" }, { from: 541, to: 440, tier: "B" }],
    tierReason: "Rock area and volume indices are quantitative but uneven between continents. Ediacaran sections are fewer.",
    description: "Marine rock volume (schematic after Bowyer et al. 2024 for 580 to 510 Ma, and Macrostrat-style compilations later). Lagerstätten are shown as ticks. A rise in fossils that follows a rise in rock record may be partly a sampling effect.",
    refs: ["bowyer2024", "macrostrat", "petersgaines2012", "pbdb", "deng2021"],
    variants: [{
      id: "rock", name: "Marine rock record index (schematic)", unit: "index", norm: [0, 1], status: "schematic", refs: ["bowyer2024", "macrostrat"],
      points: [[640, 0.2, 0.1, 0.3], [600, 0.25, 0.15, 0.35], [580, 0.25, 0.15, 0.35], [566, 0.25, 0.15, 0.35], [552, 0.15, 0.08, 0.25], [549, 0.25, 0.15, 0.35], [545, 0.18, 0.1, 0.28], [542, 0.18, 0.1, 0.28], [535, 0.35, 0.25, 0.45], [529, 0.5, 0.4, 0.6], [528, 0.35, 0.25, 0.45], [520, 0.55, 0.45, 0.65], [512, 0.75, 0.65, 0.85], [505, 0.7, 0.6, 0.8], [495, 0.7, 0.6, 0.8], [485, 0.75, 0.65, 0.85], [470, 0.8, 0.7, 0.9], [460, 0.85, 0.75, 0.95], [450, 0.85, 0.75, 0.95], [445, 0.6, 0.5, 0.7], [440, 0.65, 0.55, 0.75]]
    }, { id: "deng2021samp", name: "Fossil sample count, South China (Deng et al. 2021, digitised Fig. 4)", unit: "samples", norm: [0, 4000], status: "digitised", dataRes: 0.5, srcRes: "digitised at 0.5 Myr from the published sample-size curve", scale: "Regional (South China)", refs: ["deng2021"], tiers: [{ from: 510, to: 431, tier: "A" }],
      note: "How many fossil samples back the South China richness curve. Compare with Deng et al. 2021 richness to judge sampling effects.",
      points: window.CL_DIG.deng2021samp }]
  },
  {
    id: "sealevel", name: "Sea level and flooded shelf area", short: "Sea level", group: "Physical",
    kind: "curve", dataType: "Observation", scale: "Global (eustatic estimate)", tempo: { cls: "intermediate", note: "Second-order cycles last about 1 to 10 Myr; the first-order rise lasts tens of Myr." }, defaultRole: "given",
    tiers: [{ from: 640, to: 541, tier: "C" }, { from: 541, to: 440, tier: "B" }],
    tierReason: "Paleozoic eustasy is reconstructed from sequence stratigraphy (Haq and Schutter 2008). Ediacaran transgressions are identified regionally (Bowyer et al. 2024) without reliable amplitudes.",
    description: "Relative eustatic sea level. Bowyer et al. (2024) identify transgressions at about 574, 550.5, 534 to 533, 528 and 514 Ma. The lecture notes a Cambrian rise of more than 200 m, an Ordovician maximum, and a Hirnantian drop.",
    refs: ["bowyer2024", "haq2008", "rasmussenlecture", "petersgaines2012", "valentine1970"],
    variants: [{
      id: "eustatic", name: "Relative sea level (schematic)", unit: "m vs. present", norm: [-50, 220], status: "schematic", refs: ["bowyer2024", "haq2008"],
      points: [[640, 0, -50, 50], [600, 10, -40, 60], [580, -10, -60, 40], [574, 30, -20, 80], [565, 0, -50, 50], [552, -20, -70, 30], [550.5, 30, -20, 80], [545, 15, -35, 65], [540, -10, -60, 40], [536, -10, -50, 30], [533.5, 30, -10, 70], [530, 25, -15, 65], [528, 55, 15, 95], [521, 60, 20, 100], [514, 95, 55, 135], [508, 100, 60, 140], [500, 120, 80, 160], [495, 110, 70, 150], [488, 140, 100, 180], [478, 160, 120, 200], [468, 180, 140, 220], [458, 220, 180, 260], [452, 200, 160, 240], [445.5, 160, 120, 200], [444.5, 60, 20, 100], [443, 120, 80, 160], [440, 140, 100, 180]]
    }]
  },
  {
    id: "geography", name: "Paleogeography and continental fragmentation", short: "Fragmentation", group: "Physical",
    kind: "curve", dataType: "Model", scale: "Global", tempo: { cls: "slow", note: "Plate configuration is a first-order control that changes over tens of Myr." }, defaultRole: "given",
    tiers: [{ from: 640, to: 541, tier: "C" }, { from: 541, to: 440, tier: "B" }],
    tierReason: "Plate reconstructions are well constrained for the Ordovician (paleomagnetism and faunal provinces). Ediacaran reconstructions differ strongly between models.",
    description: "A fragmentation index (more separate continents and shelf provinces = higher). Valentine and Moores (1970) and Zaffos et al. (2017) link fragmentation to provinciality and diversity.",
    refs: ["zaffos2017", "valentine1970", "servais2009", "stigall2019"],
    variants: [{
      id: "frag", name: "Continental fragmentation index (schematic)", unit: "index", norm: [0.3, 0.8], status: "schematic", refs: ["zaffos2017", "valentine1970"],
      points: [[640, 0.55, 0.4, 0.7], [600, 0.6, 0.45, 0.75], [570, 0.6, 0.45, 0.75], [550, 0.5, 0.38, 0.62], [530, 0.5, 0.4, 0.6], [510, 0.55, 0.47, 0.63], [490, 0.6, 0.53, 0.67], [478, 0.66, 0.6, 0.72], [470, 0.7, 0.64, 0.76], [458, 0.72, 0.66, 0.78], [445, 0.68, 0.62, 0.74], [440, 0.67, 0.61, 0.73]]
    }]
  },
  {
    id: "temp", name: "Temperature and climate state", short: "Temperature", group: "Physical",
    kind: "curve", dataType: "Proxy and model", scale: "Global or tropical (see variant)", tempo: { cls: "fast", note: "Glaciations and warming steps can happen within 0.1 to 1 Myr; long-term cooling takes tens of Myr." }, defaultRole: "given",
    tiers: [{ from: 640, to: 541, tier: "C" }, { from: 541, to: 487, tier: "C" }, { from: 487, to: 440, tier: "B" }],
    tierReason: "Ordovician conodont and clumped isotope data give good relative trends. Cambrian absolute temperatures differ by more than 20 °C between geological and isotopic estimates. The Ediacaran has almost no quantitative temperature proxies.",
    description: "Choose between curves. They are not on the same scale (global average vs. tropical sea surface), so tests use each curve's own normalised range. Trends are more robust than absolute values.",
    caveat: "Scotese et al. 2021 report Cambrian GAT of about 25 °C from geological evidence, whereas oxygen isotopes would imply implausibly hot oceans. Treat absolute values with care.",
    refs: ["scotese2021", "trotter2008", "goldberg2021", "judd2024", "hearing2018", "hoffman2017", "rasmussen2016"],
    variants: [
      { id: "climate", name: "Climate state index, 640 to 440 Ma (qualitative compilation)", unit: "index (0 cold, 1 hot)", norm: [0, 1], status: "schematic", tiers: [{ from: 640, to: 541, tier: "D" }, { from: 541, to: 440, tier: "C" }], refs: ["hoffman2017", "scotese2021", "hearing2018", "goldberg2021", "trotter2008"],
        points: [[640, 0.3, 0.1, 0.5], [632, 0.55, 0.35, 0.75], [610, 0.5, 0.3, 0.7], [585, 0.45, 0.25, 0.65], [580, 0.2, 0.05, 0.4], [578, 0.45, 0.25, 0.65], [560, 0.55, 0.35, 0.75], [545, 0.6, 0.4, 0.8], [535, 0.7, 0.5, 0.85], [520, 0.85, 0.7, 0.95], [510, 0.85, 0.7, 0.95], [500, 0.8, 0.65, 0.95], [490, 0.88, 0.75, 1], [482, 0.9, 0.78, 1], [472, 0.75, 0.62, 0.88], [466, 0.6, 0.48, 0.72], [458, 0.55, 0.43, 0.67], [450, 0.5, 0.38, 0.62], [445, 0.15, 0.05, 0.3], [443, 0.4, 0.25, 0.55], [440, 0.5, 0.35, 0.65]] },
      { id: "scotese", name: "Global average temperature (Scotese et al. 2021, schematic)", unit: "°C", norm: [12, 26], status: "schematic", tiers: [{ from: 541, to: 440, tier: "C" }], refs: ["scotese2021"],
        points: [[540, 21, 18, 24], [530, 23, 20, 26], [520, 24.5, 21, 28], [510, 24.5, 21, 28], [500, 23.5, 20, 27], [490, 23.5, 20, 27], [485, 23, 20, 26], [475, 21.5, 19, 24], [467, 20, 18, 22], [458, 18.5, 16.5, 20.5], [450, 18, 16, 20], [445, 13, 11, 15], [443, 16, 14, 18], [440, 17, 15, 19]] },
      { id: "trotter", name: "Tropical sea surface, conodont δ18O (Trotter et al. 2008, schematic)", unit: "°C", norm: [22, 42], status: "schematic", tiers: [{ from: 487, to: 443, tier: "B" }], refs: ["trotter2008"],
        points: [[486, 40, 37, 43], [480, 38, 35, 41], [474, 34, 31, 37], [468, 28.5, 26, 31], [462, 27.5, 25, 30], [456, 26.5, 24, 29], [450, 25.5, 23, 28], [446, 25, 22.5, 27.5], [444.5, 23, 20.5, 25.5], [443.5, 25, 22.5, 27.5]] },
      { id: "goldberg", name: "Tropical trend, bulk carbonate δ18O (Goldberg et al. 2021, schematic)", unit: "°C (approximate)", norm: [24, 38], status: "schematic", tiers: [{ from: 500, to: 455, tier: "B" }], refs: ["goldberg2021"],
        points: [[500, 32, 29, 35], [494, 34, 31, 37], [488, 36, 33, 39], [482, 37, 34, 40], [476, 35, 32, 38], [471, 31, 28, 34], [467, 28.5, 26, 31], [461, 27.5, 25, 30], [455, 27, 24.5, 29.5]] },
      { id: "phanda", name: "Global mean surface temperature (PhanDA, Judd et al. 2024, schematic)", unit: "°C", norm: [18, 32], status: "schematic", tiers: [{ from: 485, to: 440, tier: "B" }], refs: ["judd2024"],
        points: [[485, 30, 27, 33], [475, 28.5, 25.5, 31.5], [467, 26.5, 23.5, 29.5], [458, 24.5, 21.5, 27.5], [450, 23.5, 20.5, 26.5], [445, 19.5, 16.5, 22.5], [443, 21.5, 18.5, 24.5], [440, 22.5, 19.5, 25.5]] }
    ],
    markers: [{ age: 511.5, label: "Hearing et al. 2018: 20–25 °C SST at 65–70°S", ref: "hearing2018" }]
  },
  {
    id: "nutrients", name: "Nutrients, weathering and productivity", short: "Nutrients", group: "Chemical",
    kind: "curve", dataType: "Proxy", scale: "Global", tempo: { cls: "intermediate", note: "TOC and phosphorite pulses span about 1 to 5 Myr; seawater 87Sr/86Sr integrates over Myr." }, defaultRole: "given",
    tiers: [{ from: 640, to: 541, tier: "C" }, { from: 541, to: 440, tier: "B" }],
    tierReason: "Sr isotopes are a robust global record of weathering. TOC and phosphorite compilations are productivity proxies with preservation and facies biases.",
    description: "Stockey et al. (2024) find that shale TOC rises across the Ediacaran–Cambrian transition, by about 70% (deconvolved) or about 130% (bootstrap), consistent with higher productivity. Phosphorite deposition peaks around 528 to 527 Ma.",
    caveat: "The TOC compilation is the same dataset used for the redox statistics of Stockey et al. (2024). Using both as independent evidence double counts.",
    refs: ["stockey2024", "mcarthur2020", "reinhard2017", "petersgaines2012", "bowyer2024"],
    variants: [
      { id: "toc", name: "Shale TOC, relative to Ediacaran mean (Stockey et al. 2024, schematic)", unit: "× Ediacaran mean", norm: [0.9, 2.0], status: "schematic", refs: ["stockey2024"],
        points: [[640, 1, 0.8, 1.2], [600, 1, 0.8, 1.2], [560, 1, 0.8, 1.2], [548, 1.1, 0.9, 1.3], [538, 1.35, 1.1, 1.6], [528, 1.6, 1.3, 1.95], [520, 1.7, 1.4, 2.1], [505, 1.7, 1.4, 2.1], [487, 1.7, 1.4, 2.1], [470, 1.75, 1.45, 2.1], [458, 1.9, 1.55, 2.25], [440, 1.9, 1.55, 2.25]] },
      { id: "sr", name: "Seawater 87Sr/86Sr (GTS2020 curve, schematic)", unit: "ratio", norm: [0.7072, 0.7092], status: "schematic", refs: ["mcarthur2020", "gts2020"],
        points: [[640, 0.7072, 0.7070, 0.7074], [610, 0.7078, 0.7076, 0.7080], [580, 0.7082, 0.7080, 0.7084], [560, 0.7085, 0.7083, 0.7087], [545, 0.7085, 0.7083, 0.7087], [535, 0.7085, 0.7083, 0.7087], [520, 0.7088, 0.7086, 0.7090], [510, 0.7090, 0.7088, 0.7092], [500, 0.70915, 0.70905, 0.70925], [490, 0.7090, 0.7089, 0.7091], [480, 0.7088, 0.7087, 0.7089], [470, 0.7086, 0.7085, 0.7087], [460, 0.7081, 0.7080, 0.7082], [450, 0.7079, 0.7078, 0.7080], [440, 0.7079, 0.7078, 0.7080]] },
      { id: "phos", name: "Phosphorite deposition index (schematic)", unit: "index", norm: [0, 1], status: "schematic", refs: ["bowyer2024", "reinhard2017"],
        points: [[640, 0.4, 0.2, 0.6], [610, 0.7, 0.5, 0.9], [590, 0.6, 0.4, 0.8], [570, 0.3, 0.15, 0.45], [550, 0.2, 0.1, 0.35], [540, 0.3, 0.15, 0.45], [534, 0.6, 0.4, 0.8], [528, 1, 0.8, 1], [520, 0.7, 0.5, 0.9], [510, 0.4, 0.25, 0.55], [495, 0.3, 0.15, 0.45], [480, 0.3, 0.15, 0.45], [465, 0.5, 0.3, 0.7], [450, 0.3, 0.15, 0.45], [440, 0.3, 0.15, 0.45]] }
    ]
  },
  {
    id: "chem", name: "Seawater chemistry (Mg/Ca, Ca)", short: "Seawater Mg/Ca", group: "Chemical",
    kind: "curve", dataType: "Proxy", scale: "Global", tempo: { cls: "slow", note: "Seawater Mg/Ca and Ca change over tens of Myr (residence times and tectonic forcing)." }, defaultRole: "given",
    tiers: [{ from: 640, to: 545, tier: "D" }, { from: 545, to: 440, tier: "C" }],
    tierReason: "Fluid inclusions in halite give few, widely spaced data points. Aragonite versus calcite sea states are inferred partly from skeletal and ooid mineralogy.",
    description: "Aragonite seas (high Mg/Ca) in the late Ediacaran shift to calcite seas (lower Mg/Ca) during the early Cambrian. Brennan et al. (2004) report a rise in seawater Ca that coincides with the advent of biocalcification.",
    refs: ["porter2007", "brennan2004", "cartwright2024", "petersgaines2012"],
    variants: [
      { id: "mgca", name: "Seawater Mg/Ca molar ratio (schematic)", unit: "mol/mol", norm: [1, 4], status: "schematic", refs: ["porter2007", "brennan2004"],
        points: [[640, 4, 3, 5], [560, 3.5, 2.7, 4.3], [545, 3, 2.3, 3.7], [535, 2.6, 2, 3.2], [525, 2.2, 1.6, 2.8], [518, 1.7, 1.2, 2.2], [510, 1.4, 1, 1.8], [500, 1.2, 0.9, 1.5], [480, 1.1, 0.8, 1.4], [460, 1.1, 0.8, 1.4], [440, 1.3, 1, 1.6]] },
      { id: "ca", name: "Seawater Ca concentration (schematic)", unit: "mmol/kg", norm: [8, 30], status: "schematic", refs: ["brennan2004"],
        points: [[548, 11, 7, 15], [540, 13, 9, 17], [530, 18, 13, 23], [520, 24, 18, 30], [512, 27, 21, 33], [500, 28, 22, 34], [480, 27, 21, 33], [460, 26, 20, 32], [440, 25, 19, 31]] }
    ]
  },
  {
    id: "localredox", name: "Benthic oxygenation at animal sites", short: "Local redox", group: "Chemical",
    kind: "curve", dataType: "Proxy (site-based)", scale: "Local to regional", tempo: { cls: "fast", note: "Local redox can change within kyr; site records sample short windows." }, defaultRole: "given",
    tiers: [{ from: 640, to: 560, tier: "C" }, { from: 560, to: 487, tier: "B" }, { from: 487, to: 440, tier: "C" }],
    tierReason: "Iron speciation and trace metals measured in the same beds as the fossils. Each record describes one basin, so a global summary is uncertain.",
    description: "Summary index of oxygen availability where animals actually lived (0 anoxic, 1 well oxygenated). Site records: dynamic, intermittently oxic Nama shelf; transient local oxygenation across the BACE in SW Laurentia; mainly dysoxic waters on the Siberian Platform 527 to 519 Ma; oxic benthos next to an oxygen-minimum-zone-like water column at Chengjiang; very low oxygen at Sirius Passet; sulfidic shelves during the Hirnantian.",
    refs: ["wood2015", "chanchai2025", "alexander2025", "hammarlund2017", "hammarlund2019", "hammarlund2012", "hammarlund2025"],
    variants: [{
      id: "summary", name: "Benthic oxygenation index (schematic summary of site records)", unit: "index", norm: [0, 1], status: "schematic", refs: ["wood2015", "alexander2025", "hammarlund2017", "hammarlund2019", "chanchai2025", "hammarlund2012"],
      points: [[640, 0.2, 0.05, 0.4], [600, 0.25, 0.1, 0.45], [580, 0.3, 0.15, 0.5], [560, 0.35, 0.2, 0.55], [550, 0.4, 0.2, 0.6], [545, 0.4, 0.2, 0.6], [539.5, 0.3, 0.15, 0.5], [538.5, 0.4, 0.2, 0.6], [535, 0.35, 0.2, 0.5], [527, 0.33, 0.2, 0.45], [519, 0.38, 0.25, 0.5], [518, 0.4, 0.2, 0.6], [513, 0.25, 0.1, 0.4], [508, 0.4, 0.25, 0.55], [497, 0.35, 0.2, 0.5], [490, 0.45, 0.3, 0.6], [470, 0.55, 0.4, 0.7], [455, 0.6, 0.45, 0.75], [445, 0.35, 0.2, 0.5], [443, 0.45, 0.3, 0.6], [440, 0.5, 0.35, 0.65]]
    }],
    sites: [
      { name: "Nama, Namibia", from: 550, to: 539, lo: 0.2, hi: 0.6, ref: "wood2015", note: "Dynamic redox, animals in intermittently oxic shelf settings" },
      { name: "SW Laurentia (BACE)", from: 539.5, to: 538, lo: 0.25, hi: 0.55, ref: "chanchai2025", note: "Transient local oxygenation across the BACE" },
      { name: "Siberian Platform", from: 527, to: 519, lo: 0.2, hi: 0.45, ref: "alexander2025", note: "Primarily dysoxic, dynamic; motile skeletal benthos with low O2 demand" },
      { name: "Chengjiang", from: 519, to: 517, lo: 0.3, hi: 0.6, ref: "hammarlund2017", note: "Oxic benthic spells next to OMZ-like waters" },
      { name: "Sirius Passet", from: 519, to: 517, lo: 0.05, hi: 0.3, ref: "hammarlund2019", note: "Very low O2, about 0.2 to 0.4 ml/L" },
      { name: "Hirnantian shelves", from: 445.5, to: 444, lo: 0.05, hi: 0.35, ref: "hammarlund2012", note: "Sulfidic conditions on shelves" }
    ]
  },
  {
    id: "globalredox", name: "Global seafloor anoxia", short: "Global anoxia", group: "Chemical",
    kind: "curve", dataType: "Proxy and model", scale: "Global", tempo: { cls: "fast", note: "Anoxic pulses last about 0.1 to 2 Myr." }, defaultRole: "given",
    tiers: [{ from: 640, to: 487, tier: "C" }, { from: 487, to: 440, tier: "C" }],
    tierReason: "Global estimates come from mass-balance models on δ238U or statistics on trace-metal compilations. Different methods disagree on the timing and size of oxygenation.",
    description: "Index of the extent of anoxic seafloor (0 small, 1 large). Variants: a δ238U-based view with terminal Ediacaran anoxia and early Cambrian oxygenation pulses; the Stockey et al. (2024) view of no wholesale deep-ocean oxygenation; and the classic Neoproterozoic Oxygenation Event step.",
    caveat: "Higher value = MORE anoxia. Hypothesis tests account for the direction.",
    refs: ["stockey2024", "tostevin2019", "wei2018", "dahl2019", "he2019", "canfield2007", "canfield2008", "chen2015", "sperling2015"],
    variants: [
      { id: "uranium", name: "δ238U-based anoxia with pulses (Tostevin 2019, Wei 2018, Dahl 2019, He 2019; schematic)", unit: "index", norm: [0, 1], status: "schematic", refs: ["tostevin2019", "wei2018", "dahl2019", "he2019"],
        points: [[640, 0.5, 0.3, 0.7], [600, 0.4, 0.2, 0.6], [575, 0.3, 0.15, 0.5], [560, 0.4, 0.2, 0.6], [550, 0.5, 0.3, 0.7], [545, 0.6, 0.4, 0.8], [540, 0.7, 0.5, 0.85], [538, 0.6, 0.4, 0.8], [535, 0.45, 0.3, 0.6], [530, 0.55, 0.4, 0.7], [524, 0.35, 0.2, 0.5], [521.5, 0.55, 0.4, 0.7], [519, 0.35, 0.2, 0.5], [516, 0.55, 0.4, 0.7], [514, 0.4, 0.25, 0.55], [512, 0.65, 0.5, 0.8], [505, 0.5, 0.35, 0.65], [496, 0.6, 0.45, 0.75], [490, 0.5, 0.35, 0.65], [470, 0.45, 0.3, 0.6], [455, 0.45, 0.3, 0.6], [445, 0.6, 0.45, 0.75], [443, 0.5, 0.35, 0.65], [440, 0.45, 0.3, 0.6]] },
      { id: "stockey", name: "Trace-metal statistics: no wholesale oxygenation (Stockey et al. 2024, schematic)", unit: "index", norm: [0, 1], status: "schematic", refs: ["stockey2024", "sperling2015"],
        points: [[640, 0.75, 0.55, 0.95], [580, 0.72, 0.52, 0.92], [540, 0.68, 0.48, 0.88], [520, 0.65, 0.45, 0.85], [500, 0.62, 0.42, 0.82], [470, 0.58, 0.38, 0.78], [440, 0.58, 0.38, 0.78]] },
      { id: "noe", name: "Classic Neoproterozoic Oxygenation Event step (Canfield 2007, Chen 2015; schematic)", unit: "index", norm: [0, 1], status: "schematic", refs: ["canfield2007", "chen2015"],
        points: [[640, 0.9, 0.75, 1], [600, 0.85, 0.7, 1], [580, 0.6, 0.45, 0.75], [560, 0.5, 0.35, 0.65], [540, 0.35, 0.2, 0.5], [520, 0.25, 0.1, 0.4], [500, 0.25, 0.1, 0.4], [470, 0.2, 0.1, 0.35], [445, 0.3, 0.15, 0.45], [440, 0.25, 0.1, 0.4]] }
    ]
  },
  {
    id: "co2", name: "Atmospheric CO2 and volcanic degassing", short: "CO2", group: "Chemical",
    kind: "curve", dataType: "Model", scale: "Global", tempo: { cls: "slow", note: "Model outputs have time steps of several Myr and smooth fast change." }, defaultRole: "given",
    tiers: [{ from: 640, to: 440, tier: "D" }],
    tierReason: "No direct CO2 proxies before the Devonian. Values come from long-term carbon cycle models, and the arc zircon index is an indirect degassing proxy.",
    description: "Model CO2 curves and the McKenzie et al. (2016) continental arc index (more arc volcanism = more CO2 degassing = greenhouse).",
    refs: ["mills2019", "royer2014", "mckenzie2016", "lenton2018"],
    variants: [
      { id: "mills", name: "CO2, carbon cycle model (Mills et al. 2019, schematic)", unit: "ppm", log: true, norm: [2.8, 3.8], status: "schematic", refs: ["mills2019"],
        points: [[640, 3000, 1000, 8000], [610, 1500, 500, 4000], [580, 1000, 350, 3000], [560, 1500, 500, 4000], [540, 2500, 900, 6000], [520, 3200, 1200, 7000], [500, 3000, 1100, 7000], [480, 2600, 1000, 6000], [460, 2000, 800, 5000], [445, 1200, 500, 3000], [440, 1500, 600, 3500]] },
      { id: "geocarb", name: "CO2, GEOCARBSULF (Royer et al. 2014, schematic)", unit: "ppm", log: true, norm: [3.3, 3.9], status: "schematic", refs: ["royer2014"],
        points: [[570, 4000, 2000, 7000], [540, 5500, 3000, 9000], [520, 6500, 3500, 10000], [500, 5000, 2800, 8500], [480, 4500, 2500, 8000], [460, 4000, 2200, 7000], [445, 3500, 2000, 6000], [440, 3500, 2000, 6000]] },
      { id: "arc", name: "Continental arc index (McKenzie et al. 2016, schematic)", unit: "index", norm: [0, 1], status: "schematic", refs: ["mckenzie2016"],
        points: [[640, 0.3, 0.15, 0.45], [580, 0.35, 0.2, 0.5], [560, 0.45, 0.3, 0.6], [540, 0.6, 0.45, 0.75], [520, 0.7, 0.55, 0.85], [500, 0.75, 0.6, 0.9], [470, 0.7, 0.55, 0.85], [450, 0.6, 0.45, 0.75], [440, 0.55, 0.4, 0.7]] }
    ]
  },
  {
    id: "o2", name: "Atmospheric oxygen", short: "Atmospheric O2", group: "Chemical",
    kind: "curve", dataType: "Model", scale: "Global", tempo: { cls: "slow", note: "Model outputs have time steps of several Myr and smooth fast change." }, defaultRole: "given",
    tiers: [{ from: 640, to: 440, tier: "D" }],
    tierReason: "No direct proxy for atmospheric O2 in this interval. Estimates come from biogeochemical models or statistical inference, and published ranges span close to an order of magnitude.",
    description: "Percent of present atmospheric level (PAL). Stockey et al. (2024) infer a sustained but moderate rise across the Neoproterozoic and Paleozoic rather than one step. Krause et al. (2018) model stepwise Paleozoic oxygenation. The classic view is a Neoproterozoic Oxygenation Event step. Values here are schematic, not digitised.",
    refs: ["stockey2024", "krause2018", "lenton2018", "canfield2007", "edwards2017", "saltzman2011", "sperling2013"],
    variants: [
      { id: "stockey", name: "Sustained moderate rise (after Stockey et al. 2024, schematic)", unit: "PAL", norm: [0, 1], status: "schematic", refs: ["stockey2024"],
        points: [[640, 0.2, 0.05, 0.5], [560, 0.25, 0.08, 0.55], [545, 0.3, 0.1, 0.6], [530, 0.38, 0.15, 0.7], [500, 0.45, 0.2, 0.8], [470, 0.5, 0.25, 0.85], [440, 0.55, 0.3, 0.9]] },
      { id: "krause", name: "Stepwise Paleozoic oxygenation (Krause et al. 2018, schematic)", unit: "PAL", norm: [0, 1], status: "schematic", refs: ["krause2018", "saltzman2011", "edwards2017"],
        points: [[540, 0.35, 0.15, 0.6], [520, 0.3, 0.12, 0.55], [505, 0.33, 0.15, 0.6], [496, 0.45, 0.2, 0.7], [490, 0.4, 0.18, 0.65], [475, 0.45, 0.22, 0.7], [462, 0.55, 0.3, 0.8], [450, 0.6, 0.35, 0.85], [440, 0.6, 0.35, 0.85]] },
      { id: "noe", name: "Classic NOE step (as summarised in Stockey et al. 2024; schematic)", unit: "PAL", norm: [0, 1], status: "schematic", refs: ["canfield2007", "stockey2024"],
        points: [[640, 0.1, 0.02, 0.2], [590, 0.15, 0.05, 0.3], [575, 0.5, 0.3, 0.7], [550, 0.7, 0.5, 0.9], [535, 0.85, 0.65, 1], [500, 0.9, 0.7, 1], [440, 0.9, 0.7, 1]] }
    ]
  },
  {
    id: "dfi", name: "Benthic diel oxygen fluctuation index (derived)", short: "Diel O2 stress", group: "Derived",
    kind: "derived", dataType: "Calculated index", scale: "Global (shelf)", tempo: { cls: "fast", note: "Diel stress acts within a day; its environmental drivers change over 0.1 to 10 Myr." }, defaultRole: "given",
    tiers: [{ from: 640, to: 440, tier: "D" }],
    tierReason: "Calculated inside the app from the temperature, sea level, productivity (TOC) and local redox panels, following the reasoning of Hammarlund et al. (2025). It inherits all their uncertainties.",
    description: "Hammarlund et al. (2025) argue that warm, productive, flooded shelf seas with low background O2 experience large day-night oxygen swings. Index = warmth × (0.5 + 0.5 × productivity) × (1 − benthic O2) × (0.5 + 0.5 × flooding). It updates when you change the input variants.",
    caveat: "Derived from four other panels. Using it together with them as independent evidence double counts.",
    derivedFrom: ["temp", "sealevel", "nutrients", "localredox"],
    refs: ["hammarlund2025"],
    variants: [{ id: "computed", name: "Computed from the current input selections", unit: "index", norm: [0, 0.5], status: "derived", refs: ["hammarlund2025"], points: [] }]
  }
];

// Pairs of panels that share data or are derived from one another.
window.CL_PROVENANCE = [
  { a: "dfi", b: "temp", why: "The diel index is calculated from temperature." },
  { a: "dfi", b: "sealevel", why: "The diel index is calculated from sea level." },
  { a: "dfi", b: "nutrients", why: "The diel index uses TOC as productivity." },
  { a: "dfi", b: "localredox", why: "The diel index uses benthic oxygenation." },
  { a: "nutrients", b: "globalredox", why: "Stockey et al. 2024 TOC and redox statistics come from the same shale compilation." },
  { a: "o2", b: "globalredox", why: "Atmospheric O2 inferences use the same redox proxy compilations." },
  { a: "o2", b: "d13c", why: "Carbon cycle models infer O2 from δ13C (and δ34S)." },
  { a: "sampling", b: "sealevel", why: "Flooded continents create the preserved marine rock record." }
];
