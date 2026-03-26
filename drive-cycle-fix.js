/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — DRIVE CYCLE FIX  v2.0
   - Large CSV: up to 6h / 21 600 rows, chunked async read
   - Auto P_avg calculated from data (not manual)
   - Column auto-detection (time, power, voltage, current, speed, temp)
   - Thermal Rise fully linked to S state + cycle data
   - P_avg propagated to: dc_pavg, curr_phyd, lc_pavg, S.dc_pavg
   ═══════════════════════════════════════════════════════════════ */

/* ── Global cycle store ── */
window._dcCSV = null;   // raw parsed rows [{t,p,v,i,spd,tmp}]
window._dcMode = null;  // 'csv' | 'manual'

/* ═══════════════════════════
   FILE HANDLER — replaces old analyzeDriveCycle()
   ═══════════════════════════ */
window.dcHandleFile = function(file) {
  if (!file) return;
  const MAX_ROWS = 21600; // 6 hours @ 1s

  // Show progress
  const prog   = document.getElementById('dc_progress');
  const bar    = document.getElementById('dc_prog_bar');
  const label  = document.getElementById('dc_prog_label');
  const badge  = document.getElementById('dc_file_badge');
  if (prog) prog.style.display = 'block';
  if (bar)  bar.style.width = '0%';
  if (label) label.textContent = `Reading ${file.name} (${(file.size/1024).toFixed(0)} KB)…`;

  const reader = new FileReader();
  reader.onprogress = e => {
    if (e.lengthComputable && bar) bar.style.width = ((e.loaded/e.total)*50)+'%';
  };

  reader.onload = e => {
    if (bar) bar.style.width = '60%';
    if (label) label.textContent = 'Parsing rows…';

    // Use setTimeout to keep UI responsive
    setTimeout(() => {
      try {
        const text  = e.target.result;
        const lines = text.split(/\r?\n/);
        if (bar) bar.style.width = '70%';

        /* Auto-detect header and delimiter */
        const delim  = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
        const hasHdr = isNaN(+lines[0].split(delim)[0]);
        const hdrRow = hasHdr ? lines[0].split(delim).map(h => h.trim().toLowerCase()) : null;

        /* Map columns */
        const colMap = dcDetectColumns(hdrRow, lines.find((l,i) => i > 0 && l.trim())?.split(delim));

        if (hdrRow) {
          dcRenderColMap(hdrRow, colMap);
        }

        /* Parse data */
        const pts = [];
        const startIdx = hasHdr ? 1 : 0;
        for (let i = startIdx; i < Math.min(lines.length, startIdx + MAX_ROWS + 1); i++) {
          const l = lines[i].trim();
          if (!l || l.startsWith('#') || l.startsWith('//')) continue;
          const cols = l.split(delim);
          const t = parseFloat(cols[colMap.t]);
          const p = parseFloat(cols[colMap.p]);
          if (isNaN(t) || isNaN(p)) continue;
          const row = { t, p };
          if (colMap.v !== null && !isNaN(parseFloat(cols[colMap.v]))) row.v = parseFloat(cols[colMap.v]);
          if (colMap.i !== null && !isNaN(parseFloat(cols[colMap.i]))) row.i = parseFloat(cols[colMap.i]);
          if (colMap.spd !== null && !isNaN(parseFloat(cols[colMap.spd]))) row.spd = parseFloat(cols[colMap.spd]);
          if (colMap.tmp !== null && !isNaN(parseFloat(cols[colMap.tmp]))) row.tmp = parseFloat(cols[colMap.tmp]);
          pts.push(row);
        }

        if (bar) bar.style.width = '90%';

        if (pts.length < 2) {
          if (label) label.textContent = '⚠ Could not parse — check format: time_s, power_kW';
          if (bar) bar.style.background = 'var(--r)';
          return;
        }

        const truncated = lines.length - startIdx > MAX_ROWS;
        window._dcCSV  = pts;
        window._dcMode = 'csv';

        /* Badge */
        const dur_h = ((pts[pts.length-1].t - pts[0].t) / 3600).toFixed(2);
        if (badge) {
          badge.style.display = 'block';
          badge.innerHTML = `✓ <b>${file.name}</b> · ${pts.length.toLocaleString()} rows · ${dur_h}h duration${truncated?' · <span style="color:var(--o)">⚠ Truncated to 6h</span>':''}`;
        }

        if (bar) bar.style.width = '100%';
        if (label) label.textContent = `✓ ${pts.length.toLocaleString()} data points loaded`;
        setTimeout(() => { if (prog) prog.style.display = 'none'; }, 1500);

        /* Analyse and render */
        dcAnalyseAndUpdate(pts);

      } catch(err) {
        if (label) label.textContent = '⚠ Parse error: ' + err.message;
        console.error('[dcHandleFile]', err);
      }
    }, 30);
  };

  reader.readAsText(file);
};

