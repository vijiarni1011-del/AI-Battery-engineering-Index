const BB_MATS = {
  'Cu_ETP':{name:'Cu ETP C11000',rho:1.72e-8,alpha:0.0039,note:'Main battery busbar — most common'},
  'Cu_OFC':{name:'Cu OFC C10100',rho:1.68e-8,alpha:0.00393,note:'High-end EV packs, lowest resistance'},
  'CuT2':{name:'Cu T2 (China std)',rho:1.72e-8,alpha:0.00393,note:'Battery modules, widely used'},
  'CuAg':{name:'CuAg 0.1% silver',rho:1.75e-8,alpha:0.0039,note:'High-temp busbars, >150°C'},
  'CuCrZr':{name:'CuCrZr alloy',rho:2.1e-8,alpha:0.0039,note:'High strength, weld areas'},
  'Cu_Sn':{name:'Tin-plated Cu',rho:1.78e-8,alpha:0.0039,note:'Corrosion protection'},
  'Cu_Ni':{name:'Nickel-plated Cu',rho:1.85e-8,alpha:0.004,note:'High-temp / oxidation resistant'},
  'Al_6101':{name:'Al 6101-T6',rho:3.2e-8,alpha:0.004,note:'EV battery packs, light weight'},
  'Al_6061':{name:'Al 6061-T6',rho:4.0e-8,alpha:0.004,note:'Structural busbars'},
  'Al_1050':{name:'Al 1050/1350',rho:2.9e-8,alpha:0.004,note:'Power distribution, high conductivity'},
  'Al_3003':{name:'Al 3003',rho:4.1e-8,alpha:0.004,note:'Corrosion environments'},
  'CCA':{name:'Cu-Clad Al (CCA)',rho:2.7e-8,alpha:0.004,note:'Weight/conductivity balance'},
  'Cu_lam':{name:'Laminated Cu flex',rho:1.72e-8,alpha:0.0039,note:'Low inductance, flexible interconnects'},
  'CuNi_multi':{name:'Cu+Ni multilayer',rho:1.85e-8,alpha:0.004,note:'Corrosion + high temp, BMS connections'},
};
const MAT_RHO   = Object.fromEntries(Object.entries(BB_MATS).map(([k,v])=>[k,v.rho]));
const MAT_ALPHA = Object.fromEntries(Object.entries(BB_MATS).map(([k,v])=>[k,v.alpha]));
// Legacy aliases
MAT_RHO['Al1060']=2.37e-8; MAT_RHO['Al1100']=2.82e-8; MAT_ALPHA['Al1060']=0.0039; MAT_ALPHA['Al1100']=0.0039;
function calcResistance() {
  const tabmat=document.getElementById('res_tabmat')?.value||'Al1060';
  const bbmat=document.getElementById('res_bbmat')?.value||'Cu_OFC';
  const tabW=getV('res_tabw')/1000, tabT=getV('res_tabt')/1000, tabL=getV('res_tabl')/1000;
  const bbL=getV('res_bbl')/1000, bbW=getV('res_bbw')/1000, bbT=getV('res_bbt')/1000;
  const Kc=getV('res_kc'), Ks=getV('res_ks'), Kp=getV('res_kp'), Kw=getV('res_kw');
  const dT=getV('res_dT'), Ss=getV('res_S'), Pp=getV('res_P');
  const nscrew=getV('res_nscrew'), ncontact=getV('res_ncontact');

  const rho_tab = MAT_RHO[tabmat]||2.37e-8;
  const alpha_tab = MAT_ALPHA[tabmat]||0.0039;
  const rho_bb = MAT_RHO[bbmat]||1.72e-8;
  const alpha_bb = MAT_ALPHA[bbmat]||0.00393;

  // Tab resistance (bulk) per cell
  const R_tab_bulk = rho_tab * tabL / (tabW * tabT) * (1 + alpha_tab * dT);
  // Contact resistance (at weld/screw interface)
  const A_contact = tabW * tabT;
  const R_contact = (rho_tab / A_contact) * Kc * Ks * Kp * Kw * (1 + alpha_tab * dT);
  // Busbar per connection
  const R_busbar = rho_bb * bbL / (bbW * bbT) * (1 + alpha_bb * dT);
  // Per-cell total (tab + contact to busbar)
  const R_per_cell_connection = R_tab_bulk + R_contact + R_busbar;
  // Pack series resistance (cells in S, P in parallel)
  const R_pack_cell_contribs = (Ss / Pp) * R_per_cell_connection;
  // Cell DCiR contribution
  const R_cell_dcir = (S.c_ir_bol * 1e-3 * Ss) / Pp; // pack level
  // Screw contacts
  const R_screw = nscrew * 1e-4 / Pp; // ~0.1 mΩ per screw
  // HV contacts (main terminal connectors)
  const R_hvcontact = ncontact * 2e-5; // ~0.02 mΩ per HV contact
  // Shunt
  const R_shunt = getV('res_shunt') * 1e-3;
  const R_pack_interconnect = R_pack_cell_contribs + R_screw + R_hvcontact + R_shunt;
  const R_pack_total_bol = R_cell_dcir + R_pack_interconnect;
  // EoL: cell IR increases
  const R_cell_dcir_eol = (S.c_ir_eol * 1e-3 * Ss) / Pp;
  const R_pack_total_eol = R_cell_dcir_eol + R_pack_interconnect;

  // Export to S for thermal rise sync
  S._packIR_bol = R_pack_total_bol * 1000;  // store in mΩ
  S._packIR_eol = R_pack_total_eol * 1000;
  setField('th_ir_bol', R_pack_total_bol.toFixed(4));
  setField('th_ir_eol', R_pack_total_eol.toFixed(4));
  setField('sf_ir', (R_pack_total_bol*1000).toFixed(1));

  setRg('res_results',[
    {l:'R_tab (bulk)',v:(R_tab_bulk*1000).toFixed(4),u:'mΩ'},
    {l:'R_contact (weld)',v:(R_contact*1000).toFixed(4),u:'mΩ'},
    {l:'R_busbar',v:(R_busbar*1000).toFixed(4),u:'mΩ'},
    {l:'R_cell interconnect (pack)',v:(R_pack_interconnect*1000).toFixed(3),u:'mΩ'},
    {l:'R_cell DCiR (pack BoL)',v:(R_cell_dcir*1000).toFixed(3),u:'mΩ'},
    {l:'R_pack TOTAL BoL',v:(R_pack_total_bol*1000).toFixed(3),u:'mΩ',c:'ok'},
    {l:'R_pack TOTAL EoL',v:(R_pack_total_eol*1000).toFixed(3),u:'mΩ',c:'warn'},
    {l:'EoL/BoL ratio',v:(R_pack_total_eol/R_pack_total_bol).toFixed(2),u:'×',c:'neutral'},
  ]);

  const rows=[
    ['Cell DCiR (BoL)', (R_cell_dcir*1000).toFixed(3), `${Ss}S/${Pp}P × ${S.c_ir_bol} mΩ`,'Cells'],
    ['Tab Bulk', (R_tab_bulk*1000).toFixed(4), `ρ=${(rho_tab*1e8).toFixed(2)}×10⁻⁸ Ω·m`, tabmat],
    ['Contact (weld)', (R_contact*1000).toFixed(4), `Kc=${Kc}, Ks=${Ks}, Kp=${Kp}, Kw=${Kw}`,'Interface'],
    ['Busbar', (R_busbar*1000).toFixed(4), `${bbL*1000}×${bbW*1000}×${bbT*1000}mm`+` ${bbmat}`,'Interconnect'],
    ['Screw contacts', (R_screw*1000).toFixed(4), `${nscrew} × 0.1mΩ`,'Contacts'],
    ['HV Connectors', (R_hvcontact*1000).toFixed(4), `${ncontact} × 0.02mΩ`,'Terminals'],
    ['Shunt', (getV('res_shunt')).toFixed(3), 'Current sensor','Shunt'],
    ['TOTAL BoL', (R_pack_total_bol*1000).toFixed(3), '',''],
    ['TOTAL EoL', (R_pack_total_eol*1000).toFixed(3), `Cell EoL DCiR = ${S.c_ir_eol} mΩ`,''],
  ];
  let t=`<table><tr><th>Component</th><th>R (mΩ)</th><th>Basis</th><th>Category</th></tr>`;
  rows.forEach(r=>t+=`<tr style="${r[0].includes('TOTAL')?'font-weight:600;background:var(--s2)':''}"><td>${r[0]}</td><td>${r[1]}</td><td style="font-size:9px;color:var(--m)">${r[2]}</td><td><small style="color:var(--dm)">${r[3]}</small></td></tr>`);
  const _rbd=document.getElementById('res_breakdown');if(_rbd)_rbd.innerHTML=t+'</table>';

  const mats=[['Al 1060',2.37,0.0039,'Tab Al'],['Al 1100',2.82,0.0039,'Tab Al'],['Cu OFC',1.68,0.00393,'Busbar Cu'],['Cu T2',1.72,0.00393,'Busbar Cu'],['Ni 200',9.5,0.006,'Plating']];
  let mt=`<table><tr><th>Material</th><th>ρ (×10⁻⁸ Ω·m)</th><th>α (1/K)</th><th>Typical Use</th></tr>`;
  mats.forEach(m=>mt+=`<tr><td>${m[0]}</td><td>${m[1]}</td><td>${m[2]}</td><td style="color:var(--m);font-size:10px">${m[3]}</td></tr>`);
  const _rmr = document.getElementById('res_matref');
  if (_rmr) _rmr.innerHTML=(()=>{
    let t='<table><tr><th>Material</th><th>ρ(×10⁻⁸)</th><th>%IACS</th><th>α(1/K)</th><th>λ(W/m·K)</th><th>ρ_d(g/cm³)</th><th>EV Use</th></tr>';
    const mats=[
      ['Cu ETP C11000',1.72,100,0.0039,395,8.96,'Main busbars'],
      ['Cu OFC C10100',1.68,101,0.00393,400,8.94,'High-end EV packs'],
      ['Cu T2',1.72,99,0.00393,390,8.90,'Battery modules'],
      ['CuAg 0.1%',1.75,97,0.0039,390,8.90,'High-temp busbars'],
      ['CuCrZr',2.10,85,0.0039,320,8.90,'Weld zones'],
      ['Tin-plated Cu',1.78,95,0.0039,380,8.90,'Corrosion protect'],
      ['Ni-plated Cu',1.85,92,0.004,350,8.90,'High-temp'],
      ['Al 6101-T6',3.20,58,0.004,215,2.70,'EV battery packs'],
      ['Al 6061-T6',4.00,40,0.004,167,2.70,'Structural'],
      ['Al 1050/1350',2.90,61,0.004,230,2.70,'Power distribution'],
      ['Al 3003',4.10,42,0.004,190,2.73,'Corrosion envir.'],
      ['CCA',2.70,65,0.004,'~180',3.60,'Weight balance'],
      ['Laminated Cu flex',1.72,100,0.0039,390,8.90,'Flex interconnects'],
      ['Cu+Ni multilayer',1.85,92,0.004,350,8.90,'BMS connections'],
    ];
    mats.forEach(m=>t+=`<tr><td style="font-weight:500">${m[0]}</td><td>${m[1]}</td><td>${m[2]}</td><td>${m[3]}</td><td>${m[4]}</td><td>${m[5]}</td><td style="color:var(--m);font-size:9px">${m[6]}</td></tr>`);
    return t+'</table>';
  })()

  let et=`<table><tr><th>Condition</th><th>R_pack (mΩ)</th><th>I²R @200A (W)</th><th>V_drop @200A (V)</th></tr>`;
  [['BoL',R_pack_total_bol],['EoL',R_pack_total_eol]].forEach(([n,R])=>
    et+=`<tr><td>${n}</td><td>${(R*1000).toFixed(3)}</td><td>${(200**2*R).toFixed(1)}</td><td>${(200*R).toFixed(3)}</td></tr>`);
  const _rbe=document.getElementById('res_bol_eol');if(_rbe)_rbe.innerHTML=et+'</table>';
}

// ═══════════════════════════════════════════════════════
// PRECHARGE
// ═══════════════════════════════════════════════════════
function calcPrecharge() {
