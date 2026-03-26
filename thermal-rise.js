function runThermalRise() {
  // ── Sync from S object ──
  const autoSync = () => {
    const Cth_auto = (S.pack_mass||0) * ((S.c_cp_pack||1025)) / 1000; // kJ/K
    if (Cth_auto > 0) setField('tr_Cth', Cth_auto.toFixed(1));
    // ── Pack IR: prefer actual calculated pack resistance from Resistance tab ──
    // S._packIR_bol is set by calcResistance() in mΩ
    const ir_from_res = S._packIR_bol || 0;  // set by calcResistance in mΩ
    const ir_from_cell = (S.c_ir_bol||0) * (S.S_total||112) / (S.c_pp||1) * 1000; // approximate
    const ir_mOhm = ir_from_res > 0 ? ir_from_res : ir_from_cell;
    if (ir_mOhm > 0) setField('tr_ir', ir_mOhm.toFixed(1));
    setField('tr_Vnom', (S.V_nom_pack||358).toFixed(0));
    setField('tr_Qah',  (S.Q_pack||120).toFixed(0));
    if (S.t_tcell_max) setField('tr_T_limit', S.t_tcell_max.toFixed(0));
    if (S.t_tcell_max) setField('tr_T_derate', (S.t_tcell_max - 10).toFixed(0));
  };
  try { autoSync(); } catch(e) {}

  // ── Read inputs ──
  const T0        = +getV('tr_T0')       || 25;
  const Tamb      = +getV('tr_Tamb')     || 25;
  const C_th      = (+getV('tr_Cth')     || 60) * 1000;  // J/K (convert kJ→J)
  const R_pack    = (+getV('tr_ir')      || 149) / 1000; // Ω (mΩ→Ω)
  const tms_mode  = document.getElementById('tr_tms_mode')?.value || 'liquid';
  const flow      = +getV('tr_flow')     || 8;  // L/min
  const Tcool_in  = +getV('tr_Tcool_in') || 25;
  const h_conv    = +getV('tr_h_conv')   || 30;  // W/K
  const T_on      = +getV('tr_Ton')      || 30;
  const T_off     = +getV('tr_Toff')     || 27;
  const T_derate  = +getV('tr_T_derate') || 45;
  const T_limit   = +getV('tr_T_limit')  || 55;
  const T_tr      = +getV('tr_T_tr')     || 80;
  const Vnom      = +getV('tr_Vnom')     || 358;
  const Qah       = +getV('tr_Qah')      || 120;

  // ── TMS cooling capacity (W/K from coolant) ──
  // Q_tms = m_dot × Cp_coolant × (T_cell - T_coolant_in)
  // m_dot [kg/s] = flow[L/min] × 1.07[kg/L] / 60
  const rho_cool = 1.07, Cp_cool = 3400;
  const m_dot = flow * rho_cool / 60;  // kg/s
  const UA_tms = m_dot * Cp_cool;       // W/K effective UA when TMS on

  // Forced air: 80W/K, Liquid: UA_tms (flow-dependent), Chiller: 1.5× liquid
  const UA_mode = { none: 0, air_forced: 80, liquid: UA_tms, liquid_chiller: UA_tms * 1.5 };
  const UA_cool = UA_mode[tms_mode] || UA_tms;

  // ── Get drive cycle points ──
  const dcPts = getDCPoints();
  if (dcPts.length < 2) {
    const el = document.getElementById('tr_canvas');
    if (el) {
      const ctx2 = el.getContext('2d');
      el.width=900; el.height=480;
      ctx2.fillStyle='#07080b'; ctx2.fillRect(0,0,900,480);
      ctx2.fillStyle='#3a567a'; ctx2.font='14px Barlow,sans-serif'; ctx2.textAlign='center';
      ctx2.fillText('Add drive cycle data above first → then run simulation', 450, 240);
    }
    return;
  }

  // ── Expand drive cycle to fine timesteps (1s resolution) ──
  const tStart = dcPts[0].t, tEnd = dcPts[dcPts.length-1].t;
  const dt = 1.0; // 1s timestep

  // Interpolate power at any time
  const interpPower = (t) => {
    if (t <= dcPts[0].t) return dcPts[0].p;
    if (t >= dcPts[dcPts.length-1].t) return dcPts[dcPts.length-1].p;
    for (let j = 1; j < dcPts.length; j++) {
      if (dcPts[j].t >= t) {
        const frac = (t - dcPts[j-1].t) / (dcPts[j].t - dcPts[j-1].t);
        return dcPts[j-1].p + frac * (dcPts[j].p - dcPts[j-1].p);
      }
    }
    return dcPts[dcPts.length-1].p;
  };

  // ── State variables ──
  let T_cell   = T0;      // cell temperature
  let T_cool   = Tcool_in; // coolant outlet temperature (warms as it flows)
  let tms_on   = false;
  let SoC      = 100;     // %
  let E_used   = 0;       // kWh

  // ── Output arrays ──
  const N = Math.floor((tEnd - tStart) / dt) + 1;
  const times=[], T_cells=[], T_cools=[], powers=[], currents=[], tms_states=[], SoCs=[];
  const Q_gens=[], Q_tmss=[], Q_convs=[];

  // Event log
  const events = [];
  let t_derate_first = null, t_limit_first = null, t_tr_first = null;
  let T_peak = T0, T_peak_t = 0;
  let E_tms_total = 0; // Wh removed by TMS

  for (let i = 0; i < N; i++) {
    const t = tStart + i * dt;
    const P_mech = interpPower(t);  // kW (+ discharge, - regen)
    const P_elec = Math.abs(P_mech) * 1000;  // W
    const I = Vnom > 0 ? P_elec / Vnom : 0;  // A

    // SoC integration (Coulomb counting, simplified)
    SoC = Math.max(0, SoC - (P_mech / (Vnom * Qah / 1000)) * dt / 3600 * 100);
    E_used += P_mech * dt / 3600;  // kWh

    // I²R heat generation
    const Q_gen = I * I * R_pack;  // W

    // TMS hysteresis control
    if (!tms_on && T_cell > T_on)  tms_on = true;
    if ( tms_on && T_cell < T_off) tms_on = false;

    // Cooling: TMS + convection
    const Q_tms  = tms_on ? UA_cool * (T_cell - Tcool_in) : 0;  // W
    const Q_conv = h_conv  * (T_cell - Tamb);                     // W

    // Temperature rise: lumped capacitance dT = (Q_gen - Q_tms - Q_conv) × dt / C_th
    const dT = (Q_gen - Q_tms - Q_conv) * dt / C_th;
    T_cell = T_cell + dT;

    // Coolant outlet temp model
    T_cool = tms_on ? (Tcool_in + Q_tms / Math.max(UA_cool, 1)) : Tamb;

    // Record state
    times.push(t);
    T_cells.push(T_cell);
    T_cools.push(T_cool);
    powers.push(P_mech);
    currents.push(I);
    tms_states.push(tms_on ? 1 : 0);
    SoCs.push(SoC);
    Q_gens.push(Q_gen);
    Q_tmss.push(Q_tms);
    Q_convs.push(Q_conv);
    if (tms_on) E_tms_total += Q_tms * dt / 3600;  // Wh

    // Track peak
    if (T_cell > T_peak) { T_peak = T_cell; T_peak_t = t; }

    // Event detection
    if (!t_derate_first && T_cell > T_derate) { t_derate_first = t; events.push({t, type:'derate', T: T_cell}); }
    if (!t_limit_first  && T_cell > T_limit)  { t_limit_first  = t; events.push({t, type:'limit',  T: T_cell}); }
    if (!t_tr_first     && T_cell > T_tr)     { t_tr_first     = t; events.push({t, type:'runaway',T: T_cell}); }
  }

  // ── Store results in S for TVR ──
  S._Tcell_max = T_peak;
  S._V_flow    = flow;

  // ── DRAW ──
  drawThermalRiseCanvas({
    times, T_cells, T_cools, powers, tms_states, SoCs, Q_gens, Q_tmss,
    T_derate, T_limit, T_tr, T_on, T_off, Tamb, T0, tms_mode,
    events, T_peak, T_peak_t, E_tms_total, E_used: Math.abs(E_used)
  });

  // ── KPI strip ──
  const kpiEl = document.getElementById('tr_kpi');
  if (kpiEl) {
    const kpis = [
      {l:'Peak Cell Temp', v:T_peak.toFixed(1)+'°C', c: T_peak>T_limit?'err': T_peak>T_derate?'warn':'ok'},
      {l:'Temp Rise',      v:(T_peak-T0).toFixed(1)+'°C', c: (T_peak-T0)>20?'warn':'ok'},
      {l:'TMS Triggers',   v:events.filter(e=>e.type==='derate').length > 0 ? 'Yes @'+t_derate_first+'s':'No', c:t_derate_first?'warn':'ok'},
      {l:'Energy Used',    v:Math.abs(E_used).toFixed(2)+' kWh', c:'neutral'},
      {l:'TMS Heat Rm.',   v:(E_tms_total/1000).toFixed(2)+' kWh', c:'neutral'},
      {l:'Final SoC',      v:SoCs[SoCs.length-1].toFixed(1)+'%', c:SoCs[SoCs.length-1]<20?'err':SoCs[SoCs.length-1]<40?'warn':'ok'},
    ];
    kpiEl.innerHTML = kpis.map(k=>`
      <div style="background:var(--bg3);border:1px solid var(--${k.c==='ok'?'border':k.c==='warn'?'border':k.c==='err'?'border':'border'});border-radius:8px;padding:10px 12px;
        ${k.c==='err'?'border-color:rgba(255,77,109,.4);background:rgba(255,77,109,.06)':
          k.c==='warn'?'border-color:rgba(245,197,24,.4);background:rgba(245,197,24,.06)':
          k.c==='ok'?'border-color:rgba(0,212,170,.3);background:rgba(0,212,170,.05)':''}">
        <div style="font-size:10px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">${k.l}</div>
        <div style="font-size:18px;font-weight:700;font-family:var(--mono);color:${k.c==='err'?'#ff4d6d':k.c==='warn'?'#f5c518':k.c==='ok'?'#00d4aa':'#dde8f8'}">${k.v}</div>
      </div>`).join('');
  }

  // ── Event log ──
  const logEl = document.getElementById('tr_log');
  if (logEl) {
    if (events.length === 0) {
      logEl.innerHTML = '<span style="color:#00d4aa">✅ No thermal limit events during this drive cycle.</span>';
    } else {
      logEl.innerHTML = events.map(ev => {
        const icons = {derate:'⚠️', limit:'🔴', runaway:'☢️'};
        const msgs  = {derate:`Power derate threshold (${T_derate}°C) reached`, limit:`Hard cutoff threshold (${T_limit}°C) reached — BMS would SHUTDOWN`, runaway:`Thermal runaway onset (${T_tr}°C) — CRITICAL`};
        const cols  = {derate:'#f5c518', limit:'#ff4d6d', runaway:'#ff0000'};
        return `<span style="color:${cols[ev.type]}">${icons[ev.type]} t=${ev.t.toFixed(0)}s: ${msgs[ev.type]} [T_cell=${ev.T.toFixed(1)}°C]</span><br>`;
      }).join('');
    }
  }
}