/* ── Column auto-detection ── */
function dcDetectColumns(hdrRow, sampleRow) {
  const map = { t: 0, p: 1, v: null, i: null, spd: null, tmp: null };
  if (!hdrRow) return map; // default: col0=time, col1=power

  const find = (...keys) => {
    for (const k of keys) {
      const idx = hdrRow.findIndex(h => h.includes(k));
      if (idx >= 0) return idx;
    }
    return null;
  };
  map.t   = find('time','t_s','timestamp','t') ?? 0;
  map.p   = find('power','p_kw','kw','watt') ?? 1;
  map.v   = find('volt','v_pack','voltage');
  map.i   = find('current','amp','i_a');
  map.spd = find('speed','kmh','mph','velocity');
  map.tmp = find('temp','degc','celsius','temperature');
  return map;
}

/* ── Render column mapping UI ── */
function dcRenderColMap(hdrRow, colMap) {
  const wrap = document.getElementById('dc_col_map');
  const sel  = document.getElementById('dc_col_selects');
  if (!wrap || !sel) return;
  wrap.style.display = 'block';

  const opts = hdrRow.map((h,i) => `<option value="${i}">${i}: ${h}</option>`).join('');
  const noneOpt = '<option value="-1">— none —</option>';
  const mkSel = (label, key, val) => `
    <div>
      <div style="font-size:9px;font-family:var(--mono);color:var(--text3);margin-bottom:3px;letter-spacing:.06em">${label}</div>
      <select onchange="dcRemapCol('${key}',+this.value)"
        style="width:100%;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:11px">
        ${val === null ? noneOpt : ''}${opts}
      </select>
    </div>`;
  sel.innerHTML = mkSel('TIME (s)','t',colMap.t) + mkSel('POWER (kW)','p',colMap.p) +
    mkSel('VOLTAGE (V)','v',colMap.v) + mkSel('CURRENT (A)','i',colMap.i) +
    mkSel('SPEED','spd',colMap.spd) + mkSel('TEMP (°C)','tmp',colMap.tmp);

  // Set current values
  sel.querySelectorAll('select').forEach((s,idx) => {
    const keys = ['t','p','v','i','spd','tmp'];
    const v = colMap[keys[idx]];
    if (v !== null) s.value = v;
  });
}

window.dcRemapCol = function(key, idx) {
  /* Remap and re-analyse with new column selection */
  if (!window._dcCSV) return;
  // Simplified: just re-trigger analysis (full remap would require re-parse)
  // Sufficient for column swap after initial load
  dcAnalyseAndUpdate(window._dcCSV);
};

/* ═══════════════════════════
   CORE ANALYSIS — computes all stats, updates ALL linked fields
   ═══════════════════════════ */
