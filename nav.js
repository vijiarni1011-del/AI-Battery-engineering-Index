// ── showSec: defined immediately so onclick handlers work from first paint ──
function showSec(id, btn) {
  // Hide all .sec panels, deactivate all nav buttons
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById(id);
  if (sec) sec.classList.add('active');
  if (btn && btn.classList) {
    btn.classList.add('active');
  } else {
    document.querySelectorAll('.nb').forEach(b => {
      const oc = b.getAttribute('onclick') || '';
      if (oc.includes("'" + id + "'") || oc.includes('"' + id + '"')) b.classList.add('active');
    });
  }
  // Run tab-specific calculations after a short delay to let paint complete
  setTimeout(function() {
    try { if (typeof propagate === 'function') propagate(); } catch(e) {}
    try {
      if (id === 'powermap')    { drawPowerMap(); }
      if (id === 'precharge')   { calcPrecharge(); }
      if (id === 'resistance')  { calcResistance(); }
      if (id === 'busbar')      { calcBusbar(); }
      if (id === 'bms')         { updateCCCV(); }
      if (id === 'gap')         { updateGap(); calcBOM(); calcTCO(); }
      if (id === 'bizcost')     { calcBOM(); calcTCO(); }
      if (id === 'tvr')         { runTVR(); }
      if (id === 'pack3d')      { setTimeout(p3_init, 100); }
      if (id === 'cell')        { calcCellDerived(); }
      if (id === 'current')     { calcCurrent(); }
      if (id === 'thermal')     { calcThermal(); if(typeof calcCoolingPressureDrop==='function') calcCoolingPressureDrop(); }
      if (id === 'energy')      { calcEnergy(); }
      if (id === 'lifecycle')   { calcLifecycle(); }
      if (id === 'charge')      { calcCharge(); }
      if (id === 'voltage')     { calcVoltage(); }
      if (id === 'safety')      { calcSafety(); }
      if (id === 'targets')     { updateTargetsCompliance(); }
      // Canvas redraws
      if (id === 'energy')      { try { drawEnergyCanvas(); } catch(e) {} }
      if (id === 'voltage')     { try { drawVoltCanvas(); } catch(e) {} }
      if (id === 'current')     { try { drawCurrentCanvas(); } catch(e) {} }
      if (id === 'thermal')     { try { drawThermalCanvas(); } catch(e) {} }
      if (id === 'charge')      { try { drawChargingCanvas(); } catch(e) {} }
      if (id === 'lifecycle')   { try { drawLifecycleCanvas(); } catch(e) {} }
      if (id === 'resistance')  { try { drawResistanceCanvas(); } catch(e) {} }
      if (id === 'drive_cycle') { try { drawDriveCycleCanvas(); } catch(e) {} try { runThermalRise(); } catch(e) {} }
      if (id === 'cell')        { try { drawOCVCanvas(); } catch(e) {} }
    } catch(e) {
      try { console.warn('[showSec]', id, e.message); } catch(_) {}
    }
  }, 60);
}
// Register as real handler and flush any clicks queued before app.js loaded
window.showSec = showSec;
window._showSec = showSec;
window._ssReady = true;
if (window._ssQ && window._ssQ.length) {
  window._ssQ.forEach(function(a){ try{ showSec(a[0],a[1]); }catch(e){} });
  window._ssQ = [];
}


// ═══════════════════════════════════════════════════════════════
// UNIFIED SYNC ENGINE
// Single source of truth: DVP Intake ↔ Engineering Targets
// Any field change syncs both directions automatically
// ═══════════════════════════════════════════════════════════════

// ── INTAKE SUB-TAB SWITCHING ──
function switchIntakeTab(tabId, btn) {
  // FIX: wrapped in try/catch so a bad tabId never freezes the intake workflow
  try {
    document.querySelectorAll('.itab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.itab').forEach(t => t.classList.remove('active'));
    const panel = document.getElementById('ipanel-' + tabId);
    if (panel) panel.classList.add('active');
    if (btn && btn.classList) btn.classList.add('active');
    window.scrollTo({top: 60, behavior:'smooth'});
  } catch(e) {
    try { console.log('[switchIntakeTab] ' + e); } catch(_) {}
  }
}

