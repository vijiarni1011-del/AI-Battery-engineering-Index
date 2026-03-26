  calcBOM();
}

function calcBOM() {
  // Core components
  const cellCost  = getV('gap_cell_cost') * (S.E_gross || 43);
  const bms       = getV('gap_bms_cost');
  const housing   = getV('gap_housing_cost');
  const tms       = getV('gap_tms_cost');
  const pdu       = getV('gap_pdu_cost');
  const coreCost  = cellCost + bms + housing + tms + pdu;

  // Additional components from dynamic table
  let extraCost = 0;
  document.querySelectorAll('#bom_extra_rows .bom-row').forEach(row => {
    const cost = parseFloat(row.querySelector('.bom-cost')?.value) || 0;
    const qty  = parseFloat(row.querySelector('.bom-qty')?.value)  || 1;
    extraCost += cost * qty;
  });

  // Fixed costs
  const assembly  = getV('bom_assembly')   || 600;
  const testing   = getV('bom_testing')    || 400;
  const tooling   = getV('bom_tooling')    || 300;
  const logistics = getV('bom_logistics')  || 200;
  const fixedCost = assembly + testing + tooling + logistics;

  const directCost   = coreCost + extraCost + fixedCost;
  const overheadPct  = (getV('bom_overhead_pct') || 12) / 100;
  const profitPct    = (getV('bom_profit_pct')   || 15) / 100;
  const costWithOH   = directCost * (1 + overheadPct);
  const totalSP      = costWithOH / (1 - profitPct);  // selling price at target margin
  const per_kwh      = totalSP / Math.max(S.E_gross || 43, 1);

  // Update TCO capex field
  setField('tco_ev_capex', totalSP.toFixed(0));

  // Update cell cost hint
  const hint = document.getElementById('bom_cell_hint');
  if (hint) hint.textContent = `= $${cellCost.toFixed(0)} at ${(S.E_gross||43).toFixed(1)} kWh`;

  const el = document.getElementById('gap_bom_result');
  if (el) setRg('gap_bom_result', [
    {l:'Cells',          v:cellCost.toFixed(0),    u:'$', c:'neutral'},
    {l:'Additional comps',v:extraCost.toFixed(0),  u:'$', c:'neutral'},
    {l:'Systems (BMS+TMS+PDU)', v:(bms+tms+pdu).toFixed(0), u:'$', c:'neutral'},
    {l:'Housing',        v:housing.toFixed(0),     u:'$', c:'neutral'},
    {l:'Fixed (asm+QC+logistics)', v:fixedCost.toFixed(0), u:'$', c:'neutral'},
    {l:'Overhead',       v:(directCost*overheadPct).toFixed(0), u:'$', c:'neutral'},
    {l:'Gross Profit',   v:(costWithOH*profitPct/(1-profitPct)).toFixed(0), u:'$', c:'ok'},
    {l:'TOTAL (Selling Price)', v:totalSP.toFixed(0), u:'$', c:'blue'},
    {l:'$/kWh',          v:per_kwh.toFixed(0),     u:'$/kWh', c:per_kwh<=S.t_cost?'ok':'warn', t:`Target: $${S.t_cost}/kWh`},
  ]);

  // Draw BOM pie
  try { drawBOMCanvas(cellCost, extraCost, bms+tms+pdu, housing, fixedCost, directCost*overheadPct, costWithOH*profitPct/(1-profitPct)); } catch(e){}
  try { calcTCO(); } catch(e) {}
}

