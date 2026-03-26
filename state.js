const VEH_PRESETS = {
  Excavator: {
    label:'🏗️ Excavator', markets:'EU, JP, CA, USA',
    t_emin:35, t_emax:80, t_eu_min:30, t_auto:4,
    t_vmin_sys:250, t_vmax_sys:560, t_ppeak:80, t_pcont:50,
    t_pac:22, t_pdc:60, t_cchg:0.5,
    t_cycles:3000, t_soh_eol:80, t_soh5:90, t_soh10:80,
    t_years:10, t_days_yr:200, t_cycles_day:1.0,
    t_top_lo:-20, t_top_hi:45, t_tcell_max:55, t_alt:3000,
    t_cost:130,
    c_chem:'LFP', c_ah:120, c_cps:14, c_ss:8, c_pp:1,
    lc_pavg:12, note:'Off-highway — liquid cooled, IEC 62923, BATSO 01/02'
  },
  WheelLoader: {
    label:'🚜 Wheel Loader', markets:'EU, JP, CA, USA',
    t_emin:40, t_emax:100, t_eu_min:35, t_auto:5,
    t_vmin_sys:300, t_vmax_sys:600, t_ppeak:100, t_pcont:65,
    t_pac:22, t_pdc:80, t_cchg:0.5,
    t_cycles:3000, t_soh_eol:80, t_soh5:90, t_soh10:80,
    t_years:10, t_days_yr:250, t_cycles_day:1.0,
    t_top_lo:-25, t_top_hi:50, t_tcell_max:55, t_alt:2000,
    t_cost:125,
    c_chem:'LFP', c_ah:180, c_cps:16, c_ss:8, c_pp:1,
    lc_pavg:18, note:'Off-highway — high power, liquid cooled'
  },
  AgTractor: {
    label:'🌾 Agricultural Tractor', markets:'EU, IN, CA, USA',
    t_emin:25, t_emax:60, t_eu_min:20, t_auto:6,
    t_vmin_sys:200, t_vmax_sys:500, t_ppeak:60, t_pcont:40,
    t_pac:11, t_pdc:50, t_cchg:0.5,
    t_cycles:2000, t_soh_eol:80, t_soh5:88, t_soh10:80,
    t_years:10, t_days_yr:150, t_cycles_day:1.0,
    t_top_lo:-15, t_top_hi:50, t_tcell_max:55, t_alt:3000,
    t_cost:110,
    c_chem:'LFP', c_ah:100, c_cps:12, c_ss:8, c_pp:1,
    lc_pavg:8, note:'Agriculture — seasonal use, PTO + traction'
  },
  '2W': {
    label:'🛵 2-Wheeler', markets:'EU, IN, JP, KR',
    t_emin:2, t_emax:10, t_eu_min:1.5, t_auto:2,
    t_vmin_sys:40, t_vmax_sys:96, t_ppeak:10, t_pcont:5,
    t_pac:3.3, t_pdc:0, t_cchg:1.0,
    t_cycles:1500, t_soh_eol:80, t_soh5:85, t_soh10:80,
    t_years:5, t_days_yr:300, t_cycles_day:1.0,
    t_top_lo:-10, t_top_hi:45, t_tcell_max:55, t_alt:2000,
    t_cost:200,
    c_chem:'NMC', c_ah:30, c_cps:13, c_ss:2, c_pp:2,
    lc_pavg:2, note:'Light EV — EN 15194, UL 2271, AIS-156'
  },
  '4W': {
    label:'🚗 Passenger Car', markets:'EU, IN, JP, KR, CA, USA',
    t_emin:50, t_emax:100, t_eu_min:45, t_auto:5,
    t_vmin_sys:300, t_vmax_sys:800, t_ppeak:150, t_pcont:80,
    t_pac:22, t_pdc:150, t_cchg:0.3,
    t_cycles:2000, t_soh_eol:80, t_soh5:90, t_soh10:80,
    t_years:8, t_days_yr:365, t_cycles_day:0.5,
    t_top_lo:-30, t_top_hi:50, t_tcell_max:45, t_alt:2000,
    t_cost:120,
    c_chem:'NMC', c_ah:60, c_cps:96, c_ss:1, c_pp:1,
    lc_pavg:15, note:'Passenger EV — UNECE R100, ISO 26262'
  },
  Bus: {
    label:'🚌 City Bus', markets:'EU, IN, JP, CA, USA',
    t_emin:150, t_emax:400, t_eu_min:130, t_auto:8,
    t_vmin_sys:400, t_vmax_sys:800, t_ppeak:300, t_pcont:160,
    t_pac:50, t_pdc:150, t_cchg:0.3,
    t_cycles:3000, t_soh_eol:80, t_soh5:90, t_soh10:80,
    t_years:12, t_days_yr:365, t_cycles_day:2.0,
    t_top_lo:-20, t_top_hi:45, t_tcell_max:45, t_alt:1500,
    t_cost:100,
    c_chem:'LFP', c_ah:280, c_cps:128, c_ss:1, c_pp:4,
    lc_pavg:40, note:'Transit bus — UNECE R100, SAE J3105'
  },
  Truck: {
    label:'🚛 Heavy Truck', markets:'EU, CA, USA',
    t_emin:200, t_emax:600, t_eu_min:180, t_auto:4,
    t_vmin_sys:600, t_vmax_sys:900, t_ppeak:400, t_pcont:200,
    t_pac:50, t_pdc:350, t_cchg:0.3,
    t_cycles:2000, t_soh_eol:80, t_soh5:88, t_soh10:80,
    t_years:10, t_days_yr:300, t_cycles_day:1.5,
    t_top_lo:-30, t_top_hi:50, t_tcell_max:45, t_alt:2000,
    t_cost:90,
    c_chem:'LFP', c_ah:280, c_cps:192, c_ss:1, c_pp:4,
    lc_pavg:60, note:'HGV — SAE J2910, FMVSS 305'
  },
  Industrial: {
    label:'🏭 Industrial / Forklift', markets:'EU, IN, JP, KR, CA, USA',
    t_emin:15, t_emax:60, t_eu_min:12, t_auto:6,
    t_vmin_sys:48, t_vmax_sys:96, t_ppeak:30, t_pcont:15,
    t_pac:10, t_pdc:30, t_cchg:0.5,
    t_cycles:2000, t_soh_eol:80, t_soh5:88, t_soh10:80,
    t_years:7, t_days_yr:250, t_cycles_day:2.0,
    t_top_lo:-10, t_top_hi:40, t_tcell_max:55, t_alt:1000,
    t_cost:150,
    c_chem:'LFP', c_ah:200, c_cps:15, c_ss:4, c_pp:1,
    lc_pavg:5, note:'Forklift/AGV — EN 1175, UL 2271, IEC 62619'
  },
  Other: {
    label:'⚙️ Other / Custom', markets:'EU, JP',
    t_emin:10, t_emax:100, t_eu_min:8, t_auto:4,
    t_vmin_sys:100, t_vmax_sys:500, t_ppeak:50, t_pcont:25,
    t_pac:22, t_pdc:50, t_cchg:0.5,
    t_cycles:2000, t_soh_eol:80, t_soh5:88, t_soh10:80,
    t_years:8, t_days_yr:200, t_cycles_day:1.0,
    t_top_lo:-20, t_top_hi:45, t_tcell_max:55, t_alt:2000,
    t_cost:130,
    c_chem:'LFP', c_ah:100, c_cps:14, c_ss:8, c_pp:1,
    lc_pavg:10, note:'Custom — set all targets manually'
  },
};

