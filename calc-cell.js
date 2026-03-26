// CHEMISTRY PRESETS
// ═══════════════════════════════════════════════════════
// CellForge AI — Battery Engineering Suite
const CHEM = {
  LFP:  {vnom:3.2, vmax:3.65, vmin:2.0, cp:1050, ir:0.22, irEoL:0.32, ocv10:3.22, ocv90:3.35, ged_cell:165, note:'Excellent cycle life (3000–6000), flat OCV curve, thermally stable. No cobalt.'},
  NMC:  {vnom:3.6, vmax:4.2,  vmin:2.8, cp:1010, ir:0.15, irEoL:0.28, ocv10:3.50, ocv90:4.10, ged_cell:220, note:'High energy density. Good power. Cycle life 1000–2000. Temperature sensitive above 45°C.'},
  NCA:  {vnom:3.65,vmax:4.2,  vmin:2.75,cp:980,  ir:0.12, irEoL:0.22, ocv10:3.55, ocv90:4.15, ged_cell:240, note:'Highest energy density. Good power. Thermal management critical. Cycle life 1000–1500.'},
  LTO:  {vnom:2.3, vmax:2.8,  vmin:1.5, cp:850,  ir:0.08, irEoL:0.12, ocv10:2.25, ocv90:2.75, ged_cell:75,  note:'Exceptional cycle life (10000+). Wide temperature range. Low energy density. Fast charging.'},
  NMCA: {vnom:3.65,vmax:4.2,  vmin:2.8, cp:1000, ir:0.13, irEoL:0.24, ocv10:3.55, ocv90:4.15, ged_cell:230, note:'NMC + Al doping for improved stability. Emerging chemistry. High energy density.'},
  NAION:{vnom:3.1, vmax:4.1,  vmin:2.0, cp:1100, ir:0.30, irEoL:0.48, ocv10:3.05, ocv90:4.0,  ged_cell:120, note:'Sodium-Ion — cobalt/lithium-free. Lower energy density. Good low-temp performance. Maturing tech.'},
  LMR:  {vnom:3.6, vmax:4.5,  vmin:2.5, cp:990,  ir:0.18, irEoL:0.30, ocv10:3.3,  ocv90:4.4,  ged_cell:260, note:'Lithium Manganese Rich — very high energy density. Voltage fade concern. Research-stage to production.'},
  custom:{vnom:3.2,vmax:3.65, vmin:2.0, cp:1000,  ir:0.20, irEoL:0.35, ocv10:3.22, ocv90:3.35, ged_cell:180, note:'Custom chemistry — enter all parameters manually.'},
};
function chemPreset() {
  const c = document.getElementById('c_chem').value;
  const p = CHEM[c] || CHEM.LFP;
  setField('c_vnom', p.vnom); setField('c_vmax', p.vmax); setField('c_vmin', p.vmin);
  setField('c_cp', p.cp); setField('c_ir_bol', p.ir); setField('c_ir_eol', p.irEoL);
  setField('c_ocv10', p.ocv10); setField('c_ocv90', p.ocv90);
  const _cr = document.getElementById('chem_ref');
  if (_cr) _cr.innerHTML = `<b style="color:var(--g)">${c}</b><br>${p.note}<br><span style="color:var(--dm)">GED (cell-level): ~${p.ged_cell} Wh/kg</span>`;
}

