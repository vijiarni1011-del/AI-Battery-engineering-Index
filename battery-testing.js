/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — BATTERY TESTING  v4.0
   Complete UX overhaul: sticky nav, 2-col layout, clean hierarchy
   ═══════════════════════════════════════════════════════════════ */

const BT_CATS = [
  { id:'electrical',    icon:'⚡', label:'Electrical',        color:'#4a9eff' },
  { id:'thermal',       icon:'🌡️', label:'Thermal & Cooling',  color:'#ff7b35' },
  { id:'performance',   icon:'🚀', label:'Performance',        color:'#00d4aa' },
  { id:'environmental', icon:'🌍', label:'Environmental',      color:'#00b891' },
  { id:'mechanical',    icon:'🔩', label:'Mechanical',         color:'#6d8fba' },
  { id:'abuse',         icon:'💥', label:'Abuse & Safety',     color:'#ef4444' },
  { id:'emi_emc',       icon:'📡', label:'EMI / EMC',          color:'#a78bfa' },
  { id:'certification', icon:'🏅', label:'Certification',      color:'#fbbf24' },
  { id:'equipment',     icon:'🧰', label:'Equipment',          color:'#94a3b8' },
];

function bt_ctx() {
  // Read DOM directly for freshest values — S may lag if propagate hasn't run
  const g = id => { const el=document.getElementById(id); return el ? el.value : null; };
  const S = window.S || {};
  return {
    app:    g('t_app') || S.app || '4W',
    chem:   ((g('c_chem') || S.c_chem || 'LFP')).split(' ')[0].toUpperCase(),
    vnom:     +(S.V_nom_pack || (+(g('c_cps')||14)*(+(g('c_ss')||8))*(+(g('c_vnom')||3.2))) || 400),
    vmax:     +(S.V_max_pack || 420),
    vmin:     +(S.V_min_pack || 280),
    // DoD-based operative voltages (from OCV canvas + DoD)
    v_op_max: S.V_dod_hi_pack > 0 ? +S.V_dod_hi_pack.toFixed(1) : +(S.V_max_pack||420),
    v_op_min: S.V_dod_lo_pack > 0 ? +S.V_dod_lo_pack.toFixed(1) : +(S.V_min_pack||280),
    v_op_hi_cell: S.V_dod_hi_cell > 0 ? +S.V_dod_hi_cell.toFixed(3) : +(g('c_vmax')||S.c_vmax||3.65),
    v_op_lo_cell: S.V_dod_lo_cell > 0 ? +S.V_dod_lo_cell.toFixed(3) : +(g('c_vmin')||S.c_vmin||2.0),
    soc_lo:  S.soc_lo != null ? +S.soc_lo.toFixed(0) : Math.round((1-(+(g('t_dod')||S.t_dod||1)))*100/2),
    soc_hi:  S.soc_hi != null ? +S.soc_hi.toFixed(0) : Math.round(100-(1-(+(g('t_dod')||S.t_dod||1)))*100/2),
    vcell_max: +(g('c_vmax') || S.c_vmax || 3.65),
    vcell_min: +(g('c_vmin') || S.c_vmin || 2.8),
    egross: +(S.E_gross || +(g('t_emin')) || 43),
    euse:   +((S.E_gross||43)*(+(g('t_dod')||S.t_dod||0.9))),
    ppeak:  +(g('t_ppeak') || S.t_ppeak || 80),
    pcont:  +(g('t_pcont') || S.t_pcont || 50),
    imax:   S.t_ppeak ? +(S.t_ppeak*1000/(S.V_nom_pack||400)).toFixed(0) : 200,
    icont:  S.t_pcont ? +(S.t_pcont*1000/(S.V_nom_pack||400)).toFixed(0) : 130,
    ichg:   +(g('t_imax_chg') || S.t_imax_chg || 120),
        sxp:    S.config_label || (S.S_total||112)+'S/'+(S.c_pp||1)+'P',
    qpack:  +(S.Q_pack || +(g('c_ah')) || 120),
    top_lo: +(g('t_top_lo') ?? S.t_top_lo ?? -20),
    top_hi: +(g('t_top_hi') ?? S.t_top_hi ?? 55),
    tcell:  +(g('t_tcell_max') ?? S.t_tcell_max ?? 55),
    ip:     g('t_ip') || S.t_ip || 'IP67',
    markets:(g('t_markets') || S.markets || 'EU, US').toUpperCase(),
    cycles: +(S.t_cycles       || 3000),
    years:  +(S.t_years        || 10),
    soh_eol:+(S.t_soh_eol     || 80),
    ir_bol: +(S.c_ir_bol       || 0.22),
    S_total:+(S.S_total        || 112),
    c_pp:   +(S.c_pp           || 1),
    ah:     +(S.c_ah           || 120),
  };
}

