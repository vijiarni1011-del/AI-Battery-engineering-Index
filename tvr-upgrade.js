/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — TVR UPGRADE + TEMPERATURE DERATING  v1.0

   Part A: Extends runTVR() with 15 additional check rows:
     DCIR, BMS thresholds, IP, altitude, weight/GED, precharge,
     drive cycle P_avg, busbar, pack voltage class, HV safety,
     pack dimensions, charge temp window, regen, DCIR cold start

   Part B: Temperature Derating sheet (new Engineering sub-tab)
     - Discharge power derating vs cell temperature
     - Charge derating vs temperature + SoC
     - OCV sag at low SoC
     - Auto-links from S state (V_nom, I_max, T limits)
     - Canvas chart + results table
   ═══════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════
   PART A — TVR EXTENDED CHECKS
   Patches runTVR() to append additional rows
   ════════════════════════════════════════════════════ */
(function patchTVR() {
  const _orig = window.runTVR;
  window.runTVR = function() {
    /* Run original first */
    if (typeof _orig === 'function') _orig();

    const tbody = document.getElementById('tvr_tbody');
    if (!tbody) return;

    const S   = window.S || {};
    const sv  = (k, fb=0) => { const v=S[k]; return (v!==undefined&&v!==null)?+v:fb; };
    const gv  = id => { const el=document.getElementById(id); return el?+el.value||0:0; };

    const badge = (pass, warn) =>
      pass  ? '<span style="display:inline-block;padding:3px 10px;background:rgba(0,212,170,.15);border:1px solid rgba(0,212,170,.4);border-radius:5px;color:#00d4aa;font-size:12px;font-weight:700">✓ PASS</span>'
      : warn? '<span style="display:inline-block;padding:3px 10px;background:rgba(245,197,24,.12);border:1px solid rgba(245,197,24,.4);border-radius:5px;color:#f5c518;font-size:12px;font-weight:700">⚠ CAUTION</span>'
      :       '<span style="display:inline-block;padding:3px 10px;background:rgba(255,77,109,.12);border:1px solid rgba(255,77,109,.4);border-radius:5px;color:#ff4d6d;font-size:12px;font-weight:700">✗ FAIL</span>';

    const mkRow = (param, mod, tgtVal, resVal, unit, pass, warn, note='') => {
      const fmt = v => (v===null||v===undefined||v==='') ? '—' : String(v)+unit;
      const mNum = (tgtVal!==null&&resVal!==null&&!isNaN(+resVal)&&!isNaN(+tgtVal)) ? (+resVal - +tgtVal) : null;
      const mStr = mNum!==null ? (mNum>=0?'+':'')+mNum.toFixed(2)+unit : '—';
      const mCol = mNum===null?'#6d8fba': pass?'#00d4aa': warn?'#f5c518':'#ff4d6d';
      const rowBg = pass?'' : warn?'background:rgba(245,197,24,.04)':'background:rgba(255,77,109,.04)';
      return `<tr style="border-bottom:1px solid var(--border);${rowBg}">
        <td style="padding:10px 14px;font-size:13px;font-weight:600;color:var(--text)">${param}</td>
        <td style="padding:10px 14px;text-align:center"><span style="font-size:11px;background:var(--bg3);border:1px solid var(--border);padding:2px 8px;border-radius:4px;color:var(--text2)">${mod}</span></td>
        <td style="padding:10px 14px;text-align:right;font-family:var(--mono);font-size:13px;color:#4a9eff">${fmt(tgtVal)}</td>
        <td style="padding:10px 14px;text-align:right;font-family:var(--mono);font-size:14px;font-weight:700;color:#f5c518">${fmt(resVal)}</td>
        <td style="padding:10px 14px;text-align:right;font-family:var(--mono);font-size:12px;color:${mCol}">${mStr}</td>
        <td style="padding:10px 14px;text-align:center">${badge(pass,warn)}</td>
        <td style="padding:10px 14px;font-size:12px;color:var(--text3)">${note}</td>
      </tr>`;
    };

    const addRows = [];
    let addPass=0, addWarn=0, addFail=0;
    const track = (html, p, w) => { addRows.push(html); if(p) addPass++; else if(w) addWarn++; else addFail++; };

    /* Shorthand values */
    const Ss    = sv('S_total', 112);
    const Pp    = sv('c_pp', 1);
    const Vnom  = sv('V_nom_pack', 358);
    const Qpack = sv('Q_pack', 120);
    const Eg    = sv('E_gross', 43);
    const ir_bol= sv('c_ir_bol', 0.22);
    const ir_eol= sv('c_ir_eol', 0.35);
    const Ppeak = sv('t_ppeak', 80);
    const I_peak= Vnom>0 ? Ppeak*1000/Vnom : 300;
    const pm    = sv('pack_mass', 0);

    /* ── DCIR & Resistance ── */
    const pack_ir_bol = ir_bol * Ss / Pp; // mΩ pack level
    const pack_ir_eol = ir_eol * Ss / Pp;
    const ir_growth   = ir_bol > 0 ? (ir_eol / ir_bol) : 0;
    track(mkRow('Pack IR BoL @25°C/50%SoC', 'Resistance', '≤500', pack_ir_bol.toFixed(1), ' mΩ',
      pack_ir_bol<=500, pack_ir_bol<=600, `${Ss}S/${Pp}P × ${ir_bol} mΩ/cell`), pack_ir_bol<=500, pack_ir_bol<=600);
    track(mkRow('IR Growth BoL→EoL', 'DCIR', '≤2.0', ir_growth>0?ir_growth.toFixed(2):'—', '×',
      ir_growth<=2.0||ir_growth===0, ir_growth<=2.5||ir_growth===0, `${ir_bol}→${ir_eol} mΩ`), ir_growth<=2.0||ir_growth===0, ir_growth<=2.5||ir_growth===0);

    /* ── DCIR cold-start voltage drop ── */
    const dcirCold = ir_bol * 4.5 * Ss / Pp; // ×4.5 at -10°C / 20%SoC (from DCIR model)
    const Vdrop_cold = dcirCold * 1e-3 * I_peak;
    const Vdrop_pct  = Vnom > 0 ? Vdrop_cold / Vnom * 100 : 0;
    track(mkRow('Cold-start ΔV (−10°C, 20%SoC)', 'DCIR', '≤5', Vdrop_pct.toFixed(1), ' % V_nom',
      Vdrop_pct<=5, Vdrop_pct<=8, `${Vdrop_cold.toFixed(1)}V drop at ${I_peak.toFixed(0)}A peak`), Vdrop_pct<=5, Vdrop_pct<=8);

    /* ── BMS thresholds ── */
    const c_vmax = sv('c_vmax', 4.2);
    const c_vmin = sv('c_vmin', 2.8);
    const c_vnom = sv('c_vnom', 3.7);
    const bms_ovp = c_vmax + 0.05;  // OVP = Vmax + 50mV
    const bms_uvp = c_vmin - 0.05;  // UVP = Vmin - 50mV
    const bms_window = c_vmax - c_vmin;
    track(mkRow('BMS OVP threshold', 'BMS', (c_vmax+0.02).toFixed(3), bms_ovp.toFixed(3), ' V/cell',
      bms_ovp > c_vmax && bms_ovp <= c_vmax+0.1, true, `Must be above Vmax (${c_vmax}V) with <100mV margin`), bms_ovp > c_vmax, true);
    track(mkRow('Cell voltage window', 'BMS', '≥1.0', bms_window.toFixed(2), ' V',
      bms_window>=1.0, bms_window>=0.8, `${c_vmin}V–${c_vmax}V = ${bms_window.toFixed(2)}V usable`), bms_window>=1.0, bms_window>=0.8);

    /* ── IP Rating ── */
    const ip_str = S.t_ip || gv('t_ip') || 'IP67';
    const ip_num = parseInt((String(ip_str).match(/\d+/)||['67'])[0]);
    const ip_ok  = ip_num >= 67;
    const ip_warn= ip_num >= 55;
    track(mkRow('IP Rating', 'Safety', 'IP67+', ip_str, '',
      ip_ok, ip_warn, ip_ok?'Meets IEC 60529 dust+immersion':'Check IP rating against application environment'), ip_ok, ip_warn);

    /* ── Altitude ── */
    const alt = sv('t_alt', 0);
    const alt_ok  = alt <= 5000;
    const alt_warn = alt <= 4000;
    track(mkRow('Operating altitude', 'Safety', '≤5000', alt>0?alt.toFixed(0):'N/S', ' m',
      alt_ok, alt_warn, alt>3000?'Above 3000m: HV creepage clearances must be recalculated (IEC 60664)':'Standard altitude range'), alt_ok, alt_warn);

    /* ── Precharge ── */
    const pc_R = gv('pc_R') || sv('_pc_R', 0);
    const pc_t = gv('pc_t_calc') || sv('_pc_t', 0);
    const pc_ok = pc_t > 0 ? pc_t <= 5 : null;
    track(mkRow('Precharge time', 'Precharge', '≤5', pc_t>0?pc_t.toFixed(2):'Run tab', ' s',
      pc_ok??true, pc_ok??true, pc_R>0?`R=${pc_R}Ω`:'Open Precharge tab to calculate'), pc_ok??true, pc_ok??true);

    /* ── Drive Cycle P_avg ── */
    const dc_pavg = sv('dc_pavg', 0) || gv('dc_pavg');
    const Pcont_t = sv('t_pcont', 50);
    const pavg_ok = dc_pavg>0 ? dc_pavg <= Pcont_t : null;
    track(mkRow('Cycle avg power vs P_cont', 'Drive Cycle', Pcont_t.toFixed(0), dc_pavg>0?dc_pavg.toFixed(1):'Upload cycle', ' kW',
      pavg_ok??true, pavg_ok??true, dc_pavg>0?`P_avg ${dc_pavg.toFixed(1)}kW from drive cycle`:'Upload work cycle CSV to check'), pavg_ok??true, pavg_ok??true);

    /* ── Gravimetric Energy Density (pack level) ── */
    const ged_t = sv('t_ged', 100);
    const ged_r = pm > 0 && Eg > 0 ? (Eg*1000/pm) : 0;
    track(mkRow('Pack Gravimetric ED', 'Cell', ged_t.toFixed(0), ged_r>0?ged_r.toFixed(0):'—', ' Wh/kg',
      ged_r>=ged_t||ged_r===0, ged_r>=ged_t*0.9||ged_r===0, pm>0?`${Eg.toFixed(1)}kWh ÷ ${pm.toFixed(0)}kg`:'Fill pack mass in Cell tab'), ged_r>=ged_t||ged_r===0, ged_r>=ged_t*0.9||ged_r===0);

    /* ── Voltage class (HV safety) ── */
    const Vmax_pack = sv('V_max_pack', 420);
    const voltClass = Vmax_pack > 1000 ? 'Class C' : Vmax_pack > 60 ? 'Class B' : 'Class A';
    const vclass_ok = Vmax_pack <= 1000; // Class B acceptable for most EVs
    track(mkRow('HV Voltage Class', 'HV Safety', 'Class B (≤1000V)', `${voltClass} (${Vmax_pack.toFixed(0)}V)`, '',
      vclass_ok, true, `IEC 6469-1: ${voltClass} — ${vclass_ok?'standard EV safety rules apply':'Class C requires specialist lab'}`), vclass_ok, true);

    /* ── Charge temp window ── */
    const tchg_lo = sv('t_tchg_lo', -10);
    const tchg_hi = sv('t_tchg_hi', 45);
    const window_ok = tchg_hi - tchg_lo >= 40;
    track(mkRow('Charge temp window width', 'Charging', '≥40', (tchg_hi-tchg_lo).toFixed(0), ' °C',
      window_ok, tchg_hi-tchg_lo>=30, `${tchg_lo}°C → ${tchg_hi}°C. Min 40°C window for usability`), window_ok, tchg_hi-tchg_lo>=30);

    /* ── Regen capability ── */
    const Pregen = Ppeak * 0.4; // typical regen = 40% of peak
    const soc_regen = sv('t_dod', 0.9) * 100;
    track(mkRow('Regen headroom @90%SoC', 'Energy', '≥10', soc_regen<100?`${(100-soc_regen).toFixed(0)}`:'—', ' % SoC margin',
      soc_regen<100, soc_regen<=98, `DoD=${(sv('t_dod',0.9)*100).toFixed(0)}% → top ${(100-soc_regen).toFixed(0)}% SoC available for regen`), soc_regen<100, soc_regen<=98);

    /* ── Append new rows to table ── */
    if (addRows.length) {
      /* Section divider */
      const divider = `<tr><td colspan="7" style="padding:8px 14px;background:var(--bg3);font-size:10px;font-family:var(--mono);color:var(--teal);letter-spacing:.1em;font-weight:700;text-transform:uppercase">
        ── Extended Checks: DCIR · BMS · Safety · Drive Cycle ──
      </td></tr>`;
      tbody.insertAdjacentHTML('beforeend', divider + addRows.join(''));
    }

    /* Update KPI counts (add to existing) */
    const passEl = document.getElementById('tvr_pass_count');
    const warnEl = document.getElementById('tvr_warn_count');
    const failEl = document.getElementById('tvr_fail_count');
    if (passEl) passEl.textContent = (+passEl.textContent||0) + addPass;
    if (warnEl) warnEl.textContent = (+warnEl.textContent||0) + addWarn;
    if (failEl) failEl.textContent = (+failEl.textContent||0) + addFail;

    /* Update verdict */
    const totalFail = +(failEl?.textContent||0);
    const totalWarn = +(warnEl?.textContent||0);
    const verdict = totalFail > 0
      ? {t:'✗ NO-GO', c:'#ff4d6d', bg:'rgba(255,77,109,.12)', bc:'rgba(255,77,109,.4)'}
      : totalWarn > 0
      ? {t:'⚠ CAUTION', c:'#f5c518', bg:'rgba(245,197,24,.12)', bc:'rgba(245,197,24,.4)'}
      : {t:'✓ GO', c:'#00d4aa', bg:'rgba(0,212,170,.12)', bc:'rgba(0,212,170,.4)'};
    const vc=document.getElementById('tvr_verdict_card');
    const ve=document.getElementById('tvr_verdict');
    if(vc){vc.style.background=verdict.bg;vc.style.borderColor=verdict.bc;}
    if(ve){ve.textContent=verdict.t;ve.style.color=verdict.c;}

    /* ── Export button (add once) ── */
    if (!document.getElementById('tvr_export_btn')) {
      const btn = document.createElement('button');
      btn.id = 'tvr_export_btn';
      btn.textContent = '⬇ Export TVR CSV';
      btn.style.cssText = 'margin-left:12px;padding:9px 20px;background:rgba(74,158,255,.1);border:1px solid rgba(74,158,255,.3);color:var(--blue2);border-radius:7px;font-size:12px;font-weight:700;cursor:pointer';
      btn.onclick = tvrExportCSV;
      document.querySelector('#panel-engineering [onclick="runTVR()"]')?.insertAdjacentElement('afterend', btn);
    }
  };
})();

