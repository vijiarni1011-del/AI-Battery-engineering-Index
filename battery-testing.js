/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — BATTERY TESTING TAB  v1.0
   Skeleton: all 12 test categories + project-data auto-pull
   Each category = placeholder ready for deep content modules
   ═══════════════════════════════════════════════════════════════ */

/* ── Test category registry ── */
const BT_CATS = [
  { id:'electrical',    icon:'⚡', label:'Electrical',        color:'#4a9eff', std:'IEC 62660-1/2, ISO 12405-4' },
  { id:'hv_safety',     icon:'🔴', label:'HV Safety',         color:'#ff4d6d', std:'ISO 6469-3, IEC 60664, FMVSS 305' },
  { id:'lv_system',     icon:'🟡', label:'LV System',         color:'#f5c518', std:'ISO 16750-2, LV 124' },
  { id:'bms_function',  icon:'🧠', label:'BMS Function',      color:'#8b5cf6', std:'ISO 26262, IEC 62619' },
  { id:'performance',   icon:'🚀', label:'Performance',       color:'#00d4aa', std:'ISO 12405-4, SAE J1798' },
  { id:'thermal',       icon:'🌡️', label:'Thermal & Cooling', color:'#ff7b35', std:'IEC 62660-3, ISO 12405-3' },
  { id:'mechanical',    icon:'🔩', label:'Mechanical',        color:'#6d8fba', std:'ISO 12405-3, IEC 62133-2' },
  { id:'environmental', icon:'🌍', label:'Environmental',     color:'#00b891', std:'IEC 60068, ISO 16750-4' },
  { id:'lifecycle',     icon:'📈', label:'Life Cycle',        color:'#60a5fa', std:'IEC 62660-1, ISO 12405-4' },
  { id:'abuse',         icon:'💥', label:'Abuse & Safety',    color:'#ef4444', std:'UN 38.3, SAE J2464, GB/T 31485' },
  { id:'emi_emc',       icon:'📡', label:'EMI / EMC',         color:'#a78bfa', std:'CISPR 25, ISO 11452, UNECE R10' },
  { id:'certification', icon:'🏅', label:'Certification',     color:'#fbbf24', std:'UN GTR 20, GB/T, CE, UL 2580' },
];

/* ── Project context pulled from global S ── */
function bt_getCtx() {
  const S = window.S || {};
  return {
    app:     S.app || '—',
    chem:    S.c_chem || '—',
    vnom:    (S.V_nom_pack || S.t_vmax_sys || 400).toFixed(0),
    vmax:    (S.V_max_pack || S.t_vmax_sys || 420).toFixed(0),
    vmin:    (S.V_min_pack || S.t_vmin_sys || 280).toFixed(0),
    egross:  (S.E_gross || 43).toFixed(1),
    ppeak:   (S.t_ppeak || 80).toFixed(0),
    imax:    S.t_imax || (S.t_ppeak*1000/(S.V_nom_pack||400)) || 200,
    sxp:     `${S.S_total||112}S / ${S.c_pp||1}P`,
    top_lo:  S.t_top_lo ?? -20,
    top_hi:  S.t_top_hi ?? 55,
    tcell:   S.t_tcell_max ?? 60,
    ip:      S.t_ip || 'IP67',
    markets: S.markets || '—',
    cycles:  S.t_cycles || 3000,
  };
}

