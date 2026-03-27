/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — TEST DATA ANALYSIS  v2.0
   AVL Concerto-style multi-pane analyser:
   - Channel browser (right panel) with drag-to-chart
   - Multi-pane stacked chart view with synchronized cursor
   - Zoom/pan per pane + global sync
   - Signal statistics + cursor readout
   - AI engineering interpretation
   ═══════════════════════════════════════════════════════════════ */

/* ── Register in Battery Testing nav ── */
(function patchBTCats() {
  const addCat = () => {
    if (typeof BT_CATS !== 'undefined' && !BT_CATS.find(c=>c.id==='data_analysis')) {
      BT_CATS.push({ id:'data_analysis', icon:'🔬', label:'Test Data Analysis', color:'#e879f9' });
    }
  };
  addCat();
  const _orig = window.renderBatteryTesting;
  window.renderBatteryTesting = function(catId) {
    addCat(); // ensure cat registered even if called before BT_CATS existed
    if (catId === 'data_analysis') renderDataAnalysis();
    else if (typeof _orig === 'function') _orig(catId);
  };
})();

/* ═════ GLOBAL STATE ═════ */
window._tda = {
  data:     null,   // {headers, rows, fileName, nRows, colMap}
  panes:    [],     // [{id, signals:[colIdx,...], ymin,ymax, zoom:{x0,x1}}]
  cursor:   null,   // global time cursor position (normalised 0-1)
  zoomX:    {x0:0, x1:1}, // global X zoom window
  aiResult: null,
  dragging: null,   // {colIdx, fromPaneId}
};

