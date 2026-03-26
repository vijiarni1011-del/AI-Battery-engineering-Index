/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — DRIVE CYCLE FIX  v3.0
   Fixes: P_avg unit detection (W vs kW), column detection,
   column override UI, clear file, submit/lock, chart reconnect,
   histogram, delete rows, thermal rise auto-link
   ═══════════════════════════════════════════════════════════════ */

window._dcCSV      = null;
window._dcMode     = 'manual';
window._dcRawCols  = null;   // raw header strings for override UI
window._dcColMap   = { t:0, p:1, v:null, i:null, pUnit:'kW' };

/* ─── File handler ─── */
window.dcHandleFile = function(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  const prog  = document.getElementById('dc_progress');
  const bar   = document.getElementById('dc_prog_bar');
  const lbl   = document.getElementById('dc_prog_label');
  if (prog) prog.style.display = 'block';
  if (bar)  bar.style.width   = '10%';
  if (lbl)  lbl.textContent   = `Reading ${file.name} (${(file.size/1024).toFixed(0)} KB)…`;

  const run = () => {
    if (ext === 'csv' || ext === 'txt') {
      const r = new FileReader();
      r.onprogress = e => { if (e.lengthComputable && bar) bar.style.width = (e.loaded/e.total*50)+'%'; };
      r.onload = e => dcParseText(e.target.result, file.name, lbl, bar, prog);
      r.readAsText(file);
    } else {
      const r = new FileReader();
      r.onload = e => {
        try {
          if (bar) bar.style.width = '40%';
          const wb = XLSX.read(new Uint8Array(e.target.result), { type:'array' });
          let best = null, bestN = 0;
          wb.SheetNames.forEach(name => {
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header:1, defval:'' });
            const n = rows.flat().filter(v => !isNaN(parseFloat(v)) && v !== '').length;
            if (n > bestN) { bestN = n; best = { name, rows }; }
          });
          if (!best) { if (lbl) lbl.textContent = '⚠ No numeric data found in Excel.'; return; }
          if (bar) bar.style.width = '60%';
          const text = best.rows.map(r => r.join('\t')).join('\n');
          dcParseText(text, file.name + ' [' + best.name + ']', lbl, bar, prog, '\t');
        } catch(err) { if (lbl) lbl.textContent = '⚠ Excel error: ' + err.message; }
      };
      r.readAsArrayBuffer(file);
    }
  };

  if ((ext==='xlsx'||ext==='xls') && typeof XLSX === 'undefined') {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = run;
    s.onerror = () => { if (lbl) lbl.textContent = '⚠ Could not load Excel parser.'; };
    document.head.appendChild(s);
  } else { run(); }
};