// ═══════════════════════════════════════════════════════
// PERSISTENCE ENGINE — auto-save & restore via localStorage
// Key: 'battmis_v1'. Saved on every propagate(). Restored on load.
// Manual reset clears storage and reloads defaults.
// ═══════════════════════════════════════════════════════
const PERSIST_KEY = 'battmis_v1';

// All SOURCE input IDs (the origin fields — the only ones the user edits directly)
const SOURCE_FIELD_IDS = [
  // Project Targets
  't_proj','t_app','t_markets','t_emin','t_emax','t_eu_min','t_auto','t_cost',
  't_vmin_sys','t_vmax_sys','t_ppeak','t_pcont','t_pac','t_pdc','t_cchg',
  't_tchg_lo','t_tchg_hi','t_cycles','t_soh_eol','t_soh5','t_soh10',
  't_years','t_days_yr','t_cycles_day','t_top_lo','t_top_hi',
  't_tcell_max','t_tgrad','t_alt','t_ged','t_sop','t_ip','t_cooling',
  // Cell Inputs
  'c_chem','c_vnom','c_vmax','c_vmin','c_ah','c_mass','c_ir_bol','c_ir_eol',
  'c_cp','c_cps','c_ss','c_pp','c_housing_mass','c_cp_pack',
  'c_ocv10','c_ocv50','c_ocv90','c_ocv100',
  // Thermal manual inputs
  'th_amb','th_ir_bol',
  // Lifecycle
  'lc_pavg','lc_hpc','lc_soc_store','lc_tstore','lc_regen_frac','lc_regen_eff',
  // Precharge
  'pc_C','pc_t','pc_n','pc_alpha','pc_Imax','pc_Ileak','pc_Rs','pc_Icont','pc_margin',
  // Busbar
  'bb_L','bb_W','bb_T','bb_mat','bb_dt','bb_creep_actual','bb_clear_actual',
  'bb_pd','bb_ovc','bb_cooling',
  // Drive cycle manual
  'dc_pavg','dc_ppeak','dc_dur','dc_cycles',
  // BMS manual
  'bms_tsensor','bms_v_acc','bms_t_acc','bms_i_acc','bms_imd',
  'bms_soc_algo','bms_soc_acc','bms_soh_algo','bms_soh_acc',
  'bms_sop_algo','bms_bal','bms_bal_thresh','bms_proto','bms_can_speed',
  'bms_diag','bms_ota','bms_log','bms_passport',
];

