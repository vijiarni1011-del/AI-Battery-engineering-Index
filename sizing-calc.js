/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — SIZING CALCULATOR  v1.0
   S×P Optimizer with full constraint matrix
   Renders into id="sizing" section
   Auto-reads from S state (Project Targets + Cell Inputs)
   ═══════════════════════════════════════════════════════════════ */

window.renderSizing = function() {
  const root = document.getElementById('sizing_root');
  if (!root) return;

  const S = window.S || {};

  /* ── Read project constraints from S (auto-linked) ── */
  const c_vnom  = +(document.getElementById('sz_c_vnom')?.value  || S.c_vnom  || 3.65);
  const c_vmax  = +(document.getElementById('sz_c_vmax')?.value  || S.c_vmax  || 4.20);
  const c_vmin  = +(document.getElementById('sz_c_vmin')?.value  || S.c_vmin  || 2.80);
  const c_ah    = +(document.getElementById('sz_c_ah')?.value    || S.c_ah    || 120);
  const c_mass  = +(document.getElementById('sz_c_mass')?.value  || S.c_mass  || 2800); // g
  const c_ir    = +(document.getElementById('sz_c_ir')?.value    || S.c_ir_bol|| 0.22);
  const c_cmax  = +(document.getElementById('sz_c_cmax')?.value  || 3.0);   // max C-rate cell

  const t_E_min = +(document.getElementById('sz_t_E')?.value     || S.t_emin  || 40);    // kWh
  const t_V_min = +(document.getElementById('sz_t_Vmin')?.value  || S.t_vmin_sys || 280); // V
  const t_V_max = +(document.getElementById('sz_t_Vmax')?.value  || S.t_vmax_sys || 420); // V
  const t_P_peak= +(document.getElementById('sz_t_Ppeak')?.value || S.t_ppeak || 80);    // kW
  const t_P_cont= +(document.getElementById('sz_t_Pcont')?.value || S.t_pcont || 50);    // kW
  const t_Ccont = +(document.getElementById('sz_t_Ccont')?.value || 1.5);               // max C cont
  const t_mass  = +(document.getElementById('sz_t_mass')?.value  || 500);               // kg max pack
  const t_dod   = +(document.getElementById('sz_t_dod')?.value   || (S.t_dod||0.9));
  const t_ged   = +(document.getElementById('sz_t_ged')?.value   || S.t_ged || 100);    // Wh/kg

  /* ── Derive S range (series cells) from voltage constraints ── */
  const S_min = Math.ceil(t_V_min / c_vmax);         // min series to reach V_min at full charge
  const S_max = Math.floor(t_V_max / (c_vnom * 1.01)); // max series to not exceed V_max at nominal
  const S_range = [];
  for (let s = Math.max(1, S_min - 5); s <= Math.min(300, S_max + 5); s++) S_range.push(s);

  /* ── For each S, find valid P values ── */
  const results = [];

  for (const Ss of S_range) {
    const V_nom  = Ss * c_vnom;
    const V_max  = Ss * c_vmax;
    const V_min  = Ss * c_vmin;

    /* Voltage constraints */
    const v_nom_ok  = V_nom  >= t_V_min && V_nom  <= t_V_max;
    const v_max_ok  = V_max  <= t_V_max * 1.02;
    const v_min_ok  = V_min  >= t_V_min * 0.95;
    if (!v_nom_ok) continue;

    /* P range: how many parallel strings needed */
    const E_per_str  = c_ah * V_nom / 1000; // kWh per string (1P)
    const P_for_E    = Math.ceil(t_E_min / (E_per_str * t_dod));
    const P_max_mass = t_mass > 0 ? Math.floor((t_mass * 1000) / (Ss * c_mass / 1000)) : 99;

    for (let Pp = Math.max(1, P_for_E - 2); Pp <= Math.min(20, P_for_E + 4); Pp++) {
      const Q_pack   = c_ah * Pp;                    // Ah
      const E_gross  = Q_pack * V_nom / 1000;        // kWh
      const E_usable = E_gross * t_dod;              // kWh
      const pack_mass= Ss * Pp * c_mass / 1e6;       // tonnes → kg
      const pack_mass_kg = Ss * Pp * c_mass / 1000;  // g→kg

      /* Power checks */
      const I_peak   = V_nom > 0 ? t_P_peak * 1000 / V_nom : 0;
      const I_cont   = V_nom > 0 ? t_P_cont * 1000 / V_nom : 0;
      const C_peak   = Q_pack > 0 ? I_peak / Q_pack : 99;
      const C_cont   = Q_pack > 0 ? I_cont / Q_pack : 99;

      /* Pack IR */
      const R_pack   = c_ir * Ss / Pp;   // mΩ
      const V_drop   = R_pack * 1e-3 * I_peak; // V at peak
      const V_drop_pct = V_nom > 0 ? V_drop / V_nom * 100 : 0;

      /* Gravimetric ED */
      const GED      = pack_mass_kg > 0 ? E_gross * 1000 / pack_mass_kg : 0; // Wh/kg

      /* ── Constraint checks ── */
      const checks = {
        E_usable:  E_usable >= t_E_min,
        V_nom:     V_nom >= t_V_min && V_nom <= t_V_max,
        V_max:     V_max <= t_V_max * 1.02,
        V_min:     V_min >= t_V_min * 0.90,
        C_peak:    C_peak <= c_cmax,
        C_cont:    C_cont <= t_Ccont,
        mass:      pack_mass_kg <= t_mass || t_mass <= 0,
        GED:       GED >= t_ged || t_ged <= 0,
        Vdrop:     V_drop_pct <= 5,
      };

      const passAll  = Object.values(checks).every(Boolean);
      const failCount= Object.values(checks).filter(v => !v).length;
      const score    = passAll ? (E_usable / t_E_min + (t_ged > 0 ? GED / t_ged : 1) - C_peak / c_cmax) : -failCount;

      results.push({
        Ss, Pp, V_nom, V_max, V_min, Q_pack, E_gross, E_usable,
        C_peak, C_cont, R_pack, V_drop_pct, GED, pack_mass_kg,
        checks, passAll, failCount, score,
        label: `${Ss}S / ${Pp}P`,
      });
    }
  }

  /* Sort: passing first by score, then by fail count ascending */
  results.sort((a, b) => b.score - a.score || a.failCount - b.failCount);

  const best    = results.find(r => r.passAll);
  const topRows = results.slice(0, 40); // show top 40

  /* ── Render ── */
  const fv = (v, dec=1) => (v===undefined||v===null||isNaN(v)) ? '—' : (+v).toFixed(dec);
  const ck = ok => ok
    ? '<span style="color:var(--g);font-size:11px">✓</span>'
    : '<span style="color:var(--r);font-size:11px">✗</span>';
  const statusBadge = r => r.passAll
    ? '<span style="padding:2px 8px;background:rgba(0,212,170,.15);border:1px solid rgba(0,212,170,.4);border-radius:4px;color:var(--g);font-size:10px;font-weight:700">✓ ALL PASS</span>'
    : r.failCount <= 2
    ? `<span style="padding:2px 8px;background:rgba(245,197,24,.12);border:1px solid rgba(245,197,24,.4);border-radius:4px;color:var(--y);font-size:10px;font-weight:700">⚠ ${r.failCount} FAIL</span>`
    : `<span style="padding:2px 8px;background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.3);border-radius:4px;color:var(--r);font-size:10px;font-weight:700">✗ ${r.failCount} FAIL</span>`;

  const tableRows = topRows.map((r, i) => {
    const isOpt = r === best;
    const bg = isOpt ? 'background:rgba(0,212,170,.07)' : i%2===0 ? '' : 'background:rgba(255,255,255,.01)';
    return `<tr style="${bg};border-bottom:1px solid var(--border)" onclick="szApplyConfig(${r.Ss},${r.Pp})" style="cursor:pointer">
      <td style="padding:7px 12px;font-family:var(--mono);font-weight:700;color:${isOpt?'var(--g)':'var(--text)'};font-size:12px">
        ${isOpt?'⭐ ':''}${r.label}
      </td>
      <td style="padding:7px 10px;font-family:var(--mono);font-size:12px;text-align:right;color:var(--b)">${fv(r.V_nom,0)} V</td>
      <td style="padding:7px 10px;font-family:var(--mono);font-size:12px;text-align:right">${fv(r.V_max,0)}/${fv(r.V_min,0)} V</td>
      <td style="padding:7px 10px;font-family:var(--mono);font-size:12px;text-align:right;color:var(--g)">${fv(r.E_gross,1)} kWh</td>
      <td style="padding:7px 10px;font-family:var(--mono);font-size:12px;text-align:right;color:${r.E_usable>=t_E_min?'var(--g)':'var(--r)'}">${fv(r.E_usable,1)} kWh</td>
      <td style="padding:7px 10px;font-family:var(--mono);font-size:12px;text-align:right;color:${r.C_peak>c_cmax?'var(--r)':r.C_peak>c_cmax*0.9?'var(--y)':'var(--text2)'}">${fv(r.C_peak,2)} C</td>
      <td style="padding:7px 10px;font-family:var(--mono);font-size:12px;text-align:right;color:${r.C_cont>t_Ccont?'var(--r)':'var(--text2)'}">${fv(r.C_cont,2)} C</td>
      <td style="padding:7px 10px;font-family:var(--mono);font-size:12px;text-align:right;color:${r.pack_mass_kg>t_mass&&t_mass>0?'var(--r)':'var(--text2)'}">${fv(r.pack_mass_kg,0)} kg</td>
      <td style="padding:7px 10px;font-family:var(--mono);font-size:12px;text-align:right;color:${r.GED<t_ged&&t_ged>0?'var(--r)':'var(--text2)'}">${fv(r.GED,0)} Wh/kg</td>
      <td style="padding:7px 10px;font-family:var(--mono);font-size:12px;text-align:right;color:${r.V_drop_pct>5?'var(--r)':'var(--text2)'}">${fv(r.V_drop_pct,1)}%</td>
      <td style="padding:7px 10px;text-align:center">${statusBadge(r)}</td>
    </tr>`;
  }).join('');

  /* ── Constraint summary for best config ── */
  const bestSummary = best ? `
<div class="g3" style="margin-bottom:16px">
  ${[
    {l:'Configuration',    v:`${best.Ss}S / ${best.Pp}P`,      c:'var(--g)'},
    {l:'Pack V_nom',       v:`${fv(best.V_nom,0)} V`,           c:'var(--b)'},
    {l:'V_max / V_min',    v:`${fv(best.V_max,0)} / ${fv(best.V_min,0)} V`, c:'var(--text)'},
    {l:'Gross Energy',     v:`${fv(best.E_gross,2)} kWh`,       c:'var(--g)'},
    {l:'Usable Energy',    v:`${fv(best.E_usable,2)} kWh`,      c:'var(--g)'},
    {l:'Pack Capacity',    v:`${fv(best.Q_pack,0)} Ah`,         c:'var(--text)'},
    {l:'Peak C-rate',      v:`${fv(best.C_peak,3)} C`,          c:best.C_peak>c_cmax?'var(--r)':'var(--g)'},
    {l:'Cont. C-rate',     v:`${fv(best.C_cont,3)} C`,          c:best.C_cont>t_Ccont?'var(--r)':'var(--g)'},
    {l:'Pack Mass (est.)', v:`${fv(best.pack_mass_kg,0)} kg`,   c:'var(--text)'},
    {l:'Grav. ED',         v:`${fv(best.GED,0)} Wh/kg`,         c:best.GED<t_ged&&t_ged>0?'var(--r)':'var(--g)'},
    {l:'Pack IR BoL',      v:`${fv(best.R_pack,1)} mΩ`,         c:'var(--text)'},
    {l:'Peak ΔV',          v:`${fv(best.V_drop_pct,1)}% V_nom`, c:best.V_drop_pct>5?'var(--r)':'var(--g)'},
  ].map(k=>`<div class="kpi-card" style="border-color:${k.c}22">
    <div class="kpi-v" style="color:${k.c};font-size:14px">${k.v}</div>
    <div class="kpi-l">${k.l}</div>
  </div>`).join('')}
</div>` : `<div class="ico-banner" style="border-color:rgba(255,77,109,.3);background:rgba(255,77,109,.06)">
  ⚠ No configuration meets all constraints. Relax constraints or adjust cell parameters.
</div>`;

  root.innerHTML = `
<!-- CONTROLS -->
<div class="g2" style="margin-bottom:16px">

<!-- Left: Cell Parameters -->
<div class="card">
  <div class="ch3">🔬 Cell Parameters <span style="font-size:9px;font-family:var(--mono);color:var(--teal)">← auto from Cell Inputs</span></div>
  <div class="g2" style="margin-top:10px">
    <div class="field"><label>Cell V_nom (V)</label>
      <input type="number" id="sz_c_vnom" value="${c_vnom}" step="0.01" oninput="renderSizing()"></div>
    <div class="field"><label>Cell V_max (V)</label>
      <input type="number" id="sz_c_vmax" value="${c_vmax}" step="0.01" oninput="renderSizing()"></div>
    <div class="field"><label>Cell V_min (V)</label>
      <input type="number" id="sz_c_vmin" value="${c_vmin}" step="0.01" oninput="renderSizing()"></div>
    <div class="field"><label>Cell Capacity (Ah)</label>
      <input type="number" id="sz_c_ah" value="${c_ah}" step="1" oninput="renderSizing()"></div>
    <div class="field"><label>Cell Mass (g)</label>
      <input type="number" id="sz_c_mass" value="${c_mass}" step="10" oninput="renderSizing()"></div>
    <div class="field"><label>Cell DCIR BoL (mΩ)</label>
      <input type="number" id="sz_c_ir" value="${c_ir}" step="0.01" oninput="renderSizing()"></div>
    <div class="field"><label>Max cell C-rate</label>
      <input type="number" id="sz_c_cmax" value="${c_cmax}" step="0.1" oninput="renderSizing()"></div>
  </div>
</div>

<!-- Right: System Constraints -->
<div class="card">
  <div class="ch3">🎯 System Constraints <span style="font-size:9px;font-family:var(--mono);color:var(--teal)">← auto from Project Targets</span></div>
  <div class="g2" style="margin-top:10px">
    <div class="field"><label>Min usable energy (kWh)</label>
      <input type="number" id="sz_t_E" value="${t_E_min}" step="1" oninput="renderSizing()"></div>
    <div class="field"><label>V_min system (V)</label>
      <input type="number" id="sz_t_Vmin" value="${t_V_min}" step="5" oninput="renderSizing()"></div>
    <div class="field"><label>V_max system (V)</label>
      <input type="number" id="sz_t_Vmax" value="${t_V_max}" step="5" oninput="renderSizing()"></div>
    <div class="field"><label>Peak power target (kW)</label>
      <input type="number" id="sz_t_Ppeak" value="${t_P_peak}" step="5" oninput="renderSizing()"></div>
    <div class="field"><label>Cont. power target (kW)</label>
      <input type="number" id="sz_t_Pcont" value="${t_P_cont}" step="5" oninput="renderSizing()"></div>
    <div class="field"><label>Max cont. C-rate</label>
      <input type="number" id="sz_t_Ccont" value="${t_Ccont}" step="0.1" oninput="renderSizing()"></div>
    <div class="field"><label>Max pack mass (kg, 0=no limit)</label>
      <input type="number" id="sz_t_mass" value="${t_mass}" step="10" oninput="renderSizing()"></div>
    <div class="field"><label>DoD</label>
      <input type="number" id="sz_t_dod" value="${t_dod}" step="0.01" min="0.5" max="1" oninput="renderSizing()"></div>
    <div class="field"><label>Min GED (Wh/kg, 0=no limit)</label>
      <input type="number" id="sz_t_ged" value="${t_ged}" step="5" oninput="renderSizing()"></div>
  </div>
</div>
</div>

<!-- Optimal config summary -->
<div class="sh" style="margin-bottom:12px">
  <h3 style="font-size:14px;font-weight:700;margin-bottom:6px">
    ⭐ Optimal Configuration${best?` — ${best.Ss}S / ${best.Pp}P`:''}
  </h3>
</div>
${bestSummary}

<!-- Apply button -->
${best ? `<button onclick="szApplyConfig(${best.Ss},${best.Pp})"
  style="margin-bottom:16px;padding:10px 28px;background:rgba(0,212,170,.15);border:1px solid rgba(0,212,170,.4);color:var(--g);border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
  ✓ Apply ${best.Ss}S / ${best.Pp}P to Project →
</button>` : ''}

<!-- Canvas chart -->
<div class="card" style="margin-bottom:16px">
  <div class="ch3">📊 Configuration Space — E_usable vs Pack V_nom</div>
  <canvas id="sz_canvas" height="280" style="width:100%;display:block;margin-top:10px;border-radius:6px;background:var(--bg)"></canvas>
  <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-size:9px;font-family:var(--mono)">
    <span style="color:var(--g)">● All-pass configs</span>
    <span style="color:var(--y)">● 1–2 fails</span>
    <span style="color:var(--r)">● 3+ fails</span>
    <span style="color:var(--teal)">★ Optimal</span>
    <span style="color:rgba(74,158,255,.4)">┅ E target</span>
    <span style="color:rgba(255,123,53,.4)">┅ V window</span>
  </div>
</div>

<!-- Constraint check legend -->
<div class="card" style="margin-bottom:16px">
  <div class="ch3">⚡ Constraint Matrix Legend</div>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
    ${[
      ['E_usable ≥ target',  `≥ ${t_E_min} kWh`],
      ['V_nom in window',    `${t_V_min}–${t_V_max} V`],
      ['C_peak ≤ cell limit', `≤ ${c_cmax} C`],
      ['C_cont ≤ target',    `≤ ${t_Ccont} C`],
      ['Pack mass',          t_mass>0?`≤ ${t_mass} kg`:'No limit'],
      ['GED',                t_ged>0?`≥ ${t_ged} Wh/kg`:'No limit'],
      ['Peak ΔV',            '≤ 5% V_nom'],
    ].map(([l,v])=>`<div style="padding:5px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;font-size:11px">
      <span style="color:var(--text2)">${l}:</span>
      <span style="font-family:var(--mono);color:var(--teal);margin-left:4px">${v}</span>
    </div>`).join('')}
  </div>
</div>

<!-- Results table -->
<div class="card" style="overflow-x:auto">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
    <div class="ch3">📋 All Viable Configurations (top ${topRows.length}) — click row to apply</div>
    <button onclick="szExportCSV()" style="padding:6px 14px;background:rgba(74,158,255,.1);border:1px solid rgba(74,158,255,.3);color:var(--b);border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">⬇ Export CSV</button>
  </div>
  <table style="border-collapse:collapse;width:100%;min-width:900px">
    <thead style="background:var(--bg3)">
      <tr>
        <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:var(--text2);border-bottom:2px solid var(--border2)">Config</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">V_nom</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">V_max/min</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">E_gross</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">E_usable</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">C_peak</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">C_cont</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">Mass</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">GED</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">ΔV%</th>
        <th style="padding:8px 10px;text-align:center;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">Status</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>

<div class="ico-banner" style="margin-top:14px">
  📌 <b>${results.length}</b> configurations evaluated · S range: ${S_min}–${S_max} series cells from voltage window
  · Cell mass-based weight estimate · IR from DCIR BoL value.
  Click any row or ⭐ button to push configuration to Cell Inputs tab.
</div>`;

  /* Draw canvas */
  requestAnimationFrame(() => {
    const canvas = document.getElementById('sz_canvas');
    if (!canvas || results.length < 2) return;
    const W = canvas.offsetWidth || 800, H = 280;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    const Vs = results.map(r => r.V_nom);
    const Es = results.map(r => r.E_usable);
    const vlo = Math.min(...Vs) * 0.95, vhi = Math.max(...Vs) * 1.05;
    const elo = 0, ehi = Math.max(...Es, t_E_min) * 1.2;

    const pad = {l:52, r:20, t:16, b:36};
    const pw = W-pad.l-pad.r, ph = H-pad.t-pad.b;
    const mx = v => pad.l + (v-vlo)/(vhi-vlo)*pw;
    const my = e => pad.t + ph*(1-Math.min(1,(e-elo)/(ehi-elo)));

    /* Grid */
    ctx.strokeStyle='rgba(255,255,255,.04)'; ctx.lineWidth=1;
    [0,0.25,0.5,0.75,1].forEach(f => {
      const y=pad.t+ph*f;
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();
      ctx.fillStyle='#3a567a'; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='right';
      ctx.fillText((ehi*(1-f)).toFixed(0)+'kWh', pad.l-4, y+3);
    });

    /* V window shading */
    ctx.fillStyle='rgba(255,123,53,.04)';
    ctx.fillRect(mx(t_V_min), pad.t, mx(t_V_max)-mx(t_V_min), ph);
    ctx.strokeStyle='rgba(255,123,53,.3)'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(mx(t_V_min),pad.t); ctx.lineTo(mx(t_V_min),H-pad.b); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx(t_V_max),pad.t); ctx.lineTo(mx(t_V_max),H-pad.b); ctx.stroke();
    ctx.setLineDash([]);

    /* E target line */
    ctx.strokeStyle='rgba(74,158,255,.4)'; ctx.lineWidth=1.5; ctx.setLineDash([6,4]);
    const yE = my(t_E_min);
    ctx.beginPath(); ctx.moveTo(pad.l,yE); ctx.lineTo(W-pad.r,yE); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='rgba(74,158,255,.6)'; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='left';
    ctx.fillText('E target', pad.l+4, yE-3);

    /* Plot points */
    results.forEach(r => {
      const x = mx(r.V_nom), y = my(r.E_usable);
      const col = r.passAll ? '#00d4aa' : r.failCount<=2 ? '#f5c518' : '#ff4d6d';
      ctx.beginPath(); ctx.arc(x, y, r===best?6:3, 0, Math.PI*2);
      ctx.fillStyle = col + (r===best?'':'88');
      ctx.fill();
      if (r === best) {
        ctx.strokeStyle='#00d4aa'; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle='#00d4aa'; ctx.font='bold 9px JetBrains Mono,monospace'; ctx.textAlign='left';
        ctx.fillText(`${r.Ss}S/${r.Pp}P`, x+8, y-4);
      }
    });

    /* Axes */
    ctx.fillStyle='#4a6080'; ctx.font='10px JetBrains Mono,monospace'; ctx.textAlign='center';
    ctx.fillText('Pack V_nom (V)', pad.l+pw/2, H-4);
  });
};

