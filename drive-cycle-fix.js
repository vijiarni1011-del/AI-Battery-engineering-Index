/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — DRIVE CYCLE FIX  v2.0
   - Excel + CSV upload (SheetJS) with column auto-detection
   - Auto P_avg (time-weighted, read-only when data loaded)
   - Manual rows remain editable, unlock when no file loaded
   - Thermal Rise auto-linked
   ═══════════════════════════════════════════════════════════════ */

window._dcCSV  = null;
window._dcMode = 'manual';

/* ═══════════ FILE HANDLER ═══════════ */
window.dcHandleFile = function(file) {
  if (!file) return;
  const ext  = file.name.split('.').pop().toLowerCase();
  const prog = document.getElementById('dc_progress');
  const bar  = document.getElementById('dc_prog_bar');
  const lbl  = document.getElementById('dc_prog_label');
  const badge= document.getElementById('dc_file_badge');
  if (prog) prog.style.display = 'block';
  if (bar)  bar.style.width = '10%';
  if (lbl)  lbl.textContent = `Reading ${file.name} (${(file.size/1024).toFixed(0)} KB)…`;

  const run = () => {
    if (ext === 'csv' || ext === 'txt') {
      const reader = new FileReader();
      reader.onprogress = e => { if (e.lengthComputable && bar) bar.style.width = (e.loaded/e.total*60)+'%'; };
      reader.onload = e => dcParseCSVText(e.target.result, file.name, lbl, bar, badge, prog);
      reader.readAsText(file);
    } else {
      // Excel — use SheetJS
      const reader = new FileReader();
      reader.onload = e => {
        try {
          if (bar) bar.style.width = '50%';
          const wb  = XLSX.read(new Uint8Array(e.target.result), { type:'array' });
          dcParseExcelWorkbook(wb, file.name, lbl, bar, badge, prog);
        } catch(err) { if (lbl) lbl.textContent = '⚠ Excel parse error: ' + err.message; }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  if ((ext === 'xlsx' || ext === 'xls') && typeof XLSX === 'undefined') {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = run;
    s.onerror = () => { if (lbl) lbl.textContent = '⚠ Could not load Excel parser. Check internet.'; };
    document.head.appendChild(s);
  } else {
    run();
  }
};

function dcParseExcelWorkbook(wb, fileName, lbl, bar, badge, prog) {
  /* Find most data-rich sheet */
  let best = null, bestN = 0;
  wb.SheetNames.forEach(name => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header:1, defval:'' });
    const n = rows.flat().filter(v => !isNaN(parseFloat(v)) && v !== '').length;
    if (n > bestN) { bestN = n; best = { name, rows }; }
  });
  if (!best) { if (lbl) lbl.textContent = '⚠ No numeric data found in Excel file.'; return; }

  /* Convert sheet to CSV-style text and reuse parser */
  const lines = best.rows.map(r => r.join(','));
  if (bar) bar.style.width = '70%';
  dcParseCSVText(lines.join('\n'), fileName + '[' + best.name + ']', lbl, bar, badge, prog);
}

function dcParseCSVText(text, fileName, lbl, bar, badge, prog) {
  const MAX = 21600;
  setTimeout(() => {
    try {
      const lines = text.split(/\r?\n/);
      const delim = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
      const hasHdr = isNaN(parseFloat(lines[0].split(delim)[0]));
      const hdr = hasHdr ? lines[0].split(delim).map(h => h.trim().toLowerCase()) : null;
      const colMap = dcDetectCols(hdr);

      const pts = [];
      const startIdx = hasHdr ? 1 : 0;
      for (let i = startIdx; i < Math.min(lines.length, startIdx + MAX + 1); i++) {
        const l = lines[i].trim();
        if (!l || l.startsWith('#')) continue;
        const cols = l.split(delim);
        const t = parseFloat(cols[colMap.t]);
        const p = parseFloat(cols[colMap.p]);
        if (isNaN(t) || isNaN(p)) continue;
        const row = { t, p };
        if (colMap.v !== null) { const v = parseFloat(cols[colMap.v]); if (!isNaN(v)) row.v = v; }
        if (colMap.i !== null) { const iv = parseFloat(cols[colMap.i]); if (!isNaN(iv)) row.i = iv; }
        pts.push(row);
      }

      if (pts.length < 2) {
        if (lbl) lbl.textContent = `⚠ Only ${pts.length} valid rows — need ≥2. Check: Col 1 = time(s), Col 2 = power(kW).`;
        return;
      }

      window._dcCSV  = pts;
      window._dcMode = 'csv';
      if (bar)  bar.style.width = '100%';
      if (badge) {
        const dur = ((pts[pts.length-1].t - pts[0].t)/3600).toFixed(2);
        badge.style.display = 'block';
        badge.textContent = `✓ ${fileName} · ${pts.length.toLocaleString()} rows · ${dur}h`;
      }
      setTimeout(() => { if (prog) prog.style.display = 'none'; }, 1500);

      dcAnalyseAndUpdate(pts);
    } catch(err) {
      if (lbl) lbl.textContent = '⚠ Parse error: ' + err.message;
      console.error('[dcParse]', err);
    }
  }, 30);
}

