/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — TEST DATA ANALYSIS  v3.0
   AVL Concerto-style analyser:
   • Multi-sheet Excel support (sheet browser tab bar)
   • Adjustable panes: drag resize height, drag resize width via browser
   • Drag any channel to X or Y axis of any pane
   • Per-pane stats bar (min/max/avg/rms/count)
   • Single flexible XY graph + multi-pane time-series
   • Synchronized cursor across all panes
   • Scroll-wheel zoom, mouse drag pan
   • AI analysis vs project targets
   ═══════════════════════════════════════════════════════════════ */

(function patchBTCats() {
  const add=()=>{ if(typeof BT_CATS!=='undefined'&&!BT_CATS.find(c=>c.id==='data_analysis')) BT_CATS.push({id:'data_analysis',icon:'🔬',label:'Test Data Analysis',color:'#e879f9'}); };
  add();
  const _orig=window.renderBatteryTesting;
  window.renderBatteryTesting=function(catId){ add(); if(catId==='data_analysis') renderDataAnalysis(); else if(typeof _orig==='function') _orig(catId); };
})();

/* ═══ STATE ═══ */
window._tda={
  sheets:[],          // [{name, headers, rows, colMap}]
  activeSheet:0,      // index into sheets
  panes:[],           // [{id,label,signals:[{ci,axis:'y'}],xAxis:null,height,type:'time'|'xy',stats:{}}]
  cursor:null,        // 0–1 normalised cursor position
  zoomX:{x0:0,x1:1}, // global time zoom
  aiResult:null,
  dragSig:null,       // {ci} currently dragging
  browserWidth:220,
};

function tda(){ return window._tda; }
function tdaSheet(){ return tda().sheets[tda().activeSheet]||null; }

