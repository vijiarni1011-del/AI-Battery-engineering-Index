/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — CELL QUALIFICATION SCORECARD  v1.0
   OEM gate-check: supplier cell vs project targets
   Auto-reads from S (propagate). All inputs editable for override.
   ═══════════════════════════════════════════════════════════════ */

window.renderCellQual = function() {
  const root = document.getElementById('cellqual_root');
  if (!root) return;

  const S = window.S || {};

  /* ── Pull from S (auto-linked) ── */
  // Read source DOM fields directly (Cell Inputs sheet) as primary source
  const src = id => { const el=document.getElementById(id); return (el&&el.value!=='')?+el.value:null; };
  const ovr = id => { const el=document.getElementById('cq_'+id); return (el&&el.value!=='')?+el.value:null; };
  const strSrc = id => { const el=document.getElementById(id); return (el&&el.value)?el.value:null; };

  const cell = {
    chem:    strSrc('c_chem') || S.c_chem || 'LFP',
    vnom:    ovr('c_vnom') ?? src('c_vnom') ?? S.c_vnom  ?? 3.2,
    vmax:    ovr('c_vmax') ?? src('c_vmax') ?? S.c_vmax  ?? 3.65,
    vmin:    ovr('c_vmin') ?? src('c_vmin') ?? S.c_vmin  ?? 2.0,
    ah:      ovr('c_ah')   ?? src('c_ah')   ?? S.c_ah    ?? 120,
    ir_bol:  ovr('ir_bol') ?? src('c_ir_bol') ?? S.c_ir_bol ?? 0.22,
    ir_eol:  ovr('ir_eol') ?? src('c_ir_eol') ?? S.c_ir_eol ?? 0.35,
    mass_g:  ovr('mass')   ?? src('c_mass')  ?? S.c_mass  ?? 2800,
    cp:      ovr('cp')     ?? src('c_cp')    ?? S.c_cp    ?? 1050,
    t_min:   ovr('t_min')  ?? src('t_top_lo') ?? S.t_top_lo ?? -20,
    t_max:   ovr('t_max')  ?? src('t_tcell_max') ?? S.t_tcell_max ?? 55,
    c_max_dis:ovr('c_dis') ?? 3.0,
    c_max_chg:ovr('c_chg') ?? (src('t_cchg') ?? S.t_cchg ?? 1.5),
    cycles:  ovr('cycles') ?? src('t_cycles') ?? S.t_cycles ?? 3000,
    soh_eol: ovr('soh_eol')?? src('t_soh_eol') ?? S.t_soh_eol ?? 80,
    cert_un383: document.getElementById('cq_cert_un383')?.checked ?? false,
    cert_iec:   document.getElementById('cq_cert_iec')?.checked   ?? false,
    cert_gb:    document.getElementById('cq_cert_gb')?.checked    ?? false,
    supplier:  document.getElementById('cq_supplier')?.value      ?? '',
    model:     document.getElementById('cq_model')?.value         ?? '',
  };

  /* ── Project requirements — always from source DOM + S ── */
  const req = {
    vnom_min:  src('t_vmin_sys')  ?? S.t_vmin_sys  ?? 280,
    vnom_max:  src('t_vmax_sys')  ?? S.t_vmax_sys  ?? 450,
    e_min:     src('t_emin')      ?? S.t_emin      ?? 40,
    p_peak:    src('t_ppeak')     ?? S.t_ppeak     ?? 80,
    p_cont:    src('t_pcont')     ?? S.t_pcont     ?? 50,
    t_op_lo:   src('t_top_lo')    ?? S.t_top_lo    ?? -20,
    t_op_hi:   src('t_top_hi')    ?? S.t_top_hi    ?? 55,
    t_cell_max:src('t_tcell_max') ?? S.t_tcell_max ?? 55,
    c_peak:    src('t_cpeak')     ?? S.t_cpeak     ?? 2.0,
    c_chg:     src('t_cchg')      ?? S.t_cchg      ?? 0.5,
    cycles:    src('t_cycles')    ?? S.t_cycles    ?? 3000,
    soh_eol:   src('t_soh_eol')   ?? S.t_soh_eol   ?? 80,
    ged:       src('t_ged')       ?? S.t_ged        ?? 100,
    ip:        strSrc('t_ip')     || S.t_ip         || 'IP67',
    markets:   (strSrc('t_markets')|| S.markets || 'EU, US').toUpperCase(),
    Ss:        (src('c_cps')||S.c_cps||14)*(src('c_ss')||S.c_ss||8),
    Pp:        src('c_pp') || S.c_pp || 1,
    dod:       src('t_dod') ?? S.t_dod ?? 1.0,
  };

  /* ── Derived cell metrics ── */
  const V_pack_nom  = cell.vnom * req.Ss;
  const V_pack_max  = cell.vmax * req.Ss;
  const V_pack_min  = cell.vmin * req.Ss;
  const E_gross     = (cell.vnom * cell.ah * req.Ss * req.Pp) / 1000;
  const I_peak      = req.p_peak  * 1000 / V_pack_nom;
  const I_cont      = req.p_cont  * 1000 / V_pack_nom;
  const C_peak_req  = req.Pp > 0 ? I_peak  / (cell.ah * req.Pp) : 0;
  const C_cont_req  = req.Pp > 0 ? I_cont  / (cell.ah * req.Pp) : 0;
  const ged_cell    = cell.mass_g > 0 ? (cell.ah * cell.vnom * 1000) / cell.mass_g : 0; // Wh/kg cell level
  const ir_growth   = cell.ir_bol > 0 ? cell.ir_eol / cell.ir_bol : 0;
  const pack_ir_bol = cell.ir_bol * req.Ss / req.Pp;

  /* ══════════════════════════════════════
     CHECK ENGINE — each returns {ok, warn, val, target, note}
     ok=true=PASS, ok=false+warn=CAUTION, ok=false+!warn=FAIL
  ══════════════════════════════════════ */
  const checks = [

    /* ─ VOLTAGE ─ */
    {
      cat:'Voltage', name:'Cell V_nom',
      val: cell.vnom.toFixed(3)+'V',
      target: `${(req.vnom_min/req.Ss).toFixed(2)}–${(req.vnom_max/req.Ss).toFixed(2)} V/cell`,
      ok:  cell.vnom >= req.vnom_min/req.Ss*0.98 && cell.vnom <= req.vnom_max/req.Ss*1.02,
      warn:cell.vnom >= req.vnom_min/req.Ss*0.95 && cell.vnom <= req.vnom_max/req.Ss*1.05,
      note:`Pack V_nom = ${V_pack_nom.toFixed(0)}V at ${req.Ss}S`
    },
    {
      cat:'Voltage', name:'Pack V_max ≤ sys max',
      val: V_pack_max.toFixed(1)+'V',
      target: `≤ ${req.vnom_max}V`,
      ok:  V_pack_max <= req.vnom_max,
      warn:V_pack_max <= req.vnom_max * 1.02,
      note:`${req.Ss} × ${cell.vmax}V = ${V_pack_max.toFixed(1)}V`
    },
    {
      cat:'Voltage', name:'Pack V_min ≥ sys min',
      val: V_pack_min.toFixed(1)+'V',
      target: `≥ ${req.vnom_min}V`,
      ok:  V_pack_min >= req.vnom_min,
      warn:V_pack_min >= req.vnom_min * 0.95,
      note:`${req.Ss} × ${cell.vmin}V = ${V_pack_min.toFixed(1)}V`
    },

    /* ─ ENERGY ─ */
    {
      cat:'Energy', name:'Gross Energy',
      val: E_gross.toFixed(2)+' kWh',
      target: `≥ ${req.e_min} kWh`,
      ok:  E_gross >= req.e_min,
      warn:E_gross >= req.e_min * 0.95,
      note:`${req.Ss}S/${req.Pp}P × ${cell.ah}Ah × ${cell.vnom}V`
    },
    {
      cat:'Energy', name:'Cell GED',
      val: ged_cell.toFixed(1)+' Wh/kg',
      target: `≥ ${req.ged} Wh/kg`,
      ok:  ged_cell >= req.ged || req.ged <= 0,
      warn:ged_cell >= req.ged * 0.92 || req.ged <= 0,
      note:`${cell.ah}Ah × ${cell.vnom}V × 1000 ÷ ${cell.mass_g}g`
    },

    /* ─ CURRENT / C-RATE ─ */
    {
      cat:'C-Rate', name:'Peak discharge C-rate',
      val: C_peak_req.toFixed(3)+'C req',
      target: `Cell max ≥ ${C_peak_req.toFixed(2)}C (cell rated: ${cell.c_max_dis}C)`,
      ok:  cell.c_max_dis >= C_peak_req,
      warn:cell.c_max_dis >= C_peak_req * 0.9,
      note:`I_peak=${I_peak.toFixed(0)}A ÷ ${cell.ah*req.Pp}Ah pack`
    },
    {
      cat:'C-Rate', name:'Cont. discharge C-rate',
      val: C_cont_req.toFixed(3)+'C req',
      target: `Cell max ≥ ${C_cont_req.toFixed(2)}C`,
      ok:  cell.c_max_dis >= C_cont_req,
      warn:cell.c_max_dis >= C_cont_req * 0.9,
      note:`I_cont=${I_cont.toFixed(0)}A ÷ ${cell.ah*req.Pp}Ah`
    },
    {
      cat:'C-Rate', name:'Max charge C-rate',
      val: cell.c_max_chg.toFixed(2)+'C',
      target: `≥ ${req.c_chg}C`,
      ok:  cell.c_max_chg >= req.c_chg,
      warn:cell.c_max_chg >= req.c_chg * 0.9,
      note:`Required charge C-rate from Project Targets`
    },

    /* ─ IMPEDANCE ─ */
    {
      cat:'Impedance', name:'Cell DCIR BoL',
      val: cell.ir_bol.toFixed(3)+' mΩ',
      target: `Pack IR BoL = ${pack_ir_bol.toFixed(1)} mΩ`,
      ok:  pack_ir_bol <= 200,
      warn:pack_ir_bol <= 300,
      note:`${cell.ir_bol} × ${req.Ss}/${req.Pp} = ${pack_ir_bol.toFixed(1)} mΩ pack`
    },
    {
      cat:'Impedance', name:'IR growth BoL→EoL',
      val: `×${ir_growth.toFixed(2)}`,
      target: '≤ ×2.0',
      ok:  ir_growth <= 2.0,
      warn:ir_growth <= 2.5,
      note:`${cell.ir_bol.toFixed(3)}→${cell.ir_eol.toFixed(3)} mΩ EoL`
    },

    /* ─ THERMAL ─ */
    {
      cat:'Thermal', name:'Min operating temp',
      val: cell.t_min+'°C',
      target: `≤ ${req.t_op_lo}°C`,
      ok:  cell.t_min <= req.t_op_lo,
      warn:cell.t_min <= req.t_op_lo + 5,
      note:`Cell must operate down to project T_op_lo`
    },
    {
      cat:'Thermal', name:'Max operating temp',
      val: cell.t_max+'°C',
      target: `≥ ${req.t_cell_max}°C`,
      ok:  cell.t_max >= req.t_cell_max,
      warn:cell.t_max >= req.t_cell_max - 5,
      note:`Cell must survive to T_cell_max threshold`
    },

    /* ─ LIFETIME ─ */
    {
      cat:'Lifetime', name:'Cycle life (cell rated)',
      val: cell.cycles.toLocaleString()+' cycles',
      target: `≥ ${req.cycles.toLocaleString()} cycles`,
      ok:  cell.cycles >= req.cycles,
      warn:cell.cycles >= req.cycles * 0.9,
      note:`At EoL SoH ≥ ${cell.soh_eol}%`
    },
    {
      cat:'Lifetime', name:'EoL SoH (cell rated)',
      val: cell.soh_eol+'%',
      target: `≥ ${req.soh_eol}%`,
      ok:  cell.soh_eol >= req.soh_eol,
      warn:cell.soh_eol >= req.soh_eol - 2,
      note:'From cell supplier datasheet at rated cycle count'
    },

    /* ─ CERTIFICATION ─ */
    {
      cat:'Certification', name:'UN 38.3 Transport',
      val: cell.cert_un383 ? '✓ Certified' : '⚠ Not confirmed',
      target: 'Required — all markets',
      ok:  cell.cert_un383,
      warn:false,
      note:'Mandatory for transport (air/sea/road)'
    },
    {
      cat:'Certification', name:'IEC 62619 / IEC 62133',
      val: cell.cert_iec ? '✓ Certified' : '⚠ Not confirmed',
      target: req.markets.includes('EU') ? 'Required — EU market' : 'Recommended',
      ok:  cell.cert_iec,
      warn:!req.markets.includes('EU'),
      note:'Required for CE marking'
    },
    {
      cat:'Certification', name:'GB/T 31485 (China)',
      val: cell.cert_gb ? '✓ Certified' : '⚠ Not confirmed',
      target: req.markets.includes('CN') ? 'Required — CN market' : 'N/A',
      ok:  cell.cert_gb || !req.markets.includes('CN'),
      warn:!req.markets.includes('CN'),
      note:'Mandatory for China market'
    },
  ];

  /* ── Score ── */
  const pass  = checks.filter(c => c.ok).length;
  const warn  = checks.filter(c => !c.ok && c.warn).length;
  const fail  = checks.filter(c => !c.ok && !c.warn).length;
  const total = checks.length;
  const score = Math.round((pass + warn * 0.5) / total * 100);

  const verdict = fail === 0 && warn === 0
    ? { t:'✓ QUALIFIED',     c:'var(--g)', bg:'rgba(0,212,170,.12)',  bc:'rgba(0,212,170,.4)'  }
    : fail === 0
    ? { t:'⚠ CONDITIONAL',  c:'var(--y)', bg:'rgba(245,197,24,.12)', bc:'rgba(245,197,24,.4)' }
    : fail <= 2
    ? { t:'✗ NOT QUALIFIED', c:'var(--r)', bg:'rgba(255,77,109,.10)', bc:'rgba(255,77,109,.35)'}
    : { t:'✗ REJECTED',      c:'var(--r)', bg:'rgba(255,77,109,.15)', bc:'rgba(255,77,109,.5)' };

  /* ── Build table rows grouped by category ── */
  const cats = [...new Set(checks.map(c => c.cat))];
  const tableRows = cats.map(cat => {
    const catChecks = checks.filter(c => c.cat === cat);
    const rows = catChecks.map(c => {
      const badge = c.ok
        ? `<span style="padding:2px 9px;background:rgba(0,212,170,.15);border:1px solid rgba(0,212,170,.4);border-radius:4px;color:var(--g);font-size:10px;font-weight:700">✓ PASS</span>`
        : c.warn
        ? `<span style="padding:2px 9px;background:rgba(245,197,24,.12);border:1px solid rgba(245,197,24,.4);border-radius:4px;color:var(--y);font-size:10px;font-weight:700">⚠ CAUTION</span>`
        : `<span style="padding:2px 9px;background:rgba(255,77,109,.12);border:1px solid rgba(255,77,109,.4);border-radius:4px;color:var(--r);font-size:10px;font-weight:700">✗ FAIL</span>`;
      const rowbg = c.ok ? '' : c.warn ? 'background:rgba(245,197,24,.03)' : 'background:rgba(255,77,109,.03)';
      return `<tr style="border-bottom:1px solid var(--border);${rowbg}">
        <td style="padding:8px 12px;font-size:12px;font-weight:600;color:var(--text)">${c.name}</td>
        <td style="padding:8px 10px;font-family:var(--mono);font-size:12px;color:${c.ok?'var(--g)':c.warn?'var(--y)':'var(--r)'};font-weight:700">${c.val}</td>
        <td style="padding:8px 10px;font-family:var(--mono);font-size:11px;color:var(--text3)">${c.target}</td>
        <td style="padding:8px 10px;text-align:center">${badge}</td>
        <td style="padding:8px 10px;font-size:11px;color:var(--text3)">${c.note}</td>
      </tr>`;
    }).join('');
    return `<tr style="background:var(--bg3)">
      <td colspan="5" style="padding:7px 12px;font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid var(--border2)">${cat}</td>
    </tr>${rows}`;
  }).join('');

  /* ── Radar chart data ── */
  const radarDims = [
    { label:'Voltage',     score: checks.filter(c=>c.cat==='Voltage').every(c=>c.ok) ? 100 : checks.filter(c=>c.cat==='Voltage').some(c=>c.warn) ? 60 : 20 },
    { label:'Energy',      score: checks.filter(c=>c.cat==='Energy').every(c=>c.ok) ? 100 : checks.filter(c=>c.cat==='Energy').some(c=>c.warn) ? 60 : 20 },
    { label:'C-Rate',      score: checks.filter(c=>c.cat==='C-Rate').every(c=>c.ok) ? 100 : checks.filter(c=>c.cat==='C-Rate').some(c=>c.ok) ? 65 : 20 },
    { label:'Impedance',   score: checks.filter(c=>c.cat==='Impedance').every(c=>c.ok) ? 100 : 50 },
    { label:'Thermal',     score: checks.filter(c=>c.cat==='Thermal').every(c=>c.ok) ? 100 : checks.filter(c=>c.cat==='Thermal').some(c=>c.warn) ? 60 : 20 },
    { label:'Lifetime',    score: checks.filter(c=>c.cat==='Lifetime').every(c=>c.ok) ? 100 : checks.filter(c=>c.cat==='Lifetime').some(c=>c.warn) ? 65 : 25 },
    { label:'Cert',        score: checks.filter(c=>c.cat==='Certification').every(c=>c.ok) ? 100 : checks.filter(c=>c.cat==='Certification').filter(c=>c.ok).length/3*100 },
  ];

  root.innerHTML = `
<style>
.cq-inp{padding:5px 8px;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-family:var(--mono);font-size:12px;width:100%;outline:none}
.cq-inp:focus{border-color:rgba(0,212,170,.4)}
.cq-chk{accent-color:var(--teal);width:14px;height:14px}
.cq-lbl{font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:3px}
</style>

<!-- ══ HEADER: Supplier info + verdict ══ -->
<div class="g2" style="margin-bottom:16px;align-items:stretch">

  <!-- Cell identity -->
  <div class="card">
    <div class="ch3">🔬 Cell Identity <span style="font-size:9px;color:var(--teal);font-family:var(--mono)">← auto from Cell Inputs (editable)</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
      <div><label class="cq-lbl">Supplier / Manufacturer</label>
        <input class="cq-inp" id="cq_supplier" value="${cell.supplier}" placeholder="e.g. CATL, Panasonic, Samsung SDI" oninput="renderCellQual()"></div>
      <div><label class="cq-lbl">Cell Model / Part No.</label>
        <input class="cq-inp" id="cq_model" value="${cell.model}" placeholder="e.g. INR21700-50E" oninput="renderCellQual()"></div>
      <div><label class="cq-lbl">Chemistry (auto)</label>
        <div style="padding:6px 8px;background:var(--bg4);border:1px solid var(--border);border-radius:6px;font-family:var(--mono);font-size:12px;color:var(--teal)">${cell.chem}</div></div>
      <div><label class="cq-lbl">Pack Config (auto)</label>
        <div style="padding:6px 8px;background:var(--bg4);border:1px solid var(--border);border-radius:6px;font-family:var(--mono);font-size:12px;color:var(--blue2)">${(src('c_cps')||S.c_cps||14)}×${(src('c_ss')||S.c_ss||8)}=${req.Ss}S / ${req.Pp}P</div></div>
    </div>

    <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
    <div class="ch3 b" style="margin-bottom:8px">Datasheet Values</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
      ${[
        ['cq_c_vnom',  'V_nom (V)',         cell.vnom],
        ['cq_c_vmax',  'V_max (V)',         cell.vmax],
        ['cq_c_vmin',  'V_min (V)',         cell.vmin],
        ['cq_c_ah',    'Capacity (Ah)',     cell.ah],
        ['cq_mass',    'Mass (g)',          cell.mass_g],
        ['cq_ir_bol',  'DCIR BoL (mΩ)',    cell.ir_bol],
        ['cq_ir_eol',  'DCIR EoL (mΩ)',    cell.ir_eol],
        ['cq_c_dis',   'Max C-rate dis',   cell.c_max_dis],
        ['cq_c_chg',   'Max C-rate chg',   cell.c_max_chg],
        ['cq_t_min',   'T_min op (°C)',     cell.t_min],
        ['cq_t_max',   'T_max op (°C)',     cell.t_max],
        ['cq_cycles',  'Cycle life',        cell.cycles],
        ['cq_soh_eol', 'EoL SoH (%)',       cell.soh_eol],
      ].map(([id,label,val])=>`<div><label class="cq-lbl">${label}</label>
        <input class="cq-inp" id="${id}" value="${val}" type="number" step="any" oninput="renderCellQual()"></div>`).join('')}
    </div>
    </div>

    <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
    <div class="ch3 b" style="margin-bottom:8px">Certifications (check if confirmed by supplier)</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      ${[
        ['cq_cert_un383','UN 38.3 Transport', cell.cert_un383],
        ['cq_cert_iec',  'IEC 62619 / 62133', cell.cert_iec],
        ['cq_cert_gb',   'GB/T 31485 (China)',cell.cert_gb],
      ].map(([id,label,chk])=>`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text2)">
        <input type="checkbox" class="cq-chk" id="${id}" ${chk?'checked':''} onchange="renderCellQual()"> ${label}
      </label>`).join('')}
    </div>
    </div>
  </div>

  <!-- Verdict + radar -->
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <!-- Verdict -->
    <div style="padding:20px;text-align:center;border-radius:10px;background:${verdict.bg};border:1px solid ${verdict.bc}">
      <div style="font-family:var(--display);font-size:28px;font-weight:800;color:${verdict.c}">${verdict.t}</div>
      <div style="font-size:13px;color:var(--text2);margin-top:6px">${cell.supplier||'Cell'} ${cell.model||''}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px">${cell.chem} · ${V_pack_nom.toFixed(0)}V · ${E_gross.toFixed(1)}kWh</div>
    </div>
    <!-- Score strip -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${[
        {l:'Score',   v:score+'%',         c:score>=90?'var(--g)':score>=70?'var(--y)':'var(--r)'},
        {l:'Pass',    v:pass+' / '+total,  c:'var(--g)'},
        {l:'Caution', v:warn,              c:'var(--y)'},
        {l:'Fail',    v:fail,              c:fail>0?'var(--r)':'var(--text3)'},
        {l:'Pack V',  v:V_pack_nom.toFixed(0)+'V', c:'var(--b)'},
        {l:'Energy',  v:E_gross.toFixed(1)+'kWh',  c:'var(--g)'},
      ].map(r=>`<div class="kpi-card" style="border-color:${r.c}22;padding:10px">
        <div class="kpi-v" style="color:${r.c};font-size:16px">${r.v}</div>
        <div class="kpi-l">${r.l}</div>
      </div>`).join('')}
    </div>
    <!-- Radar canvas -->
    <div>
      <div class="ch3 b" style="margin-bottom:6px">Qualification Radar</div>
      <canvas id="cq_radar" height="200" style="width:100%;display:block;background:var(--bg);border-radius:8px"></canvas>
    </div>
    <!-- Export button -->
    <button onclick="cqExport()" style="padding:9px;background:rgba(74,158,255,.1);border:1px solid rgba(74,158,255,.3);color:var(--b);border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">
      ⬇ Export Qualification Report (CSV)
    </button>
  </div>
</div>

<!-- ══ SCORECARD TABLE ══ -->
<div class="card" style="overflow-x:auto;margin-bottom:16px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <div class="ch3">📋 Qualification Scorecard — ${total} checks · ${pass} pass · ${warn} caution · ${fail} fail</div>
    <span style="font-size:10px;font-family:var(--mono);color:var(--text3)">${cell.chem} · ${req.Ss}S/${req.Pp}P · ${req.markets}</span>
  </div>
  <table style="border-collapse:collapse;width:100%;min-width:700px">
    <thead style="background:var(--bg3)">
      <tr>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">Check</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">Cell Value</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">Requirement</th>
        <th style="padding:8px 10px;text-align:center;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">Status</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2);border-bottom:2px solid var(--border2)">Notes</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>

<!-- ══ FAIL/CAUTION SUMMARY ══ -->
${fail > 0 || warn > 0 ? `
<div class="card" style="margin-bottom:16px">
  <div class="ch3">⚠ Action Items</div>
  <div style="margin-top:8px">
  ${checks.filter(c=>!c.ok).map(c=>`
    <div style="padding:10px 14px;margin-bottom:6px;border-radius:8px;
      background:${c.warn?'rgba(245,197,24,.06)':'rgba(255,77,109,.06)'};
      border:1px solid ${c.warn?'rgba(245,197,24,.25)':'rgba(255,77,109,.25)'}">
      <div style="font-size:13px;font-weight:700;color:${c.warn?'var(--y)':'var(--r)'}">
        ${c.warn?'⚠':'✗'} ${c.cat} — ${c.name}
      </div>
      <div style="font-size:12px;color:var(--text2);margin-top:3px">
        Cell: <b>${c.val}</b> · Required: <b>${c.target}</b> · ${c.note}
      </div>
    </div>`).join('')}
  </div>