/* ── Render the testing tab ── */
window.renderBatteryTesting = function(catId) {
  const root = document.getElementById('bt_root');
  if (!root) return;

  const ctx = bt_getCtx();
  catId = catId || window._bt_active_cat || 'electrical';
  window._bt_active_cat = catId;
  const cat = BT_CATS.find(c => c.id === catId) || BT_CATS[0];

  /* Sub-nav */
  const subnav = BT_CATS.map(c => `
    <button class="bt-nb ${c.id===catId?'bt-nb-active':''}"
      onclick="renderBatteryTesting('${c.id}')"
      style="${c.id===catId?`border-color:${c.color}40;background:${c.color}12;color:${c.color}`:''}">
      <span style="font-size:14px">${c.icon}</span>
      <span class="bt-nb-label">${c.label}</span>
    </button>`).join('');

  /* Context banner */
  const ctxBanner = `
<div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 20px;background:var(--bg3);border-bottom:1px solid var(--border);align-items:center">
  <span style="font-size:10px;font-family:var(--mono);color:var(--text3);letter-spacing:.1em">PROJECT CONTEXT ↓</span>
  ${[
    ['App', ctx.app],
    ['Chemistry', ctx.chem],
    ['Config', ctx.sxp],
    ['V_nom', ctx.vnom+'V'],
    ['V_max', ctx.vmax+'V'],
    ['E_gross', ctx.egross+'kWh'],
    ['P_peak', ctx.ppeak+'kW'],
    ['T_op', `${ctx.top_lo}→${ctx.top_hi}°C`],
    ['Cycles', ctx.cycles],
    ['Markets', ctx.markets],
  ].map(([k,v])=>`<div style="display:flex;gap:4px;align-items:center;background:var(--bg4);border:1px solid var(--border2);border-radius:5px;padding:3px 8px">
    <span style="font-size:9px;font-family:var(--mono);color:var(--text3)">${k}</span>
    <span style="font-size:11px;font-family:var(--mono);color:var(--teal);font-weight:700">${v}</span>
  </div>`).join('')}
  <button onclick="switchTopTab('engineering',document.getElementById('ttab-engineering'));showSec('targets',document.querySelector('.nb'))"
    style="margin-left:auto;padding:3px 10px;background:rgba(74,158,255,.1);border:1px solid rgba(74,158,255,.3);color:var(--blue2);border-radius:5px;font-size:10px;font-weight:700;cursor:pointer">✏ Edit Targets</button>
</div>`;

  /* Category content dispatcher */
  const content = bt_renderCat(cat, ctx);

  root.innerHTML = `
<style>
.bt-nb{display:flex;align-items:center;gap:6px;padding:6px 13px;border-radius:7px;font-size:12px;font-weight:600;color:var(--text2);background:transparent;border:1px solid transparent;cursor:pointer;transition:all .15s;white-space:nowrap;font-family:var(--sans)}
.bt-nb:hover{background:var(--bg4);color:var(--text);border-color:var(--border)}
.bt-subnav{display:flex;gap:3px;flex-wrap:wrap;padding:10px 16px;background:var(--bg2);border-bottom:1px solid var(--border)}
@media(max-width:700px){.bt-nb-label{display:none}}
.bt-section{padding:20px 20px 32px}
.bt-hero{padding:24px 20px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px;background:var(--bg2)}
.bt-hero-icon{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0}
.bt-std-badge{font-size:10px;font-family:var(--mono);color:var(--text3);padding:3px 8px;background:var(--bg4);border:1px solid var(--border);border-radius:4px;letter-spacing:.04em}
.bt-item-card{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px;transition:border-color .15s}
.bt-item-card:hover{border-color:var(--border2)}
.bt-item-title{font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px}
.bt-item-std{font-size:10px;font-family:var(--mono);color:var(--text3);margin-bottom:8px}
.bt-item-body{font-size:12px;color:var(--text2);line-height:1.6}
.bt-tip{background:rgba(0,212,170,.06);border-left:3px solid var(--teal);border-radius:0 6px 6px 0;padding:8px 12px;font-size:12px;color:var(--text2);margin-top:8px}
.bt-warn{background:rgba(245,197,24,.06);border-left:3px solid var(--y);border-radius:0 6px 6px 0;padding:8px 12px;font-size:12px;color:var(--text2);margin-top:8px}
.bt-calc-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)}
.bt-calc-row:last-child{border:none}
.bt-wip{padding:40px 20px;text-align:center;color:var(--text3);font-size:13px;border:1px dashed var(--border);border-radius:10px;background:var(--bg3)}
</style>

<div class="bt-subnav">${subnav}</div>
${ctxBanner}

<div class="bt-hero">
  <div class="bt-hero-icon" style="background:${cat.color}18;border:1px solid ${cat.color}40">
    ${cat.icon}
  </div>
  <div>
    <h2 style="font-family:var(--display);font-size:18px;font-weight:700;color:var(--text);margin-bottom:4px">${cat.label} Testing</h2>
    <div class="bt-std-badge">${cat.std}</div>
  </div>
</div>

<div class="bt-section">
  ${content}
</div>`;
};

/* ════════════════════════════════════════════════════
   CATEGORY RENDERERS — each returns HTML string
   ════════════════════════════════════════════════════ */
function bt_renderCat(cat, ctx) {
  switch(cat.id) {
    case 'electrical':    return bt_electrical(ctx);
    case 'hv_safety':     return bt_hv_safety(ctx);
    case 'lv_system':     return bt_lv_system(ctx);
    case 'bms_function':  return bt_bms_function(ctx);
    case 'performance':   return bt_performance(ctx);
    case 'thermal':       return bt_thermal(ctx);
    case 'mechanical':    return bt_mechanical(ctx);
    case 'environmental': return bt_environmental(ctx);
    case 'lifecycle':     return bt_lifecycle(ctx);
    case 'abuse':         return bt_abuse(ctx);
    case 'emi_emc':       return bt_emi_emc(ctx);
    case 'certification': return bt_certification(ctx);
    default: return '<div class="bt-wip">Select a category</div>';
  }
}

/* ── Helper: render a test item card ── */
function btCard(icon, title, std, body, tip, warn) {
  return `<div class="bt-item-card">
    <div class="bt-item-title">${icon} ${title}</div>
    <div class="bt-item-std">${std}</div>
    <div class="bt-item-body">${body}</div>
    ${tip  ? `<div class="bt-tip">💡 ${tip}</div>` : ''}
    ${warn ? `<div class="bt-warn">⚠ ${warn}</div>` : ''}
  </div>`;
}

function btCalc(label, formula, result, unit) {
  return `<div class="bt-calc-row">
    <span style="font-size:12px;color:var(--text2);flex:1">${label}</span>
    <span style="font-family:var(--mono);font-size:11px;color:var(--text3);flex:1">${formula}</span>
    <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--teal)">${result} <span style="font-size:10px;color:var(--text3)">${unit}</span></span>
  </div>`;
}

function btSectionHead(title, sub) {
  return `<div style="margin:20px 0 12px"><div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px">${title}</div><div style="font-size:11px;color:var(--text3)">${sub||''}</div></div>`;
}

function btGrid(items) {
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">${items.join('')}</div>`;
}

