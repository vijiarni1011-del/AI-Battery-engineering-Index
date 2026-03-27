/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — TEST DATA ANALYSIS  v1.0
   AI-powered battery data analyst: upload CSV/Excel test log,
   auto-detects channels, runs physics checks, flags anomalies,
   generates charts, calls Claude API for engineering interpretation.
   ═══════════════════════════════════════════════════════════════ */

/* ── Register in Battery Testing nav ── */
(function patchBTCats() {
  if (typeof BT_CATS !== 'undefined') {
    if (!BT_CATS.find(c => c.id === 'data_analysis')) {
      BT_CATS.push({ id:'data_analysis', icon:'🔬', label:'Test Data Analysis', color:'#e879f9' });
    }
  }
  /* Hook renderBatteryTesting to handle our new cat */
  const _orig = window.renderBatteryTesting;
  window.renderBatteryTesting = function(catId) {
    if (catId === 'data_analysis') {
      renderDataAnalysis();
    } else {
      if (typeof _orig === 'function') _orig(catId);
    }
  };
})();

/* ═════════════════════════════════════════
   GLOBAL STATE
═════════════════════════════════════════ */
window._tdaData   = null;   // {headers, rows, colMap, fileName, nRows}
window._tdaColMap = {};     // { t, v_pack, i_pack, soc, t_cells:[], v_cells:[], ... }
window._tdaResult = null;   // AI analysis result

/* ═════════════════════════════════════════
   MAIN RENDER
═════════════════════════════════════════ */
window.renderDataAnalysis = function() {
  const root = document.getElementById('bt_root');
  if (!root) return;
  const S = window.S || {};

  const hasData = window._tdaData && window._tdaData.rows?.length > 0;

  root.innerHTML = `
<style>
#tda_shell{display:flex;flex-direction:column;min-height:600px}
#tda_topbar{background:var(--bg2);border-bottom:1px solid var(--border);flex-shrink:0;padding:0}
#tda_subnav{display:flex;gap:2px;flex-wrap:wrap;padding:8px 12px}
.tda-catbtn{display:flex;align-items:center;gap:5px;padding:6px 13px;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:var(--sans);transition:all .12s;border:1px solid transparent;background:transparent;color:var(--text2)}
.tda-catbtn:hover{background:rgba(255,255,255,.04)}
.tda-catbtn.active{border-color:#e879f950;background:#e879f915;color:#e879f9}
.tda-card{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px}
.tda-section{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);margin:18px 0 8px;padding-bottom:5px;border-bottom:1px solid var(--border)}
.tda-badge-pass{padding:2px 8px;background:rgba(0,212,170,.15);border:1px solid rgba(0,212,170,.35);border-radius:4px;color:var(--g);font-size:10px;font-weight:700}
.tda-badge-warn{padding:2px 8px;background:rgba(245,197,24,.12);border:1px solid rgba(245,197,24,.35);border-radius:4px;color:var(--y);font-size:10px;font-weight:700}
.tda-badge-fail{padding:2px 8px;background:rgba(255,77,109,.12);border:1px solid rgba(255,77,109,.35);border-radius:4px;color:var(--r);font-size:10px;font-weight:700}
.tda-anomaly{padding:10px 14px;margin-bottom:6px;border-radius:8px;display:flex;align-items:flex-start;gap:10px}
.tda-kpi{background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:10px 14px;text-align:center}
.tda-kpi-v{font-size:18px;font-weight:800;font-family:var(--mono)}
.tda-kpi-l{font-size:10px;color:var(--text3);margin-top:2px}
.tda-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.tda-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:700px){.tda-grid-3,.tda-grid-2{grid-template-columns:1fr}}
.tda-inp{padding:5px 8px;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-family:var(--mono);font-size:12px;width:100%;outline:none;box-sizing:border-box}
.tda-inp:focus{border-color:rgba(232,121,249,.4)}
.tda-ai-block{padding:14px 16px;background:rgba(232,121,249,.05);border:1px solid rgba(232,121,249,.2);border-radius:10px;font-size:13px;line-height:1.8;color:var(--text2)}
.tda-ai-block h4{color:#e879f9;font-size:13px;font-weight:700;margin:10px 0 4px}
.tda-ai-block ul{margin:4px 0 10px;padding-left:18px}
.tda-ai-block li{margin-bottom:3px;font-size:12px}
</style>

<div id="tda_shell">
  <!-- Nav reuses BT subnav pattern -->
  <div id="tda_topbar">
    <div id="tda_subnav">
      ${(typeof BT_CATS!=='undefined'?BT_CATS:[]).map(c=>`
        <button class="tda-catbtn ${c.id==='data_analysis'?'active':''}"
          style="${c.id==='data_analysis'?'border-color:#e879f950;background:#e879f915;color:#e879f9':''}"
          onclick="renderBatteryTesting('${c.id}')">
          <span style="font-size:13px">${c.icon}</span>${c.label}
        </button>`).join('')}
    </div>
    <!-- Project context -->
    <div style="display:flex;flex-wrap:wrap;gap:5px;padding:7px 14px;background:var(--bg3);border-bottom:1px solid var(--border);align-items:center;font-size:11px">
      <span style="font-size:9px;font-family:var(--mono);color:var(--text3)">LINKED PROJECT →</span>
      ${[
        ['Chem',(S.c_chem||'LFP')],['Config',(S.S_total||112)+'S/'+(S.c_pp||1)+'P'],
        ['V_nom',(S.V_nom_pack||358).toFixed(0)+'V'],['V_max',(S.V_max_pack||420).toFixed(0)+'V'],
        ['V_cell_max',(S.c_vmax||3.65)+'V'],['V_cell_min',(S.c_vmin||2.0)+'V'],
        ['Cap',(S.c_ah||120)+'Ah'],['T_max',(S.t_tcell_max||55)+'°C'],
        ['IR_BoL',(S.c_ir_bol||0.22)+'mΩ'],['Markets',(S.markets||'EU')]
      ].map(([k,v])=>`<div style="display:flex;gap:3px;align-items:center;background:var(--bg4);border:1px solid var(--border2);border-radius:4px;padding:2px 7px">
        <span style="font-size:9px;font-family:var(--mono);color:var(--text3)">${k}</span>
        <span style="font-size:11px;font-family:var(--mono);color:#e879f9;font-weight:700">${v}</span>
      </div>`).join('')}
    </div>
  </div>

  <div style="padding:20px">
    <!-- Section header -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
      <div style="width:46px;height:46px;border-radius:12px;background:#e879f918;border:1px solid #e879f940;display:flex;align-items:center;justify-content:center;font-size:22px">🔬</div>
      <div>
        <div style="font-family:var(--display);font-size:17px;font-weight:700;color:var(--text)">AI Test Data Analysis</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Upload battery test logs · Auto-detect channels · AI-powered anomaly detection · Engineering interpretation</div>
      </div>
    </div>

    <!-- ── UPLOAD ZONE ── -->
    <div class="tda-card" id="tda_upload_card">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">📂 Upload Test Data Log</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:10px;line-height:1.7">
        Accepts: <b>CSV, Excel (.xlsx/.xls), TSV</b> — any test equipment export.
        Supports: battery cycler (Arbin, Bitrode, Maccor), BMS log, thermal chamber, CAN log, drive cycle data.
        Column detection is automatic — all standard signal names recognised.
      </div>

      <div id="tda_dropzone" style="border:2px dashed var(--border2);border-radius:10px;padding:28px 20px;text-align:center;cursor:pointer;transition:all .2s;background:var(--bg4)"
        onclick="document.getElementById('tda_file').click()"
        ondragover="event.preventDefault();this.style.borderColor='#e879f9';this.style.background='rgba(232,121,249,.06)'"
        ondragleave="this.style.borderColor='var(--border2)';this.style.background='var(--bg4)'"
        ondrop="event.preventDefault();this.style.borderColor='var(--border2)';this.style.background='var(--bg4)';if(event.dataTransfer.files[0])tdaHandleFile(event.dataTransfer.files[0])">
        <div style="font-size:28px;margin-bottom:8px">📊</div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">Drop test log here or click to browse</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">CSV · Excel · TSV · BMS log · Cycler export</div>
        <input type="file" id="tda_file" accept=".csv,.xlsx,.xls,.txt,.tsv" style="display:none" onchange="tdaHandleFile(this.files[0])">
      </div>

      <!-- Progress -->
      <div id="tda_progress" style="display:none;margin-top:10px">
        <div id="tda_prog_label" style="font-size:11px;font-family:var(--mono);color:var(--text2);margin-bottom:4px">Parsing…</div>
        <div style="height:4px;background:var(--bg4);border-radius:2px"><div id="tda_prog_bar" style="height:100%;width:0%;background:#e879f9;border-radius:2px;transition:width .2s"></div></div>
      </div>

      <!-- File badge -->
      <div id="tda_file_badge" style="display:none;margin-top:8px;padding:8px 12px;background:rgba(232,121,249,.08);border:1px solid rgba(232,121,249,.2);border-radius:7px;font-size:11px;font-family:var(--mono);color:#e879f9"></div>
    </div>

    ${hasData ? tdaBuildAnalysisUI() : `
    <!-- Placeholder when no data -->
    <div class="tda-card" style="text-align:center;padding:40px;color:var(--text3)">
      <div style="font-size:36px;margin-bottom:12px">📈</div>
      <div style="font-size:14px;font-weight:600;color:var(--text2);margin-bottom:8px">Upload a test log to begin analysis</div>
      <div style="font-size:11px;color:var(--text3);max-width:480px;margin:0 auto;line-height:1.7">
        Supports any battery test log from cyclers, BMS, thermal chambers, or CAN loggers.
        The AI will auto-detect pack voltage, current, cell voltages, temperatures, SOC and more —
        then run 14 physics-based checks and generate engineering interpretation.
      </div>
      <div class="tda-section" style="margin-top:20px;text-align:left">What this tool analyses</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-top:8px;text-align:left">
        ${[
          ['⚡','Cell Voltage','Min/max/spread/heatmap'],
          ['🌡️','Temperature','Hotspot, gradient, dT/dt'],
          ['📊','Pack V·I·P','Sag, ripple, power limit'],
          ['🔋','SOC/SOH','Capacity fade, coulombic eff.'],
          ['⚠️','Anomaly Detection','Weak cell, stuck sensor, drift'],
          ['📉','IR / DCIR','Resistance growth, pulse response'],
          ['💧','Thermal / Cooling','ΔT coolant, flow, efficiency'],
          ['🧠','BMS Events','Limits, faults, balancing'],
          ['📡','Charge/Discharge','Curves, CC-CV, efficiency'],
          ['🔍','Imbalance','Cell ranking, spread trend'],
        ].map(([i,t,d])=>`<div style="background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:10px 12px">
          <div style="font-size:18px;margin-bottom:4px">${i}</div>
          <div style="font-size:12px;font-weight:700;color:var(--text)">${t}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${d}</div>
        </div>`).join('')}
      </div>
    </div>`}
  </div>
</div>`;

  /* Re-draw charts if data exists */
  if (hasData) {
    requestAnimationFrame(() => { try { tdaDrawCharts(); } catch(e) { console.warn('[TDA charts]',e); } });
  }
};