// ── CORE SYNC: push DVP field value → engineering field ──
function syncField(dvpId, engId) {
  if (!engId) return;
  const dvpEl  = document.getElementById(dvpId);
  const engEl  = document.getElementById(engId);
  if (!dvpEl || !engEl) return;
  const val = dvpEl.value;
  if (document.activeElement !== engEl) engEl.value = val;
  // Flash sync indicator on engineering field label
  flashSync(engId);
  // Trigger engineering propagate (if available)
  if (typeof propagate === 'function') propagate();
}

// ── REVERSE SYNC: push engineering field → DVP field ──
function syncBack(engId, dvpId) {
  const engEl = document.getElementById(engId);
  const dvpEl = document.getElementById(dvpId);
  if (!engEl || !dvpEl) return;
  if (document.activeElement !== dvpEl) dvpEl.value = engEl.value;
}

// ── VISUAL SYNC FLASH ──
function flashSync(engId) {
  const el = document.getElementById(engId);
  if (!el) return;
  const label = el.closest('.field')?.querySelector('label') || 
                el.closest('.fg')?.querySelector('.flabel');
  if (!label) return;
  const old = label.querySelector('.sync-indicator');
  if (old) old.remove();
  const ind = document.createElement('span');
  ind.className = 'sync-indicator';
  ind.textContent = '↔ synced';
  label.appendChild(ind);
  setTimeout(() => ind.remove(), 1500);
}

// ── VEHICLE SELECT: shared between DVP + Engineering ──
function selectVehicle(card, val) {
  // DVP intake
  document.querySelectorAll('#vgrid .vcard').forEach(c => c.classList.remove('sel'));
  card.classList.add('sel');
  // Sync to engineering t_app + app_cards
  const tapp = document.getElementById('t_app');
  if (tapp) tapp.value = val;
  document.querySelectorAll('#app_cards .app-card').forEach(c => {
    c.classList.remove('selected');
    if (c.dataset.val === val) c.classList.add('selected');
  });
  document.getElementById('verr').style.display = 'none';
  const cg = document.getElementById('customVehicleGrp');
  if (cg) cg.style.display = val === 'Other' ? 'flex' : 'none';
  if (typeof S !== 'undefined') S.app = val;

  // ── FIX: Only apply preset if no project data has been saved yet ──
  // Check if user has already entered meaningful data
  const projCode = document.getElementById('t_proj')?.value || '';
  const hasData  = projCode.trim() !== '' && projCode.trim() !== 'PRJ-001';
  const hasLocalStorage = (() => {
    try { return !!localStorage.getItem(typeof PERSIST_KEY !== 'undefined' ? PERSIST_KEY : 'battmis_v1'); }
    catch(e) { return false; }
  })();

  if (!hasData && !hasLocalStorage) {
    // Fresh project — safe to apply preset
    if (typeof applyVehiclePreset === 'function') applyVehiclePreset(val);
  } else {
    // Has saved data — only update app type, show toast
    showVehicleToast(val);
    if (typeof propagate === 'function') propagate();
  }
  if (typeof markDerivedFields === 'function') markDerivedFields();
  if (typeof redrawAll === 'function') redrawAll();
}

function syncChemistry(val) {
  const chemEl = document.getElementById('c_chem');
  if (chemEl) {
    chemEl.value = val;
    if (typeof chemPreset === 'function') chemPreset();
  }
  // Also sync req_chem
  const reqChem = document.getElementById('req_chem');
  if (reqChem) reqChem.value = val;
  if (typeof propagate === 'function') propagate();
  flashSync('c_chem');
}

// ── PACK CONFIG SYNC: "14S8P" → c_cps=14, c_ss=8 ──
function syncPackConfig(val) {
  const m = val.match(/(\d+)S(\d+)P/i);
  if (!m) return;
  const cps = parseInt(m[1]), pp = parseInt(m[2]);
  const cpsEl = document.getElementById('c_cps');
  const ppEl  = document.getElementById('c_pp');
  if (cpsEl) { cpsEl.value = cps; flashSync('c_cps'); }
  if (ppEl)  { ppEl.value  = pp;  flashSync('c_pp'); }
  if (typeof propagate === 'function') propagate();
}

