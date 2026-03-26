function getPMModes() {
  const rows = document.querySelectorAll('#pm_mode_rows .pm-row');
  const defaultLabels = ['Cont. Discharge','Peak Discharge','DC Charge','AC Charge'];
  const defaultDurs   = [3600, 30, 3600, 7200];
  const modes = [];
  rows.forEach((row, i) => {
    const valEl = row.querySelector('.pm-val');
    const durEl = row.querySelector('.pm-dur');
    const lblEl = row.querySelector('.pm-label');
    const val   = parseFloat(valEl?.value);
    const dur   = parseFloat(durEl?.value) || defaultDurs[i] || 60;
    const col   = valEl?.dataset.col  || '#00d4aa';
    const dash  = (valEl?.dataset.dash || '').split(',').map(Number).filter(n => !isNaN(n) && n > 0);
    const label = lblEl?.value?.trim() || defaultLabels[i] || `Mode ${i+1}`;
    if (!isNaN(val) && val > 0) modes.push({ label, val, dur, col, dash });
  });
  return modes;
}

function drawPowerMap() {
  const canvas = document.getElementById('pm_canvas');
  if (!canvas) return;

  const W = 800, H = 420;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, W, H);

  const vmin  = parseFloat(document.getElementById('pm_vmin')?.value)       || S.t_vmin_sys || 250;
  const vmax  = parseFloat(document.getElementById('pm_vmax')?.value)       || S.t_vmax_sys || 500;
  const vnom  = parseFloat(document.getElementById('pm_vnom')?.value)       || S.V_nom_pack || 358;
  const Imax  = parseFloat(document.getElementById('pm_Imax')?.value)       || 300;
  const tCont = parseFloat(document.getElementById('pm_target_cont')?.value)|| S.t_pcont    || 50;
  const tPeak = parseFloat(document.getElementById('pm_target_peak')?.value)|| S.t_ppeak    || 80;
  const tDur  = parseFloat(document.getElementById('pm_target_dur')?.value) || 30;
  const modes = getPMModes();
  const view  = window._pmView || 'pv';

  if (vmax <= vmin || modes.length === 0) {
    ctx.fillStyle = '#3a567a'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Enter voltage window and at least one power mode', W/2, H/2); return;
  }

  const pad = { l: 58, r: 28, t: 32, b: 48 };
  const pw  = W - pad.l - pad.r;
  const ph  = H - pad.t - pad.b;

  // ── DRAW HELPERS ──
  const grid = (xTicks, yTicks, mapX, mapY) => {
    ctx.strokeStyle = '#182840'; ctx.lineWidth = 1;
    yTicks.forEach(v => {
      const y = mapY(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W-pad.r, y); ctx.stroke();
      ctx.fillStyle='#3a567a'; ctx.font='10px JetBrains Mono,monospace'; ctx.textAlign='right';
      ctx.fillText(Math.round(v), pad.l-5, y+3);
    });
    xTicks.forEach(v => {
      const x = mapX(v);
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H-pad.b); ctx.stroke();
      ctx.fillStyle='#3a567a'; ctx.font='10px JetBrains Mono,monospace'; ctx.textAlign='center';
      ctx.fillText(Math.round(v), x, H-pad.b+14);
    });
  };

  const axisLabel = (xl, yl) => {
    ctx.fillStyle='#4a6080'; ctx.font='11px JetBrains Mono,monospace';
    ctx.textAlign='left';  ctx.fillText(yl, pad.l, pad.t-10);
    ctx.textAlign='center'; ctx.fillText(xl, pad.l+pw/2, H-6);
  };

  const inlineLabel = (txt, x, y, col) => {
    ctx.font='10px JetBrains Mono,monospace'; ctx.textAlign='left';
    const tw = ctx.measureText(txt).width;
    ctx.fillStyle='rgba(4,8,15,.85)'; ctx.fillRect(x+3, y-13, tw+6, 15);
    ctx.fillStyle=col; ctx.fillText(txt, x+6, y-2);
  };

  const threshold = (yVal, col, label) => {
    ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.setLineDash([6,4]);
    ctx.beginPath(); ctx.moveTo(pad.l, yVal); ctx.lineTo(W-pad.r, yVal); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=col; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='right';
    ctx.fillText(label, W-pad.r-2, yVal-3);
  };

  // ════════════════════════════
  // VIEW 1 & 2: P vs V  /  I vs V
  // ════════════════════════════
  if (view === 'pv' || view === 'iv') {
    const Pmax = Math.max(...modes.map(m => m.val)) * 1.38;
    const ImaxPlot = view==='iv' ? Math.min(Imax*1.3, Pmax*1000/vmin*1.15)
                                 : 0;
    const mapX = v => pad.l + (v-vmin)/(vmax-vmin)*pw;
    const mapYp = p => pad.t + ph*(1-p/Pmax);
    const mapYi = I => pad.t + ph*(1-I/ImaxPlot);
    const mapY  = view==='pv' ? mapYp : mapYi;

    const vSpan = vmax-vmin;
    const vStep = vSpan<=150?25:vSpan<=300?50:vSpan<=600?100:200;
    const xTicks = []; for(let v=Math.ceil(vmin/vStep)*vStep;v<=vmax;v+=vStep) xTicks.push(v);
    const yTicks = [];
    if(view==='pv'){const ps=Pmax<=60?10:Pmax<=120?20:Pmax<=300?50:100; for(let p=0;p<=Pmax;p+=ps) yTicks.push(p);}
    else           {const is=ImaxPlot<=200?50:ImaxPlot<=600?100:200; for(let I=0;I<=ImaxPlot;I+=is) yTicks.push(I);}
    grid(xTicks, yTicks, mapX, mapY);

    // Target threshold lines (pv only)
    if(view==='pv'){
      threshold(mapYp(tCont), 'rgba(0,212,170,.55)', `Target Cont. ${tCont}kW`);
      threshold(mapYp(tPeak), 'rgba(255,123,53,.55)', `Target Peak ${tPeak}kW`);
    }

    // I_max hyperbola (pv only)
    if(view==='pv'){
      ctx.beginPath(); ctx.strokeStyle='rgba(245,197,24,.5)'; ctx.lineWidth=1.5; ctx.setLineDash([4,6]);
      let first=true;
      for(let v=vmin;v<=vmax;v+=2){
        const p=Math.min(v*Imax/1000,Pmax*.98);
        const x=mapX(v),y=mapYp(p);
        if(first){ctx.moveTo(x,y);first=false;}else ctx.lineTo(x,y);
      }
      ctx.stroke(); ctx.setLineDash([]);
      const vKnee=Pmax*1000/Imax;
      if(vKnee>=vmin&&vKnee<=vmax){
        ctx.fillStyle='rgba(245,197,24,.65)'; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='left';
        ctx.fillText(`I_max=${Imax}A`, mapX(vKnee)+4, mapYp(Pmax*.95)-4);
      }
    }

    // Mode curves
    modes.forEach((mode, mi) => {
      const pts = [];
      for(let k=0;k<=160;k++){
        const v=vmin+(vmax-vmin)*k/160;
        const p=Math.min(mode.val,v*Imax/1000);
        const I=p*1000/v;
        pts.push([mapX(v), view==='pv'?mapYp(p):mapYi(I)]);
      }
      if(mi===0&&view==='pv'){
        ctx.beginPath();
        ctx.moveTo(pts[0][0],mapYp(0));
        pts.forEach(([x,y])=>ctx.lineTo(x,y));
        ctx.lineTo(pts[pts.length-1][0],mapYp(0));
        ctx.closePath(); ctx.fillStyle=mode.col+'18'; ctx.fill();
      }
      ctx.beginPath(); ctx.strokeStyle=mode.col; ctx.lineWidth=mi===0?2.8:1.8;
      if(mode.dash.length)ctx.setLineDash(mode.dash);
      pts.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));
      ctx.stroke(); ctx.setLineDash([]);
      const li=Math.floor(pts.length*.14);
      inlineLabel(`${mode.label} ${mode.val}kW`, pts[li][0], pts[li][1], mode.col);
    });

    // V_nom marker
    if(vnom>=vmin&&vnom<=vmax){
      const xN=mapX(vnom);
      ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=1; ctx.setLineDash([3,5]);
      ctx.beginPath(); ctx.moveTo(xN,pad.t); ctx.lineTo(xN,H-pad.b); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle='rgba(255,255,255,.35)'; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='center';
      ctx.fillText('V_nom '+Math.round(vnom)+'V', xN, pad.t-5);
      modes.forEach(mode=>{
        const p=Math.min(mode.val,vnom*Imax/1000);
        ctx.beginPath(); ctx.arc(xN,mapYp(p),5,0,Math.PI*2);
        ctx.fillStyle=mode.col; ctx.fill();
        ctx.strokeStyle='#07080b'; ctx.lineWidth=1.5; ctx.stroke();
      });
    }

    axisLabel('Voltage (V)', view==='pv'?'Power (kW)':'Current (A)');
  }

  // ════════════════════════════
  // VIEW 3: P vs Time (with target comparison)
  // ════════════════════════════
  else if (view === 'pt') {
    const Pmax = Math.max(...modes.map(m=>m.val), tPeak) * 1.35;
    const maxDur = Math.max(...modes.map(m=>m.dur), tDur) * 1.25;

    const mapX = t => pad.l + (t/maxDur)*pw;
    const mapY = p => pad.t + ph*(1-p/Pmax);

    const durStep = maxDur<=120?10:maxDur<=600?60:maxDur<=3600?300:1800;
    const xTicks = []; for(let t=0;t<=maxDur;t+=durStep) xTicks.push(t);
    const pStep  = Pmax<=60?10:Pmax<=120?20:Pmax<=300?50:100;
    const yTicks = []; for(let p=0;p<=Pmax;p+=pStep) yTicks.push(p);
    grid(xTicks, yTicks, mapX, mapY);

    // Target cont line
    threshold(mapY(tCont), 'rgba(0,212,170,.55)', `P_cont target ${tCont}kW`);
    // Target peak band: peak power × duration box
    const xTDur = mapX(tDur);
    ctx.fillStyle='rgba(255,123,53,.07)';
    ctx.fillRect(pad.l, mapY(tPeak), xTDur-pad.l, mapY(0)-mapY(tPeak));
    ctx.strokeStyle='rgba(255,123,53,.4)'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    ctx.strokeRect(pad.l, mapY(tPeak), xTDur-pad.l, mapY(0)-mapY(tPeak));
    ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,123,53,.7)'; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='left';
    ctx.fillText(`Target: ${tPeak}kW × ${tDur}s`, pad.l+4, mapY(tPeak)-4);

    // X-axis label formatting
    const fmtT = t => t>=3600?(t/3600).toFixed(1)+'h':t>=60?(t/60).toFixed(0)+'min':t+'s';

    // Draw each mode as a horizontal bar with duration
    modes.forEach(mode => {
      const x0=pad.l, x1=Math.min(mapX(mode.dur), W-pad.r);
      const y =mapY(mode.val);
      const yZ=mapY(0);

      // Bar fill
      ctx.fillStyle=mode.col+'22';
      ctx.fillRect(x0, y, x1-x0, yZ-y);

      // Horizontal power line
      ctx.beginPath(); ctx.strokeStyle=mode.col; ctx.lineWidth=2.5;
      ctx.setLineDash(mode.dash.length?mode.dash:[]);
      ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke(); ctx.setLineDash([]);

      // Duration end cap (vertical drop)
      ctx.beginPath(); ctx.strokeStyle=mode.col+'88'; ctx.lineWidth=1.5; ctx.setLineDash([3,3]);
      ctx.moveTo(x1,y); ctx.lineTo(x1,yZ); ctx.stroke(); ctx.setLineDash([]);

      // Label
      inlineLabel(`${mode.label}  ${mode.val}kW  ${fmtT(mode.dur)}`, x0+4, y, mode.col);

      // Target comparison dot
      const tgtP = mode.label.toLowerCase().includes('peak')||mode.label.toLowerCase().includes('cont')
        ? (mode.label.toLowerCase().includes('peak') ? tPeak : tCont) : null;
      const tgtD = mode.label.toLowerCase().includes('peak') ? tDur : null;
      if(tgtP){
        const passP = mode.val >= tgtP*0.98;
        const passD = tgtD ? mode.dur >= tgtD : true;
        const pass  = passP && passD;
        ctx.beginPath(); ctx.arc(x1+8, y, 5, 0, Math.PI*2);
        ctx.fillStyle = pass?'#00d4aa':'#ff4d6d'; ctx.fill();
      }
    });

    // X-axis ticks with time labels
    xTicks.forEach(t => {
      const x=mapX(t);
      ctx.fillStyle='#3a567a'; ctx.font='10px JetBrains Mono,monospace'; ctx.textAlign='center';
      ctx.fillText(fmtT(t), x, H-pad.b+14);
    });
    axisLabel('Time', 'Power (kW)');
  }

  // ════════════════════════════
  // VIEW 4: P vs I
  // ════════════════════════════
  else if (view === 'pi') {
    const Pmax    = Math.max(...modes.map(m=>m.val))*1.38;
    const ImaxPl  = Pmax*1000/vmin;
    const mapX    = I  => pad.l+(I/ImaxPl)*pw;
    const mapY    = p  => pad.t+ph*(1-p/Pmax);
    const iStep   = ImaxPl<=400?100:200;
    const xTicks  = []; for(let I=0;I<=ImaxPl;I+=iStep) xTicks.push(I);
    const pStep   = Pmax<=60?10:Pmax<=120?20:50;
    const yTicks  = []; for(let p=0;p<=Pmax;p+=pStep) yTicks.push(p);
    grid(xTicks, yTicks, mapX, mapY);

    threshold(mapY(tCont), 'rgba(0,212,170,.55)', `Target Cont. ${tCont}kW`);
    threshold(mapY(tPeak), 'rgba(255,123,53,.55)', `Target Peak ${tPeak}kW`);

    modes.forEach(mode => {
      const ptsV = [vmin, vnom, vmax];
      ptsV.forEach(v => {
        const p = Math.min(mode.val, v*Imax/1000);
        const I = p*1000/v;
        ctx.beginPath(); ctx.arc(mapX(I), mapY(p), 5, 0, Math.PI*2);
        ctx.fillStyle=mode.col; ctx.fill();
      });
      // Line connecting the 3 operating points
      ctx.beginPath(); ctx.strokeStyle=mode.col; ctx.lineWidth=1.8;
      if(mode.dash.length)ctx.setLineDash(mode.dash);
      ptsV.forEach((v,i)=>{
        const p=Math.min(mode.val,v*Imax/1000);
        const I=p*1000/v;
        i===0?ctx.moveTo(mapX(I),mapY(p)):ctx.lineTo(mapX(I),mapY(p));
      });
      ctx.stroke(); ctx.setLineDash([]);
      const p0=Math.min(mode.val,vmin*Imax/1000);
      inlineLabel(`${mode.label} ${mode.val}kW`, mapX(p0*1000/vmin)+4, mapY(p0), mode.col);
    });
    axisLabel('Current (A)', 'Power (kW)');
  }

  // ── Legend ──
  const legendEl = document.getElementById('pm_legend');
  if (legendEl) {
    legendEl.innerHTML = modes.map(m =>
      `<span style="display:flex;align-items:center;gap:5px">
        <span style="width:18px;height:3px;background:${m.col};display:inline-block;border-radius:2px"></span>
        <span style="color:${m.col}">${m.label} ${m.val}kW${view==='pt'?' / '+(m.dur>=3600?(m.dur/3600).toFixed(1)+'h':m.dur>=60?(m.dur/60).toFixed(0)+'min':m.dur+'s'):''}
        </span>
      </span>`
    ).join('') + (view==='pv'?`
      <span style="display:flex;align-items:center;gap:5px">
        <span style="width:18px;height:2px;background:rgba(245,197,24,.6);display:inline-block"></span>
        <span style="color:rgba(245,197,24,.7)">I_max=${Imax}A</span>
      </span>`:'');
  }

  // ── Target comparison panel ──
  const P0 = modes[0]?.val || 50;
  const P1 = modes.find(m=>m.label.toLowerCase().includes('peak'))?.val || modes[1]?.val || P0;
  const D1 = modes.find(m=>m.label.toLowerCase().includes('peak'))?.dur || modes[1]?.dur || 30;

  const passP0 = P0 >= tCont*0.98;
  const passP1 = P1 >= tPeak*0.98;
  const passD1 = D1 >= tDur;

  const tgtEl = document.getElementById('pm_target_result');
  if (tgtEl) tgtEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:7px;background:${passP0?'rgba(0,212,170,.08)':'rgba(255,77,109,.08)'};border:1px solid ${passP0?'rgba(0,212,170,.25)':'rgba(255,77,109,.25)'}">
        <span style="font-size:10px;color:var(--text2)">Cont. Power</span>
        <span style="font-family:var(--mono);font-size:11px;color:${passP0?'#00d4aa':'#ff4d6d'}">${P0}kW ${passP0?'≥':'<'} ${tCont}kW ${passP0?'✓':'✗'}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:7px;background:${passP1?'rgba(0,212,170,.08)':'rgba(255,77,109,.08)'};border:1px solid ${passP1?'rgba(0,212,170,.25)':'rgba(255,77,109,.25)'}">
        <span style="font-size:10px;color:var(--text2)">Peak Power</span>
        <span style="font-family:var(--mono);font-size:11px;color:${passP1?'#00d4aa':'#ff4d6d'}">${P1}kW ${passP1?'≥':'<'} ${tPeak}kW ${passP1?'✓':'✗'}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:7px;background:${passD1?'rgba(0,212,170,.08)':'rgba(255,77,109,.08)'};border:1px solid ${passD1?'rgba(0,212,170,.25)':'rgba(255,77,109,.25)'}">
        <span style="font-size:10px;color:var(--text2)">Peak Duration</span>
        <span style="font-family:var(--mono);font-size:11px;color:${passD1?'#00d4aa':'#ff4d6d'}">${D1}s ${passD1?'≥':'<'} ${tDur}s ${passD1?'✓':'✗'}</span>
      </div>
      <div style="padding:7px 10px;border-radius:7px;background:${passP0&&passP1&&passD1?'rgba(0,212,170,.12)':'rgba(255,77,109,.12)'};border:1px solid ${passP0&&passP1&&passD1?'rgba(0,212,170,.4)':'rgba(255,77,109,.4)'};text-align:center;font-weight:700;font-size:11px;color:${passP0&&passP1&&passD1?'#00d4aa':'#ff4d6d'}">
        ${passP0&&passP1&&passD1?'✓ ALL TARGETS MET':'✗ TARGETS NOT MET'}
      </div>
    </div>`;

  // ── Operating point summary ──
  const _pmsum = document.getElementById('pm_summary');
  if (_pmsum) _pmsum.innerHTML = `
    ${ri('I_cont @V_nom', (P0*1000/vnom).toFixed(0),      'A',  'ok',  `${P0}kW ÷ ${Math.round(vnom)}V`)}
    ${ri('I_peak @V_nom', (P1*1000/vnom).toFixed(0),      'A',  'warn',`${P1}kW ÷ ${Math.round(vnom)}V`)}
    ${ri('I_cont @V_min', (P0*1000/vmin).toFixed(0),      'A',  (P0*1000/vmin)<=Imax?'ok':'err','Worst-case')}
    ${ri('P_knee @I_max', (Imax*vmin/1000).toFixed(0),    'kW', 'blue','I×V_min')}
  `;


  // ── SOC-based derating overlay ──
  const Pcont = P0;                                           // cont power from modes
  const Ppeak = P1;                                           // peak power from modes
  const Pdc   = parseFloat(document.getElementById('pm_target_cont')?.value) || S.t_pdc || 60;
  const soc_lo        = +getV('pm_soc_lo')         || 20;
  const soc_hi        = +getV('pm_soc_hi')         || 80;
  const soc_lo_factor = +getV('pm_soc_lo_factor')  || 0.7;
  const soc_hi_factor = +getV('pm_soc_hi_factor')  || 0.6;

  // Map SoC% → voltage (linear approximation using pack V_min, V_nom, V_max)
  const socToV = (soc) => {
    if (soc <= 20)  return vmin + (soc/20)  * (vnom - vmin);
    if (soc <= 80)  return vnom + ((soc-20)/60) * 0 ; // flat LFP plateau
    return vnom + ((soc-80)/20) * (vmax - vnom);
  };
  const V_lo = vmin + (soc_lo/100) * (vmax - vmin);
  const V_hi = vmin + (soc_hi/100) * (vmax - vmin);

  // Derated cont power at low SoC
  const Pcont_lo = Pcont * soc_lo_factor;
  const Ppeak_lo = Ppeak * soc_lo_factor;
  const Pchg_hi  = getPMModes ? Math.min(Pdc, Pdc * soc_hi_factor) : Pdc * soc_hi_factor;

  // Draw low-SoC derating zone (left of V_lo)
  if (V_lo > vmin) {
    ctx.save();
    ctx.fillStyle = 'rgba(245,158,11,0.08)';
    ctx.fillRect(mapX(vmin), mapY(0), mapX(V_lo)-mapX(vmin), ph);
    ctx.strokeStyle = 'rgba(245,158,11,0.5)';
    ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(mapX(V_lo), pad.t); ctx.lineTo(mapX(V_lo), H-pad.b); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(245,158,11,0.8)'; ctx.font = '9px monospace';
    ctx.fillText(`SoC ${soc_lo}% (low)`, mapX(vmin)+4, pad.t+12);
    ctx.fillText(`P_derate=${(soc_lo_factor*100).toFixed(0)}%`, mapX(vmin)+4, pad.t+24);
    ctx.restore();
  }

  // Draw high-SoC zone (right of V_hi) — charge derating
  if (V_hi < vmax) {
    ctx.save();
    ctx.fillStyle = 'rgba(139,92,246,0.07)';
    ctx.fillRect(mapX(V_hi), mapY(0), mapX(vmax)-mapX(V_hi), ph);
    ctx.strokeStyle = 'rgba(139,92,246,0.4)';
    ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(mapX(V_hi), pad.t); ctx.lineTo(mapX(V_hi), H-pad.b); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(139,92,246,0.8)'; ctx.font = '9px monospace';
    ctx.fillText(`SoC ${soc_hi}% (hi)`, mapX(V_hi)+4, pad.t+12);
    ctx.fillText(`Chg_derate=${(soc_hi_factor*100).toFixed(0)}%`, mapX(V_hi)+4, pad.t+24);
    ctx.restore();
  }

  // Low-SoC derated discharge line (amber)
  if (V_lo > vmin) {
    ctx.beginPath(); ctx.strokeStyle = 'rgba(245,158,11,0.8)'; ctx.lineWidth = 1.5;
    ctx.setLineDash([5,3]); let fst=true;
    for (let v=vmin; v<=V_lo; v+=2) {
      const p = Math.min(Pcont_lo, v*Imax/1000);
      fst ? (ctx.moveTo(mapX(v),mapY(p)),fst=false) : ctx.lineTo(mapX(v),mapY(p));
    }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(245,158,11,0.8)'; ctx.font='9px monospace';
    ctx.fillText(`Pcont(low SoC)=${Pcont_lo.toFixed(0)}kW`, pad.l+8, mapY(Pcont_lo)+12);
  }

  // Update status line
  const statusEl = document.getElementById('pm_soc_status');
  if (statusEl) {
    statusEl.innerHTML = `SoC zones: Low&lt;${soc_lo}% → ${(soc_lo_factor*100).toFixed(0)}% derate | High&gt;${soc_hi}% → charge taper ${(soc_hi_factor*100).toFixed(0)}%`;
  }

  // ── ePT efficiency bars ──
  const eff_el = document.getElementById('pm_eff_bars');
  if (eff_el) eff_el.innerHTML = [
    {l:'Cont. discharge',v:94},{l:'Peak 30s',v:89},
    {l:'DC fast charge', v:95},{l:'AC charge',v:92},{l:'Regen',v:88},
  ].map(e=>tbar(e.l,e.v,100,'%',e.v>=90?'var(--g)':'var(--o)')).join('');
}

function calcCoolingPressureDrop() {
  const Q = getV('cp_flow')||3; // L/min
  const L = getV('cp_length')||12.62; // m
  const D = (getV('cp_dia')||8.7)/1000; // input in mm → convert to m
  const T = getV('cp_temp')||25; // °C
  // Glycol-water 50/50 properties
  const rho = T < 0 ? 1096 : T < 20 ? 1090 - (T/20)*14 : 1076 - (T/25)*12; // kg/m3
  const mu_map = [[-15,0.02],[0,0.0096],[25,0.0031],[45,0.0017]];
  let mu = 0.0031;
  for(let i=0;i<mu_map.length-1;i++){if(T>=mu_map[i][0]&&T<=mu_map[i+1][0]){mu=mu_map[i][1]+(T-mu_map[i][0])/(mu_map[i+1][0]-mu_map[i][0])*(mu_map[i+1][1]-mu_map[i][1]);break;}}
  const Q_m3s = Q/60000; // m3/s
  const A = Math.PI*(D/2)**2; // m2
  const v = Q_m3s/A; // m/s
  const Re = rho*v*D/mu;
  const e = 0.0000015; // m roughness aluminium
  // Darcy friction factor (Swamee-Jain)
  let f;
  if(Re < 2300) { f = 64/Re; }
  else { f = 0.25/((Math.log10(e/(3.7*D)+5.74/Re**0.9))**2); }
  const dP = f * (L/D) * rho * v**2/2; // Pa
  const dP_mbar = dP/100;
  document.getElementById('cp_results').innerHTML = `
    <div class="rg">
      ${ri('Re',Re.toFixed(0),'',Re<2300?'ok':Re<4000?'warn':'blue')}
      ${ri('Flow regime',Re<2300?'Laminar':Re<4000?'Transition':'Turbulent','',Re<2300?'ok':'warn')}
      ${ri('Velocity',v.toFixed(3),'m/s','neutral')}
      ${ri('ΔP',dP_mbar.toFixed(1),'mbar','blue')}
      ${ri('ΔP',dP.toFixed(0),'Pa','neutral')}
    </div>
    <div style="font-size:10px;color:var(--m);margin-top:8px">Based on ${L}m path, ${(D*1000).toFixed(1)}mm dia, ${T}°C 50/50 glycol-water. Target: ≤200mbar.</div>`;
}

// ── SUBMIT handlers (each tab) ──
function submitTab(tabId) {
  propagate();
  document.getElementById(`submit_badge_${tabId}`)?.remove();
  const h = document.createElement('span');
  h.id = `submit_badge_${tabId}`;
  h.className = 'chip g';
  h.style.cssText = 'margin-left:8px;font-size:9px';
  h.textContent = '✓ Submitted ' + new Date().toLocaleTimeString();
  const head = document.querySelector(`#${tabId} .sh h2`);
  if(head) head.appendChild(h);
}