/* ═════════════════════════════════════════
   BUILD ANALYSIS UI (when data loaded)
═════════════════════════════════════════ */
function tdaBuildAnalysisUI() {
  const d = window._tdaData;
  const S = window.S || {};
  const cm = window._tdaColMap;
  const checks = tdaRunChecks();
  const pass = checks.filter(c=>c.status==='pass').length;
  const warn = checks.filter(c=>c.status==='warn').length;
  const fail = checks.filter(c=>c.status==='fail').length;

  /* KPIs derived from data */
  const kpis = tdaComputeKPIs();

  /* Anomaly list */
  const anomalies = checks.filter(c=>c.status!=='pass');

  return `
<!-- ── DATA SUMMARY ── -->
<div class="tda-card" style="margin-bottom:12px">
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;color:var(--text)">📋 File: ${d.fileName} &nbsp;·&nbsp; <span style="color:#e879f9;font-family:var(--mono)">${d.nRows.toLocaleString()} rows · ${d.headers.length} channels</span></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <span style="font-size:10px;padding:3px 10px;background:rgba(0,212,170,.12);border:1px solid rgba(0,212,170,.3);border-radius:5px;color:var(--g);font-weight:700">✓ ${pass} Pass</span>
      <span style="font-size:10px;padding:3px 10px;background:rgba(245,197,24,.1);border:1px solid rgba(245,197,24,.3);border-radius:5px;color:var(--y);font-weight:700">⚠ ${warn} Warn</span>
      <span style="font-size:10px;padding:3px 10px;background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.3);border-radius:5px;color:var(--r);font-weight:700">✗ ${fail} Fail</span>
      <button onclick="tdaClearData()" style="padding:3px 10px;background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.25);color:var(--r);border-radius:5px;font-size:10px;font-weight:700;cursor:pointer">✕ Clear</button>
    </div>
  </div>

  <!-- Channel mapping -->
  <div style="font-size:11px;font-family:var(--mono);color:var(--text3);margin-bottom:6px">DETECTED CHANNELS:</div>
  <div style="display:flex;flex-wrap:wrap;gap:5px">
    ${Object.entries(cm).filter(([k,v])=>v!==null&&v!==undefined&&!Array.isArray(v)).map(([k,v])=>`
      <div style="padding:3px 9px;background:var(--bg4);border:1px solid var(--border);border-radius:5px;font-size:10px;font-family:var(--mono)">
        <span style="color:var(--text3)">${k}:</span> <span style="color:#e879f9">${d.headers[v]||v}</span>
      </div>`).join('')}
    ${cm.t_cells?.length>0?`<div style="padding:3px 9px;background:var(--bg4);border:1px solid var(--border);border-radius:5px;font-size:10px;font-family:var(--mono)"><span style="color:var(--text3)">cell_T:</span> <span style="color:#e879f9">${cm.t_cells.length} sensors</span></div>`:''}
    ${cm.v_cells?.length>0?`<div style="padding:3px 9px;background:var(--bg4);border:1px solid var(--border);border-radius:5px;font-size:10px;font-family:var(--mono)"><span style="color:var(--text3)">cell_V:</span> <span style="color:#e879f9">${cm.v_cells.length} channels</span></div>`:''}
  </div>
</div>

<!-- ── KPIs ── -->
<div class="tda-section">📊 Key Performance Indicators</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:16px">
  ${kpis.map(k=>`<div class="tda-kpi">
    <div class="tda-kpi-v" style="color:${k.color||'var(--teal)'}">${k.v}</div>
    <div class="tda-kpi-l">${k.l}</div>
    ${k.spec?`<div style="font-size:9px;font-family:var(--mono);color:${k.ok===false?'var(--r)':k.ok===true?'var(--g)':'var(--text3)'};margin-top:2px">${k.ok===false?'✗':k.ok===true?'✓':'—'} ${k.spec}</div>`:''}
  </div>`).join('')}
</div>

<!-- ── ANOMALIES ── -->
${anomalies.length>0?`
<div class="tda-section">🚨 Anomalies &amp; Findings (${anomalies.length})</div>
<div style="margin-bottom:16px">
  ${anomalies.map(c=>`<div class="tda-anomaly" style="background:${c.status==='fail'?'rgba(255,77,109,.06)':'rgba(245,197,24,.05)'};border:1px solid ${c.status==='fail'?'rgba(255,77,109,.25)':'rgba(245,197,24,.2)'};border-radius:8px;margin-bottom:6px">
    <div style="font-size:16px;flex-shrink:0">${c.status==='fail'?'🔴':'🟡'}</div>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700;color:${c.status==='fail'?'var(--r)':'var(--y)'}">${c.name}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:3px">${c.detail}</div>
      ${c.action?`<div style="font-size:11px;color:var(--teal);margin-top:4px">→ ${c.action}</div>`:''}
    </div>
    <span class="${c.status==='fail'?'tda-badge-fail':'tda-badge-warn'}" style="flex-shrink:0">${c.status.toUpperCase()}</span>
  </div>`).join('')}
</div>`:`<div class="ico-banner" style="margin-bottom:16px">✅ All ${checks.length} checks passed — no anomalies detected</div>`}

<!-- ── CHARTS ── -->
<div class="tda-section">📈 Charts</div>
<div class="tda-grid-2" style="margin-bottom:16px">
  <div class="tda-card" style="padding:12px">
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">Pack V · I · P over Time</div>
    <canvas id="tda_vip_canvas" height="180" style="width:100%;display:block;background:var(--bg);border-radius:6px"></canvas>
    <div style="display:flex;gap:12px;margin-top:5px;font-size:9px;font-family:var(--mono)">
      <span style="color:#4a9eff">━ Voltage</span>
      <span style="color:#00d4aa">━ Current</span>
      <span style="color:#ff7b35">━ Power</span>
    </div>
  </div>
  <div class="tda-card" style="padding:12px">
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">Temperature Channels</div>
    <canvas id="tda_temp_canvas" height="180" style="width:100%;display:block;background:var(--bg);border-radius:6px"></canvas>
    <div style="display:flex;gap:12px;margin-top:5px;font-size:9px;font-family:var(--mono)">
      <span style="color:#ff7b35">━ Max cell T</span>
      <span style="color:#4a9eff">━ Min cell T</span>
      <span style="color:#f5c518">- - T limit</span>
    </div>
  </div>
</div>
<div class="tda-grid-2" style="margin-bottom:16px">
  <div class="tda-card" style="padding:12px">
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">Cell Voltage Spread (Max / Avg / Min)</div>
    <canvas id="tda_spread_canvas" height="180" style="width:100%;display:block;background:var(--bg);border-radius:6px"></canvas>
    <div style="display:flex;gap:12px;margin-top:5px;font-size:9px;font-family:var(--mono)">
      <span style="color:#ef4444">━ V_max cell</span>
      <span style="color:#00d4aa">━ V_avg</span>
      <span style="color:#4a9eff">━ V_min cell</span>
    </div>
  </div>
  <div class="tda-card" style="padding:12px">
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">Cell Voltage Heatmap</div>
    <canvas id="tda_heatmap_canvas" height="180" style="width:100%;display:block;background:var(--bg);border-radius:6px"></canvas>
    <div style="font-size:9px;font-family:var(--mono);color:var(--text3);margin-top:4px">Cell index (Y) vs Time (X) · Colour = voltage deviation from mean</div>
  </div>
</div>
<div class="tda-card" style="margin-bottom:16px;padding:12px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">SoC + Pack Voltage + Current</div>
  <canvas id="tda_soc_canvas" height="160" style="width:100%;display:block;background:var(--bg);border-radius:6px"></canvas>
</div>

<!-- ── AI ANALYSIS ── -->
<div class="tda-section">🤖 AI Engineering Interpretation</div>
<div id="tda_ai_panel">
  <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:flex-start">
    <div style="flex:1;min-width:200px">
      <label style="font-size:10px;font-family:var(--mono);color:var(--text3);display:block;margin-bottom:4px">Test context (optional — helps AI give better interpretation)</label>
      <input class="tda-inp" id="tda_context_input" placeholder="e.g. Cycle 450 capacity check, NMC 112S/1P, 25°C ambient, C/3 discharge" value="">
    </div>
    <div style="display:flex;flex-direction:column;gap:5px">
      <button onclick="tdaRunAI(false)" id="tda_ai_btn"
        style="padding:9px 18px;background:rgba(232,121,249,.15);border:1px solid rgba(232,121,249,.4);color:#e879f9;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">
        🤖 Run AI Analysis
      </button>
      <button onclick="tdaRunAI(true)"
        style="padding:6px 18px;background:rgba(74,158,255,.08);border:1px solid rgba(74,158,255,.25);color:var(--b);border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">
        📊 Deep Analysis + Recommendations
      </button>
    </div>
  </div>
  <div id="tda_ai_result">
    <div style="padding:30px;text-align:center;color:var(--text3);background:var(--bg4);border-radius:10px;border:1px solid var(--border)">
      <div style="font-size:24px;margin-bottom:8px">🤖</div>
      <div style="font-size:12px">Click <b>Run AI Analysis</b> to get engineering interpretation of this test data.<br>The AI reads your project targets and detected channels for context.</div>
    </div>
  </div>
</div>

<!-- ── EXPORT ── -->
<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
  <button onclick="tdaExportReport()" style="padding:8px 16px;background:rgba(0,212,170,.1);border:1px solid rgba(0,212,170,.3);color:var(--g);border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">⬇ Export Analysis Report (CSV)</button>
  <button onclick="tdaExportSummary()" style="padding:8px 16px;background:rgba(74,158,255,.08);border:1px solid rgba(74,158,255,.25);color:var(--b);border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">📄 Copy Summary Text</button>
</div>`;
}