/* ═══ MAIN RENDER ═══ */
window.renderDataAnalysis=function(){
  const root=document.getElementById('bt_root');
  if(!root) return;
  const t=tda(), S=window.S||{}, d=tdaSheet();
  const hasData=d&&d.rows?.length>0;
  if(hasData&&t.panes.length===0) tdaInitPanes();

  root.innerHTML=`
<style>
/* ─ Layout ─ */
#tda_app{display:flex;flex-direction:column;height:calc(100vh - 120px);min-height:500px;background:#07080b;font-family:'JetBrains Mono',monospace;font-size:11px;overflow:hidden}
/* ─ Topbar ─ */
#tda_topbar{background:#080d18;border-bottom:1px solid #182840;flex-shrink:0;display:flex;flex-direction:column}
#tda_catnav{display:flex;gap:2px;padding:5px 10px;overflow-x:auto;flex-shrink:0}
.tda-cb{display:flex;align-items:center;gap:4px;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:var(--sans);border:1px solid transparent;background:transparent;color:var(--text2);transition:all .12s}
.tda-cb:hover{background:rgba(255,255,255,.04);color:var(--text)}
.tda-cb.active{border-color:#e879f950;background:#e879f915;color:#e879f9}
/* ─ Context bar ─ */
#tda_ctx{display:flex;flex-wrap:wrap;gap:4px;padding:5px 12px;background:rgba(255,255,255,.02);border-bottom:1px solid #182840;align-items:center}
.ctx-chip{display:flex;gap:3px;align-items:center;background:rgba(255,255,255,.04);border:1px solid #182840;border-radius:3px;padding:2px 6px;cursor:default}
.ctx-k{font-size:8px;color:#3a567a;text-transform:uppercase}
.ctx-v{font-size:10px;font-weight:700}
/* ─ Sheet tabs ─ */
#tda_sheet_tabs{display:flex;gap:2px;padding:3px 10px;background:#050a14;border-bottom:1px solid #182840;overflow-x:auto;flex-shrink:0}
.tda-stab{padding:3px 12px;border-radius:4px 4px 0 0;font-size:10px;cursor:pointer;border:1px solid transparent;border-bottom:none;color:var(--text3);background:transparent;transition:all .12s;white-space:nowrap}
.tda-stab:hover{color:var(--text2);background:rgba(255,255,255,.03)}
.tda-stab.active{color:#e879f9;background:#e879f918;border-color:#e879f940}
/* ─ Toolbar ─ */
#tda_toolbar{display:flex;align-items:center;gap:5px;padding:5px 10px;background:#080d18;border-bottom:1px solid #182840;flex-shrink:0;flex-wrap:wrap}
.tb{padding:3px 9px;background:#0d1626;border:1px solid #182840;border-radius:4px;font-size:10px;color:var(--text2);cursor:pointer;font-family:var(--mono);transition:all .12s;white-space:nowrap}
.tb:hover{background:#152035;color:var(--text);border-color:#2a3f5e}
.tb:disabled{opacity:.35;cursor:not-allowed}
.tb.hi{background:#1a0d2b;border-color:#e879f940;color:#e879f9}
.tsep{width:1px;height:18px;background:#182840;flex-shrink:0}
/* ─ Main layout ─ */
#tda_main{display:flex;flex:1;min-height:0;overflow:hidden}
/* ─ Chart area ─ */
#tda_charts{flex:1;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;min-width:0;position:relative;background:#07080b}
/* ─ Pane ─ */
.tda-pane{position:relative;flex-shrink:0;border-bottom:2px solid #182840;background:#07080b;overflow:hidden}
.tda-pane:last-child{border-bottom:none}
.tda-ph{display:flex;align-items:center;gap:6px;padding:3px 8px;background:rgba(255,255,255,.02);border-bottom:1px solid #182840;height:26px;flex-shrink:0}
.tda-ph-title{font-weight:700;color:var(--text);font-size:11px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tda-readout{font-size:10px;color:#00d4aa;padding:1px 6px;background:rgba(0,212,170,.08);border-radius:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px}
.tda-ph-btn{cursor:pointer;color:var(--text3);padding:0 3px;font-size:11px;background:none;border:none;transition:color .1s}
.tda-ph-btn:hover{color:var(--text)}
.tda-pane canvas{display:block;cursor:crosshair}
/* ─ Pane stats bar ─ */
.tda-pstats{display:flex;gap:8px;padding:2px 8px;background:rgba(255,255,255,.01);border-top:1px solid #182840;overflow-x:auto;font-size:9px;white-space:nowrap;height:18px;align-items:center}
.tda-stat{display:flex;gap:3px;align-items:center}
.tda-stat-k{color:#3a567a}
.tda-stat-v{font-weight:700}
/* ─ Resize handle ─ */
.pane-resize-h{height:4px;background:transparent;cursor:ns-resize;position:absolute;bottom:0;left:0;right:0;z-index:10;transition:background .15s}
.pane-resize-h:hover,.pane-resize-h.active{background:#e879f960}
/* ─ Drop zones ─ */
.drop-xaxis{position:absolute;bottom:22px;left:52px;right:12px;height:20px;border:2px dashed transparent;border-radius:3px;transition:all .15s;pointer-events:none}
.drop-yaxis{position:absolute;top:30px;bottom:22px;left:0;width:20px;border:2px dashed transparent;border-radius:3px;transition:all .15s;pointer-events:none}
.drop-active{border-color:#e879f9!important;background:rgba(232,121,249,.08)!important}
.tda-pane.drag-over{background:#e879f908!important}
/* ─ Add pane ─ */
.add-pane{display:flex;align-items:center;justify-content:center;height:40px;background:rgba(255,255,255,.01);border:2px dashed #182840;border-radius:5px;margin:6px 8px;cursor:pointer;color:#3a567a;font-size:11px;transition:all .15s}
.add-pane:hover{border-color:#e879f9;color:#e879f9;background:#e879f908}
/* ─ Channel browser ─ */
#tda_browser{background:#050a14;border-left:1px solid #182840;display:flex;flex-direction:column;flex-shrink:0;overflow:hidden;transition:width .15s}
#tda_brz_resize{width:4px;background:#182840;cursor:col-resize;flex-shrink:0}
#tda_brz_resize:hover{background:#e879f9}
#tda_brz_hdr{padding:6px 10px;border-bottom:1px solid #182840;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
#tda_ch_list{flex:1;overflow-y:auto;padding:4px}
.ch-grp-hdr{padding:3px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#3a567a;background:rgba(255,255,255,.02);margin:2px 0}
.ch-item{display:flex;align-items:center;gap:5px;padding:4px 7px;border-radius:4px;cursor:grab;transition:background .1s;border:1px solid transparent}
.ch-item:hover{background:rgba(255,255,255,.05);border-color:#182840}
.ch-item.dragging{opacity:.4}
.ch-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.ch-name{font-size:10px;color:var(--text2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ch-unit{font-size:9px;color:#3a567a}
.ch-range{font-size:8px;color:#3a567a;font-family:var(--mono)}
/* ─ Zoom bar ─ */
#tda_zoombar{height:26px;background:rgba(255,255,255,.02);border-top:1px solid #182840;position:relative;flex-shrink:0;display:${hasData?'block':'none'}}
#tda_zt{position:absolute;top:3px;bottom:3px;left:54px;right:8px;background:rgba(255,255,255,.03);border-radius:2px}
#tda_zw{position:absolute;top:0;bottom:0;background:rgba(232,121,249,.18);border:1px solid rgba(232,121,249,.5);border-radius:2px;cursor:ew-resize;min-width:8px}
#tda_ztl{position:absolute;left:3px;top:50%;transform:translateY(-50%);font-size:9px;color:#3a567a}
/* ─ AI panel ─ */
#tda_ai{background:#050a14;border-top:1px solid #182840;flex-shrink:0;overflow:hidden;transition:max-height .2s}
#tda_ai.open{max-height:260px}
#tda_ai.closed{max-height:28px}
#tda_ai_hdr{padding:4px 12px;display:flex;align-items:center;gap:8px;cursor:pointer;border-bottom:1px solid #182840;height:28px}
#tda_ai_body{padding:10px 14px;overflow-y:auto;max-height:220px;font-size:12px;color:var(--text2);line-height:1.75}
#tda_ai_body h4{color:#e879f9;font-size:12px;font-weight:700;margin:8px 0 3px}
#tda_ai_body ul{margin:4px 0;padding-left:16px}
#tda_ai_body li{margin-bottom:3px;font-size:12px}
/* ─ Upload overlay ─ */
#tda_upload{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#07080b;z-index:20;flex-direction:column;gap:14px;cursor:pointer}
</style>

<div id="tda_app">

  <!-- CATEGORY NAV -->
  <div id="tda_topbar">
    <div id="tda_catnav">
      ${(typeof BT_CATS!=='undefined'?BT_CATS:[]).map(c=>`
        <button class="tda-cb ${c.id==='data_analysis'?'active':''}"
          style="${c.id==='data_analysis'?'border-color:#e879f950;background:#e879f915;color:#e879f9':''}"
          onclick="renderBatteryTesting('${c.id}')">
          <span style="font-size:12px">${c.icon}</span>${c.label}
        </button>`).join('')}
    </div>

    <!-- PROJECT CONTEXT (all linked fields) -->
    <div id="tda_ctx">
      <span class="ctx-k" style="margin-right:2px">PROJECT →</span>
      ${tdaCtxChips(S)}
      <button onclick="switchTopTab('engineering',document.getElementById('ttab-engineering'));showSec('targets',document.querySelector('.nb'))"
        style="margin-left:auto;padding:2px 8px;background:#1a0d2b;border:1px solid #e879f940;color:#e879f9;border-radius:3px;font-size:10px;cursor:pointer">✏ Edit</button>
    </div>
  </div>

  <!-- TOOLBAR -->
  <div id="tda_toolbar">
    <button class="tb" onclick="tdaOpen()">📂 Open</button>
    <input type="file" id="tda_file" accept=".csv,.xlsx,.xls,.txt,.tsv" multiple style="display:none" onchange="tdaHandleFiles(this.files)">
    <div class="tsep"></div>
    <button class="tb ${hasData?'':'disabled'}" onclick="tdaAddPane('time')" ${!hasData?'disabled':''}>+ Time Pane</button>
    <button class="tb ${hasData?'':'disabled'}" onclick="tdaAddPane('xy')"   ${!hasData?'disabled':''}>+ X/Y Graph</button>
    <button class="tb ${hasData?'':'disabled'}" onclick="tdaAutoLayout()"   ${!hasData?'disabled':''}>⊞ Auto</button>
    <button class="tb ${hasData?'':'disabled'}" onclick="tdaResetZoom()"    ${!hasData?'disabled':''}>↕ Reset</button>
    <div class="tsep"></div>
    <button class="tb hi ${hasData?'':'disabled'}" onclick="tdaRunAI(false)" ${!hasData?'disabled':''}>🤖 AI Analyse</button>
    <button class="tb ${hasData?'':'disabled'}" onclick="tdaRunAI(true)"  ${!hasData?'disabled':''}>🤖 Deep</button>
    <div class="tsep"></div>
    <button class="tb ${hasData?'':'disabled'}" onclick="tdaExport()" ${!hasData?'disabled':''}>⬇ Export</button>
    ${hasData?`<div class="tsep"></div>
    <span style="color:#3a567a;font-size:10px">${d.nRows.toLocaleString()} rows · ${d.headers.length} ch · ${d.fileName}</span>
    <button class="tb" onclick="tdaClear()" style="margin-left:auto;color:var(--r);border-color:rgba(255,77,109,.2)">✕ Clear</button>`:''}
  </div>

  <!-- SHEET TABS -->
  ${t.sheets.length>1?`<div id="tda_sheet_tabs">
    ${t.sheets.map((s,i)=>`<button class="tda-stab ${i===t.activeSheet?'active':''}" onclick="tdaSwitchSheet(${i})">${s.name}</button>`).join('')}
  </div>`:''}

  <!-- MAIN: CHARTS + BROWSER -->
  <div id="tda_main">
    <!-- CHART AREA -->
    <div id="tda_charts" onmouseleave="tdaOnLeave()">
      ${hasData ? tdaBuildPanes() : `
      <div id="tda_upload"
        onclick="tdaOpen()"
        ondragover="event.preventDefault();this.style.background='#e879f908'"
        ondragleave="this.style.background=''"
        ondrop="event.preventDefault();this.style.background='';tdaHandleFiles(event.dataTransfer.files)">
        <div style="font-size:44px">📊</div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">Drop test log or click to open</div>
        <div style="font-size:11px;color:#3a567a;text-align:center;max-width:360px;line-height:1.7">
          CSV · Excel (.xlsx) · TSV · BMS log · Cycler export<br>
          Multi-sheet Excel fully supported — all sheets loaded
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px;max-width:420px;text-align:center">
          ${[['⚡','V/I/P','Pack + cell'],['🌡️','Temperature','Cell + coolant'],['📈','SOC/SOH','State + Ah'],
             ['🔄','Multi-sheet','All Excel sheets'],['↔️','Drag X/Y','Custom axes'],['🤖','AI Analysis','vs project targets']
          ].map(([ic,t,d])=>`<div style="background:rgba(255,255,255,.03);border:1px solid #182840;border-radius:7px;padding:9px">
            <div style="font-size:18px;margin-bottom:3px">${ic}</div>
            <div style="font-size:11px;font-weight:700;color:var(--text)">${t}</div>
            <div style="font-size:9px;color:#3a567a;margin-top:1px">${d}</div>
          </div>`).join('')}
        </div>
      </div>`}
    </div>

    <!-- BROWSER RESIZE -->
    ${hasData?'<div id="tda_brz_resize" onmousedown="tdaBrzResize(event)"></div>':''}

    <!-- CHANNEL BROWSER -->
    ${hasData?`
    <div id="tda_browser" style="width:${t.browserWidth}px">
      <div id="tda_brz_hdr">
        <span style="font-weight:700;color:var(--text);font-size:11px">Channels</span>
        <span style="font-size:9px;color:#3a567a">${d.headers.length} total</span>
      </div>
      <div id="tda_ch_list">${tdaBuildBrowser()}</div>
    </div>`:''}
  </div>

  <!-- ZOOM BAR -->
  <div id="tda_zoombar">
    <span id="tda_ztl">Time</span>
    <div id="tda_zt">
      <div id="tda_zw" style="left:${t.zoomX.x0*100}%;width:${(t.zoomX.x1-t.zoomX.x0)*100}%" onmousedown="tdaZoomDrag(event)"></div>
    </div>
  </div>

  <!-- AI PANEL -->
  <div id="tda_ai" class="${t.aiResult?'open':'closed'}">
    <div id="tda_ai_hdr" onclick="document.getElementById('tda_ai').classList.toggle('open');document.getElementById('tda_ai').classList.toggle('closed')">
      <span style="font-weight:700;color:#e879f9;font-size:11px">🤖 AI Analysis</span>
      <span style="color:#3a567a;font-size:9px">${t.aiResult?'Click to collapse':'Run AI Analyse above'}</span>
      <input id="tda_ctx_input" onclick="event.stopPropagation()" placeholder="Test context…"
        style="padding:2px 7px;background:#0d1626;border:1px solid #182840;border-radius:4px;color:var(--text);font-size:10px;width:260px;margin-left:auto">
    </div>
    <div id="tda_ai_body">${t.aiResult||'<span style="color:#3a567a">Run AI Analyse to see interpretation here</span>'}</div>
  </div>

</div>`;

  if(hasData){ requestAnimationFrame(()=>{ tdaDrawAll(); tdaInitDrag(); }); }
};

