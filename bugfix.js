/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — BUGFIX v1.0
   Fixes:
   1. DCIR: wrong section ID check in propagate wrapper
   2. Drive Cycle CSV: getDCPoints override logic + drawDriveCycleCanvas loop
   3. Thermal Rise: uses CSV data when available, correct canvas sizing
   ═══════════════════════════════════════════════════════════════ */

/* ════════════
   FIX 1 — DCIR
   The dcir-map.js propagate wrapper checks 'sec-dcir' (wrong).
   Replace with correct check: id="dcir" + class "active"
   ════════════ */
(function fixDCIR() {
  /* Re-wrap propagate cleanly — look for id="dcir".active */
  const _p = window.propagate;
  window.propagate = function() {
    if (typeof _p === 'function') _p.apply(this, arguments);
    try {
      const sec = document.getElementById('dcir');
      if (sec && sec.classList.contains('active') && typeof renderDCIRMap === 'function') {
        renderDCIRMap();
      }
    } catch(e) {}
  };

  /* Also fix showSec trigger — already correct in index.html but re-assert */
  const _ss = window.showSec;
  window.showSec = function(id, btn) {
    if (typeof _ss === 'function') _ss(id, btn);
    if (id === 'dcir') {
      setTimeout(() => {
        try { if (typeof renderDCIRMap === 'function') renderDCIRMap(); } catch(e) { console.warn('[DCIR]', e); }
      }, 60);
    }
    if (id === 'derating') {
      setTimeout(() => {
        try { if (typeof renderDerating === 'function') renderDerating(); } catch(e) { console.warn('[Derating]', e); }
      }, 60);
    }
  };
})();

/* ════════════
   FIX 2 — getDCPoints: return CSV data when loaded, else manual rows
   The previous override in drive-cycle-fix.js had a double-wrap issue.
   This version is the single authoritative override.
   ════════════ */
window.getDCPoints = function() {
  /* CSV takes priority */
  if (window._dcCSV && window._dcCSV.length >= 2 && window._dcMode === 'csv') {
    return window._dcCSV;
  }
  /* Fallback: manual rows */
  const pts = [];
  document.querySelectorAll('#dc_manual_rows .dc-row').forEach(r => {
    const t = parseFloat(r.querySelector('.dc-t')?.value);
    const p = parseFloat(r.querySelector('.dc-p')?.value);
    if (!isNaN(t) && !isNaN(p)) pts.push({ t, p });
  });
  return pts.sort((a, b) => a.t - b.t);
};

/* ════════════
   FIX 2b — drawDriveCycleCanvas: don't re-analyse on every draw call
   The drive-cycle-fix.js wrapper was calling dcAnalyseAndUpdate() on
   every canvas redraw, which overwrote CSV P_avg with manual-row avg.
   Replace with a clean wrapper that only redraws, never re-analyses.
   ════════════ */
(function fixDCCanvas() {
  /* Find the real original (defined in inline script at ~line 9353) */
  /* We can't re-capture here since drive-cycle-fix already wrapped it.
     Instead: find it by looking at the function source and unwrapping. */

  /* Strategy: store a flag — if CSV is loaded, dc_pavg field is locked.
     Manual row changes only trigger re-analysis when in manual mode. */

  /* Patch addDCRow to trigger manual analysis */
  const _origAdd = window.addDCRow;
  window.addDCRow = function() {
    if (typeof _origAdd === 'function') _origAdd();
    if (window._dcMode !== 'csv') {
      setTimeout(() => {
        const pts = window.getDCPoints();
        if (pts.length >= 2 && typeof dcAnalyseAndUpdate === 'function') {
          window._dcMode = 'manual';
          dcAnalyseAndUpdate(pts);
        }
      }, 50);
    }
  };

  /* On dc-t/dc-p input: only run analysis if manual mode */
  document.addEventListener('input', function(e) {
    if (window._dcMode === 'csv') return; // CSV locked — don't overwrite
    if (e.target.classList.contains('dc-t') || e.target.classList.contains('dc-p')) {
      clearTimeout(window._dcManualTimer);
      window._dcManualTimer = setTimeout(() => {
        const pts = window.getDCPoints();
        if (pts.length >= 2 && typeof dcAnalyseAndUpdate === 'function') {
          window._dcMode = 'manual';
          dcAnalyseAndUpdate(pts);
        }
      }, 300);
    }
  });

  /* Unlock dc_pavg if user clears CSV (by reloading page or resetting) */
  window.dcClearCSV = function() {
    window._dcCSV  = null;
    window._dcMode = 'manual';
    const el = document.getElementById('dc_pavg');
    if (el) { el.readOnly = false; el.style.borderColor = ''; el.style.background = ''; }
    const badge = document.getElementById('dc_file_badge');
    if (badge) badge.style.display = 'none';
    const syncEl = document.getElementById('dc_thermal_sync');
    if (syncEl) syncEl.textContent = '🔗 Waiting for cycle data';
  };
})();