/* ═════════════════════════════════════════
   FILE HANDLING
═════════════════════════════════════════ */
window.tdaHandleFile = function(file) {
  if (!file) return;
  const prog = document.getElementById('tda_progress');
  const bar  = document.getElementById('tda_prog_bar');
  const lbl  = document.getElementById('tda_prog_label');
  if (prog) prog.style.display = 'block';
  if (bar)  bar.style.width = '10%';
  if (lbl)  lbl.textContent = `Reading ${file.name} (${(file.size/1024).toFixed(0)} KB)…`;

  const ext = file.name.split('.').pop().toLowerCase();
  const run = () => {
    if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
      const r = new FileReader();
      r.onprogress = e => { if(e.lengthComputable&&bar) bar.style.width=(e.loaded/e.total*50)+'%'; };
      r.onload = e => tdaParseText(e.target.result, file.name, lbl, bar, prog);
      r.readAsText(file);
    } else {
      const r = new FileReader();
      r.onload = e => {
        try {
          if (bar) bar.style.width = '40%';
          const wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
          // Find sheet with most numeric data
          let best = null, bestN = 0;
          wb.SheetNames.forEach(name => {
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:''});
            const n = rows.flat().filter(v=>!isNaN(parseFloat(v))&&v!=='').length;
            if (n > bestN) { bestN=n; best={name,rows}; }
          });
          if (!best) { if(lbl) lbl.textContent='⚠ No numeric data found'; return; }
          if (bar) bar.style.width = '60%';
          const text = best.rows.map(r=>r.join('\t')).join('\n');
          tdaParseText(text, file.name+'['+best.name+']', lbl, bar, prog, '\t');
        } catch(err) { if(lbl) lbl.textContent='⚠ Excel error: '+err.message; }
      };
      r.readAsArrayBuffer(file);
    }
  };

  if ((ext==='xlsx'||ext==='xls') && typeof XLSX==='undefined') {
    const s = document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = run; document.head.appendChild(s);
  } else { run(); }
};