// Fields that are DERIVED (pushed by propagate) — shown read-only with origin indicator
const DERIVED_FIELD_IDS = [
  'chg_qah','chg_S','chg_v10','chg_v90','chg_pac','chg_pdc','chg_eu',
  'lc_nc','lc_eol','lc_s5','lc_s10','lc_years','lc_days','lc_cpd','lc_eu',
  'v_cvnom','v_cvmax','v_cvmin','v_cps','v_pp','v_sysmin','v_sysmax',
  'e_gross',
  'pc_Vbat','pc_Vlo',
  'sf_v','sf_id','sf_ip',
  'res_S','res_P',
  'pm_vmin','pm_vmax','pm_pcont','pm_ppeak','pm_pchg','pm_pdc','pm_Imax',
  'bb_V','bb_I',
  'bms_ov','bms_uv','bms_ot_d','bms_ut_d','bms_icc','bms_vcv','bms_ico','bms_v_range',
  'curr_vnom','curr_qah',
];

function saveProject() {
  try {
    const data = { v: 1, ts: Date.now() };
    SOURCE_FIELD_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      data[id] = el.type === 'checkbox' ? el.checked : el.value;
    });
    localStorage.setItem(PERSIST_KEY, JSON.stringify(data));
  } catch(e) {}
}

function loadProject() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return false;
    SOURCE_FIELD_IDS.forEach(id => {
      if (data[id] === undefined) return;
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!data[id];
      else el.value = data[id];
    });
    // Restore vehicle selection highlight
    const app = data['t_app'];
    if (app) {
      document.querySelectorAll('.app-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.val === app);
      });
      S.app = app;
    }
    return true;
  } catch(e) { return false; }
}

function resetProject() {
  if (!confirm('⚠️ Reset ALL inputs to default values?\n\nThis will clear all your targets, cell data, and settings. This cannot be undone.')) return;
  try { localStorage.removeItem(PERSIST_KEY); } catch(e) {}
  // Reload page to restore HTML defaults
  window.location.reload();
}

