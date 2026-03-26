const GAP_IDS = [
  {id:'gap_celldata',cat:'Cell Data',req:true},
  {id:'gap_ocvcurve',cat:'Cell Data',req:true},
  {id:'gap_dcir_map',cat:'Cell Data',req:true},
  {id:'gap_peukert',cat:'Cell Data',req:true},
  {id:'gap_cycle_curve',cat:'Cell Data',req:true},
  {id:'gap_cad',cat:'Pack Design',req:true},
  {id:'gap_busbar',cat:'Pack Design',req:true},
  {id:'gap_thermal_model',cat:'Pack Design',req:true},
  {id:'gap_duty_cycle',cat:'Thermal',req:true},
  {id:'gap_coolant_dp',cat:'Thermal',req:false},
  {id:'gap_charge_curve',cat:'Electrical',req:true},
  {id:'gap_hv_arch',cat:'Electrical',req:true},
  {id:'gap_precharge',cat:'Electrical',req:true},
  {id:'gap_soc_algo',cat:'BMS',req:true},
  {id:'gap_soh_algo',cat:'BMS',req:true},
  {id:'gap_sop',cat:'BMS',req:false},
  {id:'gap_balancing',cat:'BMS',req:true},
  {id:'gap_faults',cat:'BMS',req:true},
  {id:'gap_fmea',cat:'Safety',req:true},
  {id:'gap_thermal_runaway',cat:'Safety',req:true},
  {id:'gap_imd',cat:'Safety',req:true},
  {id:'gap_un383',cat:'Regulatory',req:true},
  {id:'gap_62619',cat:'Regulatory',req:true},
  {id:'gap_functional_safety',cat:'Regulatory',req:false},
  {id:'gap_bom',cat:'Business',req:false},
  {id:'gap_tco',cat:'Business',req:false},
];

function updateGap() {
  let total=0,avail=0,reqT=0,reqA=0;
  const cats={};
  GAP_IDS.forEach(g => {
    const el = document.getElementById(g.id);
    const checked = el ? el.checked : false;
    total++; if(checked) avail++;
    if(g.req){reqT++; if(checked) reqA++;}
    if(!cats[g.cat]) cats[g.cat]={t:0,a:0};
    cats[g.cat].t++; if(checked) cats[g.cat].a++;
  });
  const pct=Math.round(avail/total*100);
  const reqPct=Math.round(reqA/reqT*100);
  const score_el = document.getElementById('gap_score');
  if(score_el) setRg('gap_score',[
    {l:'Overall',v:pct+'%',u:'',c:pct>=70?'ok':pct>=40?'warn':'err'},
    {l:'Required items',v:reqPct+'%',u:'',c:reqPct>=80?'ok':reqPct>=50?'warn':'err'},
    {l:'Data available',v:avail+'/'+total,u:'items',c:'neutral'},
    {l:'Required met',v:reqA+'/'+reqT,u:'required',c:reqA>=reqT?'ok':'warn'},
  ]);
  const bars_el = document.getElementById('gap_bars');
  if(bars_el) {
    let bars='';
    Object.entries(cats).forEach(([cat,{t,a}])=>{
      const p=(a/t*100).toFixed(0);
      bars+=tbar(cat,p,100,'%',p>=70?'var(--g)':p>=40?'var(--o)':'var(--r)');
    });
    bars_el.innerHTML=bars;
  }
  const missing = GAP_IDS.filter(g=>{const el=document.getElementById(g.id);return g.req&&!(el?el.checked:false);});
  const acts_el = document.getElementById('gap_actions');
  if(acts_el) acts_el.innerHTML = missing.slice(0,6).map(g=>`<div style="display:flex;align-items:center;gap:6px;margin:4px 0;font-size:11px">${tag('TODO','o')} <b>${g.cat}:</b> ${g.id.replace('gap_','').replace(/_/g,' ')}</div>`).join('')+(missing.length>6?`<div style="font-size:10px;color:var(--m);margin-top:4px">+ ${missing.length-6} more items needed</div>`:'');
}

function parseDCIRMap(input) {
  const f = input.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l=>l.trim());
    let pts = [];
    lines.slice(1).forEach(l => {
      const cols = l.split(/[,\t;]/);
      if(cols.length >= 3) pts.push({t:+cols[0], soc:+cols[1], ir:+cols[2]});
    });
    // Find 25°C, 50% SoC point
    const ref = pts.find(p => Math.abs(p.t-25)<5 && Math.abs(p.soc-50)<10);
    if(ref) {
      setField('c_ir_bol', ref.ir.toFixed(3));
      setField('gap_ir_bol', ref.ir.toFixed(3));
    }
    document.getElementById('gap_dcir_info').textContent = `✓ ${pts.length} DCIR points loaded${ref?' — BoL @25°C,50%SoC: '+ref.ir.toFixed(3)+'mΩ':''}`;
    propagate();
  };
  reader.readAsText(f);
}