/* ═══ PROJECT CONTEXT CHIPS ═══ */
function tdaCtxChips(S){
  const g=id=>{const el=document.getElementById(id);return el?el.value:null;};
  const chip=(k,v,c)=>`<div class="ctx-chip"><span class="ctx-k">${k}</span><span class="ctx-v" style="color:${c||'#e879f9'}">${v}</span></div>`;
  const S2=S||{};
  return [
    chip('App',       g('t_app')||S2.app||'—',          '#60a5fa'),
    chip('Chem',      (g('c_chem')||S2.c_chem||'LFP').split(' ')[0].toUpperCase(), '#e879f9'),
    chip('Config',    `${S2.S_total||112}S/${g('c_pp')||S2.c_pp||1}P`, '#4a9eff'),
    chip('V_nom',     (S2.V_nom_pack||358).toFixed(0)+'V', '#4a9eff'),
    chip('Vop_hi',    (S2.V_dod_hi_pack||S2.V_max_pack||420).toFixed(0)+'V', '#00d4aa'),
    chip('Vop_lo',    (S2.V_dod_lo_pack||S2.V_min_pack||280).toFixed(0)+'V', '#00d4aa'),
    chip('Vc_hi',     (S2.V_dod_hi_cell||S2.c_vmax||3.65).toFixed(3)+'V', '#f5c518'),
    chip('Vc_lo',     (S2.V_dod_lo_cell||S2.c_vmin||2.0).toFixed(3)+'V',  '#f5c518'),
    chip('SoC',       `${(S2.soc_lo||0).toFixed(0)}–${(S2.soc_hi||100).toFixed(0)}%`, '#94a3b8'),
    chip('E_gross',   (S2.E_gross||43).toFixed(1)+'kWh', '#00d4aa'),
    chip('E_use',     (S2.E_usable||38).toFixed(1)+'kWh','#00d4aa'),
    chip('P_peak',    (+(g('t_ppeak')||S2.t_ppeak||80))+'kW', '#ff7b35'),
    chip('P_cont',    (+(g('t_pcont')||S2.t_pcont||50))+'kW', '#ff7b35'),
    chip('Cap',       (+(g('c_ah')||S2.c_ah||120))+'Ah', '#f5c518'),
    chip('IR_BoL',    (+(g('c_ir_bol')||S2.c_ir_bol||0.22))+'mΩ', '#a78bfa'),
    chip('T_max',     (+(g('t_tcell_max')||S2.t_tcell_max||55))+'°C', '#ff4d6d'),
    chip('T_op',      (+(g('t_top_lo')||S2.t_top_lo||-20))+'→'+(+(g('t_top_hi')||S2.t_top_hi||55))+'°C', '#ff4d6d'),
    chip('Cycles',    (+(g('t_cycles')||S2.t_cycles||3000)), '#60a5fa'),
    chip('SoH_EoL',   (+(g('t_soh_eol')||S2.t_soh_eol||80))+'%', '#60a5fa'),
    chip('IP',        g('t_ip')||S2.t_ip||'IP67', '#94a3b8'),
    chip('Markets',   (g('t_markets')||S2.markets||'EU').toUpperCase(), '#94a3b8'),
  ].join('');
}