window.renderBatteryTesting = function(catId) {
  const root = document.getElementById('bt_root');
  if (!root) return;
  catId = catId || window._bt_active_cat || 'electrical';
  window._bt_active_cat = catId;
  const cat = BT_CATS.find(c => c.id === catId) || BT_CATS[0];
  const ctx = bt_ctx();

  /* ── Project context strip — ALL target fields ── */
  const g2=id=>{const el=document.getElementById(id);return el?el.value:null;};
  const S2=window.S||{};
  const ctxItems = [
    // Identity
    ['App',      ctx.app],
    ['Chem',     ctx.chem],
    ['Config',   ctx.sxp],
    // Energy
    ['E_gross',  (+ctx.egross).toFixed(1)+'kWh'],
    ['E_use',    (+ctx.euse).toFixed(1)+'kWh'],
    ['DoD',      (+(g2('t_dod')||S2.t_dod||1)*100).toFixed(0)+'%'],
    ['Autonomy', (+(g2('t_auto')||S2.t_auto||4)).toFixed(1)+'h'],
    // Voltage (absolute cell limits)
    ['V_nom',      (+ctx.vnom).toFixed(0)+'V'],
    ['V_max(abs)', (+ctx.vmax).toFixed(0)+'V'],
    ['V_min(abs)', (+ctx.vmin).toFixed(0)+'V'],
    // DoD-operative voltages (actual working range from OCV+DoD)
    ['Vop_hi',   ctx.v_op_max+'V'],
    ['Vop_lo',   ctx.v_op_min+'V'],
    ['Vc_hi',    ctx.v_op_hi_cell+'V'],
    ['Vc_lo',    ctx.v_op_lo_cell+'V'],
    ['SoC_rng',  ctx.soc_lo+'–'+ctx.soc_hi+'%'],
    // Power
    ['P_peak',   ctx.ppeak+'kW'],
    ['P_cont',   ctx.pcont+'kW'],
    ['I_peak',   ctx.imax+'A'],
    ['t_peak',   (+(g2('t_tpeak')||S2.t_tpeak||30))+'s'],
    ['C_peak',   (+(g2('t_cpeak')||S2.t_cpeak||2.0)).toFixed(1)+'C'],
    // Cell
    ['Cap',      ctx.qpack+'Ah'],
    ['IR_BoL',   ctx.ir_bol+'mΩ'],
    ['IR_EoL',   (+(g2('c_ir_eol')||S2.c_ir_eol||0.35)).toFixed(3)+'mΩ'],
    // Charging
    ['P_DC',     (+(g2('t_pdc')||S2.t_pdc||60))+'kW'],
    ['I_chg',    ctx.ichg+'A'],
    ['C_chg',    (+(g2('t_cchg')||S2.t_cchg||0.5)).toFixed(2)+'C'],
    // Thermal
    ['T_cell',   ctx.tcell+'°C'],
    ['T_op',     ctx.top_lo+'→'+ctx.top_hi+'°C'],
    ['T_chg',    (+(g2('t_tchg_lo')||S2.t_tchg_lo||-15))+'→'+(+(g2('t_tchg_hi')||S2.t_tchg_hi||45))+'°C'],
    // Lifetime
    ['Cycles',   ctx.cycles],
    ['SoH_EoL',  ctx.soh_eol+'%'],
    ['Life',     (+(g2('t_years')||S2.t_years||10))+'yr'],
    // Environmental
    ['IP',       ctx.ip],
    ['Alt',      (+(g2('t_alt')||S2.t_alt||3000))+'m'],
    ['Markets',  ctx.markets],
  ];

  root.innerHTML = `
<style>
#bt_shell{display:flex;flex-direction:column;height:100%;min-height:0}
#bt_topbar{background:var(--bg2);border-bottom:1px solid var(--border);flex-shrink:0}
#bt_ctx_strip{display:flex;flex-wrap:wrap;gap:5px;padding:8px 16px;background:var(--bg3);border-bottom:1px solid var(--border);align-items:center}
#bt_subnav{display:flex;gap:2px;flex-wrap:wrap;padding:8px 12px;overflow-x:auto}
#bt_body{flex:1;overflow-y:auto;padding:20px 24px}
.bt-catbtn{display:flex;align-items:center;gap:5px;padding:6px 13px;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:var(--sans);transition:all .12s;border:1px solid transparent;background:transparent;color:var(--text2)}
.bt-catbtn:hover{background:rgba(255,255,255,.04);color:var(--text)}
.bt-catbtn.active{border-color:${cat.color}50;background:${cat.color}15;color:${cat.color}}
.bt-hdr{display:flex;align-items:center;gap:12px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border)}
.bt-hdr-icon{width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;background:${cat.color}18;border:1px solid ${cat.color}40}
.bt-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:800px){.bt-cols{grid-template-columns:1fr}}
.bt-card{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px}
.bt-card-title{font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px}
.bt-std-badge{font-size:9px;font-family:var(--mono);color:var(--text3);padding:2px 7px;background:var(--bg4);border:1px solid var(--border);border-radius:4px;display:inline-block;margin-bottom:8px;white-space:nowrap}
.bt-body-text{font-size:12px;color:var(--text2);line-height:1.75}
.bt-tip{background:rgba(0,212,170,.06);border-left:3px solid var(--teal);padding:8px 12px;font-size:12px;color:var(--text2);border-radius:0 6px 6px 0;margin-top:8px}
.bt-warn{background:rgba(245,197,24,.06);border-left:3px solid var(--y);padding:8px 12px;font-size:12px;border-radius:0 6px 6px 0;margin-top:8px}
.bt-crit{background:rgba(255,77,109,.06);border-left:3px solid var(--r);padding:8px 12px;font-size:12px;border-radius:0 6px 6px 0;margin-top:8px}
.bt-formula{font-family:var(--mono);font-size:11px;background:var(--bg4);border-left:3px solid var(--teal);padding:6px 10px;border-radius:0 5px 5px 0;margin:5px 0;color:var(--text2)}
.bt-calc-row{display:flex;align-items:baseline;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)}
.bt-calc-row:last-child{border:none}
.bt-calc-label{font-size:12px;color:var(--text2);flex:1.3;min-width:0}
.bt-calc-formula{font-family:var(--mono);font-size:10px;color:var(--text3);flex:1.4;min-width:0}
.bt-calc-val{font-family:var(--mono);font-size:13px;font-weight:700;color:var(--teal);white-space:nowrap}
.bt-calc-unit{font-size:10px;color:var(--text3);margin-left:2px}
.bt-section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);margin:18px 0 8px;padding-bottom:5px;border-bottom:1px solid var(--border)}
.bt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
</style>

<div id="bt_shell">
  <div id="bt_topbar">
    <!-- Category nav -->
    <div id="bt_subnav">
      ${BT_CATS.map(c => `<button class="bt-catbtn ${c.id===catId?'active':''}"
        style="${c.id===catId?`border-color:${c.color}50;background:${c.color}15;color:${c.color}`:''}"
        onclick="renderBatteryTesting('${c.id}')">
        <span style="font-size:13px">${c.icon}</span>${c.label}
      </button>`).join('')}
    </div>
    <!-- Project context -->
    <div id="bt_ctx_strip">
      <span style="font-size:9px;font-family:var(--mono);color:var(--text3);flex-shrink:0">PROJECT →</span>
      ${ctxItems.map(([k,v])=>`<div style="display:flex;gap:3px;align-items:center;background:var(--bg4);border:1px solid var(--border2);border-radius:4px;padding:2px 7px">
        <span style="font-size:9px;font-family:var(--mono);color:var(--text3)">${k}</span>
        <span style="font-size:11px;font-family:var(--mono);color:var(--teal);font-weight:700">${v}</span>
      </div>`).join('')}
      <button onclick="switchTopTab('engineering',document.getElementById('ttab-engineering'));showSec('targets',document.querySelector('.nb'))"
        style="margin-left:auto;padding:3px 9px;background:rgba(74,158,255,.1);border:1px solid rgba(74,158,255,.3);color:var(--b);border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;flex-shrink:0">✏ Edit Targets</button>
    </div>
  </div>

  <div id="bt_body">
    <div class="bt-hdr">
      <div class="bt-hdr-icon">${cat.icon}</div>
      <div>
        <div style="font-family:var(--display);font-size:17px;font-weight:700;color:var(--text)">${cat.label} Testing</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Calculated parameters · Test matrix · Standards · Equipment</div>
      </div>
    </div>
    ${bt_renderCat(catId, ctx)}
  </div>
</div>`;

  requestAnimationFrame(() => { try { bt_drawCharts(catId, ctx); } catch(e) {} });
};


function bt_renderCat(id, c) {
  switch(id) {
    case 'electrical':    return bt_electrical(c);
    case 'thermal':       return bt_thermal(c);
    case 'performance':   return bt_performance(c);
    case 'environmental': return bt_environmental(c);
    case 'mechanical':    return bt_mechanical(c);
    case 'abuse':         return bt_abuse(c);
    case 'emi_emc':       return bt_emi_emc(c);
    case 'certification': return bt_certification(c);
    case 'equipment':     return bt_equipment(c);
    default: return '<div>Select a category</div>';
  }
}

/* ── Helper: calc row ── */
function btr(label, formula, result, unit, note='') {
  return `<div class="bt-calc-row">
    <span class="bt-calc-label">${label}</span>
    <span class="bt-calc-formula">${formula}</span>
    <span class="bt-calc-val">${result}<span class="bt-calc-unit">${unit}</span></span>
    ${note?`<span style="font-size:10px;color:var(--text3)">${note}</span>`:''}
  </div>`;
}

function btCard(title, std, body, tip, warn, crit) {
  const stdBadge = `<span class="bt-std" style="cursor:pointer;color:var(--b);border-color:rgba(74,158,255,.25);background:rgba(74,158,255,.06)"
    onclick="switchTopTab('standards',document.getElementById('ttab-standards'))">📜 Standards ref</span>`;
  return `<div class="bt-card" style="height:100%;box-sizing:border-box">
    <div class="bt-card-title">${title}</div>
    ${stdBadge}
    <div style="font-size:12px;color:var(--text2);line-height:1.7">${body}</div>
    ${tip  ?`<div class="bt-tip">💡 ${tip}</div>`:''}
    ${warn ?`<div class="bt-warn">⚠ ${warn}</div>`:''}
    ${crit ?`<div class="bt-crit">🚨 ${crit}</div>`:''}
  </div>`;
}

/* ════════════════════════
   ⚡ ELECTRICAL
   ════════════════════════ */