/* ═════ MAIN RENDER ═════ */
window.renderDataAnalysis = function() {
  const root = document.getElementById('bt_root');
  if (!root) return;
  const t = window._tda;
  const S = window.S || {};
  const hasData = t.data && t.data.rows?.length > 0;

  // Ensure at least one pane when data loaded
  if (hasData && t.panes.length === 0) tdaInitPanes();

  root.innerHTML = `
<style>
#tda_app{display:flex;flex-direction:column;height:100vh;max-height:calc(100vh - 120px);min-height:500px;background:var(--bg);font-family:var(--mono)}

/* ── TOP BAR ── */
#tda_topbar{background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:0;flex-shrink:0}
#tda_top_cats{display:flex;gap:2px;padding:6px 10px;flex-wrap:nowrap;overflow-x:auto;flex:1}
.tda-catbtn{display:flex;align-items:center;gap:4px;padding:5px 11px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:var(--sans);transition:all .12s;border:1px solid transparent;background:transparent;color:var(--text2)}
.tda-catbtn:hover{background:rgba(255,255,255,.04);color:var(--text)}
.tda-catbtn.active{border-color:#e879f950;background:#e879f915;color:#e879f9}

/* ── PROJECT CONTEXT BAR ── */
#tda_ctx_bar{display:flex;flex-wrap:wrap;gap:4px;padding:6px 14px;background:#080d18;border-bottom:1px solid var(--border);align-items:center;flex-shrink:0}
.tda-ctx-chip{display:flex;gap:3px;align-items:center;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:4px;padding:2px 7px}
.tda-ctx-k{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em}
.tda-ctx-v{font-size:10px;color:#e879f9;font-weight:700}

/* ── TOOLBAR ── */
#tda_toolbar{display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg3);border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap}
.tda-tbtn{padding:4px 10px;background:var(--bg4);border:1px solid var(--border);border-radius:5px;font-size:11px;color:var(--text2);cursor:pointer;font-family:var(--mono);transition:all .12s}
.tda-tbtn:hover{background:rgba(255,255,255,.06);color:var(--text);border-color:var(--border2)}
.tda-tbtn.active{background:rgba(232,121,249,.12);border-color:rgba(232,121,249,.4);color:#e879f9}
.tda-tsep{width:1px;height:20px;background:var(--border);flex-shrink:0}

/* ── MAIN LAYOUT ── */
#tda_main{display:flex;flex:1;min-height:0;overflow:hidden}

/* ── CHART AREA ── */
#tda_chart_area{flex:1;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;min-width:0;position:relative}
.tda-pane{position:relative;flex-shrink:0;border-bottom:2px solid var(--border2);background:var(--bg);cursor:crosshair;user-select:none}
.tda-pane:last-child{border-bottom:none}
.tda-pane-header{display:flex;align-items:center;gap:8px;padding:4px 10px;background:rgba(255,255,255,.02);border-bottom:1px solid var(--border);font-size:10px}
.tda-pane-label{font-weight:700;color:var(--text);flex:1}
.tda-pane-readout{font-family:var(--mono);font-size:10px;color:var(--teal);padding:2px 8px;background:rgba(0,212,170,.08);border-radius:4px}
.tda-pane-close{cursor:pointer;color:var(--r);opacity:.5;padding:0 4px;font-size:12px}
.tda-pane-close:hover{opacity:1}
.tda-pane canvas{display:block;width:100%}
.tda-drop-target{border:2px dashed rgba(232,121,249,.6)!important;background:rgba(232,121,249,.04)!important}
.tda-add-pane{display:flex;align-items:center;justify-content:center;height:48px;background:rgba(255,255,255,.01);border:2px dashed var(--border);border-radius:6px;margin:8px;cursor:pointer;color:var(--text3);font-size:12px;transition:all .15s}
.tda-add-pane:hover{border-color:#e879f9;color:#e879f9;background:rgba(232,121,249,.04)}

/* ── CHANNEL BROWSER ── */
#tda_browser{width:240px;min-width:200px;max-width:320px;background:#080d18;border-left:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;overflow:hidden}
#tda_browser_resize{width:4px;background:var(--border);cursor:col-resize;flex-shrink:0;transition:background .15s}
#tda_browser_resize:hover{background:#e879f9}
#tda_browser_header{padding:8px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
#tda_channel_list{flex:1;overflow-y:auto;padding:4px}
.tda-ch-group{margin-bottom:4px}
.tda-ch-group-hdr{padding:4px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);background:rgba(255,255,255,.02)}
.tda-ch-item{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:5px;cursor:grab;transition:background .1s;border:1px solid transparent}
.tda-ch-item:hover{background:rgba(255,255,255,.05);border-color:var(--border)}
.tda-ch-item.dragging{opacity:.4;cursor:grabbing}
.tda-ch-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.tda-ch-name{font-size:11px;color:var(--text2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tda-ch-unit{font-size:9px;color:var(--text3);flex-shrink:0}
.tda-ch-stat{font-size:9px;color:var(--text3);font-family:var(--mono)}

/* ── AI PANEL ── */
#tda_ai_panel{background:#080d18;border-top:1px solid var(--border);flex-shrink:0;max-height:220px;overflow-y:auto;display:${t.data?'flex':'none'};flex-direction:column}
#tda_ai_panel.collapsed{max-height:34px;overflow:hidden}
.tda-ai-content{padding:10px 14px;font-size:12px;color:var(--text2);line-height:1.75}
.tda-ai-content h4{color:#e879f9;font-size:12px;font-weight:700;margin:8px 0 3px}

/* ── UPLOAD STATE ── */
#tda_upload_overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg);z-index:10;flex-direction:column;gap:16px}

/* ── ZOOM BAR ── */
#tda_zoombar{height:28px;background:rgba(255,255,255,.02);border-top:1px solid var(--border);position:relative;cursor:default;flex-shrink:0}
#tda_zoom_track{position:absolute;top:4px;bottom:4px;left:50px;right:10px;background:rgba(255,255,255,.04);border-radius:3px}
#tda_zoom_window{position:absolute;top:0;bottom:0;background:rgba(232,121,249,.2);border:1px solid rgba(232,121,249,.5);border-radius:3px;cursor:ew-resize}
#tda_time_label{position:absolute;left:4px;top:50%;transform:translateY(-50%);font-size:9px;color:var(--text3)}

/* ── STATS BAR ── */
#tda_stats_bar{padding:4px 12px;background:rgba(255,255,255,.01);border-top:1px solid var(--border);flex-shrink:0;display:flex;gap:12px;overflow-x:auto;font-size:10px;font-family:var(--mono)}
.tda-stat-chip{display:flex;gap:5px;align-items:center;white-space:nowrap}
.tda-stat-k{color:var(--text3)}
.tda-stat-v{color:var(--teal);font-weight:700}
</style>

<div id="tda_app">
  <!-- TOP CATEGORY NAV -->
  <div id="tda_topbar">
    <div id="tda_top_cats">
      ${(typeof BT_CATS!=='undefined'?BT_CATS:[]).map(c=>`
        <button class="tda-catbtn ${c.id==='data_analysis'?'active':''}"
          style="${c.id==='data_analysis'?'border-color:#e879f950;background:#e879f915;color:#e879f9':''}"
          onclick="renderBatteryTesting('${c.id}')">
          <span style="font-size:12px">${c.icon}</span>${c.label}
        </button>`).join('')}
    </div>
  </div>

  <!-- PROJECT CONTEXT BAR (fully linked) -->
  <div id="tda_ctx_bar">
    <span style="font-size:9px;color:var(--text3);flex-shrink:0">PROJECT →</span>
    ${tdaCtxChips(S)}
    <button onclick="switchTopTab('engineering',document.getElementById('ttab-engineering'));showSec('targets',document.querySelector('.nb'))"
      style="margin-left:auto;padding:2px 9px;background:rgba(232,121,249,.1);border:1px solid rgba(232,121,249,.3);color:#e879f9;border-radius:4px;font-size:10px;font-weight:700;cursor:pointer;flex-shrink:0">✏ Edit</button>
  </div>

  <!-- TOOLBAR -->
  <div id="tda_toolbar">
    <button class="tda-tbtn" onclick="tdaOpenFile()" title="Upload test log">📂 Open File</button>
    <input type="file" id="tda_file" accept=".csv,.xlsx,.xls,.txt,.tsv" style="display:none" onchange="tdaHandleFile(this.files[0])">
    <div class="tda-tsep"></div>
    <button class="tda-tbtn ${!hasData?'':'active'}" onclick="tdaAddPane()" ${!hasData?'disabled':''} title="Add new chart pane">+ Add Pane</button>
    <button class="tda-tbtn" onclick="tdaResetZoom()" ${!hasData?'disabled':''} title="Reset zoom to full range">↕ Reset Zoom</button>
    <button class="tda-tbtn" onclick="tdaAutoLayout()" ${!hasData?'disabled':''} title="Auto-arrange channels">⊞ Auto Layout</button>
    <div class="tda-tsep"></div>
    <button class="tda-tbtn" onclick="tdaRunAI(false)" ${!hasData?'disabled':''} title="Run AI analysis">🤖 AI Analyse</button>
    <button class="tda-tbtn" onclick="tdaRunAI(true)" ${!hasData?'disabled':''} title="Deep AI analysis">🤖 Deep</button>
    <div class="tda-tsep"></div>
    <button class="tda-tbtn" onclick="tdaExport()" ${!hasData?'disabled':''} title="Export report">⬇ Export</button>
    ${hasData ? `
    <div class="tda-tsep"></div>
    <span style="font-size:10px;color:var(--text3)">📊 ${t.data.nRows.toLocaleString()} rows · ${t.data.headers.length} channels · ${t.data.fileName}</span>
    <button class="tda-tbtn" onclick="tdaClear()" style="margin-left:auto;color:var(--r)">✕ Clear</button>` : ''}
  </div>

  <!-- MAIN CONTENT -->
  <div id="tda_main">

    <!-- CHART AREA -->
    <div id="tda_chart_area" onmouseleave="tdaCursorLeave()">
      ${hasData ? tdaBuildPanes() : tdaUploadOverlay()}
    </div>

    <!-- BROWSER RESIZE HANDLE -->
    ${hasData ? '<div id="tda_browser_resize" onmousedown="tdaStartResize(event)"></div>' : ''}

    <!-- CHANNEL BROWSER -->
    ${hasData ? `
    <div id="tda_browser">
      <div id="tda_browser_header">
        <span style="font-size:11px;font-weight:700;color:var(--text)">Channel Browser</span>
        <span style="font-size:10px;color:var(--text3)">${t.data.headers.length} ch</span>
      </div>
      <div id="tda_channel_list">${tdaBuildChannelBrowser()}</div>
    </div>` : ''}
  </div>

  <!-- ZOOM BAR -->
  ${hasData ? `
  <div id="tda_zoombar">
    <span id="tda_time_label">Time</span>
    <div id="tda_zoom_track">
      <div id="tda_zoom_window"
        style="left:${t.zoomX.x0*100}%;width:${(t.zoomX.x1-t.zoomX.x0)*100}%"
        onmousedown="tdaZoomDrag(event)"></div>
    </div>
  </div>
  <div id="tda_stats_bar">${tdaBuildStatsBar()}</div>` : ''}

  <!-- AI RESULT PANEL -->
  <div id="tda_ai_panel" ${t.aiResult?'':'style="display:none"'}>
    <div style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid var(--border);cursor:pointer" onclick="this.parentElement.classList.toggle('collapsed')">
      <span style="font-size:12px;font-weight:700;color:#e879f9">🤖 AI Engineering Analysis</span>
      <span style="font-size:10px;color:var(--text3);margin-left:auto">Click to collapse ▲</span>
      <div style="display:flex;gap:6px">
        <input id="tda_ctx_input" onclick="event.stopPropagation()" placeholder="Test context (optional)…"
          style="padding:3px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:11px;width:300px">
      </div>
    </div>
    <div class="tda-ai-content" id="tda_ai_content">${t.aiResult||''}</div>
  </div>
</div>`;

  /* Draw charts after DOM ready */
  requestAnimationFrame(() => {
    if (hasData) {
      tdaDrawAllPanes();
      tdaInitInteractions();
    }
  });
};