/* ═══ PANE HTML ═══ */
function tdaBuildPanes(){
  const t=tda();
  if(!t.panes.length) return '<div class="add-pane" onclick="tdaAddPane(\'time\')">+ Add Time Pane — drag channels from browser</div>';
  return t.panes.map((p,pi)=>`
    <div class="tda-pane" id="pane_${p.id}" style="height:${p.height||200}px"
      ondragover="event.preventDefault();document.getElementById('pane_${p.id}').classList.add('drag-over')"
      ondragleave="document.getElementById('pane_${p.id}').classList.remove('drag-over')"
      ondrop="tdaDrop(event,'${p.id}','y')">
      <div class="tda-ph">
        <span class="tda-ph-title">${p.label}</span>
        <span class="tda-readout" id="ro_${p.id}">—</span>
        <button class="tda-ph-btn" onclick="tdaResizeP('${p.id}',-40)" title="Shrink">−</button>
        <button class="tda-ph-btn" onclick="tdaResizeP('${p.id}',40)"  title="Grow">+</button>
        <button class="tda-ph-btn" onclick="tdaClearPaneSignals('${p.id}')" title="Clear signals">↺</button>
        <button class="tda-ph-btn" onclick="tdaRemoveP('${p.id}')" title="Remove" style="color:var(--r)">✕</button>
      </div>
      <canvas id="cv_${p.id}" style="width:100%;display:block;cursor:crosshair"
        height="${Math.max(30,(p.height||200)-46)}"
        onmousemove="tdaOnMove(event,'${p.id}')"
        onmouseleave="tdaOnPaneLeave('${p.id}')"
        onmousedown="tdaPanStart(event,'${p.id}')"
        onwheel="tdaWheel(event,'${p.id}')">
      </canvas>
      <!-- Drop zone indicators -->
      <div id="dz_x_${p.id}" class="drop-xaxis"></div>
      <div id="dz_y_${p.id}" class="drop-yaxis"></div>
      <!-- Stats bar -->
      <div class="tda-pstats" id="stats_${p.id}">
        ${tdaPaneStatsHTML(p)}
      </div>
      <!-- Resize handle -->
      <div class="pane-resize-h" id="rh_${p.id}" onmousedown="tdaPaneResize(event,'${p.id}')"></div>
    </div>`).join('')+
  `<div class="add-pane" onclick="tdaAddPane('time')">+ Add Pane — or drag channel from browser to existing pane</div>`;
}

/* ═══ PANE STATS ═══ */
function tdaPaneStatsHTML(p){
  const d=tdaSheet(); if(!d||!p.signals.length) return '<span style="color:#3a567a">No signals — drag from browser</span>';
  const rows=d.rows;
  const {x0,x1}=tda().zoomX;
  const N=rows.length;
  const i0=Math.floor(x0*N), i1=Math.ceil(x1*N);
  const slice=rows.slice(i0,i1);
  if(!slice.length) return '';
  return p.signals.map(s=>{
    const vals=slice.map(r=>+r[s.ci]).filter(v=>!isNaN(v));
    if(!vals.length) return '';
    const mn=Math.min(...vals),mx=Math.max(...vals),mean=vals.reduce((a,b)=>a+b)/vals.length;
    const rms=Math.sqrt(vals.reduce((a,b)=>a+b*b,0)/vals.length);
    const col=TDA_COLS[s.ci%TDA_COLS.length];
    return `<div class="tda-stat" style="border-left:3px solid ${col};padding-left:4px">
      <span style="color:${col};font-weight:700">${d.headers[s.ci]}</span>
      <span class="tda-stat-k">min</span><span class="tda-stat-v" style="color:${col}">${mn.toFixed(2)}</span>
      <span class="tda-stat-k">max</span><span class="tda-stat-v" style="color:${col}">${mx.toFixed(2)}</span>
      <span class="tda-stat-k">avg</span><span class="tda-stat-v" style="color:${col}">${mean.toFixed(3)}</span>
      <span class="tda-stat-k">rms</span><span class="tda-stat-v" style="color:#3a567a">${rms.toFixed(3)}</span>
      <span class="tda-stat-k">n</span><span class="tda-stat-v" style="color:#3a567a">${vals.length.toLocaleString()}</span>
    </div>`;
  }).join('');
}

/* ═══ CHANNEL BROWSER ═══ */
const TDA_COLS=['#4a9eff','#00d4aa','#ff7b35','#f5c518','#ef4444','#a78bfa','#34d399','#fb923c','#38bdf8','#e879f9','#fbbf24','#60a5fa','#f472b6','#4ade80','#facc15'];
function tdaBuildBrowser(){
  const d=tdaSheet(); if(!d) return '';
  const cm=d.colMap;
  const rows=d.rows;
  const groups={'Voltage':[],'Current':[],'Temperature':[],'SOC/SOH':[],'Power':[],'Other':[]};
  d.headers.forEach((h,ci)=>{
    if(ci===cm.t) return;
    const hl=h.toLowerCase();
    const vals=rows.slice(0,200).map(r=>+r[ci]).filter(v=>!isNaN(v));
    const mn=vals.length?Math.min(...vals):0,mx=vals.length?Math.max(...vals):0;
    const ch={ci,name:h,min:mn,max:mx};
    if(/volt|vcell|vpack|v_|oc_v/.test(hl)) groups['Voltage'].push(ch);
    else if(/curr|amp|i_|ipack/.test(hl)) groups['Current'].push(ch);
    else if(/temp|deg|celsius|therm|cool|ambient|tc/.test(hl)) groups['Temperature'].push(ch);
    else if(/soc|soh|state/.test(hl)) groups['SOC/SOH'].push(ch);
    else if(/power|watt|kw|pw/.test(hl)) groups['Power'].push(ch);
    else groups['Other'].push(ch);
  });
  return Object.entries(groups).filter(([,v])=>v.length).map(([grp,chs])=>`
    <div class="ch-grp-hdr">${grp} (${chs.length})</div>
    ${chs.map(ch=>`
      <div class="ch-item" id="ch_${ch.ci}" draggable="true"
        ondragstart="tdaChDrag(event,${ch.ci})" ondragend="tdaChDragEnd(${ch.ci})"
        ondblclick="tdaAddToBestPane(${ch.ci})" title="Drag to pane · Double-click to add · ${ch.name}">
        <div class="ch-dot" style="background:${TDA_COLS[ch.ci%TDA_COLS.length]}"></div>
        <div style="flex:1;min-width:0">
          <div class="ch-name">${ch.name}</div>
          <div class="ch-range">${ch.min.toFixed(2)} → ${ch.max.toFixed(2)}</div>
        </div>
      </div>`).join('')}`).join('');
}

/* ═══ INIT PANES ═══ */
function tdaInitPanes(){
  const t=tda(), d=tdaSheet(); if(!d) return;
  t.panes=[]; t.zoomX={x0:0,x1:1}; t.cursor=null;
  const cm=d.colMap;
  const vSigs=[cm.v_pack,...(cm.v_cells||[]).slice(0,3)].filter(v=>v!=null);
  if(vSigs.length) t.panes.push({id:'p_v',label:'Voltage [V]',signals:vSigs.map(ci=>({ci})),height:200,type:'time'});
  if(cm.i_pack!=null) t.panes.push({id:'p_i',label:'Current [A]',signals:[{ci:cm.i_pack}],height:160,type:'time'});
  const tSigs=[...(cm.t_cells||[]).slice(0,4),cm.temp_amb,cm.temp_cool_in,cm.temp_cool_out].filter(v=>v!=null);
  if(tSigs.length) t.panes.push({id:'p_t',label:'Temperature [°C]',signals:tSigs.map(ci=>({ci})),height:180,type:'time'});
  if(cm.soc!=null) t.panes.push({id:'p_soc',label:'SOC [%]',signals:[{ci:cm.soc}],height:140,type:'time'});
  else if(cm.p_pack!=null) t.panes.push({id:'p_p',label:'Power [kW]',signals:[{ci:cm.p_pack}],height:140,type:'time'});
  if(!t.panes.length && d.headers.length>1) t.panes.push({id:'p0',label:d.headers[1],signals:[{ci:1}],height:200,type:'time'});
}

/* ═══ DRAW ALL PANES ═══ */
function tdaDrawAll(){ tda().panes.forEach(p=>tdaDraw(p)); }