</div>` : `<div class="ico-banner">✓ All checks passed — cell meets project requirements. Ready for DVP planning.</div>`}

<div class="ico-banner">
  📌 Scorecard based on ${req.Ss}S/${req.Pp}P config · Market: ${req.markets} · App: ${S.app||'—'}.
  Update Project Targets and Cell Inputs to refresh. Export to CSV for DVP package.
</div>`;

  /* ── Draw radar ── */
  requestAnimationFrame(() => {
    const cv = document.getElementById('cq_radar');
    if (!cv) return;
    const W = cv.offsetWidth || 300, H = 200;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const cx = W/2, cy = H/2, r = Math.min(cx, cy) - 28;
    const n = radarDims.length;

    ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, W, H);

    /* Grid rings */
    [25,50,75,100].forEach(pct => {
      const rr = r * pct/100;
      ctx.beginPath();
      for (let i=0; i<=n; i++) {
        const a = (i/n)*Math.PI*2 - Math.PI/2;
        const x = cx + Math.cos(a)*rr, y = cy + Math.sin(a)*rr;
        i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth=1; ctx.stroke();
      if (pct===100) { ctx.fillStyle='rgba(255,255,255,.04)'; ctx.fill(); }
    });

    /* Spokes */
    radarDims.forEach((d,i) => {
      const a = (i/n)*Math.PI*2 - Math.PI/2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r);
      ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1; ctx.stroke();
      /* Labels */
      const lx = cx + Math.cos(a)*(r+16), ly = cy + Math.sin(a)*(r+16);
      ctx.fillStyle='#6d8fba'; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='center';
      ctx.fillText(d.label, lx, ly+3);
    });

    /* Data polygon */
    ctx.beginPath();
    radarDims.forEach((d,i) => {
      const a = (i/n)*Math.PI*2 - Math.PI/2;
      const rr = r * d.score/100;
      const x = cx + Math.cos(a)*rr, y = cy + Math.sin(a)*rr;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,212,170,.15)'; ctx.fill();
    ctx.strokeStyle='#00d4aa'; ctx.lineWidth=2; ctx.stroke();

    /* Dots */
    radarDims.forEach((d,i) => {
      const a = (i/n)*Math.PI*2 - Math.PI/2;
      const rr = r * d.score/100;
      ctx.beginPath(); ctx.arc(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr, 3.5, 0, Math.PI*2);
      ctx.fillStyle = d.score>=90?'#00d4aa':d.score>=60?'#f5c518':'#ff4d6d'; ctx.fill();
    });
  });
};

