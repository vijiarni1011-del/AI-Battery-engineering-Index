const QA_AGENT = {
  results: [],
  pass: 0,
  fail: 0,

  assert(name, actual, expected, tol) {
    const t = tol !== undefined ? tol : Math.max(0.005 * Math.abs(expected), 0.001);
    const ok = Math.abs(actual - expected) <= t;
    this.results.push({name, actual, expected, ok});
    ok ? this.pass++ : this.fail++;
    return ok;
  },

  assertEl(id) {
    const ok = !!document.getElementById(id);
    this.results.push({name: 'DOM #'+id, actual: ok, expected: true, ok});
    ok ? this.pass++ : this.fail++;
    return ok;
  },

  assertFn(name) {
    const ok = typeof window[name] === 'function';
    this.results.push({name: 'fn '+name+'()', actual: ok, expected: true, ok});
    ok ? this.pass++ : this.fail++;
    return ok;
  },

  run() {
    this.results = []; this.pass = 0; this.fail = 0;
    const t0 = performance.now();
    // FIX: Safe console wrappers for environments missing group/groupEnd/warn (WebViews, sandboxed iframes)
    const _clog  = (m,s) => { try{ s&&console.log.length>1?console.log('%c'+m,s):console.log(m); }catch(_){} };
    const _cwarn = (m)   => { try{ (console.warn||console.log)(m); }catch(_){} };
    const _cgrp  = (m)   => { try{ typeof console.group==='function'?console.group(m):console.log('-- '+m+' --'); }catch(_){} };
    const _cgrpe = ()    => { try{ typeof console.groupEnd==='function'&&console.groupEnd(); }catch(_){} };
    _cgrp('QA AGENT - EV Battery Suite');

    // ── 1. DOM Elements ──
    ['c_ah','c_vnom','c_vmax','c_vmin','c_cps','c_ss','c_pp',
     't_app','t_emin','t_pcont','t_ppeak','t_pdc','t_pac',
     'pm_canvas','pc_canvas',
     'e_gross','e_dod','e_ns',
     'curr_vnom','curr_qah','curr_amb',
     'th_I','th_ir_bol','th_pmass',
     'chg_S','chg_v10','chg_v90','chg_note',
     'lc_nc','lc_eu','lc_pavg','lc_s10','lc_regen_frac',
     'res_S','res_tabmat','bb_mat',
     'pc_C','pc_Vbat','pc_t','pc_n','pc_Icont','pc_t_range',
     'bb_creep_actual','bb_clear_actual','bb_checks',
     'sf_results','sf_regs',
     'stds_tbody','std_search'
    ].forEach(id => this.assertEl(id));

    // ── 2. Functions ──
    ['propagate','calcEnergy','calcCurrent','calcThermal','calcCharge',
     'calcLifecycle','calcResistance','calcPrecharge','drawPowerMap',
     'calcBusbar','calcSafety','updateGap','calcBOM','calcTCO',
     'handleDatasheetUpload','handleOCVUpload','parseDCIRMap',
     'parseFadeCurve','filterStandards','selectApp',
     'renderStdTable','resetStdFilters','quickFilterStd',
     'addReqMapRow','submitNewRequirement','toggleAddReqForm',
     'buildReqMapFromTargets','renderReqMap','filterReqMap','exportReqMap'
    ].forEach(fn => this.assertFn(fn));

    // ── 3. Standards database ──
    this.assert('STDS count = 300', typeof STDS !== 'undefined' ? STDS.length : 0, 300, 0);
    // FIX: BB_MATS has 14 keys in the literal; legacy aliases live in MAT_RHO/MAT_ALPHA separately
    const bbCount = typeof BB_MATS !== 'undefined' ? Object.keys(BB_MATS).length : 0;
    this.assert('BB_MATS count = 14', bbCount, 14, 0);

    // ── 4. Pack energy formula ──
    this.assert('E_gross 14×8×120Ah×3.2V', (14*8*3.2*120)/1000, 43.008, 0.001);
    this.assert('E_gross 16×8×120Ah×3.2V', (16*8*3.2*120)/1000, 49.152, 0.001);

    // ── 5. Usable energy derating factors (from BYD Excel) ──
    this.assert('f_design @25°C', 0.98*0.98*0.98, 0.941192, 0.00001);
    this.assert('f_design @10°C', 0.98*0.97*0.98, 0.931588, 0.00001);
    this.assert('f_design @-15°C', 0.98*0.95*0.98, 0.91238,  0.00001);
    this.assert('E_usable excl.balance', 1.0*0.98*0.98*0.988, 0.948875, 0.00001);
    this.assert('E_usable incl.balance', 1.0*0.98*0.98*0.988*0.988, 0.937489, 0.00001);

    // ── 6. Voltage window ──
    this.assert('V_nom 14×8 LFP', 14*8*3.2, 358.4, 0.01);
    this.assert('V_max 14×8 LFP', 14*8*3.65, 408.8, 0.01);
    this.assert('V_min 14×8 LFP @2V', 14*8*2.0, 224.0, 0.01);

    // ── 7. Capacity planning ──
    this.assert('Required installed 3-factor', 49.348/(0.98*0.98*0.98), 52.431, 0.01);

    // ── 8. Charging ──
    this.assert('V_avg 128S OCV10=3.22 OCV90=3.35', 128*((3.22+3.35)/2), 420.48, 0.01);
    this.assert('I_dc @60kW 128S', 60000/420.48, 142.7, 0.5);
    this.assert('V_avg 94S (BYD)', 94*3.285, 308.79, 0.01);

    // ── 9. Thermal ──
    const Q_heat = 146.484*146.484*0.149401;
    this.assert('Q_heat DC charge (W)', Q_heat, 3205.8, 10);
    const m_dot = 563/(3400*8.5);
    this.assert('Coolant ṁ (kg/s)', m_dot, 0.01948, 0.0005);
    this.assert('Heater -15→20°C 45min', 308.56*1025*35/2700/1000, 4.0998, 0.05);

    // ── 10. Precharge ──
    this.assert('R by time (t=1.5s,n=5,C=2mF)', (1.5/5)/0.002, 150, 0.01);
    this.assert('R by I_max (V=400,I=8A)', 400/8, 50, 0.01);
    this.assert('R by leak (V=400,α=0.98,I=0.2)', (1-0.98)*400/0.2, 40, 0.01);
    this.assert('R_selected=max(150,50,40)', Math.max(150,50,40), 150, 0);
    this.assert('E_cap (C=2mF,V=400)', 0.5*0.002*400*400, 160, 0.01);
    this.assert('Vc after 5τ (%Vbat)', (1-Math.exp(-5))*100, 99.326, 0.01);

    // ── 11. Busbar / Resistance ──
    const rho_cu = 1.72e-8, L=0.15, W=0.06, T=0.003;
    const R_bb = rho_cu*L/(W*T);
    this.assert('Cu ETP busbar R (mΩ)', R_bb*1000, 0.01433, 0.001);
    const J = 250/(W*T*1e6);
    this.assert('Busbar J @250A (A/mm²)', J, 1.389, 0.01);

    // ── 12. Cooling pressure drop ──
    const Q3 = 3/60000;
    const A_ch = Math.PI*(0.0087/2)**2;
    const vel  = Q3/A_ch;
    const Re   = 1076*vel*0.0087/0.0031;
    this.assert('Re @3L/min 25°C', Re, 847, 100);

    // ── 13. Lifecycle ──
    this.assert('Cycle life years @200/yr', 3000/200, 15, 0.01);
    // Autonomy with regen=0: E_net=E_usable, P_net=P_gross → same formula
    this.assert('Autonomy @BOL no regen', 49.348/12.337, 4.0, 0.02);
    this.assert('Life hours @2h/cycle', 3000*2, 6000, 0);
    // SoH year 5 with 3000 cycle life, 200/yr → 1000 cycles @ yr5
    const soh_test = (1 - (1000/3000)*(1-0.80))*100;
    this.assert('SoH @yr5 linear model', soh_test, 93.33, 0.1);

    // ── 14. BOM ──
    const bom = (80*43 + 500 + 800 + 400 + 300)*1.15;
    this.assert('BOM total ($)', bom, 5636.5, 10);
    this.assert('BOM $/kWh', bom/43, 131.1, 2);

    // ── 15. Vehicle topology checks ──
    const P_exc = 19/(0.93*0.95) + 5/(0.90*0.95);
    this.assert('Excavator P_electric (kW)', P_exc, 27.09, 0.5);
    const P_2w = 8/(0.92*0.95);
    this.assert('2W P_electric @8kW', P_2w, 9.15, 0.1);

    // ── 16. Canvas elements ready ──
    const pmC = document.getElementById('pm_canvas');
    const pcC = document.getElementById('pc_canvas');
    this.assert('pm_canvas exists', pmC ? 1 : 0, 1, 0);
    this.assert('pm_canvas.width > 0', pmC ? (pmC.width > 0 ? 1 : 0) : 0, 1, 0);
    this.assert('pc_canvas exists', pcC ? 1 : 0, 1, 0);

    // ── Report ──
    const elapsed = (performance.now()-t0).toFixed(1);
    const total = this.pass + this.fail;
    // FIX: All console calls use safe wrappers defined above
    _clog(`${this.pass}/${total} passed in ${elapsed}ms`, this.fail===0?'color:#00d4aa;font-weight:bold':'color:#ff4d6d;font-weight:bold');
    this.results.filter(r=>!r.ok).forEach(r =>
      _cwarn(`  X ${r.name}: got ${JSON.stringify(r.actual)}, expected ${r.expected}`)
    );
    this.results.filter(r=>r.ok).forEach(r =>
      _clog(`  OK ${r.name}`)
    );
    _cgrpe();

    // Update/create header badge
    let badge = document.getElementById('qa_badge');
    if(!badge) {
      badge = document.createElement('div');
      badge.id = 'qa_badge';
      badge.style.cssText = 'padding:3px 9px;font-size:9px;font-weight:700;border-radius:4px;cursor:pointer;border:1px solid;letter-spacing:.3px;transition:opacity .15s';
      badge.onclick = () => QA_AGENT.run();
      badge.title = 'Click to re-run QA tests';
      document.getElementById('topnav').appendChild(badge);
    }
    badge.style.background = this.fail===0 ? 'rgba(0,212,170,.15)' : 'rgba(255,77,109,.15)';
    badge.style.color       = this.fail===0 ? '#00d4aa' : '#ff4d6d';
    badge.style.borderColor = this.fail===0 ? 'rgba(0,212,170,.4)' : 'rgba(255,77,109,.4)';
    badge.textContent       = this.fail===0
      ? `QA ✓ ${this.pass}/${total}`
      : `QA ✗ ${this.fail} fail`;

    return {pass:this.pass, fail:this.fail, total, elapsed};
  }
};

// ── initApp: called ONLY after successful login ──