function tdaDraw(p){
  const t=tda(), d=tdaSheet(); if(!d||!p) return;
  const cv=document.getElementById('cv_'+p.id); if(!cv) return;
  const W=cv.parentElement?.clientWidth||700;
  const H=cv.height||172;
  cv.width=W;
  const ctx=cv.getContext('2d');
  const pad={l:52,r:12,t:8,b:22};
  const pw=W-pad.l-pad.r, ph=H-pad.t-pad.b;
  const rows=d.rows, N=rows.length;
  const {x0,x1}=t.zoomX;
  const i0=Math.floor(x0*N), i1=Math.ceil(x1*N);
  const slice=rows.slice(i0,i1);
  if(!slice.length) return;

  ctx.fillStyle='#07080b'; ctx.fillRect(0,0,W,H);

  if(p.type==='xy' && p.xAxis!=null && p.signals.length>0){
    tdaDrawXY(ctx,p,slice,pad,pw,ph,W,H);
  } else {
    tdaDrawTime(ctx,p,slice,pad,pw,ph,W,H,d,N,i0,i1);
  }

  // Update stats
  const statsEl=document.getElementById('stats_'+p.id);
  if(statsEl) statsEl.innerHTML=tdaPaneStatsHTML(p);
}

function tdaDrawTime(ctx,p,slice,pad,pw,ph,W,H,d,N,i0,i1){
  const t=tda(), cm=d.colMap;
  // Y range
  let ymin=Infinity,ymax=-Infinity;
  p.signals.forEach(s=>slice.forEach(r=>{const v=+r[s.ci];if(!isNaN(v)){if(v<ymin)ymin=v;if(v>ymax)ymax=v;}}));
  if(!isFinite(ymin)||ymin===ymax){ymin=(ymin||0)-1;ymax=(ymax||1)+1;}
  const ypd=(ymax-ymin)*0.07; ymin-=ypd; ymax+=ypd;
  const my=v=>pad.t+ph*(1-(v-ymin)/(ymax-ymin));
  const mx=fi=>pad.l+(fi/(slice.length-1||1))*pw;

  // Grid
  ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;
  [0,.25,.5,.75,1].forEach(f=>{
    const y=pad.t+ph*f; ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
    const val=ymax-(ymax-ymin)*f;
    ctx.fillStyle='#3a567a';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='right';
    ctx.fillText(val.toFixed(Math.abs(val)<10?2:0),pad.l-2,y+3);
  });
  // X axis time labels
  [0,.25,.5,.75,1].forEach(f=>{
    const x=pad.l+f*pw;
    ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();
    if(cm.t!=null){
      const ri=Math.floor(f*(slice.length-1));
      const tv=+slice[ri]?.[cm.t]||0;
      const lbl=tv>=3600?(tv/3600).toFixed(2)+'h':tv>=60?(tv/60).toFixed(1)+'m':tv.toFixed(0)+'s';
      ctx.fillStyle='#3a567a';ctx.textAlign='center';ctx.fillText(lbl,x,H-pad.b+11);
    }
  });

  // Spec lines from project targets
  tdaDrawSpecLines(ctx,p,ymin,ymax,my,pad,W);

  // Signals
  const step=Math.max(1,Math.floor(slice.length/Math.min(pw*2,4000)));
  p.signals.forEach((s,si)=>{
    ctx.beginPath();ctx.strokeStyle=TDA_COLS[s.ci%TDA_COLS.length];ctx.lineWidth=1.6;
    let first=true;
    for(let i=0;i<slice.length;i+=step){
      const v=+slice[i][s.ci];if(isNaN(v)){first=true;continue;}
      const x=mx(i),y=my(v);
      first?ctx.moveTo(x,y):ctx.lineTo(x,y);first=false;
    }
    ctx.stroke();
    ctx.fillStyle=TDA_COLS[s.ci%TDA_COLS.length];ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='left';
    ctx.fillText(d.headers[s.ci],pad.l+4+si*110,pad.t+13);
  });

  // Cursor
  if(t.cursor!=null){
    const cx=pad.l+t.cursor*pw;
    ctx.strokeStyle='rgba(232,121,249,.8)';ctx.lineWidth=1;ctx.setLineDash([3,3]);
    ctx.beginPath();ctx.moveTo(cx,pad.t);ctx.lineTo(cx,H-pad.b);ctx.stroke();ctx.setLineDash([]);
    // Value readout
    const ri=Math.floor(t.cursor*(slice.length-1));
    const tval=cm.t!=null?(+slice[ri]?.[cm.t]||0):ri;
    const tlbl=tval>=3600?(tval/3600).toFixed(3)+'h':tval>=60?(tval/60).toFixed(2)+'m':tval.toFixed(1)+'s';
    const vals=p.signals.map(s=>{const v=+slice[ri]?.[s.ci];return isNaN(v)?null:`${d.headers[s.ci]}=${v.toFixed(3)}`;}).filter(Boolean);
    const rdEl=document.getElementById('ro_'+p.id);
    if(rdEl) rdEl.textContent=`t=${tlbl}  ${vals.join('  ')}`;
  }
}