function applyVehiclePreset(vehicleType) {
  const p = VEH_PRESETS[vehicleType];
  if (!p) return;
  const sf = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  // Apply to Project Targets
  sf('t_markets',    p.markets);
  sf('t_emin',       p.t_emin);
  sf('t_emax',       p.t_emax);
  sf('t_eu_min',     p.t_eu_min);
  sf('t_auto',       p.t_auto);
  sf('t_vmin_sys',   p.t_vmin_sys);
  sf('t_vmax_sys',   p.t_vmax_sys);
  sf('t_ppeak',      p.t_ppeak);
  sf('t_pcont',      p.t_pcont);
  sf('t_pac',        p.t_pac);
  sf('t_pdc',        p.t_pdc);
  sf('t_cchg',       p.t_cchg);
  sf('t_cycles',     p.t_cycles);
  sf('t_soh_eol',    p.t_soh_eol);
  sf('t_soh5',       p.t_soh5);
  sf('t_soh10',      p.t_soh10);
  sf('t_years',      p.t_years);
  sf('t_days_yr',    p.t_days_yr);
  sf('t_cycles_day', p.t_cycles_day);
  sf('t_top_lo',     p.t_top_lo);
  sf('t_top_hi',     p.t_top_hi);
  sf('t_tcell_max',  p.t_tcell_max);
  sf('t_cost',       p.t_cost);
  sf('t_app',        vehicleType);
  // Apply to Cell
  sf('c_chem',  p.c_chem);
  sf('c_ah',    p.c_ah);
  sf('c_cps',   p.c_cps);
  sf('c_ss',    p.c_ss);
  sf('c_pp',    p.c_pp);
  // Apply lifecycle P_avg
  sf('lc_pavg', p.lc_pavg);
  // Run chem preset to fill cell V/IR values
  const chemEl = document.getElementById('c_chem');
  if (chemEl) chemEl.value = p.c_chem;
  if (typeof chemPreset === 'function') chemPreset();
  // Propagate everything
  S.app = vehicleType;
  if (typeof propagate === 'function') propagate();
  // Show toast notification
  showVehicleToast(p.label);
}

function showVehicleToast(label) {
  let t = document.getElementById('_veh_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_veh_toast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;background:var(--bg2);border:1px solid rgba(0,212,170,.4);border-radius:10px;font-size:13px;font-weight:600;color:var(--g);box-shadow:0 8px 32px rgba(0,0,0,.4);transition:opacity .3s;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = `✓ Vehicle preset applied: ${label}`;
  t.style.opacity = '1';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

// ── Make derived fields visually read-only but don't use HTML readonly ──
// (so setField() can still write to them from propagate)
function markDerivedFields() {
  DERIVED_FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // Style as read-only without blocking programmatic writes
    el.style.cssText = (el.style.cssText || '') +
      ';background:rgba(74,158,255,.06) !important;border-color:rgba(74,158,255,.2) !important;color:var(--b) !important;cursor:default';
    el.title = '⬅ Derived automatically from source tabs — edit in origin tab';
    // Prevent user typing (but allow programmatic setting)
    el.addEventListener('keydown', (e) => { e.preventDefault(); }, true);
    el.addEventListener('focus',   () => {
      // Flash brief tooltip
      el.style.boxShadow = '0 0 0 2px rgba(74,158,255,.3)';
      setTimeout(() => { el.style.boxShadow = ''; }, 1200);
    });
  });
}

// ── Auto-save: hook into propagate so every recalc saves ──
// Wrap is deferred until propagate() is defined (see below)
window._persistHooked = false;
window._propagateBase = null; // stores the unwrapped original
function hookPersist() {
  if (typeof propagate !== 'function') return;
  // Always wrap from the stored base to prevent double-wrapping
  if (!window._propagateBase) window._propagateBase = propagate;
  const _base = window._propagateBase;
  window.propagate = function() {
    if (window._propagating) return;
    window._propagating = true;
    try { _base.apply(this, arguments); } catch(e) { console.log('[propagate] '+e); }
    finally { window._propagating = false; }
    try { saveProject(); } catch(e) {}
    try { updateSaveIndicator(); } catch(e) {}
  };
  propagate = window.propagate;
  window._persistHooked = true;
}