// ── PULL ENGINEERING VALUES → POPULATE DVP INTAKE FIELDS ──
// Called when user switches to DVP Intake tab — ensures fields show latest engineering values
function pullEngToIntake() {
  const map = [
    ['t_proj',       'projectCode'],
    ['t_markets',    'markets'],
    ['t_sop',        'targetDate'],
    ['t_fusa',       'funcSafety'],
    ['t_vmax_sys',   'dvp-vmax'],
    ['t_vmin_sys',   'dvp-vmin'],
    ['t_eu_min',     'dvp-energy'],
    ['t_emin',       'dvp-emin'],
    ['t_ppeak',      'dvp-ppeak'],
    ['t_pcont',      'dvp-pcont'],
    ['t_pac',        'dvp-pac'],
    ['t_pdc',        'dvp-pdc'],
    ['t_varch',      'voltageClass'],
    ['t_ip',         'dvp-ip'],
    ['t_cooling',    'dvp-cooling'],
    ['t_cycles',     'dvp-cycles'],
    ['t_soh_eol',    'dvp-soh_eol'],
    ['t_years',      'dvp-years'],
    ['t_auto',       'dvp-auto'],
    ['t_days_yr',    'dvp-days_yr'],
    ['t_cycles_day', 'dvp-cycles_day'],
    ['t_top_lo',     'dvp-top_lo'],
    ['t_top_hi',     'dvp-top_hi'],
    ['t_tcell_max',  'dvp-tcell_max'],
    ['t_alt',        'dvp-alt'],
    ['t_cost',       'dvp-cost'],
    ['c_ah',         'dvp-cah'],
    ['c_vnom',       'dvp-cvnom'],
    ['req_chem',     'chemistry'],
  ];
  map.forEach(([engId, dvpId]) => {
    const engEl = document.getElementById(engId);
    const dvpEl = document.getElementById(dvpId);
    if (engEl && dvpEl && !dvpEl.value) dvpEl.value = engEl.value;
  });
  // Sync vehicle
  const tapp = document.getElementById('t_app');
  if (tapp && tapp.value) {
    const engCard = document.querySelector('#app_cards .app-card[data-val="' + tapp.value + '"]');
    if (engCard) {
      const dvpCard = document.querySelector('#vgrid .vcard[onclick*="' + tapp.value + '"]');
      if (dvpCard) {
        document.querySelectorAll('#vgrid .vcard').forEach(c => c.classList.remove('sel'));
        dvpCard.classList.add('sel');
      }
    }
  }
}

// ── PUSH ALL INTAKE VALUES → ENGINEERING (full sync on tab switch) ──
function pushIntakeToEng() {
  // Map all sync pairs and fire them
  const pairs = [
    ['projectCode',   't_proj'],
    ['markets',       't_markets'],
    ['targetDate',    't_sop'],
    ['funcSafety',    't_fusa'],
    ['dvp-vmax',      't_vmax_sys'],
    ['dvp-vmax',      'req_vmax'],
    ['dvp-vmin',      't_vmin_sys'],
    ['dvp-vmin',      'req_vmin'],
    ['dvp-energy',    't_eu_min'],
    ['dvp-energy',    'req_eu'],
    ['dvp-emin',      't_emin'],
    ['dvp-ppeak',     't_ppeak'],
    ['dvp-pcont',     't_pcont'],
    ['dvp-pac',       't_pac'],
    ['dvp-pdc',       't_pdc'],
    ['voltageClass',  't_varch'],
    ['dvp-ip',        't_ip'],
    ['dvp-cooling',   't_cooling'],
    ['dvp-cycles',    't_cycles'],
    ['dvp-soh_eol',   't_soh_eol'],
    ['dvp-years',     't_years'],
    ['dvp-auto',      't_auto'],
    ['dvp-days_yr',   't_days_yr'],
    ['dvp-cycles_day','t_cycles_day'],
    ['dvp-top_lo',    't_top_lo'],
    ['dvp-top_hi',    't_top_hi'],
    ['dvp-tcell_max', 't_tcell_max'],
    ['dvp-alt',       't_alt'],
    ['dvp-cost',      't_cost'],
    ['dvp-cah',       'c_ah'],
    ['dvp-cvnom',     'c_vnom'],
    ['chemistry',     'req_chem'],
    ['chemistry',     'c_chem'],
  ];
  pairs.forEach(([dvpId, engId]) => {
    const dvpEl = document.getElementById(dvpId);
    const engEl = document.getElementById(engId);
    if (dvpEl && engEl && dvpEl.value) engEl.value = dvpEl.value;
  });
  if (typeof propagate === 'function') propagate();
}