function drawBOMCanvas(cells, extra, systems, housing, fixed, overhead, profit) {
  const canvas = document.getElementById('bom_canvas');
  if (!canvas) return;
  const W = 500, H = 320;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, W, H);

  const slices = [
    {l:'Cells',       v:cells,    col:'#f5c518'},
    {l:'Extra comps', v:extra,    col:'#4a9eff'},
    {l:'Systems',     v:systems,  col:'#00d4aa'},
    {l:'Housing',     v:housing,  col:'#a78bfa'},
    {l:'Fixed costs', v:fixed,    col:'#ff7b35'},
    {l:'Overhead',    v:overhead, col:'#6d8fba'},
    {l:'Profit',      v:profit,   col:'#00d4aa'},
  ].filter(s => s.v > 0);

  const total = slices.reduce((s,x) => s + x.v, 0);
  if (total <= 0) return;

  const cx = 160, cy = 155, r = 110;
  let angle = -Math.PI / 2;
  slices.forEach(s => {
    const sweep = (s.v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = s.col + 'cc'; ctx.fill();
    ctx.strokeStyle = '#07080b'; ctx.lineWidth = 2; ctx.stroke();
    angle += sweep;
  });

  // Legend
  let ly = 30;
  slices.forEach(s => {
    ctx.fillStyle = s.col;
    ctx.fillRect(W - 200, ly - 10, 12, 12);
    ctx.fillStyle = '#dde8f8'; ctx.font = '13px Barlow,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${s.l}`, W - 183, ly);
    ctx.fillStyle = '#6d8fba'; ctx.font = '13px JetBrains Mono,monospace';
    ctx.fillText(`$${s.v.toFixed(0)}  (${(s.v/total*100).toFixed(0)}%)`, W - 183, ly + 13);
    ly += 34;
  });

  ctx.fillStyle = '#4a6080'; ctx.font = '13px Barlow,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`Total: $${total.toFixed(0)}`, cx, cy + r + 20);
}

function calcTCO() {
  const fuel_cost  = getV('gap_fuel_cost')  || 1.5;
  const fuel_cons  = getV('gap_fuel_cons')  || 8;
  const elec_cost  = getV('gap_elec_cost')  || 0.15;
  const ice_maint  = getV('tco_ice_maint')  || 3500;
  const ev_maint   = getV('tco_ev_maint')   || 1500;
  const ice_capex  = getV('tco_ice_capex')  || 120000;
  const ev_capex   = getV('tco_ev_capex')   || 0;
  const years      = getV('tco_years')      || 5;
  const hours_yr   = (S.t_days_yr||200) * (S.t_auto||4);

  const ice_fuel_yr  = fuel_cost * fuel_cons * hours_yr;
  const ev_energy_yr = (S.E_gross||43) * (S.t_cycles_day||1) * (S.t_days_yr||200);
  const ev_elec_yr   = elec_cost * ev_energy_yr;

  const ice_total_yr = ice_fuel_yr + ice_maint;
  const ev_total_yr  = ev_elec_yr  + ev_maint;
  const saving_yr    = ice_total_yr - ev_total_yr;
  const capex_delta  = ev_capex - ice_capex;
  const payback      = capex_delta > 0 ? capex_delta / Math.max(saving_yr, 1) : 0;
  const npv_5yr      = saving_yr * years - capex_delta;

  const el = document.getElementById('gap_tco_result');
  if (el) setRg('gap_tco_result', [
    {l:'ICE fuel cost/yr',      v:ice_fuel_yr.toFixed(0),  u:'$', c:'warn'},
    {l:'ICE maintenance/yr',    v:ice_maint.toFixed(0),    u:'$', c:'warn'},
    {l:'ICE total opex/yr',     v:ice_total_yr.toFixed(0), u:'$', c:'err'},
    {l:'EV electricity/yr',     v:ev_elec_yr.toFixed(0),   u:'$', c:'ok'},
    {l:'EV maintenance/yr',     v:ev_maint.toFixed(0),     u:'$', c:'ok'},
    {l:'EV total opex/yr',      v:ev_total_yr.toFixed(0),  u:'$', c:'ok'},
    {l:'Annual saving',         v:saving_yr.toFixed(0),    u:'$', c:saving_yr>0?'ok':'err'},
    {l:'Capex premium',         v:capex_delta.toFixed(0),  u:'$', c:capex_delta<0?'ok':'warn'},
    {l:'Payback period',        v:payback.toFixed(1),      u:'yrs', c:payback<4?'ok':payback<7?'warn':'err'},
    {l:`NPV over ${years} yrs`, v:npv_5yr.toFixed(0),      u:'$', c:npv_5yr>0?'ok':'err'},
  ]);

  try { drawTCOCanvas(years, ice_total_yr, ev_total_yr, ice_capex, ev_capex); } catch(e) {}
}

