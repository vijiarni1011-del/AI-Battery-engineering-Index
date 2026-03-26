/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — BATTERY TESTING  v3.0
   Complete rewrite: calculations, charts, standards, equipment
   ═══════════════════════════════════════════════════════════════ */

const BT_CATS = [
  { id:'electrical',    icon:'⚡', label:'Electrical',       color:'#4a9eff' },
  { id:'thermal',       icon:'🌡️', label:'Thermal & Cooling', color:'#ff7b35' },
  { id:'performance',   icon:'🚀', label:'Performance',      color:'#00d4aa' },
  { id:'environmental', icon:'🌍', label:'Environmental',    color:'#00b891' },
  { id:'mechanical',    icon:'🔩', label:'Mechanical',       color:'#6d8fba' },
  { id:'abuse',         icon:'💥', label:'Abuse & Safety',   color:'#ef4444' },
  { id:'emi_emc',       icon:'📡', label:'EMI/EMC',          color:'#a78bfa' },
  { id:'certification', icon:'🏅', label:'Certification',    color:'#fbbf24' },
  { id:'equipment',     icon:'🧰', label:'Equipment',        color:'#94a3b8' },
  { id:'standards',     icon:'📜', label:'Standards',        color:'#60a5fa' },
];

function bt_ctx() {
  const S = window.S || {};
  return {
    app:    S.app || '4W',
    chem:   (S.c_chem||'NMC').split(' ')[0].toUpperCase(),
    vnom:   +(S.V_nom_pack||400).toFixed(0),
    vmax:   +(S.V_max_pack||420).toFixed(0),
    vmin:   +(S.V_min_pack||280).toFixed(0),
    vcell_max: +(S.c_vmax||4.2).toFixed(2),
    vcell_min: +(S.c_vmin||2.8).toFixed(2),
    egross: +(S.E_gross||43).toFixed(1),
    euse:   +(S.E_usable||38).toFixed(1),
    ppeak:  +(S.t_ppeak||80),
    pcont:  +(S.t_pcont||50),
    imax:   S.t_ppeak ? +(S.t_ppeak*1000/(S.V_nom_pack||400)).toFixed(0) : 200,
    icont:  S.t_pcont ? +(S.t_pcont*1000/(S.V_nom_pack||400)).toFixed(0) : 130,
    ichg:   +(S.t_imax_chg||120),
    sxp:    `${S.S_total||112}S / ${S.c_pp||1}P`,
    qpack:  +(S.Q_pack||120).toFixed(0),
    top_lo: +(S.t_top_lo??-20),
    top_hi: +(S.t_top_hi??55),
    tcell:  +(S.t_tcell_max??60),
    ip:     S.t_ip || 'IP67',
    markets:(S.markets||'EU, US').toUpperCase(),
    cycles: +(S.t_cycles||3000),
    years:  +(S.t_years||10),
    soh_eol:+(S.t_soh_eol||80),
    ir_bol: +(S.c_ir_bol||0.22),
    S_total:+(S.S_total||112),
    c_pp:   +(S.c_pp||1),
    ah:     +(S.c_ah||120),
  };
}