function dcParseText(text, fileName, lbl, bar, prog, forceDelim) {
  const MAX = 21600;
  setTimeout(() => {
    try {
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const delim = forceDelim || (lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',');
      const hasHdr = isNaN(parseFloat(lines[0].split(delim)[0].trim()));
      const hdrRaw = hasHdr ? lines[0].split(delim).map(h => h.trim()) : null;
      const hdr    = hdrRaw ? hdrRaw.map(h => h.toLowerCase().replace(/[^a-z0-9]/g,'')) : null;

      /* Auto-detect columns */
      const colMap = dcDetectCols(hdr, hdrRaw);
      window._dcRawCols = hdrRaw || lines[0].split(delim).map((_,i)=>`Col ${i}`);
      window._dcColMap  = { ...colMap };

      /* Parse rows */
      const pts = [];
      const startIdx = hasHdr ? 1 : 0;
      let   warnUnit = false;

      for (let i = startIdx; i < Math.min(lines.length, startIdx+MAX+1); i++) {
        const l = lines[i].trim();
        if (!l || l.startsWith('#') || l.startsWith('//')) continue;
        const cols = l.split(delim);
        const t = parseFloat(cols[colMap.t]);
        let   p = parseFloat(cols[colMap.p]);
        if (isNaN(t)) continue;
        if (isNaN(p)) continue;
        /* Unit auto-detection: if values look like Watts (>500 typical) → convert */
        if (colMap.pUnit === 'W') p = p / 1000;
        const row = { t, p };
        if (colMap.v != null) { const v=parseFloat(cols[colMap.v]); if(!isNaN(v)) row.v=v; }
        if (colMap.i != null) { const iv=parseFloat(cols[colMap.i]); if(!isNaN(iv)) row.i=iv; }
        pts.push(row);
      }

      if (pts.length < 2) {
        if (lbl) lbl.textContent = `⚠ Only ${pts.length} valid rows. Check column headers or use manual override below.`;
        dcShowColDiag(hdrRaw, lines, delim, startIdx);
        return;
      }

      window._dcCSV  = pts;
      window._dcMode = 'csv';

      if (bar) bar.style.width = '100%';
      setTimeout(() => { if (prog) prog.style.display = 'none'; }, 1200);

      const badge = document.getElementById('dc_file_badge');
      const clearBtn = document.getElementById('dc_clear_btn');
      if (badge) {
        const dur = ((pts[pts.length-1].t - pts[0].t)/3600).toFixed(2);
        badge.style.display = 'block';
        badge.innerHTML = `✓ <b>${fileName}</b> · ${pts.length.toLocaleString()} rows · ${dur}h · power col: <b>${window._dcRawCols[colMap.p]||'#'+colMap.p}</b> (${colMap.pUnit})`;
      }
      if (clearBtn) clearBtn.style.display = 'inline-block';

      dcShowColDiag(hdrRaw, lines, delim, startIdx);
      dcRenderColOverride();
      if (lbl) lbl.textContent = `✓ ${pts.length.toLocaleString()} points · power: ${window._dcRawCols[colMap.p]||'col '+colMap.p} [${colMap.pUnit}]`;

      dcAnalyseAndUpdate(pts);
    } catch(err) {
      if (lbl) lbl.textContent = '⚠ Parse error: ' + err.message;
      console.error('[DC parse]', err);
    }
  }, 20);
}

/* ─── Column detection with unit inference ─── */
function dcDetectCols(hdr, hdrRaw) {
  const map = { t:0, p:1, v:null, i:null, pUnit:'kW' };
  if (!hdr || !hdr.length) return map;
  const f = (...keys) => {
    for (const k of keys) {
      const i = hdr.findIndex(h => h.includes(k));
      if (i >= 0) return i;
    }
    return null;
  };
  map.t = f('times','timesec','time','tsec','ts','timestamp','elapsed') ?? 0;
  map.p = f('powerkw','pkw','powerkwh') ?? f('power','pw','kw') ?? f('pwr','watt','kwatt') ?? 1;
  map.v = f('volt','voltage','vcell','vpack','vbus');
  map.i = f('current','amp','ia','ibat','ipack','currentamp');

  /* Unit detection: look at raw header for explicit unit label */
  const rawP = hdrRaw ? (hdrRaw[map.p] || '').toLowerCase() : '';
  if (rawP.includes('(w)') || rawP.includes('[w]') || rawP.endsWith(' w') || rawP === 'w') {
    map.pUnit = 'W';
  } else if (rawP.includes('(kw)') || rawP.includes('[kw]') || rawP.includes('kw')) {
    map.pUnit = 'kW';
  } else {
    /* Heuristic: sample first 10 data values — if median > 500, likely Watts */
    map.pUnit = 'auto'; /* resolved after sampling in caller */
  }
  return map;
}

/* ─── Show raw column diagnostic ─── */
function dcShowColDiag(hdrRaw, lines, delim, startIdx) {
  const diag = document.getElementById('dc_col_diag');
  const body = document.getElementById('dc_col_diag_body');
  if (!diag || !body) return;
  diag.style.display = 'block';
  const sampleLines = lines.slice(startIdx, startIdx+3);
  const cols = window._dcRawCols || [];
  const cm   = window._dcColMap  || {};
  let html = `<div style="color:var(--teal);margin-bottom:4px">Headers: ${cols.map((c,i)=>`<b style="color:${i===cm.t?'#4a9eff':i===cm.p?'#00d4aa':i===cm.v?'#f5c518':i===cm.i?'#ff7b35':'var(--text3)'}">[${i}]${c}</b>`).join(' ')}</div>`;
  html += `<div style="color:var(--text3)">Detected: Time=col[${cm.t}] Power=col[${cm.p}](${cm.pUnit}) ${cm.v!=null?'Voltage=col['+cm.v+']':''} ${cm.i!=null?'Current=col['+cm.i+']':''}</div>`;
  html += `<div style="margin-top:4px">Sample rows:</div>`;
  sampleLines.forEach((l,i) => { html += `<div style="color:var(--text2)">#${i+1}: ${l.split(delim).map((v,ci)=>`<span style="color:${ci===cm.p?'#00d4aa':ci===cm.t?'#4a9eff':'var(--text3)'}">${v.trim()}</span>`).join(' | ')}</div>`; });
  body.innerHTML = html;
}