function btWip(catLabel) {
  return `<div class="bt-wip">
    <div style="font-size:28px;margin-bottom:12px">🔧</div>
    <div style="font-weight:700;color:var(--text2);margin-bottom:6px">${catLabel} — Full content coming next sprint</div>
    <div style="font-size:12px">Calculations, pass/fail criteria, test tips, and charts will be built here.<br>Project context above is already live-linked to your targets.</div>
  </div>`;
}

/* ════════════════════
   ⚡ ELECTRICAL
   ════════════════════ */
function bt_electrical(ctx) {
  const Ipeak   = +ctx.imax;
  const Vmax    = +ctx.vmax;
  const Vmin    = +ctx.vmin;
  const Vnom    = +ctx.vnom;
  const E       = +ctx.egross;
  const capTest = (E * 1000 / Vnom).toFixed(1);  // Ah
  const cRateEq = (Ipeak / (E*1000/Vnom)).toFixed(2);

  return `
${btSectionHead('📐 Calculated Test Parameters','Auto-derived from your project targets')}
<div class="card" style="margin-bottom:16px">
  ${btCalc('Pack capacity (test Ah)',`E_gross × 1000 / V_nom`,capTest,'Ah')}
  ${btCalc('Peak C-rate equivalent',`I_peak / C_pack`,cRateEq,'C')}
  ${btCalc('Test voltage window',`${Vmin}V – ${Vmax}V`,`${(Vmax-Vmin).toFixed(0)}V span`,'V')}
  ${btCalc('Test temp range (op)',`T_lo → T_hi`,`${ctx.top_lo}°C → ${ctx.top_hi}°C`,'°C')}
</div>

${btSectionHead('🧪 Required Electrical Tests','Based on project voltage class and chemistry')}
${btGrid([
  btCard('🔋','Capacity & Energy Measurement',
    'IEC 62660-1:2010 §5 / ISO 12405-4:2018 §8',
    `Discharge at C/3 from ${Vmax}V to ${Vmin}V at 25°C. Measure Ah and Wh. Repeat 3 cycles for stabilisation. Record capacity at 0°C and 45°C.`,
    `Condition cells for min 2h at test temperature before each run. Use calibrated ±0.1% current shunt.`,
    `For ${ctx.chem} chemistry: LFP flat OCV curve means voltage-based SoC estimation unreliable — use Ah counting.`),

  btCard('⚡','High-Rate Discharge (Peak Power)',
    'IEC 62660-2:2011 §6 / SAE J1798',
    `Apply ${Ipeak.toFixed(0)}A (${cRateEq}C) pulse for 10s. Measure V_drop, IR (4-wire), temperature rise. Minimum SoC = 50%. Test at −10°C, 25°C, 45°C.`,
    `Log voltage at 10ms resolution — IR transient settles within 100ms for most ${ctx.chem} cells.`),

  btCard('🔄','Charge Acceptance & CC-CV Profile',
    'IEC 62660-1:2010 §6 / IEC 62619:2022',
    `CC phase to ${Vmax}V at 1C, CV until I < C/20. Measure energy-in / energy-out. Coulombic efficiency target ≥99%.`,
    `For LFP: monitor for lithium plating at T < 5°C — restrict CC current to 0.2C below 5°C.`),

  btCard('📏','Internal Resistance (DCIR) Measurement',
    'IEC 62660-2:2011 §5 / USABC method',
    `10s discharge pulse at 1C from 50% SoC. DCIR = ΔV / ΔI. Test at −20°C, 0°C, 25°C, 45°C, 100%/50%/20% SoC grid.`,
    `Match timing to vehicle BMS interrupt window — some BMS read IR at 2s, not 10s.`),

  btCard('🌡️','Thermal Performance Under Load',
    'IEC 62660-2:2011 §7',
    `Monitor cell surface/case temperature during 1C and ${cRateEq}C discharge. ΔT_max < ${ctx.tcell - (+ctx.top_hi)}°C above ambient. Record TMS coolant ΔT.`,
    `Place thermocouple at geometrically central cell and hottest predicted cell location.`),

  btCard('🔁','Self-Discharge',
    'IEC 62660-1:2010 §8',
    `Charge to 100% SoC, rest 30 days at 25°C, measure remaining capacity. Self-discharge < 3% per month for NMC/LFP.`,
    `Seal pack and log cell voltages via BMS during storage. Flag outliers > 2× average as leakage suspects.`),
])}

<div class="ico-banner" style="margin-top:16px">
  📌 Standards shown for voltage class ${Vmax}V pack · ${ctx.chem} chemistry · ${ctx.app} application.
  Standards auto-adapt when you update Project Targets.
</div>`;
}

/* ════════════════════
   🔴 HV SAFETY
   ════════════════════ */