window.renderBatteryTesting = function(catId) {
  const root = document.getElementById('bt_root');
  if (!root) return;
  catId = catId || window._bt_active_cat || 'electrical';
  window._bt_active_cat = catId;
  const cat = BT_CATS.find(c=>c.id===catId) || BT_CATS[0];
  const ctx = bt_ctx();

  const subnav = BT_CATS.map(c=>`
    <button onclick="renderBatteryTesting('${c.id}')"
      style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:var(--sans);transition:all .15s;
        background:${c.id===catId?c.color+'18':'transparent'};
        color:${c.id===catId?c.color:'var(--text2)'};
        border:1px solid ${c.id===catId?c.color+'40':'transparent'}">
      <span style="font-size:13px">${c.icon}</span>${c.label}
    </button>`).join('');

  const ctx_strip = [
    ['App',ctx.app],['Chemistry',ctx.chem],['Config',ctx.sxp],
    ['V_nom',ctx.vnom+'V'],['V_max',ctx.vmax+'V'],['E_gross',ctx.egross+'kWh'],
    ['P_peak',ctx.ppeak+'kW'],['I_peak',ctx.imax+'A'],['T_op',ctx.top_lo+'→'+ctx.top_hi+'°C'],
    ['IP',ctx.ip],['Markets',ctx.markets]
  ].map(([k,v])=>`<div style="display:flex;gap:4px;align-items:center;background:var(--bg4);border:1px solid var(--border2);border-radius:5px;padding:3px 8px">
    <span style="font-size:9px;font-family:var(--mono);color:var(--text3)">${k}</span>
    <span style="font-size:11px;font-family:var(--mono);color:var(--teal);font-weight:700">${v}</span>
  </div>`).join('');

  root.innerHTML = `
<style>
.bt-card{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px}
.bt-card:hover{border-color:var(--border2)}
.bt-formula{font-family:var(--mono);font-size:12px;background:var(--bg4);border-left:3px solid var(--teal);padding:8px 12px;border-radius:0 6px 6px 0;margin:8px 0;color:var(--text2)}
.bt-calc-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)}
.bt-calc-row:last-child{border:none}
.bt-tip{background:rgba(0,212,170,.06);border-left:3px solid var(--teal);padding:8px 12px;font-size:12px;color:var(--text2);border-radius:0 6px 6px 0;margin-top:8px}
.bt-warn{background:rgba(245,197,24,.06);border-left:3px solid var(--y);padding:8px 12px;font-size:12px;border-radius:0 6px 6px 0;margin-top:8px}
.bt-crit{background:rgba(255,77,109,.06);border-left:3px solid var(--r);padding:8px 12px;font-size:12px;border-radius:0 6px 6px 0;margin-top:8px}
.bt-sec-hdr{font-size:13px;font-weight:700;color:var(--text);margin:20px 0 10px;border-bottom:1px solid var(--border);padding-bottom:6px}
.bt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.bt-std{font-size:10px;font-family:var(--mono);color:var(--text3);padding:2px 7px;background:var(--bg4);border:1px solid var(--border);border-radius:4px;display:inline-block;margin-bottom:8px}
</style>

<div style="display:flex;gap:3px;flex-wrap:wrap;padding:10px 16px;background:var(--bg2);border-bottom:1px solid var(--border)">${subnav}</div>

<div style="display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px;background:var(--bg3);border-bottom:1px solid var(--border);align-items:center">
  <span style="font-size:9px;font-family:var(--mono);color:var(--text3)">PROJECT →</span>
  ${ctx_strip}
  <button onclick="switchTopTab('engineering',document.getElementById('ttab-engineering'));showSec('targets',document.querySelector('.nb'))"
    style="margin-left:auto;padding:3px 10px;background:rgba(74,158,255,.1);border:1px solid rgba(74,158,255,.3);color:var(--b);border-radius:5px;font-size:10px;font-weight:700;cursor:pointer">✏ Edit</button>
</div>

<div style="padding:20px">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)">
    <div style="width:48px;height:48px;border-radius:12px;background:${cat.color}18;border:1px solid ${cat.color}40;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">${cat.icon}</div>
    <div>
      <h2 style="font-family:var(--display);font-size:18px;font-weight:700;color:var(--text)">${cat.label} Testing</h2>
      <div style="font-size:11px;color:var(--text3)">Battery engineer reference · calculations · standards · equipment</div>
    </div>
  </div>
  ${bt_renderCat(cat.id, ctx)}
</div>`;

  /* Draw canvases after DOM update */
  requestAnimationFrame(() => { try { bt_drawCharts(cat.id, ctx); } catch(e) {} });
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
    case 'standards':     return bt_standards_global(c);
    default: return '<div>Select a category</div>';
  }
}

/* ── Helper: calc row ── */
function btr(label, formula, result, unit, note='') {
  return `<div class="bt-calc-row">
    <span style="font-size:12px;color:var(--text2);flex:1.2">${label}</span>
    <span style="font-family:var(--mono);font-size:11px;color:var(--text3);flex:1.5">${formula}</span>
    <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--teal);white-space:nowrap">${result} <span style="font-size:10px;color:var(--text3)">${unit}</span></span>
    ${note?`<span style="font-size:10px;color:var(--text3);margin-left:6px">${note}</span>`:''}
  </div>`;
}