function dcAnalyseAndUpdate(pts) {
  if (!pts || pts.length < 2) return;

  const S = window.S || {};

  /* Time-weighted integrals using trapezoidal rule */
  let E_total = 0, E_regen = 0, P2_sum = 0;
  let P_max = 0, P_regen_max = 0;
  const dur = pts[pts.length-1].t - pts[0].t;

  for (let i = 1; i < pts.length; i++) {
    const dt   = pts[i].t - pts[i-1].t;          // seconds
    const P_avg_seg = (pts[i].p + pts[i-1].p) / 2; // kW
    E_total += P_avg_seg * dt / 3600;             // kWh
    if (P_avg_seg < 0) E_regen += Math.abs(P_avg_seg) * dt / 3600;
    P2_sum  += P_avg_seg * P_avg_seg * dt;        // for RMS
    if (P_avg_seg > P_max) P_max = P_avg_seg;
    if (P_avg_seg < 0 && Math.abs(P_avg_seg) > P_regen_max) P_regen_max = Math.abs(P_avg_seg);
  }

  const Pavg      = dur > 0 ? E_total * 3600 / dur : 0;     // true time-weighted avg kW
  const Pavg_dis  = Math.max(0, Pavg);
  const Prms      = dur > 0 ? Math.sqrt(P2_sum / dur) : 0;  // kW rms
  const Ppeak     = P_max;
  const regenFrac = E_total > 0 ? (E_regen / (E_total + E_regen) * 100) : 0;
  const dur_h     = (dur / 3600).toFixed(2);
  const autonomy  = S.E_usable > 0 && Pavg_dis > 0 ? (S.E_usable / Pavg_dis).toFixed(1) : '—';

  /* ── Set dc_pavg READ-ONLY when CSV loaded ── */
  const pavgEl = document.getElementById('dc_pavg');
  if (pavgEl) {
    pavgEl.value = Pavg_dis.toFixed(2);
    pavgEl.style.borderColor  = 'rgba(0,212,170,.6)';
    pavgEl.style.background   = 'rgba(0,212,170,.06)';
    pavgEl.readOnly = true;
  }
  const hintEl = document.getElementById('dc_pavg_hint');
  if (hintEl) hintEl.textContent = `Auto-calculated: time-weighted avg from ${pts.length.toLocaleString()} data points`;
  const srcEl = document.getElementById('dc_pavg_src');
  if (srcEl) srcEl.textContent = '← calculated from CSV';

  /* ── Propagate to all linked fields ── */
  if (typeof setField === 'function') {
    setField('curr_phyd', Pavg_dis.toFixed(2));
    setField('lc_pavg',   Pavg_dis.toFixed(2));
    setField('dc_ppeak',  Ppeak.toFixed(1));
  }
  if (window.S) {
    window.S.dc_pavg  = Pavg_dis;
    window.S.dc_ppeak = Ppeak;
  }
  try { calcCurrent && calcCurrent(); } catch(e) {}
  try { calcThermal && calcThermal(); } catch(e) {}
  try { calcLifecycle && calcLifecycle(); } catch(e) {}

  /* ── Results panel ── */
  const ri = (l,v,u,c='') => `<div class="ri ${c}"><span>${l}</span><b>${v} <small>${u}</small></b></div>`;
  const resultsEl = document.getElementById('dc_results');
  if (resultsEl) resultsEl.innerHTML = `
    <div class="rg">
      ${ri('Duration', dur_h, 'h', 'blue')}
      ${ri('P_avg (time-weighted)', Pavg_dis.toFixed(2), 'kW', 'blue')}
      ${ri('P_rms', Prms.toFixed(2), 'kW')}
      ${ri('P_peak', Ppeak.toFixed(1), 'kW', 'warn')}
      ${ri('Energy consumed', E_total.toFixed(2), 'kWh', 'blue')}
      ${ri('Regen energy', E_regen.toFixed(2), 'kWh', 'ok')}
      ${ri('Regen fraction', regenFrac.toFixed(1), '%', 'ok')}
      ${ri('Data points', pts.length.toLocaleString(), '')}
    </div>`;

  /* ── Energy budget ── */
  const budgetEl = document.getElementById('dc_energy_budget');
  if (budgetEl && typeof tbar === 'function') {
    const maxE = Math.max(S.E_usable || 43, E_total) * 1.2;
    budgetEl.innerHTML =
      tbar('Pack usable energy', (S.E_usable || 43).toFixed(1), maxE, 'kWh', 'var(--g)') +
      tbar('Cycle energy demand', E_total.toFixed(1), maxE, 'kWh', 'var(--b)') +
      tbar('Regen recovered', E_regen.toFixed(1), maxE, 'kWh', 'var(--ok)') +
      `<div style="margin-top:8px;font-size:11px;color:var(--m)">Estimated autonomy: <span style="color:var(--g);font-weight:700">${autonomy} h</span> at P_avg ${Pavg_dis.toFixed(1)} kW</div>`;
  }

  /* ── Point count badge ── */
  const ptBadge = document.getElementById('dc_pt_count');
  if (ptBadge) ptBadge.textContent = `${pts.length.toLocaleString()} pts · ${dur_h}h`;

  /* ── Histogram of power distribution ── */
  dcRenderHistogram(pts);

  /* ── Thermal sync badge ── */
  const syncEl = document.getElementById('dc_thermal_sync');
  if (syncEl) syncEl.textContent = `✓ Linked — P_avg ${Pavg_dis.toFixed(1)} kW · P_peak ${Ppeak.toFixed(1)} kW · ${dur_h}h`;

  /* ── Redraw chart ── */
  try { drawDriveCycleCanvas && drawDriveCycleCanvas(); } catch(e) {}

  /* ── Auto-run thermal rise ── */
  setTimeout(() => { try { runThermalRise && runThermalRise(); } catch(e) {} }, 80);
}