// ═══════════════════════════════════════════════════════
// CELL & PACK DERIVED
// ═══════════════════════════════════════════════════════
function calcCellDerived() {
  const S_tot = S.c_cps * S.c_ss;
  const Q = S.c_ah * S.c_pp;
  const Vnom = S_tot * S.c_vnom;
  const Vmax = S_tot * S.c_vmax;
  const Vmin = S_tot * S.c_vmin;
  const Eg = (S.c_vnom * S.c_ah * S_tot * S.c_pp) / 1000;
  const cellMass = S.c_cps * S.c_ss * S.c_pp * S.c_mass / 1000;
  const packMass = cellMass + S.c_housing_mass;
  const GED = (Eg * 1000 / packMass).toFixed(0);
  const inRange = Vnom >= S.t_vmin_sys && Vnom <= S.t_vmax_sys;

  const items = [
    {l:'Total Cells (S)',v:S_tot,u:'cells',c:inRange?'ok':'warn'},
    {l:'Pack Capacity',v:Q.toFixed(0),u:'Ah'},
    {l:'V Nominal',v:Vnom.toFixed(1),u:'V',c:inRange?'ok':'warn',t:`Target: ${S.t_vmin_sys}–${S.t_vmax_sys}V`},
    {l:'V Max (100% SoC)',v:Vmax.toFixed(1),u:'V',c:Vmax>S.t_vmax_sys?'err':''},
    {l:'V Min (0% SoC)',v:Vmin.toFixed(1),u:'V',c:Vmin<S.t_vmin_sys?'warn':''},
    {l:'Gross Energy',v:Eg.toFixed(2),u:'kWh',c:statusClass(Eg,S.t_emin,true)},
    {l:'Cell Mass',v:cellMass.toFixed(0),u:'kg'},
    {l:'Pack Mass (est.)',v:packMass.toFixed(0),u:'kg'},
    {l:'GED (pack)',v:GED,u:'Wh/kg',c:GED>=S.t_ged?'ok':'warn',t:`Target: ≥${S.t_ged} Wh/L`},
    {l:'Config',v:`${S.c_cps}×${S.c_ss}-${S.c_ah}`,u:''},
  ];

  // DoD voltage window from OCV table
  try {
    const dod = parseFloat(document.getElementById('ocv_dod')?.value)
             || parseFloat(document.getElementById('e_dod')?.value) || 1.0;
    const socMargin = (1 - Math.min(1, Math.max(0.1, dod))) / 2;
    const socLo = socMargin * 100, socHi = (1 - socMargin) * 100;
    const ocvPts = typeof getOCVPoints === 'function' ? getOCVPoints() : [];
    if (ocvPts.length >= 2) {
      const interp = (target, key) => {
        const arr = ocvPts.filter(p => p[key] > 0);
        if (!arr.length) return 0;
        if (target <= arr[0].soc) return arr[0][key];
        if (target >= arr[arr.length-1].soc) return arr[arr.length-1][key];
        for (let i = 0; i < arr.length - 1; i++) {
          if (arr[i].soc <= target && arr[i+1].soc >= target) {
            const f = (target - arr[i].soc) / (arr[i+1].soc - arr[i].soc);
            return arr[i][key] + f * (arr[i+1][key] - arr[i][key]);
          }
        }
        return 0;
      };
      const vLoCell = interp(socLo, 't25'), vHiCell = interp(socHi, 't25');
      const vLoPack = vLoCell * S_tot,       vHiPack = vHiCell * S_tot;
      const vLoCold = interp(socLo, 'tmin'), vHiHot = interp(socHi, 'tmax');
      if (vLoCell > 0 && vHiCell > 0) {
        items.push(
          {l:`V @SoC_lo ${socLo.toFixed(0)}% (25°C)`, v:vLoCell.toFixed(3), u:'V/cell', c:'blue', t:'DoD lower bound voltage'},
          {l:`V @SoC_hi ${socHi.toFixed(0)}% (25°C)`, v:vHiCell.toFixed(3), u:'V/cell', c:'blue', t:'DoD upper bound voltage'},
          {l:'Pack V window (25°C)', v:`${vLoPack.toFixed(1)}–${vHiPack.toFixed(1)}`, u:'V', c:'ok', t:'Pack voltage across DoD window'},
          {l:'ΔV across DoD (25°C)', v:((vHiCell-vLoCell)*1000).toFixed(0), u:'mV/cell', c:'neutral'},
        );
        if (vLoCold > 0) items.push({l:`V cold @SoC_lo (T_min)`, v:vLoCold.toFixed(3), u:'V/cell', c:'warn', t:'Cold worst-case lower bound'});
      }
    }
  } catch(e) {}

  setRg('cell_derived', items);

  const checks = [
    {l:'Gross energy ≥ target_min',p:Eg>=S.t_emin,v:`${Eg.toFixed(1)} kWh vs ${S.t_emin} kWh`},
    {l:'V_nom in system window',p:inRange,v:`${Vnom.toFixed(0)}V in [${S.t_vmin_sys},${S.t_vmax_sys}]V`},
    {l:'V_max ≤ system V_max',p:Vmax<=S.t_vmax_sys,v:`${Vmax.toFixed(0)}V ≤ ${S.t_vmax_sys}V`},
  ];
  let h='<table><tr><th>Check</th><th>Status</th><th>Value</th></tr>';
  checks.forEach(c=>h+=`<tr><td>${c.l}</td><td>${c.p?'<span class="chip g">✓ PASS</span>':'<span class="chip r">✗ FAIL</span>'}</td><td style="color:var(--m);font-size:10px">${c.v}</td></tr>`);
  const _ct = document.getElementById('cell_targets');
  if (_ct) _ct.innerHTML = h+'</table>';
}