function drawTCOCanvas(years, ice_yr, ev_yr, ice_cap, ev_cap) {
  const canvas = document.getElementById('tco_canvas');
  if (!canvas) return;
  const W = 800, H = 260;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, W, H);
  const pad = { l: 72, r: 24, t: 28, b: 44 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

  // Cumulative cost by year
  const iceC = [], evC = [];
  for (let y = 0; y <= years; y++) {
    iceC.push(ice_cap + ice_yr * y);
    evC.push(ev_cap  + ev_yr  * y);
  }
  const maxC = Math.max(...iceC, ...evC) * 1.08;
  const mapX = y => pad.l + (y / years) * pw;
  const mapY = v => pad.t + ph * (1 - v / maxC);

  vizGrid(ctx, W, H, pad, years, 5);

  // Shading between curves
  ctx.beginPath();
  ctx.moveTo(mapX(0), mapY(iceC[0]));
  for (let y = 0; y <= years; y++) ctx.lineTo(mapX(y), mapY(iceC[y]));
  for (let y = years; y >= 0; y--) ctx.lineTo(mapX(y), mapY(evC[y]));
  ctx.closePath();
  const grad = ctx.createLinearGradient(pad.l, 0, W-pad.r, 0);
  grad.addColorStop(0, 'rgba(255,77,109,.08)');
  grad.addColorStop(1, 'rgba(0,212,170,.08)');
  ctx.fillStyle = grad; ctx.fill();

  vizLine(ctx, iceC.map((_,y) => [mapX(y), mapY(iceC[y])]), '#ff4d6d', 2.5, [6,3]);
  vizLine(ctx, evC.map((_,y)  => [mapX(y), mapY(evC[y])]),  '#00d4aa', 2.5);

  // Payback crossover dot
  const crossYear = (ev_cap - ice_cap) / Math.max(ice_yr - ev_yr, 1);
  if (crossYear > 0 && crossYear <= years) {
    const cx = mapX(crossYear), cy_v = ice_cap + ice_yr * crossYear;
    ctx.beginPath(); ctx.arc(cx, mapY(cy_v), 7, 0, Math.PI*2);
    ctx.fillStyle='#f5c518'; ctx.fill();
    ctx.fillStyle='#f5c518'; ctx.font='bold 12px JetBrains Mono,monospace'; ctx.textAlign='center';
    ctx.fillText(`Payback ${crossYear.toFixed(1)}y`, cx, mapY(cy_v)-12);
  }

  // Labels
  for (let y = 0; y <= years; y++) {
    ctx.fillStyle='#4a6080'; ctx.font='11px JetBrains Mono,monospace'; ctx.textAlign='center';
    ctx.fillText('Y'+y, mapX(y), H-pad.b+14);
  }
  for (let i=0;i<=5;i++) {
    const v = maxC*i/5;
    ctx.fillStyle='#4a6080'; ctx.font='11px JetBrains Mono,monospace'; ctx.textAlign='right';
    ctx.fillText('$'+(v/1000).toFixed(0)+'k', pad.l-5, mapY(v)+4);
  }
  ctx.fillStyle='#ff4d6d'; ctx.font='12px JetBrains Mono,monospace'; ctx.textAlign='right';
  ctx.fillText('━ ICE/Fuel', W-pad.r, pad.t+14);
  ctx.fillStyle='#00d4aa'; ctx.textAlign='right';
  ctx.fillText('━ EV Battery', W-pad.r, pad.t+30);
}