function dcDetectCols(hdr) {
  const map = { t:0, p:1, v:null, i:null };
  if (!hdr) return map;
  const f = (...keys) => { for(const k of keys){const i=hdr.findIndex(h=>h.includes(k));if(i>=0)return i;} return null; };
  map.t   = f('time','t_s','timestamp') ?? 0;
  map.p   = f('power','kw','p_kw','watt') ?? 1;
  map.v   = f('volt','voltage');
  map.i   = f('current','amp','i_a');
  return map;
}

/* ═══════════ ANALYSIS ═══════════ */
window.dcAnalyseAndUpdate = function(pts) {
  if (!pts || pts.length < 2) return;
  const S = window.S || {};
  const dur = pts[pts.length-1].t - pts[0].t;
  let E=0, Er=0, P2=0, Pmax=0;
  for (let i=1; i<pts.length; i++) {
    const dt  = pts[i].t - pts[i-1].t;
    const Pav = (pts[i].p + pts[i-1].p) / 2;
    E  += Pav * dt / 3600;
    if (Pav < 0) Er += Math.abs(Pav) * dt / 3600;
    P2 += Pav * Pav * dt;
    if (Pav > Pmax) Pmax = Pav;
  }
  const Pavg = dur > 0 ? E * 3600 / dur : 0;
  const Pavg_dis = Math.max(0, Pavg);
  const Prms = dur > 0 ? Math.sqrt(P2 / dur) : 0;
  const regenPct = (E + Er) > 0 ? (Er / (E + Er) * 100) : 0;
  const dur_h = (dur/3600).toFixed(2);

  /* Lock dc_pavg field */
  const pavgEl = document.getElementById('dc_pavg');
  if (pavgEl) {
    pavgEl.value    = Pavg_dis.toFixed(2);
    pavgEl.readOnly = window._dcMode === 'csv';
    pavgEl.style.borderColor = window._dcMode === 'csv' ? 'rgba(0,212,170,.5)' : '';
    pavgEl.style.background  = window._dcMode === 'csv' ? 'rgba(0,212,170,.05)' : '';
  }
  const srcEl = document.getElementById('dc_pavg_src');
  if (srcEl) srcEl.textContent = window._dcMode === 'csv' ? '← calculated from file' : '← manual/calculated';

  /* Propagate */
  if (typeof setField === 'function') {
    setField('curr_phyd', Pavg_dis.toFixed(2));
    setField('lc_pavg',   Pavg_dis.toFixed(2));
    setField('dc_ppeak',  Pmax.toFixed(1));
  }
  if (window.S) { window.S.dc_pavg = Pavg_dis; window.S.dc_ppeak = Pmax; }
  try { calcCurrent && calcCurrent(); } catch(e) {}
  try { calcLifecycle && calcLifecycle(); } catch(e) {}

  /* Results panel */
  const ri2 = (l,v,u,c='') => `<div class="ri ${c}"><span>${l}</span><b>${v} <small>${u}</small></b></div>`;
  const rEl = document.getElementById('dc_results');
  if (rEl) rEl.innerHTML = `<div class="rg">
    ${ri2('Duration',        dur_h,              'h',     'blue')}
    ${ri2('P_avg (t-weighted)', Pavg_dis.toFixed(2),'kW',   'blue')}
    ${ri2('P_rms',           Prms.toFixed(2),    'kW')}
    ${ri2('P_peak',          Pmax.toFixed(1),    'kW',   'warn')}
    ${ri2('Energy demand',   E.toFixed(2),        'kWh',  'blue')}
    ${ri2('Regen energy',    Er.toFixed(2),       'kWh',  'ok')}
    ${ri2('Regen %',         regenPct.toFixed(1), '%',    'ok')}
    ${ri2('Data points',     pts.length.toLocaleString(), '')}
  </div>`;

  /* Energy budget */
  const bEl = document.getElementById('dc_energy_budget');
  if (bEl && typeof tbar === 'function') {
    const mxE = Math.max(S.E_usable||43, E) * 1.2;
    const auto = S.E_usable > 0 && Pavg_dis > 0 ? (S.E_usable/Pavg_dis).toFixed(1) : '—';
    bEl.innerHTML =
      tbar('Pack usable energy', (S.E_usable||43).toFixed(1), mxE, 'kWh', 'var(--g)') +
      tbar('Cycle energy demand', E.toFixed(1), mxE, 'kWh', 'var(--b)') +
      tbar('Regen recovered',    Er.toFixed(1), mxE, 'kWh', 'var(--ok)') +
      `<div style="margin-top:8px;font-size:11px;color:var(--m)">Est. autonomy: <span style="color:var(--g);font-weight:700">${auto} h</span> @ P_avg ${Pavg_dis.toFixed(1)} kW</div>`;
  }

  const ptEl = document.getElementById('dc_pt_count');
  if (ptEl) ptEl.textContent = `${pts.length.toLocaleString()} pts · ${dur_h}h`;

  const syncEl = document.getElementById('dc_thermal_sync');
  if (syncEl) syncEl.textContent = `✓ Linked — P_avg ${Pavg_dis.toFixed(1)} kW · P_peak ${Pmax.toFixed(1)} kW · ${dur_h}h`;

  try { drawDriveCycleCanvas && drawDriveCycleCanvas(); } catch(e) {}
  setTimeout(() => { try { runThermalRise && runThermalRise(); } catch(e) {} }, 100);
};