/* ═════ PROJECT CONTEXT CHIPS ═════ */
function tdaCtxChips(S) {
  const g = id => { const el=document.getElementById(id); return el?el.value:null; };
  const chip = (k,v,col) => `<div class="tda-ctx-chip"><span class="tda-ctx-k">${k}</span><span class="tda-ctx-v" style="color:${col||'#e879f9'}">${v}</span></div>`;
  const chem   = g('c_chem') || S.c_chem || 'LFP';
  const Ss     = S.S_total || 112;
  const Pp     = S.c_pp || 1;
  const vnom   = S.V_nom_pack ? S.V_nom_pack.toFixed(0) : (Ss*(+(g('c_vnom')||3.2))).toFixed(0);
  const vmax   = S.V_max_pack ? S.V_max_pack.toFixed(0) : (Ss*(+(g('c_vmax')||3.65))).toFixed(0);
  const vmin   = S.V_min_pack ? S.V_min_pack.toFixed(0) : '—';
  const egross = S.E_gross   ? S.E_gross.toFixed(1) : '—';
  const euse   = S.E_usable  ? S.E_usable.toFixed(1) : '—';
  const ppeak  = g('t_ppeak') || S.t_ppeak || 80;
  const pcont  = g('t_pcont') || S.t_pcont || 50;
  const ipeak  = S.t_ppeak ? (S.t_ppeak*1000/(S.V_nom_pack||400)).toFixed(0) : '—';
  const tcell  = g('t_tcell_max') || S.t_tcell_max || 55;
  const top_lo = g('t_top_lo') || S.t_top_lo || -20;
  const top_hi = g('t_top_hi') || S.t_top_hi || 55;
  const vcmax  = g('c_vmax') || S.c_vmax || 3.65;
  const vcmin  = g('c_vmin') || S.c_vmin || 2.0;
  const ah     = g('c_ah')   || S.c_ah   || 120;
  const irbol  = g('c_ir_bol') || S.c_ir_bol || 0.22;
  const cycles = g('t_cycles') || S.t_cycles || 3000;
  const soh    = g('t_soh_eol') || S.t_soh_eol || 80;
  const dod    = g('t_dod') || S.t_dod || 1.0;
  const ip     = g('t_ip') || S.t_ip || 'IP67';
  const mkts   = (g('t_markets') || S.markets || 'EU').toUpperCase();
  const crates = g('t_cpeak') || S.t_cpeak || 2.0;

  return [
    chip('Chem',     chem,      '#e879f9'),
    chip('Config',   `${Ss}S/${Pp}P`, '#4a9eff'),
    chip('V_nom',    vnom+'V',  '#4a9eff'),
    chip('V_max',    vmax+'V',  '#4a9eff'),
    chip('V_min',    vmin+'V',  '#4a9eff'),
    chip('E_gross',  egross+'kWh','#00d4aa'),
    chip('E_use',    euse+'kWh','#00d4aa'),
    chip('DoD',      (+dod*100).toFixed(0)+'%','#00d4aa'),
    chip('P_peak',   ppeak+'kW','#ff7b35'),
    chip('P_cont',   pcont+'kW','#ff7b35'),
    chip('I_peak',   ipeak+'A', '#ff7b35'),
    chip('C_peak',   crates+'C','#ff7b35'),
    chip('Vc_max',   vcmax+'V', '#f5c518'),
    chip('Vc_min',   vcmin+'V', '#f5c518'),
    chip('Cap',      ah+'Ah',   '#f5c518'),
    chip('IR_BoL',   irbol+'mΩ','#a78bfa'),
    chip('T_cell',   tcell+'°C','#ff4d6d'),
    chip('T_op',     top_lo+'→'+top_hi+'°C','#ff4d6d'),
    chip('Cycles',   cycles,    '#60a5fa'),
    chip('SoH_EoL',  soh+'%',   '#60a5fa'),
    chip('IP',       ip,        '#94a3b8'),
    chip('Markets',  mkts,      '#94a3b8'),
  ].join('');
}

/* ═════ UPLOAD OVERLAY ═════ */
function tdaUploadOverlay() {
  return `<div id="tda_upload_overlay"
    ondragover="event.preventDefault();document.getElementById('tda_chart_area').style.background='rgba(232,121,249,.06)'"
    ondragleave="document.getElementById('tda_chart_area').style.background=''"
    ondrop="event.preventDefault();document.getElementById('tda_chart_area').style.background='';if(event.dataTransfer.files[0])tdaHandleFile(event.dataTransfer.files[0])"
    onclick="tdaOpenFile()">
    <div style="font-size:48px">📊</div>
    <div style="font-size:15px;font-weight:700;color:var(--text)">Drop test log here or click to open</div>
    <div style="font-size:12px;color:var(--text3);text-align:center;max-width:380px;line-height:1.7">
      CSV · Excel (.xlsx/.xls) · TSV · BMS log · Cycler export<br>
      Arbin · Bitrode · Maccor · AVL · CAN log · any columnar format
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px;max-width:480px">
      ${[['⚡','Voltage / Current','Pack + cell channels'],['🌡️','Temperature','Cell + coolant + ambient'],
         ['📈','SOC / Capacity','State + Ah throughput'],['⚠️','Anomaly Detection','Physics-based checks'],
         ['🔬','AI Interpretation','Engineering root cause'],['📉','Multi-Pane Charts','Synchronized cursors']
      ].map(([i,t,d])=>`<div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:20px;margin-bottom:4px">${i}</div>
        <div style="font-size:11px;font-weight:700;color:var(--text)">${t}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">${d}</div>
      </div>`).join('')}
    </div>
  </div>`;
}