/* Apply config to Cell tab fields */
window.szApplyConfig = function(Ss, Pp) {
  try {
    /* Find S per module and P */
    const c_ss_el = document.getElementById('c_ss');
    const c_pp_el = document.getElementById('c_pp');
    const c_cps_el= document.getElementById('c_cps');

    /* Attempt to set SS = cells_in_series and PP = cells_in_parallel */
    /* c_ss = strings in series per module (assume 1 module per string for simplicity) */
    if (c_pp_el) { c_pp_el.value = Pp; c_pp_el.dispatchEvent(new Event('input')); }
    /* For Ss: need c_cps × c_ss. If c_cps known, set c_ss */
    const cps = +(c_cps_el?.value || window.S?.c_cps || 14);
    if (c_ss_el && cps > 0) {
      const ss_modules = Math.round(Ss / cps);
      if (ss_modules >= 1) {
        c_ss_el.value = ss_modules;
        c_ss_el.dispatchEvent(new Event('input'));
      }
    }
    if (typeof propagate === 'function') propagate();

    /* Toast */
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = `✓ Applied ${Ss}S / ${Pp}P to Cell Inputs`;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 3000);
    }

    /* Switch to cell tab */
    setTimeout(() => {
      try {
        if (typeof showSec === 'function') {
          showSec('cell', document.querySelector('.nb[onclick*="cell"]'));
        }
      } catch(e) {}
    }, 400);
  } catch(e) { console.warn('[szApply]', e); }
};