function bt_electrical(c) {
  const R_pack = c.ir_bol * c.S_total / c.c_pp;
  const Vdrop  = R_pack * 1e-3 * c.imax;
  const Vdrop_pct = (Vdrop/c.vnom*100).toFixed(1);
  const Q_ir   = Math.pow(c.imax,2) * R_pack * 1e-3;
  const cap_ah = (c.egross*1000/c.vnom).toFixed(1);
  const Eout   = c.egross * 0.97;
  const eta    = (Eout/c.egross*100).toFixed(1);
  const IR_ins_min = c.vmax * 100;

  return `
<div class="bt-section-title">📐 Calculated Test Parameters</div>
<div class="card" style="margin-bottom:16px">
  ${btr('Pack capacity (test Ah)',         `${c.egross}kWh × 1000 ÷ ${c.vnom}V`,  cap_ah,       'Ah')}
  ${btr('Peak C-rate',                     `${c.imax}A ÷ ${cap_ah}Ah`,             (c.imax/+cap_ah).toFixed(3), 'C')}
  ${btr('Pack DCIR BoL (25°C/50%SoC)',     `${c.ir_bol}mΩ × ${c.S_total}/${c.c_pp}`, R_pack.toFixed(1), 'mΩ')}
  ${btr('Peak ΔV (I²R drop)',             `${R_pack.toFixed(0)}mΩ × ${c.imax}A`, `${Vdrop.toFixed(1)}V (${Vdrop_pct}%)`, '')}
  ${btr('I²R heat @ peak current',        `${c.imax}² × ${R_pack.toFixed(0)}mΩ`, (Q_ir/1000).toFixed(2), 'kW')}
  ${btr('Insulation resistance min',      `100 Ω/V × ${c.vmax}V`,                (IR_ins_min/1000).toFixed(0), 'kΩ', 'per applicable standard')}
  ${btr('Round-trip efficiency (est.)',   'E_out / E_in',                          eta, '%')}
</div>

<div class="bt-section-title">⚡ Key Formula Reference</div>
<div class="g2" style="margin-bottom:16px">
  <div>
    <div class="bt-formula">V = I × R &nbsp;·&nbsp; P = V × I &nbsp;·&nbsp; E = ∫V·I dt</div>
    <div class="bt-formula">DCIR = ΔV / ΔI &nbsp;(10s pulse at 50%SoC, 25°C)</div>
    <div class="bt-formula">η = E_out / E_in &nbsp;·&nbsp; SoC = ∫I dt / Q_nominal</div>
    <div class="bt-formula">R_pack = R_cell × S / P &nbsp;·&nbsp; ΔV = I × R_pack</div>
    <div class="bt-formula">Q_gen = I² × R_pack &nbsp;[Watts]</div>
  </div>
  <div>
    <div class="bt-formula">C_rate = I / C_nominal &nbsp;[h⁻¹]</div>
    <div class="bt-formula">SoH = C_actual / C_initial × 100%</div>
    <div class="bt-formula">per applicable standard = V_pack × 100 Ω/V &nbsp;(min ${IR_ins_min/1000}kΩ)</div>
    <div class="bt-formula">P_max = V × I_cell_max × n_cells</div>
    <div class="bt-formula">Hi-pot: V_test = 2×V_max + 1000 V AC (${(2*c.vmax+1000).toFixed(0)}V)</div>
  </div>
</div>

<div class="bt-section-title">🧪 Test Matrix</div>
<div class="bt-cols">
  ${btCard('Capacity & Energy (CC-CV discharge)', '',
    `Discharge at C/3 from ${c.vmax}V → ${c.vmin}V at 25°C, 0°C, 45°C. 3 stabilisation cycles. Target ≥ ${cap_ah} Ah, ${c.egross} kWh.`,
    'Use calibrated ±0.1% shunt. Log voltage, current, temperature at 1Hz minimum.',
    `${c.chem}: ≥ ${(+cap_ah*0.95).toFixed(0)} Ah at 0°C expected. Flag if <90% of 25°C capacity.`)}

  ${btCard('DCIR — 10s Pulse Method', '',
    `1C pulse (${c.imax.toFixed(0)}A) for 10s from 50%SoC. DCIR = ΔV/ΔI. Test at -20°C, -10°C, 0°C, 10°C, 25°C, 45°C, 55°C and SoC 0/20/50/80/100%.`,
    `Sample at 10ms resolution during pulse. Log pre-pulse OCV and post-pulse relaxation voltage.`,
    'Upload results to DCIR Map tab to generate full heatmap.')}

  ${btCard('Insulation Resistance (IR Test)', '',
    `500V DC insulation tester between all HV conductors and chassis. Min ${(IR_ins_min/1000).toFixed(0)} kΩ (100 Ω/V × ${c.vmax}V). Test before and after water ingress, vibration, thermal cycle.`,
    undefined,
    `Result < 50 Ω/V = CRITICAL FAIL — electrocution risk. Do not continue testing.`)}

  ${btCard('Dielectric Withstand (Hi-Pot)', '',
    `Apply ${(2*c.vmax+1000).toFixed(0)}V AC (or ${(1.4*(2*c.vmax+1000)).toFixed(0)}V DC) for 60s between HV and chassis. Zero breakdown allowed. Pre-condition at 40°C/93%RH for 24h.`,
    'Ramp voltage at 500V/s. Monitor leakage current — alarm at >1mA.`')}

  ${btCard('HV Interlock Loop (HVIL)', '',
    `Verify HVIL circuit opens within 200ms of connector separation. Contactors must de-energise. No HV access possible when HVIL open. Test all connector states.`)}

  ${btCard('BMS Overvoltage Protection', '',
    `Force cell to ${c.vcell_max+0.1}V. BMS must trip contactor within 500ms. No venting. Pack OVP threshold: ${(c.vcell_max+0.02).toFixed(3)}V/cell = ${((c.vcell_max+0.02)*c.S_total).toFixed(1)}V pack.`)}

  ${btCard('LV System Validation (12/24V)', '',
    `Normal: 9–16V (12V system). Cranking: 6V for 40ms. Load dump: 24V for 400ms. BMS must remain functional. Test at -40°C and +85°C.`,
    'Verify BMS wakeup at 6V cranking voltage — MCU brownout common failure mode.')}

  ${btCard('Self-Discharge', '',
    `Charge to 100%SoC. Rest 30 days at 25°C. Measure remaining SoC. Target <3%/month loss.`,
    'Log individual cell voltages via BMS — outlier cell (>2× average loss) indicates leakage path.')}
</div>

<!-- PSD / Frequency chart canvas placeholder -->
<div class="bt-section-title">📡 ACIR / EIS Measurement Approach</div>
<canvas id="bt_elec_canvas" height="180" style="width:100%;display:block;border-radius:8px;background:var(--bg);margin-bottom:12px"></canvas>`;
}

/* ════════════════════════
   🌡️ THERMAL
   ════════════════════════ */
function bt_thermal(c) {
  const Q_gen = Math.pow(c.imax,2) * c.ir_bol * c.S_total / c.c_pp * 1e-3;
  const R_pack = c.ir_bol * c.S_total / c.c_pp;
  const mass_est = c.ah * c.S_total * c.c_pp * 2.8 / 1000;  // rough kg
  const Cp_est   = 1000; // J/kg·K
  const dTdt_adiab = Q_gen / (mass_est * Cp_est) * 60; // °C/min
  const flow_est    = Q_gen / (3400 * 1.07 / 60 * 10); // ΔT=10°C, 1.07kg/L, Cp=3400

  return `
<div class="bt-section-title">📐 Thermal Calculations</div>
<div class="card" style="margin-bottom:16px">
  ${btr('I²R heat generation @ I_peak',    `${c.imax}² × ${R_pack.toFixed(0)}mΩ`,           (Q_gen/1000).toFixed(2),     'kW')}
  ${btr('Adiabatic T-rise rate (no TMS)',  `Q/(m×Cp) = ${(Q_gen).toFixed(0)}W÷(${mass_est.toFixed(0)}kg×${Cp_est}J/kg·K)`, dTdt_adiab.toFixed(2), '°C/min', 'no cooling')}
  ${btr('Coolant flow needed (ΔT=10°C)',   `Q/(ρ×Cp×ΔT) = ${(Q_gen/1000).toFixed(1)}kW`,     flow_est.toFixed(1),         'L/min')}
  ${btr('TMS activation threshold',        `T_cell > T_derate - 10°C`,                        `${c.tcell-10}°C`,            '')}
  ${btr('Thermal runaway onset (typical)', 'Chemistry dependent',                              `${c.chem==='LFP'?130:180}°C`, '', `${c.chem} cell`)}
  ${btr('Hi-pot pre-condition (humidity)', '40°C / 93% RH / 24h',                             '40°C + 93%RH',               '', 'per applicable standard')}
</div>

<div class="bt-section-title">📈 Key Thermal Formulae</div>
<div class="g2" style="margin-bottom:16px">
  <div>
    <div class="bt-formula">Q_gen = I² × R_pack &nbsp;[W]</div>
    <div class="bt-formula">Q_cooling = ṁ × Cp × ΔT &nbsp;[W]</div>
    <div class="bt-formula">ṁ = flow[L/min] × 1.07[kg/L] / 60</div>
    <div class="bt-formula">dT/dt = Q_gen / (m × Cp) &nbsp;[°C/s]</div>
  </div>
  <div>
    <div class="bt-formula">ΔT_pack = T_cell_max - T_ambient</div>
    <div class="bt-formula">Thermal resistance: R_th = ΔT / Q</div>
    <div class="bt-formula">TRP time = (T_tr - T_cell) × m × Cp / Q_excess</div>
    <div class="bt-formula">Cooling efficiency: η_cool = Q_removed / Q_gen</div>
  </div>
</div>

<div class="bt-section-title">🧪 Test Matrix</div>
<div class="bt-cols">
  ${btCard('Cell Temperature Distribution', '',
    `1C continuous discharge. Map T_cell via TC array (min 8 TCs: centre, edge, near inlet/outlet). ΔT_pack target ≤ ${c.tcell>55?5:8}°C. Identify hotspot location.`,
    'Place IR camera above pack for 2D thermal mapping. Log at 1Hz minimum.')}

  ${btCard('TMS Cooling Performance','',
    `At P_cont = ${c.pcont}kW, coolant inlet = ${c.top_hi}°C, verify T_cell_max < ${c.tcell}°C at steady state within 60min. Measure coolant ΔT across pack.`,
    `Coolant flow needed ≈ ${flow_est.toFixed(0)} L/min for this pack based on ${(Q_gen/1000).toFixed(1)}kW I²R heat.`)}

  ${btCard('Cold Soak Start-Up', '',
    `Soak at ${c.top_lo}°C for 8h. Immediate 1C discharge. Verify BMS cold-derating, TMS pre-heat. Monitor DCIR — expect ${c.top_lo<=-20?'4–8×':'2–3×'} nominal.`,
    `${c.chem === 'LFP' ? 'LFP: flat OCV at low T makes SoC estimation unreliable — use Ah-count only below 5°C.' : 'NMC: lithium plating risk below 0°C charge. Limit to C/10 below 0°C.'}`)}

  ${btCard('Thermal Runaway Propagation', '',
    `Trigger single-cell TR (nail or resistive heater). Monitor propagation. Pack must not explode. Occupant warning within 5 min. No sustained fire (GB 38031: 5min minimum).`,
    undefined, undefined,
    'Highest criticality test. Requires blast shield, gas monitoring, fire suppression standby. Notify lab minimum 2 weeks ahead.')}

  ${btCard('Cooling Plate Efficiency','',
    `Measure T_cell_in vs T_cell_out across cooling plate at 3 flow rates (50%, 100%, 150% of design). Verify ΔT < 5°C across plate at design flow. Map with TC grid.`)}

  ${btCard('Chiller / HVAC Integration','',
    `Full vehicle TMS test. Verify chiller duty cycle at ${c.top_hi}°C ambient, 100% pack load. Cell T_max < ${c.tcell}°C. Log compressor current, refrigerant P&T, cell T.`)}
</div>

<canvas id="bt_therm_canvas" height="200" style="width:100%;display:block;border-radius:8px;background:var(--bg);margin-top:12px"></canvas>`;
}

/* ════════════════════════
   🚀 PERFORMANCE
   ════════════════════════ */
function bt_performance(c) {
  const t10_80 = ((c.euse*0.7) / (c.ppeak*0.8) * 60).toFixed(0);
  const soc_est = (q, v) => ((v - c.vcell_min*c.S_total) / ((c.vcell_max - c.vcell_min)*c.S_total) * 100).toFixed(1);

  return `
<div class="bt-section-title">📐 Performance Calculations</div>
<div class="card" style="margin-bottom:16px">
  ${btr('10→80% charge time (est.)',  '0.7×E_use ÷ (0.8×P_peak)',      t10_80,                   'min')}
  ${btr('Specific energy (gross)',    `${c.egross}kWh × 1000 ÷ pack_mass`, '— (fill Cell mass)', 'Wh/kg')}
  ${btr('Peak C-rate discharge',      `${c.imax}A ÷ ${c.qpack}Ah`,      (c.imax/c.qpack).toFixed(3), 'C')}
  ${btr('Cont. C-rate discharge',     `${c.icont}A ÷ ${c.qpack}Ah`,     (c.icont/c.qpack).toFixed(3), 'C')}
  ${btr('Charge C-rate (DC)',         `${c.ichg}A ÷ ${c.qpack}Ah`,      (c.ichg/c.qpack).toFixed(3), 'C')}
  ${btr('Regen headroom @90%SoC',    `DoD × 10% head`,                  ((1-(window.S?.t_dod||0.9))*100+10).toFixed(0), '% SoC margin')}
</div>

<div class="bt-section-title">📈 SoC / SoH Formulae</div>
<div class="g2" style="margin-bottom:16px">
  <div>
    <div class="bt-formula">SoC(t) = SoC₀ - ∫₀ᵗ (I/Q_nom) dt</div>
    <div class="bt-formula">SoH = C_meas / C_rated × 100%</div>
    <div class="bt-formula">DoD = 1 - SoC_min &nbsp;[fraction]</div>
    <div class="bt-formula">HPPC: P_pulse = V × I_pulse &nbsp;[at 10s]</div>
  </div>
  <div>
    <div class="bt-formula">OCV → SoC via lookup table (cell-specific)</div>
    <div class="bt-formula">EoL: SoH ≤ ${c.soh_eol}% or IR ≥ 2× initial</div>
    <div class="bt-formula">Cycle life estimated via Arrhenius: T↑10°C → 2× ageing</div>
    <div class="bt-formula">Autonomy = E_usable × SoH / P_avg_net</div>
  </div>
</div>

<div class="bt-section-title">🧪 Test Matrix</div>
<div class="bt-cols">
  ${btCard('Peak Power (HPPC)', '',
    `10s pulse at ${c.imax}A from 80%SoC, 25°C. Measure V_term. P_avail = V_term × I. Must deliver ≥ ${(c.ppeak*0.95).toFixed(0)}kW. Repeat at -10°C.`,
    'Run at 10%, 20%, 50%, 80%, 90% SoC for full power-SoC map. Use for BMS power limit table.')}

  ${btCard('Usable Energy & Autonomy', '',
    `Drive application duty cycle until BMS cutoff. Record kWh discharged. E_usable ≥ ${c.euse} kWh. Calculate autonomy = E_usable ÷ P_avg.`)}

  ${btCard('OCV vs SoC Mapping','',
    `Charge fully. Discharge in C/25 steps (pseudo-OCV). Record V at 0/10/20/30/50/70/80/90/100% SoC. Use at -10°C, 25°C, 45°C. Upload to Cell tab OCV section.`)}

  ${btCard('DC Fast Charge Performance','',
    `10→80% SoC charge. Target ${t10_80} min. Record E_in, E_out, efficiency, max cell ΔT. Test at 25°C and 0°C. Log CC→CV transition point.`)}

  ${btCard('Regenerative Braking Acceptance', '',
    `Inject regen profile at 90%SoC. Verify no OVP trip. Max regen ≈ ${(c.ppeak*0.4).toFixed(0)}kW. Measure accepted energy fraction.`)}

  ${btCard('SoC Estimation Accuracy', '',
    `Drive WLTP/application cycle. Compare BMS-reported SoC vs Ah-count reference. Target: ±3% RMS over 10–90% SoC window. Test at 0°C and 40°C.`,
    'Inject step-change load at 50%SoC — BMS SoC jump indicates algorithm failure.')}
</div>`;
}

/* ════════════════════════
   🌍 ENVIRONMENTAL
   ════════════════════════ */
function bt_environmental(c) {
  return `
<div class="bt-section-title">🌍 Environmental Test Calculations</div>
<div class="card" style="margin-bottom:16px">
  ${btr('Thermal cycling range',    'T_op_lo → T_op_hi',         `${c.top_lo} → ${c.top_hi}°C`, '')}
  ${btr('IP Water jet (IPX5/6)',    'Flow rate per nozzle',       '12.5 L/min', '', `${c.ip}`)}
  ${btr('IP Immersion (IPX7)',      'Depth × duration',           '1m × 30min', '', 'per applicable standard')}
  ${btr('Alt. pressure (4000m)',    '101.3 × (1-0.0226×4)^5.256','61.6 kPa', '', 'per applicable standard.1')}
  ${btr('Salt fog concentration',   'NaCl in deionised water',    '5% ± 1%', '', 'per applicable standard')}
  ${btr('Humidity spec',           '40°C / 93% RH / 240h',       '40°C + 93%', '', 'per applicable standard')}
</div>

<div class="bt-section-title">🧪 Test Matrix</div>
<div class="bt-cols">
  ${btCard('Thermal Cycling (Storage)', '',
    `${c.top_lo}°C → ${c.top_hi}°C, 2°C/min ramp, 30min dwell each extreme. 500 cycles minimum. Post-test: capacity, IR, isolation. Inspect seal integrity.`,
    'Pause at cycle 100 for intermediate capacity check — early degradation visible.')}

  ${btCard('IP Rating Verification', '',
    `${c.ip} target: IP6X (dust) — 8h vacuum test; IPX7 — 1m immersion 30min. Post-test: isolation ≥ 100Ω/V (${(c.vmax*100/1000).toFixed(0)}kΩ min).`)}

  ${btCard('Humidity Endurance', '',
    `40°C / 93%RH, 240h (10 days). Post-test: isolation resistance, no corrosion on busbars, connectors dry. For tropical markets: extend to 500h.`,
    `Market: ${c.markets.includes('IN')||c.markets.includes('INDIA')?'IN confirmed — tropical class applicable.':'Check monsoon exposure for application.'}`)}

  ${btCard('Altitude Simulation', '',
    `Simulate 4000m (61.6 kPa) for 6h. No seal pop, no outgassing. HV arc gap increases at altitude — creepage distances must be verified for ${c.vmax}V at 4000m.`)}

  ${btCard('Salt Fog / Corrosion', '',
    `5% NaCl, 96h. Post-test: isolation ≥ 100Ω/V. No connector corrosion. Critical for ${['Bus','Truck','4W'].includes(c.app)?'road splash exposure':'exposed pack mounting'}.`)}

  ${btCard('Chemical Resistance', '',
    `Expose to: engine oil, brake fluid, battery acid, cleaning agents (24h contact). No seal compromise. Inspect labelling legibility.`)}
</div>`;
}

/* ════════════════════════
   🔩 MECHANICAL
   ════════════════════════ */
function bt_mechanical(c) {
  const vibProfile = ['Excavator','WheelLoader','AgTractor','Truck'].includes(c.app)
    ? 'per applicable standard Profile IV (off-highway)' : 'per applicable standard Profile I/II (road)';
  const crushForce = Math.max(100, c.egross * 3).toFixed(0);

  return `
<div class="bt-section-title">📐 Mechanical Calculations</div>
<div class="card" style="margin-bottom:16px">
  ${btr('Crush force (per applicable standard,    `max(100, E_gross × 3)`,     crushForce,  'kN')}
  ${btr('Vibration profile',          'Application type',           vibProfile,  '')}
  ${btr('Shock severity',             'Half-sine 30g / 11ms',       '30g · 11ms','', 'per applicable standard')}
  ${btr('Drop height',                'per applicable standard',                '1.0m',      '', '6 faces + 2 edges')}
  ${btr('Post-test isolation min',    '100 Ω/V × V_max',           (c.vmax*100/1000).toFixed(0)+'kΩ','')}
</div>

<div class="bt-section-title">🧪 Test Matrix</div>
<div class="bt-cols">
  ${btCard('Random Vibration',vibProfile,
    `3-axis, 5–200Hz, 0.01–1.0g²/Hz, 8–21h per axis. Monitor for leakage, connectivity loss, BMS fault.`,
    'Post-test: full capacity check + IR + isolation. Any >3% capacity drop = FAIL.')}

  ${btCard('Mechanical Shock', '',
    `Half-sine 30g / 11ms, 3 axes ± (18 pulses total). No damage, no BMS fault, no leakage. Isolation ≥ 100Ω/V post-test.`)}

  ${btCard('Crush / Deformation', '',
    `${crushForce}kN or 30% deformation or 25% voltage drop — whichever first. Charged state (100%SoC). No fire, no explosion.`,
    undefined, undefined, 'Requires specialist crush rig. Blast-proof cell mandatory.')}

  ${btCard('Drop Test', '',
    `1.0m onto concrete: 6 faces + 2 edges. Inspect leakage, deformation. Isolation ≥ 100Ω/V. Full functional check post-drop.`)}

  ${btCard('Nail Penetration', '',
    `3mm steel nail at 80mm/s through largest cell face. 100%SoC. T_cell < 500°C at penetration point. No fire, no explosion.`,
    `${c.chem}LFP: typically passes without fire. NMC: thermal runaway risk — verify TRP propagation.`,undefined,
    `${c.chem.includes('NMC')?'⚠ NMC: Pre-alert lab. TRP propagation test may be required immediately after.':''}`)}

  ${btCard('Mounting & Fatigue','',
    `1.5× design torque on all mounting points. 10⁶ cycles at ±50% design load. No crack, no loosening, no BMS fault.`)}
</div>`;
}

/* ════════════════════════
   💥 ABUSE
   ════════════════════════ */
function bt_abuse(c) {
  return `
<div class="bt-section-title">💥 Abuse Test Calculations</div>
<div class="card" style="margin-bottom:16px">
  ${btr('Overcharge voltage',       `1.2 × V_max = 1.2 × ${c.vmax}V`, (1.2*c.vmax).toFixed(0), 'V pack')}
  ${btr('Short-circuit test R',     'External resistance',             '5 mΩ', '', 'per applicable standard')}
  ${btr('BMS interrupt time',       'From short detected to open',     '≤ 500 ms', '')}
  ${btr('TR warning time (GB38031)','Occupant evacuation time',        '≥ 5 min', '')}
  ${btr('Over-discharge voltage',   'Force to 0V per cell',           '0V', '', 'per applicable standard §7.3.3')}
</div>

<div class="bt-section-title">🧪 Test Matrix</div>
<div class="bt-cols">
  ${btCard('Overcharge', '',
    `Charge at 1C to 1.2×V_max (${(1.2*c.vmax).toFixed(0)}V). BMS must disconnect before venting. No fire, no explosion. Gas sensor monitoring.`,
    undefined, undefined, 'Highest thermal risk test. Fume extraction + fire suppression standby mandatory.')}

  ${btCard('Over-Discharge', '',
    `Force discharge to 0V/cell. BMS must trip at V_min (${c.vcell_min}V/cell). Post-test: charge to 50%SoC — no gas. ${c.chem} copper dissolution risk monitored.`)}

  ${btCard('External Short Circuit', '',
    `Short via 5mΩ at 100%SoC and 60°C. BMS must interrupt within 500ms. No fire, no explosion, no sustained arc. Fuse must clear I_sc.`,
    'Use fusible link + current clamp to verify peak short-circuit current ≤ fuse interrupt rating.')}

  ${btCard('Thermal Runaway Propagation', '',
    `Single-cell trigger. Monitor propagation. Warning to occupant within 5 min. No explosion for ≥ 5 min. Gas analysis during and after.`,
    undefined, undefined, 'Mandatory for EU/CN/US market approval. Test in explosion-proof facility.')}

  ${btCard('Forced Thermal Runaway (nail)', '',
    `Nail penetration per Mechanical test. Monitor propagation to adjacent cells. All certification markets require this or equivalent trigger method.`)}

  ${btCard('Fire Resistance (FMVSS 305)', '',
    `Expose pack to standardised fire (propane/fuel pool). Pack must not explode. Electrolyte containment required. US market only.`)}
</div>`;
}

/* ════════════════════════
   📡 EMI/EMC
   ════════════════════════ */
function bt_emi_emc(c) {
  return `
<div class="bt-section-title">📡 EMI/EMC Test Parameters
  <span style="font-size:10px;font-family:var(--mono);color:var(--text3);font-weight:400;margin-left:8px">
    Limits and severity levels are market-specific — link from
    <span onclick="try{switchTopTab('standards',document.getElementById('ttab-standards'))}catch(e){}"
      style="color:var(--b);cursor:pointer;text-decoration:underline">Standards tab</span>
  </span>
</div>
<div class="card" style="margin-bottom:16px">
  ${btr('Radiated emissions', 'Market: ' + c.markets, 'See Standards tab', '', 'class per market')}
  ${btr('ESD air discharge',   '', 'See Standards tab', '')}
  ${btr('ESD contact discharge','', 'See Standards tab', '')}
  ${btr('Load dump (LV bus)',   '', 'See Standards tab', '')}
  ${btr('BCI injection level',  '', 'See Standards tab', '')}
  ${btr('Conducted emissions',  '', 'See Standards tab', '')}
</div>

<div class="bt-section-title">🧪 Test Matrix</div>
<div class="bt-cols">
  ${btCard('Radiated Emissions', '',
    `Measure RF from BMS/DC-DC during discharge cycle at system level. Test in semi-anechoic chamber with vehicle harness simulator. Limits from Standards tab.`,
    'BMS PWM frequencies (20–200kHz) generate harmonics — EMI filter on BMS supply line recommended.')}

  ${btCard('Bulk Current Injection (BCI)', '',
    `RF injection onto HV cable harness over 1–400MHz. No false OVP/UVP trip, no CAN error frame during injection. Severity level per market standard.`)}

  ${btCard('ESD Immunity', '',
    `Test all exposed connectors and mounting points. No permanent damage, no BMS reset. Latch-up recovery &lt; 5s. Level per market standard.`)}

  ${btCard('Load Dump', '',
    `LV bus transient. No damage to BMS, BCM, LV circuits. Transient suppressor response &lt; 1μs. Voltage/duration per applicable standard.`)}

  ${btCard('Conducted Emissions (LV)', '',
    `Measure conducted noise on 12V LV bus from DC-DC converter. Add common-mode choke if over limit. Limits from Standards tab.`)}

  ${btCard('Surge Immunity', '',
    `Line-to-earth and line-to-line on power inputs. No damage, no functional failure. Pulse count and levels per applicable standard.`)}
</div>

<!-- Frequency sweep canvas -->
<div class="bt-section-title">📊 EMI Frequency Sweep Concept</div>
<canvas id="bt_emi_canvas" height="180" style="width:100%;display:block;border-radius:8px;background:var(--bg);margin-bottom:12px"></canvas>`;
}

/* ════════════════════════
   🏅 CERTIFICATION
   ════════════════════════ */
function bt_certification(c) {
  const mkts = c.markets;
  const eu = mkts.includes('EU');
  const us = mkts.includes('US');
  const cn = mkts.includes('CN') || mkts.includes('CHINA');
  const in_ = mkts.includes('IN') || mkts.includes('INDIA');
  const isOH = ['Excavator','WheelLoader','AgTractor','Truck'].includes(c.app);

  // Certification requirements — dynamic from project markets
  // Specific clause numbers and test levels link to Standards tab
  const reqs = [
    {reg:'Transport Safety',     body:'UN',    scope:'Transport (all markets)', mandatory:true,  note:'All markets. Cell + pack level. See Standards tab for test sequence.'},
    {reg:'Traction Battery Safety', body:'IEC', scope:'Safety for traction/stationary', mandatory:true, note:'Required for CE. See Standards tab for applicable version.'},
    eu ?{reg:'EU EV REESS',      body:'UNECE', scope:'EU market — EV REESS',     mandatory:true,  note:'Part I: electrical safety. Part II: isolation, TR. Standards tab.'}:null,
    us ?{reg:'EV Battery (US)',   body:'UL/NHTSA', scope:'US market',            mandatory:true,  note:'UL + FMVSS requirements. Standards tab for details.'}:null,
    cn ?{reg:'EV Battery (CN)',   body:'MIIT',  scope:'China mandatory',          mandatory:true,  note:'TR propagation requirements. GB standards — see Standards tab.'}:null,
    in_?{reg:'EV Battery (IN)',   body:'MoRTH', scope:'India — automotive EV',   mandatory:true,  note:'AIS standards. See Standards tab.'}:null,
    isOH?{reg:'Functional Safety', body:'ISO',  scope:'Off-highway FuSa',        mandatory:true,  note:`FuSa level: ${c.ip}. BMS safety function. Standards tab.`}:null,
    {reg:'Cell-level Safety',    body:'IEC',   scope:'Li cell safety',           mandatory:false, note:'Cell-level cert. Often required by OEM procurement.'},
    {reg:'Global Technical Reg', body:'UN',    scope:'EVS-GTR — global',         mandatory:eu,    note:'TR warning mandatory. Standards tab.'},
  ].filter(Boolean);

  const rows = reqs.map(r=>`<tr style="${r.mandatory?'background:rgba(0,212,170,.03)':''}">
    <td style="font-weight:700;font-size:12px;color:${r.mandatory?'var(--g)':'var(--text2)'}">${r.reg}</td>
    <td style="font-size:11px">${r.body}</td>
    <td style="font-size:11px">${r.scope}</td>
    <td style="text-align:center">${r.mandatory?'<span style="color:var(--g);font-weight:700">✓ REQ</span>':'<span style="color:var(--text3)">Optional</span>'}</td>
    <td style="font-size:11px;color:var(--text3)">${r.note}</td>
  </tr>`).join('');

  return `
<div class="bt-section-title">🏅 Required Certifications — ${mkts}
  <span style="font-size:10px;font-family:var(--mono);color:var(--text3);font-weight:400;margin-left:8px">
    Specific standards, revisions and test levels →
    <span onclick="try{switchTopTab('standards',document.getElementById('ttab-standards'))}catch(e){}"
      style="color:var(--b);cursor:pointer;text-decoration:underline">Standards tab</span>
  </span>
</div>
<div style="overflow-x:auto;margin-bottom:16px">
<table class="res-tbl">
  <thead><tr><th>Requirement</th><th>Body</th><th>Scope</th><th>Status</th><th>Notes</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</div>

<div class="bt-section-title">📋 Transport Safety Test Sequence (Mandatory — All Markets)</div>
<div class="bt-cols">
  ${['T1: Altitude simulation','T2: Thermal cycling','T3: Vibration (3 axes)','T4: Shock (3 axes)','T5: External short circuit','T6: Impact/crush','T7: Overcharge','T8: Forced discharge'].map((t,i)=>`
    <div class="bt-card" style="padding:12px">
      <div style="font-size:11px;font-weight:700;color:var(--b)">${t}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px">
        Sequential — must pass all 8. Cell + pack level separately.
        <span onclick="try{switchTopTab('standards',document.getElementById('ttab-standards'))}catch(e){}"
          style="color:var(--b);cursor:pointer">See Standards tab for limits.</span>
      </div>
    </div>`).join('')}
</div>

<div class="ico-banner" style="margin-top:14px">
  📌 Markets: ${mkts} · Certification path based on project targets.
  Full standard details, revision years and clause references are in the
  <span onclick="try{switchTopTab('standards',document.getElementById('ttab-standards'))}catch(e){}"
    style="color:var(--b);cursor:pointer;font-weight:700">Standards tab →</span>
</div>`;
}

/* ════════════════════════
   🧰 EQUIPMENT
   ════════════════════════ */
function bt_equipment(c) {
  const sections = [
    { title:'⚡ Electrical Test Equipment', color:'#4a9eff', items:[
      'Battery cycler — Arbin BT2000, Bitrode FTF, AVL E-Storage (4Q)',
      `HV power supply — 0–${Math.max(1000,c.vmax+100)}V DC, ${c.imax}A+ capability`,
      'Electronic load — programmable CC/CV/CR/CP modes',
      'Precision current shunt — ±0.1% accuracy, 4-wire Kelvin',
      'Oscilloscope — 4ch, ≥200MHz, isolated probes (1kV rated)',
      'Data acquisition (DAQ) — NI cDAQ or similar, ≥16ch, 1kHz min',
      'Insulation tester (Megger) — 500V / 1000V DC output',
      'Hi-pot tester — AC up to 5kV, DC up to 7kV',
      'CAN/LIN analyser — Vector CANalyzer, PEAK PCAN',
      'Calibration tools — INCA, CANoe for BMS calibration',
    ]},
    { title:'🔴 HV Safety Equipment', color:'#ef4444', items:[
      `HV insulated gloves — Class 00/0 (≤${c.vmax}V), leather protectors`,
      'Full face shield — arc flash rated ≥ 8 cal/cm²',
      'Lockout-Tagout (LOTO) — lockout hasps + lockout tags',
      'HV warning signs — EN per applicable standard W012 (lightning bolt)',
      'Rescue hook — non-conductive fibreglass, 1.2m minimum',
      'Portable HV voltmeter — CAT III 1000V rated',
      'Anti-static mat + wrist strap — ESD work area',
      'Emergency stop button — accessible from outside test cell',
    ]},
    { title:'🌡️ Thermal & Cooling Equipment', color:'#ff7b35', items:[
      `Thermal chamber — ${c.top_lo}°C to ${Math.max(c.top_hi,85)}°C, ±1°C accuracy`,
      'Coolant test loop — variable flow 0–30 L/min, glycol-water circuit',
      'Flow meters — Coriolis or turbine, ±0.5% accuracy',
      `Thermal imaging camera — FLIR T860 or A655, ≥0.05°C resolution`,
      'K-type thermocouples — ±1°C, min 8 channels per module',
      'Chiller unit — programmable T_in, −40°C to +80°C range',
      'Pressure sensors — coolant inlet/outlet, 0–5 bar absolute',
    ]},
    { title:'🔩 Mechanical & Environmental', color:'#6d8fba', items:[
      'Vibration shaker — 3-DOF or 6-DOF, 50kN+ force, 5–2000Hz',
      'Shock test machine — up to 150g, programmable pulse shape',
      'Drop test rig — guided fall from 1.0m, all face/edge configurations',
      `IP test chamber — IP6X dust, IPX7 water immersion (1m/30min)`,
      'Salt spray chamber — 5% NaCl, 35°C, programmable duration',
      'Humidity chamber — 10–95%RH, −40°C to +120°C',
      'Crush/nail penetration rig — 100kN hydraulic, blast shield',
    ]},
    { title:'💥 Abuse Testing Setup', color:'#ef4444', items:[
      'Explosion-proof test cell — blast-rated walls, pressure relief',
      'Gas analysis system — CO, CO₂, H₂, HF monitoring',
      'Fire suppression system — CO₂ or dry powder, auto-trigger',
      'High-speed camera — ≥1000fps for arc/venting capture',
      'Fume extraction — negative pressure, HF-rated scrubber',
      'Remote monitoring — all data logged via isolated DAQ',
    ]},
    { title:'📡 EMI/EMC Equipment', color:'#a78bfa', items:[
      'Semi-anechoic chamber — 3m or 10m range, 30MHz–1GHz min',
      'EMI receiver / spectrum analyser — R&S FSW or Keysight',
      'LISN — Line Impedance Stabilisation Network, 50μH',
      'ESD gun — Teseq NSG435, ±30kV, contact + air modes',
      'BCI clamp — Teseq CBA 400, 1–400MHz',
      'Antenna set — biconical, log-periodic, horn (30MHz–18GHz)',
      'EMI pre-compliance scanner — for lab pre-screening',
    ]},
  ];

  return sections.map(s=>`
    <div class="bt-sec-hdr" style="color:${s.color}">${s.title}</div>
    <div class="bt-card" style="margin-bottom:12px">
      <ul style="margin:0;padding-left:16px;line-height:2">
        ${s.items.map(i=>`<li style="font-size:12px;color:var(--text2)">${i}</li>`).join('')}
      </ul>
    </div>`).join('');
}

/* ════════════════════════
   📜 GLOBAL STANDARDS
   ════════════════════════ */


/* ── Canvas chart renderer ── */
function bt_drawCharts(catId, c) {
  if (catId === 'electrical') {
    const cv = document.getElementById('bt_elec_canvas');
    if (!cv) return;
    const W=cv.offsetWidth||700, H=180;
    cv.width=W; cv.height=H;
    const ctx=cv.getContext('2d');
    /* Nyquist sketch */
    const R0=c.ir_bol*0.55*c.S_total/c.c_pp;
    const Rct=c.ir_bol*0.38*c.S_total/c.c_pp;
    const pad={l:56,r:20,t:16,b:32};
    const pw=W-pad.l-pad.r, ph=H-pad.t-pad.b;
    const mx=x=>pad.l+(x/(R0+Rct)*1.8)*pw/2;
    const my=y=>pad.t+ph*(0.5+y/(Rct*0.6));
    ctx.fillStyle='#07080b'; ctx.fillRect(0,0,W,H);
    /* Grid */
    ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;
    [0,.5,1].forEach(f=>{
      ctx.beginPath();ctx.moveTo(pad.l,pad.t+ph*f);ctx.lineTo(W-pad.r,pad.t+ph*f);ctx.stroke();
    });
    /* Nyquist curve */
    const pts2=[];
    pts2.push({x:R0+Rct*1.8,y:0});
    for(let k=20;k>=0;k--) {
      const a=Math.PI*k/20;
      pts2.push({x:R0+Rct/2+Math.cos(a)*Rct/2, y:Math.sin(a)*Rct*0.55});
    }
    for(let k=1;k<=10;k++) pts2.push({x:R0+Rct+k*Rct*0.15,y:k*Rct*0.15});
    ctx.beginPath();ctx.strokeStyle='#4a9eff';ctx.lineWidth=2.5;
    pts2.forEach((p,i)=>i===0?ctx.moveTo(mx(p.x),my(-p.y)):ctx.lineTo(mx(p.x),my(-p.y)));
    ctx.stroke();
    /* Labels */
    [[R0,0,'R0 (ACIR)','#00d4aa'],[R0+Rct,0,'DCIR 10s','#f5c518']].forEach(([x,y,l,col])=>{
      ctx.fillStyle=col;ctx.beginPath();ctx.arc(mx(x),my(-y),4,0,Math.PI*2);ctx.fill();
      ctx.font='9px JetBrains Mono,monospace';ctx.fillText(l,mx(x)+6,my(-y)-4);
    });
    ctx.fillStyle='#4a6080';ctx.font='10px JetBrains Mono,monospace';ctx.textAlign='center';
    ctx.fillText('Re(Z) — Pack Impedance (mΩ) · Nyquist EIS concept',pad.l+pw/2,H-4);
  }

  if (catId === 'thermal') {
    const cv=document.getElementById('bt_therm_canvas');
    if (!cv) return;
    const W=cv.offsetWidth||700, H=200;
    cv.width=W; cv.height=H;
    const ctx=cv.getContext('2d');
    ctx.fillStyle='#07080b';ctx.fillRect(0,0,W,H);
    const pad={l:50,r:20,t:16,b:32};
    const pw=W-pad.l-pad.r, ph=H-pad.t-pad.b;
    /* Simulated T rise */
    const R_pack=(c.ir_bol*c.S_total/c.c_pp)*1e-3;
    const Qgen=Math.pow(c.imax,2)*R_pack;
    const mass=c.qpack*c.S_total*c.c_pp*2.8/1000;
    const Cp=950;
    const ua_tms=580; // W/K typical liquid cooling
    const Tamb=c.top_hi;
    const Ts=[],Ts_no=[],times=[];
    let T=Tamb, Tno=Tamb;
    for(let t=0;t<=3600;t+=30){
      times.push(t);Ts.push(T);Ts_no.push(Tno);
      const dT_gen=Qgen/(mass*Cp)*30;
      const dT_cool=ua_tms*(T-Tamb)/(mass*Cp)*30;
      const dT_amb=(T-Tamb)*15/(mass*Cp)*30;
      T=T+dT_gen-dT_cool;
      Tno=Tno+dT_gen-dT_amb;
      if(T<Tamb)T=Tamb; if(Tno<Tamb)Tno=Tamb;
    }
    const Tmin=Tamb,Tmax=Math.max(...Ts_no,c.tcell+5);
    const mx=(t)=>pad.l+(t/3600)*pw;
    const my2=(T)=>pad.t+ph*(1-(T-Tmin)/(Tmax-Tmin));
    /* Grid */
    ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;
    [0,.25,.5,.75,1].forEach(f=>{
      const y=pad.t+ph*f;
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
      ctx.fillStyle='#3a567a';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='right';
      ctx.fillText((Tmin+(Tmax-Tmin)*(1-f)).toFixed(0)+'°C',pad.l-3,y+3);
    });
    /* Thresholds */
    [c.tcell-10,c.tcell].forEach((T,i)=>{
      const y=my2(T);
      ctx.strokeStyle=i===0?'rgba(245,197,24,.4)':'rgba(255,77,109,.4)';
      ctx.lineWidth=1;ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=i===0?'#f5c518':'#ff4d6d';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='left';
      ctx.fillText(i===0?'Derate '+T+'°C':'Cutoff '+T+'°C',pad.l+4,y-3);
    });
    /* TMS off */
    ctx.beginPath();ctx.strokeStyle='#ff7b35';ctx.lineWidth=2;
    Ts_no.forEach((T,i)=>i===0?ctx.moveTo(mx(times[i]),my2(T)):ctx.lineTo(mx(times[i]),my2(T)));
    ctx.stroke();
    /* TMS on */
    ctx.beginPath();ctx.strokeStyle='#00d4aa';ctx.lineWidth=2;
    Ts.forEach((T,i)=>i===0?ctx.moveTo(mx(times[i]),my2(T)):ctx.lineTo(mx(times[i]),my2(T)));
    ctx.stroke();
    ctx.fillStyle='#4a6080';ctx.font='10px JetBrains Mono,monospace';ctx.textAlign='center';
    ctx.fillText('T_cell vs Time · Green=liquid cooling · Orange=no cooling · I_peak='+c.imax+'A',pad.l+pw/2,H-4);
  }

  if (catId === 'emi_emc') {
    const cv=document.getElementById('bt_emi_canvas');
    if (!cv) return;
    const W=cv.offsetWidth||700, H=180;
    cv.width=W; cv.height=H;
    const ctx=cv.getContext('2d');
    ctx.fillStyle='#07080b';ctx.fillRect(0,0,W,H);
    const pad={l:52,r:20,t:16,b:32};
    const pw=W-pad.l-pad.r, ph=H-pad.t-pad.b;
    /* Log frequency axis: 100kHz to 1GHz */
    const fmin=5,fmax=9; // log10 of Hz
    const mx=f=>pad.l+(Math.log10(f)-fmin)/(fmax-fmin)*pw;
    const my3=v=>pad.t+ph*(1-Math.min(1,Math.max(0,(v-20)/60)));
    /* per applicable standard Class 5 limit line */
    const limit=[[150e3,66],[30e6,40],[300e6,33],[1e9,33]];
    ctx.beginPath();ctx.strokeStyle='rgba(255,77,109,.5)';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);
    limit.forEach((p,i)=>i===0?ctx.moveTo(mx(p[0]),my3(p[1])):ctx.lineTo(mx(p[0]),my3(p[1])));
    ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,77,109,.5)';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='left';
    ctx.fillText('per applicable standard Class 5 limit',mx(1e6),my3(46));
    /* Simulated emissions */
    const drawEmissions=(col,noise,peaks)=>{
      ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=1.5;
      for(let k=0;k<=200;k++){
        const logf=fmin+(fmax-fmin)*k/200;
        const f=Math.pow(10,logf);
        let v=noise+Math.random()*3;
        peaks.forEach(([pf,pa])=>{if(Math.abs(logf-Math.log10(pf))<0.05) v=Math.max(v,pa+Math.random()*4);});
        k===0?ctx.moveTo(mx(f),my3(v)):ctx.lineTo(mx(f),my3(v));
      }
      ctx.stroke();
    };
    drawEmissions('rgba(74,158,255,.6)',22,[[20e3,38],[40e3,36],[100e3,42],[1e6,35]]);
    /* Freq labels */
    [1e5,1e6,1e7,1e8,1e9].forEach(f=>{
      const x=mx(f);
      ctx.fillStyle='#3a567a';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='center';
      const lbl=f>=1e9?'1GHz':f>=1e6?(f/1e6).toFixed(0)+'M':f>=1e3?(f/1e3).toFixed(0)+'k':'';
      ctx.fillText(lbl,x,H-pad.b+12);
    });
    ctx.fillStyle='#4a6080';ctx.font='10px JetBrains Mono,monospace';ctx.textAlign='center';
    ctx.fillText('EMI Scan — dBμV vs Frequency (Hz log scale) · Blue=measured · Red=per applicable standard limit',pad.l+pw/2,H-4);
  }
}

/* ── Hook switchTopTab and showSec ── */
(function() {
  const _st = window.switchTopTab;
  window.switchTopTab = function(tabId, btn) {
    if (typeof _st==='function') _st(tabId,btn);
    if (tabId==='testing') setTimeout(()=>{try{renderBatteryTesting(window._bt_active_cat);}catch(e){}},80);
  };
  const _pp = window.propagate;
  window.propagate = function() {
    if (typeof _pp==='function') _pp.apply(this,arguments);
    try { if(document.getElementById('panel-testing')?.classList.contains('active')) renderBatteryTesting(window._bt_active_cat); } catch(e) {}
  };
})();