function bt_hv_safety(ctx) {
  const Vmax = +ctx.vmax;
  const voltClass = Vmax > 60 ? (Vmax > 1000 ? 'Class C (>1000V)' : 'Class B (60–1000V)') : 'Class A (<60V)';

  return `
${btSectionHead('🔴 Voltage Class','Auto-determined from your pack Vmax')}
<div class="card" style="margin-bottom:16px;border-color:rgba(255,77,109,.25)">
  ${btCalc('Pack V_max',`From Cell Inputs`,Vmax,'V')}
  ${btCalc('IEC voltage class','ISO 6469-1',voltClass,'')}
  ${btCalc('Creepage/clearance basis','IEC 60664-1',`${Vmax > 300 ? 'Group I' : 'Group II'} material`,'—')}
</div>

${btSectionHead('🧪 Required HV Safety Tests')}
${btGrid([
  btCard('⚠️','Isolation Resistance',
    'ISO 6469-3:2021 §6.4 / FMVSS 305',
    `Minimum 100 Ω/V (${(Vmax*100/1000).toFixed(0)} kΩ for ${Vmax}V pack). Measure with 500V DC insulation tester between all HV conductors and chassis. Test before and after vibration, water ingress.`,
    `Use calibrated ISO meter not standard multimeter. Log before / after each abuse test.`,
    `If isolation < 500 Ω/V flag as CRITICAL — vehicle poses electrocution risk.`),

  btCard('🔌','Dielectric Voltage Withstand',
    'IEC 60664-1:2020 / ISO 6469-3',
    `Apply 2×V_max + 1000V AC (or 1.4× DC equivalent) for 60s between HV and chassis. No breakdown. For ${Vmax}V pack: ${(2*Vmax+1000).toFixed(0)}V AC test voltage.`,
    `Pre-condition at 40°C/95% RH for 24h before test to catch marginal insulation.`),

  btCard('🌊','IP Rating Verification (Ingress Protection)',
    'IEC 60529 / ISO 20653',
    `${ctx.ip} — Water jet at 12.5 l/min for 3 min all sides (IP6X dust / IPX7 immersion 1m/30min). Post-test: isolation resistance must remain ≥100 Ω/V.`,
    `Check IP rating applies at both connector mated and unmated states.`),

  btCard('⚡','Shock & High-Voltage Interlock',
    'ISO 6469-3:2021 §7',
    `Service disconnect and manual service disconnect (MSD) must de-energise HV within 5s. Test HVIL signal continuity and break detection. Verify contactor opening time ≤ 200ms.`,
    `Test HVIL with both contactor open and closed — open-circuit fault must trigger BMS isolation.`),

  btCard('🔥','Thermal Event Isolation',
    'IEC 62619:2022 §7.3.5',
    `In thermal runaway scenario: HV bus must remain isolated from chassis. Validate isolation monitor function during forced cell overcharge (single cell trigger).`),
])}`;
}

/* ════════════════════
   🟡 LV SYSTEM
   ════════════════════ */
function bt_lv_system(ctx) {
  return `
${btSectionHead('🟡 LV System Testing','12V/24V auxiliary circuits, communication, connector integrity')}
${btGrid([
  btCard('🔋','LV Supply Voltage Range',
    'ISO 16750-2:2023 §4',
    `Normal: 9–16V (12V sys). Cranking: 6V for 40ms. Load dump: 24V for 400ms. All BMS/CAN functions must survive. Test at −40°C and +85°C.`,
    `Verify BMS wakeup at 6V cranking — many BMS MCUs brown-out below 7V.`),

  btCard('📡','CAN Bus Integrity',
    'ISO 11898-2:2016 / LV 124',
    `Dominant/recessive bit timing, bus load up to 80%. Verify no lost messages at 500 kbit/s under −40°C and 85°C. CANH/CANL differential ≥1.5V.`,
    `Log CAN error frames during vibration test — loose connections show up as burst errors.`),

  btCard('🔌','Connector Mating Force & Contact Resistance',
    'IEC 60512, LV 214',
    `Mating force ≤ 50N for multi-pin HV connectors. Contact resistance ≤ 5 mΩ initial, ≤ 10 mΩ after 100 mate cycles. Test after temperature cycling.`),

  btCard('⚡','LV Overvoltage & Reverse Polarity',
    'ISO 16750-2:2023 §4.6',
    `Reverse polarity: −14V for 60s — no permanent damage. Overvoltage: +24V for 400ms (load dump). Verify protection circuits activate.`),
])}

${btWip('LV System — Extended test matrix')}`;
}

/* ════════════════════
   🧠 BMS FUNCTION
   ════════════════════ */
function bt_bms_function(ctx) {
  return `
${btSectionHead('🧠 BMS Functional Testing','SoC accuracy, protection thresholds, balancing, communication')}
${btGrid([
  btCard('📊','SoC Estimation Accuracy',
    'IEC 62619:2022 / VDA 0126',
    `Drive WLTP or duty-cycle profile. Measure SoC error vs Ah-counted reference. Target: ±3% RMS across 10–90% SoC. Test at 0°C and 40°C.`,
    `Inject step-change load to test SoC jump detection — kalman filter BMS shows smoother response than coulomb counter.`),

  btCard('🛡️','OVP / UVP Protection',
    'IEC 62619:2022 §7.2',
    `Cell OVP: trigger at V_max + 20mV (${(+(ctx.vmax.replace(/[^\d.]/g,''))/((window.S||{}).S_total||112)+(0.020)).toFixed(3)}V/cell). UVP: trigger at V_min − 30mV. Verify contactor opens within 500ms. No recovery without manual reset.`,
    `Test OVP with single-cell bypass — charger supplies current while one cell is excluded from voltage sense.`),

  btCard('🌡️','Overtemperature Protection',
    'IEC 62619:2022 §7.3',
    `Cell T_warn: ${+ctx.tcell - 5}°C. T_fault: ${ctx.tcell}°C — reduce to C/3. T_cutoff: ${+ctx.tcell + 5}°C — contactor open. Test with forced heating of single cell using resistive heater patch.`),

  btCard('⚖️','Cell Balancing Verification',
    'IEC 62619:2022 §6.7',
    `Create 50mV imbalance (disconnect one cell briefly). Verify passive or active balancing reduces delta to <5mV within charge cycle. Log individual cell voltages.`,
    `Active balancing systems: verify balancing current ≥200mA. Passive: check bleed resistor temperatures.`),

  btCard('🔄','Contactor Weld Detection',
    'ISO 26262 / FMVSS 305',
    `Simulate welded main contactor: pre-charge relay opens, main stays closed. BMS must detect within 1 charge cycle and flag fault. Verify no drive-away allowed.`),

  btCard('💬','Communication Watchdog',
    'ISO 26262 Part 4',
    `Interrupt CAN bus for 200ms — BMS must open contactors and set fault. Resume CAN — verify BMS clears fault and re-closes after valid heartbeat sequence.`),
])}`;
}