/* ═════ CHANNEL COLORS ═════ */
const TDA_COLORS = ['#4a9eff','#00d4aa','#ff7b35','#f5c518','#ef4444','#a78bfa','#34d399','#fb923c','#38bdf8','#e879f9','#fbbf24','#60a5fa','#f472b6','#4ade80','#facc15'];
function tdaColColor(idx) { return TDA_COLORS[idx % TDA_COLORS.length]; }

/* ═════ INIT PANES FROM DETECTED COLUMNS ═════ */
function tdaInitPanes() {
  const t = window._tda;
  const cm = t.data.colMap;
  t.panes = [];
  t.zoomX = {x0:0, x1:1};
  t.cursor = null;

  // Pane 1: Pack voltage + cell V_max/min (if cell channels exist)
  const vSignals = [cm.v_pack, ...(cm.v_cells||[]).slice(0,3)].filter(v=>v!=null);
  if (vSignals.length) t.panes.push({id:'p_v', label:'Voltage', signals:vSignals, height:200});

  // Pane 2: Current
  if (cm.i_pack!=null) t.panes.push({id:'p_i', label:'Current', signals:[cm.i_pack], height:160});

  // Pane 3: Temperature
  const tSignals = [...(cm.t_cells||[]).slice(0,4), cm.temp_amb, cm.temp_cool_in, cm.temp_cool_out].filter(v=>v!=null);
  if (tSignals.length) t.panes.push({id:'p_t', label:'Temperature', signals:tSignals, height:180});

  // Pane 4: SOC
  if (cm.soc!=null) t.panes.push({id:'p_soc', label:'SOC (%)', signals:[cm.soc], height:140});
  else if (cm.p_pack!=null) t.panes.push({id:'p_p', label:'Power', signals:[cm.p_pack], height:140});

  // Fallback if nothing detected
  if (t.panes.length === 0 && t.data.headers.length > 1) {
    t.panes.push({id:'p0', label:t.data.headers[1]||'Signal', signals:[1], height:200});
  }
}

/* ═════ BUILD PANE HTML ═════ */
function tdaBuildPanes() {
  const t = window._tda;
  if (!t.data || !t.panes.length) return '<div class="tda-add-pane" onclick="tdaAddPane()">+ Add Chart Pane (drag channels from browser)</div>';
  return t.panes.map((p,pi) => `
    <div class="tda-pane" id="pane_${p.id}" style="height:${p.height||200}px"
      ondragover="event.preventDefault();document.getElementById('pane_${p.id}').classList.add('tda-drop-target')"
      ondragleave="document.getElementById('pane_${p.id}').classList.remove('tda-drop-target')"
      ondrop="event.preventDefault();document.getElementById('pane_${p.id}').classList.remove('tda-drop-target');tdaDropOnPane('${p.id}',event)">
      <div class="tda-pane-header">
        <span class="tda-pane-label">${p.label}</span>
        <span class="tda-pane-readout" id="readout_${p.id}">—</span>
        <button class="tda-tbtn" onclick="tdaResizePane('${p.id}',-40)" style="padding:1px 6px;font-size:10px">−</button>
        <button class="tda-tbtn" onclick="tdaResizePane('${p.id}',40)"  style="padding:1px 6px;font-size:10px">+</button>
        <span class="tda-pane-close" onclick="tdaRemovePane('${p.id}')" title="Remove pane">✕</span>
      </div>
      <canvas id="canvas_${p.id}" height="${(p.height||200)-28}" style="width:100%;display:block;cursor:crosshair"
        onmousemove="tdaCursorMove(event,'${p.id}')"
        onmousedown="tdaPanStart(event,'${p.id}')"
        onwheel="tdaWheelZoom(event,'${p.id}')"></canvas>
    </div>`).join('') +
  `<div class="tda-add-pane" onclick="tdaAddPane()">+ Add Pane — drag any channel from browser</div>`;
}

/* ═════ CHANNEL BROWSER ═════ */
function tdaBuildChannelBrowser() {
  const t = window._tda;
  if (!t.data) return '';
  const cm = t.data.colMap;
  const rows = t.data.rows;

  // Group channels
  const groups = {
    'Voltage':[],  'Current':[], 'Temperature':[], 'SOC/SOH':[],
    'Power':[],    'Other':[]
  };
  t.data.headers.forEach((h,ci) => {
    if (ci === cm.t) return; // skip time axis
    const hl = h.toLowerCase();
    const vals = rows.slice(0,100).map(r=>+r[ci]).filter(v=>!isNaN(v));
    const mn = vals.length?Math.min(...vals):0;
    const mx = vals.length?Math.max(...vals):0;
    const ch = {ci, name:h, min:mn, max:mx};
    if (/volt|vcell|vpack|v_|oc_v/.test(hl)) groups['Voltage'].push(ch);
    else if (/curr|amp|i_|ipack/.test(hl)) groups['Current'].push(ch);
    else if (/temp|deg|celsius|therm|cool|ambient/.test(hl)) groups['Temperature'].push(ch);
    else if (/soc|soh|state/.test(hl)) groups['SOC/SOH'].push(ch);
    else if (/power|watt|kw/.test(hl)) groups['Power'].push(ch);
    else groups['Other'].push(ch);
  });

  return Object.entries(groups).filter(([,v])=>v.length).map(([grp,chs])=>`
    <div class="tda-ch-group">
      <div class="tda-ch-group-hdr">${grp} (${chs.length})</div>
      ${chs.map(ch=>`
        <div class="tda-ch-item" id="ch_${ch.ci}" draggable="true"
          ondragstart="tdaChDragStart(event,${ch.ci})"
          ondragend="tdaChDragEnd(event,${ch.ci})"
          ondblclick="tdaAddSignalToFirstPane(${ch.ci})"
          title="Drag to pane · Double-click to add">
          <div class="tda-ch-dot" style="background:${tdaColColor(ch.ci)}"></div>
          <div>
            <div class="tda-ch-name" title="${ch.name}">${ch.name}</div>
            <div class="tda-ch-stat">${ch.min.toFixed(2)} → ${ch.max.toFixed(2)}</div>
          </div>
        </div>`).join('')}
    </div>`).join('');
}

