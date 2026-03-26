function calcPrecharge() {
  const C      = getV('pc_C');
  const Vbat   = getV('pc_Vbat');
  const Vlo    = getV('pc_Vlo');
  const t_pre  = getV('pc_t');
  const n      = getV('pc_n');
  const Rs     = getV('pc_Rs');           // main circuit resistance when contactor closes (Ω)
  const alpha  = getV('pc_alpha');
  const Imax   = getV('pc_Imax');
  const Ileak  = getV('pc_Ileak');
  const margin = getV('pc_margin');
  const Icont  = getV('pc_Icont') || 500; // contactor current rating

  // ── Resistor sizing ──
  const tau_time  = t_pre / n;
  const R_by_time = tau_time / C;
  const R_by_Imax = Imax > 0 ? Vbat / Imax : Infinity;
  const R_by_leak = Ileak > 0 ? (1 - alpha) * Vbat / Ileak : Infinity;
  const R_sel = Math.max(
    R_by_time,
    isFinite(R_by_Imax) ? R_by_Imax : 0,
    isFinite(R_by_leak) ? R_by_leak : 0
  );

  // ── Results ──
  const tau_act  = R_sel * C;
  const E_cap    = 0.5 * C * Vbat * Vbat;         // J — capacitor stored energy
  const E_res    = E_cap;                           // worst-case energy dissipated in R
  const I_peak   = Vbat / R_sel;                    // initial current at t=0
  const P_peak   = Vbat * Vbat / R_sel;             // peak power
  const P_avg    = E_res / t_pre;

  // Voltage at end of precharge cycle (after n time constants)
  const Vc_final = Vbat * (1 - Math.exp(-n));

  // ── Inrush at main contactor close ──
  // When main contactor closes: V_delta = V_bat - Vc_final
  // Inrush = V_delta / R_main_circuit (total series resistance when closed)
  // Rs here is the actual measured/spec main circuit resistance
  const V_delta   = Vbat - Vc_final;               // residual voltage across cap
  // R_main_total = precharge R in parallel with (near-zero main path) + Rs
  // At close moment, precharge R is bypassed → inrush = V_delta / Rs
  const R_main_eff = Rs > 0 ? Rs : 0.001;           // avoid div/0
  const I_main_inrush = V_delta / R_main_eff;        // this is correct physics

  // Inrush threshold = min(Icont, 20A safety default)
  // The contactor rated inrush is the proper threshold — not arbitrary 5A
  // ── Inrush limit: use user-defined target, fall back to 10% of contactor rating ──
  const inrush_user = +getV('pc_inrush_limit') || 0;
  const inrush_limit = inrush_user > 0 ? inrush_user : Math.min(Icont * 0.1, 50);

  setRg('pc_results', [
    {l:'R by time constant', v:R_by_time.toFixed(1),  u:'Ω', c:'neutral',
      t:`τ = t_pre/n = ${t_pre}/${n} = ${tau_time.toFixed(3)}s · R = τ/C = ${tau_time.toFixed(3)}/${C}`},
    {l:'R by I_max limit',   v:isFinite(R_by_Imax)?R_by_Imax.toFixed(1):'N/A', u:'Ω', c:'neutral',
      t:'V_bat ÷ I_max — limits peak current through precharge resistor'},
    {l:'R by leakage',       v:isFinite(R_by_leak)?R_by_leak.toFixed(1):'N/A', u:'Ω', c:'neutral',
      t:'(1-α)×V_bat ÷ I_leak — ensures pre-close voltage is met'},
    {l:'R SELECTED',         v:R_sel.toFixed(1),  u:'Ω', c:'blue',
      t:'max of all three methods — takes worst case for safety'},
    {l:'τ (actual RC)',      v:(tau_act*1000).toFixed(1), u:'ms', c:'neutral',
      t:'R_sel × C — time for one RC time constant'},
    {l:'I_peak at t=0',      v:I_peak.toFixed(1), u:'A', c:I_peak>Imax&&Imax>0?'warn':'ok',
      t:'V_bat ÷ R_sel — initial current spike through resistor at start'},
    {l:'P_peak at t=0',      v:P_peak.toFixed(0), u:'W', c:'warn',
      t:'V_bat² ÷ R_sel — worst-case instantaneous power in resistor'},
    {l:'P_avg over t_pre',   v:P_avg.toFixed(1),  u:'W', c:'neutral',
      t:'E_res ÷ t_pre — average power dissipated'},
    {l:'E_cap (stored)',     v:E_cap.toFixed(1),  u:'J', c:'neutral',
      t:'½ × C × V_bat² — energy stored in capacitor'},
    {l:'Min resistor rating',v:(E_res*margin).toFixed(0), u:'J', c:'ok',
      t:`E_res × ${margin} safety margin — select resistor rated ≥ this for single pulse`},
    {l:'Vc after n×τ',       v:Vc_final.toFixed(2), u:'V', c:'neutral',
      t:`V_bat × (1 - e^-${n}) = ${(Vc_final/Vbat*100).toFixed(2)}% of V_bat`},
    {l:'V_delta at close',   v:V_delta.toFixed(4), u:'V', c:'neutral',
      t:'Residual voltage across cap when main contactor closes — drives inrush'},
    {l:'Inrush at main close',v:I_main_inrush.toFixed(2), u:'A',
      c:I_main_inrush > inrush_limit ? 'err' : 'ok',
      t:`V_delta ÷ R_main. R_main=${(R_main_eff*1000).toFixed(1)}mΩ. Limit = ${inrush_limit.toFixed(0)}A (your target: ${inrush_user>0?inrush_user+'A user-set':Icont+'A×10% auto'})`},
  ]);

  // ── Checks table ──
  const checks = [
    [`Vc ≥ α×Vbat (${(alpha*100).toFixed(0)}% = ${(alpha*Vbat).toFixed(1)}V)`,
      Vc_final >= alpha * Vbat - 0.01,
      `Vc=${Vc_final.toFixed(2)}V`,
      'Voltage must reach threshold before main close — prevents contact arc'],
    [`I_peak ≤ I_max (${Imax}A)`,
      Imax <= 0 || I_peak <= Imax,
      `${I_peak.toFixed(1)}A`,
      'Initial resistor current — protects precharge resistor'],
    [`Inrush ≤ ${inrush_limit.toFixed(0)}A (target: ${inrush_user>0?'user-set':'auto 10% of '+Icont+'A'})`,
      I_main_inrush <= inrush_limit,
      `${I_main_inrush.toFixed(2)}A`,
      'Inrush when main closes = V_delta ÷ R_main. Reduce R_main or extend precharge time to reduce.'],
    [`Resistor energy ≥ ${margin}× E_cap`,
      true,
      `Min rating: ${(E_res*margin).toFixed(0)}J`,
      'Select resistor with pulse energy rating ≥ this'],
    [`τ < t_pre (τ=${(tau_act*1000).toFixed(1)}ms < ${t_pre*1000}ms)`,
      tau_act < t_pre,
      `${(tau_act*1000).toFixed(1)}ms vs ${t_pre*1000}ms`,
      'RC time constant must be shorter than desired precharge time'],
  ];
  let chk = `<table><tr><th>Check</th><th>Result</th><th>Value</th><th>Guidance</th></tr>`;
  checks.forEach(([l, p, v, note]) =>
    chk += `<tr><td style="font-weight:500">${l}</td><td>${tag(p?'✓ PASS':'✗ FAIL', p?'g':'r')}</td><td style="font-size:10px;color:var(--m);font-family:var(--mono)">${v}</td><td style="font-size:9px;color:var(--text3)">${note}</td></tr>`
  );
  const _pcc = document.getElementById('pc_checks');
  if (_pcc) _pcc.innerHTML = chk + '</table>';

  // ── Notes ──
  const _notes = document.getElementById('pc_notes');
  if (_notes && I_main_inrush > inrush_limit) {
    _notes.innerHTML = `<div style="padding:8px 12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:7px;font-size:10px;color:#ef4444;margin-top:8px;line-height:1.7">
      <b>⚠️ High inrush at contactor close (${I_main_inrush.toFixed(0)}A)</b><br>
      Inrush = V_delta ÷ R_main = ${V_delta.toFixed(3)}V ÷ ${(R_main_eff*1000).toFixed(2)}mΩ.<br>
      To reduce: (1) Increase R_main — add series impedance to main path; (2) Extend precharge time so Vc_final is closer to Vbat; (3) Increase n to reach higher % of Vbat; (4) Add RC snubber on main contactor.<br>
      <b>Note:</b> V_delta is ${V_delta.toFixed(4)}V which is ${(V_delta/Vbat*100).toFixed(3)}% of Vbat. Even tiny V_delta can cause large inrush if R_main is very low (e.g. 1–5mΩ typical wiring).
    </div>`;
  } else if (_notes) {
    _notes.innerHTML = '';
  }

  // ── Draw charge curve ──
  (function() {
    const canvas = document.getElementById('pc_canvas');
    if (!canvas) return;
    const W = 700, H = 220;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, W, H);

    const t_end  = parseFloat(document.getElementById('pc_t_range')?.value || 3);
    const mode   = document.getElementById('pc_graph_mode')?.value || 'voltage';
    const showV  = mode === 'voltage' || mode === 'both';
    const showI  = mode === 'current' || mode === 'both';

    const pad = {l:60, r:20, t:22, b:38};
    const pw = W - pad.l - pad.r;
    const ph = H - pad.t - pad.b;

    const mapXt = t => pad.l + (t / t_end) * pw;
    const mapYv = v => pad.t + ph * (1 - v / Vbat);
    const mapYi = i => {
      const I_scale = I_peak * 1.1;
      return pad.t + ph * (1 - Math.min(i, I_scale) / I_scale);
    };

    // Grid
    ctx.strokeStyle = '#1e2730'; ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = pad.t + i * ph / 5;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const x = pad.l + i * pw / 6;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke();
      ctx.fillStyle = '#4a5568'; ctx.font = '11px monospace';
      ctx.fillText((t_end * i / 6).toFixed(1) + 's', x - 8, H - pad.b + 14);
    }

    // Y-axis labels (voltage)
    ctx.fillStyle = '#4a5568'; ctx.font = '11px monospace';
    for (let i = 0; i <= 5; i++) {
      const v = Vbat * i / 5;
      const y = mapYv(v);
      ctx.fillText(v.toFixed(0) + 'V', 2, y + 3);
    }

    // α threshold
    const y_alpha = mapYv(alpha * Vbat);
    ctx.strokeStyle = '#f5c518'; ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, y_alpha); ctx.lineTo(W - pad.r, y_alpha); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f5c518'; ctx.font = '11px monospace';
    ctx.fillText('α·Vbat=' + (alpha * Vbat).toFixed(0) + 'V', W - pad.r - 95, y_alpha - 3);

    // t_pre marker
    const x_tpre = mapXt(t_pre);
    if (x_tpre <= W - pad.r) {
      ctx.strokeStyle = '#ff7b35'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(x_tpre, pad.t); ctx.lineTo(x_tpre, H - pad.b); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ff7b35'; ctx.font = '11px monospace';
      ctx.fillText('t_pre=' + t_pre + 's', x_tpre + 3, pad.t + 12);
    }

    // Voltage curve
    if (showV) {
      ctx.beginPath(); ctx.strokeStyle = '#00d4aa'; ctx.lineWidth = 2.5;
      for (let px = 0; px <= pw; px++) {
        const t = (px / pw) * t_end;
        const vc = Vbat * (1 - Math.exp(-t / Math.max(R_sel * C, 1e-6)));
        const y = mapYv(vc);
        px === 0 ? ctx.moveTo(pad.l + px, y) : ctx.lineTo(pad.l + px, y);
      }
      ctx.stroke();
      // Vlo curve
      ctx.beginPath(); ctx.strokeStyle = '#4a9eff'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
      for (let px = 0; px <= pw; px++) {
        const t = (px / pw) * t_end;
        const vc = Vlo * (1 - Math.exp(-t / Math.max(R_sel * C, 1e-6)));
        const y = mapYv(vc);
        px === 0 ? ctx.moveTo(pad.l + px, y) : ctx.lineTo(pad.l + px, y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }

    // Current curve
    if (showI) {
      ctx.beginPath(); ctx.strokeStyle = '#ff7b35'; ctx.lineWidth = 2;
      for (let px = 0; px <= pw; px++) {
        const t = (px / pw) * t_end;
        const ic = I_peak * Math.exp(-t / Math.max(R_sel * C, 1e-6));
        const y = mapYi(ic);
        px === 0 ? ctx.moveTo(pad.l + px, y) : ctx.lineTo(pad.l + px, y);
      }
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = '#6b8299'; ctx.font = '11px monospace';
    ctx.fillText('Time (s)', W / 2 - 20, H - 3);
    if (showV) { ctx.fillStyle = '#00d4aa'; ctx.fillText('Vbat=' + Vbat + 'V', pad.l + 5, pad.t + 14); }
    if (showI) { ctx.fillStyle = '#ff7b35'; ctx.fillText('I_peak=' + I_peak.toFixed(0) + 'A', pad.l + 5, pad.t + (showV ? 26 : 14)); }

    // Final Vc dot
    const x_final = mapXt(Math.min(t_pre * n, t_end));
    if (x_final <= W - pad.r) {
      ctx.beginPath(); ctx.arc(x_final, mapYv(Vc_final), 5, 0, Math.PI * 2);
      ctx.fillStyle = '#00d4aa'; ctx.fill();
    }
  })();
}