function parseFadeCurve(input) {
  const f = input.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l=>l.trim());
    let pts = [];
    lines.slice(1).forEach(l => {
      const cols = l.split(/[,\t;]/);
      if(cols.length >= 2 && !isNaN(+cols[0])) pts.push({n:+cols[0], soh:+cols[1]});
    });
    // Extract key milestones
    const at = (nc) => { const p=pts.reduce((a,b)=>Math.abs(b.n-nc)<Math.abs(a.n-nc)?b:a,pts[0]); return p?p.soh:null; };
    const s500=at(500),s1000=at(1000),s2000=at(2000),s3000=at(3000);
    if(s500) setField('gap_soh500',s500.toFixed(1));
    if(s1000) setField('gap_soh1000',s1000.toFixed(1));
    if(s2000) setField('gap_soh2000',s2000.toFixed(1));
    if(s3000) {setField('gap_soh3000',s3000.toFixed(1)); setField('t_soh_eol',(s3000).toFixed(0)); propagate();}
    document.getElementById('gap_fade_info').textContent = `✓ ${pts.length} fade curve points loaded`;
  };
  reader.readAsText(f);
}

function parseCCCV(input) {
  const f = input.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l=>l.trim());
    let pts = [];
    lines.slice(1).forEach(l => {
      const cols = l.split(/[,\t;]/);
      if(cols.length >= 2) pts.push({t:+cols[0], I:+cols[1], V:cols[2]?+cols[2]:null});
    });
    const I_cc = Math.max(...pts.slice(0,5).map(p=>Math.abs(p.I)));
    setField('bms_icc', I_cc.toFixed(0));
    document.getElementById('gap_cccv_info').textContent = `✓ ${pts.length} CC-CV points — CC current: ${I_cc.toFixed(0)}A`;
    updateCCCV();
  };
  reader.readAsText(f);
}

function parsePeukert(input) {
  const f = input.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    let pts = [];
    lines.slice(1).forEach(l => {
      const cols = l.split(/[,\t;]/);
      if(cols.length >= 2 && !isNaN(+cols[0]) && !isNaN(+cols[1])) {
        pts.push({ crate: +cols[0], cap: +cols[1] });
      }
    });
    if(pts.length < 2) {
      const el = document.getElementById('gap_peukert_info');
      if(el) el.textContent = '⚠ Could not parse — format: crate, capacity_Ah';
      return;
    }
    // Fill standard C-rate slots
    const closest = (arr, target) => arr.reduce((a, b) =>
      Math.abs(b.crate - target) < Math.abs(a.crate - target) ? b : a);
    const p05 = closest(pts, 0.5);
    const p1  = closest(pts, 1.0);
    const p2  = closest(pts, 2.0);
    const p3  = closest(pts, 3.0);
    if(p05) setField('gap_cap_05c', p05.cap.toFixed(1));
    if(p1)  setField('gap_cap_1c',  p1.cap.toFixed(1));
    if(p2)  setField('gap_cap_2c',  p2.cap.toFixed(1));
    if(p3)  setField('gap_cap_3c',  p3.cap.toFixed(1));
    // Use 1C as the reference nominal capacity
    const nomCap = p1 ? p1.cap : pts[0].cap;
    setField('c_ah', nomCap.toFixed(1));
    const el = document.getElementById('gap_peukert_info');
    if(el) el.textContent = `✓ ${pts.length} Peukert points loaded — 1C cap: ${nomCap.toFixed(1)} Ah`;
    propagate();
  };
  reader.readAsText(f);
}

function handleCADUpload(input) {
  const f = input.files[0]; if(!f) return;
  document.getElementById('gap_cad_info').textContent = `✓ ${f.name} — open 3D Viewer tab to view`;
  // Store for 3D viewer
  window._cadFile = f;
  window._cadFileName = f.name;
}


// ══════════════════════════════════════════════════════════════════════
// THERMAL RISE SIMULATION — Drive Cycle Linked
// Physics model: lumped capacitance with TMS hysteresis control
// dT/dt = (Q_gen - Q_tms - Q_conv) / C_thermal
// ══════════════════════════════════════════════════════════════════════

function runThermalRise() {