/* ═════ STATS BAR ═════ */
function tdaBuildStatsBar() {
  const t = window._tda;
  if (!t.data) return '';
  const cm = t.data.colMap;
  const rows = t.data.rows;
  const col = ci => ci!=null ? rows.map(r=>+r[ci]).filter(v=>!isNaN(v)) : [];

  const chips = [];
  // Duration
  if (cm.t!=null) {
    const ts=col(cm.t); const dur=ts[ts.length-1]-ts[0];
    chips.push(['Duration', dur>3600?(dur/3600).toFixed(2)+'h':(dur/60).toFixed(0)+'min']);
  }
  // Pack V
  if (cm.v_pack!=null) {const vp=col(cm.v_pack);chips.push(['V_pack',`${Math.min(...vp).toFixed(1)}–${Math.max(...vp).toFixed(1)} V`]);}
  // Cell spread
  if (cm.v_cells?.length>1) {
    const spreads=rows.map((_,ri)=>{const vals=cm.v_cells.map(ci=>+rows[ri][ci]).filter(v=>!isNaN(v)&&v>0);return vals.length>1?Math.max(...vals)-Math.min(...vals):0;}).filter(v=>v>0);
    chips.push(['ΔV_cell', (Math.max(...spreads)*1000).toFixed(0)+' mV']);
  }
  // T_max
  if (cm.t_cells?.length>0) {const ta=cm.t_cells.flatMap(ci=>col(ci));chips.push(['T_max',Math.max(...ta).toFixed(1)+'°C']);}
  // SOC
  if (cm.soc!=null) {const s=col(cm.soc);chips.push(['SOC',`${Math.min(...s).toFixed(0)}–${Math.max(...s).toFixed(0)} %`]);}
  // Ah
  if (cm.i_pack!=null&&cm.t!=null) {
    const ts=col(cm.t),ip=col(cm.i_pack);let ah=0;
    for(let i=1;i<Math.min(ts.length,ip.length);i++) ah+=Math.abs(ip[i])*(ts[i]-ts[i-1])/3600;
    chips.push(['Ah_thru', ah.toFixed(1)+' Ah']);
  }
  chips.push(['Channels', t.data.headers.length]);
  chips.push(['Rows', t.data.nRows.toLocaleString()]);

  return chips.map(([k,v])=>`<div class="tda-stat-chip"><span class="tda-stat-k">${k}</span><span class="tda-stat-v">${v}</span></div>`).join('');
}

/* ═════ CHART DRAWING ═════ */
function tdaDrawAllPanes() {
  const t = window._tda;
  if (!t.data) return;
  t.panes.forEach(p => tdaDrawPane(p));
}

function tdaDrawPane(p) {
  const t   = window._tda;
  const cv  = document.getElementById('canvas_'+p.id);
  if (!cv) return;
  const W   = cv.parentElement?.offsetWidth || 700;
  const H   = cv.offsetHeight || 172;
  cv.width  = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const pad = {l:52, r:12, t:8, b:24};
  const pw  = W - pad.l - pad.r;
  const ph  = H - pad.t - pad.b;
  const rows = t.data.rows;
  const cm   = t.data.colMap;
  const N    = rows.length;
  const {x0,x1} = t.zoomX;

  // Time axis from zoom window
  const i0 = Math.floor(x0*N), i1 = Math.ceil(x1*N);
  const slice = rows.slice(i0,i1);
  if (!slice.length) return;

  // Y range from all signals in this pane
  let ymin=Infinity, ymax=-Infinity;
  p.signals.forEach(ci=>{
    slice.forEach(r=>{const v=+r[ci];if(!isNaN(v)){if(v<ymin)ymin=v;if(v>ymax)ymax=v;}});
  });
  if (!isFinite(ymin)||ymin===ymax){ymin=(ymin||0)-1;ymax=(ymax||1)+1;}
  const ypad=(ymax-ymin)*0.08;
  ymin-=ypad; ymax+=ypad;

  const mx = fi => pad.l + (fi/(slice.length-1||1))*pw;
  const my = v  => pad.t + ph*(1-(v-ymin)/(ymax-ymin));

  // Background
  ctx.fillStyle='#07080b'; ctx.fillRect(0,0,W,H);

  // Grid
  const ySteps=4, xSteps=5;
  ctx.strokeStyle='rgba(255,255,255,.04)'; ctx.lineWidth=1;
  for(let i=0;i<=ySteps;i++){
    const y=pad.t+ph*i/ySteps;
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
    const val=(ymax-(ymax-ymin)*i/ySteps);
    ctx.fillStyle='#3a567a';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='right';
    ctx.fillText(val.toFixed(Math.abs(val)<10?2:1),pad.l-3,y+3);
  }
  for(let i=0;i<=xSteps;i++){
    const x=pad.l+pw*i/xSteps;
    ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();
    // Time label
    const ri=Math.floor(i/xSteps*(slice.length-1));
    if(cm.t!=null){
      const tv=+slice[ri]?.[cm.t]||0;
      const lbl=tv>3600?(tv/3600).toFixed(2)+'h':tv>60?(tv/60).toFixed(1)+'m':tv.toFixed(0)+'s';
      ctx.fillStyle='#3a567a';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='center';
      ctx.fillText(lbl,x,H-pad.b+12);
    }
  }

  // Signal spec limits (threshold lines from project)
  const specLines = tdaGetSpecLines(p, ymin, ymax);
  specLines.forEach(sl=>{
    if(sl.v<ymin||sl.v>ymax) return;
    ctx.strokeStyle=sl.col; ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
    ctx.beginPath();ctx.moveTo(pad.l,my(sl.v));ctx.lineTo(W-pad.r,my(sl.v));ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=sl.col;ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='right';
    ctx.fillText(sl.label,W-pad.r-2,my(sl.v)-3);
  });

  // Draw signals
  const step = Math.max(1,Math.floor(slice.length/Math.min(pw,2000)));
  p.signals.forEach((ci,si)=>{
    ctx.beginPath();
    ctx.strokeStyle=tdaColColor(ci);
    ctx.lineWidth=1.8;
    let first=true;
    for(let i=0;i<slice.length;i+=step){
      const v=+slice[i][ci];
      if(isNaN(v)){first=true;continue;}
      const x=mx(i),y=my(v);
      first?ctx.moveTo(x,y):ctx.lineTo(x,y);
      first=false;
    }
    ctx.stroke();
    // Legend
    ctx.fillStyle=tdaColColor(ci);
    ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='left';
    ctx.fillText(t.data.headers[ci]||'ch'+ci, pad.l+4+si*120, pad.t+14);
  });

  // Cursor
  if(t.cursor!=null){
    const cx=pad.l+t.cursor*pw;
    ctx.strokeStyle='rgba(232,121,249,.7)';ctx.lineWidth=1;ctx.setLineDash([3,3]);
    ctx.beginPath();ctx.moveTo(cx,pad.t);ctx.lineTo(cx,H-pad.b);ctx.stroke();
    ctx.setLineDash([]);

    // Readout at cursor
    const ci_t=Math.floor(t.cursor*(slice.length-1));
    const readouts=p.signals.map(ci=>{
      const v=+slice[ci_t]?.[ci];
      return isNaN(v)?null:`${t.data.headers[ci]}=${v.toFixed(3)}`;
    }).filter(Boolean);
    const rdEl=document.getElementById('readout_'+p.id);
    if(rdEl&&readouts.length){
      const tval=cm.t!=null?(+slice[ci_t]?.[cm.t]||0):ci_t;
      const tlbl=tval>3600?(tval/3600).toFixed(3)+'h':tval>60?(tval/60).toFixed(2)+'m':tval.toFixed(1)+'s';
      rdEl.textContent=`t=${tlbl}  ${readouts.join('  ')}`;
    }
  }
}