/* ── Export CSV ── */
window.cqExport = function() {
  const S = window.S || {};
  const rows = document.querySelectorAll('#cellqual_root tbody tr');
  const lines = ['Category,Check,Cell Value,Requirement,Status,Notes'];
  let lastCat = '';
  rows.forEach(r => {
    const cells = r.querySelectorAll('td');
    if (cells.length === 1) { lastCat = cells[0].textContent.trim(); return; }
    if (cells.length >= 5) {
      const status = cells[3].textContent.trim().replace(/[✓✗⚠]/g,'').trim();
      lines.push([lastCat, ...Array.from(cells).slice(0,5).map(c=>'"'+c.textContent.trim().replace(/"/g,'""')+'"')].join(','));
    }
  });
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
  a.download = `CellQual_${(S.c_chem||'cell').replace(/\s/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
};

/* ── Hook showSec + propagate ── */
(function(){
  const _ss = window.showSec;
  window.showSec = function(id, btn) {
    if (typeof _ss === 'function') _ss(id, btn);
    if (id === 'cellqual') setTimeout(() => { try { renderCellQual(); } catch(e) { console.warn('[CellQual]',e); }}, 60);
  };
  const _pp = window.propagate;
  window.propagate = function() {
    if (typeof _pp === 'function') _pp.apply(this, arguments);
    try {
      if (document.getElementById('cellqual')?.classList.contains('active')) renderCellQual();
    } catch(e) {}
  };
})();