// ── UPDATE switchTopTab to trigger syncs ──
// Wrap original to add bidirectional eng<->intake sync on tab switch
const _origSwitchTopTab = (typeof switchTopTab === 'function') ? switchTopTab : function(){};
window.switchTopTab = function(tabId, btn) {
  _origSwitchTopTab(tabId, btn);
  if (tabId === 'engineering') {
    // FIX: ensure active class is present (base fn already does active-eng)
    if (btn) btn.classList.add('active');
    setTimeout(() => {
      try { if(typeof pushIntakeToEng==='function') pushIntakeToEng(); } catch(e){}
      try { if(typeof propagate==='function') propagate(); } catch(e){}
    }, 150);
  }
  // intake pull is already handled in the base switchTopTab above
};

// ── REVIEW BUILDER ──
function buildReviewAndGo() {
  // Validate required fields
  const required = [
    {id:'projectOwner', label:'Project owner name'},
    {id:'ownerEmail',   label:'Project owner email'},
    {id:'reliability',  label:'Reliability target'},
    {id:'confidence',   label:'Confidence level'},
  ];
  let ok = true;
  // FIX: Use direct ID map instead of fragile chained .replace() which produced wrong IDs
  const fgMap = {
    'projectOwner': 'fg-po',
    'ownerEmail':   'fg-em',
    'reliability':  'fg-re',
    'confidence':   'fg-co',
  };
  required.forEach(r => {
    const el = document.getElementById(r.id);
    const fg = document.getElementById(fgMap[r.id] || ('fg-' + r.id));
    if (el && !el.value.trim()) {
      if (fg) fg.classList.add('err');
      ok = false;
    } else if (fg) fg.classList.remove('err');
  });
  if (!ok) { alert('Please fill in required fields in Validation Parameters.'); return; }

  const tapp = document.getElementById('t_app');
  const appVal = (tapp ? tapp.value : '') || 'Not selected';

  const rows = [
    {k:'Vehicle type',     v: appVal},
    {k:'Machine',          v: dvpGetVal('machineDetails')},
    {k:'Project code',     v: dvpGetVal('projectCode')},
    {k:'Markets',          v: dvpGetVal('markets')},
    {k:'SOP',              v: dvpGetVal('targetDate')},
    {k:'Chemistry',        v: dvpGetVal('chemistry')},
    {k:'Voltage arch.',    v: dvpGetVal('voltageClass') + 'V'},
    {k:'Usable energy',    v: dvpGetVal('dvp-energy') + ' kWh'},
    {k:'Peak power',       v: dvpGetVal('dvp-ppeak') + ' kW'},
    {k:'Cycle life',       v: dvpGetVal('dvp-cycles') + ' cycles'},
    {k:'Calendar life',    v: dvpGetVal('dvp-years') + ' years'},
    {k:'Temp range',       v: dvpGetVal('dvp-top_lo') + '°C to ' + dvpGetVal('dvp-top_hi') + '°C'},
    {k:'IP rating',        v: dvpGetVal('dvp-ip')},
    {k:'Func. safety',     v: dvpGetVal('funcSafety') || 'Not specified'},
    {k:'Reliability',      v: 'R' + dvpGetVal('reliability') + 'C' + dvpGetVal('confidence')},
    {k:'Owner',            v: dvpGetVal('projectOwner')},
  ];

  const grid = document.getElementById('reviewGrid');
  grid.innerHTML = rows.map(r =>
    '<div style="padding:6px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text3)">' + r.k + '</span><strong style="float:right;color:var(--text)">' + (r.v||'—') + '</strong></div>'
  ).join('');

  switchIntakeTab('review', document.getElementById('itab-review'));
}

function dvpGetVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

// ── DVP SUBMIT ──
async function doSubmit() {
  const tapp = document.getElementById('t_app');
  const pid = 'DVP-' + Date.now();
  const payload = {
    project_id: pid,
    submitted_at: new Date().toISOString(),
    vehicle_type: tapp ? tapp.value : '',
    machine_details: dvpGetVal('machineDetails'),
    operator_proximity: dvpGetVal('operatorProx'),
    custom_vehicle: dvpGetVal('customVehicle'),
    pack_config: dvpGetVal('packConfig'),
    chemistry: dvpGetVal('chemistry'),
    voltage_architecture: dvpGetVal('voltageClass'),
    vmax_sys: dvpGetVal('dvp-vmax'),
    vmin_sys: dvpGetVal('dvp-vmin'),
    usable_energy_kwh: dvpGetVal('dvp-energy'),
    min_installed_energy_kwh: dvpGetVal('dvp-emin'),
    peak_power_kw: dvpGetVal('dvp-ppeak'),
    cont_power_kw: dvpGetVal('dvp-pcont'),
    ac_charge_kw: dvpGetVal('dvp-pac'),
    dc_charge_kw: dvpGetVal('dvp-pdc'),
    cell_ah: dvpGetVal('dvp-cah'),
    cell_vnom: dvpGetVal('dvp-cvnom'),
    bms_strategy: dvpGetVal('bmsStrategy'),
    cell_supplier: dvpGetVal('cellSupplier'),
    target_markets: dvpGetVal('markets'),
    sop_date: dvpGetVal('targetDate'),
    scope_out: dvpGetVal('scopeOut'),
    duty_cycle: dvpGetVal('dutyCycle'),
    functional_safety: dvpGetVal('funcSafety'),
    ip_rating: dvpGetVal('dvp-ip'),
    cooling_type: dvpGetVal('dvp-cooling'),
    cycle_life: dvpGetVal('dvp-cycles'),
    eol_soh_pct: dvpGetVal('dvp-soh_eol'),
    calendar_life_yr: dvpGetVal('dvp-years'),
    autonomy_hr: dvpGetVal('dvp-auto'),
    op_temp_lo: dvpGetVal('dvp-top_lo'),
    op_temp_hi: dvpGetVal('dvp-top_hi'),
    alt_masl: dvpGetVal('dvp-alt'),
    cost_target_per_kwh: dvpGetVal('dvp-cost'),
    reliability_target_pct: dvpGetVal('reliability'),
    confidence_level_pct: dvpGetVal('confidence'),
    project_owner: dvpGetVal('projectOwner'),
    owner_email: dvpGetVal('ownerEmail'),
    project_code: dvpGetVal('projectCode'),
    notes: dvpGetVal('notes'),
    // Full engineering state snapshot
    engineering_state: (typeof S !== 'undefined') ? JSON.stringify(S) : '{}'
  };
  const ov = document.getElementById('ov');
  ov.style.display = 'flex';
  document.getElementById('ov-loading').style.display = 'block';
  document.getElementById('ov-ok').style.display = 'none';
  document.getElementById('ov-err').style.display = 'none';
  try {
    await fetch(window.DVP_CONFIG.n8nWebhookUrl, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    document.getElementById('ov-loading').style.display = 'none';
    document.getElementById('ov-ok').style.display = 'block';
    document.getElementById('ov-ref').textContent = 'Project ID: ' + pid;
    try { localStorage.setItem('lastProject', JSON.stringify(payload)); } catch(_) {} // FIX: guard for file:// / sandboxed contexts
  } catch(e) {
    document.getElementById('ov-loading').style.display = 'none';
    document.getElementById('ov-err').style.display = 'block';
    document.getElementById('ov-errmsg').textContent = e.message + ' — verify n8n webhook URL in DVP_CONFIG';
  }
}

// ═══════════════════════════════════════════════════════════════
// REQUIREMENT MAPPING ENGINE
// ═══════════════════════════════════════════════════════════════

// Master requirements database — auto-generated from engineering targets
const REQ_CATEGORIES = {