/* ═════ SPEC LINES FROM PROJECT ═════ */
function tdaGetSpecLines(p, ymin, ymax) {
  const S = window.S||{};
  const lines=[];
  const lb=p.label.toLowerCase();
  if(lb.includes('volt')||lb.includes('v_pack')){
    if(S.V_max_pack) lines.push({v:S.V_max_pack,col:'rgba(255,77,109,.5)',label:'V_max '+S.V_max_pack.toFixed(0)+'V'});
    if(S.V_min_pack) lines.push({v:S.V_min_pack,col:'rgba(245,197,24,.5)',label:'V_min '+S.V_min_pack.toFixed(0)+'V'});
    if(S.V_nom_pack) lines.push({v:S.V_nom_pack,col:'rgba(74,158,255,.3)',label:'V_nom '+S.V_nom_pack.toFixed(0)+'V'});
  }
  if(lb.includes('temp')||lb.includes('°c')||lb.includes('t_')){
    if(S.t_tcell_max) lines.push({v:S.t_tcell_max,col:'rgba(255,77,109,.5)',label:'T_limit '+S.t_tcell_max+'°C'});
    if(S.t_tcell_max) lines.push({v:S.t_tcell_max-10,col:'rgba(245,197,24,.4)',label:'T_derate '+(S.t_tcell_max-10)+'°C'});
  }
  if(lb.includes('soc')){
    lines.push({v:100,col:'rgba(74,158,255,.3)',label:'100%'});
    lines.push({v:0,  col:'rgba(255,77,109,.3)',label:'0%'});
    if(S.t_dod) lines.push({v:(1-S.t_dod)*100,col:'rgba(245,197,24,.4)',label:'SoC floor '+(((1-S.t_dod)*100).toFixed(0))+'%'});
  }
  if(lb.includes('curr')){
    if(S.t_ppeak) lines.push({v:S.t_ppeak*1000/(S.V_nom_pack||400),col:'rgba(255,123,53,.4)',label:'I_peak'});
    lines.push({v:0,col:'rgba(255,255,255,.15)',label:'0A'});
  }
  return lines.filter(l=>l.v>=ymin&&l.v<=ymax);
}

/* ═════ INTERACTIONS ═════ */
function tdaInitInteractions() {
  // Nothing extra needed — event handlers are inline
}

window.tdaCursorMove = function(e, paneId) {
  const cv = document.getElementById('canvas_'+paneId);
  if (!cv) return;
  const pad={l:52,r:12};
  const rect=cv.getBoundingClientRect();
  const x=e.clientX-rect.left-pad.l;
  const pw=rect.width-pad.l-pad.r;
  const frac=Math.max(0,Math.min(1,x/pw));
  window._tda.cursor = frac;
  // Redraw all panes to show synced cursor
  window._tda.panes.forEach(p=>tdaDrawPane(p));
};

window.tdaCursorLeave = function() {
  window._tda.cursor = null;
  window._tda.panes.forEach(p=>{
    tdaDrawPane(p);
    const rdEl=document.getElementById('readout_'+p.id);
    if(rdEl) rdEl.textContent='—';
  });
};

let _panState=null;
window.tdaPanStart = function(e, paneId) {
  if(e.button!==0) return;
  const cv=document.getElementById('canvas_'+paneId);
  const rect=cv.getBoundingClientRect();
  _panState={startX:e.clientX, startZoom:{...window._tda.zoomX}, paneId, width:rect.width};
  const mm=(e2)=>{
    if(!_panState) return;
    const dx=(e2.clientX-_panState.startX)/_panState.width;
    const span=_panState.startZoom.x1-_panState.startZoom.x0;
    let x0=_panState.startZoom.x0-dx, x1=_panState.startZoom.x1-dx;
    if(x0<0){x1-=x0;x0=0;} if(x1>1){x0-=x1-1;x1=1;}
    window._tda.zoomX={x0,x1};
    tdaUpdateZoomBar(); tdaDrawAllPanes();
  };
  const mu=()=>{_panState=null;document.removeEventListener('mousemove',mm);document.removeEventListener('mouseup',mu);};
  document.addEventListener('mousemove',mm);
  document.addEventListener('mouseup',mu);
};

window.tdaWheelZoom = function(e, paneId) {
  e.preventDefault();
  const cv=document.getElementById('canvas_'+paneId);
  const rect=cv.getBoundingClientRect();
  const frac=(e.clientX-rect.left-52)/(rect.width-64);
  const t=window._tda;
  const span=t.zoomX.x1-t.zoomX.x0;
  const factor=e.deltaY>0?1.2:0.83;
  const newSpan=Math.max(0.01,Math.min(1,span*factor));
  const centre=t.zoomX.x0+frac*span;
  let x0=centre-frac*newSpan, x1=centre+(1-frac)*newSpan;
  if(x0<0){x1-=x0;x0=0;} if(x1>1){x0-=x1-1;x1=1;}
  t.zoomX={x0,x1};
  tdaUpdateZoomBar(); tdaDrawAllPanes();
};

