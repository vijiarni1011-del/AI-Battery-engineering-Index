function calcCurrent() {
  const Tamb = getV('curr_amb');
  const Vnom = getV('curr_vnom') || S.V_nom_pack || 358;
  const Qah  = getV('curr_qah')  || S.Q_pack    || 120;
  const app  = S.app || '4W';

  // ── Per-component inputs ──
  const P_main   = getV('curr_phyd');    // Main drive mechanical output (kW)
  const eta_m    = getV('curr_meff');    // Motor efficiency
  const eta_inv  = getV('curr_ieff');    // Inverter efficiency
  const P_trac   = getV('curr_ptrac');   // Traction mechanical output (kW)
  const eta_tm   = getV('curr_tmeff');   // Traction motor efficiency
  const P_tms    = getV('curr_ptms');    // iTMS cooling/heating (kW, HV)
  const P_hvac   = getV('curr_phvac');   // HVAC compressor (kW, HV)
  const P_aux    = getV('curr_paux');    // LV aux + ECU (kW)
  const eta_dcdc = getV('curr_dceff');   // DC-DC efficiency
  const P_add    = getV('curr_padd');    // Additional HV loads (kW)

  // ── Ambient factor (TMS load correction) ──
  const T_fac = Tamb < 0  ? (1 + Math.abs(Tamb)*0.015)  // cold: +1.5%/°C heating
              : Tamb > 35 ? (1 + (Tamb-35)*0.012)        // hot:  +1.2%/°C cooling
              : 1.0;

  // ── Vehicle-type power topology ──
  // Each vehicle type has different drivetrain architecture
  let P_electric = 0;
  let topology_note = '';

  switch(app) {
    case '2W':
      // E-bike/motorcycle: single traction motor, no hydraulics, minimal aux
      // P_bat = P_trac/(η_m·η_inv) + P_aux/η_dcdc + P_tms
      P_electric = P_trac/(eta_tm * eta_inv)
                 + P_aux / eta_dcdc
                 + P_tms * T_fac
                 + P_add;
      topology_note = '2W: Traction only. No hydraulics.';
      break;

    case '4W':
      // Passenger EV: traction motor(s), no hydraulics (or EPS only), HVAC, aux
      // P_bat = P_trac/(η_m·η_inv) + P_hvac + P_aux/η_dcdc + P_tms
      P_electric = P_trac/(eta_tm * eta_inv)
                 + P_hvac * T_fac
                 + P_aux / eta_dcdc
                 + P_tms * T_fac
                 + P_add;
      topology_note = '4W: Traction + HVAC + aux. No main hydraulic motor.';
      break;

    case 'Bus':
      // City bus: traction + HVAC (large) + door/aux + TMS
      P_electric = P_trac/(eta_tm * eta_inv)
                 + P_hvac * T_fac
                 + P_aux / eta_dcdc
                 + P_tms * T_fac
                 + P_main/(eta_m * eta_inv)  // compressor/accessories as main
                 + P_add;
      topology_note = 'Bus: Traction + large HVAC + accessories motor.';
      break;

    case 'Truck':
      // e-Truck: traction + EPS pump + HVAC + aux + TMS
      P_electric = P_trac/(eta_tm * eta_inv)
                 + P_main/(eta_m * eta_inv)  // steering / PTO pump
                 + P_hvac * T_fac
                 + P_aux / eta_dcdc
                 + P_tms * T_fac
                 + P_add;
      topology_note = 'Truck: Traction + EPS/PTO pump + HVAC + aux.';
      break;

    case 'Excavator':
    case 'WheelLoader':
      // Off-highway: MAIN DRIVE = hydraulic pump motor (dominant load)
      // P_bat = P_hyd_pump/(η_m·η_inv) + P_travel/(η_m·η_inv) + P_TMS + P_aux/η_dcdc
      // No HVAC term (cab HVAC small vs hydraulic load)
      P_electric = P_main/(eta_m * eta_inv)      // Hydraulic pump motor
                 + P_trac/(eta_tm * eta_inv)      // Travel/swing motor
                 + P_tms * T_fac                  // TMS
                 + P_aux / eta_dcdc               // LV aux
                 + P_add;
      topology_note = `${app}: Hydraulic pump motor (main) + travel motor + TMS. η_total ≈ η_pump×η_motor×η_inv.`;
      break;

    case 'AgTractor':
      // Tractor: PTO + travel + lift hydraulics + aux
      P_electric = P_main/(eta_m * eta_inv)       // PTO + lift hydraulic pump
                 + P_trac/(eta_tm * eta_inv)       // Travel/4WD
                 + P_tms * T_fac
                 + P_aux / eta_dcdc
                 + P_add;
      topology_note = 'AgTractor: PTO + hydraulic lift + 4WD travel + aux.';
      break;

    case 'Industrial':
      // Forklift/AGV: lift motor + drive motor + aux
      // P_bat = P_lift/(η_m·η_inv) + P_drive/(η_m·η_inv) + P_aux/η_dcdc
      P_electric = P_main/(eta_m * eta_inv)       // Lift hydraulic motor
                 + P_trac/(eta_tm * eta_inv)       // Drive motor
                 + P_tms * T_fac
                 + P_aux / eta_dcdc
                 + P_add;
      topology_note = 'Industrial: Lift motor + drive motor + aux. Regen on lowering.';
      break;

    default:
      // Generic / Other
      P_electric = P_main/(eta_m * eta_inv)
                 + P_trac/(eta_tm * eta_inv)
                 + P_hvac * T_fac
                 + P_tms * T_fac
                 + P_aux / eta_dcdc
                 + P_add;
      topology_note = 'Generic topology: all loads summed.';
  }

  const P_total = P_electric;
  const I_bat   = P_total * 1000 / Vnom;
  const C_rate  = I_bat / Qah;
  // System efficiency — vehicle-type aware label and calc
  // For 2W/4W: no hydraulic main drive → useful output = traction only
  // For off-highway: useful = hydraulic pump output + traction
  const isRoad = ['2W','4W','Bus'].includes(app);
  const driveLabel = isRoad ? 'Traction efficiency' : 'Drive system efficiency';
  const P_drive_useful = isRoad ? P_trac : (P_main + P_trac);
  const eff_drv = P_total > 0 ? (P_drive_useful / P_total * 100) : 0;
  const eff_note = isRoad
    ? `Traction output ${P_trac.toFixed(1)}kW ÷ Total battery draw ${P_total.toFixed(1)}kW`
    : `Mech output ${P_drive_useful.toFixed(1)}kW ÷ Total battery draw ${P_total.toFixed(1)}kW`;

  // Update global state for other tabs
  S._P_total = P_total;
  S._I_bat   = I_bat;
  S._C_rate  = C_rate;

  // Push current to thermal
  setField('th_I', I_bat.toFixed(1));

  setRg('curr_results', [
    {l:'Main Drive elec.',   v:P_main > 0 ? (P_main/(eta_m*eta_inv)).toFixed(2) : '—', u:'kW', c:'neutral'},
    {l:'Traction elec.',     v:P_trac > 0 ? (P_trac/(eta_tm*eta_inv)).toFixed(2) : '—', u:'kW', c:'neutral'},
    {l:'HVAC',               v:P_hvac > 0 ? (P_hvac*T_fac).toFixed(2) : '—', u:'kW', c:'neutral'},
    {l:'iTMS',               v:(P_tms*T_fac).toFixed(2), u:'kW', c:'neutral'},
    {l:'Aux / LV',           v:(P_aux/eta_dcdc).toFixed(2), u:'kW', c:'neutral'},
    {l:'Additional',         v:P_add > 0 ? P_add.toFixed(2) : '—', u:'kW', c:'neutral'},
    {l:'TOTAL Power',        v:P_total.toFixed(2), u:'kW', c:P_total>S.t_pcont?'warn':'ok', t:`Target cont: ${S.t_pcont}kW`},
    {l:'Battery Current',    v:I_bat.toFixed(1),   u:'A',  c:'blue'},
    {l:'C-rate',             v:C_rate.toFixed(3),  u:'C',  c:C_rate>2?'err':C_rate>1?'warn':'ok'},
    {l:'Amb. temp factor',   v:T_fac.toFixed(3),   u:'×',  c:T_fac>1.1?'warn':'neutral',
      t:'Applied to TMS+HVAC loads at current ambient. Total power already includes this factor.'},
    {l:'TMS+HVAC at T_amb',  v:(P_tms*T_fac + ((['4W','Bus','Truck'].includes(app)?P_hvac*T_fac:0))).toFixed(2), u:'kW', c:'neutral',
      t:'TMS and HVAC power after ambient temperature factor. Increases at cold/hot extremes.'},
  ]);

  const _ctrg = document.getElementById('curr_targets');
  if (_ctrg) _ctrg.innerHTML =
    tbar('Power vs Cont. Target', P_total.toFixed(1), S.t_pcont*1.5, 'kW') +
    `<div style="font-size:9px;color:var(--b);margin-top:6px;padding:4px 8px;background:var(--bb);border-radius:4px">📐 <b>Topology:</b> ${topology_note}</div>`;

  // Efficiency map
  const effs = [
    {l: isRoad ? 'Traction motor η_m' : 'Main Drive η_m', v:(eta_m*100).toFixed(0),  max:100},
    {l:'Inverter η_inv',  v:(eta_inv*100).toFixed(0), max:100},
    {l:'Traction η_m',    v:(eta_tm*100).toFixed(0),  max:100},
    {l:'DC/DC η',         v:(eta_dcdc*100).toFixed(0),max:100},
    {l:driveLabel,        v:eff_drv.toFixed(1),        max:100, note:eff_note},
  ];
  const _cem = document.getElementById('curr_eff_map');
  if (_cem) _cem.innerHTML = effs.map(e => tbar(e.l, e.v, e.max, '%')).join('');

  // Temperature sensitivity matrix
  const temps = [-20, -10, 0, 10, 25, 35, 45, 55];
  let mt = `<table><tr><th>Ambient (°C)</th><th>Temp Factor</th><th>Power (kW)</th><th>Current (A)</th><th>C-rate</th><th>Op. Range</th></tr>`;
  temps.forEach(T => {
    const Tf = T < 0 ? (1+Math.abs(T)*0.015) : T > 35 ? (1+(T-35)*0.012) : 1.0;
    const Pt  = P_electric * Tf / T_fac;  // rescale
    const It  = Pt * 1000 / Vnom;
    const Ct  = It / Qah;
    const inOp = T >= S.t_top_lo && T <= S.t_top_hi;
    mt += `<tr style="${T===25?'background:rgba(0,212,170,.05)':''}">
      <td style="color:${!inOp?'var(--warn)':'inherit'}">${T}°C${T===25?' ★':''}</td>
      <td style="color:${Tf>1.15?'var(--warn)':'inherit'}">${Tf.toFixed(3)}×</td>
      <td>${Pt.toFixed(1)}</td><td>${It.toFixed(0)}</td><td>${Ct.toFixed(3)}</td>
      <td>${tag(inOp?'✓ In range':'Out of range', inOp?'g':'o')}</td></tr>`;
  });
  const _ctm = document.getElementById('curr_temp_matrix');
  if (_ctm) _ctm.innerHTML = mt + '</table>';
}