/* Export CSV */
window.szExportCSV = function() {
  /* Re-run to get current results */
  const rows = document.querySelectorAll('#sizing_root tbody tr');
  const hdr = 'Config,V_nom(V),V_max(V),V_min(V),E_gross(kWh),E_usable(kWh),C_peak(C),C_cont(C),Mass(kg),GED(Wh/kg),DeltaV%,Status\n';
  const lines = Array.from(rows).map(r => {
    const cells = Array.from(r.querySelectorAll('td')).map(c => '"'+c.textContent.trim().replace(/"/g,'""')+'"');
    return cells.join(',');
  });
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(hdr + lines.join('\n'));
  a.download = 'BatteryMIS_Sizing_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
};

/* Hook showSec */
(function() {
  const _orig = window.showSec;
  window.showSec = function(id, btn) {
    if (typeof _orig === 'function') _orig(id, btn);
    if (id === 'sizing') {
      setTimeout(() => { try { renderSizing(); } catch(e) { console.warn('[Sizing]', e); }}, 60);
    }
  };
  /* Re-render on propagate if visible */
  const _origP = window.propagate;
  window.propagate = function() {
    if (typeof _origP === 'function') _origP.apply(this, arguments);
    try {
      if (document.getElementById('sizing')?.classList.contains('active')) renderSizing();
    } catch(e) {}
  };
})();