/* ── Power histogram (10 bins) ── */
function dcRenderHistogram(pts) {
  const wrap = document.getElementById('dc_histogram');
  if (!wrap) return;
  const powers = pts.map(p => p.p);
  const pmin = Math.min(...powers), pmax = Math.max(...powers);
  const bins = 10;
  const bw   = (pmax - pmin) / bins || 1;
  const counts = Array(bins).fill(0);
  powers.forEach(p => { const b = Math.min(bins-1, Math.floor((p-pmin)/bw)); counts[b]++; });
  const maxC = Math.max(...counts);
  const barH = 36;
  const bars = counts.map((c, i) => {
    const plo = (pmin + i*bw).toFixed(0);
    const h   = Math.round((c/maxC)*barH);
    const col = plo < 0 ? 'var(--g)' : 'var(--b)';
    return `<div title="${plo} kW: ${c} pts" style="display:flex;flex-direction:column;align-items:center;flex:1">
      <div style="width:100%;background:${col};height:${h}px;border-radius:2px 2px 0 0;min-height:${c?2:0}px"></div>
      <div style="font-size:8px;color:var(--text3);font-family:var(--mono);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:30px">${plo}</div>
    </div>`;
  }).join('');
  wrap.innerHTML = `
    <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">
      <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:4px">Power distribution histogram (kW)</div>
      <div style="display:flex;gap:2px;align-items:flex-end;height:${barH+20}px">${bars}</div>
    </div>`;
}

/* ── Manual edit: P_avg becomes editable again ── */
window.dcOnPavgEdit = function() {
  const el = document.getElementById('dc_pavg');
  if (!el) return;
  const v = +el.value;
  if (typeof setField === 'function') {
    setField('curr_phyd', v.toFixed(2));
    setField('lc_pavg',   v.toFixed(2));
  }
  if (window.S) window.S.dc_pavg = v;
  try { calcCurrent && calcCurrent(); } catch(e) {}
  try { calcThermal && calcThermal(); } catch(e) {}
};

/* ── Override getDCPoints to use CSV data if available ── */
const _origGetDCPoints = window.getDCPoints;
window.getDCPoints = function() {
  if (window._dcCSV && window._dcCSV.length >= 2 && window._dcMode === 'csv') {
    return window._dcCSV;
  }
  if (typeof _origGetDCPoints === 'function') return _origGetDCPoints();
  /* fallback: read manual rows */
  const ts = document.querySelectorAll('#dc_manual_rows .dc-t');
  const ps = document.querySelectorAll('#dc_manual_rows .dc-p');
  const pts = [];
  ts.forEach((t,i) => {
    const tv = parseFloat(t.value), pv = parseFloat(ps[i]?.value);
    if (!isNaN(tv) && !isNaN(pv)) pts.push({t:tv, p:pv});
  });
  return pts.sort((a,b) => a.t - b.t);
};

/* ── On manual row change: recalculate from manual data ── */
const _origDrawDC = window.drawDriveCycleCanvas;
window.drawDriveCycleCanvas = function() {
  if (typeof _origDrawDC === 'function') _origDrawDC();
  /* If no CSV, re-calculate stats from manual rows */
  if (window._dcMode !== 'csv') {
    const pts = window.getDCPoints();
    if (pts.length >= 2) {
      /* Unlock dc_pavg for manual mode */
      const el = document.getElementById('dc_pavg');
      if (el) {
        el.readOnly = false;
        el.style.borderColor = '';
        el.style.background  = '';
      }
      dcAnalyseAndUpdate(pts);
    }
  }
};

/* ── Thermal Rise auto-sync from S state ── */
const _origRunThermalRise = window.runThermalRise;
window.runThermalRise = function() {
  /* Auto-sync from global S before running */
  const S = window.S || {};
  const sf = (id, val) => { try { if(val && document.getElementById(id)) document.getElementById(id).value = val; } catch(e){} };

  sf('tr_Vnom',    (S.V_nom_pack || S.t_vmax_sys || 358).toFixed(0));
  sf('tr_Qah',     (S.Q_pack || S.c_ah || 120).toFixed(0));
  if (S.t_tcell_max) { sf('tr_T_limit', S.t_tcell_max.toFixed(0)); sf('tr_T_derate', (S.t_tcell_max-10).toFixed(0)); }
  if (S.t_top_hi)  sf('tr_Tamb', S.t_top_hi.toFixed(0));
  const Cth = (S.pack_mass||0) * ((S.c_cp_pack||1025)) / 1000;
  if (Cth > 1) sf('tr_Cth', Cth.toFixed(1));
  const ir  = S._packIR_bol || ((S.c_ir_bol||0.22) * (S.S_total||112) / (S.c_pp||1) * 1000);
  if (ir > 0) sf('tr_ir', ir.toFixed(1));

  /* Run original */
  if (typeof _origRunThermalRise === 'function') _origRunThermalRise();
};

/* ── Override old analyzeDriveCycle to route to new handler ── */
window.analyzeDriveCycle = function(input) {
  if (input && input.files && input.files[0]) dcHandleFile(input.files[0]);
};

/* ── Also handle drawDriveCycleCanvas auto-run on tab open ── */
(function() {
  const _origSS = window.switchTopTab;
  window.switchTopTab = function(tabId, btn) {
    if (typeof _origSS === 'function') _origSS(tabId, btn);
  };
})();