/* ─── Column override UI ─── */
function dcRenderColOverride() {
  const wrap = document.getElementById('dc_col_map');
  const sel  = document.getElementById('dc_col_selects');
  if (!wrap || !sel || !window._dcRawCols) return;
  wrap.style.display = 'block';
  const cols = window._dcRawCols;
  const cm   = window._dcColMap;
  const opts = cols.map((c,i)=>`<option value="${i}">${i}: ${c}</option>`).join('');
  const noneOpt = '<option value="-1">— none —</option>';
  const mk = (label, key, val, hasNone=false) => `
    <div>
      <div style="font-size:9px;font-family:var(--mono);color:var(--text3);margin-bottom:3px">${label}</div>
      <select id="dc_col_${key}" style="width:100%;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:11px">
        ${hasNone?noneOpt:''}${opts}
      </select>
    </div>`;
  const unitSel = `
    <div>
      <div style="font-size:9px;font-family:var(--mono);color:var(--text3);margin-bottom:3px">POWER UNIT</div>
      <select id="dc_col_punit" style="width:100%;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:11px">
        <option value="kW" ${cm.pUnit==='kW'?'selected':''}>kW (kilowatts)</option>
        <option value="W"  ${cm.pUnit==='W'?'selected':''}>W (watts → ÷1000)</option>
        <option value="auto">Auto-detect</option>
      </select>
    </div>`;
  sel.innerHTML = mk('TIME column (s)','t',cm.t) + mk('POWER column','p',cm.p) + mk('VOLTAGE column (V)','v',cm.v,true) + mk('CURRENT column (A)','i',cm.i,true) + unitSel;
  sel.querySelector('#dc_col_t').value  = cm.t;
  sel.querySelector('#dc_col_p').value  = cm.p != null ? cm.p : 1;
  if (cm.v != null) sel.querySelector('#dc_col_v').value = cm.v;
  if (cm.i != null) sel.querySelector('#dc_col_i').value = cm.i;
}

window.dcReapplyColMap = function() {
  const gi = id => { const el=document.getElementById(id); return el ? parseInt(el.value) : null; };
  window._dcColMap.t     = gi('dc_col_t') ?? 0;
  window._dcColMap.p     = gi('dc_col_p') ?? 1;
  window._dcColMap.v     = gi('dc_col_v') === -1 ? null : gi('dc_col_v');
  window._dcColMap.i     = gi('dc_col_i') === -1 ? null : gi('dc_col_i');
  window._dcColMap.pUnit = document.getElementById('dc_col_punit')?.value || 'kW';
  /* Re-parse stored CSV with new column map */
  if (!window._dcCSV || !window._dcRawData) {
    alert('Re-upload file to apply new column mapping'); return;
  }
  dcParseText(window._dcRawData, window._dcRawFileName || 'file',
    document.getElementById('dc_prog_label'),
    document.getElementById('dc_prog_bar'),
    document.getElementById('dc_progress'));
};