/* ════════════════════
   🚀 PERFORMANCE
   ════════════════════ */
function bt_performance(ctx) {
  const E = +ctx.egross;
  const P = +ctx.ppeak;
  const t10_80 = ((E*0.7)/(P*0.75)*60).toFixed(0);

  return `
${btSectionHead('🚀 Performance Testing','Energy, power, efficiency, charge time')}
<div class="card" style="margin-bottom:16px">
  ${btCalc('Estimated 10→80% charge time (est.)',`0.7×E / (0.75×P_peak)`, t10_80,'min')}
  ${btCalc('Target peak power',`From Project Targets`,P,'kW')}
  ${btCalc('Target gross energy',`From Project Targets`,E,'kWh')}
</div>
${btGrid([
  btCard('⚡','Peak Power Verification',
    'ISO 12405-4:2018 §8.4',
    `10s discharge pulse at target P_peak = ${P}kW from 80% SoC, 25°C. Measure actual power at pack terminals. Must deliver ≥ ${(P*0.95).toFixed(1)}kW (≥95% of target).`,
    `Run at −10°C also — power derating at cold start is a common failure point.`),

  btCard('🔋','Usable Energy & Range',
    'ISO 12405-4:2018 §8.3 / WLTP',
    `Drive WLTP or application duty cycle until BMS cutoff. Record kWh discharged. Usable energy ≥ ${(E * ((window.S||{}).t_dod||0.9)).toFixed(1)} kWh (${(((window.S||{}).t_dod||0.9)*100).toFixed(0)}% DoD).`),

  btCard('🔌','DC Fast Charge Performance',
    'CHAdeMO / CCS / GB/T 27930',
    `Charge from 10% to 80% SoC. Record charge time, energy in, efficiency. Compare to target ${t10_80}min. Test at 25°C and 0°C.`),

  btCard('⚙️','Regenerative Braking Acceptance',
    'ISO 12405-4:2018 §8.5',
    `Inject regen profile from duty cycle. Verify pack accepts regen current at 90% SoC without OVP trip. Max regen = ${(P*0.4).toFixed(0)}kW for ${ctx.app}.`),
])}
${btWip('Performance — Efficiency map, drive cycle analysis')}`;
}

/* ════════════════════
   🌡️ THERMAL
   ════════════════════ */
function bt_thermal(ctx) {
  return `
${btSectionHead('🌡️ Thermal & Cooling System Testing','Cell temperature distribution, TMS performance, thermal runaway')}
${btGrid([
  btCard('🌡️','Cell Temperature Distribution',
    'IEC 62660-2:2011 §7 / ISO 12405-3',
    `1C discharge from 100% SoC. Map cell surface temperatures via TC array or IR camera. ΔT_cell < ${ctx.tcell > 55 ? 5 : 8}°C pack-wide. Identify hotspot.`,
    `Place TCs at: module center, module edge, near coolant inlet and outlet. Min 8 TCs for pack-level test.`),

  btCard('❄️','Cold Soak Start-Up',
    'ISO 12405-3:2014 §7',
    `Soak at ${ctx.top_lo}°C for 8h. Apply 1C discharge immediately. Verify BMS cold-derating activates, TMS pre-conditioning activates. Monitor cell IR (DCIR expected ${ctx.top_lo === -20 ? '4–8×':'2–3×'} nominal at soak temp).`),

  btCard('🔥','Thermal Runaway Propagation',
    'IEC 62619:2022 §7.3.5 / UN GTR 20',
    `Trigger single-cell thermal runaway (nail penetration or resistive heater). Monitor propagation to adjacent cells. Pack must not explode — venting acceptable. Occupant alert within 5 min.`,
    undefined,
    `Highest criticality test — requires specialist lab with blast shields and gas monitoring.`),

  btCard('💧','TMS Cooling Performance',
    'Application-specific TMS spec',
    `At continuous P_cont = ${(+ctx.ppeak*0.6).toFixed(0)}kW load, coolant inlet ${ctx.top_hi}°C, flow rate per TMS design. Verify T_cell_max < ${ctx.tcell}°C at steady state. Measure coolant ΔT across pack.`),

  btCard('🌬️','Heat Rejection at High Ambient',
    'ISO 12405-3:2014',
    `${ctx.top_hi}°C ambient, 1C continuous 60 min. TMS operating. Verify no OTP trip. Measure thermal equilibrium time.`),
])}`;
}