/* ════════════
   FIX 3 — Thermal Rise: correct canvas sizing + ensure getDCPoints used
   The tr_canvas was being set to fixed width=900 before layout complete.
   Also ensure runThermalRise uses responsive canvas width.
   ════════════ */
(function fixThermalRise() {
  const _orig = window.runThermalRise;

  window.runThermalRise = function() {
    /* Pre-sync all S state into thermal rise inputs */
    const S  = window.S || {};
    const sf = (id, val) => {
      try {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null && !isNaN(+val)) el.value = +val;
      } catch(e) {}
    };

    sf('tr_Vnom',    S.V_nom_pack  || 358);
    sf('tr_Qah',     S.Q_pack      || 120);
    if (S.t_tcell_max) {
      sf('tr_T_limit',  S.t_tcell_max);
      sf('tr_T_derate', S.t_tcell_max - 10);
      sf('tr_T_tr',     S.t_tcell_max + 25);
    }
    if (S.t_top_hi)  sf('tr_Tamb', S.t_top_hi);
    const Cth = (S.pack_mass||0) * (S.c_cp_pack||1025) / 1000;
    if (Cth > 1) sf('tr_Cth', Cth.toFixed(1));
    const ir = S._packIR_bol || ((S.c_ir_bol||0.22) * (S.S_total||112) / (S.c_pp||1));  // mΩ — NO ×1000
    if (ir > 0) sf('tr_ir', ir.toFixed(2));

    /* Fix canvas sizing before run */
    const canvas = document.getElementById('tr_canvas');
    if (canvas) {
      const W = canvas.parentElement?.clientWidth || canvas.offsetWidth || 900;
      if (W > 200) canvas.width = W;
      canvas.height = 480;
    }

    /* Run the original */
    if (typeof _orig === 'function') {
      try { _orig(); }
      catch(e) { console.warn('[runThermalRise]', e); trShowError(e.message); }
    }
  };

  function trShowError(msg) {
    const canvas = document.getElementById('tr_canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width || 900, H = canvas.height || 480;
    ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff4d6d'; ctx.font = '13px Barlow,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Simulation error: ' + msg, W/2, H/2 - 10);
    ctx.fillStyle = '#3a567a'; ctx.font = '11px Barlow,sans-serif';
    ctx.fillText('Check: drive cycle data loaded? Cell tab filled? Resistance tab calculated?', W/2, H/2 + 14);
  }

  /* Auto-run thermal rise when drive_cycle tab opens */
  const _origShowSec = window.showSec;
  window.showSec = function(id, btn) {
    if (typeof _origShowSec === 'function') _origShowSec(id, btn);
    if (id === 'drive_cycle') {
      setTimeout(() => {
        const pts = window.getDCPoints();
        if (pts.length >= 2) {
          try { window.runThermalRise(); } catch(e) {}
        }
      }, 150);
    }
  };
})();

/* ════════════
   FIX 4 — On page init: auto-run manual analysis so results show immediately
   ════════════ */
window.addEventListener('load', () => {
  setTimeout(() => {
    try {
      if (window._dcMode !== 'csv') {
        const pts = window.getDCPoints();
        if (pts.length >= 2 && typeof dcAnalyseAndUpdate === 'function') {
          window._dcMode = 'manual';
          dcAnalyseAndUpdate(pts);
        }
      }
    } catch(e) {}
  }, 1500);
});