function tdaParseText(text, fileName, lbl, bar, prog, forceDelim) {
  setTimeout(() => {
    try {
      const lines = text.split(/\r?\n/).filter(l=>l.trim());
      const delim = forceDelim||(lines[0].includes('\t')?'\t':lines[0].includes(';')?';':',');
      const hasHdr = isNaN(parseFloat(lines[0].split(delim)[0].trim()));
      const hdr = hasHdr ? lines[0].split(delim).map(h=>h.trim()) : lines[0].split(delim).map((_,i)=>`Col${i}`);
      const hdrLow = hdr.map(h=>h.toLowerCase().replace(/[^a-z0-9_]/g,''));

      /* Parse rows */
      const startIdx = hasHdr ? 1 : 0;
      const rows = [];
      for (let i=startIdx; i<Math.min(lines.length,startIdx+50000); i++) {
        const l = lines[i].trim();
        if (!l || l.startsWith('#')) continue;
        const cols = l.split(delim);
        rows.push(cols.map(v=>{ const n=parseFloat(v); return isNaN(n)?v:n; }));
      }

      if (rows.length < 2) { if(lbl) lbl.textContent='⚠ Too few rows'; return; }
      if (bar) bar.style.width='80%';

      /* Column mapping */
      const cm = tdaDetectCols(hdr, hdrLow);
      window._tdaColMap = cm;
      window._tdaData = { headers:hdr, rows, fileName, nRows:rows.length };

      if (bar) bar.style.width='100%';
      setTimeout(()=>{ if(prog) prog.style.display='none'; },1000);

      const badge = document.getElementById('tda_file_badge');
      if (badge) {
        badge.style.display='block';
        const durS = cm.t!==null ? (rows[rows.length-1][cm.t]-rows[0][cm.t]) : 0;
        badge.innerHTML=`✓ <b>${fileName}</b> · ${rows.length.toLocaleString()} rows · ${hdr.length} channels · ${durS>3600?(durS/3600).toFixed(2)+'h':durS>60?(durS/60).toFixed(0)+'min':durS+'s'}`;
      }
      if (lbl) lbl.textContent = `✓ ${rows.length.toLocaleString()} rows · ${hdr.length} channels detected`;

      /* Re-render full UI */
      renderDataAnalysis();
    } catch(err) {
      if (lbl) lbl.textContent='⚠ Parse error: '+err.message;
      console.error('[TDA parse]',err);
    }
  }, 20);
}

/* ═════════════════════════════════════════
   COLUMN DETECTION
═════════════════════════════════════════ */
function tdaDetectCols(hdr, hdrLow) {
  const f = (...keys) => { for(const k of keys){ const i=hdrLow.findIndex(h=>h.includes(k)); if(i>=0) return i; } return null; };
  const fAll = (...keys) => hdrLow.reduce((a,h,i)=>{ if(keys.some(k=>h.includes(k))) a.push(i); return a; },[]);

  return {
    t:        f('time','timestamp','elapsed','t_s','tsec'),
    v_pack:   f('vpack','packvolt','voltage_pack','v_bat','vbat','pack_v','packv','volt') ,
    i_pack:   f('ipack','current_pack','i_bat','ibat','pack_i','current','amp'),
    p_pack:   f('power_pack','p_pack','power','watt','kw'),
    soc:      f('soc','stateofcharge','soc_pct','soc_%'),
    soh:      f('soh','stateofhealth'),
    temp_amb: f('tamb','ambient','t_ambient','temp_amb'),
    temp_cool_in:  f('tcool_in','coolant_in','t_in','inlet_temp'),
    temp_cool_out: f('tcool_out','coolant_out','t_out','outlet_temp'),
    flow:     f('flow','flowrate','coolant_flow'),
    ir_pack:  f('r_pack','ir_pack','resistance','dcir_pack'),
    // Multi-channel: all cells
    v_cells:  fAll('vcell','cell_v','cellvolt','v_cell','cv','voltage_cell'),
    t_cells:  fAll('tcell','cell_t','celltemp','t_cell','ct','temp_cell'),
    fault:    f('fault','error','alarm','dtc','event'),
    balance:  f('balance','balancing','bal_'),
    contactor:f('contactor','relay','hvil'),
    insul:    f('insulation','isolation','iso_r','leakage'),
  };
}

