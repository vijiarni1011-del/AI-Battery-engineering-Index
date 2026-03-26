function drawEnergyCanvas() {
  const v = vizCanvas('energy_canvas', 180);
  if (!v) return;
  const { ctx, W, H } = v;
  const pad = { l: 48, r: 16, t: 18, b: 28 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  const Eg = getV('e_gross') || S.E_gross || 43;
  const dod = getV('e_dod') || 1;
  const ns = getV('e_ns') || 0.98;
  const fb = getV('e_fbol') || 0.98;
  const fbal = getV('e_fbal') || 0.988;
  const fv = getV('e_fvolt') || 0.988;
  const fd = getV('e_fdes') || 0.98;
  const ft = getV('e_ftemp') || 1;
  const Eu = Eg * dod * ns * fb * fbal * fv * fd * ft;
  const target = S.t_eu_min || 35;

  const steps = [
    { l: 'Gross', v: Eg },
    { l: '×DoD', v: Eg * dod },
    { l: '×η_sys', v: Eg * dod * ns },
    { l: '×f_BOL', v: Eg * dod * ns * fb },
    { l: '×f_bal', v: Eg * dod * ns * fb * fbal },
    { l: '×f_V', v: Eg * dod * ns * fb * fbal * fv },
    { l: '×f_des', v: Eg * dod * ns * fb * fbal * fv * fd },
    { l: 'Usable', v: Eu },
  ];
  const maxV = Eg * 1.08;

  vizGrid(ctx, W, H, pad, 6, 4);

  // Target line
  const ytgt = pad.t + ph * (1 - target / maxV);
  vizThreshold(ctx, ytgt, W, pad, '#f5c518', `Target: ${target}kWh`);

  // Bars
  const bw = Math.max(8, (pw / steps.length) * 0.65);
  const gap = pw / steps.length;
  steps.forEach((s, i) => {
    const x = pad.l + i * gap + (gap - bw) / 2;
    const barH = Math.max(2, (s.v / maxV) * ph);
    const y = pad.t + ph - barH;
    const isLast = i === steps.length - 1;
    const col = isLast
      ? (s.v >= target ? '#00d4aa' : '#ff4d6d')
      : `rgba(74,158,255,${0.5 + i * 0.07})`;
    vizBar(ctx, x, y, bw, barH, col, 3);
    vizLabel(ctx, s.v.toFixed(1), x + bw / 2, y - 4, '#dde8f8', 8, 'center');
    vizLabel(ctx, s.l, x + bw / 2, H - pad.b + 12, '#6d8fba', 8, 'center');
  });

  // Y-axis
  for (let i = 0; i <= 4; i++) {
    const val = (maxV * i / 4).toFixed(0);
    const y = pad.t + ph * (1 - i / 4);
    vizLabel(ctx, val, pad.l - 4, y + 3, '#3a567a', 9, 'right');
  }
  vizLabel(ctx, 'kWh', 4, pad.t, '#3a567a', 9);
}

// ── 2. VOLTAGE — Window diagram ──
function drawVoltCanvas() {
  const v = vizCanvas('volt_canvas', 140);
  if (!v) return;
  const { ctx, W, H } = v;
  const pad = { l: 54, r: 20, t: 22, b: 28 };
  const pw = W - pad.l - pad.r;

  const cvnom = getV('v_cvnom') || S.c_vnom;
  const cvmax = getV('v_cvmax') || S.c_vmax;
  const cvmin = getV('v_cvmin') || S.c_vmin;
  const cps   = getV('v_cps')   || S.c_cps;
  const ss    = getV('c_ss')    || S.c_ss || 8;
  const S_tot = cps * ss;
  const vmin  = getV('v_sysmin') || S.t_vmin_sys;
  const vmax  = getV('v_sysmax') || S.t_vmax_sys;
  const Vnom  = S_tot * cvnom;
  const Vmax  = S_tot * cvmax;
  const Vmin  = S_tot * cvmin;
  const Vrange = vmax * 1.1;

  vizGrid(ctx, W, H, pad, 8, 3);

  const mapX = v => pad.l + Math.min(1, Math.max(0, v / Vrange)) * pw;

  // System target window (teal fill)
  const x1 = mapX(vmin), x2 = mapX(vmax);
  ctx.fillStyle = 'rgba(0,212,170,0.08)';
  ctx.fillRect(x1, pad.t, x2 - x1, H - pad.t - pad.b);
  ctx.strokeStyle = 'rgba(0,212,170,0.4)'; ctx.lineWidth = 1;
  ctx.strokeRect(x1, pad.t, x2 - x1, H - pad.t - pad.b);

  // Pack voltage bar
  const xPmin = mapX(Vmin), xPmax = mapX(Vmax), xPnom = mapX(Vnom);
  const barY = pad.t + 10, barH = (H - pad.t - pad.b) * 0.4;
  const inWindow = Vnom >= vmin && Vnom <= vmax;
  const barCol = inWindow ? 'rgba(74,158,255,0.7)' : 'rgba(255,77,109,0.7)';
  ctx.fillStyle = barCol;
  ctx.fillRect(xPmin, barY, xPmax - xPmin, barH);

  // Vnom marker
  ctx.strokeStyle = inWindow ? '#00d4aa' : '#ff4d6d'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(xPnom, barY - 4); ctx.lineTo(xPnom, barY + barH + 4); ctx.stroke();
  vizLabel(ctx, `V_nom ${Vnom.toFixed(0)}V`, xPnom, barY - 6, inWindow ? '#00d4aa' : '#ff4d6d', 9, 'center');

  // Vmin / Vmax labels
  vizLabel(ctx, `${Vmin.toFixed(0)}V`, xPmin, barY + barH + 14, '#4a9eff', 9, 'center');
  vizLabel(ctx, `${Vmax.toFixed(0)}V`, xPmax, barY + barH + 14, '#4a9eff', 9, 'center');

  // System target labels
  vizLabel(ctx, `V_sys_min\n${vmin}V`, x1, H - pad.b + 12, 'rgba(0,212,170,0.7)', 8, 'center');
  vizLabel(ctx, `V_sys_max\n${vmax}V`, x2, H - pad.b + 12, 'rgba(0,212,170,0.7)', 8, 'center');

  // X-axis ticks
  [0, vmin, vmax, Vrange].forEach(tick => {
    const x = mapX(tick);
    vizLabel(ctx, tick.toFixed(0), x, H - pad.b + 12, '#3a567a', 8, 'center');
  });
  vizLabel(ctx, 'Voltage (V)', W / 2, H - 3, '#3a567a', 9, 'center');
  vizLabel(ctx, inWindow ? '✓ In range' : '✗ Out of range', W - pad.r - 2, pad.t + 12,
    inWindow ? '#00d4aa' : '#ff4d6d', 10, 'right');
}

// ── 3. CURRENT — Power breakdown stacked bar ──

// ── 4. THERMAL — Heat balance diagram ──
function drawThermalCanvas() {
  const v = vizCanvas('th_canvas', 160);
  if (!v) return;
  const { ctx, W, H } = v;
  const pad = { l: 60, r: 20, t: 20, b: 28 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  const I    = getV('th_I')     || 146;
  const ir   = getV('th_ir_bol')|| 0.1;
  const hair = getV('th_hair')  || 5;
  const dtair= getV('th_dtair') || 10;
  const Q_gen   = I * I * ir;
  const Q_air   = hair * dtair;
  const Q_cool  = Math.max(Q_gen - Q_air, 0);
  const maxQ    = Q_gen * 1.3;

  // Bars: Q_gen, Q_air (passive), Q_cool (active)
  const bars = [
    { l: 'Q_gen\n(I²R)', v: Q_gen, col: '#ff7b35' },
    { l: 'Q_air\n(passive)', v: Q_air, col: '#4a9eff' },
    { l: 'Q_cool\n(active)', v: Q_cool, col: '#00d4aa' },
  ];
  const bw = Math.min(80, pw / 5);
  const spacing = pw / (bars.length + 1);

  vizGrid(ctx, W, H, pad, 4, 4);

  bars.forEach((b, i) => {
    const x = pad.l + spacing * (i + 1) - bw / 2;
    const barH = Math.max(2, (b.v / maxQ) * ph);
    const y = pad.t + ph - barH;
    vizBar(ctx, x, y, bw, barH, b.col + 'cc', 4);
    vizLabel(ctx, b.v.toFixed(0) + 'W', x + bw / 2, y - 5, b.col, 9, 'center');
    vizLabel(ctx, b.l.split('\n')[0], x + bw / 2, H - pad.b + 12, '#6d8fba', 8, 'center');
    vizLabel(ctx, b.l.split('\n')[1] || '', x + bw / 2, H - pad.b + 22, '#3a567a', 8, 'center');
  });

  // Cell temp limit line
  const Tcell = S.t_tcell_max || 55;
  const yTcell = pad.t + ph * 0.1;
  vizThreshold(ctx, yTcell, W, pad, '#ff4d6d', `T_cell_max: ${Tcell}°C`);

  // Y-axis
  for (let i = 0; i <= 4; i++) {
    const val = (maxQ * i / 4).toFixed(0);
    const y = pad.t + ph * (1 - i / 4);
    vizLabel(ctx, val, pad.l - 4, y + 3, '#3a567a', 9, 'right');
  }
  vizLabel(ctx, 'W', 4, pad.t, '#3a567a', 9);
}

// ── 5. CHARGING — Charge time vs power ──

// ── 6. LIFECYCLE — SoH + Autonomy dual-axis ──
function drawLifecycleCanvas() {
  const v = vizCanvas('lc_canvas', 200);
  if (!v) return;
  const { ctx, W, H } = v;
  const pad = { l: 50, r: 58, t: 22, b: 36 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  const Nc   = getV('lc_nc')   || 3000;
  const eol  = getV('lc_eol')  || 80;
  const s5   = getV('lc_s5')   || 90;
  const yrs  = getV('lc_years')|| 10;
  const days = getV('lc_days') || 200;
  const cpd  = getV('lc_cpd')  || 1;
  const Eu   = getV('lc_eu')   || 40;
  const P    = getV('lc_pavg') || 12;
  const regen_frac = (getV('lc_regen_frac') || 0) / 100;
  const regen_eff  = (getV('lc_regen_eff')  || 85) / 100;
  const regen_credit = regen_frac * regen_eff;
  const Eu_net = Eu * (1 + regen_credit);
  const P_net  = Math.max(P * (1 - regen_credit), 0.1);

  const cyc_yr = cpd * days;
  const points = 100;
  const soh_pts = [], auto_pts = [];
  for (let i = 0; i <= points; i++) {
    const frac = i / points;
    const n = frac * Nc;
    const yr = n / cyc_yr;
    const soh = (1 - frac * (1 - eol / 100)) * 100;
    const auto = Eu_net * (soh / 100) / P_net;
    soh_pts.push([yr, soh]);
    auto_pts.push([yr, auto]);
  }

  const maxYr = yrs * 1.05;
  const maxAuto = Math.max(...auto_pts.map(p => p[1])) * 1.15;
  const mapX   = yr   => pad.l + Math.min(1, yr / maxYr) * pw;
  const mapYsoh= soh  => pad.t + ph * (1 - (soh - 70) / 35); // 70–105%
  const mapYaut= auto => pad.t + ph * (1 - Math.min(auto / maxAuto, 1));

  vizGrid(ctx, W, H, pad, 6, 5);

  // EoL SoH threshold
  const yEoL = mapYsoh(eol);
  vizThreshold(ctx, yEoL, W, pad, '#f5c518', `EoL ${eol}%`);

  // Year-5 and year-10 markers
  [5, 10].filter(yr => yr <= yrs).forEach(yr => {
    const x = mapX(yr);
    ctx.strokeStyle = 'rgba(107,130,153,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke();
    ctx.setLineDash([]);
    vizLabel(ctx, `Yr${yr}`, x, pad.t + 10, '#3a567a', 8, 'center');
  });

  // Autonomy target line
  const t_auto = S.t_auto || 4;
  const yAutoTgt = mapYaut(t_auto);
  ctx.strokeStyle = 'rgba(255,123,53,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(pad.l, yAutoTgt); ctx.lineTo(W - pad.r, yAutoTgt); ctx.stroke();
  ctx.setLineDash([]);
  vizLabel(ctx, `Auto tgt ${t_auto}h`, W - pad.r + 2, yAutoTgt + 3, '#ff7b35', 8);

  // SoH area fill
  ctx.beginPath();
  ctx.moveTo(mapX(soh_pts[0][0]), H - pad.b);
  soh_pts.forEach(([yr, soh]) => ctx.lineTo(mapX(yr), mapYsoh(soh)));
  ctx.lineTo(mapX(soh_pts[soh_pts.length - 1][0]), H - pad.b);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,212,170,0.07)'; ctx.fill();

  // SoH line
  vizLine(ctx, soh_pts.map(([yr, soh]) => [mapX(yr), mapYsoh(soh)]), '#00d4aa', 2.5);

  // Autonomy line (dashed blue on right axis)
  vizLine(ctx, auto_pts.map(([yr, a]) => [mapX(yr), mapYaut(a)]), '#4a9eff', 2, [4, 3]);

  // End-point dots
  const lastSoh  = soh_pts[soh_pts.length - 1];
  const lastAuto = auto_pts[auto_pts.length - 1];
  [[mapX(lastSoh[0]), mapYsoh(lastSoh[1]), '#00d4aa'],
   [mapX(lastAuto[0]), mapYaut(lastAuto[1]), '#4a9eff']].forEach(([x, y, col]) => {
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
  });

  // Left Y-axis (SoH)
  [70, 80, 90, 100].forEach(soh => {
    vizLabel(ctx, soh + '%', pad.l - 4, mapYsoh(soh) + 3, '#00d4aa', 8, 'right');
  });
  vizLabel(ctx, 'SoH', 2, pad.t, '#00d4aa', 9);

  // Right Y-axis (autonomy)
  const aSteps = 5;
  for (let i = 0; i <= aSteps; i++) {
    const a = maxAuto * i / aSteps;
    vizLabel(ctx, a.toFixed(1) + 'h', W - pad.r + 4, mapYaut(a) + 3, '#4a9eff', 8);
  }
  vizLabel(ctx, 'Auto(h)', W - pad.r + 4, pad.t, '#4a9eff', 9);

  // X-axis
  for (let i = 0; i <= 5; i++) {
    const yr = maxYr * i / 5;
    vizLabel(ctx, yr.toFixed(0) + 'yr', mapX(yr), H - pad.b + 13, '#3a567a', 8, 'center');
  }
  vizLabel(ctx, 'Years', W / 2, H - 3, '#3a567a', 9, 'center');
}

// ── 7. RESISTANCE — Stacked component bar chart ──
function drawResistanceCanvas() {
  const v = vizCanvas('res_canvas', 160);
  if (!v) return;
  const { ctx, W, H } = v;
  const pad = { l: 60, r: 20, t: 20, b: 28 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  // Read result items from setRg output (approximation from inputs)
  const Ss = getV('res_S') || S.S_total || 112;
  const Pp = getV('res_P') || S.c_pp || 1;
  const ir_bol = S.c_ir_bol || 0.22;
  const ir_eol = S.c_ir_eol || 0.35;
  const R_dcir_bol = (ir_bol * 1e-3 * Ss) / Pp;
  const R_dcir_eol = (ir_eol * 1e-3 * Ss) / Pp;

  // Rough estimates for other components
  const R_tab   = 0.005e-3; // typical tab bulk
  const R_cont  = 0.002e-3; // weld contact
  const R_bb    = 0.008e-3; // busbar
  const R_extra = 0.005e-3; // connectors + screw + shunt

  const comps_bol = [
    { l: 'Cell DCiR\nBoL', v: R_dcir_bol * 1000, col: '#4a9eff' },
    { l: 'Tab bulk', v: R_tab * 1000, col: '#00d4aa' },
    { l: 'Contact\n(weld)', v: R_cont * 1000, col: '#f5c518' },
    { l: 'Busbar', v: R_bb * 1000, col: '#ff7b35' },
    { l: 'Other\n(term.)', v: R_extra * 1000, col: '#a78bfa' },
  ];
  const total_bol = comps_bol.reduce((s, c) => s + c.v, 0);
  const total_eol = total_bol - R_dcir_bol * 1000 + R_dcir_eol * 1000;
  const maxR = total_eol * 1.25;

  vizGrid(ctx, W, H, pad, 4, 4);

  // Stacked bar for BoL
  const bw = Math.min(70, pw * 0.28);
  let yStack = pad.t + ph;
  const x_bol = pad.l + pw * 0.2;
  comps_bol.forEach(c => {
    const bh = (c.v / maxR) * ph;
    yStack -= bh;
    vizBar(ctx, x_bol - bw / 2, yStack, bw, bh, c.col + 'cc', 2);
    if (bh > 14) vizLabel(ctx, c.v.toFixed(2), x_bol, yStack + bh / 2 + 4, '#fff', 8, 'center');
  });
  vizLabel(ctx, `BoL\n${total_bol.toFixed(2)}mΩ`, x_bol, H - pad.b + 12, '#4a9eff', 9, 'center');

  // EoL bar (single colour, total)
  const x_eol = pad.l + pw * 0.5;
  const bh_eol = (total_eol / maxR) * ph;
  vizBar(ctx, x_eol - bw / 2, pad.t + ph - bh_eol, bw, bh_eol, 'rgba(255,123,53,0.7)', 2);
  vizLabel(ctx, `EoL\n${total_eol.toFixed(2)}mΩ`, x_eol, H - pad.b + 12, '#ff7b35', 9, 'center');

  // Delta label
  const delta = total_eol - total_bol;
  const x_delta = pad.l + pw * 0.72;
  vizBar(ctx, x_delta - bw * 0.4, pad.t + ph - (delta / maxR) * ph * 2, bw * 0.8, (delta / maxR) * ph * 2 - 2, 'rgba(255,77,109,0.6)', 2);
  vizLabel(ctx, `Δ+${delta.toFixed(2)}mΩ\n(aging)`, x_delta, H - pad.b + 12, '#ff4d6d', 9, 'center');

  // Y-axis
  for (let i = 0; i <= 4; i++) {
    const val = (maxR * i / 4).toFixed(2);
    const y = pad.t + ph * (1 - i / 4);
    vizLabel(ctx, val, pad.l - 4, y + 3, '#3a567a', 9, 'right');
  }
  vizLabel(ctx, 'mΩ', 4, pad.t, '#3a567a', 9);
}


// ═══════════════════════════════════════════════════════
// OCV–SoC MULTI-TEMPERATURE CANVAS
// ═══════════════════════════════════════════════════════
function getOCVPoints() {
  // Returns array of {soc, tmin, t0, t25, tmax} from the 4-column editable table
  const rows = document.querySelectorAll('#ocv_table_body tr');
  const pts = [];
  rows.forEach(r => {
    const socEl   = r.querySelector('td');
    const vtminEl = r.querySelector('.ocv-vtmin');
    const v0El    = r.querySelector('.ocv-v0');
    const v25El   = r.querySelector('.ocv-v25');
    const vtmaxEl = r.querySelector('.ocv-vtmax');
    if (!socEl || !v25El) return;
    const soc  = parseFloat(socEl.textContent || socEl.innerText);
    const tmin = parseFloat(vtminEl?.value) || 0;
    const t0   = parseFloat(v0El?.value)    || 0;
    const t25  = parseFloat(v25El?.value)   || 0;
    const tmax = parseFloat(vtmaxEl?.value) || 0;
    if (!isNaN(soc) && t25 > 0) pts.push({ soc, tmin, t0, t25, tmax });
  });
  return pts.sort((a, b) => a.soc - b.soc);
}

function addOCVRow() {
  const tbody = document.getElementById('ocv_table_body');
  const rows  = tbody.querySelectorAll('tr');
  const lastRow = rows[rows.length - 1];
  const lastSoc = lastRow ? parseFloat(lastRow.querySelector('td').textContent) : 0;
  const newSoc  = Math.min(lastSoc + 5, 100);
  const inp = (val, col, rgb, cls) =>
    `<input type="number" class="${cls}" value="${val}" step="0.01"
      style="width:76px;padding:5px 8px;background:rgba(${rgb},.07);border:1px solid rgba(${rgb},.35);border-radius:5px;color:${col};font-family:var(--mono);font-size:13px;font-weight:700;text-align:center"
      oninput="drawOCVCanvas()">`;
  const tr = document.createElement('tr');
  tr.style.borderBottom = '1px solid var(--border)';
  tr.innerHTML = `
    <td style="padding:8px 14px;font-family:var(--mono);font-size:13px;font-weight:700;color:var(--text2)">${newSoc}</td>
    <td style="padding:5px 8px;text-align:center">${inp('3.20','#4a9eff','74,158,255','ocv-vtmin')}</td>
    <td style="padding:5px 8px;text-align:center">${inp('3.26','#00d4aa','0,212,170','ocv-v0')}</td>
    <td style="padding:5px 8px;text-align:center">${inp('3.28','#f5c518','245,197,24','ocv-v25')}</td>
    <td style="padding:5px 8px;text-align:center">${inp('3.30','#ff4d6d','255,77,109','ocv-vtmax')}</td>
    <td style="padding:4px 6px"><button onclick="this.closest('tr').remove();drawOCVCanvas()"
      style="padding:2px 6px;background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.3);color:var(--r);border-radius:3px;cursor:pointer;font-size:11px">✕</button></td>`;
  tbody.appendChild(tr);
  drawOCVCanvas();
}

function drawOCVCanvas() {
  const canvas = document.getElementById('ocv_canvas');
  if (!canvas) return;
  const W = 800, H = 420;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#07080b';
  ctx.fillRect(0, 0, W, H);

  const pad = { l: 70, r: 110, t: 38, b: 52 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  const pts = getOCVPoints();
  if (pts.length < 2) {
    ctx.fillStyle = '#3a567a'; ctx.font = '14px Barlow,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Enter OCV values in the table →', W/2, H/2); return;
  }

  const Tmin = parseFloat(document.getElementById('ocv_tmin')?.value ?? -20);
  const Tmax_t = parseFloat(document.getElementById('ocv_tmax')?.value ?? 45);

  // DoD window — adjustable, like capacitor charge curve with t_start and t_end
  const dod_raw = parseFloat(document.getElementById('ocv_dod')?.value)
               || parseFloat(document.getElementById('e_dod')?.value) || 1.0;
  const dod = Math.max(0.05, Math.min(1.0, dod_raw));

  const socMargin = (1 - dod) / 2;
  const socLo = socMargin * 100;        // e.g. DoD=0.8 → socLo=10%
  const socHi = (1 - socMargin) * 100; // e.g. DoD=0.8 → socHi=90%

  // Voltage range from data
  const allV = pts.flatMap(p => [p.tmin, p.t0, p.t25, p.tmax]).filter(v => v > 0);
  if (allV.length === 0) return;
  const vMin = Math.min(...allV) - 0.08;
  const vMax = Math.max(...allV) + 0.08;

  // ── Coordinate helpers ──
  const mapX = soc => pad.l + (soc / 100) * pw;
  const mapY = v   => pad.t + ph * (1 - (v - vMin) / (vMax - vMin));

  // ── Interpolate voltage at any SoC for a column ──
  const interpOCV = (col, soc) => {
    const sorted = [...pts].sort((a,b) => a.soc - b.soc);
    if (soc <= sorted[0].soc) return sorted[0][col];
    if (soc >= sorted[sorted.length-1].soc) return sorted[sorted.length-1][col];
    for (let i = 1; i < sorted.length; i++) {
      if (soc <= sorted[i].soc) {
        const t = (soc - sorted[i-1].soc) / (sorted[i].soc - sorted[i-1].soc);
        const v0 = sorted[i-1][col], v1 = sorted[i][col];
        if (v0 > 0 && v1 > 0) return v0 + t * (v1 - v0);
        return v0 > 0 ? v0 : v1;
      }
    }
    return sorted[sorted.length-1][col];
  };

  // ── SHADING outside DoD window (hatch outside usable window) ──
  // Left of socLo — greyed out (discharged below DoD)
  if (socLo > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.l, pad.t, (socLo/100)*pw, ph);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,77,109,0.06)';
    ctx.fillRect(pad.l, pad.t, (socLo/100)*pw, ph);
    // Hatch
    ctx.strokeStyle = 'rgba(255,77,109,0.18)';
    ctx.lineWidth = 1;
    for (let x = pad.l - ph; x < pad.l + (socLo/100)*pw + ph; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, pad.t + ph); ctx.lineTo(x + ph, pad.t); ctx.stroke();
    }
    ctx.restore();
  }
  // Right of socHi — greyed out (not used, DoD ceiling)
  if (socHi < 100) {
    const xHi = pad.l + (socHi/100)*pw;
    ctx.save();
    ctx.beginPath();
    ctx.rect(xHi, pad.t, pad.l+(pw)-(xHi-pad.l+(W-pad.l-pad.r-pw)), ph);
    ctx.rect(xHi, pad.t, pw - (socHi/100)*pw, ph);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,77,109,0.06)';
    ctx.fillRect(xHi, pad.t, W, ph);
    ctx.strokeStyle = 'rgba(255,77,109,0.18)';
    ctx.lineWidth = 1;
    for (let x = xHi - ph; x < xHi + pw + ph; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, pad.t + ph); ctx.lineTo(x + ph, pad.t); ctx.stroke();
    }
    ctx.restore();
  }

  // ── USABLE WINDOW shading (between socLo and socHi) ──
  const xLo = mapX(socLo), xHi2 = mapX(socHi);
  const usableGrad = ctx.createLinearGradient(xLo, 0, xHi2, 0);
  usableGrad.addColorStop(0, 'rgba(0,212,170,0.04)');
  usableGrad.addColorStop(0.5, 'rgba(0,212,170,0.09)');
  usableGrad.addColorStop(1, 'rgba(0,212,170,0.04)');
  ctx.fillStyle = usableGrad;
  ctx.fillRect(xLo, pad.t, xHi2 - xLo, ph);

  // ── GRID ──
  ctx.strokeStyle = 'rgba(24,40,64,0.8)'; ctx.lineWidth = 1;
  for (let s = 0; s <= 100; s += 10) {
    const x = mapX(s);
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t+ph); ctx.stroke();
  }
  for (let i = 0; i <= 5; i++) {
    const v = vMin + (vMax-vMin)*i/5;
    const y = mapY(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l+pw, y); ctx.stroke();
  }

  // ── CAPACITOR-STYLE FILL: shade under 25°C curve within DoD window ──
  // This gives the visual "charged region" look, like a capacitor 0→t_end
  const sorted25 = [...pts].sort((a,b)=>a.soc-b.soc);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(mapX(socLo), pad.t+ph);
  // Walk from socLo to socHi along 25°C curve
  for (let s = socLo; s <= socHi; s += 0.5) {
    const v = interpOCV('t25', s);
    if (v > 0) ctx.lineTo(mapX(s), mapY(v));
  }
  ctx.lineTo(mapX(socHi), pad.t+ph);
  ctx.closePath();
  const fillGrad = ctx.createLinearGradient(xLo, 0, xHi2, 0);
  fillGrad.addColorStop(0, 'rgba(0,212,170,0.10)');
  fillGrad.addColorStop(1, 'rgba(59,130,246,0.10)');
  ctx.fillStyle = fillGrad;
  ctx.fill();
  ctx.restore();

  // ── TEMPERATURE CURVES ──
  const curves = [
    { col:'tmin', color:'#60a5fa', label:`T_min (${Tmin}°C)`, dash:[5,3] },
    { col:'t0',   color:'#a78bfa', label:'0°C',                dash:[4,3] },
    { col:'t25',  color:'#00d4aa', label:'25°C ★',             dash:[]    },
    { col:'tmax', color:'#f97316', label:`T_max (${Tmax_t}°C)`,dash:[3,3] },
  ];

  curves.forEach(({col, color, label, dash}) => {
    const colPts = pts.filter(p => p[col] > 0).sort((a,b)=>a.soc-b.soc);
    if (colPts.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = col === 't25' ? 2.5 : 1.8;
    ctx.setLineDash(dash);
    let first = true;
    colPts.forEach(p => {
      const x = mapX(p.soc), y = mapY(p[col]);
      first ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      first = false;
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Dot markers at each data point
    colPts.forEach(p => {
      const x = mapX(p.soc), y = mapY(p[col]);
      ctx.beginPath(); ctx.arc(x, y, col==='t25'?3.5:2.5, 0, Math.PI*2);
      ctx.fillStyle = color; ctx.fill();
    });

    // Right-edge label
    const last = colPts[colPts.length-1];
    ctx.fillStyle = color; ctx.font = 'bold 11px Barlow,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(label, pad.l+pw+6, mapY(last[col])+4);
  });

  // ── DoD BOUNDARY LINES (like t=0 and t=t_end on capacitor curve) ──
  // Left boundary (SoC_lo = discharge cutoff, like t=0)
  ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2; ctx.setLineDash([6,3]);
  ctx.beginPath(); ctx.moveTo(xLo, pad.t-4); ctx.lineTo(xLo, pad.t+ph+4); ctx.stroke();
  ctx.setLineDash([]);
  // Right boundary (SoC_hi = charge target, like t_end)
  ctx.strokeStyle = '#00d4aa'; ctx.lineWidth = 2; ctx.setLineDash([6,3]);
  ctx.beginPath(); ctx.moveTo(xHi2, pad.t-4); ctx.lineTo(xHi2, pad.t+ph+4); ctx.stroke();
  ctx.setLineDash([]);

  // ── DoD BOUNDARY VOLTAGE DOTS on 25°C curve ──
  const vAtLo = interpOCV('t25', socLo);
  const vAtHi = interpOCV('t25', socHi);
  [[xLo, vAtLo, '#ff4d6d', `V@${socLo.toFixed(0)}%SoC = ${vAtLo.toFixed(3)}V`],
   [xHi2, vAtHi, '#00d4aa', `V@${socHi.toFixed(0)}%SoC = ${vAtHi.toFixed(3)}V`]
  ].forEach(([x, v, col, lbl]) => {
    if (v <= 0) return;
    const y = mapY(v);
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI*2);
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = '#07080b'; ctx.lineWidth = 2; ctx.stroke();
    // Voltage label inside the chart
    ctx.fillStyle = col; ctx.font = 'bold 11px JetBrains Mono,monospace'; ctx.textAlign = 'center';
    ctx.fillText(v.toFixed(3)+'V', x, y - 12);
  });

  // ── AXIS LABELS ──
  ctx.fillStyle = '#6d8fba'; ctx.font = '12px JetBrains Mono,monospace';
  // X axis (SoC %)
  for (let s = 0; s <= 100; s += 10) {
    ctx.fillStyle = (s>=socLo&&s<=socHi) ? '#dde8f8' : '#4a6080';
    ctx.textAlign = 'center';
    ctx.fillText(s+'%', mapX(s), pad.t+ph+17);
  }
  ctx.fillStyle = '#6d8fba'; ctx.textAlign = 'center';
  ctx.fillText('State of Charge →', pad.l+pw/2, H-6);

  // Y axis (Voltage)
  for (let i = 0; i <= 5; i++) {
    const v = vMin + (vMax-vMin)*i/5;
    ctx.fillStyle = '#6d8fba'; ctx.textAlign = 'right';
    ctx.fillText(v.toFixed(2)+'V', pad.l-7, mapY(v)+4);
  }

  // ── DoD ANNOTATION at top ──
  ctx.fillStyle = 'rgba(7,8,11,0.75)';
  ctx.fillRect(pad.l+4, pad.t+4, 280, 22);
  ctx.fillStyle = '#00d4aa'; ctx.font = 'bold 12px JetBrains Mono,monospace'; ctx.textAlign = 'left';
  ctx.fillText(`DoD ${(dod*100).toFixed(0)}%  SoC window: ${socLo.toFixed(0)}% – ${socHi.toFixed(0)}%  ΔV = ${(vAtHi-vAtLo).toFixed(3)}V`, pad.l+8, pad.t+19);

  // ── Update summary panel ──
  const sumEl = document.getElementById('ocv_dod_summary');
  if (sumEl) {
    const vTminLo  = interpOCV('tmin', socLo);
    const vTminHi  = interpOCV('tmin', socHi);
    const Stot = S.S_total || 112;
    sumEl.innerHTML = [
      {l:'SoC window', v:`${socLo.toFixed(0)}% – ${socHi.toFixed(0)}%`},
      {l:'V @SoC_lo (25°C)', v:`${vAtLo.toFixed(3)} V`},
      {l:'V @SoC_hi (25°C)', v:`${vAtHi.toFixed(3)} V`},
      {l:'ΔV (25°C)',  v:`${(vAtHi-vAtLo).toFixed(3)} V`},
      {l:'Pack V range', v:`${(vAtLo*Stot).toFixed(1)}–${(vAtHi*Stot).toFixed(1)} V`},
      {l:'Cold V @SoC_lo', v:vTminLo>0?`${vTminLo.toFixed(3)} V`:'—'},
    ].map(r=>`<span style="display:inline-flex;flex-direction:column;gap:2px;min-width:110px"><span style="font-size:10px;color:var(--text3)">${r.l}</span><span style="font-size:13px;font-weight:700;color:var(--g)">${r.v}</span></span>`).join('');
  }
}


// ═══════════════════════════════════════════════════════
// CURRENT / POWER BREAKDOWN — 4 TEMPERATURE ZONES
// ═══════════════════════════════════════════════════════
function drawCurrentCanvas() {
  const v = vizCanvas('curr_canvas', 200);
  if (!v) return;
  const { ctx, W, H } = v;
  const pad = { l: 54, r: 24, t: 28, b: 40 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  const app    = S.app || 'Excavator';
  const P_hyd  = getV('curr_phyd') || 19;
  const eta_m  = getV('curr_meff') || 0.93;
  const eta_i  = getV('curr_ieff') || 0.95;
  const P_trac = getV('curr_ptrac') || 5;
  const eta_tm = getV('curr_tmeff') || 0.90;
  const P_tms  = getV('curr_ptms') || 0;
  const P_hvac = getV('curr_phvac') || 0;
  const P_aux  = getV('curr_paux') || 2.5;
  const P_add  = getV('curr_padd') || 0;
  const eta_dc = getV('curr_dceff') || 0.92;
  const Vnom   = getV('curr_vnom') || S.V_nom_pack || 358;
  const Qah    = getV('curr_qah') || S.Q_pack || 120;
  const Tmin   = S.t_top_lo || -20;
  const Tmax   = S.t_top_hi || 45;

  const calcComponents = (T) => {
    const tf = T < 0 ? 1 + Math.abs(T)*0.015 : T > 35 ? 1+(T-35)*0.012 : 1.0;
    let p_hyd=0, p_trac=0, p_tms_v=0, p_hvac_v=0, p_aux_v=0, p_add_v=P_add;
    switch(app){
      case '2W': p_trac=P_trac/(eta_tm*eta_i); p_aux_v=P_aux/eta_dc; p_tms_v=P_tms*tf; break;
      case '4W': p_trac=P_trac/(eta_tm*eta_i); p_hvac_v=P_hvac*tf; p_aux_v=P_aux/eta_dc; p_tms_v=P_tms*tf; break;
      default:   p_hyd=P_hyd/(eta_m*eta_i); p_trac=P_trac/(eta_tm*eta_i); p_tms_v=P_tms*tf; p_hvac_v=P_hvac*tf; p_aux_v=P_aux/eta_dc;
    }
    const total = p_hyd+p_trac+p_tms_v+p_hvac_v+p_aux_v+p_add_v;
    return {p_hyd, p_trac, p_tms:p_tms_v, p_hvac:p_hvac_v, p_aux:p_aux_v, p_add:p_add_v, total};
  };

  const zones = [
    { T: Tmin, col: '#4a9eff', label: `T_min\n${Tmin}°C` },
    { T: 0,    col: '#00d4aa', label: '0°C' },
    { T: 25,   col: '#f5c518', label: '25°C' },
    { T: Tmax, col: '#ff4d6d', label: `T_max\n${Tmax}°C` },
  ].map(z => ({ ...z, ...calcComponents(z.T) }));

  const maxP = Math.max(...zones.map(z => z.total)) * 1.25;
  const target = S.t_pcont || 50;
  const bw = Math.min(60, pw / (zones.length * 2.2));
  const gap = pw / zones.length;

  vizGrid(ctx, W, H, pad, zones.length, 4);

  // Target line
  const ytgt = pad.t + ph * (1 - target / maxP);
  vizThreshold(ctx, ytgt, W, pad, '#f5c518', `P_cont ${target}kW`);

  const compCols = ['#4a9eff','#00d4aa','#f5c518','#ff7b35','#a78bfa','#ff4d6d'];
  const compKeys = ['p_hyd','p_trac','p_tms','p_hvac','p_aux','p_add'];
  const compNames = ['Hydraulic','Traction','TMS','HVAC','Aux/DC-DC','Other'];

  zones.forEach((z, gi) => {
    const x0 = pad.l + gi * gap + (gap - bw) / 2;
    let yStack = pad.t + ph;

    compKeys.forEach((k, ci) => {
      const val = z[k] || 0;
      if (val < 0.05) return;
      const bh = (val / maxP) * ph;
      yStack -= bh;
      vizBar(ctx, x0, yStack, bw, bh, compCols[ci] + 'cc', 2);
    });

    // Total label above bar
    const barH = (z.total / maxP) * ph;
    const yTop = pad.t + ph - barH;
    vizLabel(ctx, z.total.toFixed(1) + 'kW', x0 + bw/2, yTop - 5,
      z.total > target ? '#ff4d6d' : '#dde8f8', 9, 'center');

    // X label
    const lbls = z.label.split('\n');
    vizLabel(ctx, lbls[0], x0 + bw/2, H - pad.b + 12, z.col, 9, 'center');
    if (lbls[1]) vizLabel(ctx, lbls[1], x0 + bw/2, H - pad.b + 22, z.col, 8, 'center');
  });

  // Y-axis
  for (let i = 0; i <= 4; i++) {
    const val = (maxP * i / 4).toFixed(0);
    const y = pad.t + ph * (1 - i / 4);
    vizLabel(ctx, val, pad.l - 4, y + 3, '#3a567a', 9, 'right');
  }
  vizLabel(ctx, 'kW', 4, pad.t, '#3a567a', 9);

  // Component legend
  const activeComps = compKeys.map((k,i) => ({ k, i, name: compNames[i] }))
    .filter(c => zones.some(z => (z[c.k]||0) > 0.05));
  activeComps.forEach((c, li) => {
    const lx = pad.l + li * 80;
    if (lx + 70 > W) return;
    ctx.fillStyle = compCols[c.i] + 'cc';
    ctx.fillRect(lx, pad.t - 15, 8, 6);
    vizLabel(ctx, c.name, lx + 11, pad.t - 9, '#6d8fba', 8);
  });

  // Build temp summary table
  const tableEl = document.getElementById('curr_temp_table');
  if (tableEl) {
    let h = `<table><tr><th>Zone</th><th>Temp</th><th>P_total</th><th>I_bat</th><th>C-rate</th><th>vs P_cont</th></tr>`;
    zones.forEach(z => {
      const I = z.total * 1000 / Vnom;
      const cr = (I / Qah).toFixed(3);
      const ok = z.total <= target;
      h += `<tr>
        <td><span style="color:${z.col};font-weight:700">${z.label.replace('\n',' ')}</span></td>
        <td style="font-family:var(--mono)">${z.T}°C</td>
        <td style="font-family:var(--mono);color:${ok?'var(--g)':'var(--r)'}">${z.total.toFixed(1)} kW</td>
        <td style="font-family:var(--mono)">${I.toFixed(0)} A</td>
        <td style="font-family:var(--mono)">${cr}C</td>
        <td>${ok ? tag('✓ OK','g') : tag('✗ Over','r')}</td>
      </tr>`;
    });
    tableEl.innerHTML = h + '</table>';
  }
}

// ═══════════════════════════════════════════════════════
// CHARGING CANVAS — fixed text overlap
// ═══════════════════════════════════════════════════════
function drawChargingCanvas() {
  const v = vizCanvas('chg_canvas', 200);
  if (!v) return;
  const { ctx, W, H } = v;
  const pad = { l: 50, r: 22, t: 28, b: 42 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  const Eu   = getV('chg_eu')   || S.E_usable || 38;
  const Ss   = getV('chg_S')    || S.S_total  || 112;
  const v10  = getV('chg_v10')  || S.c_ocv10  || 3.22;
  const v90  = getV('chg_v90')  || S.c_ocv90  || 3.35;
  const Imax = getV('chg_imax') || 120;
  const Qah  = getV('chg_qah')  || S.Q_pack   || 120;
  const Vavg = Ss * ((v10 + v90) / 2);

  const maxP = 360;
  const powers = [3.3,7,11,22,50,60,80,120,150,200,350];
  const ideal_pts = [], lim_pts = [];

  powers.forEach(pw_v => {
    const t_ideal = (Eu / pw_v) * 60;
    const I = (pw_v * 1000) / Vavg;
    const I_lim = Math.min(I, Imax);
    const t_lim = (Eu / (I_lim * Vavg / 1000)) * 60;
    ideal_pts.push([pw_v, t_ideal]);
    lim_pts.push([pw_v, t_lim]);
  });

  const maxT = Math.min((Eu / powers[0]) * 60 * 1.12, 400); // cap at 400 min (~6.7 hours)
  const mapX = p => pad.l + (Math.min(p, maxP) / maxP) * pw;
  const mapY = t => pad.t + ph * (1 - Math.min(t / maxT, 1));

  vizGrid(ctx, W, H, pad, 6, 5);

  // I_max constraint line
  const P_Imax = Imax * Vavg / 1000;
  const xImax = mapX(P_Imax);
  if (xImax > pad.l && xImax < W - pad.r) {
    ctx.strokeStyle = 'rgba(255,123,53,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.moveTo(xImax, pad.t + 20); ctx.lineTo(xImax, H - pad.b); ctx.stroke();
    ctx.setLineDash([]);
    // Label above chart area only
    vizLabel(ctx, `I_max=${Imax}A`, xImax, pad.t + 14, '#ff7b35', 8, 'center');
  }

  // Ideal curve (teal)
  ctx.beginPath();
  ctx.moveTo(mapX(ideal_pts[0][0]), H - pad.b);
  ideal_pts.forEach(([p]) => ctx.lineTo(mapX(p), mapY((Eu/p)*60)));
  ctx.lineTo(mapX(ideal_pts[ideal_pts.length-1][0]), H - pad.b);
  ctx.closePath(); ctx.fillStyle = 'rgba(0,212,170,0.06)'; ctx.fill();
  vizLine(ctx, ideal_pts.map(([p,t]) => [mapX(p), mapY(t)]), '#00d4aa', 2);

  // I-limited curve (orange dashed)
  vizLine(ctx, lim_pts.map(([p,t]) => [mapX(p), mapY(t)]), '#ff7b35', 2, [6,3]);

  // Operating point dots — placed without overlap
  const curr_pac = getV('chg_pac') || 22;
  const curr_pdc = getV('chg_pdc') || 60;
  const dots = [
    { P: curr_pac, col: '#4a9eff', label: 'AC' },
    { P: curr_pdc, col: '#00d4aa', label: 'DC' },
  ];
  dots.forEach((d, di) => {
    const I = (d.P * 1000) / Vavg;
    const I_lim = Math.min(I, Imax);
    const t = (Eu / (I_lim * Vavg / 1000)) * 60;
    const x = mapX(d.P), y = mapY(t);
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = d.col; ctx.fill();
    // Offset label so they don't overlap
    const lx = x + (di === 0 ? -4 : 8);
    const ly = y - 9;
    vizLabel(ctx, `${d.label}: ${t.toFixed(0)}min`, lx, ly, d.col, 9, di===0?'right':'left');
  });

  // Legend — top right corner only
  vizLabel(ctx, '━ Ideal', W - pad.r - 68, pad.t + 12, '#00d4aa', 9);
  vizLabel(ctx, '- - I-limited', W - pad.r - 68, pad.t + 24, '#ff7b35', 9);

  // X axis ticks — sparse to avoid overlap
  [0, 50, 100, 150, 200, 300, 350].forEach(p => {
    vizLabel(ctx, p+'kW', mapX(p), H - pad.b + 14, '#3a567a', 8, 'center');
  });
  for (let i = 0; i <= 5; i++) {
    const t = maxT * i / 5;
    vizLabel(ctx, t.toFixed(0), pad.l - 4, mapY(t) + 3, '#3a567a', 9, 'right');
  }
  vizLabel(ctx, 'min', 4, pad.t, '#3a567a', 9);
  vizLabel(ctx, 'Charger Power (kW)', W/2, H - 5, '#3a567a', 9, 'center');
}

// ═══════════════════════════════════════════════════════
// DRIVE CYCLE LIVE CANVAS
// ═══════════════════════════════════════════════════════
window._dcView = 'p'; // current chart view: p/v/i/all

function dcSetView(view) {
  window._dcView = view;
  ['p','v','i','all'].forEach(k => {
    const btn = document.getElementById('dc_btn_' + k);
    if (!btn) return;
    if (k === view) {
      btn.style.background = 'rgba(0,212,170,.2)';
      btn.style.borderColor = 'rgba(0,212,170,.5)';
      btn.style.color = 'var(--g)';
    } else {
      btn.style.background = 'var(--bg3)';
      btn.style.borderColor = 'var(--border)';
      btn.style.color = 'var(--text2)';
    }
  });
  drawDriveCycleCanvas();
}

function getDCPoints() {
  const rows = document.querySelectorAll('#dc_manual_rows .dc-row');
  const pts = [];
  rows.forEach(r => {
    const tEl = r.querySelector('.dc-t');
    const pEl = r.querySelector('.dc-p');
    if (!tEl || !pEl) return;
    const t = parseFloat(tEl.value);
    const p = parseFloat(pEl.value);
    if (!isNaN(t) && !isNaN(p)) pts.push({ t, p });
  });
  return pts.sort((a, b) => a.t - b.t);
}

function addDCRow() {
  const container = document.getElementById('dc_manual_rows');
  const rows = container.querySelectorAll('.dc-row');
  const lastRow = rows[rows.length - 1];
  const lastT = lastRow ? parseFloat(lastRow.querySelector('.dc-t')?.value || 0) : 0;
  const newT = lastT + 600;
  const div = document.createElement('div');
  div.className = 'dc-row';
  div.style.cssText = 'display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin-bottom:4px;align-items:center';
  div.innerHTML = `
    <input type="number" value="${newT}" step="10" class="dc-t" style="padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-family:var(--mono);font-size:11px" oninput="drawDriveCycleCanvas()">
    <input type="number" value="10" step="0.5" class="dc-p" style="padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-family:var(--mono);font-size:11px" oninput="drawDriveCycleCanvas()">
    <button onclick="this.closest('.dc-row').remove();drawDriveCycleCanvas()" style="padding:4px 8px;background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.3);color:var(--r);border-radius:4px;cursor:pointer;font-size:11px">✕</button>`;
  container.appendChild(div);
  drawDriveCycleCanvas();
  // Auto-trigger thermal rise when manual rows change
  if (typeof runThermalRise === 'function') setTimeout(runThermalRise, 100);
}

function drawDriveCycleCanvas() {
  const v = vizCanvas('dc_canvas', 220);
  if (!v) return;
  const { ctx, W, H } = v;
  const view = window._dcView || 'p';
  const pad = { l: 54, r: view==='all'?58:22, t: 22, b: 40 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  const pts = getDCPoints();
  if (pts.length < 2) {
    vizLabel(ctx, 'Add at least 2 time points above ↑', W/2, H/2, '#3a567a', 11, 'center');
    return;
  }

  const Vnom = S.V_nom_pack || getV('curr_vnom') || 358;
  const Qah  = S.Q_pack     || getV('curr_qah')  || 120;

  // Interpolate to smooth curve
  const tMin = pts[0].t, tMax = pts[pts.length-1].t;
  const nPts  = Math.min(Math.max(pts.length * 8, 80), 400);
  const interp = [];
  for (let i = 0; i < nPts; i++) {
    const t = tMin + (tMax - tMin) * i / (nPts - 1);
    // Find surrounding points
    let lo = pts[0], hi = pts[pts.length-1];
    for (let j = 0; j < pts.length - 1; j++) {
      if (pts[j].t <= t && pts[j+1].t >= t) { lo = pts[j]; hi = pts[j+1]; break; }
    }
    const frac = (hi.t - lo.t) > 0 ? (t - lo.t) / (hi.t - lo.t) : 0;
    const p = lo.p + (hi.p - lo.p) * frac;
    const I = p * 1000 / Vnom;
    // Crude SoC model: integrate from 100%
    const soc = Math.max(0, Math.min(100, 100 - (p * (t - tMin)) / (Vnom * Qah / 1000) * 100 / 3600));
    const vBatt = Vnom * (0.9 + soc/100 * 0.15); // simplified V(SoC) model
    interp.push({ t, p, I, soc, vBatt });
  }

  const maxP    = Math.max(1, ...interp.map(d => Math.abs(d.p)));
  const maxV    = Math.max(...interp.map(d => d.vBatt)) * 1.08;
  const minV    = Math.min(...interp.map(d => d.vBatt)) * 0.96;
  const maxI    = Math.max(1, ...interp.map(d => Math.abs(d.I)));
  const Pavg_dc = interp.reduce((s,d) => s + d.p, 0) / interp.length;

  const mapX  = t => pad.l + ((t - tMin) / (tMax - tMin)) * pw;
  const mapYp = p => pad.t + ph * (1 - (p + maxP * 0.1) / (maxP * 1.2));
  const mapYv = vb => pad.t + ph * (1 - (vb - minV) / (maxV - minV));
  const mapYi = I  => pad.t + ph * (1 - (Math.abs(I) + maxI * 0.05) / (maxI * 1.1));

  vizGrid(ctx, W, H, pad, 6, 4);

  // Zero line for power (regen)
  const yZero = mapYp(0);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.l, yZero); ctx.lineTo(W - pad.r, yZero); ctx.stroke();

  // P_avg line
  const yPavg = mapYp(Pavg_dc);
  vizThreshold(ctx, yPavg, W, pad, 'rgba(245,197,24,.5)', `P_avg ${Pavg_dc.toFixed(1)}kW`);

  // Regen fill (negative power)
  const regenPts = interp.filter(d => d.p < 0);
  if (regenPts.length > 1 && (view==='p'||view==='all')) {
    ctx.beginPath();
    ctx.moveTo(mapX(regenPts[0].t), yZero);
    regenPts.forEach(d => ctx.lineTo(mapX(d.t), mapYp(d.p)));
    ctx.lineTo(mapX(regenPts[regenPts.length-1].t), yZero);
    ctx.closePath(); ctx.fillStyle = 'rgba(0,212,170,0.12)'; ctx.fill();
  }

  // Draw curves based on view
  if (view === 'p' || view === 'all') {
    // Area fill for power
    ctx.beginPath();
    ctx.moveTo(mapX(interp[0].t), yZero);
    interp.forEach(d => ctx.lineTo(mapX(d.t), mapYp(Math.max(d.p, 0))));
    ctx.lineTo(mapX(interp[interp.length-1].t), yZero);
    ctx.closePath(); ctx.fillStyle = 'rgba(255,123,53,0.08)'; ctx.fill();
    vizLine(ctx, interp.map(d => [mapX(d.t), mapYp(d.p)]), '#ff7b35', view==='all'?1.5:2.5);
  }
  if (view === 'v' || view === 'all') {
    vizLine(ctx, interp.map(d => [mapX(d.t), mapYv(d.vBatt)]), '#4a9eff', view==='all'?1.5:2.5, view==='all'?[5,3]:[]);
  }
  if (view === 'i' || view === 'all') {
    vizLine(ctx, interp.map(d => [mapX(d.t), mapYi(d.I)]), '#00d4aa', view==='all'?1.5:2.5, view==='all'?[3,3]:[]);
  }

  // Right Y-axis for voltage when showing all
  if (view === 'all' || view === 'v') {
    const vSteps = 4;
    for (let i = 0; i <= vSteps; i++) {
      const vv = minV + (maxV - minV) * i / vSteps;
      vizLabel(ctx, vv.toFixed(0)+'V', W - pad.r + 3, mapYv(vv) + 3, '#4a9eff', 8);
    }
    vizLabel(ctx, 'V', W - pad.r + 3, pad.t, '#4a9eff', 9);
  }

  // Left Y-axis (power or current)
  const leftMax = (view==='i') ? maxI : maxP;
  const leftUnit = (view==='i') ? 'A' : 'kW';
  const leftCol  = (view==='i') ? '#00d4aa' : '#ff7b35';
  for (let i = 0; i <= 4; i++) {
    const val = (-leftMax * 0.1 + (leftMax * 1.2) * i / 4).toFixed(0);
    const y = pad.t + ph * (1 - i / 4);
    vizLabel(ctx, val, pad.l - 4, y + 3, '#3a567a', 9, 'right');
  }
  vizLabel(ctx, leftUnit, 4, pad.t, leftCol, 9);

  // X axis — time in minutes
  const tSpan = tMax - tMin;
  const tStep = tSpan <= 3600 ? 300 : tSpan <= 14400 ? 1800 : 3600;
  for (let t = tMin; t <= tMax; t += tStep) {
    const x = mapX(t);
    vizLabel(ctx, (t/60).toFixed(0)+'min', x, H - pad.b + 14, '#3a567a', 8, 'center');
  }
  vizLabel(ctx, 'Time (min)', W/2, H - 4, '#3a567a', 9, 'center');

  // Stats bar
  const statsEl = document.getElementById('dc_canvas_stats');
  if (statsEl) {
    const peakP = Math.max(...interp.map(d=>d.p)).toFixed(1);
    const minP  = Math.min(...interp.map(d=>d.p)).toFixed(1);
    const E_kWh = (interp.reduce((s,d)=>s+d.p,0) * (tMax-tMin) / nPts / 3600).toFixed(2);
    statsEl.innerHTML = `
      <span style="color:#ff7b35">P_peak: <b>${peakP}kW</b></span>
      <span style="color:#00d4aa">P_avg: <b>${Pavg_dc.toFixed(1)}kW</b></span>
      <span style="color:${+minP<0?'#00d4aa':'#6d8fba'}">P_min: <b>${minP}kW</b></span>
      <span style="color:#4a9eff">E_total: <b>${E_kWh}kWh</b></span>
      <span style="color:#6d8fba">Duration: <b>${((tMax-tMin)/60).toFixed(0)}min</b></span>`;
  }
}

// [showSec viz hooks merged into main showSec function]

// ── Master redraw ──
function redrawAll() {
  try { drawEnergyCanvas();      } catch(e) {}
  try { drawVoltCanvas();        } catch(e) {}
  try { drawCurrentCanvas();     } catch(e) {}
  try { drawThermalCanvas();     } catch(e) {}
  try { drawChargingCanvas();    } catch(e) {}
  try { drawLifecycleCanvas();   } catch(e) {}
  try { drawResistanceCanvas();  } catch(e) {}
  try { drawOCVCanvas();         } catch(e) {}
  try { drawDriveCycleCanvas();  } catch(e) {}
}

// Hook into each calc function to auto-redraw its canvas
const _origCalcEnergy = calcEnergy;
window.calcEnergy = function() { _origCalcEnergy.apply(this, arguments); try { drawEnergyCanvas(); } catch(e) {} };
calcEnergy = window.calcEnergy;

const _origCalcVoltage = calcVoltage;
window.calcVoltage = function() { _origCalcVoltage.apply(this, arguments); try { drawVoltCanvas(); } catch(e) {} };
calcVoltage = window.calcVoltage;

const _origCalcCurrent = calcCurrent;
window.calcCurrent = function() { _origCalcCurrent.apply(this, arguments); try { drawCurrentCanvas(); } catch(e) {} };
calcCurrent = window.calcCurrent;

const _origCalcThermal = calcThermal;
window.calcThermal = function() { _origCalcThermal.apply(this, arguments); try { drawThermalCanvas(); } catch(e) {} };
calcThermal = window.calcThermal;

const _origCalcCharge = calcCharge;
window.calcCharge = function() { _origCalcCharge.apply(this, arguments); try { drawChargingCanvas(); } catch(e) {} };
calcCharge = window.calcCharge;

const _origCalcLifecycle = calcLifecycle;
window.calcLifecycle = function() { _origCalcLifecycle.apply(this, arguments); try { drawLifecycleCanvas(); } catch(e) {} };
calcLifecycle = window.calcLifecycle;

const _origCalcResistance = calcResistance;
window.calcResistance = function() { _origCalcResistance.apply(this, arguments); try { drawResistanceCanvas(); } catch(e) {} };
calcResistance = window.calcResistance;

// [showSec canvas hooks merged into main showSec function]

// [_showSecImpl merged into top-level showSec]


function updateCCCV() {
  const Icc=getV('bms_icc'), Vcv=getV('bms_vcv'), Ico=getV('bms_ico');
  const Eu = S.E_usable||38;
  const Vavg = S.V_nom_pack||358;
  const t_cc = (Eu*3600)/(Icc*(Vavg/1000)); // seconds approx
  const t_cv_est = t_cc * 0.15; // CV tail ~15% of CC time
  const t_total = (t_cc+t_cv_est)/60;
  const Crate = Icc/(S.Q_pack||120);
  document.getElementById('cccv_results').innerHTML = `
    <div class="rg">
      ${ri('CC Time (est.)',(t_cc/60).toFixed(0),'min','neutral')}
      ${ri('CV tail (est.)',(t_cv_est/60).toFixed(0),'min','neutral')}
      ${ri('Total charge time',t_total.toFixed(0),'min','blue')}
      ${ri('CC C-rate',Crate.toFixed(3),'C',Crate>1?'warn':'ok')}
      ${ri('CV cutoff',Ico,'A (C/'+Math.round(Icc/Ico)+')','')}
    </div>`;
}


function addExtraResComponent() {
  const div = document.getElementById('extra_res_components');
  const row = document.createElement('div');
  row.className = 'extra-res-row';
  row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;margin-bottom:6px;align-items:center';
  row.innerHTML = `<select style="padding:6px;background:var(--bg);border:1px solid var(--bd);border-radius:5px;color:var(--t);font-size:10px" onchange="updateExtraRes()">
      <option>Main Contactor (closed)</option><option>Fuse</option><option>HV Connector</option><option>Wiring harness</option><option>Current shunt</option><option>Custom</option>
    </select>
    <input type="number" value="0.1" step="0.05" placeholder="R (mΩ)" style="padding:6px;background:var(--bg);border:1px solid var(--bd);border-radius:5px;color:var(--t);font-family:DM Mono;font-size:11px" oninput="updateExtraRes()">
    <input type="number" value="1" placeholder="Qty" style="padding:6px;background:var(--bg);border:1px solid var(--bd);border-radius:5px;color:var(--t);font-family:DM Mono;font-size:11px" oninput="updateExtraRes()">
    <input type="text" value="" placeholder="Part ref." style="padding:6px;background:var(--bg);border:1px solid var(--bd);border-radius:5px;color:var(--m);font-size:10px">
    <button class="btn sm" style="margin:0;background:var(--r)" onclick="this.closest('.extra-res-row').remove();updateExtraRes()">✕</button>`;
  div.appendChild(row);
}

function updateExtraRes() {
  let total = 0;
  document.querySelectorAll('.extra-res-row').forEach(row => {
    const inputs = row.querySelectorAll('input[type="number"]');
    if(inputs.length >= 2) total += (+inputs[0].value||0) * (+inputs[1].value||1);
  });
  setRg('extra_res_total', [{l:'HV Path Extra',v:total.toFixed(3),u:'mΩ',c:'warn'},{l:'vs Pack Total',v:'add to R_pack',u:'',c:'neutral'}]);
}


// ── BOM CALCULATOR ──
function addBOMRow() {
  const tbody = document.getElementById('bom_extra_rows');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.className = 'bom-row';
  tr.style.borderBottom = '1px solid var(--border)';
  tr.innerHTML = `
    <td style="padding:5px 6px"><input type="text" class="bom-name" value="Component" style="width:100%;padding:4px 7px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:13px" oninput="calcBOM()"></td>
    <td style="padding:5px 6px"><input type="number" class="bom-cost" value="100" step="10" style="width:100%;padding:4px 7px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:var(--mono);font-size:13px;text-align:right" oninput="calcBOM()"></td>
    <td style="padding:5px 6px"><input type="number" class="bom-qty" value="1" min="1" style="width:100%;padding:4px 7px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:var(--mono);font-size:13px;text-align:right" oninput="calcBOM()"></td>
    <td style="padding:4px 5px"><button onclick="this.closest('tr').remove();calcBOM()" style="padding:2px 6px;background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.3);color:var(--r);border-radius:3px;cursor:pointer;font-size:11px">✕</button></td>`;
  tbody.appendChild(tr);
  calcBOM();