// ── BUSBAR SIZING ──
function calcBusbar() {
  const I      = getV('bb_I');
  const L      = getV('bb_L') / 1000;   // m
  const W      = getV('bb_W') / 1000;   // m
  const T_bb   = getV('bb_T') / 1000;   // m
  const mat    = document.getElementById('bb_mat')?.value || 'Cu_ETP';
  const matData= (typeof BB_MATS !== 'undefined' && BB_MATS[mat]) ? BB_MATS[mat] : {rho:1.72e-8,alpha:0.0039,name:'Cu',note:''};
  const rho    = matData.rho;
  const alpha  = matData.alpha;
  const isCu   = mat.startsWith('Cu') || mat === 'CCA' || mat === 'Cu_lam' || mat === 'CuNi_multi';
  const dT_allowed = getV('bb_dt') || 40;
  const creep_V    = getV('bb_V') || 400;
  const creep_actual = getV('bb_creep_actual') || 0;
  const clear_actual = getV('bb_clear_actual') || 0;
  const pd     = parseInt(document.getElementById('bb_pd')?.value || '2');
  const ovc    = parseInt(document.getElementById('bb_ovc')?.value || '3');
  const cooling= document.getElementById('bb_cooling')?.value || 'forced';

  // ── Calculations ──
  const R      = rho * L / (W * T_bb) * (1 + alpha * dT_allowed);
  const P_loss = I * I * R;
  const J      = I / (W * T_bb * 1e6);    // A/mm²
  const CSA    = W * T_bb * 1e6;           // mm²
  const T_rise_est = P_loss / (2 * (W + T_bb) * L * 10); // rough estimate W/m²·K ≈ 10

  // IEC 60664-1 minimum creepage — PD and OVC dependent (simplified PD2/3)
  const creep_limits = {
    1: {1:[0.4,0.2], 2:[0.8,0.4], 3:[0.8,0.4], 4:[0.8,0.4]},
    2: {1:[0.8,0.4], 2:[1.4,0.7], 3:[2.5,1.5], 4:[4.0,2.5]},
    3: {1:[1.4,0.7], 2:[2.5,1.5], 3:[4.0,2.5], 4:[6.3,4.0]},
  };
  // Voltage bands
  const getIEC = (V, pd, ovc) => {
    const band = V<=50?0: V<=100?1: V<=150?1: V<=300?2: V<=600?3: 4;
    const bands_creep = [0.8, 1.0, 1.4, 2.5, 5.0, 8.0];
    const bands_clear = [0.4, 0.5, 0.7, 1.5, 3.0, 6.0];
    // Scale by PD (simplified)
    const pd_creep_factor = pd === 1 ? 0.7 : pd === 3 ? 1.5 : 1.0;
    const ovc_creep_factor= ovc === 2 ? 0.8 : ovc === 4 ? 1.3 : 1.0;
    return {
      creep_min: parseFloat((bands_creep[band] * pd_creep_factor * ovc_creep_factor).toFixed(1)),
      clear_min: parseFloat((bands_clear[band]).toFixed(1))
    };
  };
  const {creep_min, clear_min} = getIEC(creep_V, pd, ovc);

  // J limit based on material and cooling
  const J_limits = {
    natural: {cu: 3, al: 2},
    forced:  {cu: 5, al: 3},
    liquid:  {cu: 8, al: 5},
  };
  const J_limit = isCu ? J_limits[cooling].cu : J_limits[cooling].al;

  // ── Render calculated values ──
  const _bbr = document.getElementById('bb_results');
  if (_bbr) _bbr.innerHTML = `
    ${ri('CSA',         CSA.toFixed(1),      'mm²', J>J_limit?'err':J>J_limit*0.8?'warn':'ok', `W×T = ${(W*1000).toFixed(0)}×${(T_bb*1000).toFixed(0)}mm`)}
    ${ri('Resistance',  (R*1000).toFixed(3),  'mΩ',   'neutral', `ρ×L/(W×T) at ΔT=${dT_allowed}°C`)}
    ${ri('Power loss',  P_loss.toFixed(1),    'W',    P_loss>50?'warn':'ok', `I²×R at ${I}A`)}
    ${ri('Current J',   J.toFixed(2),         'A/mm²',J>J_limit?'err':J>J_limit*0.7?'warn':'ok', `Limit: ${J_limit} A/mm² (${cooling})`)}
    ${ri('Creepage req',creep_min,            'mm',   'blue', `IEC 60664 PD${pd} OV${ovc} @${creep_V}V`)}
    ${ri('Clearance req',clear_min,           'mm',   'blue', 'Minimum air gap required')}
  `;

  // ── PASS / FAIL checks ──
  const pass_j     = J <= J_limit;
  const warn_j     = J <= J_limit && J > J_limit * 0.8;
  const pass_creep = creep_actual <= 0 ? null : creep_actual >= creep_min;
  const pass_clear = clear_actual <= 0 ? null : clear_actual >= clear_min;
  const pass_dt    = T_rise_est <= dT_allowed;
  const pass_loss  = P_loss <= 100; // <100W loss typical acceptable

  const mkRow = (label, pass, value, limit, note, isWarn = false) => {
    const display = pass === null
      ? `<span style="padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;background:var(--bg3);color:var(--text3);border:1px solid var(--border)">— NOT ENTERED</span>`
      : pass
        ? `<span style="padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;background:rgba(0,212,170,.1);color:var(--g);border:1px solid rgba(0,212,170,.3)">✓ PASS</span>`
        : isWarn
          ? `<span style="padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;background:rgba(245,197,24,.1);color:var(--y);border:1px solid rgba(245,197,24,.3)">⚠ MARGINAL</span>`
          : `<span style="padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.3)">✗ FAIL</span>`;
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:9px 12px;font-size:12px;font-weight:500">${label}</td>
      <td style="padding:9px 12px">${display}</td>
      <td style="padding:9px 12px;font-size:11px;font-family:'DM Mono',monospace;color:var(--t)">${value}</td>
      <td style="padding:9px 12px;font-size:11px;font-family:'DM Mono',monospace;color:var(--g)">${limit}</td>
      <td style="padding:9px 12px;font-size:10px;color:var(--text3)">${note}</td>
    </tr>`;
  };

  const pass_j_final = pass_j && !warn_j;
  const warn_j_final = pass_j && warn_j;

  const checksHtml = `
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="background:var(--bg3)">
          <th style="padding:8px 12px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);border-bottom:1px solid var(--border)">Check</th>
          <th style="padding:8px 12px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);border-bottom:1px solid var(--border)">Result</th>
          <th style="padding:8px 12px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);border-bottom:1px solid var(--border)">Actual</th>
          <th style="padding:8px 12px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);border-bottom:1px solid var(--border)">Limit</th>
          <th style="padding:8px 12px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);border-bottom:1px solid var(--border)">Note</th>
        </tr>
      </thead>
      <tbody>
        ${mkRow('Current Density J', pass_j_final || warn_j_final, `${J.toFixed(2)} A/mm²`, `≤ ${J_limit} A/mm²`,
          `${cooling} cooling, ${isCu?'Cu':'Al'} busbar. ${warn_j_final?'Consider wider/thicker busbar.':''}`, warn_j_final)}
        ${mkRow('Creepage Distance', pass_creep, creep_actual>0?`${creep_actual} mm`:'—', `≥ ${creep_min} mm`,
          `IEC 60664-1 PD${pd} OV${ovc} @ ${creep_V}V. Enter actual measured creepage in inputs.`)}
        ${mkRow('Clearance Distance', pass_clear, clear_actual>0?`${clear_actual} mm`:'—', `≥ ${clear_min} mm`,
          `Minimum air gap. Enter actual gap in inputs.`)}
        ${mkRow('Power Dissipation', pass_loss, `${P_loss.toFixed(1)} W`, '≤ 100 W',
          `I²R at ${I}A. Derating required if pack is enclosed.`)}
        ${mkRow('Resistance', true, `${(R*1000).toFixed(3)} mΩ`, '—',
          `At ΔT=${dT_allowed}°C. Contributes to V_drop = ${(I*R*1000).toFixed(1)}mV @ ${I}A.`)}
      </tbody>
    </table>`;

  // Overall verdict
  const allCritical = [pass_j_final || warn_j_final,
    pass_creep !== false, pass_clear !== false, pass_loss];
  const overallPass = allCritical.every(Boolean);
  const hasWarn = warn_j_final || pass_creep === null || pass_clear === null;

  const verdictHtml = `
    <div style="margin-top:14px;padding:12px 16px;border-radius:10px;
      background:${overallPass ? 'rgba(0,212,170,.07)' : 'rgba(239,68,68,.07)'};
      border:1px solid ${overallPass ? 'rgba(0,212,170,.3)' : 'rgba(239,68,68,.3)'}">
      <div style="font-size:14px;font-weight:700;color:${overallPass?'var(--g)':'#ef4444'};margin-bottom:4px">
        ${overallPass
          ? (hasWarn ? '⚠ CONDITIONAL PASS — enter creepage/clearance values to confirm' : '✓ ALL CHECKS PASS — Design OK')
          : '✗ DESIGN FAIL — See checks above'}
      </div>
      <div style="font-size:11px;color:var(--text3);line-height:1.7">
        CSA: ${CSA.toFixed(1)}mm² · J: ${J.toFixed(2)}A/mm² (limit ${J_limit}) · 
        Creepage req: ${creep_min}mm · Clearance req: ${clear_min}mm · 
        R: ${(R*1000).toFixed(3)}mΩ · P_loss: ${P_loss.toFixed(1)}W
      </div>
    </div>`;

  const _bbc = document.getElementById('bb_checks');
  if (_bbc) _bbc.innerHTML = checksHtml + verdictHtml;
}


// ═══════════════════════════════════════════════════════════════
// VISUALIZATION ENGINE — Canvas charts for every engineering tab
// All charts share the same palette, helper functions, and style.
// ═══════════════════════════════════════════════════════════════

// ── Shared drawing helpers ──
function vizCanvas(id, h) {
  const c = document.getElementById(id);
  if (!c) return null;
  const parent = c.parentElement;
  const W = parent ? Math.max(parent.offsetWidth - 2, 300) : 600;
  c.width = W; c.height = h || 200;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, W, c.height);
  return { ctx, W, H: c.height, c };
}

function vizGrid(ctx, W, H, pad, xSteps, ySteps, col) {
  ctx.strokeStyle = col || '#1a2640'; ctx.lineWidth = 1;
  for (let i = 0; i <= ySteps; i++) {
    const y = pad.t + i * (H - pad.t - pad.b) / ySteps;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
  }
  for (let i = 0; i <= xSteps; i++) {
    const x = pad.l + i * (W - pad.l - pad.r) / xSteps;
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke();
  }
}

function vizBar(ctx, x, y, w, h, col, radius) {
  radius = Math.min(radius || 3, w / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
}

function vizLabel(ctx, text, x, y, col, size, align) {
  ctx.fillStyle = col || '#6d8fba';
  ctx.font = `${size || 13}px JetBrains Mono,monospace`;
  ctx.textAlign = align || 'left';
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function vizLine(ctx, pts, col, lw, dash) {
  if (!pts || pts.length < 2) return;
  if (dash) ctx.setLineDash(dash); else ctx.setLineDash([]);
  ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = lw || 2;
  pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.stroke(); ctx.setLineDash([]);
}

function vizThreshold(ctx, y, W, pad, col, label) {
  ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
  ctx.setLineDash([]);
  vizLabel(ctx, label, W - pad.r - 1, y - 3, col, 9, 'right');
}

// ── 1. ENERGY — Waterfall chart ──
function drawEnergyCanvas() {