function updateSaveIndicator() {
  const el = document.getElementById('_save_badge');
  if (!el) return;
  const d = new Date();
  el.textContent = 'Saved ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0') + ':' + d.getSeconds().toString().padStart(2,'0');
  el.style.opacity = '1';
  clearTimeout(window._saveBadgeTimer);
  window._saveBadgeTimer = setTimeout(() => { el.style.opacity = '0.5'; }, 3000);
}


// ═══════════════════════════════════════════════════════
// GLOBAL STATE — Single source of truth, all tabs read from here
// ═══════════════════════════════════════════════════════
const S = {
  // From Project Targets
  app:'offhighway', proj:'PRJ-001', markets:'EU, US, JP',
  t_emin:40, t_emax:60, t_eu_min:35, t_auto:4, t_cost:130,
  t_vmin_sys:250, t_vmax_sys:500, t_ppeak:80, t_pcont:50,
  t_cchg:0.5, t_pac:22, t_pdc:60, t_tchg_lo:-15, t_tchg_hi:45,
  t_cycles:3000, t_soh_eol:80, t_years:10, t_soh5:90, t_soh10:80,
  t_days_yr:200, t_cycles_day:1.0, t_top_lo:-20, t_top_hi:45,
  t_tcell_max:55, t_tgrad:5, t_alt:3000, t_ged:200,
  // From Cell Inputs
  c_chem:'LFP', c_vnom:3.2, c_vmax:3.65, c_vmin:2.0,
  c_ah:120, c_mass:2800, c_ir_bol:0.22, c_ir_eol:0.35, c_cp:1050,
  c_cps:14, c_ss:8, c_pp:1, c_housing_mass:50, c_cp_pack:1025,
  c_ocv10:3.22, c_ocv50:3.28, c_ocv90:3.35, c_ocv100:3.45,
  // Derived
  S_total:112, V_nom_pack:358.4, V_max_pack:408.8, V_min_pack:224,
  E_gross:43.0, E_usable:38.0, Q_pack:120,
};