function tdaDrawXY(ctx,p,slice,pad,pw,ph,W,H){
  const t=tda(), d=tdaSheet();
  const xci=p.xAxis, yci=p.signals[0]?.ci;
  if(xci==null||yci==null) return;
  const xvals=slice.map(r=>+r[xci]).filter(v=>!isNaN(v));
  const yvals=slice.map(r=>+r[yci]).filter(v=>!isNaN(v));
  if(!xvals.length||!yvals.length) return;
  const xmin=Math.min(...xvals),xmax=Math.max(...xvals);
  const ymin=Math.min(...yvals),ymax=Math.max(...yvals);
  const xpad=(xmax-xmin)*0.05||1, ypad=(ymax-ymin)*0.05||1;
  const mx=v=>pad.l+(v-(xmin-xpad))/((xmax+xpad)-(xmin-xpad))*pw;
  const my=v=>pad.t+ph*(1-(v-(ymin-ypad))/((ymax+ypad)-(ymin-ypad)));
  // Grid
  ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;
  [0,.25,.5,.75,1].forEach(f=>{
    const y=pad.t+ph*f;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
    const val=ymax-(ymax-ymin)*f;ctx.fillStyle='#3a567a';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='right';
    ctx.fillText(val.toFixed(2),pad.l-2,y+3);
    const x=pad.l+f*pw;ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();
    ctx.fillStyle='#3a567a';ctx.textAlign='center';ctx.fillText((xmin+(xmax-xmin)*f).toFixed(2),x,H-pad.b+11);
  });
  // Points
  ctx.fillStyle=TDA_COLS[yci%TDA_COLS.length];
  const step=Math.max(1,Math.floor(slice.length/2000));
  for(let i=0;i<slice.length;i+=step){
    const xv=+slice[i][xci],yv=+slice[i][yci];if(isNaN(xv)||isNaN(yv)) continue;
    ctx.beginPath();ctx.arc(mx(xv),my(yv),1.5,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle='#3a567a';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='center';
  ctx.fillText('X: '+d.headers[xci],pad.l+pw/2,H-pad.b+11);
  ctx.textAlign='left';ctx.fillText('Y: '+d.headers[yci],pad.l+4,pad.t+13);
}

function tdaDrawSpecLines(ctx,p,ymin,ymax,my,pad,W){
  const S=window.S||{};
  const lb=p.label.toLowerCase();
  const lines=[];
  if(lb.includes('volt')){
    if(S.V_dod_hi_pack||S.V_max_pack) lines.push({v:S.V_dod_hi_pack||S.V_max_pack,col:'rgba(0,212,170,.5)',l:'Vop_hi'});
    if(S.V_dod_lo_pack||S.V_min_pack) lines.push({v:S.V_dod_lo_pack||S.V_min_pack,col:'rgba(245,197,24,.45)',l:'Vop_lo'});
    if(S.V_nom_pack) lines.push({v:S.V_nom_pack,col:'rgba(74,158,255,.3)',l:'V_nom'});
  }
  if(lb.includes('temp')||lb.includes('°c')){
    if(S.t_tcell_max) lines.push({v:S.t_tcell_max,col:'rgba(255,77,109,.5)',l:'T_limit'});
    if(S.t_tcell_max) lines.push({v:S.t_tcell_max-10,col:'rgba(245,197,24,.4)',l:'T_derate'});
  }
  if(lb.includes('soc')){
    if(S.soc_hi) lines.push({v:S.soc_hi,col:'rgba(0,212,170,.4)',l:'SoC_hi'});
    if(S.soc_lo||0) lines.push({v:S.soc_lo||0,col:'rgba(245,197,24,.4)',l:'SoC_lo'});
  }
  if(lb.includes('curr'))  lines.push({v:0,col:'rgba(255,255,255,.1)',l:'0A'});
  lines.filter(l=>l.v>=ymin&&l.v<=ymax).forEach(l=>{
    ctx.strokeStyle=l.col;ctx.lineWidth=1.2;ctx.setLineDash([5,4]);
    ctx.beginPath();ctx.moveTo(pad.l,my(l.v));ctx.lineTo(W-pad.r,my(l.v));ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=l.col;ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='right';
    ctx.fillText(l.l+' '+l.v.toFixed(0),W-pad.r-2,my(l.v)-3);
  });
}

/* ═══ INTERACTIONS ═══ */
function tdaInitDrag(){
  tda().panes.forEach(p=>{
    const rh=document.getElementById('rh_'+p.id);
    if(rh) rh.onmousedown=e=>tdaPaneResize(e,p.id);
  });
}

window.tdaOnMove=function(e,paneId){
  const t=tda(), cv=document.getElementById('cv_'+paneId);if(!cv) return;
  const rect=cv.getBoundingClientRect();
  const frac=Math.max(0,Math.min(1,(e.clientX-rect.left-52)/(rect.width-64)));
  t.cursor=frac;
  tdaDrawAll();
};
window.tdaOnLeave=function(){tda().cursor=null;tdaDrawAll();};
window.tdaOnPaneLeave=function(id){
  const rdEl=document.getElementById('ro_'+id);if(rdEl) rdEl.textContent='—';
};

let _pan=null;
window.tdaPanStart=function(e,id){
  if(e.button!==0) return;
  const cv=document.getElementById('cv_'+id);if(!cv) return;
  const rect=cv.getBoundingClientRect();
  _pan={sx:e.clientX,sz:{...tda().zoomX},w:rect.width};
  const mm=e2=>{
    if(!_pan) return;
    const dx=(e2.clientX-_pan.sx)/_pan.w, span=_pan.sz.x1-_pan.sz.x0;
    let x0=_pan.sz.x0-dx,x1=_pan.sz.x1-dx;
    if(x0<0){x1-=x0;x0=0;} if(x1>1){x0-=x1-1;x1=1;}
    tda().zoomX={x0,x1};tdaUpdateZoomBar();tdaDrawAll();
  };
  const mu=()=>{_pan=null;document.removeEventListener('mousemove',mm);document.removeEventListener('mouseup',mu);};
  document.addEventListener('mousemove',mm);document.addEventListener('mouseup',mu);
};

window.tdaWheel=function(e,id){
  e.preventDefault();
  const t=tda(),cv=document.getElementById('cv_'+id);if(!cv) return;
  const rect=cv.getBoundingClientRect();
  const frac=Math.max(0,Math.min(1,(e.clientX-rect.left-52)/(rect.width-64)));
  const span=t.zoomX.x1-t.zoomX.x0,factor=e.deltaY>0?1.25:0.8;
  const ns=Math.max(0.005,Math.min(1,span*factor));
  const c=t.zoomX.x0+frac*span;
  let x0=c-frac*ns,x1=c+(1-frac)*ns;
  if(x0<0){x1-=x0;x0=0;} if(x1>1){x0-=x1-1;x1=1;}
  t.zoomX={x0,x1};tdaUpdateZoomBar();tdaDrawAll();
};

function tdaUpdateZoomBar(){
  const zw=document.getElementById('tda_zw');if(!zw) return;
  const {x0,x1}=tda().zoomX;
  zw.style.left=x0*100+'%';zw.style.width=Math.max(0.5,(x1-x0)*100)+'%';
}

window.tdaZoomDrag=function(e){
  const t=tda(),track=document.getElementById('tda_zt');if(!track) return;
  const rect=track.getBoundingClientRect(),span=t.zoomX.x1-t.zoomX.x0,sx=e.clientX,sx0=t.zoomX.x0;
  const mm=e2=>{
    const dx=(e2.clientX-sx)/rect.width;
    let x0=sx0+dx,x1=x0+span;
    if(x0<0){x0=0;x1=span;} if(x1>1){x1=1;x0=1-span;}
    t.zoomX={x0,x1};tdaUpdateZoomBar();tdaDrawAll();
  };
  const mu=()=>{document.removeEventListener('mousemove',mm);document.removeEventListener('mouseup',mu);};
  document.addEventListener('mousemove',mm);document.addEventListener('mouseup',mu);
};

/* ═══ PANE RESIZE ═══ */
window.tdaPaneResize=function(e,id){
  e.preventDefault();
  const p=tda().panes.find(p=>p.id===id);if(!p) return;
  const pEl=document.getElementById('pane_'+id);
  const rh=document.getElementById('rh_'+id);
  const sy=e.clientY,sh=p.height||200;
  if(rh) rh.classList.add('active');
  const mm=e2=>{
    p.height=Math.max(80,Math.min(700,sh+(e2.clientY-sy)));
    if(pEl){pEl.style.height=p.height+'px';const cv=document.getElementById('cv_'+id);if(cv){cv.height=Math.max(30,p.height-46);tdaDraw(p);}}
  };
  const mu=()=>{if(rh) rh.classList.remove('active');document.removeEventListener('mousemove',mm);document.removeEventListener('mouseup',mu);};
  document.addEventListener('mousemove',mm);document.addEventListener('mouseup',mu);
};

window.tdaResizeP=function(id,delta){
  const p=tda().panes.find(p=>p.id===id);if(!p) return;
  p.height=Math.max(80,Math.min(700,(p.height||200)+delta));
  const pEl=document.getElementById('pane_'+id);
  if(pEl){pEl.style.height=p.height+'px';const cv=document.getElementById('cv_'+id);if(cv){cv.height=Math.max(30,p.height-46);tdaDraw(p);}}
};

/* ═══ BROWSER RESIZE ═══ */
window.tdaBrzResize=function(e){
  const t=tda(),br=document.getElementById('tda_browser');if(!br) return;
  const sx=e.clientX,sw=t.browserWidth||220;
  const mm=e2=>{t.browserWidth=Math.max(140,Math.min(400,sw-(e2.clientX-sx)));if(br) br.style.width=t.browserWidth+'px';};
  const mu=()=>{document.removeEventListener('mousemove',mm);document.removeEventListener('mouseup',mu);};
  document.addEventListener('mousemove',mm);document.addEventListener('mouseup',mu);
};

/* ═══ DRAG AND DROP ═══ */
window.tdaChDrag=function(e,ci){
  e.dataTransfer.setData('tda_ci',ci);
  tda().dragSig=ci;
  document.getElementById('ch_'+ci)?.classList.add('dragging');
  // Show drop zone hints on all panes
  tda().panes.forEach(p=>{
    const dzx=document.getElementById('dz_x_'+p.id);
    const dzy=document.getElementById('dz_y_'+p.id);
    if(dzx) dzx.classList.add('drop-active');
    if(dzy) dzy.classList.add('drop-active');
  });
};
window.tdaChDragEnd=function(ci){
  tda().dragSig=null;
  document.getElementById('ch_'+ci)?.classList.remove('dragging');
  tda().panes.forEach(p=>{
    document.getElementById('dz_x_'+p.id)?.classList.remove('drop-active');
    document.getElementById('dz_y_'+p.id)?.classList.remove('drop-active');
    document.getElementById('pane_'+p.id)?.classList.remove('drag-over');
  });
};

window.tdaDrop=function(e,paneId,axis){
  e.preventDefault();
  const ci=parseInt(e.dataTransfer.getData('tda_ci'));
  const p=tda().panes.find(p=>p.id===paneId);
  if(!p||isNaN(ci)) return;
  document.getElementById('pane_'+paneId)?.classList.remove('drag-over');
  document.getElementById('dz_x_'+paneId)?.classList.remove('drop-active');
  document.getElementById('dz_y_'+paneId)?.classList.remove('drop-active');
  const d=tdaSheet();
  // Detect drop zone based on position
  const cv=document.getElementById('cv_'+paneId);
  const rect=cv?.getBoundingClientRect();
  const fromBottom=rect?rect.bottom-e.clientY:999;
  const fromLeft=rect?e.clientX-rect.left:999;
  if(fromBottom<30&&p.type!=='xy'){
    // Drop near X axis → convert to XY and set as X axis
    p.type='xy'; p.xAxis=ci;
    p.label=`${d.headers[p.signals[0]?.ci||0]} vs ${d.headers[ci]}`;
  } else if(fromLeft<30){
    // Drop near Y axis → set as X axis in XY mode
    p.type='xy'; p.xAxis=ci;
  } else {
    // Drop in chart body → add as Y signal
    if(!p.signals.find(s=>s.ci===ci)) p.signals.push({ci});
    if(p.signals.length===1) p.label=d.headers[ci];
  }
  tdaDraw(p);
  // Update stats
  const statsEl=document.getElementById('stats_'+paneId);
  if(statsEl) statsEl.innerHTML=tdaPaneStatsHTML(p);
};

window.tdaAddToBestPane=function(ci){
  const t=tda(),d=tdaSheet();if(!d) return;
  if(!t.panes.length){tdaAddPane('time');}
  const p=t.panes[0];
  if(!p.signals.find(s=>s.ci===ci)){p.signals.push({ci});}
  if(p.signals.length===1) p.label=d.headers[ci];
  tdaDraw(p);
};

window.tdaClearPaneSignals=function(id){
  const p=tda().panes.find(p=>p.id===id);
  if(p){p.signals=[];p.xAxis=null;p.type='time';p.label='Empty Pane';}
  tdaDraw(p);
};

/* ═══ PANE MANAGEMENT ═══ */
window.tdaAddPane=function(type){
  const t=tda(),id='p_'+Date.now();
  t.panes.push({id,label:type==='xy'?'X/Y Graph':'New Pane',signals:[],xAxis:null,height:200,type:type||'time'});
  renderDataAnalysis();
};
window.tdaRemoveP=function(id){
  tda().panes=tda().panes.filter(p=>p.id!==id);renderDataAnalysis();
};
window.tdaAutoLayout=function(){tdaInitPanes();renderDataAnalysis();};
window.tdaResetZoom=function(){tda().zoomX={x0:0,x1:1};tdaUpdateZoomBar();tdaDrawAll();};

/* ═══ SHEET SWITCHING ═══ */
window.tdaSwitchSheet=function(idx){
  const t=tda();
  t.activeSheet=idx;
  t.panes=[];t.zoomX={x0:0,x1:1};t.cursor=null;
  tdaInitPanes();renderDataAnalysis();
};

/* ═══ FILE HANDLING ═══ */
window.tdaOpen=function(){document.getElementById('tda_file')?.click();};

window.tdaHandleFiles=function(files){
  if(!files||!files.length) return;
  const t=tda();
  t.sheets=[];t.activeSheet=0;t.panes=[];t.aiResult=null;
  // Show loading
  const root=document.getElementById('bt_root');
  if(root){const ol=document.getElementById('tda_upload');if(ol) ol.innerHTML='<div style="font-size:24px">⏳</div><div style="color:var(--text2)">Loading files…</div>';}
  let pending=files.length;
  Array.from(files).forEach(file=>{
    const ext=file.name.split('.').pop().toLowerCase();
    if(ext==='xlsx'||ext==='xls'){
      const loadXlsx=()=>{
        const r=new FileReader();
        r.onload=e=>{
          const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
          wb.SheetNames.forEach(name=>{
            const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:''});
            if(rows.length<2) return;
            const parsed=tdaParseRows(rows,file.name+'·'+name,'\t');
            if(parsed) t.sheets.push(parsed);
          });
          if(!--pending){tdaInitPanes();renderDataAnalysis();}
        };
        r.readAsArrayBuffer(file);
      };
      if(typeof XLSX==='undefined'){const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=loadXlsx;document.head.appendChild(s);}
      else loadXlsx();
    } else {
      const r=new FileReader();
      r.onload=e=>{
        const parsed=tdaParseText(e.target.result,file.name);
        if(parsed) t.sheets.push(parsed);
        if(!--pending){tdaInitPanes();renderDataAnalysis();}
      };
      r.readAsText(file);
    }
  });
};