function setThermalCase() {
  const lc=document.getElementById('th_lc').value;
  const c=TH_CASES[lc]||TH_CASES.custom;
  if(lc!=='custom') setField('th_I',c.I);
  calcThermal();
}
function calcThermal() {
  const I=getV('th_I'), ir=getV('th_ir_bol'), hair=getV('th_hair');
  const dtair=getV('th_dtair'), dt=getV('th_dtcool'), cpcool=getV('th_cpcool');
  const rho=getV('th_rho'), pmass=getV('th_pmass'), cppack=getV('th_cppack');
  const Q_gen=I*I*ir;
  const Q_air=hair*dtair;
  const Q_cool=Math.max(Q_gen-Q_air,0);
  const m_dot=Q_cool/(cpcool*dt);
  const V_flow=m_dot/rho*60;
  const dTmin=(Q_gen*60)/(pmass*cppack);

  // Guard: if input values invalid, show zeros rather than NaN
  const safe = v => isFinite(v) && !isNaN(v) ? v : 0;
  const V_flow_disp = safe(V_flow);
  const Q_cool_disp = safe(Q_cool);
  // Determine TMS mode
  const passiveOk = Q_cool <= 0;  // air cooling sufficient
  const flowStatus = passiveOk ? 'ok' : V_flow_disp > 15 ? 'err' : V_flow_disp > 10 ? 'warn' : 'ok';
  const flowLabel  = passiveOk ? 'Passive (air only)' : V_flow_disp.toFixed(3);

  setRg('th_results',[
    {l:'Q_gen (I²R)',       v:safe(Q_gen).toFixed(0),   u:'W',     c:'neutral',
      t:`I=${I.toFixed(1)}A × I × IR(${ir}Ω) = ${safe(Q_gen).toFixed(0)}W heat generated`},
    {l:'Q_to_air (h×ΔT)',   v:safe(Q_air).toFixed(0),   u:'W',     c:'neutral',
      t:`Natural convection: h=${hair}W/K × ΔT_air=${dtair}°C = ${safe(Q_air).toFixed(0)}W removed passively`},
    {l:'Q_to_coolant',      v:Q_cool_disp.toFixed(0),   u:'W',     c: passiveOk?'ok':'blue',
      t: passiveOk ? 'Q_gen < Q_air → passive cooling sufficient, no active coolant needed'
                   : `Excess heat = Q_gen(${safe(Q_gen).toFixed(0)}W) − Q_air(${safe(Q_air).toFixed(0)}W) = ${Q_cool_disp.toFixed(0)}W must be removed by coolant`},
    {l:'Coolant Flow req.', v:flowLabel,                 u: passiveOk?'':' L/min', c:flowStatus,
      t: passiveOk ? 'Air cooling sufficient at this operating point'
                   : `m_dot = ${Q_cool_disp.toFixed(0)}W ÷ (${cpcool} J/kg·K × ${dt}°C) = ${safe(m_dot).toFixed(4)} kg/s → ÷ρ(${rho} kg/L) × 60 = ${V_flow_disp.toFixed(3)} L/min`},
    {l:'ΔT/min (no TMS)',   v:safe(dTmin).toFixed(3),   u:'°C/min',c:safe(dTmin)>0.5?'warn':'ok',
      t:`Temperature rise rate if TMS fails: Q_gen × 60 / (mass × Cp) = ${safe(dTmin).toFixed(3)} °C/min`},
    {l:'IR Energy/hr',      v:((safe(Q_gen)*3600)/1e6).toFixed(3), u:'kWh',c:'neutral'},
  ]);
  // Also expose flow for Cooling Pressure Drop tool
  setField('cp_flow', V_flow_disp.toFixed(2));
  // Store in S for TVR access
  S._V_flow = V_flow_disp;
  // Estimate max cell temp from Q_gen and cooling capacity for TVR
  if (Q_cool > 0 && V_flow_disp > 0) {
    const Q_removed = V_flow_disp/60 * 1.07 * 3400 * 5; // L/min → kg/s × ρ × Cp × ΔT
    const Q_residual = Math.max(Q_gen - Q_removed, 0);
    const pmass = getV('th_pmass') || S.pack_mass || 300;
    const cppack = getV('th_cppack') || S.c_cp_pack || 1025;
    S._Tcell_max = 25 + (Q_residual * 3600) / (pmass * cppack); // rough estimate
  }

  const th_tgt = document.getElementById('th_targets');
  if(th_tgt) {
    const Vf_safe = isFinite(V_flow) && V_flow > 0 ? V_flow : 0;
    th_tgt.innerHTML =
      tbar('Coolant flow vs limit', +Vf_safe.toFixed(2), 10, 'L/min', Vf_safe > 10 ? 'var(--r)' : 'var(--g)') +
      tbar('Heat generated vs budget', +Q_gen.toFixed(0), Math.max(Q_gen*1.5,1000), 'W', 'var(--o)') +
      `<div style="font-size:12px;color:var(--m);margin-top:6px">
        Max cell temp target: <b style="color:var(--g)">${S.t_tcell_max}°C</b> · 
        Max gradient: <b style="color:var(--g)">${S.t_tgrad}°C</b> · 
        Q_gen=${Q_gen.toFixed(0)}W · Q_cool=${Q_cool.toFixed(0)}W · 
        m_dot=${isFinite(m_dot)?m_dot.toFixed(4):0} kg/s
      </div>`;
  }

  const sp=[
    ['Discharge −20 to +5°C','HEAT','Limited discharge',`Hysteresis: ${S.t_top_lo+15}°C`],
    ['Discharge +5 to +35°C','None','Normal discharge','Passive only'],
    ['Discharge +35 to +45°C','COOL (rad+pump)','Normal discharge','Low ΔT'],
    ['Discharge +45 to +55°C','COOL MAX (chiller)','Normal discharge','Set: 35°C'],
    [`Discharge T=${S.t_tcell_max}°C`,'—','OPERATION LIMIT',''],
    ['Charge T < 0°C','—','NO CHARGE ALLOWED',''],
    ['Charge −15 to +5°C','HEAT','Charge enabled','Set: 5°C'],
    ['Charge +5 to +35°C','None','Normal charge',''],
    ['Charge +35 to +45°C','COOL','Normal charge','Set: 33°C'],
    ['Charge T > 55°C','—','SAFETY SHUTDOWN',''],
  ];
  let st=`<table><tr><th>Condition</th><th>TMS Action</th><th>Battery Mode</th><th>Note</th></tr>`;
  sp.forEach(r=>st+=`<tr style="${r[2].includes('LIMIT')||r[2].includes('SHUT')?'background:var(--rb)':''}"><td style="font-size:10px">${r[0]}</td><td>${tag(r[1],r[1]==='HEAT'?'b':r[1].includes('COOL')?'o':r[1]==='None'?'g':'r')}</td><td style="color:${r[2].includes('LIMIT')||r[2].includes('SHUT')?'var(--r)':'inherit'};font-size:10px">${r[2]}</td><td style="color:var(--dm);font-size:9px">${r[3]}</td></tr>`);
  const _tms=document.getElementById('tms_setpoints');if(_tms)_tms.innerHTML=st+'</table>';

  let ct=`<table><tr><th>Flow (L/min)</th><th>Re @-15°C</th><th>Re @25°C</th><th>Re @45°C</th><th>ΔP @25°C (bar)</th></tr>`;
  [[1,44.6,282,509,'0.021'],[3,134,847,1527,'0.055'],[5,223,1411,2544,'0.093'],[9,401,2540,4580,'0.292'],[12,535,3386,6107,'0.484'],[15,668,4233,7633,'0.720']].forEach(r=>ct+=`<tr><td style="color:${V_flow>r[0]-0.5&&V_flow<r[0]+0.5?'var(--g)':'inherit'}">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`);
  calcCoolingPressureDrop();
  const _tct=document.getElementById('th_cooling_table');if(_tct)_tct.innerHTML=ct+'</table><p style="font-size:9px;color:var(--dm);margin-top:4px">60mm² (8.7mm dia) channel cooling plate, Aluminium, 12.62m path</p>';
}
function calcHeater() {
  const m=getV('th_pmass'), cp=getV('th_cppack');
  const tf=getV('th_tfrom'), tt=getV('th_tto'), theat=getV('th_theat')*60;
  const Pheat=getV('th_pheater')*1000*0.95; // 95% heater efficiency
  const Preq=(m*cp*(tt-tf))/theat;
  const t_actual=(m*cp*(tt-tf))/Pheat/60;
  setRg('heater_result',[
    {l:'Required Power',v:(Preq/1000).toFixed(2),u:'kW',c:'blue'},
    {l:'Heater Power',v:(Pheat/1000).toFixed(2),u:'kW eff.'},
    {l:'Actual heat-up time',v:t_actual.toFixed(0),u:'min',c:t_actual>theat/60+5?'warn':'ok'},
  ]);
}

