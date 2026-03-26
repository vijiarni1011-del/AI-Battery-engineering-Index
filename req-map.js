const REQ_CATEGORIES = {
  Electrical: {icon:'⚡', color:'var(--b)'},
  Thermal:    {icon:'🌡️', color:'var(--o)'},
  Safety:     {icon:'🛡️', color:'var(--r)'},
  Lifecycle:  {icon:'📈', color:'var(--g)'},
  Mechanical: {icon:'🔩', color:'var(--y)'},
  EMC:        {icon:'📡', color:'var(--b)'},
  Environmental:{icon:'🌍', color:'var(--g)'},
  Charging:   {icon:'🔌', color:'var(--teal)'},
};

// Requirement templates — each maps to engineering target fields
const REQ_TEMPLATES = [
  // Electrical
  {id:'EL-01', cat:'Electrical', req:'System nominal voltage',      engId:'t_varch',   std:'IEC 62619 §5.1',  level:'pack'},
  {id:'EL-02', cat:'Electrical', req:'Max system voltage (Vdc)',     engId:'t_vmax_sys',std:'IEC 62619 §5.2',  level:'pack'},
  {id:'EL-03', cat:'Electrical', req:'Min system voltage (Vdc)',     engId:'t_vmin_sys',std:'IEC 62619 §5.2',  level:'pack'},
  {id:'EL-04', cat:'Electrical', req:'Peak discharge power (kW)',    engId:'t_ppeak',   std:'ISO 12405-4',     level:'pack'},
  {id:'EL-05', cat:'Electrical', req:'Cont. discharge power (kW)',   engId:'t_pcont',   std:'ISO 12405-4',     level:'pack'},
  {id:'EL-06', cat:'Electrical', req:'Min usable energy (kWh)',      engId:'t_eu_min',  std:'ISO 12405-2',     level:'pack'},
  {id:'EL-07', cat:'Electrical', req:'Min installed energy (kWh)',   engId:'t_emin',    std:'ISO 12405-2',     level:'pack'},
  {id:'EL-08', cat:'Electrical', req:'Peak discharge C-rate',        engId:'t_cpeak',   std:'IEC 62619 §5.3',  level:'cell'},
  {id:'EL-09', cat:'Electrical', req:'Cell chemistry',               engId:'req_chem',  std:'IEC 62620',       level:'cell'},
  {id:'EL-10', cat:'Electrical', req:'Cells in series range',        engId:'req_s_range',std:'Design calc',    level:'pack'},
  // Charging
  {id:'CH-01', cat:'Charging',   req:'AC charge power (kW)',         engId:'t_pac',     std:'IEC 61851-1',     level:'system'},
  {id:'CH-02', cat:'Charging',   req:'DC fast charge power (kW)',     engId:'t_pdc',     std:'IEC 61851-23',    level:'system'},
  {id:'CH-03', cat:'Charging',   req:'Charge C-rate (cont.)',         engId:'t_cchg',    std:'IEC 62619 §6.3',  level:'cell'},
  {id:'CH-04', cat:'Charging',   req:'Min ambient for charging (°C)', engId:'t_tchg_lo', std:'IEC 62619 §6.3',  level:'system'},
  {id:'CH-05', cat:'Charging',   req:'Max ambient for charging (°C)', engId:'t_tchg_hi', std:'IEC 62619 §6.3',  level:'system'},
  // Thermal
  {id:'TH-01', cat:'Thermal',    req:'Min operating temp (°C)',       engId:'t_top_lo',  std:'IEC 62619 §5.4',  level:'system'},
  {id:'TH-02', cat:'Thermal',    req:'Max operating temp (°C)',       engId:'t_top_hi',  std:'IEC 62619 §5.4',  level:'system'},
  {id:'TH-03', cat:'Thermal',    req:'Max cell temperature (°C)',     engId:'t_tcell_max',std:'IEC 62619 §5.4', level:'cell'},
  {id:'TH-04', cat:'Thermal',    req:'Max cell temp gradient (°C)',   engId:'t_tgrad',   std:'IEC 62619 §5.4',  level:'pack'},
  {id:'TH-05', cat:'Thermal',    req:'Cooling type',                  engId:'t_cooling', std:'ISO 16950',       level:'system'},
  {id:'TH-06', cat:'Thermal',    req:'Max flow rate (L/min)',         engId:'req_maxflow',std:'TMS design',     level:'system'},
  {id:'TH-07', cat:'Thermal',    req:'Pressure drop limit (mbar)',    engId:'req_dp',    std:'TMS design',      level:'system'},
  // Lifecycle
  {id:'LC-01', cat:'Lifecycle',  req:'Minimum cycle life (cycles)',   engId:'t_cycles',  std:'IEC 62620 §7.3',  level:'cell'},
  {id:'LC-02', cat:'Lifecycle',  req:'EoL SoH target (%)',            engId:'t_soh_eol', std:'ISO 12405-4 §7.5',level:'pack'},
  {id:'LC-03', cat:'Lifecycle',  req:'Calendar life target (years)',  engId:'t_years',   std:'IEC 62620 §7.4',  level:'cell'},
  {id:'LC-04', cat:'Lifecycle',  req:'Year 5 SoH target (%)',         engId:'t_soh5',    std:'ISO 12405-4',     level:'pack'},
  {id:'LC-05', cat:'Lifecycle',  req:'Operating days / year',         engId:'t_days_yr', std:'Design target',   level:'system'},
  {id:'LC-06', cat:'Lifecycle',  req:'Autonomy target (hours)',       engId:'t_auto',    std:'Design target',   level:'system'},
  // Safety
  {id:'SF-01', cat:'Safety',     req:'IP rating',                     engId:'t_ip',      std:'IEC 60529',       level:'pack'},
  {id:'SF-02', cat:'Safety',     req:'Functional safety level',       engId:'t_fusa',    std:'ISO 25119 / 26262',level:'system'},
  {id:'SF-03', cat:'Safety',     req:'Voltage class',                 engId:'t_varch',   std:'IEC 60664-1',     level:'system'},
  {id:'SF-04', cat:'Safety',     req:'HV isolation (IMD)',            engId:'sf_ir',     std:'ISO 6469-3',      level:'system'},
  // Environmental
  {id:'EN-01', cat:'Environmental',req:'Max altitude (MASL)',         engId:'t_alt',     std:'ISO 16750-3',     level:'system'},
  {id:'EN-02', cat:'Environmental',req:'Max humidity (RH%)',          engId:'req_rh',    std:'IEC 60068-2-78',  level:'pack'},
  {id:'EN-03', cat:'Environmental',req:'Min volumetric energy (Wh/L)',engId:'t_ged',     std:'Design target',   level:'pack'},
  // EMC
  {id:'EM-01', cat:'EMC',        req:'Radiated emissions',            engId:null,        std:'CISPR 25 / IEC 61000-6-4',level:'system'},
  {id:'EM-02', cat:'EMC',        req:'Conducted immunity',            engId:null,        std:'IEC 61000-4-6',   level:'system'},
  {id:'EM-03', cat:'EMC',        req:'ESD immunity',                  engId:null,        std:'IEC 61000-4-2',   level:'system'},
  // Mechanical
  {id:'ME-01', cat:'Mechanical', req:'Vibration profile',             engId:null,        std:'IEC 60068-2-6',   level:'pack'},
  {id:'ME-02', cat:'Mechanical', req:'Mechanical shock',              engId:null,        std:'IEC 60068-2-27',  level:'pack'},
  {id:'ME-03', cat:'Mechanical', req:'Ingress protection (dust/water)',engId:'t_ip',     std:'IEC 60529',       level:'pack'},
];