/* ════════════════════
   🔩 MECHANICAL
   ════════════════════ */
function bt_mechanical(ctx) {
  const vibProfile = ctx.app === 'Excavator' || ctx.app === 'WheelLoader' ? 'ISO 16750-3 Profile IV (Off-highway)' : ctx.app === '2W' || ctx.app === '4W' ? 'ISO 16750-3 Profile I/II (Road vehicle)' : 'ISO 16750-3 (select profile for application)';
  return `
${btSectionHead('🔩 Mechanical Testing','Vibration, shock, crush, drop, mounting loads')}
${btGrid([
  btCard('📳','Random Vibration',
    vibProfile,
    `3-axis random vibration per ${vibProfile}. Typical: 5–200Hz, 0.01–1.0 g²/Hz. Duration per axis: 8–21h (depending on fatigue life target ${ctx.cycles} cycles). Monitor for leakage, connectivity, BMS fault.`,
    `Post-test: full capacity check + IR measurement + isolation resistance. Any >3% cap drop = fail.`),

  btCard('💥','Mechanical Shock',
    'ISO 16750-3:2023 §4.2',
    `Half-sine 30g / 11ms, 3 axes ± direction (18 pulses total). Verify no mechanical damage, no BMS fault, no leakage. Isolation resistance post-shock ≥ 100 Ω/V.`),

  btCard('🪨','Crush / Deformation',
    'UN GTR 20 §8.3 / SAE J2464',
    `Apply ${Math.max(100, +ctx.egross * 3).toFixed(0)} kN force in one axis until 30% deformation or voltage drops 25%. No fire, no explosion. Test in charged state (100% SoC).`,
    undefined,`Requires specialist crush rig. Conduct in blast-proof cell.`),

  btCard('📦','Drop Test',
    'IEC 62133-2:2017 §7.3.5',
    `Drop from 1.0m onto concrete in 6 faces + 2 edges. Inspect for electrolyte leakage, case deformation, functional check. Isolation resistance post-drop ≥ 100 Ω/V.`),

  btCard('🔧','Mounting & Bolt-Load Fatigue',
    'ISO 16750-3 / Customer spec',
    `Apply 1.5× design torque to all mounting points. Fatigue test: 10⁶ cycles at ±50% of design load. Verify no crack, loosening, or BMS fault.`),
])}`;
}

/* ════════════════════
   🌍 ENVIRONMENTAL
   ════════════════════ */
function bt_environmental(ctx) {
  return `
${btSectionHead('🌍 Environmental Testing','Temperature cycling, humidity, altitude, chemical resistance')}
${btGrid([
  btCard('🌡️','Thermal Cycling (Storage)',
    'IEC 60068-2-14 / ISO 16750-4',
    `${ctx.top_lo}°C → ${ctx.top_hi}°C, 2°C/min ramp, 30 min soak each extreme. 500 cycles. Post-test: capacity, IR, isolation. Inspect for seal degradation.`,
    `Pause cycling mid-test (cycle 100) for capacity check — early degradation visible before visual failure.`),

  btCard('💧','Humidity Endurance',
    'IEC 60068-2-78 / ISO 16750-4',
    `40°C / 95% RH, 240h. Post-test: isolation ≥100 Ω/V, no corrosion on HV busbars, BMS connector pins dry.`,
    `For markets with high humidity (${ctx.markets}): extend to 500h if tropical climate.`),

  btCard('🏔️','Altitude Simulation',
    'UN 38.3 §T.5 / ${ctx.t_alt > 3000 ? "ISO 12405-3" : "UN 38.3"}',
    `Simulate ${(window.S||{}).t_alt || 4000}m altitude (11.6 kPa). 6h at temperature extreme. Verify no seal pop, no outgassing. HV arc gap increases at altitude — re-verify creepage.`,
    `${(window.S||{}).t_alt > 3000 ? 'High altitude market confirmed — mandate this test.' : 'Confirm target altitude for market: ' + ctx.markets}`),

  btCard('🧴','Chemical Resistance',
    'ISO 16750-4:2010',
    `Expose to: engine oil, brake fluid, battery acid, cleaning agents, salt spray. 24h contact. No seal compromise. Inspect labelling legibility.`),

  btCard('🌊','Salt Fog / Corrosion',
    'IEC 60068-2-11 (Ka) / ISO 9227',
    `5% NaCl salt fog, 96h. Post-test: no isolation drop, no connector corrosion causing resistance increase. Critical for ${ctx.app === 'Bus' || ctx.app === 'Truck' ? 'under-floor pack exposure' : 'bottom-mount or exposed pack'}.`),
])}`;
}

/* ════════════════════
   📈 LIFECYCLE
   ════════════════════ */