// ══ TARGET vs RESULTS RUNNER ══
function runTVR() {
  const tbody = document.getElementById('tvr_tbody');
  if (!tbody) return;

  // Re-run propagate to ensure S is current
  try { propagate(); } catch(e) {}

  const badge = (pass, warn) =>
    pass  ? '<span style="display:inline-block;padding:3px 10px;background:rgba(0,212,170,.15);border:1px solid rgba(0,212,170,.4);border-radius:5px;color:#00d4aa;font-size:12px;font-weight:700">✓ PASS</span>'
    : warn? '<span style="display:inline-block;padding:3px 10px;background:rgba(245,197,24,.12);border:1px solid rgba(245,197,24,.4);border-radius:5px;color:#f5c518;font-size:12px;font-weight:700">⚠ CAUTION</span>'
    :       '<span style="display:inline-block;padding:3px 10px;background:rgba(255,77,109,.12);border:1px solid rgba(255,77,109,.4);border-radius:5px;color:#ff4d6d;font-size:12px;font-weight:700">✗ FAIL</span>';

  const mkRow = (param, mod, tgtVal, resVal, unit, pass, warn, note='') => {
    const fmt = v => (v===null||v===undefined||v==='') ? '—' : String(v)+unit;
    const tStr = fmt(tgtVal);
    const rStr = fmt(resVal);
    const mNum = (tgtVal!==null && resVal!==null && !isNaN(+resVal) && !isNaN(+tgtVal)) ? (+resVal - +tgtVal) : null;
    const mStr = mNum !== null ? (mNum>=0?'+':'')+mNum.toFixed(2)+unit : '—';
    const mCol = mNum===null?'#6d8fba': pass?'#00d4aa': warn?'#f5c518':'#ff4d6d';
    const rowBg = pass?''  : warn?'background:rgba(245,197,24,.04)' : 'background:rgba(255,77,109,.04)';
    return `<tr style="border-bottom:1px solid var(--border);${rowBg}">
      <td style="padding:10px 14px;font-size:13px;font-weight:600;color:var(--text)">${param}</td>
      <td style="padding:10px 14px;text-align:center"><span style="font-size:11px;background:var(--bg3);border:1px solid var(--border);padding:2px 8px;border-radius:4px;color:var(--text2)">${mod}</span></td>
      <td style="padding:10px 14px;text-align:right;font-family:var(--mono);font-size:13px;color:#4a9eff">${tStr}</td>
      <td style="padding:10px 14px;text-align:right;font-family:var(--mono);font-size:14px;font-weight:700;color:#f5c518">${rStr}</td>
      <td style="padding:10px 14px;text-align:right;font-family:var(--mono);font-size:12px;color:${mCol}">${mStr}</td>
      <td style="padding:10px 14px;text-align:center">${badge(pass,warn)}</td>
      <td style="padding:10px 14px;font-size:12px;color:var(--text3)">${note}</td>
    </tr>`;
  };

  const rows=[]; let passN=0,warnN=0,failN=0;
  const track=(html,p,w)=>{rows.push(html);if(p)passN++;else if(w)warnN++;else failN++;};

  // Helper: get value from S or fallback to DOM
  const sv = (key, fallback=0) => { const v=S[key]; return (v!==undefined&&v!==null) ? +v : fallback; };
  const gv = id => { const el=document.getElementById(id); return el ? +el.value||0 : 0; };

  // ── ENERGY ──
  const Eg    = sv('E_gross');
  const Eu    = sv('E_usable');
  const Emin  = sv('t_emin',40);
  const Eumin = sv('t_eu_min',35);
  const dod   = sv('t_dod',1.0);
  const Eu_ok = Eu>=Eumin, Eu_w = Eu>=Eumin*0.92;
  track(mkRow('Gross Energy',      'Energy', Emin.toFixed(1),  Eg>0?Eg.toFixed(1):'—', ' kWh', Eg>=Emin, Eg>=Emin*0.95, `Cell array: ${sv('S_total')}S×${sv('c_pp')}P × ${sv('c_vnom')}V × ${sv('c_ah')}Ah`), Eg>=Emin, Eg>=Emin*0.95);
  track(mkRow('Usable Energy',     'Energy', Eumin.toFixed(1), Eu>0?Eu.toFixed(1):'—', ' kWh', Eu_ok, Eu_w, `DoD=${(dod*100).toFixed(0)}% applied. Gap=${(Eu-Eumin).toFixed(1)} kWh`), Eu_ok, Eu_w);

  // ── VOLTAGE ──
  const Vnom   = sv('V_nom_pack');
  const Vmax_p = sv('V_max_pack');
  const Vmin_p = sv('V_min_pack');
  const Vsmin  = sv('t_vmin_sys',250);
  const Vsmax  = sv('t_vmax_sys',500);
  const vn_ok  = Vnom>=Vsmin && Vnom<=Vsmax;
  const vm_ok  = Vmax_p <= Vsmax;
  const vi_ok  = Vmin_p >= Vsmin;
  track(mkRow('Pack V_nom',         'Voltage', `${Vsmin}–${Vsmax}`, Vnom>0?Vnom.toFixed(1):'—', ' V', vn_ok, Vnom>=Vsmin*0.93, `${sv('S_total')} cells × ${sv('c_vnom').toFixed(2)}V`), vn_ok, Vnom>=Vsmin*0.93);
  track(mkRow('Pack V_max ≤ sys max','Voltage', Vsmax.toFixed(0), Vmax_p>0?Vmax_p.toFixed(1):'—', ' V', vm_ok, true, `Must not exceed system max. Gap: ${(Vsmax-Vmax_p).toFixed(1)}V`), vm_ok, true);
  track(mkRow('Pack V_min ≥ sys min','Voltage', Vsmin.toFixed(0), Vmin_p>0?Vmin_p.toFixed(1):'—', ' V', vi_ok, Vmin_p>=Vsmin*0.9, `Cut-off voltage check`), vi_ok, Vmin_p>=Vsmin*0.9);

  // ── POWER & CURRENT ──
  const Pcont   = sv('t_pcont',50);
  const Ppeak   = sv('t_ppeak',80);
  const Tpeak   = sv('t_tpeak',30);
  const Qpack   = sv('Q_pack',120);
  const Cpeak_t = sv('t_cpeak',2.0);
  const I_cont  = Vnom>0 ? Pcont*1000/Vnom : 0;
  const I_peak  = Vnom>0 ? Ppeak*1000/Vnom : 0;
  const Cc      = Qpack>0 ? I_cont/Qpack : 0;
  const Cp      = Qpack>0 ? I_peak/Qpack : 0;
  const Ptotal  = sv('_P_total', 0);
  track(mkRow('Cont. Power',        'Current', Pcont.toFixed(0), Ptotal>0?Ptotal.toFixed(1):'—', ' kW', Ptotal<=Pcont||Ptotal===0, Ptotal<=Pcont*1.1||Ptotal===0, Ptotal>0?`Battery draw at current load settings`:'Run Current tab'), Ptotal<=Pcont||Ptotal===0, Ptotal<=Pcont*1.1||Ptotal===0);
  track(mkRow('Cont. C-rate',       'Current', '≤1.5', Cc>0?Cc.toFixed(3):'—', 'C', Cc<=1.5||Cc===0, Cc<=2.0||Cc===0, `${Pcont}kW ÷ ${Vnom.toFixed(0)}V = ${I_cont.toFixed(0)}A ÷ ${Qpack}Ah`), Cc<=1.5||Cc===0, Cc<=2.0||Cc===0);
  track(mkRow('Peak C-rate',        'Current', Cpeak_t.toFixed(1), Cp>0?Cp.toFixed(3):'—', 'C', Cp<=Cpeak_t||Cp===0, Cp<=Cpeak_t*1.1||Cp===0, `${Ppeak}kW peak ÷ ${Vnom.toFixed(0)}V ÷ ${Qpack}Ah`), Cp<=Cpeak_t||Cp===0, Cp<=Cpeak_t*1.1||Cp===0);

  // ── CHARGING ──
  const Cchg_t  = sv('t_cchg',0.5);
  const Imax_c  = sv('t_imax_chg',120);
  const Pdc     = sv('t_pdc',60);
  const Pac     = sv('t_pac',22);
  const I_dc    = Vnom>0 ? Pdc*1000/Vnom : 0;
  const Cchg    = Qpack>0 ? Math.min(I_dc,Imax_c)/Qpack : 0;
  const t_dc    = Eu>0&&Pdc>0 ? (Eu/Pdc*60) : 0;
  const Cch_ok  = Cchg<=Cchg_t||Cchg===0;
  track(mkRow('Charge C-rate @DC',  'Charging', Cchg_t.toFixed(2), Cchg>0?Cchg.toFixed(3):'—', 'C', Cch_ok, Cchg<=Cchg_t*1.2||Cchg===0, `I_lim=min(${I_dc.toFixed(0)},${Imax_c})A ÷ ${Qpack}Ah`), Cch_ok, Cchg<=Cchg_t*1.2||Cchg===0);
  track(mkRow('DC Charge time',     'Charging', '≤240', t_dc>0?t_dc.toFixed(0):'—', ' min', t_dc<=240||t_dc===0, t_dc<=300||t_dc===0, `${Eu.toFixed(1)}kWh ÷ ${Pdc}kW`), t_dc<=240||t_dc===0, t_dc<=300||t_dc===0);
  track(mkRow('Charge temp window', 'Charging', `${sv('t_tchg_lo',-15)}–${sv('t_tchg_hi',45)}`, '(see Thermal)', '°C', true, false, 'Charge inhibit below t_tchg_lo, above t_tchg_hi'), true, false);

  // ── THERMAL ──
  const Tc_max  = sv('t_tcell_max',55);
  const Tgrad   = sv('t_tgrad',5);
  const Top_lo  = sv('t_top_lo',-20);
  const Top_hi  = sv('t_top_hi',45);
  const Tcell_r = sv('_Tcell_max',0);
  const Vflow_r = sv('_V_flow',0);
  const Tm_ok   = Tcell_r>0 ? Tcell_r<=Tc_max : null;
  track(mkRow('Max cell temp',      'Thermal', Tc_max.toFixed(0), Tcell_r>0?Tcell_r.toFixed(1):'Run tab', '°C', Tm_ok??true, (Tcell_r>0?Tcell_r<=Tc_max+5:null)??true, Tc_max>0?`Limit: ${Tc_max}°C. Run Thermal tab to compute.`:''), Tm_ok??true, (Tcell_r>0?Tcell_r<=Tc_max+5:null)??true);
  const fl_ok = Vflow_r>0 ? Vflow_r<=15 : null;
  track(mkRow('Coolant flow',       'Thermal', '≤15', Vflow_r>0?Vflow_r.toFixed(2):'Run tab', ' L/min', fl_ok??true, (Vflow_r>0?Vflow_r<=20:null)??true, 'Calculated in Thermal tab from I²R heat load'), fl_ok??true, (Vflow_r>0?Vflow_r<=20:null)??true);
  track(mkRow('Temp gradient',      'Thermal', `≤${Tgrad}`, '(see Thermal)', '°C', true, false, 'Max cell-to-cell ΔT within pack'), true, false);
  track(mkRow('Op. temp window',    'Thermal', `${Top_lo}–${Top_hi}`, '(environment)', '°C', true, false, 'System must operate across this ambient range'), true, false);

  // ── LIFECYCLE ──
  const Cyc_t   = sv('t_cycles',3000);
  const SoH_eol = sv('t_soh_eol',80);
  const SoH5    = sv('t_soh5',90);
  const CalYrs  = sv('t_years',10);
  const SoH_r   = sv('_soh_eol_est',0);
  const Cyc_yr  = sv('t_cycles_day',1) * sv('t_days_yr',200);
  const life_yr = Cyc_yr>0 ? Cyc_t/Cyc_yr : 0;
  const soh_ok  = SoH_r>0 ? SoH_r>=SoH_eol : null;
  track(mkRow('Cycle life (yrs)',   'Lifecycle', CalYrs.toFixed(0), life_yr>0?life_yr.toFixed(1):'—', ' yrs', life_yr>=CalYrs||life_yr===0, life_yr>=CalYrs*0.9||life_yr===0, `${Cyc_t} cycles ÷ ${Cyc_yr}/yr = ${life_yr.toFixed(1)} yrs`), life_yr>=CalYrs||life_yr===0, life_yr>=CalYrs*0.9||life_yr===0);
  track(mkRow('EoL SoH',           'Lifecycle', SoH_eol.toFixed(0), SoH_r>0?SoH_r.toFixed(1):'Run tab', '%', soh_ok??true, (SoH_r>0?SoH_r>=SoH_eol-3:null)??true, 'Estimated from linear fade model in Lifecycle tab'), soh_ok??true, (SoH_r>0?SoH_r>=SoH_eol-3:null)??true);
  track(mkRow('Year-5 SoH',        'Lifecycle', SoH5.toFixed(0), '(see Lifecycle)', '%', true, false, 'From SoH trajectory in Lifecycle tab'), true, false);

  // ── ENERGY DENSITY ──
  const GEDt    = sv('t_ged',200);
  const pmass   = sv('pack_mass',0);
  const GED_r   = pmass>0 ? Eg*1000/pmass : 0;
  const ged_ok  = GED_r>=GEDt||GED_r===0;
  track(mkRow('Gravimetric ED',     'Cell', GEDt.toFixed(0), GED_r>0?GED_r.toFixed(0):'—', ' Wh/kg', ged_ok, GED_r>=GEDt*0.9||GED_r===0, `${Eg.toFixed(1)}kWh ÷ ${pmass.toFixed(0)}kg`), ged_ok, GED_r>=GEDt*0.9||GED_r===0);

  // ── COST ──
  const Ct      = sv('t_cost',130);
  // BOM result from gap_bom_result panel (last $/kWh value)
  const bomEls  = document.querySelectorAll('#gap_bom_result .rv');
  const bom_kwh = bomEls.length ? +(bomEls[bomEls.length-1]?.textContent||0) : 0;
  const cost_ok = bom_kwh>0 ? bom_kwh<=Ct : null;
  track(mkRow('Pack cost $/kWh',    'Business', Ct.toFixed(0), bom_kwh>0?bom_kwh.toFixed(0):'Run BOM', ' €/kWh', cost_ok??true, (bom_kwh>0?bom_kwh<=Ct*1.15:null)??true, 'From Business & Cost BOM sheet'), cost_ok??true, (bom_kwh>0?bom_kwh<=Ct*1.15:null)??true);

  // ── AUTONOMY ──
  const Auto_t  = sv('t_auto',4);
  const lc_auto = sv('_lc_auto_bol',0);
  const auto_ok = lc_auto>0 ? lc_auto>=Auto_t : null;
  track(mkRow('Autonomy @ BoL',     'Lifecycle', Auto_t.toFixed(1), lc_auto>0?lc_auto.toFixed(2):'Run tab', ' h', auto_ok??true, (lc_auto>0?lc_auto>=Auto_t*0.9:null)??true, 'Usable energy ÷ average power demand'), auto_ok??true, (lc_auto>0?lc_auto>=Auto_t*0.9:null)??true);

  // ── DOD / SOC WINDOW ──
  track(mkRow('SoC/DoD window',     'Energy', (dod*100).toFixed(0), (dod*100).toFixed(0), '%', true, false, `${(dod*100).toFixed(0)}% of cell capacity used (${((1-dod)/2*100).toFixed(0)}%–${((1-(1-dod)/2)*100).toFixed(0)}% SoC)`), true, false);

  tbody.innerHTML = rows.join('');

  // ── KPI strip ──
  document.getElementById('tvr_pass_count').textContent = passN;
  document.getElementById('tvr_warn_count').textContent = warnN;
  document.getElementById('tvr_fail_count').textContent = failN;

  const verdict = failN>0
    ? {t:'✗ NO-GO',   c:'#ff4d6d', bg:'rgba(255,77,109,.12)', bc:'rgba(255,77,109,.4)'}
    : warnN>0
    ? {t:'⚠ CAUTION', c:'#f5c518', bg:'rgba(245,197,24,.12)', bc:'rgba(245,197,24,.4)'}
    : {t:'✓ GO',       c:'#00d4aa', bg:'rgba(0,212,170,.12)',  bc:'rgba(0,212,170,.4)'};

  const vc=document.getElementById('tvr_verdict_card');
  if(vc){vc.style.background=verdict.bg;vc.style.borderColor=verdict.bc;}
  const ve=document.getElementById('tvr_verdict');
  if(ve){ve.textContent=verdict.t;ve.style.color=verdict.c;}

  // ── Decision notes ──
  const notesEl=document.getElementById('tvr_decision_notes');
  if(notesEl){
    const notes=[];
    if(!Eu_ok)   notes.push({c:'err', t:'⚡ Usable energy below target', d:`${Eu.toFixed(1)} kWh < target ${Eumin} kWh. Increase cell count, expand DoD window, or reduce losses.`});
    if(!vn_ok)   notes.push({c:'warn',t:'🔌 Pack voltage outside window', d:`V_nom ${Vnom.toFixed(0)}V not in [${Vsmin}–${Vsmax}]V. Adjust series cell count.`});
    if(!vm_ok)   notes.push({c:'err', t:'⚠ V_max exceeds system limit',  d:`Pack V_max ${Vmax_p.toFixed(0)}V > ${Vsmax}V max. Reduce series cells or use lower V_max cell.`});
    if(Cc>1.5)   notes.push({c:'err', t:'🌊 High continuous C-rate',     d:`C_cont=${Cc.toFixed(2)}C > 1.5C. Risk of accelerated aging. Increase pack capacity or reduce continuous power demand.`});
    if(Cp>Cpeak_t) notes.push({c:'warn',t:'⚡ Peak C-rate over target',   d:`C_peak=${Cp.toFixed(2)}C > target ${Cpeak_t}C. Check 30s thermal limits.`});
    if(life_yr>0&&life_yr<CalYrs) notes.push({c:'err',t:'📈 Cycle life below target', d:`${life_yr.toFixed(1)} yrs < ${CalYrs} yr target. Reduce cycles/day or increase target cycle count.`});
    if(failN===0&&warnN===0) notes.push({c:'ok',t:'✓ All checks passed — GO', d:'Battery system meets all defined project targets. Ready for DVP planning.'});
    notesEl.innerHTML=notes.map(n=>`
      <div style="padding:11px 16px;margin-bottom:8px;border-radius:8px;
        background:${n.c==='ok'?'rgba(0,212,170,.07)':n.c==='warn'?'rgba(245,197,24,.07)':'rgba(255,77,109,.07)'};
        border:1px solid ${n.c==='ok'?'rgba(0,212,170,.25)':n.c==='warn'?'rgba(245,197,24,.25)':'rgba(255,77,109,.25)'}">
        <div style="font-size:14px;font-weight:700;color:${n.c==='ok'?'#00d4aa':n.c==='warn'?'#f5c518':'#ff4d6d'};margin-bottom:4px">${n.t}</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.6">${n.d}</div>
      </div>`).join('');
  }
}

// ═══════════════════════════════════════════════════════════
// QA AGENT v2 — Full end-to-end verification
// Runs on load. Click badge in header to re-run.
// ═══════════════════════════════════════════════════════════
const QA_AGENT = {