// ═══════════════════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// PROPAGATE — reads all inputs, updates S, calls all calcs
// ═══════════════════════════════════════════════════════
function propagate() {
  try {
  const g = id => { const el=document.getElementById(id); if(!el) return null; return isNaN(+el.value) ? el.value : +el.value; };

  // ── Read Project Targets ──
  S.app         = g('t_app')       || S.app;
  S.t_emin      = g('t_emin')      ?? S.t_emin;
  S.t_emax      = g('t_emax')      ?? S.t_emax;
  S.t_eu_min    = g('t_eu_min')    ?? S.t_eu_min;
  S.t_auto      = g('t_auto')      ?? S.t_auto;
  S.t_cost      = g('t_cost')      ?? S.t_cost;
  S.t_vmin_sys  = g('t_vmin_sys')  ?? S.t_vmin_sys;
  S.t_vmax_sys  = g('t_vmax_sys')  ?? S.t_vmax_sys;
  S.t_ppeak     = g('t_ppeak')     ?? S.t_ppeak;
  S.t_pcont     = g('t_pcont')     ?? S.t_pcont;
  S.t_pac       = g('t_pac')       ?? S.t_pac;
  S.t_pdc       = g('t_pdc')       ?? S.t_pdc;
  S.t_cchg      = g('t_cchg')      ?? S.t_cchg;
  S.t_tchg_lo   = g('t_tchg_lo')   ?? S.t_tchg_lo;
  S.t_tchg_hi   = g('t_tchg_hi')   ?? S.t_tchg_hi;
  S.t_imax_chg  = g('t_imax_chg')  ?? (S.t_imax_chg || 120);
  S.t_dod       = g('t_dod')       ?? (S.t_dod || 1.0);
  S.t_cycles    = g('t_cycles')    ?? S.t_cycles;
  S.t_soh_eol   = g('t_soh_eol')   ?? S.t_soh_eol;
  S.t_years     = g('t_years')     ?? S.t_years;
  S.t_soh5      = g('t_soh5')      ?? S.t_soh5;
  S.t_soh10     = g('t_soh10')     ?? S.t_soh10;
  S.t_days_yr   = g('t_days_yr')   ?? S.t_days_yr;
  S.t_cycles_day= g('t_cycles_day')?? S.t_cycles_day;
  S.t_top_lo    = g('t_top_lo')    ?? S.t_top_lo;
  S.t_top_hi    = g('t_top_hi')    ?? S.t_top_hi;
  S.t_tcell_max = g('t_tcell_max') ?? S.t_tcell_max;
  S.t_tgrad     = g('t_tgrad')     ?? S.t_tgrad;
  S.t_ged       = g('t_ged')       ?? S.t_ged;
  S.t_alt       = g('t_alt')       ?? S.t_alt;
  S.markets     = g('t_markets')   || S.markets;

  // ── Read Cell Inputs ──
  S.c_chem        = g('c_chem')        || S.c_chem;
  S.c_vnom        = g('c_vnom')        || S.c_vnom;
  S.c_vmax        = g('c_vmax')        || S.c_vmax;
  S.c_vmin        = g('c_vmin')        || S.c_vmin;
  S.c_ah          = g('c_ah')          || S.c_ah;
  S.c_mass        = g('c_mass')        || S.c_mass;
  S.c_ir_bol      = g('c_ir_bol')      || S.c_ir_bol;
  S.c_ir_eol      = g('c_ir_eol')      || S.c_ir_eol;
  S.c_cp          = g('c_cp')          || S.c_cp;
  S.c_cps         = g('c_cps')         || S.c_cps;
  S.c_ss          = g('c_ss')          || S.c_ss;
  S.c_pp          = g('c_pp')          || S.c_pp;
  S.c_housing_mass= g('c_housing_mass')|| S.c_housing_mass;
  S.c_cp_pack     = g('c_cp_pack')     || S.c_cp_pack;
  S.c_ocv10       = g('c_ocv10')       || S.c_ocv10;
  S.c_ocv50       = g('c_ocv50')       || S.c_ocv50;
  S.c_ocv90       = g('c_ocv90')       || S.c_ocv90;
  S.c_ocv100      = g('c_ocv100')      || S.c_ocv100;
  // Also pull from OCV table (25°C column) if available — more accurate source
  try {
    const ocvPts = typeof getOCVPoints === 'function' ? getOCVPoints() : [];
    if (ocvPts.length >= 2) {
      const closest = (arr, tgt) => arr.reduce((a,b) => Math.abs(b.soc-tgt)<Math.abs(a.soc-tgt)?b:a);
      const p10=closest(ocvPts,10), p50=closest(ocvPts,50), p90=closest(ocvPts,90), p100=closest(ocvPts,100);
      if (p10.t25>0) { S.c_ocv10=p10.t25; setField('c_ocv10', p10.t25.toFixed(3)); }
      if (p50.t25>0) { S.c_ocv50=p50.t25; setField('c_ocv50', p50.t25.toFixed(3)); }
      if (p90.t25>0) { S.c_ocv90=p90.t25; setField('c_ocv90', p90.t25.toFixed(3)); }
      if (p100.t25>0){ S.c_ocv100=p100.t25; setField('c_ocv100', p100.t25.toFixed(3)); }
    }
  } catch(e) {}

  // ── Derive pack values ──
  S.S_total     = S.c_cps * S.c_ss;
  S.Q_pack      = S.c_ah  * S.c_pp;
  S.V_nom_pack  = S.S_total * S.c_vnom;
  S.V_max_pack  = S.S_total * S.c_vmax;
  S.V_min_pack  = S.S_total * S.c_vmin;
  S.E_gross     = (S.c_vnom * S.c_ah * S.S_total * S.c_pp) / 1000;
  S.pack_mass   = (S.c_cps * S.c_ss * S.c_pp * S.c_mass / 1000) + S.c_housing_mass;
  S.E_usable    = S.E_gross * 0.941; // refreshed by calcEnergy later

  // ── Push derived cell/pack values → ALL tabs that need them ──
  // Current & Power
  setField('curr_vnom', S.V_nom_pack.toFixed(1));
  setField('curr_qah',  S.Q_pack.toFixed(0));
  // Charging
  setField('chg_qah',  S.Q_pack.toFixed(0));
  setField('chg_S',    S.S_total.toFixed(0));
  setField('chg_v10',  S.c_ocv10.toFixed(2));
  setField('chg_v90',  S.c_ocv90.toFixed(2));
  setField('chg_pac',  S.t_pac.toFixed(0));
  setField('chg_pdc',  S.t_pdc.toFixed(0));
  setField('chg_imax', S.t_imax_chg.toFixed(0));
  setField('e_dod',    S.t_dod.toFixed(2));
  setField('ocv_dod',  S.t_dod.toFixed(2));
  // Voltage
  setField('v_cvnom',  S.c_vnom.toFixed(2));
  setField('v_cvmax',  S.c_vmax.toFixed(2));
  setField('v_cvmin',  S.c_vmin.toFixed(2));
  setField('v_cps',    S.c_cps.toFixed(0));
  setField('v_pp',     S.c_pp.toFixed(0));
  setField('v_sysmin', S.t_vmin_sys.toFixed(0));
  setField('v_sysmax', S.t_vmax_sys.toFixed(0));
  // Energy
  setField('e_gross',  S.E_gross.toFixed(2));
  // Lifecycle (targets)
  setField('lc_nc',    S.t_cycles.toFixed(0));
  setField('lc_eol',   S.t_soh_eol.toFixed(0));
  setField('lc_s5',    S.t_soh5.toFixed(0));
  setField('lc_s10',   S.t_soh10 ? S.t_soh10.toFixed(0) : S.t_soh_eol.toFixed(0));
  setField('lc_years', S.t_years.toFixed(0));
  setField('lc_days',  S.t_days_yr.toFixed(0));
  setField('lc_cpd',   S.t_cycles_day.toFixed(1));
  setField('lc_eu',    S.E_usable.toFixed(2));
  // Thermal
  setField('th_pmass', S.pack_mass.toFixed(0));
  setField('th_cppack',S.c_cp_pack.toFixed(0));
  setField('th_I',     (S._I_bat || (S.t_pcont*1000/S.V_nom_pack)).toFixed(1));
  // Precharge
  setField('pc_Vbat',  S.V_nom_pack.toFixed(0));
  setField('pc_Vlo',   S.t_vmin_sys.toFixed(0));
  // Safety
  setField('sf_v',     S.V_nom_pack.toFixed(0));
  setField('sf_id',    (S.t_pcont*1000/S.V_nom_pack).toFixed(0));
  setField('sf_ip',    (S.t_ppeak*1000/S.V_nom_pack).toFixed(0));
  // Resistance
  setField('res_S',    S.S_total.toFixed(0));
  setField('res_P',    S.c_pp.toFixed(0));
  // Power map
  setField('pm_vmin',  S.t_vmin_sys.toFixed(0));
  setField('pm_vmax',  S.t_vmax_sys.toFixed(0));
  setField('pm_vnom',  S.V_nom_pack.toFixed(0));
  setField('pm_Imax',  (S.t_ppeak*1000/S.t_vmin_sys).toFixed(0));
  setField('pm_target_cont', S.t_pcont.toFixed(0));
  setField('pm_target_peak', S.t_ppeak.toFixed(0));
  // Sync power mode rows by index: 0=cont, 1=peak, 2=dc, 3=ac
  const _pmVals = document.querySelectorAll('#pm_mode_rows .pm-val');
  if (_pmVals[0] && document.activeElement !== _pmVals[0]) _pmVals[0].value = S.t_pcont.toFixed(0);
  if (_pmVals[1] && document.activeElement !== _pmVals[1]) _pmVals[1].value = S.t_ppeak.toFixed(0);
  if (_pmVals[2] && document.activeElement !== _pmVals[2]) _pmVals[2].value = S.t_pdc.toFixed(0);
  if (_pmVals[3] && document.activeElement !== _pmVals[3]) _pmVals[3].value = S.t_pac.toFixed(0);
  // BMS — fault thresholds from cell limits
  setField('bms_ov',      (S.c_vmax).toFixed(3));
  setField('bms_uv',      (S.c_vmin + 0.5).toFixed(2));
  setField('bms_ot_d',    S.t_tcell_max.toFixed(0));
  setField('bms_ut_d',    S.t_top_lo.toFixed(0));
  setField('bms_icc',     (S.Q_pack).toFixed(0));    // 1C
  setField('bms_vcv',     S.V_max_pack.toFixed(1));
  setField('bms_ico',     (S.Q_pack*0.1).toFixed(0));// C/10
  // BMS cell voltage range = V_max - V_min (operating window)
  setField('bms_v_range', (S.c_vmax - S.c_vmin).toFixed(2));
  // Busbar
  setField('bb_V',     S.V_nom_pack.toFixed(0));
  setField('bb_I',     (S.t_pcont*1000/S.V_nom_pack).toFixed(0));
  // Gap analysis mirrors
  setField('gap_ir_bol',  S.c_ir_bol.toFixed(3));
  setField('gap_ir_eol',  S.c_ir_eol.toFixed(3));
  setField('gap_ocv10',   S.c_ocv10.toFixed(2));
  setField('gap_ocv90',   S.c_ocv90.toFixed(2));
  setField('gap_ov',      S.c_vmax.toFixed(3));
  setField('gap_uv',      (S.c_vmin+0.5).toFixed(2));
  setField('gap_ot',      S.t_tcell_max.toFixed(0));
  setField('gap_oc',      (S.t_ppeak*1000/S.V_nom_pack*1.1).toFixed(0));

  // ── Run all tab calculations ──
  // FIX: Each calc is individually guarded — one failure never stops the cascade
  const _run = (fn) => { try { fn(); } catch(e) { try{console.log('[propagate] '+e);}catch(_){} } };
  _run(calcCellDerived);
  _run(calcEnergy);
  _run(calcVoltage);
  _run(calcCurrent);
  _run(calcThermal);
  if (typeof calcHeater === 'function') _run(calcHeater);
  _run(calcCharge);
  _run(calcLifecycle);
  _run(calcResistance);
  _run(calcPrecharge);
  _run(calcSafety);
  _run(updateTargetsCompliance);
  _run(drawPowerMap);
  _run(updateGap);
  _run(updateCCCV);
  _run(calcBOM);
  _run(calcTCO);

  // ── Header status ──
  const _hstat = document.getElementById('hstat_text');
  if (_hstat) {
    try {
      _hstat.textContent = `${S.E_gross.toFixed(1)} kWh · ${S.S_total}S · ${S.c_chem} · ${S.app}`;
    } catch(e) {}
  }
  } catch(e) { try{console.log('[propagate top] '+e);}catch(_){} }
}