function tvrExportCSV() {
  const rows = document.querySelectorAll('#tvr_tbody tr');
  const lines = ['Parameter,Module,Target,Result,Margin,Status,Notes'];
  rows.forEach(r => {
    const cells = r.querySelectorAll('td');
    if (cells.length >= 7) {
      const cols = Array.from(cells).map(c => '"' + c.textContent.trim().replace(/"/g,'""') + '"');
      lines.push(cols.join(','));
    }
  });
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
  a.download = 'BatteryMIS_TVR_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}

/* ════════════════════════════════════════════════════
   PART B — TEMPERATURE DERATING SHEET
   Renders into id="derating" section
   ════════════════════════════════════════════════════ */
window.renderDerating = function() {
  const root = document.getElementById('derating_root');
  if (!root) return;
  const S = window.S || {};
  const srcN = id => { const el=document.getElementById(id); return (el&&el.value!=='')?+el.value:null; };
  const srcS = id => { const el=document.getElementById(id); return el?el.value:null; };

  // ALL values: source DOM first, then S, then sensible fallback
  const chem      = (srcS('c_chem') || S.c_chem || 'LFP').split(' ')[0].toUpperCase();
  const P_peak    = srcN('t_ppeak')    ?? S.t_ppeak    ?? 80;
  const P_cont    = srcN('t_pcont')    ?? S.t_pcont    ?? 50;
  const T_cell_max= srcN('t_tcell_max')?? S.t_tcell_max?? 55;
  const T_derate  = T_cell_max - 10;
  const T_op_lo   = srcN('t_top_lo')   ?? S.t_top_lo   ?? -20;
  const T_op_hi   = srcN('t_top_hi')   ?? S.t_top_hi   ?? 45;
  const V_nom     = S.V_nom_pack || ((srcN('c_cps')||14)*(srcN('c_ss')||8)*(srcN('c_vnom')||S.c_vnom||3.2)) || 400;
  const V_max     = S.V_max_pack || 420;
  const V_min     = S.V_min_pack || 280;
  const ir_bol    = srcN('c_ir_bol')   ?? S.c_ir_bol   ?? 0.22;
  const c_ir_eol  = srcN('c_ir_eol')   ?? S.c_ir_eol   ?? 0.35;
  const S_total   = (srcN('c_cps')||S.c_cps||14)*(srcN('c_ss')||S.c_ss||8);
  const c_pp      = S.c_pp    || srcN('c_pp') || 1;
  const c_ah      = srcN('c_ah') ?? S.c_ah ?? 120;
  const config    = S.config_label || S_total+'S/'+c_pp+'P';
  const cycles    = S.t_cycles   || 3000;

  // DCIR-linked derating: IR growth affects available power at temperature
  const ir_pack_bol = ir_bol * S_total / c_pp;  // mΩ pack BoL
  const ir_pack_eol = c_ir_eol * S_total / c_pp;// mΩ pack EoL
  
  // I_peak at different life stages
  const I_peak_bol = V_nom > 0 ? P_peak * 1000 / V_nom : 0;
  const I_cont_bol = V_nom > 0 ? P_cont * 1000 / V_nom : 0;
  const V_drop_bol = ir_pack_bol * 1e-3 * I_peak_bol;
  const V_drop_eol = ir_pack_eol * 1e-3 * I_peak_bol;
  const V_drop_pct_bol = V_nom > 0 ? (V_drop_bol / V_nom * 100) : 0;
  const V_drop_pct_eol = V_nom > 0 ? (V_drop_eol / V_nom * 100) : 0;

  // Temperature derating profile (generic, chemistry-specific)
  // Based on DCIR map principle: IR increases at low T → power capability drops
  const tempPoints = [];
  for (let T = T_op_lo; T <= T_cell_max + 5; T += 5) {
    let factor = 1.0;
    // Below 0°C: IR roughly doubles per -10°C for Li-ion
    if (T < 0)    factor = Math.max(0.1, 1 - (0 - T) * (chem==='LFP'?0.025:0.035));
    // 0–T_derate: nominal
    if (T >= 0 && T <= T_derate) factor = 1.0;
    // T_derate → T_cell_max: linear derating to 0
    if (T > T_derate && T <= T_cell_max) factor = Math.max(0, 1 - (T - T_derate) / (T_cell_max - T_derate));
    // Above T_cell_max: 0 (cutoff)
    if (T > T_cell_max) factor = 0;
    // Cold temperature also affects charge
    let chg_factor = factor;
    if (T < 0)  chg_factor = Math.max(0, 0.3 + T * 0.03);   // charge severely limited below 0°C
    if (T < -10) chg_factor = 0;
    tempPoints.push({ T, factor, chg_factor,
      P_dis: P_peak * factor,
      P_chg: (S.t_pdc||60) * chg_factor,
      I_dis: (P_peak * factor * 1000) / V_nom,
      C_dis: c_ah > 0 ? (P_peak * factor * 1000) / (V_nom * c_ah * c_pp) : 0,
    });
  }

  // Build derating table rows
  const tableRows = tempPoints.map(p => {
    const inOpRange = p.T >= T_op_lo && p.T <= T_op_hi;
    const bg = p.T > T_cell_max ? 'rgba(255,77,109,.04)' :
               p.T > T_derate   ? 'rgba(245,197,24,.04)' :
               p.T < 0          ? 'rgba(74,158,255,.04)' : '';
    const pCol = p.factor>=1?'var(--g)':p.factor>=0.7?'var(--y)':p.factor>0?'var(--r)':'rgba(255,255,255,.2)';
    return `<tr style="background:${bg};border-bottom:1px solid var(--border)">
      <td style="padding:6px 10px;font-family:var(--mono);font-weight:700;color:${inOpRange?'var(--text)':'var(--text3)'}">${p.T > 0 ? '+' : ''}${p.T}°C${inOpRange?'':' ⚠'}</td>
      <td style="padding:6px 10px;font-family:var(--mono);color:${pCol}">${(p.factor*100).toFixed(0)}%</td>
      <td style="padding:6px 10px;font-family:var(--mono);color:${pCol}">${p.P_dis.toFixed(1)} kW</td>
      <td style="padding:6px 10px;font-family:var(--mono);color:${p.chg_factor<0.5?'var(--r)':'var(--text2)'}">${p.P_chg.toFixed(1)} kW</td>
      <td style="padding:6px 10px;font-family:var(--mono);color:${p.C_dis>2?'var(--r)':p.C_dis>1?'var(--y)':'var(--g)'}">${p.C_dis.toFixed(3)} C</td>
      <td style="padding:6px 10px;font-size:10px;color:var(--text3)">${p.T>T_cell_max?'BMS cutoff':p.T>T_derate?'Active derate':p.T<0?'Cold limit':'Nominal'}</td>
    </tr>`;
  }).join('');

  root.innerHTML = `
<div class="ico-banner" style="margin-bottom:12px">
  🔗 All values from Cell Inputs + Project Targets · ${chem} · ${config} · DCIR BoL ${ir_pack_bol.toFixed(1)}mΩ
</div>

<div class="g3" style="margin-bottom:16px">
  ${[
    {l:'P_peak (project)',   v:P_peak+' kW',          c:'var(--g)'},
    {l:'P_cont (project)',   v:P_cont+' kW',           c:'var(--b)'},
    {l:'T_cell_max (cutoff)',v:T_cell_max+'°C',        c:'var(--r)'},
    {l:'T_derate start',     v:T_derate+'°C',           c:'var(--y)'},
    {l:'T_op range',         v:T_op_lo+'→'+T_op_hi+'°C', c:'var(--text)'},
    {l:'Pack IR BoL',        v:ir_pack_bol.toFixed(1)+' mΩ', c:'var(--text)'},
    {l:'Pack IR EoL',        v:ir_pack_eol.toFixed(1)+' mΩ', c:'var(--y)'},
    {l:'V_drop @I_peak BoL', v:V_drop_pct_bol.toFixed(1)+'% V_nom', c:V_drop_pct_bol>5?'var(--r)':'var(--g)'},
    {l:'V_drop @I_peak EoL', v:V_drop_pct_eol.toFixed(1)+'% V_nom', c:V_drop_pct_eol>5?'var(--r)':'var(--y)'},
  ].map(k=>`<div class="kpi-card" style="border-color:${k.c}22">
    <div class="kpi-v" style="color:${k.c};font-size:14px">${k.v}</div>
    <div class="kpi-l">${k.l}</div>
  </div>`).join('')}
</div>

<div class="card" style="margin-bottom:14px">
  <div class="ch3">📉 Derating Curve — ${chem} · ${config} · Linked from Project Targets + Cell Inputs</div>
  <canvas id="derating_canvas" height="240" style="width:100%;display:block;border-radius:6px;background:var(--bg);margin-top:8px"></canvas>
  <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-size:9px;font-family:var(--mono)">
    <span style="color:var(--g)">━ Discharge power (kW) at temperature</span>
    <span style="color:var(--b)">━ Charge power (kW) at temperature</span>
    <span style="color:rgba(255,77,109,.6)">┅ T_cell_max cutoff</span>
    <span style="color:rgba(245,197,24,.6)">┅ T_derate start</span>
  </div>
</div>

<div class="card" style="margin-bottom:14px">
  <div class="ch3">📋 Derating Table — Calculated from DCIR Map + Project Targets</div>
  <div style="font-size:11px;color:var(--text3);margin-bottom:8px">
    Based on: ${chem} cell · ${config} · DCIR BoL ${ir_bol}mΩ/cell · T_cell_max ${T_cell_max}°C · P_peak ${P_peak}kW from Project Targets
  </div>
  <div style="overflow-x:auto">
  <table style="border-collapse:collapse;width:100%;min-width:600px">
    <thead style="background:var(--bg3)"><tr>
      <th style="padding:7px 10px;text-align:left;font-size:11px;color:var(--text3);border-bottom:2px solid var(--border2)">Cell Temp</th>
      <th style="padding:7px 10px;text-align:left;font-size:11px;color:var(--text3);border-bottom:2px solid var(--border2)">Derating %</th>
      <th style="padding:7px 10px;text-align:left;font-size:11px;color:var(--text3);border-bottom:2px solid var(--border2)">P_dis available</th>
      <th style="padding:7px 10px;text-align:left;font-size:11px;color:var(--text3);border-bottom:2px solid var(--border2)">P_chg available</th>
      <th style="padding:7px 10px;text-align:left;font-size:11px;color:var(--text3);border-bottom:2px solid var(--border2)">C-rate dis</th>
      <th style="padding:7px 10px;text-align:left;font-size:11px;color:var(--text3);border-bottom:2px solid var(--border2)">State</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  </div>
</div>

<div class="ico-banner">
  ⚠ Highlighted temperatures: Orange = outside project T_op range (${T_op_lo}→${T_op_hi}°C). 
  Red = above T_cell_max cutoff. Blue = cold region requiring heating.
  Derating factors are chemistry-generic estimates — upload DCIR map for cell-specific accuracy.
</div>`;

  // Draw derating canvas
  requestAnimationFrame(() => {
    const cv = document.getElementById('derating_canvas');
    if (!cv) return;
    const W = cv.offsetWidth || 700, H = 240;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const pad = {l:52,r:20,t:16,b:36};
    const pw = W-pad.l-pad.r, ph = H-pad.t-pad.b;
    const T_all = tempPoints.map(p=>p.T);
    const Tmin = Math.min(...T_all), Tmax = Math.max(...T_all);
    const mx = T => pad.l + (T-Tmin)/(Tmax-Tmin)*pw;
    const my = P => pad.t + ph*(1 - P/P_peak);

    ctx.fillStyle = '#07080b'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;
    [0,.25,.5,.75,1].forEach(f=>{
      const y=pad.t+ph*f,P=P_peak*(1-f);
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
      ctx.fillStyle='#3a567a';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='right';
      ctx.fillText(P.toFixed(0),pad.l-2,y+3);
    });
    // Temperature tick labels
    [-20,-10,0,10,25,45,55,60,70].filter(T=>T>=Tmin&&T<=Tmax).forEach(T=>{
      const x=mx(T);
      ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();
      ctx.fillStyle='#3a567a';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='center';
      ctx.fillText(T+'°C',x,H-pad.b+12);
    });
    // Threshold lines
    [[T_cell_max,'rgba(255,77,109,.5)','T_max'],[T_derate,'rgba(245,197,24,.5)','T_derate'],[0,'rgba(74,158,255,.3)','0°C']].forEach(([T,c,l])=>{
      if(T<Tmin||T>Tmax) return;
      const x=mx(T);
      ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.setLineDash([5,4]);
      ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=c;ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='left';
      ctx.fillText(l,x+3,pad.t+10);
    });
    // Discharge curve
    ctx.beginPath();ctx.strokeStyle='#00d4aa';ctx.lineWidth=2.5;
    tempPoints.forEach((p,i)=>i===0?ctx.moveTo(mx(p.T),my(p.P_dis)):ctx.lineTo(mx(p.T),my(p.P_dis)));
    ctx.stroke();
    // Charge curve
    ctx.beginPath();ctx.strokeStyle='#4a9eff';ctx.lineWidth=2;
    tempPoints.forEach((p,i)=>i===0?ctx.moveTo(mx(p.T),my(p.P_chg)):ctx.lineTo(mx(p.T),my(p.P_chg)));
    ctx.stroke();
    // Operating range shading
    const x_lo=mx(T_op_lo),x_hi=mx(T_op_hi);
    ctx.fillStyle='rgba(0,212,170,.04)';
    ctx.fillRect(x_lo,pad.t,x_hi-x_lo,ph);
    ctx.fillStyle='#4a6080';ctx.font='10px JetBrains Mono,monospace';ctx.textAlign='center';
    ctx.fillText('kW',pad.l-35,pad.t+ph/2);
  });
};


/* Hook showSec for derating tab */
(function() {
  const _orig = window.showSec;
  window.showSec = function(id, btn) {
    if (typeof _orig === 'function') _orig(id, btn);
    if (id === 'derating') {
      setTimeout(() => { try { renderDerating(); } catch(e) { console.warn('derating', e); }}, 60);
    }
  };
  /* Re-render on propagate if derating visible */
  const _origProp = window.propagate;
  window.propagate = function() {
    if (typeof _origProp === 'function') _origProp.apply(this, arguments);
    try {
      if (document.getElementById('derating')?.classList.contains('active')) renderDerating();
    } catch(e) {}
  };
})();