/* ═══════════ getDCPoints OVERRIDE ═══════════ */
window.getDCPoints = function() {
  if (window._dcCSV && window._dcCSV.length >= 2 && window._dcMode === 'csv') return window._dcCSV;
  const pts = [];
  document.querySelectorAll('#dc_manual_rows .dc-row').forEach(r => {
    const t = parseFloat(r.querySelector('.dc-t')?.value);
    const p = parseFloat(r.querySelector('.dc-p')?.value);
    if (!isNaN(t) && !isNaN(p)) pts.push({ t, p });
  });
  return pts.sort((a,b) => a.t - b.t);
};

/* Manual row change → re-analyse if not CSV */
document.addEventListener('input', e => {
  if (window._dcMode === 'csv') return;
  if (e.target.classList.contains('dc-t') || e.target.classList.contains('dc-p')) {
    clearTimeout(window._dcManualTimer);
    window._dcManualTimer = setTimeout(() => {
      const pts = window.getDCPoints();
      if (pts.length >= 2) { window._dcMode = 'manual'; window.dcAnalyseAndUpdate(pts); }
    }, 350);
  }
});

/* P_avg manual edit when unlocked */
window.dcOnPavgEdit = function() {
  if (window._dcMode === 'csv') return;
  const v = +document.getElementById('dc_pavg')?.value || 0;
  if (typeof setField === 'function') { setField('curr_phyd', v.toFixed(2)); setField('lc_pavg', v.toFixed(2)); }
  if (window.S) window.S.dc_pavg = v;
};

/* Thermal Rise pre-sync */
(function(){
  const _orig = window.runThermalRise;
  window.runThermalRise = function() {
    const S = window.S || {};
    const sf = (id, val) => { try { const el=document.getElementById(id); if(el&&val!=null&&!isNaN(+val)) el.value=+val; }catch(e){} };
    sf('tr_Vnom', S.V_nom_pack||358);
    sf('tr_Qah',  S.Q_pack||120);
    if (S.t_tcell_max) { sf('tr_T_limit', S.t_tcell_max); sf('tr_T_derate', S.t_tcell_max-10); }
    if (S.t_top_hi) sf('tr_Tamb', S.t_top_hi);
    const Cth = (S.pack_mass||0)*(S.c_cp_pack||1025)/1000;
    if (Cth>1) sf('tr_Cth', Cth.toFixed(1));
    const ir = S._packIR_bol || ((S.c_ir_bol||0.22)*(S.S_total||112)/(S.c_pp||1)*1000);
    if (ir>0) sf('tr_ir', ir.toFixed(1));
    const canvas = document.getElementById('tr_canvas');
    if (canvas) { const W=canvas.parentElement?.clientWidth||900; if(W>200) canvas.width=W; canvas.height=480; }
    if (typeof _orig === 'function') try { _orig(); } catch(err) { console.warn('[TR]', err); }
  };
})();

/* analyzeDriveCycle backward compat */
window.analyzeDriveCycle = function(input) {
  if (input?.files?.[0]) dcHandleFile(input.files[0]);
};

/* Auto-analyse manual rows on page load */
window.addEventListener('load', () => {
  setTimeout(() => {
    if (window._dcMode !== 'csv') {
      const pts = window.getDCPoints();
      if (pts.length >= 2) { window._dcMode = 'manual'; window.dcAnalyseAndUpdate(pts); }
    }
  }, 1800);
});
