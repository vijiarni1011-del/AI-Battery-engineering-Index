/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — DCIR MAP MODULE  v1.0
   Sheet: Resistance vs Temperature vs SoC heatmap
   + Derating factor table  + Pack-level impedance summary
   Reads from global S (propagate) — no extra inputs needed
   ═══════════════════════════════════════════════════════════════ */

/* ── DCIR model constants (normalised multipliers vs 25°C, 50%SoC baseline) ──
   Rows = SoC breakpoints (%)  Cols = Temp breakpoints (°C)
   Source: typical NMC/LFP characteristic — user can override via custom table */
const DCIR_SOC  = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const DCIR_TEMP = [-20, -10, 0, 10, 25, 35, 45, 55];

// Normalised DCIR multipliers [soc_idx][temp_idx]  (1.0 = baseline at 25°C / 50%SoC)
const DCIR_NORM = [
  // -20    -10    0      10     25     35     45     55
  [14.0,  8.5,  4.8,  2.6,  1.60, 1.35, 1.20, 1.15],  // SoC 0%
  [11.5,  7.0,  4.0,  2.2,  1.45, 1.22, 1.10, 1.08],  // SoC 10%
  [ 9.0,  5.5,  3.2,  1.85, 1.30, 1.12, 1.04, 1.02],  // SoC 20%
  [ 7.0,  4.2,  2.5,  1.55, 1.18, 1.06, 1.00, 0.99],  // SoC 30%
  [ 5.5,  3.3,  1.95, 1.30, 1.08, 1.02, 0.98, 0.97],  // SoC 40%
  [ 4.5,  2.7,  1.65, 1.15, 1.00, 0.97, 0.95, 0.94],  // SoC 50% ← baseline
  [ 4.2,  2.5,  1.55, 1.10, 0.97, 0.94, 0.92, 0.91],  // SoC 60%
  [ 4.0,  2.4,  1.50, 1.08, 0.96, 0.93, 0.91, 0.90],  // SoC 70%
  [ 4.3,  2.6,  1.60, 1.12, 0.98, 0.95, 0.93, 0.92],  // SoC 80%
  [ 5.2,  3.1,  1.85, 1.25, 1.05, 1.00, 0.97, 0.96],  // SoC 90%
  [ 6.8,  4.0,  2.30, 1.50, 1.18, 1.10, 1.05, 1.03],  // SoC 100%
];

/* LFP multiplier offset (LFP runs ~15% higher IR vs NMC at low temp) */
const CHEM_FACTOR = { NMC:1.0, NCA:0.95, LFP:1.18, LTO:0.85, default:1.0 };

function getDCIRFactor(soc, temp) {
  /* Bilinear interpolation in the normalised table */
  const si = Math.max(0, Math.min(DCIR_SOC.length-2,
    DCIR_SOC.findIndex(v => v > soc) - 1));
  const ti = Math.max(0, Math.min(DCIR_TEMP.length-2,
    DCIR_TEMP.findIndex(v => v > temp) - 1));
  const ts = (temp - DCIR_TEMP[ti]) / (DCIR_TEMP[ti+1] - DCIR_TEMP[ti]);
  const ss = (soc  - DCIR_SOC[si])  / (DCIR_SOC[si+1]  - DCIR_SOC[si]);
  const r00=DCIR_NORM[si][ti], r10=DCIR_NORM[si+1][ti];
  const r01=DCIR_NORM[si][ti+1], r11=DCIR_NORM[si+1][ti+1];
  return r00*(1-ss)*(1-ts) + r10*ss*(1-ts) + r01*(1-ss)*ts + r11*ss*ts;
}

/* ── Colour scale: green→yellow→orange→red (log scale) ── */
function heatColour(norm) {
  if (norm <= 1.0)  return `rgba(0,212,170,${0.35+0.5*(1/norm-1)})`;
  if (norm <= 2.0)  return `hsl(${55-40*(norm-1)},90%,50%)`;
  if (norm <= 5.0)  return `hsl(${15-10*(norm-2)/3},90%,45%)`;
  return `hsl(0,90%,40%)`;
}
function textOnHeat(norm) { return norm > 3 ? '#fff' : (norm > 1.5 ? '#1a0800' : '#000'); }

/* ══════════════════════════════════════════════
   MAIN RENDER ENTRY — called by showSec / propagate
   ══════════════════════════════════════════════ */