function bt_lifecycle(ctx) {
  const cyc = +ctx.cycles;
  const acc = Math.ceil(cyc / 3);   // 3× accelerated
  return `
${btSectionHead('📈 Life Cycle Testing','Capacity fade, cycle life, calendar ageing')}
<div class="card" style="margin-bottom:16px">
  ${btCalc('Target cycle life',`From Project Targets`, cyc, 'cycles')}
  ${btCalc('Accelerated test cycles (3×C)',`T/3 for faster run`, acc,'cycles')}
  ${btCalc('Calendar life target','From Project Targets',(window.S||{}).t_years||10,'years')}
  ${btCalc('EoL SoH target','From Project Targets',((window.S||{}).t_soh_eol||80)+'%','')}
</div>
${btGrid([
  btCard('🔄','Cycle Life (CCCCV)',
    'IEC 62660-1:2010 §9 / ISO 12405-4:2018 §8.6',
    `1C CC charge → CV → 1C CC discharge. Check capacity every 50 cycles. Target: SoH ≥ ${(window.S||{}).t_soh_eol||80}% at ${cyc} cycles. Temperature: 25°C.`,
    `For ${ctx.chem}: accelerate at 45°C (NMC/NCA) or 35°C (LFP) to shorten test duration. Apply temperature factor correction.`),

  btCard('📅','Calendar Ageing',
    'IEC 62660-1:2010 §10',
    `Store at 50% SoC, ${+ctx.top_hi - 10}°C. Measure capacity and IR every 3 months. Target: SoH ≥ ${(window.S||{}).t_soh_eol||80}% after ${(window.S||{}).t_years||10} years (accelerated at elevated temp).`),

  btCard('🌡️','Thermal Stress Ageing',
    'IEC 62660-1 + Temperature extrapolation',
    `Cycle at ${ctx.top_hi}°C to accelerate degradation. Use Arrhenius model: each 10°C ≈ 2× ageing rate. Estimate equivalent calendar years from test months.`),

  btCard('📊','SoH vs Usage Correlation',
    'Application-specific / OEM spec',
    `Combine cycle + calendar ageing. Map SoH vs (cycles, months, T_avg). Define warranty boundary at SoH ${(window.S||{}).t_soh_eol||80}%. Identify dominant degradation mechanism.`),
])}`;
}

/* ════════════════════
   💥 ABUSE
   ════════════════════ */
function bt_abuse(ctx) {
  return `
${btSectionHead('💥 Abuse & Safety Testing','Overcharge, over-discharge, short circuit, nail penetration')}
${btGrid([
  btCard('⬆️','Overcharge',
    'IEC 62619:2022 §7.3.2 / UN 38.3 §T.7',
    `Charge at 1C to 1.2× V_max (${(+ctx.vmax * 1.2).toFixed(0)}V pack). BMS must disconnect before cell venting. No fire, no explosion. Gas sensor monitoring required.`,
    undefined,`Highest thermal risk test. Requires fume extraction and fire suppression standby.`),

  btCard('⬇️','Over-Discharge',
    'IEC 62619:2022 §7.3.3 / UN 38.3',
    `Discharge at 1C to 0V (forced). BMS must disconnect at V_min. Post-test: charge to 50% SoC — cell must recover without gas. Check for copper dissolution (${ctx.chem === 'LFP' ? 'LFP low risk' : 'NMC moderate risk'}).`),

  btCard('🔌','External Short Circuit',
    'IEC 62619:2022 §7.3.1 / UN 38.3 §T.5',
    `Short HV terminals via 5mΩ resistance. BMS must interrupt within 500ms. No fire, no explosion, no sustained arc. Test at 100% SoC and 60°C.`,
    `Use fusible link + current clamp to verify peak short-circuit current ≤ rated fuse interrupt capacity.`),

  btCard('📍','Nail Penetration',
    'GB/T 31485:2015 §6.4 / SAE J2464',
    `3mm steel nail penetrates largest cell face at 80mm/s. 100% SoC. Monitor T_cell — must not exceed 500°C at penetration point. No fire, no explosion.`,
    undefined,`LFP: typically passes without fire. NMC: high risk — check TRP propagation. Notify lab ahead.`),

  btCard('🔥','Forced Thermal Runaway Propagation',
    'UN GTR 20 §8.4 / IEC 62619',
    `Trigger single cell thermal runaway. Monitor propagation to adjacent cells. Warning signal to driver within 5 minutes of first thermal event. No explosion for ≥5 min.`),

  btCard('🚗','Crush (Side/Frontal)',
    'UN GTR 20 §8.3',
    `Ground simulation: 100mm/min to 30% deformation or terminal voltage drop 25%. No fire, no explosion. Tests relevant for ${ctx.app} underbody or side-mount pack.`),
])}`;
}

/* ════════════════════
   📡 EMI/EMC
   ════════════════════ */
function bt_emi_emc(ctx) {
  return `
${btSectionHead('📡 EMI / EMC Testing','Radiated emissions, conducted immunity, ESD')}
${btGrid([
  btCard('📻','Radiated Emissions',
    'CISPR 25:2021 / UNECE R10',
    `Measure radiated RF from BMS/DC-DC during discharge. Limits: Class 5 (vehicle) 30–300MHz. Test in semi-anechoic chamber with vehicle harness simulator.`,
    `BMS PWM frequencies (typically 20–200kHz) often cause harmonics in FM band — ensure EMI filter on BMS supply.`),

  btCard('📶','Conducted Emissions (LV bus)',
    'CISPR 25:2021 / ISO 7637-2',
    `Measure conducted noise on 12V LV supply from DC-DC converter. Limits per CISPR 25 Band 5. Add common-mode choke if >6dBμV over limit.`),

  btCard('🛡️','Bulk Current Injection (BCI)',
    'ISO 11452-4:2020',
    `Inject RF current (1–400MHz) onto HV cable harness. BMS must remain functional. No false OVP/UVP trip, no CAN error. 30mA injection level (automotive severity level 3).`),

  btCard('⚡','ESD Immunity',
    'ISO 10605:2008 / IEC 61000-4-2',
    `±8kV contact, ±15kV air discharge to exposed connectors and mounting points. No permanent damage, no BMS reset. Latch-up recovery within 5s.`),

  btCard('🔀','Transient Immunity (Load Dump)',
    'ISO 7637-2:2011 / ISO 16750-2',
    `Load dump pulse 87V / 400ms on 12V LV bus. No damage to BMS, BCM, LV circuits. Transient suppressor response within 1μs.`),
])}
${btWip('EMI/EMC — Full site acceptance + type approval sequence')}`;
}

