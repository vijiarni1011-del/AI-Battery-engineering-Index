/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — DCIR CURRENT MAP + FUSE SELECTOR  v1.0
   Adds to DCIR sheet:
   - Charge vs Discharge DCIR comparison
   - Current mapping: pulse, continuous, peak vs DCIR
   - I²R heat map at each operating point
   - Fuse selection & recommendation engine
   ═══════════════════════════════════════════════════════════════ */

/* ════════════════════════════════
   DCIR CURRENT MAP — appended below main DCIR heatmap
   Called by renderDCIRMap after it builds root.innerHTML
   ════════════════════════════════ */
(function patchDCIRMap() {
  const _orig = window.renderDCIRMap;
  window.renderDCIRMap = function() {
    if (typeof _orig === 'function') _orig();
    /* Append current mapping section */
    const root = document.getElementById('dcir_root');
    if (!root) return;
    const extra = document.getElementById('dcir_current_section');
    if (!extra) {
      const div = document.createElement('div');
      div.id = 'dcir_current_section';
      root.appendChild(div);
    }
    renderDCIRCurrentMap();
  };
})();

window.renderDCIRCurrentMap = function() {
  const wrap = document.getElementById('dcir_current_section');
  if (!wrap) return;
  const S   = window.S || {};
  const Ss  = S.S_total || (S.c_cps||14)*(S.c_ss||8);
  const Pp  = S.c_pp || 1;
  const Vnom= S.V_nom_pack || 400;
  const Qpack = S.Q_pack || 120;

  /* Current levels from project */
  const I_peak = S.t_ppeak ? S.t_ppeak*1000/Vnom : 300;
  const I_cont = S.t_pcont ? S.t_pcont*1000/Vnom : 150;
  const I_chg  = S.t_imax_chg || 120;
  const I_regen= I_peak * 0.4;
  const I_pulse_10s = I_peak;
  const I_pulse_30s = I_peak * 0.85;

  /* DCIR at key conditions — use uploaded data if available, else placeholder */
  const hasDCIR = window._dcirData && window._dcirData.matrix?.length > 0;
  const getIR = (soc, temp) => hasDCIR ? (dcirInterp(soc, temp) ?? null) : null;

  /* Current operating matrix */
  const scenarios = [
    { label:'Peak Discharge (10s)',  I: I_peak,     soc:80, temp:25,  type:'dis', dur:'10s'  },
    { label:'Peak Discharge (30s)',  I: I_pulse_30s,soc:80, temp:25,  type:'dis', dur:'30s'  },
    { label:'Cont. Discharge',       I: I_cont,     soc:50, temp:25,  type:'dis', dur:'∞'    },
    { label:'DC Fast Charge',        I: I_chg,      soc:20, temp:25,  type:'chg', dur:'∞'    },
    { label:'Regen Braking (peak)',  I: I_regen,    soc:90, temp:25,  type:'chg', dur:'5s'   },
    { label:'Cold Start (−10°C)',    I: I_cont,     soc:20, temp:-10, type:'dis', dur:'∞'    },
    { label:'Hot Discharge (45°C)',  I: I_cont,     soc:50, temp:45,  type:'dis', dur:'∞'    },
    { label:'Cold Charge (0°C)',     I: I_chg*0.2,  soc:10, temp:0,   type:'chg', dur:'∞'    },
  ];

  const rows = scenarios.map(sc => {
    const ir_cell  = getIR(sc.soc, sc.temp);
    const ir_pack  = ir_cell != null ? ir_cell * Ss / Pp : null;  // mΩ
    const Vdrop    = ir_pack != null ? ir_pack * 1e-3 * sc.I : null;
    const Pir      = ir_pack != null ? Math.pow(sc.I, 2) * ir_pack * 1e-3 : null; // W heat
    const Crate    = Qpack > 0 ? sc.I / Qpack : null;
    const col_type = sc.type === 'chg' ? 'var(--b)' : 'var(--o)';
    const status   = Crate != null
      ? (Crate > 3 ? '<span style="color:var(--r)">⚠ HIGH</span>'
        : Crate > 2 ? '<span style="color:var(--y)">ELEVATED</span>'
        : '<span style="color:var(--g)">OK</span>')
      : '—';
    return `<tr>
      <td style="font-size:12px">${sc.label}</td>
      <td style="font-family:var(--mono);color:${col_type}">${sc.type==='chg'?'CHG':'DIS'} ${sc.dur}</td>
      <td style="font-family:var(--mono);font-weight:700;font-size:13px">${sc.I.toFixed(0)} A</td>
      <td style="font-family:var(--mono)">${Crate!=null?Crate.toFixed(3)+'C':'—'}</td>
      <td style="font-family:var(--mono)">${sc.soc}%</td>
      <td style="font-family:var(--mono)">${sc.temp}°C</td>
      <td style="font-family:var(--mono);color:var(--text2)">${ir_cell!=null?ir_cell.toFixed(3)+' mΩ':'Upload DCIR data ↑'}</td>
      <td style="font-family:var(--mono);color:var(--text2)">${ir_pack!=null?ir_pack.toFixed(1)+' mΩ':'—'}</td>
      <td style="font-family:var(--mono);color:${Vdrop&&Vdrop/Vnom>0.05?'var(--r)':'var(--text2)'}">${Vdrop!=null?Vdrop.toFixed(1)+' V ('+((Vdrop/Vnom)*100).toFixed(1)+'%)':'—'}</td>
      <td style="font-family:var(--mono);color:${Pir&&Pir>500?'var(--r)':Pir&&Pir>200?'var(--y)':'var(--g)'}">${Pir!=null?(Pir/1000).toFixed(2)+' kW':'—'}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');

  /* PSD / frequency domain section */
  const psdCanvas = `<canvas id="dcir_psd_canvas" height="180" style="width:100%;display:block;border-radius:6px;background:var(--bg);margin-top:10px"></canvas>`;

  wrap.innerHTML = `
<hr style="border:none;border-top:1px solid var(--border);margin:20px 0">

<!-- CHARGE vs DISCHARGE DCIR note -->
<div class="card" style="margin-bottom:16px">
  <div class="ch3">⚡ Charge vs Discharge DCIR — What Engineers Need to Know</div>
  <div class="fbox" style="margin-top:8px;line-height:1.8">
    <b>Discharge DCIR</b> = resistance during energy release. Drives pack voltage drop (ΔV = I × R_pack), heat generation (Q = I²R), and power capability limit.<br>
    <b>Charge DCIR</b> = resistance during charging. Higher at low SoC and cold temp — limits fast-charge current acceptance. Charge DCIR ≈ discharge DCIR for most Li-ion chemistries (within ±10%).<br>
    <b>Pulse vs Continuous:</b> 10s pulse IR is typically 10–20% higher than DC value (inductive + electrochemical transient). Always use 10s pulse value for peak current calculations.<br>
    <b>Temperature effect:</b> DCIR increases exponentially below 10°C — cold-start voltage drop is the primary constraint for EV winter performance.<br>
    <span style="color:var(--teal)">→ Upload your cell DCIR datasheet (charge + discharge columns) in the DCIR Map tab above for actual values.</span>
  </div>
</div>

<!-- CURRENT MAPPING TABLE -->
<div class="card" style="margin-bottom:16px">
  <div class="ch3">📊 Current × DCIR Operating Point Matrix</div>
  <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
    Auto-linked: I_peak from P_peak/V_nom · I_cont from P_cont/V_nom · I_chg from Cell tab max charge current
    ${!hasDCIR?'<span style="color:var(--y)"> · Upload DCIR data in tab above to see IR and ΔV values</span>':''}
  </div>
  <div style="overflow-x:auto">
  <table class="res-tbl" style="font-size:12px;min-width:900px">
    <thead><tr>
      <th>Scenario</th><th>Type/Duration</th><th>Current</th><th>C-rate</th>
      <th>SoC</th><th>Temp</th><th>Cell DCIR</th><th>Pack DCIR</th>
      <th>Pack ΔV</th><th>I²R Heat</th><th>Status</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  </div>
  <div class="ico-banner" style="margin-top:10px">
    I_peak = ${I_peak.toFixed(0)} A · I_cont = ${I_cont.toFixed(0)} A · I_chg = ${I_chg.toFixed(0)} A · Pack: ${Ss}S/${Pp}P · V_nom = ${Vnom.toFixed(0)} V
  </div>
</div>

<!-- PULSE POWER vs DCIR CHART -->
<div class="card" style="margin-bottom:16px">
  <div class="ch3">📈 Pulse Power vs Voltage at Pack Terminals (V-I envelope)</div>
  <div style="font-size:11px;color:var(--text3);margin-bottom:6px">
    Shows how pack terminal voltage drops with current due to DCIR. Used for BMS power limit tables.
    Based on ${hasDCIR?'your uploaded DCIR data':'typical values — upload DCIR for accuracy'}.
  </div>
  <canvas id="dcir_vi_canvas" height="220" style="width:100%;display:block;border-radius:6px;background:var(--bg)"></canvas>
  <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-size:9px;font-family:var(--mono)">
    <span style="color:var(--g)">━ SoC 80% / 25°C</span>
    <span style="color:var(--y)">━ SoC 50% / 25°C</span>
    <span style="color:var(--b)">━ SoC 20% / 25°C</span>
    <span style="color:var(--r)">━ SoC 20% / −10°C (cold)</span>
    <span style="color:rgba(255,255,255,.3)">┅ V_min cutoff</span>
  </div>
</div>

<!-- FREQUENCY / PSD SECTION -->
<div class="card" style="margin-bottom:16px">
  <div class="ch3">📡 AC Impedance vs Frequency (Nyquist / EIS concept)</div>
  <div class="fbox" style="margin-bottom:10px">
    EIS (Electrochemical Impedance Spectroscopy) decomposes cell impedance into frequency components.
    Used to separate ohmic resistance (R0), SEI/charge-transfer (Rct), diffusion (Warburg).<br>
    <b>DCIR (pulsed)</b> captures R0 + partial Rct. <b>ACIR (1kHz)</b> captures R0 only.
    Always specify measurement frequency when comparing supplier datasheets.
  </div>
  <canvas id="dcir_eis_canvas" height="200" style="width:100%;display:block;border-radius:6px;background:var(--bg)"></canvas>
  <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-size:9px;font-family:var(--mono)">
    <span style="color:var(--g)">━ Ohmic R0 (HF limit, ~1kHz)</span>
    <span style="color:var(--b)">━ DCIR 10s pulse (R0+Rct)</span>
    <span style="color:var(--o)">━ Low-freq diffusion tail</span>
  </div>
</div>
`;

  /* Draw V-I envelope canvas */
  requestAnimationFrame(() => {
    const canvas = document.getElementById('dcir_vi_canvas');
    if (!canvas) return;
    const W = canvas.offsetWidth || 700, H = 220;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const pad = {l:56,r:20,t:20,b:36};
    const pw=W-pad.l-pad.r, ph=H-pad.t-pad.b;

    const Imin=0, Imax=I_peak*1.3;
    const Vmin_plot=Vnom*0.7, Vmax_plot=Vnom*1.1;
    const mx=I=>pad.l+(I-Imin)/(Imax-Imin)*pw;
    const my=V=>pad.t+ph*(1-(V-Vmin_plot)/(Vmax_plot-Vmin_plot));

    /* Grid */
    ctx.strokeStyle='rgba(255,255,255,.04)'; ctx.lineWidth=1;
    [0,.25,.5,.75,1].forEach(f=>{
      const y=pad.t+ph*f;
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
      ctx.fillStyle='#3a567a';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='right';
      ctx.fillText(((Vmax_plot-(Vmax_plot-Vmin_plot)*f)).toFixed(0)+'V',pad.l-3,y+3);
    });

    /* V_min line */
    const Vmin_sys = S.V_min_pack || Vnom*0.7;
    ctx.strokeStyle='rgba(255,77,109,.4)';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);
    const yVmin=my(Vmin_sys);
    ctx.beginPath();ctx.moveTo(pad.l,yVmin);ctx.lineTo(W-pad.r,yVmin);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,77,109,.6)';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='left';
    ctx.fillText('V_min '+Vmin_sys.toFixed(0)+'V',pad.l+4,yVmin-3);

    /* V-I lines for different conditions */
    const curves = [
      { soc:80, temp:25,  col:'#00d4aa', label:'80%/25°C' },
      { soc:50, temp:25,  col:'#f5c518', label:'50%/25°C' },
      { soc:20, temp:25,  col:'#4a9eff', label:'20%/25°C' },
      { soc:20, temp:-10, col:'#ff4d6d', label:'20%/−10°C' },
    ];
    curves.forEach(cv => {
      const ir_cell = getIR(cv.soc, cv.temp) ?? (S.c_ir_bol||0.22)*2.5;
      const ir_pack = ir_cell * Ss / Pp;
      /* V_oc at this SoC — approximate from cell Vnom */
      const ocv_soc = (S.c_vmin||2.8) + ((S.c_vmax||4.2)-(S.c_vmin||2.8)) * (cv.soc/100) * Ss;
      ctx.beginPath();ctx.strokeStyle=cv.col;ctx.lineWidth=2;
      for(let k=0;k<=60;k++){
        const I=Imin+(Imax-Imin)*k/60;
        const V=ocv_soc - I*ir_pack*1e-3;
        const x=mx(I), y=my(V);
        k===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }
      ctx.stroke();
    });

    /* I_peak, I_cont markers */
    [
      {I:I_peak, label:'I_peak', col:'rgba(255,123,53,.7)'},
      {I:I_cont, label:'I_cont', col:'rgba(0,212,170,.7)'},
      {I:I_chg,  label:'I_chg',  col:'rgba(74,158,255,.7)'},
    ].forEach(m=>{
      const x=mx(m.I);
      ctx.strokeStyle=m.col;ctx.lineWidth=1;ctx.setLineDash([3,4]);
      ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=m.col;ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='center';
      ctx.fillText(m.label,x,pad.t+8);
    });

    ctx.fillStyle='#4a6080';ctx.font='10px JetBrains Mono,monospace';ctx.textAlign='center';
    ctx.fillText('Pack Current (A)',pad.l+pw/2,H-4);
  });

  /* Draw EIS Nyquist sketch */
  requestAnimationFrame(() => {
    const canvas = document.getElementById('dcir_eis_canvas');
    if (!canvas) return;
    const W=canvas.offsetWidth||700, H=200;
    canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d');
    const pad={l:56,r:20,t:20,b:36};
    const pw=W-pad.l-pad.r, ph=H-pad.t-pad.b;

    /* X = Re(Z) in mΩ, Y = -Im(Z) in mΩ */
    const ir_cell = hasDCIR ? (dcirInterp(50,25)||0.22) : (S.c_ir_bol||0.22);
    const R0   = ir_cell * 0.6;   // ohmic only (~1kHz ACIR)
    const Rct  = ir_cell * 0.35;  // charge transfer
    const Rw   = ir_cell * 0.3;   // diffusion/Warburg

    const Remin=0, Remax=(R0+Rct+Rw)*2.2;
    const Immax=(Rct*0.55)*1.6;
    const mx2=Re=>pad.l+(Re-Remin)/(Remax-Remin)*pw;
    const my2=Im=>pad.t+ph*(1-Im/Immax);

    /* Grid */
    ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;
    [0,0.5,1].forEach(f=>{
      const y=pad.t+ph*f;
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
      ctx.fillStyle='#3a567a';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='right';
      ctx.fillText((Immax*(1-f)).toFixed(2)+'mΩ',pad.l-3,y+3);
    });

    /* Nyquist semicircle */
    ctx.beginPath();ctx.strokeStyle='rgba(0,212,170,.3)';ctx.lineWidth=1;ctx.setLineDash([]);
    ctx.arc(mx2(R0+Rct/2), my2(0), (Rct/2)/(Remax-Remin)*pw, Math.PI, 0);
    ctx.stroke();

    /* Full curve */
    const pts2=[];
    /* HF → R0 */
    pts2.push({Re:R0*2.5,Im:0});
    pts2.push({Re:R0*1.5,Im:-0.02*ir_cell});
    pts2.push({Re:R0,Im:0});
    /* Semicircle (Rct) */
    for(let a=Math.PI;a>=0;a-=0.15){
      pts2.push({Re:R0+Rct/2+Math.cos(a)*Rct/2, Im:Math.sin(a)*Rct/2});
    }
    /* Warburg tail */
    for(let k=1;k<=12;k++){
      pts2.push({Re:R0+Rct+k*Rw/12, Im:k*Rw/12});
    }
    ctx.beginPath();ctx.strokeStyle='#4a9eff';ctx.lineWidth=2;
    pts2.forEach((p,i)=>i===0?ctx.moveTo(mx2(p.Re),my2(p.Im)):ctx.lineTo(mx2(p.Re),my2(p.Im)));
    ctx.stroke();

    /* Key point labels */
    [
      {Re:R0,Im:0,      label:`R0=${R0.toFixed(2)}mΩ`,      col:'#00d4aa'},
      {Re:R0+Rct,Im:0,  label:`R0+Rct=${(R0+Rct).toFixed(2)}mΩ`, col:'#4a9eff'},
      {Re:ir_cell,Im:0, label:`DCIR≈${ir_cell.toFixed(2)}mΩ`,col:'#f5c518'},
    ].forEach(p=>{
      ctx.fillStyle=p.col;
      ctx.beginPath();ctx.arc(mx2(p.Re),my2(p.Im),4,0,Math.PI*2);ctx.fill();
      ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='center';
      ctx.fillText(p.label,mx2(p.Re),my2(p.Im)-8);
    });

    ctx.fillStyle='#4a6080';ctx.font='10px JetBrains Mono,monospace';ctx.textAlign='center';
    ctx.fillText('Re(Z) → mΩ  (Nyquist — HF right, LF left)',pad.l+pw/2,H-4);
    ctx.textAlign='left';ctx.fillText('-Im(Z) mΩ',4,pad.t+ph/2);
  });
};

/* ════════════════════════════════
   FUSE SELECTOR
   ════════════════════════════════ */
window.renderFuseSelector = function() {
  const root = document.getElementById('fuse_root');
  if (!root) return;
  const S = window.S || {};

  /* Derived pack values */
  const Ss = S.S_total || (S.c_cps||14)*(S.c_ss||8);
  const Pp = S.c_pp || 1;
  const V_nom = S.V_nom_pack || (Ss * (S.c_vnom||3.2));

  /* Inputs — prefer DOM override, fallback to S */
  const I_peak = +(document.getElementById('fuse_ipeak')?.value || (S.t_ppeak ? (S.t_ppeak*1000/V_nom).toFixed(0) : 300));
  const I_cont = +(document.getElementById('fuse_icont')?.value || (S.t_pcont ? (S.t_pcont*1000/V_nom).toFixed(0) : 150));
  const V_max  = +(document.getElementById('fuse_vmax')?.value  || S.V_max_pack || (Ss*(S.c_vmax||4.2)));

  /* Pack IR in Ω for short-circuit estimate */
  const pack_ir_ohm = ((S._packIR_bol || (S.c_ir_bol||0.22)*Ss/Pp)) * 1e-3; // mΩ→Ω
  const wire_r_ohm  = 0.005; // ~5mΩ typical HV harness
  const I_sc_raw   = Math.min(10000, Math.round(V_max / Math.max(pack_ir_ohm + wire_r_ohm, 0.001)));
  const I_sc_est   = +(document.getElementById('fuse_isc')?.value || I_sc_raw);

  /* Fuse rating rule: 1.3–1.5× I_cont, must interrupt I_sc, voltage rating ≥ V_max */
  const I_fuse_min = I_cont * 1.25;
  const I_fuse_max = I_cont * 2.0;

  /* Standard fuse ratings */
  const FUSE_RATINGS = [100,125,160,200,250,315,400,500,630,800,1000,1250,1600];
  const best_fuse = FUSE_RATINGS.find(r => r >= I_fuse_min && r <= I_fuse_max) ||
                    FUSE_RATINGS.find(r => r >= I_fuse_min) || 1000;

  /* Fuse types */
  const fuseTypes = [
    { type:'Bussman MIDI/AMI', range:'30–200A', volt:'58–100V', note:'LV packs <100V, 2W/4W', ok: V_max<=100 },
    { type:'Littelfuse MEGA',  range:'40–500A', volt:'32V/58V/125V', note:'Mid-voltage packs', ok: V_max<=150 },
    { type:'Schurter NH/DIN',  range:'100–630A', volt:'up to 1000V DC', note:'HV EV packs, Class B', ok: V_max>150 && V_max<=1000 },
    { type:'Bussmann HVL-SP',  range:'100–500A', volt:'900V DC', note:'HV automotive, IEC 60269', ok: V_max>400 },
    { type:'Littelfuse JLLS',  range:'50–600A', volt:'700V DC', note:'IEC certified HV', ok: V_max>300 && V_max<=700 },
    { type:'Eaton Bussmann KleinGlass', range:'1–30A', volt:'1000V DC', note:'BMS logic fuses', ok: true },
  ];

  const fuseRows = fuseTypes.map(f => `
    <tr style="${f.ok?'background:rgba(0,212,170,.04)':''}">
      <td style="font-weight:700;font-size:12px;color:${f.ok?'var(--g)':'var(--text3)'}">${f.ok?'⭐ ':''} ${f.type}</td>
      <td style="font-family:var(--mono);font-size:12px">${f.range}</td>
      <td style="font-family:var(--mono);font-size:12px">${f.volt}</td>
      <td style="font-size:11px;color:var(--text2)">${f.note}</td>
    </tr>`).join('');

  /* MSD sizing */
  const msd_rating = Math.ceil(I_peak / 50) * 50;

  root.innerHTML = `
<div class="g2" style="margin-bottom:16px">
  <div class="card">
    <div class="ch3">⚡ Pack Parameters <span style="font-size:9px;color:var(--teal);font-family:var(--mono)">← auto from Project Targets</span></div>
    <div class="g2" style="margin-top:10px">
      <div class="field"><label>Peak Current I_peak (A)</label>
        <input type="number" id="fuse_ipeak" value="${I_peak.toFixed(0)}" step="10" oninput="renderFuseSelector()">
        <div class="hint">P_peak ÷ V_nom = ${(S.t_ppeak||0).toFixed(0)}kW ÷ ${(S.V_nom_pack||400).toFixed(0)}V</div></div>
      <div class="field"><label>Cont. Current I_cont (A)</label>
        <input type="number" id="fuse_icont" value="${I_cont.toFixed(0)}" step="10" oninput="renderFuseSelector()">
        <div class="hint">P_cont ÷ V_nom</div></div>
      <div class="field"><label>Pack V_max (V)</label>
        <input type="number" id="fuse_vmax" value="${V_max.toFixed(0)}" step="10" oninput="renderFuseSelector()">
        <div class="hint">From Cell tab — sets fuse voltage class</div></div>
      <div class="field"><label>Est. Short-circuit Current (A)</label>
        <input type="number" id="fuse_isc" value="${I_sc_est.toFixed(0)}" step="100" oninput="renderFuseSelector()">
        <div class="hint">V_max ÷ R_pack (from DCIR). Fuse must interrupt this.</div></div>
    </div>
  </div>

  <div class="card">
    <div class="ch3">🎯 Fuse Recommendation</div>
    <div class="g2" style="margin-top:12px">
      ${[
        {l:'Recommended Main Fuse', v:best_fuse+' A', c:'var(--g)'},
        {l:'Min fuse (1.25×I_cont)', v:I_fuse_min.toFixed(0)+' A', c:'var(--text)'},
        {l:'Max fuse (2.0×I_cont)', v:I_fuse_max.toFixed(0)+' A', c:'var(--text)'},
        {l:'Fuse voltage class', v:(V_max>400?'1000V DC class':V_max>150?'700V DC class':'125V class'), c:'var(--b)'},
        {l:'MSD rating', v:msd_rating+' A', c:'var(--y)'},
        {l:'Interrupt capacity ≥', v:I_sc_est.toFixed(0)+' A', c:'var(--r)'},
      ].map(r=>`<div class="kpi-card" style="border-color:${r.c}22"><div class="kpi-v" style="color:${r.c}">${r.v}</div><div class="kpi-l">${r.l}</div></div>`).join('')}
    </div>
    <div class="ico-banner" style="margin-top:12px">
      ⚙ Fuse sizing: 1.25×I_cont ≤ I_fuse ≤ 2.0×I_cont. Voltage rating ≥ V_max.
      Interrupt capacity ≥ I_sc. Standard: IEC 60269-4, SAE J1495, ISO 8820.
    </div>
  </div>
</div>

<!-- FUSE TYPE TABLE -->
<div class="card" style="margin-bottom:16px">
  <div class="ch3">📋 Fuse Type Selection — for ${V_max.toFixed(0)}V / ${I_peak.toFixed(0)}A pack</div>
  <table class="res-tbl" style="font-size:12px;margin-top:10px">
    <thead><tr><th>Fuse Type</th><th>Current Range</th><th>Voltage Rating</th><th>Application</th></tr></thead>
    <tbody>${fuseRows}</tbody>
  </table>
</div>

<!-- FUSE CIRCUIT DIAGRAM (SVG) -->
<div class="card" style="margin-bottom:16px">
  <div class="ch3">🔌 HV Circuit Protection Layout</div>
  <svg viewBox="0 0 700 160" style="width:100%;max-width:700px;display:block;margin-top:12px;font-family:JetBrains Mono,monospace">
    <!-- Bus -->
    <line x1="30" y1="80" x2="670" y2="80" stroke="rgba(255,255,255,.1)" stroke-width="2"/>
    <!-- Battery block -->
    <rect x="30" y="55" width="100" height="50" rx="6" fill="rgba(0,212,170,.1)" stroke="rgba(0,212,170,.4)" stroke-width="1.5"/>
    <text x="80" y="78" fill="#00d4aa" font-size="10" text-anchor="middle">BATTERY</text>
    <text x="80" y="92" fill="#3a567a" font-size="9" text-anchor="middle">${Ss}S·${Pp}P</text>
    <!-- MSD -->
    <rect x="155" y="62" width="60" height="36" rx="4" fill="rgba(245,197,24,.1)" stroke="rgba(245,197,24,.4)" stroke-width="1.5"/>
    <text x="185" y="80" fill="#f5c518" font-size="9" text-anchor="middle">MSD</text>
    <text x="185" y="92" fill="#3a567a" font-size="8" text-anchor="middle">${msd_rating}A</text>
    <!-- Main fuse -->
    <rect x="240" y="62" width="70" height="36" rx="4" fill="rgba(255,123,53,.1)" stroke="rgba(255,123,53,.4)" stroke-width="1.5"/>
    <text x="275" y="78" fill="#ff7b35" font-size="9" text-anchor="middle">FUSE</text>
    <text x="275" y="91" fill="#3a567a" font-size="8" text-anchor="middle">${best_fuse}A</text>
    <!-- Precharge -->
    <rect x="335" y="55" width="80" height="50" rx="4" fill="rgba(139,92,246,.1)" stroke="rgba(139,92,246,.4)" stroke-width="1.5"/>
    <text x="375" y="77" fill="#8b5cf6" font-size="9" text-anchor="middle">PRE-CHG</text>
    <text x="375" y="89" fill="#3a567a" font-size="8" text-anchor="middle">relay+R</text>
    <!-- Main contactor -->
    <rect x="440" y="62" width="70" height="36" rx="4" fill="rgba(74,158,255,.1)" stroke="rgba(74,158,255,.4)" stroke-width="1.5"/>
    <text x="475" y="78" fill="#4a9eff" font-size="9" text-anchor="middle">CONT.</text>
    <text x="475" y="91" fill="#3a567a" font-size="8" text-anchor="middle">main</text>
    <!-- Load -->
    <rect x="540" y="55" width="80" height="50" rx="6" fill="rgba(0,212,170,.08)" stroke="rgba(0,212,170,.3)" stroke-width="1.5"/>
    <text x="580" y="77" fill="#dde8f8" font-size="9" text-anchor="middle">INVERTER</text>
    <text x="580" y="91" fill="#3a567a" font-size="8" text-anchor="middle">/LOAD</text>
    <!-- Connectors -->
    <line x1="130" y1="80" x2="155" y2="80" stroke="rgba(0,212,170,.5)" stroke-width="2"/>
    <line x1="215" y1="80" x2="240" y2="80" stroke="rgba(0,212,170,.5)" stroke-width="2"/>
    <line x1="310" y1="80" x2="335" y2="80" stroke="rgba(0,212,170,.5)" stroke-width="2"/>
    <line x1="415" y1="80" x2="440" y2="80" stroke="rgba(0,212,170,.5)" stroke-width="2"/>
    <line x1="510" y1="80" x2="540" y2="80" stroke="rgba(0,212,170,.5)" stroke-width="2"/>
    <!-- Labels -->
    <text x="80" y="140" fill="#3a567a" font-size="9" text-anchor="middle">Pack</text>
    <text x="185" y="140" fill="#f5c518" font-size="9" text-anchor="middle">Manual SD</text>
    <text x="275" y="140" fill="#ff7b35" font-size="9" text-anchor="middle">Main Fuse</text>
    <text x="375" y="140" fill="#8b5cf6" font-size="9" text-anchor="middle">Precharge</text>
    <text x="475" y="140" fill="#4a9eff" font-size="9" text-anchor="middle">Contactor</text>
    <text x="580" y="140" fill="#dde8f8" font-size="9" text-anchor="middle">Load</text>
  </svg>
</div>

<div class="ico-banner">
  📌 Standards: IEC 60269-4 (DC fuses) · SAE J1495 (EV fuses) · ISO 8820-3 (automotive) · IEC 62619 §7.3.1 (short circuit protection).
  Fuse must clear I_sc ≥ ${I_sc_est.toFixed(0)} A. Always verify with fuse manufacturer's I²t characteristic.
</div>`;
};

/* Hook showSec for fuse tab */
(function(){
  const _ss = window.showSec;
  window.showSec = function(id, btn) {
    if (typeof _ss==='function') _ss(id, btn);
    if (id==='fuse') setTimeout(()=>{try{renderFuseSelector();}catch(e){}},60);
    if (id==='dcir') setTimeout(()=>{try{renderDCIRCurrentMap();}catch(e){}},200);
  };
  const _pp = window.propagate;
  window.propagate = function() {
    if (typeof _pp==='function') _pp.apply(this,arguments);
    try { if(document.getElementById('fuse')?.classList.contains('active')) renderFuseSelector(); } catch(e) {}
    try {
      const dcirSec = document.getElementById('dcir');
      if (dcirSec?.classList.contains('active')) {
        setTimeout(()=>renderDCIRCurrentMap(),100);
      }
    } catch(e) {}
  };
})();