window.renderDCIRMap = function() {
  const root = document.getElementById('dcir_root');
  if (!root) return;

  const S       = window.S || {};
  const ir_bol  = +(document.getElementById('dcir_ir_override')?.value || S.c_ir_bol || 0.22);
  const chem    = (S.c_chem || 'NMC').split(' ')[0].toUpperCase();
  const cf      = CHEM_FACTOR[chem] || CHEM_FACTOR.default;
  const Ss      = S.S_total || (S.c_cps||14)*(S.c_ss||8);
  const Pp      = S.c_pp   || 1;
  const showPack= document.getElementById('dcir_show_pack')?.checked !== false;

  /* ── 1. HEATMAP TABLE ── */
  let tHead = '<tr><th style="background:#0d1829;color:#3a567a;font-size:10px">SoC \\ T</th>';
  DCIR_TEMP.forEach(t => { tHead += `<th>${t}°C</th>`; });
  tHead += '</tr>';

  let tBody = '';
  DCIR_SOC.forEach((soc, si) => {
    tBody += `<tr><td style="font-family:var(--mono);font-size:11px;color:var(--text2);font-weight:700;background:#0a1220">${soc}%</td>`;
    DCIR_TEMP.forEach((temp, ti) => {
      const norm  = getDCIRFactor(soc, temp) * cf;
      const absIR = (ir_bol * norm).toFixed(3);
      const packR = showPack ? ((ir_bol * norm * Ss / Pp)).toFixed(2) : null;
      const bg    = heatColour(norm);
      const fg    = textOnHeat(norm);
      const title = `SoC ${soc}% | ${temp}°C\nCell IR: ${absIR} mΩ\nNorm: ×${norm.toFixed(2)}${showPack?`\nPack IR: ${packR} mΩ`:''}`;
      tBody += `<td style="background:${bg};color:${fg};font-family:var(--mono);font-size:10px;font-weight:600;text-align:center;padding:5px 4px;cursor:default;transition:filter .12s" title="${title}" onmouseenter="this.style.filter='brightness(1.3)'" onmouseleave="this.style.filter=''">${absIR}</td>`;
    });
    tBody += '</tr>';
  });

  /* ── 2. KEY OPERATING POINTS ── */
  const ops = [
    { label:'Charge start (cold)',   soc:10,  temp:-10, note:'BMS charge gate risk' },
    { label:'Peak discharge',        soc:80,  temp:25,  note:'Nominal operation' },
    { label:'Regen braking peak',    soc:90,  temp:25,  note:'High SoC + regen pulse' },
    { label:'Cold start (20% SoC)',  soc:20,  temp:-20, note:'Worst-case cold discharge' },
    { label:'Hot charge limit',      soc:100, temp:55,  note:'Upper thermal limit' },
    { label:'Nominal (50%, 25°C)',   soc:50,  temp:25,  note:'BoL datasheet ref' },
  ];

  let opsHTML = ops.map(op => {
    const norm    = getDCIRFactor(op.soc, op.temp) * cf;
    const cellIR  = ir_bol * norm;
    const packIR  = cellIR * Ss / Pp;
    const derate  = ((norm - 1) * 100).toFixed(0);
    const tag     = norm > 4 ? '<span style="color:var(--r)">⚠ CRITICAL</span>'
                  : norm > 2 ? '<span style="color:var(--o)">⚠ HIGH</span>'
                  : norm > 1.2 ? '<span style="color:var(--y)">ELEVATED</span>'
                  : '<span style="color:var(--g)">NOMINAL</span>';
    return `<tr>
      <td>${op.label}</td>
      <td style="font-family:var(--mono)">${op.soc}%</td>
      <td style="font-family:var(--mono)">${op.temp}°C</td>
      <td style="font-family:var(--mono)">${cellIR.toFixed(3)} mΩ</td>
      <td style="font-family:var(--mono)">${packIR.toFixed(1)} mΩ</td>
      <td style="font-family:var(--mono);color:${norm>2?'var(--r)':norm>1.2?'var(--o)':'var(--g)'}">×${norm.toFixed(2)}</td>
      <td>${tag}</td>
      <td style="color:var(--text3);font-size:11px">${op.note}</td>
    </tr>`;
  }).join('');

  /* ── 3. DERATING TABLE (discharge power vs temp) ── */
  const derateTemps   = [-20,-10,0,10,25,35,45,55];
  const derateSoCs    = [20,50,80];
  let derateHTML = derateTemps.map(t => {
    const cells = derateSoCs.map(soc => {
      const norm   = getDCIRFactor(soc, t) * cf;
      const factor = Math.min(1, 1 / norm);
      const pct    = (factor * 100).toFixed(0);
      const col    = factor < 0.4 ? 'var(--r)' : factor < 0.7 ? 'var(--o)' : factor < 0.9 ? 'var(--y)' : 'var(--g)';
      return `<td style="font-family:var(--mono);color:${col};font-weight:700">${pct}%</td>`;
    });
    return `<tr><td style="font-family:var(--mono)">${t}°C</td>${cells.join('')}</tr>`;
  }).join('');

  /* ── 4. Vdrop at peak current ── */
  const Ipeak = S.t_ppeak ? (S.t_ppeak * 1000 / (S.V_nom_pack || 400)) : 300;
  const Vcell = (ir_bol * 1e-3 * Ipeak / Pp) ;  // Voltage drop per cell at 25°C
  const vdropRows = [-20,0,25,45].map(t => {
    const norm   = getDCIRFactor(50, t) * cf;
    const Vdrop  = (ir_bol * norm * 1e-3 * Ipeak / Pp * Ss).toFixed(1);
    const Vnom   = S.V_nom_pack || 400;
    const pct    = ((+Vdrop / Vnom) * 100).toFixed(1);
    return `<tr>
      <td style="font-family:var(--mono)">${t}°C</td>
      <td style="font-family:var(--mono)">${(ir_bol * norm).toFixed(3)} mΩ</td>
      <td style="font-family:var(--mono)">${Vdrop} V</td>
      <td style="font-family:var(--mono);color:${+pct>5?'var(--r)':+pct>3?'var(--o)':'var(--g)'}">${pct}%</td>
    </tr>`;
  }).join('');

  root.innerHTML = `

<!-- CONTROLS ROW -->
<div class="g3" style="margin-bottom:20px;align-items:end">
  <div class="field">
    <label>Cell DCIR BoL @ 25°C, 50%SoC (mΩ) <span style="color:var(--teal)">← auto from Cell tab</span></label>
    <input type="number" id="dcir_ir_override" value="${ir_bol}" step="0.01"
      oninput="renderDCIRMap()" style="max-width:140px">
    <div class="hint">Override or reads from Cell Inputs tab</div>
  </div>
  <div class="field">
    <label>Chemistry <span style="color:var(--text3)">(auto)</span></label>
    <div style="padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;color:var(--teal)">${chem} &nbsp;×${cf.toFixed(2)}</div>
    <div class="hint">Chemistry multiplier applied</div>
  </div>
  <div class="field">
    <label>Pack Config (auto)</label>
    <div style="padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;color:var(--blue2)">${Ss}S / ${Pp}P</div>
  </div>
  <div class="field">
    <label>Show pack-level IR in heatmap</label>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:8px">
      <input type="checkbox" id="dcir_show_pack" ${showPack?'checked':''} onchange="renderDCIRMap()" style="accent-color:var(--teal)">
      <span style="font-size:12px;color:var(--text2)">Pack IR (mΩ)</span>
    </label>
    <div class="hint">Toggle between cell and pack values</div>
  </div>
</div>

<!-- LEGEND -->
<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
  <span style="font-size:11px;color:var(--text3);font-family:var(--mono)">DCIR scale:</span>
  ${['≤1× Nominal','1–2× Elevated','2–5× High','>5× Critical'].map((l,i)=>{
    const cols=['rgba(0,212,170,0.7)','hsl(45,90%,50%)','hsl(20,90%,45%)','hsl(0,90%,40%)'];
    return `<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border-radius:3px;background:${cols[i]};display:inline-block"></span><span style="font-size:10px;color:var(--text2)">${l}</span></span>`;
  }).join('')}
  <span style="font-size:10px;color:var(--text3);margin-left:8px">Values = ${showPack?'Pack':'Cell'} IR (mΩ) | Hover cell for details</span>