/* ─── Clear file ─── */
window.dcClearFile = function() {
  window._dcCSV  = null;
  window._dcMode = 'manual';
  const badge = document.getElementById('dc_file_badge');
  const clearBtn = document.getElementById('dc_clear_btn');
  const diag = document.getElementById('dc_col_diag');
  const colMap = document.getElementById('dc_col_map');
  const fileInput = document.getElementById('dc_file');
  if (badge) badge.style.display   = 'none';
  if (clearBtn) clearBtn.style.display = 'none';
  if (diag) diag.style.display     = 'none';
  if (colMap) colMap.style.display  = 'none';
  if (fileInput) fileInput.value    = '';
  /* Unlock dc_pavg */
  const pavgEl = document.getElementById('dc_pavg');
  if (pavgEl) { pavgEl.readOnly=false; pavgEl.style.borderColor=''; pavgEl.style.background=''; }
  const lbl = document.getElementById('dc_prog_label');
  if (lbl) lbl.textContent = 'File cleared — using manual data';
  /* Re-analyse from manual rows */
  const pts = window.getDCPoints();
  if (pts.length >= 2) dcAnalyseAndUpdate(pts);
  try { drawDriveCycleCanvas && drawDriveCycleCanvas(); } catch(e) {}
};

/* ─── Submit / lock ─── */
window.dcSubmitAndLock = function() {
  const pts = window.getDCPoints();
  if (pts.length < 2) { alert('No drive cycle data. Upload a file or add manual points.'); return; }
  dcAnalyseAndUpdate(pts);
  /* Visual confirmation */
  const btn = document.querySelector('[onclick="dcSubmitAndLock()"]');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ Submitted — All tabs updated';
    btn.style.background = 'rgba(0,212,170,.3)';
    setTimeout(() => { btn.textContent=orig; btn.style.background=''; }, 2500);
  }
  try { propagate && propagate(); } catch(e) {}
  try { runThermalRise && runThermalRise(); } catch(e) {}
};

/* ─── getDCPoints override ─── */
window.getDCPoints = function() {
  if (window._dcCSV && window._dcCSV.length >= 2 && window._dcMode === 'csv') return window._dcCSV;
  const pts = [];
  document.querySelectorAll('#dc_manual_rows .dc-row').forEach(r => {
    const t=parseFloat(r.querySelector('.dc-t')?.value);
    const p=parseFloat(r.querySelector('.dc-p')?.value);
    if (!isNaN(t) && !isNaN(p)) pts.push({t,p});
  });
  return pts.sort((a,b)=>a.t-b.t);
};