/* ═════════════════════════════════════════
   PHYSICS CHECKS
═════════════════════════════════════════ */
function tdaRunChecks() {
  const d  = window._tdaData;
  const cm = window._tdaColMap;
  const S  = window.S || {};
  const rows = d.rows;
  const checks = [];

  const col = (ci) => ci!==null ? rows.map(r=>+r[ci]).filter(v=>!isNaN(v)) : [];
  const stat = (arr) => {
    if (!arr.length) return {min:0,max:0,mean:0,std:0};
    const mn=Math.min(...arr),mx=Math.max(...arr),mean=arr.reduce((a,b)=>a+b)/arr.length;
    const std=Math.sqrt(arr.reduce((a,b)=>a+(b-mean)**2,0)/arr.length);
    return {min:mn,max:mx,mean,std};
  };

  /* 1. Timestamp sanity */
  if (cm.t !== null) {
    const ts = col(cm.t);
    const gaps = ts.slice(1).map((v,i)=>v-ts[i]).filter(g=>g<0);
    if (gaps.length > 0) checks.push({name:'Timestamp out-of-order',status:'fail',
      detail:`${gaps.length} reverse-time events detected.`,action:'Sort data by timestamp before analysis.'});
    else checks.push({name:'Timestamp sanity',status:'pass',detail:'Timestamps monotonically increasing'});

    const dts = ts.slice(1).map((v,i)=>v-ts[i]);
    const dtMed = dts.sort((a,b)=>a-b)[Math.floor(dts.length/2)];
    const bigGaps = dts.filter(g=>g>dtMed*10&&g>30);
    if (bigGaps.length>0) checks.push({name:'Data gaps detected',status:'warn',
      detail:`${bigGaps.length} gaps >10× median sample interval (${dtMed.toFixed(1)}s). Longest: ${Math.max(...bigGaps).toFixed(0)}s.`,
      action:'Check for data dropouts or test pauses. Gaps may affect Ah integration accuracy.'});
  } else {
    checks.push({name:'No timestamp column',status:'warn',detail:'Could not detect a time channel. Duration-based KPIs unavailable.',action:'Ensure column header contains "time" or "timestamp".'});
  }

  /* 2. Pack voltage vs spec */
  if (cm.v_pack !== null) {
    const vp = col(cm.v_pack);
    const s = stat(vp);
    const vmax_spec = S.V_max_pack || 420;
    const vmin_spec = S.V_min_pack || 250;
    if (s.max > vmax_spec*1.01) checks.push({name:'Pack overvoltage event',status:'fail',
      detail:`Pack V_max in log = ${s.max.toFixed(1)}V > spec ${vmax_spec}V.`,action:'Investigate BMS OVP response. Verify calibration.'});
    else if (s.min < vmin_spec*0.99) checks.push({name:'Pack undervoltage event',status:'warn',
      detail:`Pack V_min = ${s.min.toFixed(1)}V < spec ${vmin_spec}V.`,action:'Check deep discharge event. BMS UVP threshold may need tightening.'});
    else checks.push({name:'Pack voltage range',status:'pass',detail:`V: ${s.min.toFixed(1)}–${s.max.toFixed(1)}V within spec [${vmin_spec}–${vmax_spec}V]`});
  }

  /* 3. Cell voltage checks */
  if (cm.v_cells?.length > 1) {
    const allCellV = cm.v_cells.map(ci=>col(ci));
    const spreads = rows.map((_,ri)=>{
      const vals = cm.v_cells.map(ci=>+rows[ri][ci]).filter(v=>!isNaN(v)&&v>0);
      return vals.length>1 ? Math.max(...vals)-Math.min(...vals) : 0;
    }).filter(v=>v>0);
    const maxSpread = Math.max(...spreads);
    const avgSpread = spreads.reduce((a,b)=>a+b)/spreads.length;
    if (maxSpread > 0.1) checks.push({name:'High cell voltage spread',status:'fail',
      detail:`Max cell spread = ${(maxSpread*1000).toFixed(0)} mV. Average spread = ${(avgSpread*1000).toFixed(0)} mV.`,
      action:'Identify weak/outlier cell. Check harness resistance. Consider cell replacement or rebalancing.'});
    else if (maxSpread > 0.05) checks.push({name:'Moderate cell voltage spread',status:'warn',
      detail:`Max spread = ${(maxSpread*1000).toFixed(0)} mV — approaching 50 mV threshold.`,
      action:'Monitor trend. Run DCIR test to check cell impedance mismatch.'});
    else checks.push({name:'Cell voltage balance',status:'pass',detail:`Max spread ${(maxSpread*1000).toFixed(0)} mV — within normal range`});

    /* Check for stuck sensor */
    allCellV.forEach((vs,ci)=>{
      if (vs.length>10) {
        const std = stat(vs).std;
        if (std < 0.001 && vs.length>100) checks.push({name:`Cell ${ci+1} stuck sensor`,status:'warn',
          detail:`Cell ${ci+1} voltage std dev = ${(std*1000).toFixed(2)} mV — possibly stuck/frozen sensor.`,
          action:'Verify sensor wiring for cell '+( ci+1)+'. Replace if confirmed stuck.'});
      }
    });
  }

  /* 4. Temperature checks */
  if (cm.t_cells?.length > 0) {
    const tLimit = S.t_tcell_max || 55;
    const tAll = cm.t_cells.flatMap(ci=>col(ci));
    const s = stat(tAll);
    if (s.max > tLimit) checks.push({name:'Cell overtemperature event',status:'fail',
      detail:`T_max = ${s.max.toFixed(1)}°C > spec ${tLimit}°C. Duration above limit requires investigation.`,
      action:'Check TMS activation, coolant flow, and local hotspot location. Implement derating earlier.'});
    else if (s.max > tLimit-5) checks.push({name:'Temperature approaching limit',status:'warn',
      detail:`T_max = ${s.max.toFixed(1)}°C within 5°C of ${tLimit}°C limit.`,
      action:'Verify TMS is activating at correct threshold. Check coolant flow rate.'});
    else checks.push({name:'Cell temperature range',status:'pass',detail:`T: ${s.min.toFixed(1)}–${s.max.toFixed(1)}°C within spec`});

    /* Temperature spread */
    if (cm.t_cells.length > 1) {
      const tSpreads = rows.map((_,ri)=>{
        const vals = cm.t_cells.map(ci=>+rows[ri][ci]).filter(v=>!isNaN(v)&&v>-100);
        return vals.length>1?Math.max(...vals)-Math.min(...vals):0;
      }).filter(v=>v>0);
      const maxTSpread = Math.max(...tSpreads);
      const tGradSpec = S.t_tgrad || 5;
      if (maxTSpread > tGradSpec) checks.push({name:'Excessive temperature gradient',status:maxTSpread>tGradSpec*1.5?'fail':'warn',
        detail:`Max ΔT across cells = ${maxTSpread.toFixed(1)}°C > spec ${tGradSpec}°C.`,
        action:'Inspect coolant distribution. Check for blocked channels or uneven thermal pad contact.'});
      else checks.push({name:'Temperature uniformity',status:'pass',detail:`Max ΔT = ${maxTSpread.toFixed(1)}°C within ${tGradSpec}°C spec`});
    }
  }

  /* 5. SOC checks */
  if (cm.soc !== null) {
    const socs = col(cm.soc);
    const s = stat(socs);
    if (s.min < 5) checks.push({name:'Deep discharge event',status:'warn',
      detail:`SOC reached ${s.min.toFixed(1)}% — below typical 10% floor.`,action:'Verify BMS UVP and SOC floor settings.'});
    else checks.push({name:'SOC range',status:'pass',detail:`SOC: ${s.min.toFixed(0)}–${s.max.toFixed(0)}%`});
  }

  /* 6. Coolant ΔT check */
  if (cm.temp_cool_in!==null && cm.temp_cool_out!==null) {
    const tin = col(cm.temp_cool_in), tout = col(cm.temp_cool_out);
    const dts = tin.map((v,i)=>Math.abs(tout[i]-v));
    const maxDT = Math.max(...dts);
    if (maxDT > 15) checks.push({name:'High coolant ΔT',status:'warn',
      detail:`Max coolant ΔT = ${maxDT.toFixed(1)}°C. High ΔT indicates high heat load or insufficient flow.`,
      action:'Increase coolant flow rate or check pump performance.'});
    else checks.push({name:'Coolant ΔT',status:'pass',detail:`Max ΔT = ${maxDT.toFixed(1)}°C — acceptable`});
  }

  /* 7. IR check if available */
  if (cm.ir_pack !== null) {
    const ir = col(cm.ir_pack).filter(v=>v>0);
    if (ir.length>0) {
      const s = stat(ir);
      const ir_spec = (S.c_ir_bol||0.22)*(S.S_total||112)/(S.c_pp||1)*1000;
      if (s.max > ir_spec*2.0) checks.push({name:'Pack IR at EoL threshold',status:'fail',
        detail:`Pack IR = ${s.max.toFixed(0)} mΩ — ≥2× BoL spec (${ir_spec.toFixed(0)} mΩ). EoL criterion reached.`,
        action:'Schedule cell replacement. Run capacity check to confirm SoH.'});
      else if (s.max > ir_spec*1.5) checks.push({name:'Pack IR growth elevated',status:'warn',
        detail:`Pack IR = ${s.max.toFixed(0)} mΩ — ${(s.max/ir_spec*100).toFixed(0)}% of BoL. Ageing progressing.`,
        action:'Track IR trend across cycles. Plan replacement before 2× BoL.'});
    }
  }

  return checks;
}