</div>

<!-- HEATMAP TABLE -->
<div class="card" style="overflow-x:auto;margin-bottom:20px;padding:0">
  <div style="padding:14px 16px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
    <div class="ch3" style="margin:0">🌡️ DCIR Heatmap — ${showPack?`Pack (${Ss}S/${Pp}P)`:'Cell'} IR (mΩ) vs Temperature &amp; SoC</div>
    <span style="font-size:10px;font-family:var(--mono);color:var(--text3)">Baseline ${ir_bol} mΩ · ${chem} ·  BoL</span>
  </div>
  <table style="border-collapse:collapse;width:100%;min-width:600px">
    <thead style="font-family:var(--mono);font-size:10px;color:var(--text2)">${tHead}</thead>
    <tbody>${tBody}</tbody>
  </table>
</div>

<!-- KEY OPERATING POINTS -->
<div class="card" style="margin-bottom:20px">
  <div class="ch3">⚡ Key Operating Point Analysis</div>
  <div style="overflow-x:auto">
  <table class="res-tbl" style="font-size:12px">
    <thead><tr>
      <th>Condition</th><th>SoC</th><th>Temp</th>
      <th>Cell IR (mΩ)</th><th>Pack IR (mΩ)</th>
      <th>×Factor</th><th>Status</th><th>Note</th>
    </tr></thead>
    <tbody>${opsHTML}</tbody>
  </table>
  </div>