function btCard(title, std, body, tip, warn, crit) {
  return `<div class="bt-card">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">${title}</div>
    ${std?`<span class="bt-std">${std}</span>`:''}
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
<div class="bt-sec-hdr">📐 Calculated Test Parameters</div>
<div class="card" style="margin-bottom:16px">
  ${btr('Pack capacity (test Ah)',         `${c.egross}kWh × 1000 ÷ ${c.vnom}V`,  cap_ah,       'Ah')}
  ${btr('Peak C-rate',                     `${c.imax}A ÷ ${cap_ah}Ah`,             (c.imax/+cap_ah).toFixed(3), 'C')}
  ${btr('Pack DCIR BoL (25°C/50%SoC)',     `${c.ir_bol}mΩ × ${c.S_total}/${c.c_pp}`, R_pack.toFixed(1), 'mΩ')}
  ${btr('Peak ΔV (I²R drop)',             `${R_pack.toFixed(0)}mΩ × ${c.imax}A`, `${Vdrop.toFixed(1)}V (${Vdrop_pct}%)`, '')}
  ${btr('I²R heat @ peak current',        `${c.imax}² × ${R_pack.toFixed(0)}mΩ`, (Q_ir/1000).toFixed(2), 'kW')}
  ${btr('Insulation resistance min',      `100 Ω/V × ${c.vmax}V`,                (IR_ins_min/1000).toFixed(0), 'kΩ', 'ISO 6469-3')}
  ${btr('Round-trip efficiency (est.)',   'E_out / E_in',                          eta, '%')}
</div>

<div class="bt-sec-hdr">⚡ Key Formula Reference</div>
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
    <div class="bt-formula">ISO res = V_pack × 100 Ω/V &nbsp;(min ${IR_ins_min/1000}kΩ)</div>
    <div class="bt-formula">P_max = V × I_cell_max × n_cells</div>
    <div class="bt-formula">Hi-pot: V_test = 2×V_max + 1000 V AC (${(2*c.vmax+1000).toFixed(0)}V)</div>
  </div>
</div>

<div class="bt-sec-hdr">🧪 Test Matrix</div>
<div class="bt-grid">
  ${btCard('Capacity & Energy (CC-CV discharge)','IEC 62660-1:2010 §5 · ISO 12405-4 §8',
    `Discharge at C/3 from ${c.vmax}V → ${c.vmin}V at 25°C, 0°C, 45°C. 3 stabilisation cycles. Target ≥ ${cap_ah} Ah, ${c.egross} kWh.`,
    'Use calibrated ±0.1% shunt. Log voltage, current, temperature at 1Hz minimum.',
    `${c.chem}: ≥ ${(+cap_ah*0.95).toFixed(0)} Ah at 0°C expected. Flag if <90% of 25°C capacity.`)}

  ${btCard('DCIR — 10s Pulse Method','IEC 62660-2:2011 §5 · USABC HPPC',
    `1C pulse (${c.imax.toFixed(0)}A) for 10s from 50%SoC. DCIR = ΔV/ΔI. Test at -20°C, -10°C, 0°C, 10°C, 25°C, 45°C, 55°C and SoC 0/20/50/80/100%.`,
    `Sample at 10ms resolution during pulse. Log pre-pulse OCV and post-pulse relaxation voltage.`,
    'Upload results to DCIR Map tab to generate full heatmap.')}

  ${btCard('Insulation Resistance (IR Test)','ISO 6469-3:2021 §6.4 · IEC 60664',
    `500V DC insulation tester between all HV conductors and chassis. Min ${(IR_ins_min/1000).toFixed(0)} kΩ (100 Ω/V × ${c.vmax}V). Test before and after water ingress, vibration, thermal cycle.`,
    undefined,
    `Result < 50 Ω/V = CRITICAL FAIL — electrocution risk. Do not continue testing.`)}

  ${btCard('Dielectric Withstand (Hi-Pot)','IEC 60664-1:2020 · ISO 6469-3',
    `Apply ${(2*c.vmax+1000).toFixed(0)}V AC (or ${(1.4*(2*c.vmax+1000)).toFixed(0)}V DC) for 60s between HV and chassis. Zero breakdown allowed. Pre-condition at 40°C/93%RH for 24h.`,
    'Ramp voltage at 500V/s. Monitor leakage current — alarm at >1mA.`')}

  ${btCard('HV Interlock Loop (HVIL)','ISO 26262 · IEC 62619 §7',
    `Verify HVIL circuit opens within 200ms of connector separation. Contactors must de-energise. No HV access possible when HVIL open. Test all connector states.`)}

  ${btCard('BMS Overvoltage Protection','IEC 62619:2022 §7.2',
    `Force cell to ${c.vcell_max+0.1}V. BMS must trip contactor within 500ms. No venting. Pack OVP threshold: ${(c.vcell_max+0.02).toFixed(3)}V/cell = ${((c.vcell_max+0.02)*c.S_total).toFixed(1)}V pack.`)}

  ${btCard('LV System Validation (12/24V)','ISO 16750-2:2023 · LV 124',
    `Normal: 9–16V (12V system). Cranking: 6V for 40ms. Load dump: 24V for 400ms. BMS must remain functional. Test at -40°C and +85°C.`,
    'Verify BMS wakeup at 6V cranking voltage — MCU brownout common failure mode.')}

  ${btCard('Self-Discharge','IEC 62660-1 §8',
    `Charge to 100%SoC. Rest 30 days at 25°C. Measure remaining SoC. Target <3%/month loss.`,
    'Log individual cell voltages via BMS — outlier cell (>2× average loss) indicates leakage path.')}
</div>

<!-- PSD / Frequency chart canvas placeholder -->
<div class="bt-sec-hdr">📡 ACIR / EIS Measurement Approach</div>
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
<div class="bt-sec-hdr">📐 Thermal Calculations</div>
<div class="card" style="margin-bottom:16px">
  ${btr('I²R heat generation @ I_peak',    `${c.imax}² × ${R_pack.toFixed(0)}mΩ`,           (Q_gen/1000).toFixed(2),     'kW')}
  ${btr('Adiabatic T-rise rate (no TMS)',  `Q/(m×Cp) = ${(Q_gen).toFixed(0)}W÷(${mass_est.toFixed(0)}kg×${Cp_est}J/kg·K)`, dTdt_adiab.toFixed(2), '°C/min', 'no cooling')}
  ${btr('Coolant flow needed (ΔT=10°C)',   `Q/(ρ×Cp×ΔT) = ${(Q_gen/1000).toFixed(1)}kW`,     flow_est.toFixed(1),         'L/min')}
  ${btr('TMS activation threshold',        `T_cell > T_derate - 10°C`,                        `${c.tcell-10}°C`,            '')}
  ${btr('Thermal runaway onset (typical)', 'Chemistry dependent',                              `${c.chem==='LFP'?130:180}°C`, '', `${c.chem} cell`)}
  ${btr('Hi-pot pre-condition (humidity)', '40°C / 93% RH / 24h',                             '40°C + 93%RH',               '', 'IEC 60664')}
</div>

<div class="bt-sec-hdr">📈 Key Thermal Formulae</div>
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

<div class="bt-sec-hdr">🧪 Test Matrix</div>
<div class="bt-grid">
  ${btCard('Cell Temperature Distribution','IEC 62660-2:2011 §7 · ISO 12405-3',
    `1C continuous discharge. Map T_cell via TC array (min 8 TCs: centre, edge, near inlet/outlet). ΔT_pack target ≤ ${c.tcell>55?5:8}°C. Identify hotspot location.`,
    'Place IR camera above pack for 2D thermal mapping. Log at 1Hz minimum.')}

  ${btCard('TMS Cooling Performance','Application-specific TMS spec',
    `At P_cont = ${c.pcont}kW, coolant inlet = ${c.top_hi}°C, verify T_cell_max < ${c.tcell}°C at steady state within 60min. Measure coolant ΔT across pack.`,
    `Coolant flow needed ≈ ${flow_est.toFixed(0)} L/min for this pack based on ${(Q_gen/1000).toFixed(1)}kW I²R heat.`)}

  ${btCard('Cold Soak Start-Up','ISO 12405-3:2014 §7',
    `Soak at ${c.top_lo}°C for 8h. Immediate 1C discharge. Verify BMS cold-derating, TMS pre-heat. Monitor DCIR — expect ${c.top_lo<=-20?'4–8×':'2–3×'} nominal.`,
    `${c.chem === 'LFP' ? 'LFP: flat OCV at low T makes SoC estimation unreliable — use Ah-count only below 5°C.' : 'NMC: lithium plating risk below 0°C charge. Limit to C/10 below 0°C.'}`)}

  ${btCard('Thermal Runaway Propagation','IEC 62619:2022 §7.3.5 · UN GTR 20 §8.4',
    `Trigger single-cell TR (nail or resistive heater). Monitor propagation. Pack must not explode. Occupant warning within 5 min. No sustained fire (GB 38031: 5min minimum).`,
    undefined, undefined,
    'Highest criticality test. Requires blast shield, gas monitoring, fire suppression standby. Notify lab minimum 2 weeks ahead.')}

  ${btCard('Cooling Plate Efficiency','OEM TMS spec',
    `Measure T_cell_in vs T_cell_out across cooling plate at 3 flow rates (50%, 100%, 150% of design). Verify ΔT < 5°C across plate at design flow. Map with TC grid.`)}

  ${btCard('Chiller / HVAC Integration','ISO 12405-3 · OEM spec',
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
<div class="bt-sec-hdr">📐 Performance Calculations</div>
<div class="card" style="margin-bottom:16px">
  ${btr('10→80% charge time (est.)',  '0.7×E_use ÷ (0.8×P_peak)',      t10_80,                   'min')}
  ${btr('Specific energy (gross)',    `${c.egross}kWh × 1000 ÷ pack_mass`, '— (fill Cell mass)', 'Wh/kg')}
  ${btr('Peak C-rate discharge',      `${c.imax}A ÷ ${c.qpack}Ah`,      (c.imax/c.qpack).toFixed(3), 'C')}
  ${btr('Cont. C-rate discharge',     `${c.icont}A ÷ ${c.qpack}Ah`,     (c.icont/c.qpack).toFixed(3), 'C')}
  ${btr('Charge C-rate (DC)',         `${c.ichg}A ÷ ${c.qpack}Ah`,      (c.ichg/c.qpack).toFixed(3), 'C')}
  ${btr('Regen headroom @90%SoC',    `DoD × 10% head`,                  ((1-(window.S?.t_dod||0.9))*100+10).toFixed(0), '% SoC margin')}
</div>

<div class="bt-sec-hdr">📈 SoC / SoH Formulae</div>
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

<div class="bt-sec-hdr">🧪 Test Matrix</div>
<div class="bt-grid">
  ${btCard('Peak Power (HPPC)','ISO 12405-4:2018 §8.4 · USABC HPPC',
    `10s pulse at ${c.imax}A from 80%SoC, 25°C. Measure V_term. P_avail = V_term × I. Must deliver ≥ ${(c.ppeak*0.95).toFixed(0)}kW. Repeat at -10°C.`,
    'Run at 10%, 20%, 50%, 80%, 90% SoC for full power-SoC map. Use for BMS power limit table.')}

  ${btCard('Usable Energy & Autonomy','ISO 12405-4 §8.3 · WLTP',
    `Drive application duty cycle until BMS cutoff. Record kWh discharged. E_usable ≥ ${c.euse} kWh. Calculate autonomy = E_usable ÷ P_avg.`)}

  ${btCard('OCV vs SoC Mapping','IEC 62660-1 §7 · USABC method',
    `Charge fully. Discharge in C/25 steps (pseudo-OCV). Record V at 0/10/20/30/50/70/80/90/100% SoC. Use at -10°C, 25°C, 45°C. Upload to Cell tab OCV section.`)}

  ${btCard('DC Fast Charge Performance','CHAdeMO · CCS · GB/T 27930',
    `10→80% SoC charge. Target ${t10_80} min. Record E_in, E_out, efficiency, max cell ΔT. Test at 25°C and 0°C. Log CC→CV transition point.`)}

  ${btCard('Regenerative Braking Acceptance','ISO 12405-4 §8.5',
    `Inject regen profile at 90%SoC. Verify no OVP trip. Max regen ≈ ${(c.ppeak*0.4).toFixed(0)}kW. Measure accepted energy fraction.`)}

  ${btCard('SoC Estimation Accuracy','VDA 0126 · IEC 62619',
    `Drive WLTP/application cycle. Compare BMS-reported SoC vs Ah-count reference. Target: ±3% RMS over 10–90% SoC window. Test at 0°C and 40°C.`,
    'Inject step-change load at 50%SoC — BMS SoC jump indicates algorithm failure.')}
</div>`;
}

/* ════════════════════════
   🌍 ENVIRONMENTAL
   ════════════════════════ */
function bt_environmental(c) {
  return `
<div class="bt-sec-hdr">🌍 Environmental Test Calculations</div>
<div class="card" style="margin-bottom:16px">
  ${btr('Thermal cycling range',    'T_op_lo → T_op_hi',         `${c.top_lo} → ${c.top_hi}°C`, '')}
  ${btr('IP Water jet (IPX5/6)',    'Flow rate per nozzle',       '12.5 L/min', '', `${c.ip}`)}
  ${btr('IP Immersion (IPX7)',      'Depth × duration',           '1m × 30min', '', 'IEC 60529')}
  ${btr('Alt. pressure (4000m)',    '101.3 × (1-0.0226×4)^5.256','61.6 kPa', '', 'UN 38.3 §T.1')}
  ${btr('Salt fog concentration',   'NaCl in deionised water',    '5% ± 1%', '', 'ISO 9227')}
  ${btr('Humidity spec',           '40°C / 93% RH / 240h',       '40°C + 93%', '', 'IEC 60068-2-78')}
</div>

<div class="bt-sec-hdr">🧪 Test Matrix</div>
<div class="bt-grid">
  ${btCard('Thermal Cycling (Storage)','IEC 60068-2-14 · ISO 16750-4',
    `${c.top_lo}°C → ${c.top_hi}°C, 2°C/min ramp, 30min dwell each extreme. 500 cycles minimum. Post-test: capacity, IR, isolation. Inspect seal integrity.`,
    'Pause at cycle 100 for intermediate capacity check — early degradation visible.')}

  ${btCard('IP Rating Verification','IEC 60529 · ISO 20653',
    `${c.ip} target: IP6X (dust) — 8h vacuum test; IPX7 — 1m immersion 30min. Post-test: isolation ≥ 100Ω/V (${(c.vmax*100/1000).toFixed(0)}kΩ min).`)}

  ${btCard('Humidity Endurance','IEC 60068-2-78',
    `40°C / 93%RH, 240h (10 days). Post-test: isolation resistance, no corrosion on busbars, connectors dry. For tropical markets: extend to 500h.`,
    `Market: ${c.markets.includes('IN')||c.markets.includes('INDIA')?'IN confirmed — tropical class applicable.':'Check monsoon exposure for application.'}`)}

  ${btCard('Altitude Simulation','UN 38.3 §T.1 · ISO 12405-3',
    `Simulate 4000m (61.6 kPa) for 6h. No seal pop, no outgassing. HV arc gap increases at altitude — creepage distances must be verified for ${c.vmax}V at 4000m.`)}

  ${btCard('Salt Fog / Corrosion','IEC 60068-2-11 · ISO 9227',
    `5% NaCl, 96h. Post-test: isolation ≥ 100Ω/V. No connector corrosion. Critical for ${['Bus','Truck','4W'].includes(c.app)?'road splash exposure':'exposed pack mounting'}.`)}

  ${btCard('Chemical Resistance','ISO 16750-4:2010',
    `Expose to: engine oil, brake fluid, battery acid, cleaning agents (24h contact). No seal compromise. Inspect labelling legibility.`)}
</div>`;
}

/* ════════════════════════
   🔩 MECHANICAL
   ════════════════════════ */
function bt_mechanical(c) {
  const vibProfile = ['Excavator','WheelLoader','AgTractor','Truck'].includes(c.app)
    ? 'ISO 16750-3 Profile IV (off-highway)' : 'ISO 16750-3 Profile I/II (road)';
  const crushForce = Math.max(100, c.egross * 3).toFixed(0);

  return `
<div class="bt-sec-hdr">📐 Mechanical Calculations</div>
<div class="card" style="margin-bottom:16px">
  ${btr('Crush force (UN GTR 20)',    `max(100, E_gross × 3)`,     crushForce,  'kN')}
  ${btr('Vibration profile',          'Application type',           vibProfile,  '')}
  ${btr('Shock severity',             'Half-sine 30g / 11ms',       '30g · 11ms','', 'ISO 16750-3')}
  ${btr('Drop height',                'IEC 62133-2',                '1.0m',      '', '6 faces + 2 edges')}
  ${btr('Post-test isolation min',    '100 Ω/V × V_max',           (c.vmax*100/1000).toFixed(0)+'kΩ','')}
</div>

<div class="bt-sec-hdr">🧪 Test Matrix</div>
<div class="bt-grid">
  ${btCard('Random Vibration',vibProfile,
    `3-axis, 5–200Hz, 0.01–1.0g²/Hz, 8–21h per axis. Monitor for leakage, connectivity loss, BMS fault.`,
    'Post-test: full capacity check + IR + isolation. Any >3% capacity drop = FAIL.')}

  ${btCard('Mechanical Shock','ISO 16750-3:2023 §4.2',
    `Half-sine 30g / 11ms, 3 axes ± (18 pulses total). No damage, no BMS fault, no leakage. Isolation ≥ 100Ω/V post-test.`)}

  ${btCard('Crush / Deformation','UN GTR 20 §8.3 · SAE J2464',
    `${crushForce}kN or 30% deformation or 25% voltage drop — whichever first. Charged state (100%SoC). No fire, no explosion.`,
    undefined, undefined, 'Requires specialist crush rig. Blast-proof cell mandatory.')}

  ${btCard('Drop Test','IEC 62133-2:2017 §7.3.5',
    `1.0m onto concrete: 6 faces + 2 edges. Inspect leakage, deformation. Isolation ≥ 100Ω/V. Full functional check post-drop.`)}

  ${btCard('Nail Penetration','GB/T 31485:2015 §6.4 · SAE J2464',
    `3mm steel nail at 80mm/s through largest cell face. 100%SoC. T_cell < 500°C at penetration point. No fire, no explosion.`,
    `${c.chem}LFP: typically passes without fire. NMC: thermal runaway risk — verify TRP propagation.`,undefined,
    `${c.chem.includes('NMC')?'⚠ NMC: Pre-alert lab. TRP propagation test may be required immediately after.':''}`)}

  ${btCard('Mounting & Fatigue','ISO 16750-3 · OEM spec',
    `1.5× design torque on all mounting points. 10⁶ cycles at ±50% design load. No crack, no loosening, no BMS fault.`)}
</div>`;
}

/* ════════════════════════
   💥 ABUSE
   ════════════════════════ */
function bt_abuse(c) {
  return `
<div class="bt-sec-hdr">💥 Abuse Test Calculations</div>
<div class="card" style="margin-bottom:16px">
  ${btr('Overcharge voltage',       `1.2 × V_max = 1.2 × ${c.vmax}V`, (1.2*c.vmax).toFixed(0), 'V pack')}
  ${btr('Short-circuit test R',     'External resistance',             '5 mΩ', '', 'IEC 62619')}
  ${btr('BMS interrupt time',       'From short detected to open',     '≤ 500 ms', '')}
  ${btr('TR warning time (GB38031)','Occupant evacuation time',        '≥ 5 min', '')}
  ${btr('Over-discharge voltage',   'Force to 0V per cell',           '0V', '', 'IEC 62619 §7.3.3')}
</div>

<div class="bt-sec-hdr">🧪 Test Matrix</div>
<div class="bt-grid">
  ${btCard('Overcharge','IEC 62619:2022 §7.3.2 · UN 38.3 §T.7',
    `Charge at 1C to 1.2×V_max (${(1.2*c.vmax).toFixed(0)}V). BMS must disconnect before venting. No fire, no explosion. Gas sensor monitoring.`,
    undefined, undefined, 'Highest thermal risk test. Fume extraction + fire suppression standby mandatory.')}

  ${btCard('Over-Discharge','IEC 62619:2022 §7.3.3',
    `Force discharge to 0V/cell. BMS must trip at V_min (${c.vcell_min}V/cell). Post-test: charge to 50%SoC — no gas. ${c.chem} copper dissolution risk monitored.`)}

  ${btCard('External Short Circuit','IEC 62619 §7.3.1 · UN 38.3 §T.5',
    `Short via 5mΩ at 100%SoC and 60°C. BMS must interrupt within 500ms. No fire, no explosion, no sustained arc. Fuse must clear I_sc.`,
    'Use fusible link + current clamp to verify peak short-circuit current ≤ fuse interrupt rating.')}

  ${btCard('Thermal Runaway Propagation','UN GTR 20 §8.4 · GB 38031',
    `Single-cell trigger. Monitor propagation. Warning to occupant within 5 min. No explosion for ≥ 5 min. Gas analysis during and after.`,
    undefined, undefined, 'Mandatory for EU/CN/US market approval. Test in explosion-proof facility.')}

  ${btCard('Forced Thermal Runaway (nail)','GB/T 31485 · SAE J2464',
    `Nail penetration per Mechanical test. Monitor propagation to adjacent cells. All certification markets require this or equivalent trigger method.`)}

  ${btCard('Fire Resistance (FMVSS 305)','FMVSS 305 · GB 38031',
    `Expose pack to standardised fire (propane/fuel pool). Pack must not explode. Electrolyte containment required. US market only.`)}
</div>`;
}

/* ════════════════════════
   📡 EMI/EMC
   ════════════════════════ */
function bt_emi_emc(c) {
  return `
<div class="bt-sec-hdr">📡 EMI/EMC Test Parameters</div>
<div class="card" style="margin-bottom:16px">
  ${btr('Radiated emissions limit', 'CISPR 25 Class 5',   '30–1000 MHz', '', 'vehicle class')}
  ${btr('ESD air discharge',        'ISO 10605',          '±15 kV',       '')}
  ${btr('ESD contact discharge',    'ISO 10605',          '±8 kV',        '')}
  ${btr('Load dump (12V system)',   'ISO 7637-2',         '87V / 400ms',   '')}
  ${btr('BCI injection level',      'ISO 11452-4 Sev. 3','30 mA',         '')}
  ${btr('Conducted emissions',      'CISPR 25 Band 5',    '76–108 MHz FM', '')}
</div>

<div class="bt-sec-hdr">🧪 Test Matrix</div>
<div class="bt-grid">
  ${btCard('Radiated Emissions','CISPR 25:2021 · UNECE R10',
    `Measure RF from BMS/DC-DC during discharge cycle. 30–300MHz Class 5 limits. Test in semi-anechoic chamber with vehicle harness simulator.`,
    'BMS PWM frequencies (20–200kHz) generate harmonics in FM band — EMI filter on BMS supply line.')}

  ${btCard('Bulk Current Injection (BCI)','ISO 11452-4:2020',
    `1–400MHz RF injection onto HV cable harness. 30mA severity level 3. No false OVP/UVP trip, no CAN error frame during injection.`)}

  ${btCard('ESD Immunity','ISO 10605:2008 · IEC 61000-4-2',
    `±8kV contact / ±15kV air to all exposed connectors and mounting points. No permanent damage, no BMS reset. Latch-up recovery < 5s.`)}

  ${btCard('Load Dump','ISO 7637-2:2011 · ISO 16750-2',
    `87V / 400ms on 12V LV bus. No damage to BMS, BCM, LV circuits. Transient suppressor response < 1μs.`)}

  ${btCard('Conducted Emissions (LV)','CISPR 25:2021',
    `Measure conducted noise on 12V LV bus from DC-DC converter. Limits per CISPR 25. Add common-mode choke if > 6dBμV over limit.`)}

  ${btCard('Surge Immunity','IEC 61000-4-5',
    `±2kV line-to-earth, ±1kV line-to-line on power inputs. No damage, no functional failure. 5 pulses each polarity.`)}
</div>

<!-- Frequency sweep canvas -->
<div class="bt-sec-hdr">📊 EMI Frequency Sweep Concept</div>
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

  const reqs = [
    {reg:'UN 38.3', body:'UN', scope:'Transport (all markets)', mandatory:true, note:'Air/sea/road. Cell + pack level. 8 sequential tests.'},
    {reg:'IEC 62619:2022', body:'IEC', scope:'Safety for traction/stationary batteries', mandatory:eu||true, note:'Required for CE. Covers OVP, UVP, SC, OT, crush.'},
    eu?{reg:'UNECE R100 Rev.3', body:'UNECE', scope:'EU market — EV REESS', mandatory:true, note:'Part I: electrical safety. Part II: REESS isolation, TR.'}:null,
    us?{reg:'UL 2580', body:'UL', scope:'US market — EV batteries', mandatory:true, note:'UL certification required for US OEM supply.'}:null,
    us?{reg:'FMVSS 305', body:'NHTSA', scope:'US crash safety — EV batteries', mandatory:true, note:'Post-crash isolation, no electrolyte leakage.'}:null,
    cn?{reg:'GB 38031:2020', body:'MIIT', scope:'China mandatory since 2021', mandatory:true, note:'TR propagation with 5-min occupant warning. Stricter than UN GTR 20.'}:null,
    cn?{reg:'GB/T 31485', body:'SAC', scope:'China — safety + abuse', mandatory:true, note:'Nail penetration, overcharge, external SC.'}:null,
    in_?{reg:'AIS-038 Rev.2', body:'MoRTH', scope:'India — automotive EV battery', mandatory:true, note:'Based on UN R100. Mandatory for Indian OEM approval.'}:null,
    in_?{reg:'AIS-156', body:'MoRTH', scope:'India — updated EV safety', mandatory:true, note:'2022 amendment. Performance + safety requirements.'}:null,
    isOH?{reg:'ISO 13849 PLd/PLe', body:'ISO', scope:'Off-highway functional safety', mandatory:true, note:'Machinery Directive 2006/42/EC. BMS safety function classification.'}:null,
    {reg:'IEC 62133-2:2017', body:'IEC', scope:'Portable/traction Li cells safety', mandatory:false, note:'Cell-level certification. Often required by OEM procurement.'},
    {reg:'UN GTR 20', body:'UN', scope:'Global Technical Regulation — EVS-GTR', mandatory:eu, note:'Thermal propagation warning mandatory.'},
  ].filter(Boolean);

  const rows = reqs.map(r=>`<tr style="${r.mandatory?'background:rgba(0,212,170,.03)':''}">
    <td style="font-weight:700;font-size:12px;color:${r.mandatory?'var(--g)':'var(--text2)'}">${r.reg}</td>
    <td style="font-size:11px">${r.body}</td>
    <td style="font-size:11px">${r.scope}</td>
    <td style="text-align:center">${r.mandatory?'<span style="color:var(--g);font-weight:700">✓ REQ</span>':'<span style="color:var(--text3)">Optional</span>'}</td>
    <td style="font-size:11px;color:var(--text3)">${r.note}</td>
  </tr>`).join('');

  return `
<div class="bt-sec-hdr">🏅 Required Certifications — ${mkts}</div>
<div style="overflow-x:auto;margin-bottom:16px">
<table class="res-tbl">
  <thead><tr><th>Standard</th><th>Body</th><th>Scope</th><th>Status</th><th>Notes</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</div>

<div class="bt-sec-hdr">📋 UN 38.3 Test Sequence (mandatory all markets)</div>
<div class="bt-grid">
  ${['T1: Altitude (11.6 kPa, 6h)','T2: Thermal (-40→+72°C, 6× cycles)','T3: Vibration (7–200Hz, 3 axes)','T4: Shock (150g half-sine, 3 axes)','T5: External short circuit','T6: Impact/crush','T7: Overcharge','T8: Forced discharge'].map((t,i)=>`
    <div class="bt-card" style="padding:12px">
      <div style="font-size:11px;font-weight:700;color:var(--b)">${t}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px">Sequential — must pass all 8. Cell + pack level separately.</div>
    </div>`).join('')}
</div>

<div class="ico-banner" style="margin-top:14px">
  📌 Certification path: UN 38.3 → IEC 62619 → ${eu?'UNECE R100':''}${cn?' GB 38031':''}${us?' UL 2580':''}${in_?' AIS-038':''}.
  Start UN 38.3 early — 8 sequential tests take 3–4 months minimum.
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
      'HV warning signs — EN ISO 7010 W012 (lightning bolt)',
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
function bt_standards_global(c) {
  const regions = [
    { flag:'🇪🇺', name:'Europe / Global',  color:'#4a9eff', stds:[
      ['UNECE R100 Rev.3', 'EV REESS — isolation, thermal runaway warning'],
      ['IEC 62619:2022',   'Safety for traction/stationary Li batteries'],
      ['IEC 62660-1/2/3',  'Cell performance, reliability, safety testing'],
      ['ISO 12405-4',      'Li-ion pack testing — safety, performance'],
      ['IEC 60529',        'IP rating — ingress protection (dust/water)'],
      ['IEC 60068-2',      'Environmental testing — thermal, humidity, vibration'],
      ['EU Battery Reg 2023/1542', 'New EU battery passport + sustainability rules'],
      ['EN 62133-2',       'Safety requirements for portable/traction cells'],
      ['IEC 61000-4',      'EMC immunity — ESD, surge, BCI, EFT series'],
      ['CISPR 25',         'Radiated/conducted emissions (vehicle)'],
    ]},
    { flag:'🇺🇸', name:'USA', color:'#ef4444', stds:[
      ['UL 2580',          'EV batteries — safety certification'],
      ['UL 1973',          'Stationary storage batteries'],
      ['SAE J2464',        'EV battery abuse testing'],
      ['SAE J1798',        'EV battery performance testing'],
      ['FMVSS 305',        'Post-crash electrical safety'],
      ['DOT/PHMSA',        'Transport — UN 38.3 + packaging'],
    ]},
    { flag:'🇨🇳', name:'China', color:'#f5c518', stds:[
      ['GB 38031:2020',    'EV battery safety — mandatory since 2021'],
      ['GB/T 31485',       'Safety requirements + abuse tests'],
      ['GB/T 31467-3',     'HV battery for EV — safety'],
      ['GB/T 27930',       'DC charging interface (CHAdeMO equivalent)'],
      ['GB/T 18487',       'EV conductive charging system'],
    ]},
    { flag:'🇮🇳', name:'India', color:'#ff7b35', stds:[
      ['AIS-038 Rev.2',    'EV battery safety — automotive (based on UN R100)'],
      ['AIS-156',          'EV safety amendment — 2022 update'],
      ['BIS IS 16270',     'Li-ion battery cells safety'],
      ['UN 38.3',          'Transport mandatory'],
    ]},
    { flag:'🇯🇵🇰🇷', name:'Japan / Korea', color:'#a78bfa', stds:[
      ['UN R100',          'UNECE adoption — both markets'],
      ['JIS C 8715-2',     'Japan — Li-ion safety for vehicles'],
      ['KC Certification', 'Korea — based on UN/IEC standards'],
    ]},
    { flag:'🌍', name:'Off-Highway (all markets)', color:'#00d4aa', stds:[
      ['ISO 13849',        'Safety of machinery — PL (performance level)'],
      ['IEC 62061',        'Functional safety of machinery — SIL'],
      ['ISO 11688',        'Machinery noise measurement'],
      ['Machinery Dir. 2006/42/EC', 'EU CE for off-highway equipment'],
    ]},
  ];

  return regions.map(r=>`
    <div class="bt-sec-hdr" style="color:${r.color}">${r.flag} ${r.name}</div>
    <div class="bt-card" style="margin-bottom:12px">
      <table style="width:100%;border-collapse:collapse">
        ${r.stds.map(([std,desc])=>`<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:6px 8px;font-family:var(--mono);font-size:11px;font-weight:700;color:var(--b);white-space:nowrap;width:180px">${std}</td>
          <td style="padding:6px 8px;font-size:12px;color:var(--text2)">${desc}</td>
        </tr>`).join('')}
      </table>
    </div>`).join('');
}

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
    /* CISPR 25 Class 5 limit line */
    const limit=[[150e3,66],[30e6,40],[300e6,33],[1e9,33]];
    ctx.beginPath();ctx.strokeStyle='rgba(255,77,109,.5)';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);
    limit.forEach((p,i)=>i===0?ctx.moveTo(mx(p[0]),my3(p[1])):ctx.lineTo(mx(p[0]),my3(p[1])));
    ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,77,109,.5)';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='left';
    ctx.fillText('CISPR 25 Class 5 limit',mx(1e6),my3(46));
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
    ctx.fillText('EMI Scan — dBμV vs Frequency (Hz log scale) · Blue=measured · Red=CISPR 25 limit',pad.l+pw/2,H-4);
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