// Storage for user-added test item links
window._reqMapData = [];
let _rmFilter = 'ALL';

function buildReqMapFromTargets() {
  window._reqMapData = REQ_TEMPLATES.map(tpl => {
    const engEl = tpl.engId ? document.getElementById(tpl.engId) : null;
    const targetVal = engEl ? (engEl.options ? engEl.options[engEl.selectedIndex]?.text || engEl.value : engEl.value) : '—';
    return {
      ...tpl,
      targetVal,
      testIds: '',
      testName: '',
      status: 'pending',
      coverage: 'none',
    };
  });
  renderReqMap();
  updateReqMapKPIs();
}

function renderReqMap() {
  const tbody = document.getElementById('req_map_body');
  if (!tbody) return;
  if (!window._reqMapData || !Array.isArray(window._reqMapData)) {
    window._reqMapData = [];
  }
  const rows = _rmFilter === 'ALL' ? window._reqMapData :
    _rmFilter === 'NOT_COVERED' ? window._reqMapData.filter(r => r.coverage === 'none') :
    window._reqMapData.filter(r => r.cat === _rmFilter);

  if (!rows.length) {
    const msg = window._reqMapData.length === 0
      ? `<div style="font-size:28px;margin-bottom:12px">📐</div>
         <div style="font-weight:600;margin-bottom:6px;color:var(--text2)">No requirements yet</div>
         <div style="font-size:12px;margin-bottom:16px">Generate from your Project Targets or add rows manually</div>
         <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
           <button onclick="buildReqMapFromTargets()" style="padding:9px 18px;background:rgba(74,158,255,.1);border:1px solid rgba(74,158,255,.3);color:var(--b);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--sans)">↻ Generate from Targets</button>
           <button onclick="addReqMapRow()" style="padding:9px 18px;background:rgba(0,212,170,.1);border:1px solid rgba(0,212,170,.3);color:var(--g);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--sans)">+ Add Blank Row</button>
         </div>`
      : `No requirements match this filter`;
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text3);font-size:13px">${msg}</td></tr>`;
    return;
  }

  const catColors = {
    Electrical:'var(--b)',Thermal:'var(--o)',Safety:'#ef4444',
    Lifecycle:'var(--g)',Mechanical:'var(--y)',EMC:'#a78bfa',
    Environmental:'#34d399',Charging:'var(--g)',BMS:'var(--b)',Other:'var(--m)'
  };
  const statusBadge = (s) => {
    const styles = {
      pass:   'background:rgba(0,212,170,.1);color:var(--g);border:1px solid rgba(0,212,170,.3)',
      fail:   'background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.3)',
      running:'background:rgba(245,197,24,.1);color:var(--y);border:1px solid rgba(245,197,24,.3)',
    };
    const st = (s||'pending').toLowerCase();
    const style = styles[st] || 'background:var(--bg3);color:var(--text3);border:1px solid var(--border)';
    return `<span style="padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;${style}">${(s||'PENDING').toUpperCase()}</span>`;
  };
  const covBadge = (c) => {
    if (c === 'full')    return `<span style="padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;background:rgba(0,212,170,.1);color:var(--g);border:1px solid rgba(0,212,170,.3)">✓ COVERED</span>`;
    if (c === 'partial') return `<span style="padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;background:rgba(245,197,24,.1);color:var(--y);border:1px solid rgba(245,197,24,.3)">~ PARTIAL</span>`;
    return `<span style="padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;background:rgba(239,68,68,.08);color:#ef4444;border:1px solid rgba(239,68,68,.25)">✕ GAP</span>`;
  };

  tbody.innerHTML = rows.map((r) => {
    const idx = window._reqMapData.indexOf(r);
    const col = catColors[r.cat] || 'var(--m)';
    const inputStyle = 'padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--t);font-family:\'DM Mono\',monospace;font-size:10px;outline:none;width:100%;transition:border-color .15s';
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:9px 12px;white-space:nowrap">
        <span style="font-family:'DM Mono',monospace;font-size:10px;font-weight:700;color:var(--b)">${r.id}</span>
      </td>
      <td style="padding:9px 12px;font-size:11px;font-weight:500;max-width:200px;line-height:1.4">${r.req}</td>
      <td style="padding:9px 12px;white-space:nowrap">
        <span style="padding:2px 8px;border-radius:12px;font-size:9px;font-weight:700;background:${col}18;color:${col};border:1px solid ${col}44">${r.cat}</span>
      </td>
      <td style="padding:9px 12px;font-family:'DM Mono',monospace;font-size:10px;color:var(--g);white-space:nowrap">${r.targetVal||'—'}</td>
      <td style="padding:9px 12px;min-width:110px">
        <input style="${inputStyle}" value="${r.testIds||''}" placeholder="TC-001" onchange="updateReqRow(${idx},'testIds',this.value)" onfocus="this.style.borderColor='rgba(0,212,170,.4)'" onblur="this.style.borderColor='var(--border)'">
      </td>
      <td style="padding:9px 12px;min-width:160px">
        <input style="${inputStyle}" value="${r.testName||''}" placeholder="Test name" onchange="updateReqRow(${idx},'testName',this.value)" onfocus="this.style.borderColor='rgba(0,212,170,.4)'" onblur="this.style.borderColor='var(--border)'">
      </td>
      <td style="padding:9px 12px;font-size:10px;color:var(--text3);white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${r.std||''}">${r.std||'—'}</td>
      <td style="padding:9px 12px;white-space:nowrap">
        <span style="padding:2px 7px;border-radius:4px;font-size:9px;background:rgba(74,158,255,.1);color:var(--b);border:1px solid rgba(74,158,255,.25)">${r.level||'—'}</span>
      </td>
      <td style="padding:9px 12px;white-space:nowrap">${statusBadge(r.status)}</td>
      <td style="padding:9px 12px;white-space:nowrap">${covBadge(r.coverage)}</td>
      <td style="padding:9px 12px">
        <button onclick="deleteReqRow(${idx})" title="Delete" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:#ef4444;border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer">✕</button>
      </td>
    </tr>`;
  }).join('');

  renderCoverageCharts();
}

function updateReqRow(idx, field, val) {
  if (!window._reqMapData[idx]) return;
  window._reqMapData[idx][field] = val;
  // Auto-set coverage
  const r = window._reqMapData[idx];
  if (r.testIds) {
    window._reqMapData[idx].coverage = r.testName ? 'full' : 'partial';
  } else {
    window._reqMapData[idx].coverage = 'none';
  }
  updateReqMapKPIs();
  renderCoverageCharts();
}

function deleteReqRow(idx) {
  if (!window._reqMapData || !Array.isArray(window._reqMapData)) return;
  window._reqMapData.splice(idx, 1);
  renderReqMap();
  updateReqMapKPIs();
}

function addReqMapRow() {
  // Guard: ensure _reqMapData exists
  if (!window._reqMapData || !Array.isArray(window._reqMapData)) {
    window._reqMapData = [];
  }
  const newRow = {
    id: 'USR-' + String(window._reqMapData.length + 1).padStart(2,'0'),
    cat: 'Electrical', req: 'New requirement', engId: null, std: '', level: 'System',
    targetVal: '', testIds: '', testName: '', status: 'pending', coverage: 'none',
    source: 'Manual'
  };
  window._reqMapData.push(newRow);
  renderReqMap();
  updateReqMapKPIs();
  // Scroll to last row so user sees the new entry
  setTimeout(() => {
    try {
      const tbody = document.getElementById('req_map_body');
      if (tbody) {
        const lastRow = tbody.lastElementChild;
        if (lastRow) lastRow.scrollIntoView({behavior:'smooth', block:'nearest'});
      }
    } catch(_) {}
  }, 100);
}

function filterReqMap(cat, btn) {
  _rmFilter = cat;
  // Reset all filter pills in reqmap panel
  document.querySelectorAll('#panel-reqmap button[onclick^="filterReqMap"]').forEach(b => {
    const isGap = b.textContent.includes('Gap');
    b.style.background   = isGap ? 'rgba(239,68,68,.08)' : 'var(--bg2)';
    b.style.borderColor  = isGap ? 'rgba(239,68,68,.3)' : 'var(--border)';
    b.style.color        = isGap ? 'var(--r)' : 'var(--text3)';
    b.style.fontWeight   = '500';
  });
  // Highlight active pill
  if (btn) {
    const isGap = cat === 'NOT_COVERED';
    btn.style.background  = isGap ? 'rgba(239,68,68,.18)' : 'rgba(0,212,170,.12)';
    btn.style.borderColor = isGap ? 'rgba(239,68,68,.5)' : 'rgba(0,212,170,.4)';
    btn.style.color       = isGap ? 'var(--r)' : 'var(--g)';
    btn.style.fontWeight  = '700';
  }
  renderReqMap();
  updateReqMapKPIs();
}

function updateReqMapKPIs() {
  if (!window._reqMapData || !Array.isArray(window._reqMapData)) return;
  const total   = window._reqMapData.length;
  const covered = window._reqMapData.filter(r => r.coverage === 'full').length;
  const partial = window._reqMapData.filter(r => r.coverage === 'partial').length;
  const gap     = window._reqMapData.filter(r => r.coverage === 'none').length;
  const setKpi  = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setKpi('rm_total', total);
  setKpi('rm_covered', covered);
  setKpi('rm_partial', partial);
  setKpi('rm_gap', gap);
  // Update row count label
  const lbl = document.getElementById('rm_row_count');
  if (lbl) lbl.textContent = total + ' requirement' + (total === 1 ? '' : 's');
}

function renderCoverageCharts() {
  // Category coverage bars
  const chartEl = document.getElementById('rm_coverage_chart');
  if (chartEl) {
    const cats = Object.keys(REQ_CATEGORIES);
    let html = '';
    cats.forEach(cat => {
      const catRows = window._reqMapData.filter(r => r.cat === cat);
      if (!catRows.length) return;
      const covered = catRows.filter(r => r.coverage === 'full').length;
      const pct = Math.round(covered / catRows.length * 100);
      const col = pct >= 80 ? 'var(--g)' : pct >= 50 ? 'var(--y)' : 'var(--r)';
      html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="width:100px;font-size:10px;color:var(--m)">${REQ_CATEGORIES[cat].icon} ${cat}</div>
        <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${col};border-radius:3px;transition:width .4s"></div>
        </div>
        <div style="width:40px;text-align:right;font-size:10px;font-family:'DM Mono',monospace;color:${col}">${pct}%</div>
        <div style="width:55px;font-size:9px;color:var(--m)">${covered}/${catRows.length} req</div>
      </div>`;
    });
    chartEl.innerHTML = html || '<div style="color:var(--m);font-size:11px">Generate requirements first</div>';
  }

  // Test level distribution bars
  const levelEl = document.getElementById('rm_level_chart');
  if (levelEl) {
    const levels = ['cell','module','pack','system'];
    const total = window._reqMapData.length || 1;
    levelEl.innerHTML = levels.map(lv => {
      const n = window._reqMapData.filter(r => r.level === lv).length;
      const pct = Math.round(n / total * 100);
      const cols = {cell:'var(--g)',module:'var(--b)',pack:'var(--o)',system:'var(--y)'};
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="width:60px;font-size:10px;color:var(--m);text-transform:capitalize">${lv}</div>
        <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${cols[lv]};border-radius:3px;transition:width .4s"></div>
        </div>
        <div style="width:30px;text-align:right;font-size:10px;font-family:'DM Mono',monospace;color:${cols[lv]}">${n}</div>
      </div>`;
    }).join('');
  }
}

// ── Parse n8n JSON output → auto-link test items ──
function parseN8nOutput() {
  const raw = document.getElementById('rm_n8n_paste')?.value || '';
  if (!raw.trim()) return;
  try {
    const data = JSON.parse(raw);
    const items = data.dvp_items || data.test_items || data.items || [];
    if (!items.length) {
      document.getElementById('rm_parse_status').textContent = '⚠ No dvp_items array found in JSON';
      return;
    }
    // Auto-match test items to requirements by category keyword
    items.forEach(item => {
      const cat = guessCat(item.category || item.test_name || '');
      const match = window._reqMapData.find(r =>
        r.cat === cat && !r.testIds &&
        (r.req.toLowerCase().includes((item.test_name||'').split(' ')[0].toLowerCase()))
      );
      if (match) {
        match.testIds  = item.test_id  || '';
        match.testName = item.test_name || '';
        match.status   = (item.result || 'pending').toLowerCase();
        match.coverage = match.testIds ? 'full' : 'partial';
      } else {
        // Add as new row
        window._reqMapData.push({
          id: item.test_id || 'N8N-' + window._reqMapData.length,
          cat, req: item.test_name || '',
          engId: null, std: item.applicable_standard || '',
          level: item.level || 'pack',
          targetVal: item.acceptance_criteria || '',
          testIds: item.test_id || '',
          testName: item.test_name || '',
          status: (item.result || 'pending').toLowerCase(),
          coverage: 'full'
        });
      }
    });
    renderReqMap();
    updateReqMapKPIs();
    document.getElementById('rm_parse_status').textContent =
      `✓ ${items.length} test items imported from n8n output`;
  } catch(e) {
    document.getElementById('rm_parse_status').textContent = '⚠ JSON parse error: ' + e.message;
  }
}

function guessCat(text) {
  const t = text.toLowerCase();
  if (/thermal|temp|heat|cool/.test(t))  return 'Thermal';
  if (/safety|isolation|hv|imd|fuse/.test(t)) return 'Safety';
  if (/lifecycle|cycle|aging|soh|calendar/.test(t)) return 'Lifecycle';
  if (/vibrat|shock|mechan/.test(t)) return 'Mechanical';
  if (/emc|emission|conduct|radiat/.test(t)) return 'EMC';
  if (/ip|ingress|envir|humidity|altitude/.test(t)) return 'Environmental';
  if (/charg|ac|dc|cccv/.test(t)) return 'Charging';
  return 'Electrical';
}

// ── Toggle add requirement form ──
function toggleAddReqForm() {
  const form = document.getElementById('addreq_form');
  const btn  = document.getElementById('addreq_toggle_btn');
  if (!form) return;
  const isHidden = form.style.display === 'none' || !form.style.display;
  form.style.display = isHidden ? 'block' : 'none';
  if (btn) btn.textContent = isHidden ? '− Collapse' : '+ Expand';
  if (isHidden) {
    // Auto-generate next req ID
    const idEl = document.getElementById('nr_id');
    if (idEl && !idEl.value) {
      const nextNum = (window._reqMapData || []).filter(r => r.id && r.id.startsWith('REQ-')).length + 1;
      idEl.value = 'REQ-' + String(nextNum).padStart(3, '0');
    }
    setTimeout(() => { try { document.getElementById('nr_req')?.focus(); } catch(_){} }, 50);
  }
}

// ── Submit new requirement from the form ──
function submitNewRequirement() {
  if (!window._reqMapData || !Array.isArray(window._reqMapData)) {
    window._reqMapData = [];
  }
  const id      = (document.getElementById('nr_id')?.value || '').trim();
  const cat     = document.getElementById('nr_cat')?.value || 'Electrical';
  const source  = document.getElementById('nr_src')?.value || 'Manual';
  const req     = (document.getElementById('nr_req')?.value || '').trim();
  const target  = (document.getElementById('nr_target')?.value || '').trim();
  const testIds = (document.getElementById('nr_test_id')?.value || '').trim();
  const std     = (document.getElementById('nr_std')?.value || '').trim();
  const level   = document.getElementById('nr_level')?.value || 'System';

  if (!req) {
    alert('Please enter a requirement description.');
    document.getElementById('nr_req')?.focus();
    return;
  }

  // Auto-generate ID if blank
  const finalId = id || ('REQ-' + String(window._reqMapData.length + 1).padStart(3,'0'));

  window._reqMapData.push({
    id: finalId,
    cat,
    source,
    req,
    engId: null,
    targetVal: target,
    testIds,
    testName: '',
    std,
    level,
    status: testIds ? 'pending' : 'not_started',
    coverage: testIds ? 'partial' : 'none'
  });

  renderReqMap();
  updateReqMapKPIs();
  renderCoverageCharts();

  // Reset form
  ['nr_id','nr_req','nr_target','nr_test_id','nr_std'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  toggleAddReqForm(); // collapse

  // Scroll to last row
  setTimeout(() => {
    try {
      const tbody = document.getElementById('req_map_body');
      if (tbody) tbody.lastElementChild?.scrollIntoView({behavior:'smooth', block:'nearest'});
    } catch(_) {}
  }, 100);
}


async function refreshReqMapFromSheet() {
  const cfg = window.DVP_CONFIG;
  if (!cfg.googleSheetId || cfg.googleSheetId === 'YOUR_GOOGLE_SHEET_ID') {
    alert('Configure googleSheetId in DVP_CONFIG to sync live test status');
    return;
  }
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${cfg.googleSheetId}/values/${encodeURIComponent(cfg.sheetNames.dvpItems)}?key=${cfg.googleApiKey}`;
    const resp = await fetch(url).then(r => r.json());
    if (!resp.values || resp.values.length < 2) return;
    const headers = resp.values[0];
    const rows = resp.values.slice(1).map(r => {
      const obj = {}; headers.forEach((h,i) => obj[h] = r[i]||''); return obj;
    });
    // Update statuses in reqMapData
    rows.forEach(row => {
      const match = window._reqMapData.find(r =>
        r.testIds && r.testIds.includes(row.test_id||''));
      if (match) {
        match.status = (row.result || 'pending').toLowerCase();
      }
    });
    renderReqMap();
    updateReqMapKPIs();
    const el = document.getElementById('rm_parse_status');
    if (el) el.textContent = `✓ Synced ${rows.length} items from Google Sheet`;
  } catch(e) {
    alert('Sheet sync failed: ' + e.message);
  }
}

// ── CSV Export ──
function exportReqMap() {
  const headers = ['Req ID','Category','Requirement','Eng Target Field','Target Value',
                   'Linked Test IDs','Test Name','Standard','Level','Status','Coverage'];
  const rows = window._reqMapData.map(r => [
    r.id, r.cat, r.req, r.engId||'', r.targetVal,
    r.testIds, r.testName, r.std, r.level, r.status, r.coverage
  ]);
  const csv = [headers, ...rows].map(r =>
    r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')
  ).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'requirement_traceability_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}

// ── On load: initialise req map from current targets ──
window.addEventListener('load', () => {
  initAuth(); // multi-user auth check
  setTimeout(() => {
    // FIX: guard so a failure here doesn't block anything else
    try { if(typeof buildReqMapFromTargets==='function') buildReqMapFromTargets(); } catch(e) {}
  }, 1200);
});





// ═══════════════════════════════════════════════════════
// VEHICLE-ADAPTIVE PRESETS — full set for every vehicle type
// When vehicle is selected these seed Project Targets + Cell defaults
// ═══════════════════════════════════════════════════════
const VEH_PRESETS = {