// ── CANVAS RENDERER ──
function drawThermalRiseCanvas(d) {
  const canvas = document.getElementById('tr_canvas');
  if (!canvas) return;
  const W = 900, H = 480;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#07080b';
  ctx.fillRect(0, 0, W, H);

  const padL = 64, padR = 24, padMid = 18;
  const topH  = Math.floor((H - padMid) * 0.42);  // power panel height
  const botH  = H - topH - padMid;                 // temperature panel height
  const topT  = 22;
  const botT  = topT + topH + padMid;
  const pw    = W - padL - padR;
  const { times, T_cells, T_cools, powers, tms_states, SoCs, Q_gens, Q_tmss,
          T_derate, T_limit, T_tr, T_on, Tamb, T0, events, T_peak, T_peak_t } = d;

  if (times.length < 2) return;
  const tMin = times[0], tMax = times[times.length-1];
  const mapXt = t => padL + (t - tMin) / (tMax - tMin) * pw;

  // ─────────────────────────────────
  // TOP PANEL: Power profile
  // ─────────────────────────────────
  const maxP = Math.max(1, ...powers.map(Math.abs));
  const minP = Math.min(...powers);
  const pRange = Math.max(maxP, Math.abs(minP)) * 1.15;

  const mapYp = p => topT + (topH - 8) * (1 - (p + pRange) / (2 * pRange));

  // Panel background
  ctx.fillStyle = 'rgba(8,15,28,0.6)';
  ctx.fillRect(padL, topT, pw, topH);

  // TMS-on shading (top panel)
  let inTMS = false, tmsStart = 0;
  tms_states.forEach((on, i) => {
    if (on && !inTMS) { inTMS = true; tmsStart = times[i]; }
    if (!on && inTMS) {
      ctx.fillStyle = 'rgba(59,130,246,0.07)';
      ctx.fillRect(mapXt(tmsStart), topT, mapXt(times[i]) - mapXt(tmsStart), topH);
      inTMS = false;
    }
  });
  if (inTMS) {
    ctx.fillStyle = 'rgba(59,130,246,0.07)';
    ctx.fillRect(mapXt(tmsStart), topT, mapXt(tMax) - mapXt(tmsStart), topH);
  }

  // Zero line
  const zeroY = mapYp(0);
  ctx.strokeStyle = 'rgba(100,130,170,0.4)'; ctx.lineWidth = 1;
  ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(padL, zeroY); ctx.lineTo(padL+pw, zeroY); ctx.stroke();
  ctx.setLineDash([]);

  // Grid lines (top)
  ctx.strokeStyle = 'rgba(24,40,64,0.7)'; ctx.lineWidth = 1;
  for (let p = -Math.ceil(pRange/10)*10; p <= Math.ceil(pRange/10)*10; p += Math.ceil(pRange/20)*10) {
    const y = mapYp(p);
    if (y < topT || y > topT+topH) continue;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL+pw, y); ctx.stroke();
    ctx.fillStyle = '#4a6080'; ctx.font = '11px JetBrains Mono,monospace'; ctx.textAlign = 'right';
    ctx.fillText(p.toFixed(0)+'kW', padL-5, y+4);
  }

  // SoC fill under power
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, topT, pw, topH);
  ctx.clip();
  const socGrad = ctx.createLinearGradient(padL, 0, padL+pw, 0);
  socGrad.addColorStop(0, 'rgba(0,212,170,0.15)');
  socGrad.addColorStop(1, 'rgba(59,130,246,0.06)');
  // Shade based on SoC level
  ctx.beginPath();
  ctx.moveTo(mapXt(tMin), topT + topH);
  SoCs.forEach((soc, i) => {
    const x = mapXt(times[i]);
    const yFill = topT + topH * (1 - soc/100);
    i === 0 ? ctx.lineTo(x, yFill) : ctx.lineTo(x, yFill);
  });
  ctx.lineTo(mapXt(tMax), topT+topH);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,212,170,0.07)';
  ctx.fill();
  ctx.restore();

  // Power curve (fill)
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, topT, pw, topH);
  ctx.clip();
  const pFillGrad = ctx.createLinearGradient(0, topT, 0, topT+topH);
  pFillGrad.addColorStop(0, 'rgba(255,123,53,0.18)');
  pFillGrad.addColorStop(1, 'rgba(255,123,53,0.02)');
  ctx.beginPath();
  ctx.moveTo(mapXt(tMin), zeroY);
  powers.forEach((p, i) => { i===0 ? ctx.lineTo(mapXt(times[i]), mapYp(p)) : ctx.lineTo(mapXt(times[i]), mapYp(p)); });
  ctx.lineTo(mapXt(tMax), zeroY);
  ctx.closePath();
  ctx.fillStyle = pFillGrad;
  ctx.fill();
  ctx.restore();

  // Power line
  ctx.beginPath();
  ctx.strokeStyle = '#ff7b35'; ctx.lineWidth = 2.5;
  powers.forEach((p, i) => {
    const x = mapXt(times[i]), y = mapYp(p);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Panel header
  ctx.fillStyle = 'rgba(7,8,11,0.7)';
  ctx.fillRect(padL+4, topT+4, 120, 18);
  ctx.fillStyle = '#ff7b35'; ctx.font = 'bold 11px Barlow,sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Power Profile (kW)', padL+8, topT+17);

  // ─────────────────────────────────
  // BOTTOM PANEL: Temperature
  // ─────────────────────────────────
  const allT = [...T_cells, Tamb, T0, T_derate, T_limit];
  const Tplot_min = Math.min(...allT) - 3;
  const Tplot_max = Math.max(T_tr + 5, Math.max(...allT) + 5);
  const mapYT = T => botT + (botH - 8) * (1 - (T - Tplot_min) / (Tplot_max - Tplot_min));

  // Panel background
  ctx.fillStyle = 'rgba(8,15,28,0.6)';
  ctx.fillRect(padL, botT, pw, botH);

  // TMS shading (bottom panel) — same zones as top
  inTMS = false; tmsStart = 0;
  tms_states.forEach((on, i) => {
    if (on && !inTMS) { inTMS = true; tmsStart = times[i]; }
    if (!on && inTMS) {
      ctx.fillStyle = 'rgba(59,130,246,0.09)';
      ctx.fillRect(mapXt(tmsStart), botT, mapXt(times[i]) - mapXt(tmsStart), botH);
      inTMS = false;
    }
  });
  if (inTMS) {
    ctx.fillStyle = 'rgba(59,130,246,0.09)';
    ctx.fillRect(mapXt(tmsStart), botT, mapXt(tMax) - mapXt(tmsStart), botH);
  }

  // Grid lines (bottom)
  ctx.strokeStyle = 'rgba(24,40,64,0.7)'; ctx.lineWidth = 1;
  const Tstep = Math.ceil((Tplot_max - Tplot_min) / 6 / 5) * 5;
  for (let T = Math.floor(Tplot_min/5)*5; T <= Tplot_max; T += Tstep) {
    const y = mapYT(T);
    if (y < botT || y > botT+botH) continue;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL+pw, y); ctx.stroke();
    ctx.fillStyle = '#4a6080'; ctx.font = '11px JetBrains Mono,monospace'; ctx.textAlign = 'right';
    ctx.fillText(T+'°C', padL-5, y+4);
  }

  // ── Threshold lines ──
  const thresholds = [
    { T: Tamb,     col: '#6d8fba', dash: [3,3], lbl: `T_amb ${Tamb}°C` },
    { T: T_derate, col: '#f5c518', dash: [6,3], lbl: `Derate ${T_derate}°C` },
    { T: T_limit,  col: '#ff4d6d', dash: [6,3], lbl: `Limit ${T_limit}°C` },
    { T: T_tr,     col: '#ff0000', dash: [4,2], lbl: `T/R ${T_tr}°C` },
  ];
  thresholds.forEach(th => {
    if (th.T < Tplot_min || th.T > Tplot_max) return;
    const y = mapYT(th.T);
    ctx.strokeStyle = th.col; ctx.lineWidth = 1.5; ctx.setLineDash(th.dash);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL+pw, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = th.col; ctx.font = 'bold 10px JetBrains Mono,monospace'; ctx.textAlign = 'right';
    ctx.fillText(th.lbl, padL+pw+22, y+4);
  });

  // ── Coolant temp fill between T_cool and Tamb ──
  ctx.save();
  ctx.beginPath(); ctx.rect(padL, botT, pw, botH); ctx.clip();
  ctx.beginPath();
  ctx.moveTo(mapXt(tMin), mapYT(Tamb));
  T_cools.forEach((T, i) => { i===0 ? ctx.lineTo(mapXt(times[i]), mapYT(T)) : ctx.lineTo(mapXt(times[i]), mapYT(T)); });
  ctx.lineTo(mapXt(tMax), mapYT(Tamb));
  ctx.closePath();
  ctx.fillStyle = 'rgba(59,130,246,0.10)';
  ctx.fill();
  ctx.restore();

  // ── Cell temp fill (gradient: green→orange→red) ──
  ctx.save();
  ctx.beginPath(); ctx.rect(padL, botT, pw, botH); ctx.clip();
  ctx.beginPath();
  ctx.moveTo(mapXt(tMin), mapYT(Tamb));
  T_cells.forEach((T, i) => { i===0 ? ctx.lineTo(mapXt(times[i]), mapYT(T)) : ctx.lineTo(mapXt(times[i]), mapYT(T)); });
  ctx.lineTo(mapXt(tMax), mapYT(Tamb));
  ctx.closePath();
  const tempFill = ctx.createLinearGradient(0, mapYT(T_tr), 0, mapYT(Tamb));
  tempFill.addColorStop(0, 'rgba(255,0,0,0.25)');
  tempFill.addColorStop(0.5, 'rgba(255,77,109,0.15)');
  tempFill.addColorStop(1, 'rgba(0,212,170,0.10)');
  ctx.fillStyle = tempFill;
  ctx.fill();
  ctx.restore();

  // Coolant line
  ctx.beginPath(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.8; ctx.setLineDash([4,3]);
  T_cools.forEach((T, i) => {
    const x = mapXt(times[i]), y = mapYT(T);
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.stroke(); ctx.setLineDash([]);

  // Cell temp line (coloured by zone)
  const drawSeg = (i0, i1, col) => {
    ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = 2.8;
    for (let i = i0; i <= i1; i++) {
      const x = mapXt(times[i]), y = mapYT(T_cells[i]);
      i === i0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.stroke();
  };
  // Segment by temp zone
  let seg_start = 0;
  for (let i = 1; i <= T_cells.length; i++) {
    const T_curr = T_cells[Math.min(i, T_cells.length-1)];
    const T_prev = T_cells[i-1];
    const zone_curr = T_curr > T_tr ? 3 : T_curr > T_limit ? 2 : T_curr > T_derate ? 1 : 0;
    const zone_prev = T_prev > T_tr ? 3 : T_prev > T_limit ? 2 : T_prev > T_derate ? 1 : 0;
    if (zone_curr !== zone_prev || i === T_cells.length) {
      const col = ['#00d4aa','#f5c518','#ff7b35','#ff0000'][zone_prev];
      drawSeg(seg_start, i-1, col);
      seg_start = i-1;
    }
  }

  // Peak temp annotation
  const xPeak = mapXt(T_peak_t), yPeak = mapYT(T_peak);
  ctx.beginPath(); ctx.arc(xPeak, yPeak, 5, 0, Math.PI*2);
  const peakCol = T_peak > T_tr ? '#ff0000' : T_peak > T_limit ? '#ff4d6d' : T_peak > T_derate ? '#f5c518' : '#00d4aa';
  ctx.fillStyle = peakCol; ctx.fill();
  ctx.strokeStyle = '#07080b'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = peakCol; ctx.font = 'bold 12px JetBrains Mono,monospace'; ctx.textAlign = 'center';
  ctx.fillText(`Peak: ${T_peak.toFixed(1)}°C`, xPeak, yPeak - 12);

  // Event markers (vertical lines at events)
  events.forEach(ev => {
    const cols2 = {derate:'#f5c518', limit:'#ff4d6d', runaway:'#ff0000'};
    const col = cols2[ev.type] || '#fff';
    const x = mapXt(ev.t);
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([3,2]);
    ctx.beginPath(); ctx.moveTo(x, topT); ctx.lineTo(x, botT+botH); ctx.stroke();
    ctx.setLineDash([]);
    // Label at top
    ctx.fillStyle = col; ctx.font = 'bold 10px Barlow,sans-serif'; ctx.textAlign = 'center';
    const lbls = {derate:'⚠ DERATE', limit:'🔴 CUTOFF', runaway:'☢ T/R'};
    ctx.fillText(lbls[ev.type]||'!', x, topT+11);
  });

  // Panel header
  ctx.fillStyle = 'rgba(7,8,11,0.7)';
  ctx.fillRect(padL+4, botT+4, 200, 18);
  ctx.fillStyle = '#f5c518'; ctx.font = 'bold 11px Barlow,sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`Cell Temp (°C)  |  T_peak: ${T_peak.toFixed(1)}°C`, padL+8, botT+17);

  // X-axis (shared)
  ctx.fillStyle = '#6d8fba'; ctx.font = '11px JetBrains Mono,monospace'; ctx.textAlign = 'center';
  const nTicks = 8;
  for (let i = 0; i <= nTicks; i++) {
    const t = tMin + (tMax-tMin)*i/nTicks;
    const x = mapXt(t);
    const label = t < 120 ? t.toFixed(0)+'s' : t < 3600 ? (t/60).toFixed(1)+'m' : (t/3600).toFixed(2)+'h';
    ctx.fillText(label, x, H-6);
  }

  // Legend strip
  const legendItems = [
    {col:'#ff7b35', dash:[], lbl:'Power (kW)'},
    {col:'#00d4aa', dash:[], lbl:'Cell temp'},
    {col:'#f5c518', dash:[], lbl:'Derate zone'},
    {col:'#ff4d6d', dash:[], lbl:'Limit zone'},
    {col:'#3b82f6', dash:[4,3],lbl:'Coolant temp'},
  ];
  let lx = padL;
  ctx.font = '11px Barlow,sans-serif';
  legendItems.forEach(({col,dash,lbl}) => {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(lx, topT-10); ctx.lineTo(lx+20, topT-10); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#aac'; ctx.textAlign = 'left';
    ctx.fillText(lbl, lx+24, topT-6);
    lx += ctx.measureText(lbl).width + 46;
  });
}




// ══════════════════════════════════════════════════════════════════
// 3D PACK VIEWER ENGINE — Three.js r128
// File upload: STL binary/ASCII, OBJ, GLTF/GLB
// Clean orbit, pan, zoom — measure tool — demo primitives
// ══════════════════════════════════════════════════════════════════
(function() {

// ── State ──
let renderer, scene, camera, animId;