/* ═════════════════════════════════════════
   KPI COMPUTATION
═════════════════════════════════════════ */
function tdaComputeKPIs() {
  const d  = window._tdaData;
  const cm = window._tdaColMap;
  const S  = window.S || {};
  const rows = d.rows;
  const col = (ci) => ci!==null ? rows.map(r=>+r[ci]).filter(v=>!isNaN(v)) : [];

  const kpis = [];

  /* Duration */
  if (cm.t!==null) {
    const ts = col(cm.t);
    const dur = ts[ts.length-1]-ts[0];
    kpis.push({l:'Duration',v:dur>3600?(dur/3600).toFixed(2)+'h':(dur/60).toFixed(0)+'min',color:'var(--b)'});
  }

  /* Pack V stats */
  if (cm.v_pack!==null) {
    const vp = col(cm.v_pack);
    const mn=Math.min(...vp),mx=Math.max(...vp);
    kpis.push({l:'V_max (pack)',v:mx.toFixed(1)+'V',color:'var(--text)',
      spec:'≤'+(S.V_max_pack||420)+'V',ok:mx<=(S.V_max_pack||420)});
    kpis.push({l:'V_min (pack)',v:mn.toFixed(1)+'V',color:'var(--text)',
      spec:'≥'+(S.V_min_pack||250)+'V',ok:mn>=(S.V_min_pack||250)});
  }

  /* Current */
  if (cm.i_pack!==null) {
    const ip=col(cm.i_pack);
    const mx=Math.max(...ip.map(Math.abs));
    kpis.push({l:'I_peak',v:mx.toFixed(0)+'A',color:'var(--o)'});
  }

  /* Cell V spread */
  if (cm.v_cells?.length>1) {
    const spreads=rows.map((_,ri)=>{
      const vals=cm.v_cells.map(ci=>+rows[ri][ci]).filter(v=>!isNaN(v)&&v>0);
      return vals.length>1?Math.max(...vals)-Math.min(...vals):0;
    }).filter(v=>v>0);
    const maxSpread=Math.max(...spreads);
    kpis.push({l:'Max cell ΔV',v:(maxSpread*1000).toFixed(0)+'mV',
      color:maxSpread>0.1?'var(--r)':maxSpread>0.05?'var(--y)':'var(--g)',
      spec:'<50mV',ok:maxSpread<0.05});
    kpis.push({l:'Cell channels',v:cm.v_cells.length,color:'var(--b)'});
  }

  /* Temperature */
  if (cm.t_cells?.length>0) {
    const tAll=cm.t_cells.flatMap(ci=>col(ci));
    const mx=Math.max(...tAll);
    kpis.push({l:'T_max (cell)',v:mx.toFixed(1)+'°C',
      color:mx>(S.t_tcell_max||55)?'var(--r)':mx>(S.t_tcell_max||55)-10?'var(--y)':'var(--g)',
      spec:'≤'+(S.t_tcell_max||55)+'°C',ok:mx<=(S.t_tcell_max||55)});
  }

  /* SOC range */
  if (cm.soc!==null) {
    const socs=col(cm.soc);
    kpis.push({l:'SOC range',v:Math.min(...socs).toFixed(0)+'–'+Math.max(...socs).toFixed(0)+'%',color:'var(--teal)'});
  }

  /* Ah throughput */
  if (cm.i_pack!==null && cm.t!==null) {
    const ts=col(cm.t),ip=col(cm.i_pack);
    let ah=0;
    for(let i=1;i<Math.min(ts.length,ip.length);i++) ah+=Math.abs(ip[i])*(ts[i]-ts[i-1])/3600;
    kpis.push({l:'Ah throughput',v:ah.toFixed(1)+'Ah',color:'var(--b)'});
  }

  kpis.push({l:'Data rows',v:d.nRows.toLocaleString(),color:'var(--text3)'});
  kpis.push({l:'Channels',v:d.headers.length,color:'var(--text3)'});
  return kpis;
}