// ═══════════════════════════════════════════════════════
// CHARGING
// ═══════════════════════════════════════════════════════
function calcCharge() {
  const Eu=getV('chg_eu'), Qah=getV('chg_qah'), Ss=getV('chg_S');
  const v10=getV('chg_v10'), v90=getV('chg_v90'), eff=getV('chg_eff')/100;
  const Imax=getV('chg_imax'), Pac=getV('chg_pac'), Pdc=getV('chg_pdc');

  // V_avg = S × average cell OCV between 10–90% SoC
  const Vavg = Ss * ((v10 + v90) / 2);

  // I_dc_unrest = current needed at Vavg to deliver P_dc with no current limit applied
  // This is the "unrestricted" / theoretical value before cell or safety limits
  const I_dc_unrest = (Pdc * 1000) / (Vavg * eff);
  const Cr_unrest   = I_dc_unrest / Qah;

  // I_limited = actual charge current after applying cell max & charger power constraints
  const I_lim = Math.min(I_dc_unrest, Imax, (Pdc * 1000) / Vavg);

  const t_ac  = Eu / Pac * 60;
  const t_dc  = Eu / Pdc * 60;
  const t_lim = Eu / (I_lim * Vavg / 1000) * 60;

  setRg('chg_results',[
    {l:'V_avg pack (10–90% SoC)',v:Vavg.toFixed(1),u:'V',c:'neutral',
      t:'S × (OCV_10 + OCV_90)/2 — mean pack voltage across the useful SoC window'},
    {l:'I_dc theoretical max',v:I_dc_unrest.toFixed(1),u:'A',c:'neutral',
      t:'P_dc ÷ V_avg — current at full DC power ignoring cell I limit. Compare to I_max below.'},
    {l:'C-rate @ theoretical max',v:Cr_unrest.toFixed(3),u:'C',c:Cr_unrest>S.t_cchg?'warn':'ok',
      t:`I_dc_theoretical ÷ Q_pack. Target ≤${S.t_cchg}C. If > target, reduce charger power or increase pack capacity.`},
    {l:'I_limited (actual)',v:I_lim.toFixed(1),u:'A',c:'blue',
      t:'min(I_dc_theoretical, I_cell_max, I_from_Pdc) — real charge current after all limits'},
    {l:'AC Charge time',v:t_ac.toFixed(0),u:'min',c:'neutral',t:`E_usable ÷ P_ac = ${Eu}÷${Pac} kWh/kW`},
    {l:'DC Charge time',v:t_dc.toFixed(0),u:'min',c:'ok',t:`E_usable ÷ P_dc = ${Eu}÷${Pdc} kWh/kW`},
    {l:'DC time (I-limited)',v:t_lim.toFixed(0),u:'min',c:'blue',t:'Actual time with I_limited applied'},
    {l:'1C check',v:Cr_unrest<=1?'PASS':'OVER 1C',u:'',c:Cr_unrest<=1?'ok':'warn',
      t:'Ideal to charge at ≤1C for cell longevity. Over 1C = fast charge stress.'},
  ]);

  // Note banner
  const _note = document.getElementById('chg_note');
  if(_note) _note.innerHTML = `
    <div style="margin-top:10px;padding:8px 12px;background:rgba(74,158,255,.07);border:1px solid rgba(74,158,255,.2);border-radius:7px;font-size:10px;color:var(--b);line-height:1.7">
      <b>ℹ️ Result explanations:</b><br>
      <b>I_dc theoretical max</b> = what current the charger would push at full power, ignoring cell rating. Use to check if charger is oversized.<br>
      <b>C-rate (theoretical max)</b> = same current expressed as a fraction of pack capacity. Must be ≤ cell datasheet charge C-rate.<br>
      <b>I_limited (actual)</b> = the current that will actually flow after all limits are applied — this is your sizing current.
    </div>`;

  const chargers=[[7,'AC'],[11,'AC'],[22,'AC'],[50,'DC'],[60,'DC'],[80,'DC'],[120,'DC'],[150,'DC'],[350,'DC (HPC)']];
  let t=`<table><tr><th>Charger (kW)</th><th>Type</th><th>I_dc (A)</th><th>C-rate</th><th>Time (h)</th><th>Time (min)</th><th>vs I_cell_max</th><th>vs C target</th></tr>`;
  chargers.forEach(([pw,tp])=>{
    const i=(pw*1000)/Vavg, cr=i/Qah, th=Eu/pw;
    t+=`<tr><td>${pw} kW</td><td>${tag(tp,tp==='AC'?'b':'g')}</td><td>${i.toFixed(1)}</td><td>${cr.toFixed(3)}</td><td>${th.toFixed(2)}</td><td>${(th*60).toFixed(0)}</td><td>${tag(i<=Imax?'✓ OK':'✗ Over limit',i<=Imax?'g':'r')}</td><td>${tag(cr<=S.t_cchg?'✓ OK':cr<=1.2?'⚠ Marginal':'✗ High',cr<=S.t_cchg?'g':cr<=1.2?'y':'r')}</td></tr>`;
  });
  const _cs=document.getElementById('chg_sweep');
  if(_cs) _cs.innerHTML=t+'</table><div style="font-size:9px;margin-top:6px;padding:6px 8px;background:rgba(74,158,255,.07);border-radius:4px;color:var(--b)">🔴 Red = current exceeds cell I_max (datasheet limit) · 🟡 Yellow = C-rate exceeds target · Green = within limits. Charger power shown before any BMS derating.</div>';
}