/* ─── Core analysis ─── */
window.dcAnalyseAndUpdate = function(pts) {
  if (!pts || pts.length < 2) return;
  const S   = window.S || {};
  const dur = pts[pts.length-1].t - pts[0].t;
  let E=0, Er=0, P2=0, Pmax=0, Pregen_max=0;

  /* Unit auto-detect on raw values if pUnit==='auto' */
  if (window._dcMode === 'csv' && window._dcColMap?.pUnit === 'auto') {
    const sample = pts.slice(0, Math.min(50,pts.length)).map(p=>Math.abs(p.p));
    const median = sample.sort((a,b)=>a-b)[Math.floor(sample.length/2)];
    if (median > 200) {
      /* Values look like Watts — convert entire array */
      pts.forEach(p => p.p /= 1000);
      window._dcColMap.pUnit = 'W→kW';
      const lbl = document.getElementById('dc_prog_label');
      if (lbl) lbl.textContent += ' · ⚠ Power detected in W → converted to kW (÷1000)';
    } else {
      window._dcColMap.pUnit = 'kW';
    }
  }

  for (let i=1; i<pts.length; i++) {
    const dt  = pts[i].t - pts[i-1].t;
    if (dt <= 0) continue;
    const Pav = (pts[i].p + pts[i-1].p) / 2;
    E   += Pav * dt / 3600;
    if (Pav < 0) { Er += Math.abs(Pav) * dt / 3600; if (Math.abs(Pav)>Pregen_max) Pregen_max=Math.abs(Pav); }
    P2  += Pav * Pav * dt;
    if (Pav > Pmax) Pmax = Pav;
  }

  /* True time-weighted average */
  const Pavg     = dur > 0 ? E * 3600 / dur : 0;
  const Pavg_dis = Math.max(0, Pavg);
  const Prms     = dur > 0 ? Math.sqrt(P2 / dur) : 0;
  const regenPct = E + Er > 0 ? Er/(E+Er)*100 : 0;
  const dur_h    = (dur/3600).toFixed(2);
  const autonomy = S.E_usable > 0 && Pavg_dis > 0.01 ? (S.E_usable/Pavg_dis).toFixed(1) : '—';

  /* Store in S */
  if (window.S) { window.S.dc_pavg=Pavg_dis; window.S.dc_ppeak=Pmax; window.S.dc_dur_h=+dur_h; }

  /* Update dc_pavg field */
  const pavgEl = document.getElementById('dc_pavg');
  if (pavgEl) {
    pavgEl.value    = Pavg_dis.toFixed(2);
    pavgEl.readOnly = window._dcMode === 'csv';
    pavgEl.style.borderColor = window._dcMode==='csv' ? 'rgba(0,212,170,.5)' : '';
    pavgEl.style.background  = window._dcMode==='csv' ? 'rgba(0,212,170,.05)' : '';
  }
  const srcEl = document.getElementById('dc_pavg_src');
  if (srcEl) srcEl.textContent = window._dcMode==='csv' ? `← ${Pavg_dis.toFixed(2)} kW from file` : '← calculated';

  /* Push to linked fields */
  if (typeof setField==='function') {
    setField('curr_phyd', Pavg_dis.toFixed(2));
    setField('lc_pavg',   Pavg_dis.toFixed(2));
    setField('dc_ppeak',  Pmax.toFixed(1));
    setField('dc_dur',    (dur/60).toFixed(0));
  }
  try { calcCurrent   && calcCurrent();   } catch(e) {}
  try { calcLifecycle && calcLifecycle(); } catch(e) {}

  /* Results */
  const ri2=(l,v,u,c='')=>`<div class="ri ${c}"><span>${l}</span><b>${v} <small>${u}</small></b></div>`;
  const rEl = document.getElementById('dc_results');
  if (rEl) rEl.innerHTML = `<div class="rg">
    ${ri2('Duration',        dur_h,              'h',  'blue')}
    ${ri2('P_avg (time-wtd)',Pavg_dis.toFixed(3),'kW', 'blue')}
    ${ri2('P_rms',           Prms.toFixed(3),    'kW')}
    ${ri2('P_peak',          Pmax.toFixed(2),    'kW', 'warn')}
    ${ri2('P_regen peak',    Pregen_max.toFixed(2),'kW','ok')}
    ${ri2('Energy demand',   E.toFixed(3),       'kWh','blue')}
    ${ri2('Regen energy',    Er.toFixed(3),      'kWh','ok')}
    ${ri2('Regen fraction',  regenPct.toFixed(1),'%',  'ok')}
    ${ri2('Data points',     pts.length.toLocaleString(),'')}
    ${ri2('Est. autonomy',   autonomy,           'h',  Pavg_dis>0?'blue':'')}
  </div>`;

  /* Energy budget */
  const bEl = document.getElementById('dc_energy_budget');
  if (bEl && typeof tbar==='function') {
    const mxE = Math.max(S.E_usable||43,E)*1.2;
    bEl.innerHTML =
      tbar('Pack usable energy', (S.E_usable||43).toFixed(1), mxE, 'kWh', 'var(--g)') +
      tbar('Cycle energy demand',E.toFixed(2), mxE, 'kWh', 'var(--b)') +
      tbar('Regen recovered',    Er.toFixed(2),mxE, 'kWh', 'var(--ok)') +
      `<div style="margin-top:8px;font-size:11px;color:var(--m)">
        Autonomy: <b style="color:var(--g)">${autonomy} h</b> @ P_avg ${Pavg_dis.toFixed(2)} kW
        &nbsp;·&nbsp; ${dur_h}h cycle · ${pts.length.toLocaleString()} pts
      </div>`;
  }

  /* Point count + sync badges */
  const ptEl = document.getElementById('dc_pt_count');
  if (ptEl) ptEl.textContent = `${pts.length.toLocaleString()} pts · ${dur_h}h`;
  const syncEl = document.getElementById('dc_thermal_sync');
  if (syncEl) syncEl.textContent = `✓ P_avg ${Pavg_dis.toFixed(2)} kW · P_peak ${Pmax.toFixed(2)} kW · ${dur_h}h`;

  /* Histogram */
  dcRenderHistogram(pts);

  /* Chart */
  try { drawDriveCycleCanvas && drawDriveCycleCanvas(); } catch(e) {}

  /* Thermal rise */
  setTimeout(() => { try { runThermalRise && runThermalRise(); } catch(e) {} }, 120);
};