function tdaParseText(text,fileName){
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  const delim=lines[0].includes('\t')?'\t':lines[0].includes(';')?';':',';
  const rows=lines.map(l=>l.split(delim));
  return tdaParseRows(rows,fileName,delim);
}

function tdaParseRows(rawRows,fileName){
  if(!rawRows.length) return null;
  const hasHdr=isNaN(parseFloat(String(rawRows[0][0]).trim()));
  const hdr=hasHdr?rawRows[0].map(h=>String(h).trim()):rawRows[0].map((_,i)=>'Col'+i);
  const rows=[];
  for(let i=hasHdr?1:0;i<Math.min(rawRows.length,100001);i++){
    if(!rawRows[i]||!rawRows[i].some(v=>v!=='')) continue;
    rows.push(rawRows[i].map(v=>{const n=parseFloat(v);return isNaN(n)?v:n;}));
  }
  if(rows.length<2) return null;
  const colMap=tdaDetectCols(hdr);
  return {headers:hdr,rows,fileName,nRows:rows.length,colMap};
}

function tdaDetectCols(hdr){
  const hl=hdr.map(h=>String(h).toLowerCase().replace(/[^a-z0-9_]/g,''));
  const f=(...keys)=>{for(const k of keys){const i=hl.findIndex(h=>h.includes(k));if(i>=0)return i;}return null;};
  const fAll=(...keys)=>hl.reduce((a,h,i)=>{if(keys.some(k=>h.includes(k)))a.push(i);return a;},[]);
  return{
    t:f('time','timestamp','elapsed','t_s','tsec','sec'),
    v_pack:f('vpack','packvolt','v_bat','vbat','packv','volt','voltage'),
    i_pack:f('ipack','current_pack','i_bat','ibat','current','amp'),
    p_pack:f('power_pack','p_pack','power','watt','kw'),
    soc:f('soc','stateofcharge','soc_pct'),
    temp_amb:f('tamb','ambient','t_ambient'),
    temp_cool_in:f('tcool_in','coolant_in','t_in','inlet'),
    temp_cool_out:f('tcool_out','coolant_out','t_out','outlet'),
    flow:f('flow','flowrate'),
    v_cells:fAll('vcell','cell_v','v_cell','cv'),
    t_cells:fAll('tcell','cell_t','t_cell','ct'),
    fault:f('fault','error','alarm'),
  };
}