// ═══════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════
function calcLifecycle() {
  const Nc    = getV('lc_nc');
  const eol   = getV('lc_eol') / 100;         // e.g. 0.80
  const s5    = getV('lc_s5')  / 100;         // e.g. 0.90
  const s10   = getV('lc_s10') != null ? getV('lc_s10')/100 : eol; // year-10 SoH target
  const yrs   = getV('lc_years');
  const days  = getV('lc_days');
  const cpd   = getV('lc_cpd');
  const Eu    = getV('lc_eu');
  const P_gross = getV('lc_pavg');   // gross average demand kW (before regen)
  const hpc   = getV('lc_hpc');
  const regen_frac = (getV('lc_regen_frac') || 0) / 100;   // e.g. 0.15
  const regen_eff  = (getV('lc_regen_eff')  || 85) / 100;  // e.g. 0.85

  // Net regen credit: fraction of gross energy that gets recovered
  const regen_credit = regen_frac * regen_eff;               // e.g. 0.15 × 0.85 = 0.128
  // Effective energy per cycle (regen adds back to available energy)
  const Eu_net = Eu * (1 + regen_credit);                   // kWh effective range
  // Net average power demand (gross - regen recovered)
  const P_net = P_gross * (1 - regen_credit);

  const cyc_yr  = cpd * days;
  const life_yr = Nc / cyc_yr;
  const life_hr = Nc * hpc;

  // Lifetime throughput energy (avg of BoL and EoL usable)
  const E_life = (Nc * Eu * (1 + eol) / 2) / 1000;         // MWh

  // Autonomy = effective usable energy / net power demand
  // P_net must be > 0 to avoid div/0
  const P_safe = Math.max(P_net, 0.1);
  const a0  = (Eu_net / P_safe).toFixed(2);                 // BoL
  const a5  = (Eu_net * s5 / P_safe).toFixed(2);            // Year 5
  const a10 = (Eu_net * s10 / P_safe).toFixed(2);           // Year 10 / EoL

  // SoH at year 5 and year 10 from linear degradation model
  const cyc5  = Math.min(cyc_yr * 5, Nc);
  const cyc10 = Math.min(cyc_yr * 10, Nc);
  const soh_yr5  = (1 - (cyc5 / Nc)  * (1 - eol)) * 100;
  const soh_yr10 = (1 - (cyc10 / Nc) * (1 - eol)) * 100;

  const limiting = life_yr < yrs ? 'Cycle life' : 'Calendar';

  // Store for TVR access
  S._soh_eol_est = soh_yr10;
  S._lc_auto_bol = +a0;  // Autonomy @ BoL for TVR

  setRg('lc_results', [
    {l:'Cycles / Year',       v:cyc_yr.toFixed(0),      u:'',c:'neutral'},
    {l:'Cycle Life',          v:life_yr.toFixed(1),     u:'yr',  c:life_yr>=yrs?'ok':'warn',  t:`Target ≥${yrs} yr`},
    {l:'Life (hours)',        v:life_hr.toFixed(0),     u:'h',   c:'blue', t:`${Nc} cycles × ${hpc}h/cycle`},
    {l:'Limiting factor',     v:limiting,               u:'',    c:limiting.includes('Cycle')?'warn':'ok'},
    {l:'Lifetime energy',     v:E_life.toFixed(1),      u:'MWh', c:'neutral'},
    {l:'SoH @ Year 5 (calc)', v:soh_yr5.toFixed(1),    u:'%',   c:soh_yr5>=s5*100?'ok':'warn', t:`Target ${(s5*100).toFixed(0)}%`},
    {l:'SoH @ Year 10 (calc)',v:soh_yr10.toFixed(1),   u:'%',   c:soh_yr10>=eol*100?'ok':'err', t:`Target ${(eol*100).toFixed(0)}%`},
    {l:'Regen credit',        v:(regen_credit*100).toFixed(1), u:'%', c:'blue', t:`${(regen_frac*100).toFixed(0)}% fraction × ${(regen_eff*100).toFixed(0)}% efficiency`},
    {l:'P_avg net (w/regen)', v:P_net.toFixed(1),      u:'kW',  c:'neutral', t:`${P_gross}kW gross × (1 − ${(regen_credit*100).toFixed(1)}%)`},
    {l:'Autonomy @ BoL',      v:a0,                    u:'h',   c:+a0>=S.t_auto?'ok':'warn',  t:`Target ≥${S.t_auto}h · E_net(${Eu_net.toFixed(1)}kWh)÷P_net(${P_net.toFixed(1)}kW)`},
    {l:'Autonomy @ Year 5',   v:a5,                    u:'h',   c:+a5>=S.t_auto?'ok':'warn'},
    {l:'Autonomy @ Year 10',  v:a10,                   u:'h',   c:+a10>=S.t_auto?'ok':'err'},
  ]);

  // Autonomy explanation note
  const _note = document.getElementById('lc_autonomy_note');
  if (_note) _note.innerHTML = `
    <div style="padding:8px 12px;background:rgba(74,158,255,.07);border:1px solid rgba(74,158,255,.2);border-radius:7px;font-size:10px;color:var(--b);line-height:1.7;margin-top:8px">
      <b>ℹ️ Autonomy method:</b> Autonomy = (E_usable × SoH × regen_credit_factor) ÷ P_avg_net<br>
      <b>P_avg</b> = average electrical power draw across the full work cycle. <b>Set this accurately!</b><br>
      Excavator idle+work avg: typically 8–18 kW. Road vehicle continuous: 15–25 kW.<br>
      ${regen_credit > 0 ? `<b>Regen active:</b> ${(regen_credit*100).toFixed(1)}% energy credit → extends range by ${((1/(1-regen_credit)-1)*100).toFixed(0)}%.` : '⚠️ No regen entered. Set Regen Fraction &gt; 0 if vehicle has regenerative braking.'}<br>
      For best accuracy: upload a real duty cycle CSV in the <b>Drive Cycle tab</b> — P_avg will auto-fill here.
    </div>`;

  // SoH trajectory table
  const pts = [0, 0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1.0];
  let t = `<table><tr><th>% Life</th><th>Cycles</th><th>Year (est.)</th><th>Op. Hours</th><th>SoH (%)</th><th>E_usable (kWh)</th><th>E_net +regen (kWh)</th><th>Autonomy (h)</th><th>vs Target</th></tr>`;
  pts.forEach(m => {
    const n   = Math.round(m * Nc);
    const yr  = (n / cyc_yr).toFixed(1);
    const oh  = (n * hpc).toFixed(0);
    const soh = (1 - m * (1 - eol)) * 100;
    const eu  = (Eu * soh / 100).toFixed(2);
    const eu_regen = (Eu_net * soh / 100).toFixed(2);
    const a   = (+eu_regen / P_safe).toFixed(2);
    const col = soh < 82 ? 'var(--r)' : soh < 88 ? 'var(--y)' : 'inherit';
    t += `<tr>
      <td>${(m*100).toFixed(0)}%</td><td>${n}</td><td>${yr}</td><td>${oh}</td>
      <td style="color:${col};font-weight:600">${soh.toFixed(1)}%</td>
      <td>${eu}</td><td style="color:var(--b)">${eu_regen}</td>
      <td style="color:${+a<S.t_auto?'var(--y)':'inherit'}">${a}</td>
      <td>${tag(+a>=S.t_auto?'✓':soh>=eol*100?'⚠':'✗', +a>=S.t_auto?'g':soh>=eol*100?'y':'r')}</td>
    </tr>`;
  });
  const _lct = document.getElementById('lc_table');
  if (_lct) _lct.innerHTML = t + '</table>';
}

// ═══════════════════════════════════════════════════════
// RESISTANCE — Component Build-Up
// ═══════════════════════════════════════════════════════
const BB_MATS = {