/* ═════════════════════════════════════════
   CHART DRAWING
═════════════════════════════════════════ */
function tdaDrawCharts() {
  const d  = window._tdaData;
  const cm = window._tdaColMap;
  if (!d) return;
  const rows = d.rows;
  const col  = (ci) => ci!==null ? rows.map(r=>+r[ci]) : [];
  const N    = rows.length;
  const step = Math.max(1, Math.floor(N/500)); // downsample to 500 pts max

  const times = cm.t!==null ? col(cm.t) : rows.map((_,i)=>i);
  const tmin=times[0]||0, tmax=times[times.length-1]||N;
  const norm = t=>(t-tmin)/(tmax-tmin||1);

  function drawLine(canvasId, datasets, ymin_o, ymax_o, xlabel, ylabel, thresholds=[]) {
    const cv = document.getElementById(canvasId);
    if (!cv) return;
    const W=cv.offsetWidth||700, H=cv.height||180;
    cv.width=W;
    const ctx=cv.getContext('2d');
    const pad={l:46,r:16,t:12,b:28};
    const pw=W-pad.l-pad.r, ph=H-pad.t-pad.b;

    let ymin=ymin_o,ymax=ymax_o;
    if(ymin==null||ymax==null){
      const all=datasets.flatMap(d=>d.data.filter(v=>!isNaN(v)));
      ymin=ymin_o??Math.min(...all);
      ymax=ymax_o??Math.max(...all);
    }
    const my=v=>pad.t+ph*(1-(v-ymin)/(ymax-ymin||1));
    const mx=t=>pad.l+norm(t)*pw;

    ctx.fillStyle='#07080b';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;
    [0,.25,.5,.75,1].forEach(f=>{
      const y=pad.t+ph*f;
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
      ctx.fillStyle='#3a567a';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='right';
      ctx.fillText((ymin+(ymax-ymin)*(1-f)).toFixed(1),pad.l-2,y+3);
    });

    thresholds.forEach(th=>{
      const y=my(th.v);
      ctx.strokeStyle=th.col||'rgba(255,77,109,.4)';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=th.col||'rgba(255,77,109,.7)';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='right';
      ctx.fillText(th.label||th.v,W-pad.r-2,y-3);
    });

    datasets.forEach(ds=>{
      if(!ds.data?.length) return;
      ctx.beginPath();ctx.strokeStyle=ds.color;ctx.lineWidth=ds.width||1.5;
      let first=true;
      for(let i=0;i<ds.data.length;i+=step){
        const v=ds.data[i]; if(isNaN(v)) continue;
        const t=times[i]??i;
        const x=mx(t),y=my(v);
        if(x<pad.l||x>W-pad.r) continue;
        first?ctx.moveTo(x,y):ctx.lineTo(x,y);
        first=false;
      }
      ctx.stroke();
    });

    ctx.fillStyle='#4a6080';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='center';
    ctx.fillText(xlabel,pad.l+pw/2,H-4);
  }

  /* V·I·P chart */
  const vp=col(cm.v_pack), ip=col(cm.i_pack), pp=col(cm.p_pack);
  drawLine('tda_vip_canvas',[
    {data:vp,color:'#4a9eff',label:'V'},
    {data:ip,color:'#00d4aa',label:'I'},
    {data:pp.length>2?pp:vp.map((v,i)=>v*(ip[i]||0)/1000),color:'#ff7b35',label:'P'},
  ],null,null,'Time','V/I/P');

  /* Temperature chart */
  if (cm.t_cells?.length>0) {
    const tArrays=cm.t_cells.map(ci=>col(ci));
    const tMax=tArrays[0].map((_,i)=>Math.max(...tArrays.map(a=>a[i]||0)));
    const tMin=tArrays[0].map((_,i)=>Math.min(...tArrays.map(a=>a[i]||999)));
    drawLine('tda_temp_canvas',[
      {data:tMax,color:'#ff7b35',label:'T_max',width:2},
      {data:tMin,color:'#4a9eff',label:'T_min'},
    ],null,null,'Time','°C',[
      {v:S.t_tcell_max||55,col:'rgba(255,77,109,.5)',label:'T_limit'},
      {v:(S.t_tcell_max||55)-10,col:'rgba(245,197,24,.4)',label:'T_derate'},
    ]);
  } else if (cm.temp_amb!==null) {
    drawLine('tda_temp_canvas',[{data:col(cm.temp_amb),color:'#ff7b35'}],null,null,'Time','°C');
  }

  /* Cell voltage spread */
  if (cm.v_cells?.length>1) {
    const cArrays=cm.v_cells.map(ci=>col(ci));
    const vMax=cArrays[0].map((_,i)=>Math.max(...cArrays.map(a=>a[i]||0)));
    const vMin=cArrays[0].map((_,i)=>Math.min(...cArrays.map(a=>a[i]||99)));
    const vAvg=cArrays[0].map((_,i)=>cArrays.reduce((s,a)=>s+(a[i]||0),0)/cArrays.length);
    drawLine('tda_spread_canvas',[
      {data:vMax,color:'#ef4444',width:2},{data:vAvg,color:'#00d4aa'},{data:vMin,color:'#4a9eff',width:2},
    ],null,null,'Time','V/cell',[
      {v:S.c_vmax||3.65,col:'rgba(255,77,109,.4)',label:'V_max_spec'},
      {v:S.c_vmin||2.0, col:'rgba(74,158,255,.4)', label:'V_min_spec'},
    ]);

    /* Heatmap */
    const hm=document.getElementById('tda_heatmap_canvas');
    if(hm){
      const W=hm.offsetWidth||700,H=180; hm.width=W;
      const ctx=hm.getContext('2d');
      ctx.fillStyle='#07080b';ctx.fillRect(0,0,W,H);
      const nCells=cm.v_cells.length;
      const cellH=Math.max(1,Math.floor((H-20)/nCells));
      const nT=Math.min(200,N);
      const tStep=Math.floor(N/nT);
      cArrays.forEach((arr,ci)=>{
        const mean=arr.reduce((a,b)=>a+b)/arr.length;
        for(let ti=0;ti<nT;ti++){
          const idx=ti*tStep;
          const v=arr[idx];
          const dev=(v-mean)/0.05; // normalise
          const r=dev>0?Math.round(255*Math.min(1,dev)):0;
          const b=dev<0?Math.round(255*Math.min(1,-dev)):0;
          ctx.fillStyle=`rgba(${r},${20+Math.round(40*Math.max(0,1-Math.abs(dev)))},${b},0.9)`;
          ctx.fillRect(Math.floor(ti/nT*W),ci*cellH+10,Math.ceil(W/nT)+1,cellH);
        }
      });
      ctx.fillStyle='#4a6080';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='left';
      ctx.fillText(`${nCells} cells · Red=above mean · Blue=below mean · Time →`,4,9);
    }
  }

  /* SOC chart */
  if (cm.soc!==null) {
    drawLine('tda_soc_canvas',[
      {data:col(cm.soc),color:'#00d4aa',label:'SOC',width:2},
    ],0,100,'Time','SOC %');
  } else if (cm.v_pack!==null) {
    drawLine('tda_soc_canvas',[{data:col(cm.v_pack),color:'#4a9eff'}],null,null,'Time','V');
  }
}