// setField — see guarded version below (injected by persistence system)
// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function ri(label, val, unit, cls='', target='') {
  const targetHtml = target ? `<div class="rtarget">${target}</div>` : '';
  return `<div class="ri ${cls}"><div class="rl">${label}</div><div class="rv">${val}</div><div class="ru">${unit}</div>${targetHtml}</div>`;
}
function setRg(id, items) { const el=document.getElementById(id); if(el) el.innerHTML = items.map(i=>ri(i.l,i.v,i.u,i.c||'',i.t||'')).join(''); }
function getV(id) { const el=document.getElementById(id); return el?+el.value:0; }
function statusClass(val, target, higher_is_better=true, warn_pct=0.1) {
  if (!target) return '';
  const diff = (val-target)/target;
  if (higher_is_better) return diff >= 0 ? 'ok' : diff > -warn_pct ? 'warn' : 'err';
  return diff <= 0 ? 'ok' : diff < warn_pct ? 'warn' : 'err';
}
function tbar(label, val, max, unit, color='var(--g)') {
  const pct = Math.min(100, (val/max)*100);
  return `<div class="tbar"><div class="tl">${label}</div><div class="tbg"><div class="tfill" style="width:${pct}%;background:${color}"></div></div><div class="tv">${val} ${unit}</div></div>`;
}
function tag(text, cls='g') { return `<span class="tag ${cls}">${text}</span>`; }

// ═══════════════════════════════════════════════════════
// CHEMISTRY PRESETS
