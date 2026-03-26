// ── initApp: called ONLY after successful login ──
// Must not auto-run — auth gate controls when this fires.
window._appInitDone = false;
window.initApp = function() {
  if (window._appInitDone) return; // prevent double-init on session resume
  window._appInitDone = true;

  setTimeout(() => {
    const _safeRun = (label, fn) => {
      try { fn(); }
      catch(e) {
        try { (console.error || console.warn || console.log)('[Init] ' + label + ': ' + e); } catch(_) {}
      }
    };

    // ── STEP 1: Apply chemistry preset to fill default cell V/IR fields ──
    _safeRun('chemPreset', () => chemPreset());

    // ── STEP 2: Restore saved project (if exists) ──
    const hadSave = loadProject();

    // ── STEP 3: Hook persist wrapper onto propagate ──
    window._persistHooked = false; // ensure fresh wrap each login
    _safeRun('hookPersist', () => hookPersist());

    // ── STEP 4: Mark derived fields as read-only (visual + interaction lock) ──
    _safeRun('markDerivedFields', () => markDerivedFields());

    // ── STEP 5: Propagate everything ──
    _safeRun('propagate', () => propagate());
    _safeRun('drawPowerMap', () => drawPowerMap());

    // ── STEP 5b: Draw all engineering canvases ──
    setTimeout(() => { try { redrawAll(); } catch(e) {} }, 300);

    // ── STEP 6: Per-tab calculations ──
    _safeRun('calcPrecharge', () => calcPrecharge());
    _safeRun('calcSafety',    () => calcSafety());
    _safeRun('updateGap',     () => updateGap());
    _safeRun('calcBOM',       () => calcBOM());
    _safeRun('calcTCO',       () => calcTCO());

    // ── STEP 7: Delayed renders (need layout to settle) ──
    setTimeout(() => { try { renderStdTable(); } catch(e) {} }, 200);
    setTimeout(() => { try { drawPowerMap();   } catch(e) {} }, 400);

    // ── STEP 8: If no save existed, show vehicle selection prompt ──
    if (!hadSave) {
      setTimeout(() => {
        const banner = document.createElement('div');
        banner.id = '_welcome_banner';
        banner.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:9998;padding:12px 24px;background:var(--bg2);border:1px solid rgba(0,212,170,.4);border-radius:10px;font-size:13px;color:var(--g);font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,.5);display:flex;align-items:center;gap:12px;max-width:90vw';
        banner.innerHTML = `
          <span>👋 First time?</span>
          <span style="font-weight:400;color:var(--text2);font-size:12px">Go to <b>Project Targets</b> → select your vehicle type to load the right defaults for your project.</span>
          <button onclick="document.getElementById('_welcome_banner').remove()" style="background:transparent;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:0 4px;flex-shrink:0">✕</button>
        `;
        document.body.appendChild(banner);
        setTimeout(() => { if(banner.parentNode) banner.remove(); }, 8000);
      }, 1200);
    } else {
      setTimeout(() => {
        try {
          const app = document.getElementById('t_app')?.value;
          if (app) {
            document.querySelectorAll('.app-card').forEach(c =>
              c.classList.toggle('selected', c.dataset.val === app));
            updateSaveIndicator();
          }
        } catch(e) {}
      }, 300);
    }

    // ── STEP 9: QA ──
    _safeRun('QA_AGENT', () => QA_AGENT.run());

    // ── STEP 10: ResizeObserver for power map ──
    try {
      const pmC = document.getElementById('pm_canvas');
      if (pmC && typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => {
          const sec = document.getElementById('powermap');
          if (sec && sec.classList.contains('active')) {
            requestAnimationFrame(drawPowerMap);
          }
        }).observe(pmC);
      }
      window.addEventListener('resize', () => {
        const sec = document.getElementById('powermap');
        if (sec && sec.classList.contains('active')) {
          clearTimeout(window._pmResizeTimer);
          window._pmResizeTimer = setTimeout(drawPowerMap, 100);
        }
      });
    } catch(e) {}

    // ── STEP 11: App fully ready ──
    window._appReady = true;
    window.showSec = showSec;

  }, 300);
};




// ── Functions recovered from original source ──

const GAP_IDS = [