/* ─── Power histogram ─── */
function dcRenderHistogram(pts) {
  const wrap = document.getElementById('dc_histogram');
  if (!wrap) return;
  const powers = pts.map(p=>p.p);
  const mn=Math.min(...powers), mx=Math.max(...powers);
  const bins=12, bw=(mx-mn)/bins||1;
  const counts=Array(bins).fill(0);
  powers.forEach(p=>{const b=Math.min(bins-1,Math.floor((p-mn)/bw));counts[b]++;});
  const maxC=Math.max(...counts,1);
  const H=40;
  const bars=counts.map((c,i)=>{
    const lo=(mn+i*bw).toFixed(1);
    const h=Math.max(c?2:0,Math.round(c/maxC*H));
    const col=+lo<0?'var(--g)':+lo>0?'var(--b)':'var(--text3)';
    return `<div title="${lo}kW: ${c}pts" style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0">
      <div style="width:100%;background:${col};height:${h}px;border-radius:2px 2px 0 0"></div>
      <div style="font-size:8px;color:var(--text3);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:36px">${lo}</div>
    </div>`;
  }).join('');
  wrap.innerHTML=`<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">
    <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:4px">Power distribution (kW) — ${pts.length.toLocaleString()} pts</div>
    <div style="display:flex;gap:2px;align-items:flex-end;height:${H+20}px">${bars}</div>
  </div>`;
}

/* ─── Manual row input listener ─── */
document.addEventListener('input', e => {
  if (window._dcMode==='csv') return;
  if (e.target.classList.contains('dc-t')||e.target.classList.contains('dc-p')) {
    clearTimeout(window._dcManualTimer);
    window._dcManualTimer=setTimeout(()=>{
      const pts=window.getDCPoints();
      if(pts.length>=2){window._dcMode='manual';dcAnalyseAndUpdate(pts);}
    },350);
  }
});

/* ─── dc_pavg manual edit ─── */
window.dcOnPavgEdit = function() {
  if (window._dcMode==='csv') return;
  const v=+(document.getElementById('dc_pavg')?.value||0);
  if(typeof setField==='function'){setField('curr_phyd',v.toFixed(2));setField('lc_pavg',v.toFixed(2));}
  if(window.S) window.S.dc_pavg=v;
};

/* ─── Thermal Rise pre-sync wrapper ─── */
(function(){
  const _orig=window.runThermalRise;
  window.runThermalRise=function(){
    const S=window.S||{};
    const sf=(id,v)=>{try{const el=document.getElementById(id);if(el&&v!=null&&!isNaN(+v))el.value=+v;}catch(e){}};
    sf('tr_Vnom', S.V_nom_pack||358);
    sf('tr_Qah',  S.Q_pack||120);
    if(S.t_tcell_max){sf('tr_T_limit',S.t_tcell_max);sf('tr_T_derate',S.t_tcell_max-10);}
    if(S.t_top_hi) sf('tr_Tamb',S.t_top_hi);
    const Cth=(S.pack_mass||0)*(S.c_cp_pack||1025)/1000;
    if(Cth>1) sf('tr_Cth',Cth.toFixed(1));
    const ir=S._packIR_bol||((S.c_ir_bol||0.22)*(S.S_total||112)/(S.c_pp||1)*1000);
    if(ir>0) sf('tr_ir',ir.toFixed(1));
    const c=document.getElementById('tr_canvas');
    if(c){const W=c.parentElement?.clientWidth||900;if(W>200)c.width=W;c.height=480;}
    if(typeof _orig==='function') try{_orig();}catch(err){console.warn('[TR]',err);}
  };
})();

/* ─── Compat ─── */
window.analyzeDriveCycle=function(input){if(input?.files?.[0])dcHandleFile(input.files[0]);};

/* ─── Auto-analyse on load ─── */
window.addEventListener('load',()=>{
  setTimeout(()=>{
    if(window._dcMode!=='csv'){
      const pts=window.getDCPoints();
      if(pts.length>=2){window._dcMode='manual';dcAnalyseAndUpdate(pts);}
    }
  },2000);
});