// ═══════════════════════════════════════════════════════
// PROJECT TARGETS COMPLIANCE
// ═══════════════════════════════════════════════════════
function updateTargetsCompliance() {
  const Eg = S.E_gross;
  const Eu = Eg * 0.941;
  const Vnom = S.V_nom_pack;
  const items = [
    {l:'Energy in range',v:`${Eg.toFixed(1)} kWh`,u:'',c:Eg>=S.t_emin&&Eg<=S.t_emax?'ok':'warn'},
    {l:'Usable ≥ target',v:`${Eu.toFixed(1)} kWh`,u:'',c:Eu>=S.t_eu_min?'ok':'err'},
    {l:'Voltage window',v:`${Vnom.toFixed(0)}V`,u:'',c:(Vnom>=S.t_vmin_sys&&Vnom<=S.t_vmax_sys)?'ok':'warn'},
    {l:'GED target',v:`${((Eg*1000)/((S.c_cps*S.c_ss*S.c_pp*S.c_mass/1000)+S.c_housing_mass)).toFixed(0)} Wh/kg`,u:'',c:'neutral'},
    {l:'Cycle target',v:`${S.t_cycles} cyc`,u:'',c:'ok'},
    {l:'Calendar life',v:`${S.t_years} yr`,u:'',c:'ok'},
  ];
  setRg('targets_compliance', items);
}

// ═══════════════════════════════════════════════════════
// ENERGY
// ═══════════════════════════════════════════════════════
function calcEnergy() {
  const Eg = getV('e_gross'); const dod = getV('e_dod');
  const ns = getV('e_ns'); const fb = getV('e_fbol');
  const fbal = getV('e_fbal'); const fv = getV('e_fvolt');
  const fd = getV('e_fdes'); const ft = getV('e_ftemp');
  const steps = [Eg, Eg*dod, Eg*dod*ns, Eg*dod*ns*fb, Eg*dod*ns*fb*fbal,
                 Eg*dod*ns*fb*fbal*fv, Eg*dod*ns*fb*fbal*fv*fd];
  const Eu = steps[6]*ft;
  S.E_usable = Eu;
  setField('chg_eu', Eu.toFixed(2));
  setField('lc_eu', Eu.toFixed(2));
  // Sync DoD to OCV chart (if not manually overridden)
  const ocvDodEl = document.getElementById('ocv_dod');
  if (ocvDodEl && !ocvDodEl.dataset.manual) {
    ocvDodEl.value = dod.toFixed(2);
    try { drawOCVCanvas(); } catch(e) {}
  }

  const items = [
    {l:'Gross Energy',v:Eg.toFixed(2),u:'kWh',c:'neutral'},
    {l:'After DoD',v:steps[1].toFixed(2),u:'kWh',c:'neutral'},
    {l:'After η_sys',v:steps[2].toFixed(2),u:'kWh',c:'neutral'},
    {l:'After f_BOL',v:steps[3].toFixed(2),u:'kWh',c:'neutral'},
    {l:'After f_balance',v:steps[4].toFixed(2),u:'kWh',c:'neutral'},
    {l:'After f_voltage',v:steps[5].toFixed(2),u:'kWh',c:'neutral'},
    {l:'USABLE ENERGY',v:Eu.toFixed(2),u:'kWh',c:Eu>=S.t_eu_min?'ok':'err',t:`Target: ≥${S.t_eu_min} kWh`},
    {l:'Total Loss',v:((1-(Eu/Eg))*100).toFixed(1),u:'%',c:'warn'},
    {l:'Overall Factor',v:((Eu/Eg)*100).toFixed(2),u:'%'},
  ];
  setRg('energy_results', items);

  const facs = [{l:'DoD',v:dod},{l:'η_system',v:ns},{l:'f_BOL',v:fb},{l:'f_balance',v:fbal},{l:'f_voltage',v:fv},{l:'f_design',v:fd},{l:'f_temp',v:ft}];
  let wf='';
  facs.forEach(f=>{const p=(f.v*100).toFixed(1);const col=f.v<0.97?'var(--o)':'var(--g)';
    wf+=tbar(f.l, p, 100, '%', col);});
  wf+=`<div style="margin-top:8px;font-size:10px;color:var(--m)">Target usable: <span style="color:${Eu>=S.t_eu_min?'var(--g)':'var(--r)'}">${Eu.toFixed(2)} / ${S.t_eu_min} kWh</span></div>`;
  const _ew = document.getElementById('energy_waterfall');
  if (_ew) _ew.innerHTML = wf;
  const _et = document.getElementById('energy_targets');
  if (_et) _et.innerHTML = tbar('Usable Energy',Eu.toFixed(1),S.t_emax,'kWh');
}