/* ═══ AI ANALYSIS ═══ */
window.tdaRunAI=async function(deep){
  const t=tda(),d=tdaSheet(),S=window.S||{};
  if(!d){alert('Upload a file first.');return;}
  const aiPanel=document.getElementById('tda_ai');
  const aiBody=document.getElementById('tda_ai_body');
  if(aiPanel){aiPanel.classList.remove('closed');aiPanel.classList.add('open');}
  if(aiBody) aiBody.innerHTML='<span style="color:#3a567a">⚙️ Analysing all panes vs project targets…</span>';

  const g=id=>{const el=document.getElementById(id);return el?el.value:null;};
  const col=ci=>ci!=null?d.rows.map(r=>+r[ci]).filter(v=>!isNaN(v)):[];
  const stat=arr=>{if(!arr.length)return null;const mn=Math.min(...arr),mx=Math.max(...arr),mean=arr.reduce((a,b)=>a+b)/arr.length;return{min:mn.toFixed(3),max:mx.toFixed(3),mean:mean.toFixed(3)};};

  // Build per-pane summaries
  const paneSummaries=t.panes.map(p=>({
    pane:p.label,
    signals:p.signals.map(s=>({name:d.headers[s.ci],stats:stat(col(s.ci))}))
  }));

  const prompt=`You are a senior EV battery data analysis engineer. Analyse this battery test log against project targets.

## Project Targets:
Chem=${g('c_chem')||S.c_chem||'LFP'}, Config=${S.S_total||112}S/${S.c_pp||1}P
V_nom=${S.V_nom_pack?.toFixed(0)||358}V, V_op_hi=${(S.V_dod_hi_pack||S.V_max_pack||420).toFixed(0)}V, V_op_lo=${(S.V_dod_lo_pack||S.V_min_pack||280).toFixed(0)}V
T_cell_max=${S.t_tcell_max||55}°C, IR_BoL=${S.c_ir_bol||0.22}mΩ, P_peak=${S.t_ppeak||80}kW
SoC_range=${(S.soc_lo||0).toFixed(0)}–${(S.soc_hi||100).toFixed(0)}%, Cycles_target=${S.t_cycles||3000}
${document.getElementById('tda_ctx_input')?.value?'Test context: '+document.getElementById('tda_ctx_input').value:''}

## Data File: ${d.fileName} (${d.nRows.toLocaleString()} rows, ${d.headers.length} channels)
## Active Panes and Signal Statistics:
${JSON.stringify(paneSummaries,null,2)}

${deep?`Provide comprehensive analysis:
<h4>Executive Summary</h4> 3 sentences: test type, overall health, critical finding.
<h4>Signal-by-Signal Analysis</h4> Compare each signal's min/max/mean against project targets. Flag any exceedances.
<h4>Top 5 Anomalies</h4> Root cause hypothesis + recommended action for each.
<h4>Cell Balance Assessment</h4> If cell voltage channels detected.
<h4>Thermal Performance</h4> Temperature rise rate, TMS effectiveness.
<h4>Risk Rating</h4> Low/Medium/High/Critical with justification.
<h4>Next Test Recommendations</h4> What to run next based on findings.`
:`<h4>Executive Summary</h4> 3 sentences.
<h4>Key Findings</h4> Top 3 findings comparing signal values to project targets with specific numbers.
<h4>Actions</h4> 3 specific next steps.`}
Use <ul><li> for lists. Be specific with numbers. Reference project target values.`;

  try{
    const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1500,messages:[{role:'user',content:prompt}]})});
    const data=await resp.json();
    const txt=data.content?.map(b=>b.text||'').join('')||'No response';
    t.aiResult=txt.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^- (.+)/gm,'<li>$1</li>').replace(/(<li>[\s\S]+?<\/li>)+/g,m=>`<ul>${m}</ul>`);
    if(aiBody) aiBody.innerHTML=t.aiResult+`<div style="font-size:9px;color:#3a567a;margin-top:8px;text-align:right">🤖 ${deep?'Deep':'Standard'} · ${new Date().toLocaleTimeString()}</div>`;
  }catch(err){
    if(aiBody) aiBody.innerHTML=`<span style="color:var(--r)">⚠ API Error: ${err.message}</span>`;
  }
};

/* ═══ EXPORT ═══ */
window.tdaExport=function(){
  const t=tda(),d=tdaSheet(),S=window.S||{};
  if(!d) return;
  const lines=['BatteryMIS Test Data Analysis',`File: ${d.fileName}`,`Date: ${new Date().toLocaleString()}`,
    `Project: ${S.c_chem||''} ${S.S_total||''}S/${S.c_pp||''}P V_nom=${S.V_nom_pack?.toFixed(0)||''}V`,'',
    'Pane Statistics:',
    ...tda().panes.map(p=>[`[${p.label}]`,
      ...p.signals.map(s=>{const vals=d.rows.map(r=>+r[s.ci]).filter(v=>!isNaN(v));const mn=Math.min(...vals),mx=Math.max(...vals),mean=vals.reduce((a,b)=>a+b)/vals.length;return `  ${d.headers[s.ci]}: min=${mn.toFixed(3)} max=${mx.toFixed(3)} avg=${mean.toFixed(3)}`})].join('\n')),
    '','AI Analysis:',t.aiResult?.replace(/<[^>]+>/g,'')||'(not run)'];
  const a=document.createElement('a');
  a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(lines.join('\n'));
  a.download=`TDA_${d.fileName.replace(/\.\w+$/,'')}_${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
};
window.tdaClear=function(){window._tda={sheets:[],activeSheet:0,panes:[],cursor:null,zoomX:{x0:0,x1:1},aiResult:null,dragSig:null,browserWidth:220};renderDataAnalysis();};