</div>

<!-- DERATING TABLE -->
<div class="g2" style="margin-bottom:20px">
  <div class="card">
    <div class="ch3">📉 Power Derating Factor vs Temperature</div>
    <div class="hint" style="margin-bottom:12px">Available discharge power as % of nominal (1/norm factor). Lower = more derated.</div>
    <div style="overflow-x:auto">
    <table class="res-tbl" style="font-size:12px">
      <thead><tr>
        <th>Temperature</th>
        <th>SoC 20%</th><th>SoC 50%</th><th>SoC 80%</th>
      </tr></thead>
      <tbody>${derateHTML}</tbody>
    </table>
    </div>
  </div>

  <div class="card">
    <div class="ch3">⬇️ Pack Voltage Drop @ Peak Current (SoC 50%)</div>
    <div class="hint" style="margin-bottom:12px">I_peak = ${Ipeak.toFixed(0)} A (from Power target ÷ V_nom). V_nom_pack = ${(S.V_nom_pack||400).toFixed(0)} V</div>
    <div style="overflow-x:auto">
    <table class="res-tbl" style="font-size:12px">
      <thead><tr>
        <th>Temperature</th><th>Cell IR (mΩ)</th>
        <th>Pack ΔV (V)</th><th>% of V_nom</th>
      </tr></thead>
      <tbody>${vdropRows}</tbody>
    </table>
    </div>
    <div class="ico-banner" style="margin-top:12px">⚠ ΔV &gt;5% of V_nom indicates thermal derating needed to protect min voltage cutoff.</div>
  </div>
</div>

<!-- EoL PROJECTION -->
<div class="card">
  <div class="ch3">📊 BoL → EoL DCIR Growth Projection</div>
  <div class="g3" style="margin-top:12px">
    ${[
      { label:'BoL Cell IR @25°C/50%SoC', val: ir_bol.toFixed(3)+' mΩ',   col:'var(--g)' },
      { label:'EoL Cell IR (est. ×'+(+(document.getElementById('c_ir_eol')?.value||S.c_ir_eol||0.35)/ir_bol).toFixed(2)+')', val: (S.c_ir_eol||ir_bol*1.6).toFixed(3)+' mΩ', col:'var(--o)' },
      { label:'Growth factor',             val: '×'+(+(S.c_ir_eol||ir_bol*1.6)/ir_bol).toFixed(2), col:'var(--y)' },
      { label:'EoL Pack IR @25°C/50%SoC', val: ((S.c_ir_eol||ir_bol*1.6)*Ss/Pp).toFixed(1)+' mΩ', col:'var(--o)' },
      { label:'Cold start (EoL, -10°C, 20%SoC)', val: (+(S.c_ir_eol||ir_bol*1.6)*getDCIRFactor(20,-10)*cf*Ss/Pp).toFixed(1)+' mΩ', col:'var(--r)' },
    ].map(r=>`<div class="kpi-card" style="border-color:${r.col}20">
      <div class="kpi-v" style="color:${r.col}">${r.val}</div>
      <div class="kpi-l">${r.label}</div>
    </div>`).join('')}
  </div>
</div>

<div class="ico-banner" style="margin-top:16px">
  📌 <strong>Methodology:</strong> Bilinear interpolation on normalised DCIR multiplier matrix (typical ${chem} characteristic).
  Baseline = datasheet DCIR @ 25°C, 50%SoC, 1C pulse.
  Chemistry factor applied: <strong>${chem} ×${cf}</strong>.
  For production accuracy, upload your cell's full DCIR datasheet map.
</div>
`;
};

/* ── Hook into propagate: re-render when project data changes ── */
(function() {
  const _orig = window.propagate;
  window.propagate = function() {
    if (_orig) _orig.apply(this, arguments);
    try {
      if (document.getElementById('dcir_root') &&
          document.getElementById('sec-dcir')?.classList.contains('active')) {
        renderDCIRMap();
      }
    } catch(e) {}
  };
})();