// ═══════════════════════════════════════════════════════
// VOLTAGE
// ═══════════════════════════════════════════════════════
function calcVoltage() {
  const cvnom=getV('v_cvnom')||S.c_vnom, cvmax=getV('v_cvmax')||S.c_vmax;
  const cvmin=getV('v_cvmin')||S.c_vmin, cps=getV('v_cps')||S.c_cps;
  const vmin=getV('v_sysmin')||S.t_vmin_sys, vmax=getV('v_sysmax')||S.t_vmax_sys;
  const ss=getV('v_ss'), se=getV('v_se'), pp=getV('v_pp')||1;
  const S_min=Math.ceil(vmin/cvmax), S_max=Math.floor(vmax/cvmax);

  // Validated Configuration: show ACTUAL user config from Cell tab
  const S_act  = cps * (getV('c_ss') || S.c_ss);   // actual S_total from user input
  const Vn_act = (S_act * cvnom).toFixed(1);
  const Vm_act = (S_act * cvmax).toFixed(1);
  const Vi_act = (S_act * cvmin).toFixed(1);
  const Eg_act = ((S_act * pp * cvnom * (getV('c_ah')||S.c_ah)) / 1000).toFixed(2);
  const v_ok   = S_act >= S_min && S_act <= S_max && +Vm_act <= vmax && +Vn_act >= vmin;
  const v_warn = !v_ok && +Vn_act >= vmin * 0.9;
  setRg('volt_results',[
    {l:'Your Config (S_total)',v:S_act,            u:'cells',  c:v_ok?'ok':v_warn?'warn':'err'},
    {l:'V_nominal (actual)',   v:Vn_act,           u:'V',      c:(+Vn_act>=vmin&&+Vn_act<=vmax)?'ok':'warn',
      t:`Target window: ${vmin}–${vmax}V`},
    {l:'V_max (100% SoC)',     v:Vm_act,           u:'V',      c:+Vm_act<=vmax?'ok':'err',
      t:`Must be ≤ ${vmax}V system max`},
    {l:'V_min (0% SoC)',       v:Vi_act,           u:'V',      c:+Vi_act>=vmin?'ok':'warn',
      t:`Must be ≥ ${vmin}V system min`},
    {l:'Gross Energy',         v:Eg_act,           u:'kWh',    c:'neutral'},
    {l:'Valid S range',        v:`${S_min}–${S_max}`,u:'S_total',c:'neutral',
      t:'Range where V_nom stays within system window'},
    {l:'Configuration', v:v_ok?'✓ VALID':v_warn?'⚠ MARGINAL':'✗ INVALID', u:'', c:v_ok?'ok':v_warn?'warn':'err'},
  ]);

  let t=`<table><tr><th>S sections</th><th>S total</th><th>E_gross (kWh)</th><th>V_nom (V)</th><th>V_max (V)</th><th>V_min @${cvmin}V (V)</th><th>V_min @2.5V (V)</th><th>Status</th></tr>`;
  for(let s=ss;s<=se;s++){
    const St=cps*s, Vn=(St*cvnom).toFixed(1), Vmx=(St*cvmax).toFixed(1);
    const Vmn=(St*cvmin).toFixed(1), Vmn25=(St*2.5).toFixed(1);
    const Eg=((St*pp*cvnom*(getV('c_ah')||S.c_ah))/1000).toFixed(2);
    const ok=St>=S_min&&St<=S_max&&+Vmx<=vmax;
    const cur=s===(getV('c_ss')||S.c_ss);
    t+=`<tr style="${cur?'background:rgba(0,212,170,0.06)':''}">
      <td>${s}${cur?' ★':''}</td><td>${St}</td><td>${Eg}</td>
      <td style="color:${+Vn<vmin||+Vn>vmax?'var(--warn)':'inherit'}">${Vn}</td>
      <td style="color:${+Vmx>vmax?'var(--err)':'inherit'}">${Vmx}</td>
      <td style="color:${+Vmn<vmin?'var(--warn)':'inherit'}">${Vmn}</td>
      <td style="color:${+Vmn25<vmin?'var(--warn)':'inherit'}">${Vmn25}</td>
      <td>${tag(ok?'✓ Valid':'✗ Out of range',ok?'g':'r')}</td></tr>`;
  }
  const _vt = document.getElementById('volt_table');
  if (_vt) _vt.innerHTML = t+'</table>';
}

// ═══════════════════════════════════════════════════════
// CURRENT & POWER
// ═══════════════════════════════════════════════════════
function calcCurrent() {
