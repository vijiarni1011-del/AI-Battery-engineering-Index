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

  const S    = window.S || {};
  const Vnom = S.V_nom_pack || 400;
  const Qah  = S.Q_pack     || 120;
  const Imax = S.t_ppeak ? (S.t_ppeak * 1000 / Vnom) : 300;
  const ir   = S.c_ir_bol   || 0.22;   // mΩ cell
  const Ss   = S.S_total    || 112;
  const Pp   = S.c_pp       || 1;
  const Tcell_max = S.t_tcell_max || 55;
  const T_derate  = Tcell_max - 10;
  const T_amb     = S.t_top_hi || 45;
  const chem      = (S.c_chem || 'NMC').split(' ')[0].toUpperCase();

  /* Discharge derating: piecewise linear function of T_cell */
  const DERATE_DIS = [
    { t:-30, f:0.00 }, { t:-20, f:0.10 }, { t:-10, f:0.30 },
    { t:0,   f:0.60 }, { t:10, f:0.85 },  { t:20, f:1.00 },
    { t:25,  f:1.00 }, { t:T_derate, f:1.00 }, { t:Tcell_max, f:0.50 }, { t:Tcell_max+10, f:0.00 }
  ];

  /* Charge derating: more conservative at high and low T */
  const DERATE_CHG = [
    { t:-20, f:0.00 }, { t:-10, f:0.05 }, { t:0, f:0.20 },
    { t:5,   f:0.50 }, { t:10, f:0.80 },  { t:20, f:1.00 },
    { t:25,  f:1.00 }, { t:40, f:1.00 },  { t:45, f:0.60 }, { t:50, f:0.00 }
  ];

  const interp = (table, t) => {
    if (t <= table[0].t) return table[0].f;
    if (t >= table[table.length-1].t) return table[table.length-1].f;
    for (let i=1; i<table.length; i++) {
      if (table[i].t >= t) {
        const frac = (t - table[i-1].t) / (table[i].t - table[i-1].t);
        return table[i-1].f + frac * (table[i].f - table[i-1].f);
      }
    }
    return 1;
  };

  /* Test temperatures */
  const TEMPS = [-30,-20,-10,0,5,10,15,20,25,30,35,40,45,50,55,60];

  /* Build table rows */
  const tableRows = TEMPS.map(t => {
    const fd   = interp(DERATE_DIS, t);
    const fc   = interp(DERATE_CHG, t);
    const Pd   = (S.t_ppeak || 80) * fd;
    const Pc   = (S.t_pdc   || 60) * fc;
    const Id   = fd * Imax;
    const Vdrop= (ir * Ss / Pp * 1e-3) * Id;
    const pctD = (fd*100).toFixed(0);
    const pctC = (fc*100).toFixed(0);
    const colD = fd<0.4?'var(--r)':fd<0.7?'var(--o)':fd<0.9?'var(--y)':'var(--g)';
    const colC = fc<0.4?'var(--r)':fc<0.5?'var(--o)':fc<0.9?'var(--y)':'var(--g)';
    const isNom = t===25;
    const style = isNom ? 'background:rgba(0,212,170,.06);font-weight:700' : '';
    return `<tr style="${style}border-bottom:1px solid var(--border)">
      <td style="padding:7px 12px;font-family:var(--mono);font-size:12px;${t<0?'color:var(--b)':t>T_derate?'color:var(--r)':''}">${t}°C${isNom?' ←nom':''}</td>
      <td style="padding:7px 12px;font-family:var(--mono);font-size:12px;color:${colD};text-align:center">${pctD}%</td>
      <td style="padding:7px 12px;font-family:var(--mono);font-size:13px;font-weight:700;color:${colD};text-align:right">${Pd.toFixed(0)} kW</td>
      <td style="padding:7px 12px;font-family:var(--mono);font-size:12px;color:${colC};text-align:center">${pctC}%</td>
      <td style="padding:7px 12px;font-family:var(--mono);font-size:13px;font-weight:700;color:${colC};text-align:right">${Pc.toFixed(0)} kW</td>
      <td style="padding:7px 12px;font-family:var(--mono);font-size:12px;text-align:right;color:var(--text2)">${Id.toFixed(0)} A</td>
      <td style="padding:7px 12px;font-family:var(--mono);font-size:12px;text-align:right;color:${Vdrop/Vnom>0.05?'var(--r)':'var(--text2)'}">${Vdrop.toFixed(1)} V</td>
    </tr>`;
  }).join('');

  /* Canvas chart */
  root.innerHTML = `
<div class="g3" style="margin-bottom:16px">
  <div class="kpi-card" style="border-color:rgba(0,212,170,.3)">
    <div class="kpi-v" style="color:var(--g)">${(S.t_ppeak||80)} kW</div>
    <div class="kpi-l">Peak Discharge @ 25°C</div>
  </div>
  <div class="kpi-card" style="border-color:rgba(255,123,53,.3)">
    <div class="kpi-v" style="color:var(--o)">${((S.t_ppeak||80)*0.3).toFixed(0)} kW</div>
    <div class="kpi-l">Discharge @ −10°C (30%)</div>
  </div>
  <div class="kpi-card" style="border-color:rgba(255,77,109,.3)">
    <div class="kpi-v" style="color:var(--r)">${Tcell_max}°C</div>
    <div class="kpi-l">Cutoff Threshold</div>
  </div>
  <div class="kpi-card" style="border-color:rgba(74,158,255,.3)">
    <div class="kpi-v" style="color:var(--b)">${T_derate}°C</div>
    <div class="kpi-l">Derate Start Threshold</div>
  </div>
</div>

<!-- Canvas -->
<div class="card" style="margin-bottom:16px;padding-bottom:12px">
  <div class="ch3">📉 Derating Curve — ${chem} · V_nom ${Vnom.toFixed(0)}V · P_peak ${S.t_ppeak||80}kW</div>
  <canvas id="derate_canvas" height="240" style="width:100%;display:block;margin-top:10px;border-radius:6px;background:var(--bg)"></canvas>
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:10px;font-family:var(--mono)">
    <span style="color:#00d4aa">━ Discharge derating</span>
    <span style="color:#4a9eff">━ Charge derating</span>
    <span style="color:#f5c518;opacity:.7">┅ Derate threshold ${T_derate}°C</span>
    <span style="color:#ff4d6d;opacity:.7">┅ Cutoff ${Tcell_max}°C</span>
  </div>
</div>

<!-- Table -->
<div class="card" style="overflow-x:auto">
  <div class="ch3">📋 Derating Table — All Operating Temperatures</div>
  <div style="font-size:10px;color:var(--text3);margin-bottom:10px">Auto-linked from Project Targets (P_peak, T_cell_max) and Cell Inputs (chemistry)</div>
  <table class="res-tbl" style="min-width:600px">
    <thead><tr>
      <th>T_cell</th>
      <th>Discharge %</th><th>P_discharge</th>
      <th>Charge %</th><th>P_charge</th>
      <th>I_max</th><th>Pack ΔV</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>

<div class="ico-banner" style="margin-top:14px">
  📌 Methodology: Piecewise linear derating model. Discharge: cold-derate below ${T_derate}°C, hot-derate above ${T_derate}°C (${chem} characteristic).
  Charge: inhibit below 0°C, derate 0–10°C (lithium plating risk). Cutoff: ${Tcell_max}°C (from Project Targets).
  <strong>Update Project Targets → T_cell_max to refresh.</strong>
</div>`;

  /* Draw canvas */
  requestAnimationFrame(() => {
    const canvas = document.getElementById('derate_canvas');
    if (!canvas) return;
    const W = canvas.offsetWidth || 800, H = 240;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    const tMin=-30, tMax=65;
    const pad={l:48,r:16,t:16,b:32};
    const pw=W-pad.l-pad.r, ph=H-pad.t-pad.b;
    const mapX = t => pad.l + (t-tMin)/(tMax-tMin)*pw;
    const mapY = f => pad.t + ph*(1-f);

    /* Grid */
    ctx.strokeStyle='rgba(255,255,255,.05)'; ctx.lineWidth=1;
    [0,0.25,0.5,0.75,1.0].forEach(f => {
      const y=mapY(f);
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();
      ctx.fillStyle='#3a567a'; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='right';
      ctx.fillText((f*100).toFixed(0)+'%', pad.l-4, y+3);
    });
    [-30,-20,-10,0,10,20,30,40,50,60].forEach(t => {
      const x=mapX(t);
      ctx.beginPath(); ctx.moveTo(x,pad.t); ctx.lineTo(x,H-pad.b); ctx.stroke();
      ctx.fillStyle='#3a567a'; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='center';
      ctx.fillText(t+'°', x, H-pad.b+12);
    });

    /* Threshold lines */
    const drawThresh = (t, col, label) => {
      const x=mapX(t);
      ctx.strokeStyle=col; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(x,pad.t); ctx.lineTo(x,H-pad.b); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=col; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='left';
      ctx.fillText(label, x+3, pad.t+10);
    };
    drawThresh(T_derate, 'rgba(245,197,24,.6)', 'Derate');
    drawThresh(Tcell_max, 'rgba(255,77,109,.6)', 'Cutoff');
    drawThresh(0, 'rgba(74,158,255,.4)', '0°C');

    /* Discharge curve */
    ctx.beginPath(); ctx.strokeStyle='#00d4aa'; ctx.lineWidth=2.5; ctx.setLineDash([]);
    DERATE_DIS.forEach((p,i) => {
      const x=mapX(p.t), y=mapY(p.f);
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();

    /* Area fill under discharge */
    ctx.beginPath();
    DERATE_DIS.forEach((p,i) => { const x=mapX(p.t),y=mapY(p.f); i===0?ctx.moveTo(x,H-pad.b):ctx.lineTo(x,y); });
    DERATE_DIS.slice().reverse().forEach(p => ctx.lineTo(mapX(p.t), H-pad.b));
    ctx.fillStyle='rgba(0,212,170,.06)'; ctx.fill();

    /* Charge curve */
    ctx.beginPath(); ctx.strokeStyle='#4a9eff'; ctx.lineWidth=2; ctx.setLineDash([6,3]);
    DERATE_CHG.forEach((p,i) => {
      const x=mapX(p.t), y=mapY(p.f);
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke(); ctx.setLineDash([]);

    /* Axis labels */
    ctx.fillStyle='#4a6080'; ctx.font='10px JetBrains Mono,monospace'; ctx.textAlign='center';
    ctx.fillText('Cell Temperature (°C)', pad.l+pw/2, H-2);
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