/* ═════════════════════════════════════════
   AI ANALYSIS via Claude API
═════════════════════════════════════════ */
window.tdaRunAI = async function(deep=false) {
  const btn = document.getElementById('tda_ai_btn');
  const resultEl = document.getElementById('tda_ai_result');
  if (!resultEl) return;

  const d  = window._tdaData;
  const cm = window._tdaColMap;
  const S  = window.S || {};
  const userCtx = document.getElementById('tda_context_input')?.value || '';

  if (btn) { btn.disabled=true; btn.textContent='🤖 Analysing…'; }
  resultEl.innerHTML=`<div class="tda-ai-block" style="text-align:center;padding:30px">
    <div style="font-size:24px;margin-bottom:8px;animation:spin 1.5s linear infinite;display:inline-block">⚙️</div>
    <div style="font-size:13px;color:var(--text2)">AI is reading your data and project targets…</div>
  </div>
  <style>@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}</style>`;

  /* Build context summary for AI */
  const checks = tdaRunChecks();
  const kpis   = tdaComputeKPIs();
  const anomalies = checks.filter(c=>c.status!=='pass');
  const col = (ci) => ci!==null ? d.rows.map(r=>+r[ci]).filter(v=>!isNaN(v)) : [];
  const stat = arr => {
    if(!arr.length) return null;
    const mn=Math.min(...arr),mx=Math.max(...arr),mean=arr.reduce((a,b)=>a+b)/arr.length;
    return {min:mn.toFixed(3),max:mx.toFixed(3),mean:mean.toFixed(3)};
  };

  const dataSummary = {
    fileName: d.fileName,
    rows: d.nRows,
    channels: d.headers.join(', '),
    duration: cm.t!==null?((col(cm.t).slice(-1)[0]-col(cm.t)[0])/60).toFixed(1)+'min':'unknown',
    pack_voltage: cm.v_pack!==null?stat(col(cm.v_pack)):null,
    pack_current: cm.i_pack!==null?stat(col(cm.i_pack)):null,
    soc: cm.soc!==null?stat(col(cm.soc)):null,
    cell_v_channels: cm.v_cells?.length||0,
    cell_t_channels: cm.t_cells?.length||0,
    temp_max: cm.t_cells?.length>0?Math.max(...cm.t_cells.flatMap(ci=>col(ci))):null,
  };

  const prompt = `You are a senior EV battery data analysis engineer at an OEM. Analyse this battery test log and provide a professional engineering interpretation.

## Project Context (from BatteryMIS Project Targets):
- Chemistry: ${S.c_chem||'LFP'}, Config: ${S.S_total||112}S/${S.c_pp||1}P
- Pack: V_nom=${S.V_nom_pack?.toFixed(0)||358}V, V_max=${S.V_max_pack?.toFixed(0)||420}V, V_min=${S.V_min_pack?.toFixed(0)||250}V
- Cell: V_max=${S.c_vmax||3.65}V, V_min=${S.c_vmin||2.0}V, Ah=${S.c_ah||120}Ah, IR_BoL=${S.c_ir_bol||0.22}mΩ
- Targets: P_peak=${S.t_ppeak||80}kW, P_cont=${S.t_pcont||50}kW, T_cell_max=${S.t_tcell_max||55}°C, IP=${S.t_ip||'IP67'}
- Lifetime: ${S.t_cycles||3000} cycles, SoH_EoL=${S.t_soh_eol||80}%
${userCtx?'- Test context: '+userCtx:''}

## Test Data Summary:
${JSON.stringify(dataSummary, null, 2)}

## Automated Checks (${checks.length} total):
${checks.map(c=>`- [${c.status.toUpperCase()}] ${c.name}: ${c.detail}`).join('\n')}

${deep?`
## Analysis Required (DEEP mode):
1. **Executive Summary** — 3 sentences: what was tested, overall health, critical finding
2. **Top 5 Anomaly Findings** — each with root cause hypothesis and recommended action
3. **Cell Balance Health** — interpretation of voltage spread, trend, weak cell identification
4. **Thermal Performance** — temperature rise rate, hotspot assessment, TMS effectiveness  
5. **Capacity / Energy Assessment** — Ah throughput, efficiency, ageing indicators
6. **BMS and Control Assessment** — limit events, SOC accuracy, protection activation
7. **Risk Rating** — Low/Medium/High/Critical with justification
8. **Next Test Recommendations** — what to run next based on findings
9. **DVP Checklist Items** — which DVP test requirements are satisfied or need repeating

Format each section with a clear heading. Be specific with numbers from the data.`
:`
## Analysis Required:
1. **Executive Summary** — 3 sentences: test type, overall health verdict, #1 finding
2. **Top Findings** — list the 3 most important engineering observations with values
3. **Recommended Actions** — 3 specific next steps for the engineer
4. **Data Quality** — any gaps, anomalies, or sensor issues to be aware of

Be concise and specific. Use engineering units. Reference specific values from the data summary.`}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:1500,
        messages:[{role:'user',content:prompt}]
      })
    });
    const data = await resp.json();
    const text = data.content?.map(b=>b.text||'').join('') || 'No response';

    /* Format markdown-ish output */
    const formatted = text
      .replace(/^## (.+)/gm,'<h4>$1</h4>')
      .replace(/^### (.+)/gm,'<h4 style="font-size:12px">$1</h4>')
      .replace(/^\*\*(.+)\*\*$/gm,'<h4>$1</h4>')
      .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
      .replace(/^- (.+)/gm,'<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/gs,m=>`<ul>${m}</ul>`)
      .replace(/\n\n/g,'<br><br>');

    resultEl.innerHTML=`<div class="tda-ai-block">${formatted}</div>
      <div style="font-size:10px;font-family:var(--mono);color:var(--text3);margin-top:8px;text-align:right">
        🤖 ${deep?'Deep':'Standard'} analysis · Claude Sonnet · ${new Date().toLocaleTimeString()}
      </div>`;
    window._tdaResult = text;
  } catch(err) {
    resultEl.innerHTML=`<div class="tda-ai-block" style="border-color:rgba(255,77,109,.3)">
      <h4 style="color:var(--r)">⚠ API Error</h4>
      <p>${err.message}</p>
      <p style="font-size:11px;color:var(--text3)">Ensure you are signed in to claude.ai for API access.</p>
    </div>`;
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='🤖 Run AI Analysis'; }
  }
};

/* ── Export ── */
window.tdaExportReport = function() {
  const checks = tdaRunChecks();
  const kpis   = tdaComputeKPIs();
  const S = window.S||{};
  const lines = [
    'BatteryMIS Test Data Analysis Report',
    `File: ${window._tdaData?.fileName||''}`,
    `Date: ${new Date().toISOString().slice(0,16)}`,
    `Project: ${S.proj||''} · ${S.c_chem||''} ${S.S_total||''}S/${S.c_pp||''}P`,
    '',
    'KPIs',
    ...kpis.map(k=>`${k.l},${k.v}`),
    '',
    'Checks',
    'Status,Check,Detail,Action',
    ...checks.map(c=>`${c.status.toUpperCase()},"${c.name}","${c.detail}","${c.action||''}"`),
    '',
    'AI Analysis',
    window._tdaResult || '(not run)',
  ];
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(lines.join('\n'));
  a.download=`TDA_Report_${(window._tdaData?.fileName||'data').replace(/\.\w+$/,'')}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
};

window.tdaExportSummary = function() {
  const checks=tdaRunChecks();
  const pass=checks.filter(c=>c.status==='pass').length;
  const warn=checks.filter(c=>c.status==='warn').length;
  const fail=checks.filter(c=>c.status==='fail').length;
  const txt=`BatteryMIS Test Data Analysis\nFile: ${window._tdaData?.fileName||''}\n${new Date().toLocaleString()}\n\nChecks: ${pass} pass / ${warn} warn / ${fail} fail\n\nFindings:\n${checks.filter(c=>c.status!=='pass').map(c=>`[${c.status.toUpperCase()}] ${c.name}: ${c.detail}`).join('\n')}\n\nAI Analysis:\n${window._tdaResult||'Not run'}`;
  navigator.clipboard?.writeText(txt).then(()=>alert('Summary copied to clipboard')).catch(()=>prompt('Copy this:',txt));
};

window.tdaClearData = function() {
  window._tdaData=null; window._tdaColMap={}; window._tdaResult=null;
  renderDataAnalysis();
};