function tdaUpdateZoomBar() {
  const zw=document.getElementById('tda_zoom_window');
  if(!zw) return;
  const {x0,x1}=window._tda.zoomX;
  zw.style.left=x0*100+'%';
  zw.style.width=(x1-x0)*100+'%';
}

window.tdaZoomDrag = function(e) {
  const t=window._tda;
  const track=document.getElementById('tda_zoom_track');
  if(!track) return;
  const rect=track.getBoundingClientRect();
  const span=t.zoomX.x1-t.zoomX.x0;
  const startX=e.clientX, startX0=t.zoomX.x0;
  const mm=e2=>{
    const dx=(e2.clientX-startX)/rect.width;
    let x0=startX0+dx, x1=x0+span;
    if(x0<0){x0=0;x1=span;} if(x1>1){x1=1;x0=1-span;}
    t.zoomX={x0,x1};
    tdaUpdateZoomBar(); tdaDrawAllPanes();
  };
  const mu=()=>{document.removeEventListener('mousemove',mm);document.removeEventListener('mouseup',mu);};
  document.addEventListener('mousemove',mm);
  document.addEventListener('mouseup',mu);
};

window.tdaStartResize = function(e) {
  const startX=e.clientX;
  const browser=document.getElementById('tda_browser');
  const startW=browser?browser.offsetWidth:240;
  const mm=e2=>{const w=Math.max(160,Math.min(420,startW-(e2.clientX-startX)));if(browser)browser.style.width=w+'px';};
  const mu=()=>{document.removeEventListener('mousemove',mm);document.removeEventListener('mouseup',mu);};
  document.addEventListener('mousemove',mm);
  document.addEventListener('mouseup',mu);
};

/* ═════ PANE MANAGEMENT ═════ */
window.tdaAddPane = function() {
  const t=window._tda;
  const id='p_'+Date.now();
  t.panes.push({id, label:'New Pane', signals:[], height:180});
  renderDataAnalysis();
};

window.tdaRemovePane = function(paneId) {
  window._tda.panes = window._tda.panes.filter(p=>p.id!==paneId);
  renderDataAnalysis();
};

window.tdaResizePane = function(paneId, delta) {
  const p=window._tda.panes.find(p=>p.id===paneId);
  if(p) p.height=Math.max(100,Math.min(600,(p.height||200)+delta));
  const cv=document.getElementById('canvas_'+paneId);
  const paneEl=document.getElementById('pane_'+paneId);
  if(cv&&paneEl){paneEl.style.height=p.height+'px';cv.height=p.height-28;tdaDrawPane(p);}
};

window.tdaAutoLayout = function() {
  const t=window._tda;
  if(!t.data) return;
  tdaInitPanes();
  renderDataAnalysis();
};

window.tdaResetZoom = function() {
  window._tda.zoomX={x0:0,x1:1};
  tdaUpdateZoomBar(); tdaDrawAllPanes();
};

/* ═════ DRAG AND DROP ═════ */
window.tdaChDragStart = function(e, ci) {
  e.dataTransfer.setData('tda_ci', ci);
  document.getElementById('ch_'+ci)?.classList.add('dragging');
};
window.tdaChDragEnd = function(e, ci) {
  document.getElementById('ch_'+ci)?.classList.remove('dragging');
};
window.tdaDropOnPane = function(paneId, e) {
  const ci=parseInt(e.dataTransfer.getData('tda_ci'));
  const p=window._tda.panes.find(p=>p.id===paneId);
  if(p&&!isNaN(ci)&&!p.signals.includes(ci)){
    p.signals.push(ci);
    p.label=window._tda.data.headers[p.signals[0]]||p.label;
    renderDataAnalysis();
  }
};
window.tdaAddSignalToFirstPane = function(ci) {
  const t=window._tda;
  if(!t.panes.length) { tdaAddPane(); return; }
  const p=t.panes[0];
  if(!p.signals.includes(ci)) p.signals.push(ci);
  renderDataAnalysis();
};

/* ═════ FILE HANDLING ═════ */
window.tdaOpenFile = function() { document.getElementById('tda_file')?.click(); };

window.tdaHandleFile = function(file) {
  if (!file) return;
  const ext=file.name.split('.').pop().toLowerCase();
  const showProg=msg=>{ const el=document.getElementById('tda_upload_overlay'); if(el) el.innerHTML=`<div style="font-size:24px">⏳</div><div style="color:var(--text2);font-size:13px">${msg}</div>`; };
  showProg('Reading '+file.name+'…');
  const run=()=>{
    if(ext==='csv'||ext==='txt'||ext==='tsv'){
      const r=new FileReader();
      r.onload=e=>tdaParseText(e.target.result,file.name);
      r.readAsText(file);
    } else {
      const r=new FileReader();
      r.onload=e=>{
        try{
          const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
          let best=null,bestN=0;
          wb.SheetNames.forEach(name=>{const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:''});const n=rows.flat().filter(v=>!isNaN(parseFloat(v))&&v!=='').length;if(n>bestN){bestN=n;best={name,rows};}});
          if(!best){showProg('⚠ No numeric data found');return;}
          tdaParseText(best.rows.map(r=>r.join('\t')).join('\n'),file.name+'['+best.name+']','\t');
        } catch(err){showProg('⚠ Error: '+err.message);}
      };
      r.readAsArrayBuffer(file);
    }
  };
  if((ext==='xlsx'||ext==='xls')&&typeof XLSX==='undefined'){
    const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=run;document.head.appendChild(s);
  } else run();
};

function tdaParseText(text, fileName, forceDelim) {
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  const delim=forceDelim||(lines[0].includes('\t')?'\t':lines[0].includes(';')?';':',');
  const hasHdr=isNaN(parseFloat(lines[0].split(delim)[0].trim()));
  const hdr=hasHdr?lines[0].split(delim).map(h=>h.trim()):lines[0].split(delim).map((_,i)=>'Col'+i);
  const rows=[];
  const start=hasHdr?1:0;
  for(let i=start;i<Math.min(lines.length,start+100000);i++){
    const l=lines[i].trim();
    if(!l||l.startsWith('#')) continue;
    rows.push(lines[i].split(delim).map(v=>{const n=parseFloat(v);return isNaN(n)?v:n;}));
  }
  if(rows.length<2){renderDataAnalysis();return;}
  const colMap=tdaDetectCols(hdr);
  window._tda.data={headers:hdr,rows,fileName,nRows:rows.length,colMap};
  window._tda.panes=[];
  window._tda.zoomX={x0:0,x1:1};
  window._tda.cursor=null;
  window._tda.aiResult=null;
  tdaInitPanes();
  renderDataAnalysis();
}