/* ════════════════════
   🏅 CERTIFICATION
   ════════════════════ */
function bt_certification(ctx) {
  const marketList = (ctx.markets || '').toUpperCase();
  const needsEU  = marketList.includes('EU') || marketList.includes('EUR');
  const needsUS  = marketList.includes('US');
  const needsCN  = marketList.includes('CN') || marketList.includes('JP');
  const isOH     = ['Excavator','WheelLoader','AgTractor','Truck'].includes(ctx.app);

  return `
${btSectionHead('🏅 Certification & Homologation','Required certifications based on markets and vehicle type')}

<div class="g3" style="margin-bottom:16px">
  ${[
    needsEU  ? {l:'EU CE / UN ECE',       col:'var(--b)', reqs:'UNECE R100 (EV), UN 38.3 (transport), CE Machinery Directive'} : null,
    needsUS  ? {l:'US UL / DOT',          col:'var(--g)', reqs:'UL 2580 (EV battery), SAE J2929, FMVSS 305 (crash)'} : null,
    needsCN  ? {l:'China GB/T',           col:'var(--r)', reqs:'GB/T 31485, GB/T 31467-3, GB 38031'} : null,
    isOH     ? {l:'Off-Highway CE',        col:'var(--y)', reqs:'Machinery Directive 2006/42/EC, ISO 13849 (FuSa), IEC 62619'} : null,
    {l:'UN 38.3 Transport',               col:'var(--teal)', reqs:'Required for all markets — air/sea/road transport safety'},
  ].filter(Boolean).map(r=>`
    <div class="kpi-card" style="border-color:${r.col}40;background:${r.col}08">
      <div class="kpi-v" style="color:${r.col};font-size:14px">${r.l}</div>
      <div class="kpi-l" style="font-size:11px;margin-top:4px">${r.reqs}</div>
    </div>`).join('')}
</div>

${btGrid([
  btCard('🚢','UN 38.3 Transport Testing',
    'UN Manual of Tests & Criteria §38.3',
    `T1 Altitude, T2 Thermal, T3 Vibration, T4 Shock, T5 External short, T6 Impact, T7 Overcharge, T8 Forced discharge. Required for all markets before shipping.`,
    `Start UN 38.3 early — 8 sequential tests, ~3–4 months. Cell-level and pack-level required separately.`),

  btCard('🔋','IEC 62619 Safety Standard',
    'IEC 62619:2022 (stationary/traction)',
    `Safety requirements for secondary lithium cells in traction. Covers: protection, BMS, overtemperature, overcharge, short circuit, forced discharge, crush. Mandatory for CE marking.`),

  btCard('🏎️','UNECE R100 (EV)',
    'UNECE Regulation No. 100 Rev.3',
    `Applies to ${needsEU ? 'EU market — mandatory' : 'EU market if applicable'}. Electric safety (Part I) + rechargeable energy storage system (Part II). Covers REESS isolation, thermal propagation, water ingress.`,
    undefined, needsEU ? 'EU market confirmed — R100 Part II mandatory.' : undefined),

  btCard('🇨🇳','GB 38031:2020 (China)',
    'GB 38031:2020',
    `China mandatory since 2021. Adds thermal propagation test with 5-minute occupant warning requirement. Critical requirement — no warning gap allowed. Applies to ${needsCN?'your CN market.':'CN market if applicable.'}`,
    undefined, needsCN ? 'CN market confirmed — GB 38031:2020 mandatory.' : undefined),
])}

<div class="ico-banner" style="margin-top:16px">
  📌 Certification requirements auto-filtered for: <strong>${ctx.markets}</strong> · <strong>${ctx.app}</strong> application.
  Update Project Targets → Markets to refresh this list.
</div>`;
}

/* ════════════════════════════
   INIT — runs once on load
   ════════════════════════════ */
(function() {
  /* Hook into switchTopTab to trigger render */
  const _orig = window.switchTopTab;
  window.switchTopTab = function(tabId, btn) {
    if (_orig) _orig.apply(this, arguments);
    if (tabId === 'testing') {
      setTimeout(() => { try { renderBatteryTesting(window._bt_active_cat); } catch(e) { console.warn('bt render', e); }}, 80);
    }
  };

  /* Re-render on propagate if testing tab is active */
  const _origProp = window.propagate;
  window.propagate = function() {
    if (_origProp) _origProp.apply(this, arguments);
    try {
      if (document.getElementById('panel-testing')?.classList.contains('active')) {
        renderBatteryTesting(window._bt_active_cat);
      }
    } catch(e) {}
  };
})();