function tdaDetectCols(hdr) {
  const hl=hdr.map(h=>h.toLowerCase().replace(/[^a-z0-9_]/g,''));
  const f=(...keys)=>{for(const k of keys){const i=hl.findIndex(h=>h.includes(k));if(i>=0)return i;}return null;};
  const fAll=(...keys)=>hl.reduce((a,h,i)=>{if(keys.some(k=>h.includes(k)))a.push(i);return a;},[]);
  return {
    t:       f('time','timestamp','elapsed','t_s','tsec','sec'),
    v_pack:  f('vpack','packvolt','v_bat','vbat','pack_v','volt','voltage'),
    i_pack:  f('ipack','current_pack','i_bat','ibat','current','amp'),
    p_pack:  f('power_pack','p_pack','power','watt','kw'),
    soc:     f('soc','stateofcharge','soc_pct'),
    soh:     f('soh','stateofhealth'),
    temp_amb:f('tamb','ambient','t_ambient'),
    temp_cool_in:  f('tcool_in','coolant_in','t_in','inlet_temp'),
    temp_cool_out: f('tcool_out','coolant_out','t_out','outlet_temp'),
    flow:    f('flow','flowrate'),
    v_cells: fAll('vcell','cell_v','v_cell','cv'),
    t_cells: fAll('tcell','cell_t','t_cell','ct','temp_cell'),
    fault:   f('fault','error','alarm'),
  };
}

/* ═════ AI ANALYSIS ═════ */
window.tdaRunAI = async function(deep=false) {
  const t=window._tda;
  if(!t.data){alert('Upload a data file first.');return;}
  const S=window.S||{};
  const userCtx=document.getElementById('tda_ctx_input')?.value||'';

  // Show AI panel + loading
  const aiPanel=document.getElementById('tda_ai_panel');
  const aiContent=document.getElementById('tda_ai_content');
  if(aiPanel) aiPanel.style.display='flex';
  if(aiContent) aiContent.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)"><span style="font-size:20px">⚙️</span> Analysing…</div>';

  const cm=t.data.colMap;
  const rows=t.data.rows;
  const col=ci=>ci!=null?rows.map(r=>+r[ci]).filter(v=>!isNaN(v)):[];
  const stat=arr=>{if(!arr.length)return null;const mn=Math.min(...arr),mx=Math.max(...arr),mean=arr.reduce((a,b)=>a+b)/arr.length;return{min:mn.toFixed(3),max:mx.toFixed(3),mean:mean.toFixed(3)};};
  const g=id=>{const el=document.getElementById(id);return el?el.value:null;};

  const summary={
    file:t.data.fileName, rows:t.data.nRows, channels:t.data.headers.join(', '),
    pack_voltage:stat(col(cm.v_pack)), pack_current:stat(col(cm.i_pack)),
    soc:stat(col(cm.soc)), cell_v_channels:cm.v_cells?.length||0,
    cell_t_channels:cm.t_cells?.length||0,
  };

  const prompt=`You are a senior EV battery data analysis engineer. Analyse this battery test log professionally.

## Project Targets (from BatteryMIS):
Chemistry=${g('c_chem')||S.c_chem||'LFP'}, Config=${S.S_total||112}S/${S.c_pp||1}P
V_nom=${S.V_nom_pack?.toFixed(0)||358}V, V_max=${S.V_max_pack?.toFixed(0)||420}V, V_cell_max=${S.c_vmax||3.65}V
Cap=${S.c_ah||120}Ah, IR_BoL=${S.c_ir_bol||0.22}mΩ, T_cell_max=${S.t_tcell_max||55}°C
P_peak=${S.t_ppeak||80}kW, Cycles=${S.t_cycles||3000}, SoH_EoL=${S.t_soh_eol||80}%
${userCtx?'Test context: '+userCtx:''}

## Test Data:
${JSON.stringify(summary,null,2)}

${deep?`Provide: 1)Executive Summary 2)Top 5 Anomalies with root cause 3)Cell Balance Assessment 4)Thermal Performance 5)Capacity/Energy 6)BMS Assessment 7)Risk Rating(Low/Med/High/Critical) 8)Next Test Recommendations 9)DVP Items satisfied. Use <h4> for headings, <ul><li> for lists.`
:`Provide: 1)3-sentence Executive Summary 2)Top 3 Engineering Findings with values 3)3 Recommended Actions 4)Data Quality note. Be specific with numbers. Use <h4> for headings.`}`;

  try{
    const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1500,messages:[{role:'user',content:prompt}]})});
    const data=await resp.json();
    const txt=data.content?.map(b=>b.text||'').join('')||'No response';
    const fmtd=txt.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^- (.+)/gm,'<li>$1</li>').replace(/(<li>[\s\S]+?<\/li>)+/g,m=>'<ul>'+m+'</ul>');
    window._tda.aiResult=fmtd;
    if(aiContent) aiContent.innerHTML=fmtd+`<div style="font-size:10px;color:var(--text3);margin-top:8px;text-align:right">🤖 ${deep?'Deep':'Standard'} · Claude Sonnet · ${new Date().toLocaleTimeString()}</div>`;
  } catch(err){
    if(aiContent) aiContent.innerHTML=`<span style="color:var(--r)">⚠ API Error: ${err.message}</span>`;
  }
};

/* ═════ UTILS ═════ */
window.tdaClear=function(){window._tda={data:null,panes:[],cursor:null,zoomX:{x0:0,x1:1},aiResult:null};renderDataAnalysis();};
window.tdaExport=function(){
  const t=window._tda;
  if(!t.data) return;
  const S=window.S||{};
  const lines=['BatteryMIS Test Data Analysis Report',`File: ${t.data.fileName}`,`Date: ${new Date().toISOString().slice(0,16)}`,`Project: ${S.proj||''} · ${S.c_chem||''} ${S.S_total||''}S/${S.c_pp||''}P`,'','AI Analysis:',t.aiResult?.replace(/<[^>]+>/g,'')||'(not run)'];
  const a=document.createElement('a');
  a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(lines.join('\n'));
  a.download=`TDA_${t.data.fileName.replace(/\.\w+$/,'')}_${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
};
