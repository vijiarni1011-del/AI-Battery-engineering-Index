// ═══════════════════════════════════════════════════════
// POWER MAP
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// SAFETY
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// GAP ANALYSIS
// ═══════════════════════════════════════════════════════
const GAP_ITEMS=[
  {cat:'Cell Data',id:'gap_celldata',label:'Cell datasheet (V, Ah, IR, Cp)',req:true,available:true},
  {cat:'Cell Data',id:'gap_ocvcurve',label:'Full OCV–SoC curve (10+ points)',req:true,available:false},
  {cat:'Cell Data',id:'gap_dcir_map',label:'DCIR vs SoC/Temperature map',req:true,available:false},
  {cat:'Cell Data',id:'gap_peukert',label:'Capacity vs C-rate (Peukert curve)',req:true,available:false},
  {cat:'Cell Data',id:'gap_cycle_curve',label:'Capacity fade curve (SoH vs cycles)',req:true,available:false},
  {cat:'Pack Design',id:'gap_cad',label:'Pack CAD / space claim envelope',req:true,available:false},
  {cat:'Pack Design',id:'gap_busbar',label:'Busbar design (CSA, creepage)',req:true,available:false},
  {cat:'Pack Design',id:'gap_thermal_model',label:'Thermal resistance network (Rth)',req:true,available:false},
  {cat:'Thermal',id:'gap_duty_cycle',label:'Drive / work cycle duty profile',req:true,available:false},
  {cat:'Thermal',id:'gap_coolant_dp',label:'Cooling plate pressure drop curve',req:false,available:false},
  {cat:'Electrical',id:'gap_charge_curve',label:'CC-CV charge profile',req:true,available:false},
  {cat:'Electrical',id:'gap_hv_arch',label:'HV electrical architecture diagram',req:true,available:false},
  {cat:'Electrical',id:'gap_precharge',label:'Precharge design (R, C)',req:true,available:true},
  {cat:'BMS',id:'gap_soc_algo',label:'SoC estimation algorithm design',req:true,available:false},
  {cat:'BMS',id:'gap_soh_algo',label:'SoH estimation model',req:true,available:false},
  {cat:'BMS',id:'gap_sop',label:'SoP (State of Power) calculation',req:false,available:false},
  {cat:'BMS',id:'gap_balancing',label:'Cell balancing strategy & energy',req:true,available:false},
  {cat:'BMS',id:'gap_faults',label:'Fault thresholds (OV/UV/OT/OC)',req:true,available:false},
  {cat:'Safety',id:'gap_fmea',label:'FMEA / Safety analysis',req:true,available:false},
  {cat:'Safety',id:'gap_thermal_runaway',label:'Thermal runaway prevention design',req:true,available:false},
  {cat:'Safety',id:'gap_imd',label:'IMD (Insulation monitoring) design',req:true,available:false},
  {cat:'Regulatory',id:'gap_un383',label:'UN 38.3 test plan',req:true,available:false},
  {cat:'Regulatory',id:'gap_62619',label:'IEC 62619 test protocol',req:true,available:false},
  {cat:'Regulatory',id:'gap_functional_safety',label:'Functional safety analysis (ISO 25119/26262)',req:app=>app==='offhighway'||app==='onroad',available:false},
  {cat:'Business',id:'gap_bom',label:'BOM cost breakdown (cell/BMS/housing/TMS)',req:false,available:false},
  {cat:'Business',id:'gap_tco',label:'TCO vs alternative (diesel/diesel-electric)',req:false,available:false},
];

function loadDutyCycle(input) {
  const f=input.files[0]; if(!f)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const lines=e.target.result.split('\n').filter(l=>l.trim());
    let Ptotal=0,count=0;
    lines.slice(1).forEach(l=>{const [t,p]=l.split(',');if(!isNaN(+p)){Ptotal+=+p;count++;}});
    const Pavg=count>0?Ptotal/count:0;
    // Update thermal-section element (renamed to avoid duplicate ID)
    const tdr = document.getElementById('th_duty_result');
    if(tdr){tdr.style.display='block';tdr.textContent=`✓ Loaded ${count} points · Avg power: ${Pavg.toFixed(1)} kW`;}
    // Update gap-section element
    const tdi = document.getElementById('th_duty_info');
    if(tdi){tdi.textContent=`✓ Loaded ${count} points · Avg power: ${Pavg.toFixed(1)} kW`;}
    setField('curr_phyd', Pavg.toFixed(1));
    calcThermal();
  };
  reader.readAsText(f);
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
// Init handled by QA_AGENT load listener below

// ── APP CARD SELECTOR ──
function selectApp(card) {
  document.querySelectorAll('.app-card').forEach(c=>c.classList.remove('selected'));
  card.classList.add('selected');
  const v = card.dataset.val;
  document.getElementById('t_app').value = v;
  S.app = v;
  // Apply preset only on fresh project — guard against resetting saved data
  const _p = document.getElementById('t_proj')?.value || '';
  const _fresh = _p.trim() === '' || _p.trim() === 'PRJ-001';
  const _hasSave = (() => { try { return !!localStorage.getItem(typeof PERSIST_KEY!=='undefined'?PERSIST_KEY:'battmis_v1'); } catch(e){return false;} })();
  if (_fresh && !_hasSave) { applyVehiclePreset(v); }
  // refresh regulatory
  if(document.getElementById('sf_regs')) calcSafety();
  updateGap();
  // Update current tab labels for vehicle type
  const mainLabel = document.getElementById('curr_main_drive_label');
  const tracLabel = document.getElementById('curr_traction_label');
  if(mainLabel) {
    const labels = {
      '2W':'(Not applicable — 2W uses traction only)',
      '4W':'EPS / Accessories motor (kW)',
      'Bus':'Accessories / compressor motor (kW)',
      'Truck':'EPS / PTO pump (kW)',
      'Excavator':'Hydraulic pump motor output (kW)',
      'WheelLoader':'Hydraulic pump motor output (kW)',
      'AgTractor':'PTO + hydraulic lift motor (kW)',
      'Industrial':'Lift hydraulic motor output (kW)',
    };
    mainLabel.textContent = labels[v] || 'Main Drive Output (kW)';
  }
  if(tracLabel) {
    const tlabels = {
      '2W':'Traction motor output (kW)',
      '4W':'Traction motor(s) output (kW)',
      'Bus':'Traction motor output (kW)',
      'Truck':'Traction motor output (kW)',
      'Excavator':'Travel/swing motor output (kW)',
      'WheelLoader':'Travel motor output (kW)',
      'AgTractor':'4WD travel motor output (kW)',
      'Industrial':'Drive motor output (kW)',
    };
    tracLabel.textContent = tlabels[v] || 'Traction / Propulsion (kW)';
  }
  calcCurrent();
}

// ── STANDARDS DATABASE (300 standards — full data from Master_Standard_List.xlsx) ──
const STDS=[
  {"n":"ISO 6469-1:2019","b":"ISO","t":"Electrically propelled road vehicles — Safety specs — Part 1: REESS","c":"Safety","lv":"Pack/System","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Core REESS safety — universally applicable"},
  {"n":"ISO 6469-2:2022","b":"ISO","t":"Electrically propelled road vehicles — Safety specs — Part 2: Operational safety","c":"Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Operational safety, HV interlock, isolation"},
  {"n":"ISO 6469-3:2021","b":"ISO","t":"Electrically propelled road vehicles — Safety specs — Part 3: Electrical safety","c":"Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Protection against electrical shock"},
  {"n":"ISO 6469-4:2015","b":"ISO","t":"Electrically propelled road vehicles — Safety specs — Part 4: Post-crash electri","c":"Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"4W,Bus,Truck","p":"MUST","note":"Post-crash HV isolation testing"},
  {"n":"ISO 12405-1:2011","b":"ISO","t":"Li-ion traction battery packs — Part 1: High-power applications (HEV)","c":"Performance","lv":"Module/Pack","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"HEV traction battery pack performance"},
  {"n":"ISO 12405-2:2012","b":"ISO","t":"Li-ion traction battery packs — Part 2: High-energy applications (BEV)","c":"Performance","lv":"Module/Pack","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"BEV traction battery pack performance"},
  {"n":"ISO 12405-3:2014","b":"ISO","t":"Li-ion traction battery packs — Part 3: Safety performance requirements","c":"Safety","lv":"Module/Pack","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Pack safety — overcharge, short-circuit, crush"},
  {"n":"ISO 12405-4:2018","b":"ISO","t":"Li-ion traction battery packs — Part 4: Performance testing (consolidated)","c":"Performance","lv":"Module/Pack","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Replaces Parts 1&2 — consolidated test methods"},
  {"n":"ISO 26262-1:2018","b":"ISO","t":"Road vehicles — Functional safety — Part 1: Vocabulary","c":"Func Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"4W,Bus,Truck,2W","p":"MUST","note":"ASIL functional safety vocabulary"},
  {"n":"ISO 26262-2:2018","b":"ISO","t":"Road vehicles — Functional safety — Part 2: Management of functional safety","c":"Func Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"4W,Bus,Truck","p":"MUST","note":"Safety management lifecycle"},
  {"n":"ISO 26262-3:2018","b":"ISO","t":"Road vehicles — Functional safety — Part 3: Concept phase","c":"Func Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"4W,Bus,Truck","p":"MUST","note":"ITEM definition, HARA"},
  {"n":"ISO 26262-4:2018","b":"ISO","t":"Road vehicles — Functional safety — Part 4: System level development","c":"Func Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"4W,Bus,Truck","p":"MUST","note":"System-level safety requirements"},
  {"n":"ISO 26262-5:2018","b":"ISO","t":"Road vehicles — Functional safety — Part 5: Hardware development","c":"Func Safety","lv":"Module/Pack","m":"EU,IN,JP,KR,CA,USA","v":"4W,Bus,Truck","p":"MUST","note":"HW safety requirements (BMS hardware)"},
  {"n":"ISO 26262-6:2018","b":"ISO","t":"Road vehicles — Functional safety — Part 6: Software development","c":"Func Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"4W,Bus,Truck","p":"MUST","note":"SW safety requirements (BMS software)"},
  {"n":"ISO 26262-9:2018","b":"ISO","t":"Road vehicles — Functional safety — Part 9: ASIL and safety analyses","c":"Func Safety","lv":"System","m":"EU,JP,KR,CA,USA","v":"4W,Bus,Truck","p":"SHOULD","note":"FMEA, FTA, FMEDA analysis"},
  {"n":"ISO 25119-1:2018","b":"ISO","t":"Tractors & ag/forestry machinery — Safety-related control systems — Part 1: Gene","c":"Func Safety","lv":"System","m":"EU,IN,JP,CA,USA","v":"Excavator,WheelLoader,AgTractor,Industrial","p":"MUST","note":"AgPL functional safety — off-highway key"},
  {"n":"ISO 25119-2:2018","b":"ISO","t":"Tractors & ag/forestry machinery — Safety-related control systems — Part 2: Conc","c":"Func Safety","lv":"System","m":"EU,IN,JP,CA,USA","v":"Excavator,WheelLoader,AgTractor,Industrial","p":"MUST","note":"Off-highway safety concept phase"},
  {"n":"ISO 25119-3:2018","b":"ISO","t":"Tractors & ag/forestry machinery — Safety-related control systems — Part 3: HW/S","c":"Func Safety","lv":"System","m":"EU,IN,JP,CA,USA","v":"Excavator,WheelLoader,AgTractor,Industrial","p":"MUST","note":"HW/SW dev for off-highway"},
  {"n":"ISO 25119-4:2018","b":"ISO","t":"Tractors & ag/forestry machinery — Safety-related control systems — Part 4: Prod","c":"Func Safety","lv":"System","m":"EU,IN,JP,CA,USA","v":"Excavator,WheelLoader,AgTractor,Industrial","p":"MUST","note":"Production phase safety"},
  {"n":"ISO 13849-1:2023","b":"ISO","t":"Safety of machinery — Safety-related parts of control systems — Part 1: Design","c":"Func Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"Excavator,WheelLoader,Industrial","p":"MUST","note":"PL-based machinery safety — off-highway"},
  {"n":"ISO 13849-2:2012","b":"ISO","t":"Safety of machinery — Safety-related parts — Part 2: Validation","c":"Func Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"Excavator,WheelLoader,Industrial","p":"MUST","note":"Safety function validation"},
  {"n":"ISO 12100:2010","b":"ISO","t":"Safety of machinery — General principles for design — Risk assessment","c":"Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"Excavator,WheelLoader,AgTractor,Industrial","p":"MUST","note":"Risk assessment for all machinery"},
  {"n":"ISO 21434:2021","b":"ISO","t":"Road vehicles — Cybersecurity engineering","c":"Cybersecurity","lv":"System","m":"EU,JP,KR,CA,USA","v":"4W,Bus,Truck","p":"SHOULD","note":"Cybersecurity for connected EV systems"},
  {"n":"ISO 21448:2022","b":"ISO","t":"Road vehicles — Safety of the intended functionality (SOTIF)","c":"Func Safety","lv":"System","m":"EU,JP,CA,USA","v":"4W,Bus,Truck","p":"SHOULD","note":"SOTIF — ADAS/automated driving"},
  {"n":"ISO 17409:2020","b":"ISO","t":"Electrically propelled road vehicles — Connection to external electrical power s","c":"Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Charging connection safety"},
  {"n":"ISO 15118-1:2019","b":"ISO","t":"Road vehicles — V2G communication interface — Part 1: General and use cases","c":"Communication","lv":"System","m":"EU,JP,KR,CA,USA","v":"4W,Bus,Truck","p":"SHOULD","note":"V2G communication protocol"},
  {"n":"ISO 15118-2:2022","b":"ISO","t":"Road vehicles — V2G communication interface — Part 2: Network and application pr","c":"Communication","lv":"System","m":"EU,JP,KR,CA,USA","v":"4W,Bus,Truck","p":"SHOULD","note":"V2G network layer"},
  {"n":"ISO 15118-20:2022","b":"ISO","t":"Road vehicles — V2G communication interface — Part 20: 2nd gen bidirectional cha","c":"Communication","lv":"System","m":"EU,JP,KR","v":"4W,Bus,Truck","p":"SHOULD","note":"V2G 2nd gen — bidirectional charging"},
  {"n":"ISO 18243:2017","b":"ISO","t":"Electrically propelled mopeds & motorcycles — Li-ion battery systems","c":"Performance","lv":"Pack","m":"EU,IN,JP,KR","v":"2W","p":"MUST","note":"Li-ion battery systems for 2-wheelers"},
  {"n":"ISO 18300:2017","b":"ISO","t":"Electrically propelled mopeds & motorcycles — Safety requirements","c":"Safety","lv":"System","m":"EU,IN,JP,KR","v":"2W","p":"MUST","note":"2-wheeler EV complete vehicle safety"},
  {"n":"ISO 23823:2022","b":"ISO","t":"Earth-moving machinery — Tests for electric and hybrid-electric machines","c":"Performance","lv":"System","m":"EU,JP,CA,USA","v":"Excavator,WheelLoader","p":"MUST","note":"Electric earthmoving performance — direct Yanmar fit"},
  {"n":"ISO 16001:2017","b":"ISO","t":"Earth-moving machinery — Battery-powered machinery — Performance and test requir","c":"Performance","lv":"System","m":"EU,JP,CA,USA","v":"Excavator,WheelLoader,Industrial","p":"MUST","note":"Battery-powered earthmoving — key off-highway"},
  {"n":"ISO 11684:2023","b":"ISO","t":"Tractors & ag/forestry machinery — Safety signs and hazard pictorials","c":"Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"AgTractor","p":"SHOULD","note":"Safety signage — agricultural machinery"},
  {"n":"ISO 4413:2010","b":"ISO","t":"Hydraulic fluid power — General rules and safety requirements","c":"Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"Excavator,WheelLoader","p":"SHOULD","note":"Hydraulic safety — hybrid hydraulic-electric"},
  {"n":"ISO 3691-1:2011","b":"ISO","t":"Industrial trucks — Safety requirements — Part 1: Self-propelled industrial truc","c":"Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"Industrial","p":"MUST","note":"Forklift safety fundamental"},
  {"n":"ISO 3691-4:2023","b":"ISO","t":"Industrial trucks — Safety requirements — Part 4: Driverless industrial trucks","c":"Safety","lv":"System","m":"EU,JP,KR,CA,USA","v":"Industrial","p":"SHOULD","note":"AGV / driverless forklift safety"},
  {"n":"ISO 14982:1998","b":"ISO","t":"Agricultural & forestry machinery — Electromagnetic compatibility","c":"EMC","lv":"System","m":"EU,JP,CA,USA","v":"AgTractor","p":"MUST","note":"EMC for agricultural machinery"},
  {"n":"ISO 11451-1:2015","b":"ISO","t":"Road vehicles — Narrowband radiated electromagnetic energy — Part 1: Vehicle tes","c":"EMC","lv":"System","m":"EU,JP,KR","v":"4W,Bus,Truck","p":"SHOULD","note":"Radiated EMC — vehicle level"},
  {"n":"ISO 11452-1:2015","b":"ISO","t":"Road vehicles — Narrowband radiated EM energy — Part 1: Component test methods","c":"EMC","lv":"Module/Pack","m":"EU,JP,KR","v":"4W,Bus,Truck","p":"SHOULD","note":"EMC component level BMS/pack"},
  {"n":"ISO 11452-2:2019","b":"ISO","t":"Road vehicles — Component EMC test methods — Part 2: Absorber-lined shielded enc","c":"EMC","lv":"Module/Pack","m":"EU,JP,KR","v":"4W,Bus,Truck","p":"SHOULD","note":"EMC test chamber — component level"},
  {"n":"ISO 11452-3:2016","b":"ISO","t":"Road vehicles — Component EMC test methods — Part 3: Transverse EM mode cell","c":"EMC","lv":"Module/Pack","m":"EU,JP,KR","v":"4W,Bus,Truck","p":"OPTIONAL","note":"TEM cell EMC testing"},
  {"n":"ISO 11452-4:2020","b":"ISO","t":"Road vehicles — Component EMC test methods — Part 4: Harness excitation method","c":"EMC","lv":"Module/Pack","m":"EU,JP,KR","v":"4W,Bus,Truck","p":"SHOULD","note":"Bulk current injection — BMS wiring"},
  {"n":"ISO 16750-1:2023","b":"ISO","t":"Road vehicles — Environmental conditions and testing — Part 1: General","c":"Environmental","lv":"Module/Pack","m":"EU,IN,JP,KR","v":"All","p":"MUST","note":"General automotive environmental conditions"},
  {"n":"ISO 16750-2:2023","b":"ISO","t":"Road vehicles — Environmental conditions — Part 2: Electrical loads","c":"Environmental","lv":"Module/Pack","m":"EU,IN,JP,KR","v":"All","p":"MUST","note":"Voltage/current transients — automotive"},
  {"n":"ISO 16750-3:2023","b":"ISO","t":"Road vehicles — Environmental conditions — Part 3: Mechanical loads","c":"Mechanical","lv":"Module/Pack","m":"EU,IN,JP,KR","v":"All","p":"MUST","note":"Vibration/shock — automotive component"},
  {"n":"ISO 16750-4:2023","b":"ISO","t":"Road vehicles — Environmental conditions — Part 4: Climatic loads","c":"Environmental","lv":"Module/Pack","m":"EU,IN,JP,KR","v":"All","p":"MUST","note":"Temperature, humidity — automotive"},
  {"n":"ISO 16750-5:2023","b":"ISO","t":"Road vehicles — Environmental conditions — Part 5: Chemical loads","c":"Environmental","lv":"Module/Pack","m":"EU,IN,JP,KR","v":"All","p":"MUST","note":"Chemical exposure — automotive components"},
  {"n":"ISO 20653:2023","b":"ISO","t":"Road vehicles — IP code — Protection of electrical equipment","c":"Environmental","lv":"Module/Pack","m":"EU,IN,JP,KR","v":"All","p":"MUST","note":"Automotive IP code — pack enclosure"},
  {"n":"ISO 9227:2022","b":"ISO","t":"Corrosion tests in artificial atmospheres — Salt spray tests","c":"Environmental","lv":"Module/Pack","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Salt spray — corrosion and IP validation"},
  {"n":"ISO 6722-1:2011","b":"ISO","t":"Road vehicles — 60V and 600V single-core cables — Part 1","c":"Safety","lv":"Module/Pack","m":"EU,JP,KR","v":"All","p":"MUST","note":"HV cable testing — automotive"},
  {"n":"ISO 19363:2020","b":"ISO","t":"Electrically propelled road vehicles — Wireless power transfer — Safety","c":"Charging","lv":"System","m":"EU,JP","v":"4W","p":"SHOULD","note":"Wireless charging safety ISO"},
  {"n":"ISO 9001:2015","b":"ISO","t":"Quality management systems — Requirements","c":"Quality","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"QMS — required for all production"},
  {"n":"ISO 14001:2015","b":"ISO","t":"Environmental management systems — Requirements","c":"Quality","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"SHOULD","note":"Environmental management system"},
  {"n":"ISO 19453-6:2020","b":"ISO","t":"Road vehicles — Environmental conditions for REESS — Part 6: Battery systems","c":"Environmental","lv":"Pack/System","m":"EU,JP,KR","v":"All","p":"MUST","note":"Environmental conditions specific to REESS"},
  {"n":"ISO 23274-1:2013","b":"ISO","t":"Hybrid-electric road vehicles — Exhaust emissions — Part 1: Non-externally charg","c":"Performance","lv":"System","m":"EU,JP","v":"4W,Bus,Truck","p":"SHOULD","note":"HEV emissions testing"},
  {"n":"ISO 23274-2:2012","b":"ISO","t":"Hybrid-electric road vehicles — Exhaust emissions — Part 2: Externally chargeabl","c":"Performance","lv":"System","m":"EU,JP","v":"4W,Bus,Truck","p":"SHOULD","note":"PHEV emissions and energy consumption"},
  {"n":"ISO 23828:2013","b":"ISO","t":"Fuel cell road vehicles — Energy consumption measurement — Vehicles fuelled with","c":"Performance","lv":"System","m":"EU,JP","v":"4W,Truck","p":"OPTIONAL","note":"Hydrogen/fuel cell vehicle energy consumption"},
  {"n":"ISO 8714:2002","b":"ISO","t":"Electric road vehicles — Reference energy consumption and range — Test procedure","c":"Performance","lv":"System","m":"EU,JP","v":"4W,Bus,Truck","p":"SHOULD","note":"EV range and energy consumption reference"},
  {"n":"ISO 21782-1:2022","b":"ISO","t":"Electrically propelled road vehicles — Test equipment and testing procedures — P","c":"Performance","lv":"System","m":"EU,JP,KR","v":"All","p":"SHOULD","note":"EV test equipment general conditions"},
  {"n":"ISO 21782-2:2022","b":"ISO","t":"Electrically propelled road vehicles — Test equipment — Part 2: Energy measureme","c":"Performance","lv":"System","m":"EU,JP,KR","v":"All","p":"SHOULD","note":"EV energy measurement equipment"},
  {"n":"IEC 62619:2022","b":"IEC","t":"Secondary cells and batteries — Safety requirements — Industrial applications (L","c":"Safety","lv":"Cell/Module","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Industrial Li-ion safety — backbone standard"},
  {"n":"IEC 62620:2014","b":"IEC","t":"Secondary cells and batteries — Secondary lithium cells for industrial applicati","c":"Performance","lv":"Cell/Module","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Industrial Li-ion performance spec"},
  {"n":"IEC 62133-1:2017","b":"IEC","t":"Secondary cells and batteries — Safety requirements — Portable sealed Li-ion — P","c":"Safety","lv":"Cell","m":"EU,IN,JP,KR,CA,USA","v":"2W,Industrial","p":"MUST","note":"Cell safety — portable/light EV Li-ion"},
  {"n":"IEC 62133-2:2017","b":"IEC","t":"Secondary cells and batteries — Safety requirements — Part 2: Lithium systems","c":"Safety","lv":"Cell","m":"EU,IN,JP,KR,CA,USA","v":"2W,Industrial","p":"MUST","note":"Li system safety — small cells"},
  {"n":"IEC 62660-1:2018","b":"IEC","t":"Secondary Li-ion cells for propulsion of electric road vehicles — Part 1: Perfor","c":"Performance","lv":"Cell","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Propulsion cell performance testing"},
  {"n":"IEC 62660-2:2010","b":"IEC","t":"Secondary Li-ion cells for propulsion — Part 2: Reliability and abuse testing","c":"Safety","lv":"Cell","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Cell abuse: thermal, crush, overcharge"},
  {"n":"IEC 62660-3:2016","b":"IEC","t":"Secondary Li-ion cells for propulsion — Part 3: Safety requirements for EV/HEV","c":"Safety","lv":"Cell","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Cell safety for propulsion — HV systems"},
  {"n":"IEC 62660-4:TR:2020","b":"IEC","t":"Secondary Li-ion cells for propulsion — Part 4: Candidate alternative methods fo","c":"Safety","lv":"Cell","m":"EU,JP","v":"All","p":"SHOULD","note":"Tech Report — alternative ISC test methods"},
  {"n":"IEC 61960-3:2022","b":"IEC","t":"Secondary cells and batteries — Secondary lithium cells and batteries for portab","c":"Performance","lv":"Cell","m":"EU,IN,JP,KR,CA,USA","v":"2W,Industrial","p":"MUST","note":"Portable Li-ion cell performance and marking"},
  {"n":"IEC 62281:2019","b":"IEC","t":"Safety of primary and secondary lithium cells and batteries during transport","c":"Transport","lv":"Cell/Module","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Battery transport safety — mandatory all markets"},
  {"n":"IEC 60068-2-1:2007","b":"IEC","t":"Environmental testing — Part 2-1: Test A: Cold","c":"Environmental","lv":"All","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Cold temperature storage and operation"},
  {"n":"IEC 60068-2-2:2007","b":"IEC","t":"Environmental testing — Part 2-2: Test B: Dry heat","c":"Environmental","lv":"All","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Dry heat storage and operation"},
  {"n":"IEC 60068-2-6:2007","b":"IEC","t":"Environmental testing — Part 2-6: Test Fc: Sinusoidal vibration","c":"Mechanical","lv":"All","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Sinusoidal vibration testing"},
  {"n":"IEC 60068-2-14:2009","b":"IEC","t":"Environmental testing — Part 2-14: Test N: Thermal shock","c":"Environmental","lv":"All","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Thermal shock — rapid temp cycling"},
  {"n":"IEC 60068-2-27:2008","b":"IEC","t":"Environmental testing — Part 2-27: Test Ea: Mechanical shock","c":"Mechanical","lv":"All","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Mechanical shock — half-sine, saw-tooth"},
  {"n":"IEC 60068-2-30:2005","b":"IEC","t":"Environmental testing — Part 2-30: Test Db: Damp heat cyclic","c":"Environmental","lv":"All","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Damp heat cycling — 12/12 hr or 24 hr cycle"},
  {"n":"IEC 60068-2-32:2019","b":"IEC","t":"Environmental testing — Part 2-32: Test Ed: Free fall","c":"Mechanical","lv":"All","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"SHOULD","note":"Drop test — free fall from height"},
  {"n":"IEC 60068-2-64:2008","b":"IEC","t":"Environmental testing — Part 2-64: Test Fh: Random vibration — broadband","c":"Mechanical","lv":"All","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Random vibration — off-highway key profile"},
  {"n":"IEC 60068-2-78:2012","b":"IEC","t":"Environmental testing — Part 2-78: Test Cab: Damp heat steady state","c":"Environmental","lv":"All","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Damp heat steady state 85°C/85% RH"},
  {"n":"IEC 60068-2-52:2017","b":"IEC","t":"Environmental testing — Part 2-52: Test Kb: Cyclic salt mist exposure","c":"Environmental","lv":"Module/Pack","m":"EU,JP","v":"All","p":"MUST","note":"Cyclic salt spray — more severe than steady state"},
  {"n":"IEC 60529:2013+AMD2:2013","b":"IEC","t":"Degrees of protection provided by enclosures (IP Code)","c":"Environmental","lv":"Module/Pack","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"IP rating — IP54/65/67/69K for off-highway"},
  {"n":"IEC 60664-1:2020","b":"IEC","t":"Insulation coordination for low-voltage systems — Part 1: Principles, requiremen","c":"Safety","lv":"Module/Pack","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Creepage/clearance — HV insulation design"},
  {"n":"IEC 61851-1:2017","b":"IEC","t":"Electric vehicle conductive charging system — Part 1: General requirements","c":"Charging","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"EV conductive charging — general"},
  {"n":"IEC 61851-21-1:2017","b":"IEC","t":"Electric vehicle conductive charging — Part 21-1: EMC requirements on-board char","c":"EMC","lv":"System","m":"EU,JP,KR","v":"4W,Bus,Truck","p":"MUST","note":"On-board charger EMC requirements"},
  {"n":"IEC 61851-21-2:2021","b":"IEC","t":"Electric vehicle conductive charging — Part 21-2: EMC requirements off-board EVS","c":"EMC","lv":"System","m":"EU,JP,KR","v":"All","p":"SHOULD","note":"Off-board charger EMC"},
  {"n":"IEC 61851-23:2014","b":"IEC","t":"Electric vehicle conductive charging — Part 23: DC EV charging station","c":"Charging","lv":"System","m":"EU,JP,KR","v":"All","p":"MUST","note":"DC fast charging station requirements"},
  {"n":"IEC 61851-24:2014","b":"IEC","t":"Electric vehicle conductive charging — Part 24: Digital communication between DC","c":"Charging","lv":"System","m":"EU,JP,KR","v":"All","p":"SHOULD","note":"DC charging communication protocol"},
  {"n":"IEC 61508-1:2010","b":"IEC","t":"Functional safety of E/E/PE safety-related systems — Part 1: General requirement","c":"Func Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Root functional safety standard"},
  {"n":"IEC 61508-2:2010","b":"IEC","t":"Functional safety — Part 2: Requirements for E/E/PE safety-related systems","c":"Func Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Hardware safety requirements"},
  {"n":"IEC 61508-3:2010","b":"IEC","t":"Functional safety — Part 3: Software requirements","c":"Func Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Software safety requirements"},
  {"n":"IEC 61508-4:2010","b":"IEC","t":"Functional safety — Part 4: Definitions and abbreviations","c":"Func Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"SHOULD","note":"Terminology for functional safety"},
  {"n":"IEC 61508-5:2010","b":"IEC","t":"Functional safety — Part 5: Examples of methods for the determination of safety ","c":"Func Safety","lv":"System","m":"EU,JP,KR","v":"All","p":"SHOULD","note":"SIL determination methods"},
  {"n":"IEC 62061:2021","b":"IEC","t":"Safety of machinery — Functional safety of safety-related control systems","c":"Func Safety","lv":"System","m":"EU,IN,JP,KR,CA,USA","v":"Excavator,WheelLoader,Industrial","p":"MUST","note":"SIL-based machinery functional safety"},
  {"n":"IEC 61000-6-1:2016","b":"IEC","t":"EMC — Part 6-1: Generic immunity — Residential, commercial, light-industrial","c":"EMC","lv":"System","m":"EU,JP,KR","v":"2W,4W","p":"SHOULD","note":"Generic EMC immunity — low duty"},
  {"n":"IEC 61000-6-2:2016","b":"IEC","t":"EMC — Part 6-2: Generic immunity — Industrial environments","c":"EMC","lv":"System","m":"EU,JP,KR","v":"Excavator,WheelLoader,Industrial","p":"MUST","note":"Industrial EMC immunity"},
  {"n":"IEC 61000-6-3:2020","b":"IEC","t":"EMC — Part 6-3: Generic emission — Residential, commercial, light-industrial","c":"EMC","lv":"System","m":"EU,JP,KR","v":"2W,4W","p":"SHOULD","note":"Generic EMC emission"},
  {"n":"IEC 61000-6-4:2018","b":"IEC","t":"EMC — Part 6-4: Generic emission — Industrial environments","c":"EMC","lv":"System","m":"EU,JP,KR","v":"Excavator,WheelLoader,Industrial","p":"MUST","note":"Industrial EMC emission"},
  {"n":"IEC 61000-4-2:2008","b":"IEC","t":"EMC — Part 4-2: ESD immunity test","c":"EMC","lv":"Module/Pack","m":"EU,JP,KR","v":"All","p":"MUST","note":"ESD immunity"},
  {"n":"IEC 61000-4-3:2020","b":"IEC","t":"EMC — Part 4-3: Radiated RF electromagnetic field immunity","c":"EMC","lv":"System","m":"EU,JP,KR","v":"All","p":"MUST","note":"Radiated RF immunity 80MHz-6GHz"},
  {"n":"IEC 61000-4-4:2012","b":"IEC","t":"EMC — Part 4-4: Electrical fast transient/burst immunity","c":"EMC","lv":"Module/Pack","m":"EU,JP,KR","v":"All","p":"MUST","note":"EFT burst immunity — wiring harness"},
  {"n":"IEC 61000-4-5:2017","b":"IEC","t":"EMC — Part 4-5: Surge immunity test","c":"EMC","lv":"Module/Pack","m":"EU,JP,KR","v":"All","p":"MUST","note":"Surge immunity — lightning coupling"},
  {"n":"IEC 61000-4-6:2013","b":"IEC","t":"EMC — Part 4-6: Immunity to conducted disturbances on supply lines","c":"EMC","lv":"Module/Pack","m":"EU,JP,KR","v":"All","p":"MUST","note":"Conducted RF immunity"},
  {"n":"IEC 61000-4-8:2009","b":"IEC","t":"EMC — Part 4-8: Power frequency magnetic field immunity","c":"EMC","lv":"Module/Pack","m":"EU,JP,KR","v":"All","p":"SHOULD","note":"Magnetic field immunity"},
  {"n":"IEC 61000-4-11:2020","b":"IEC","t":"EMC — Part 4-11: Voltage dips, short interruptions and variations immunity","c":"EMC","lv":"System","m":"EU,JP,KR","v":"All","p":"SHOULD","note":"Voltage dip/interruption immunity"},
  {"n":"IEC 62196-1:2022","b":"IEC","t":"Plugs, socket-outlets, vehicle connectors — Part 1: General requirements for EV ","c":"Charging","lv":"System","m":"EU,IN,JP,KR","v":"All","p":"MUST","note":"EV connector Type 2 general — EU/India"},
  {"n":"IEC 62196-2:2022","b":"IEC","t":"Plugs, socket-outlets — Part 2: Dimensional compatibility AC pin connectors","c":"Charging","lv":"System","m":"EU,IN","v":"All","p":"MUST","note":"Type 2 AC connector dimensions"},
  {"n":"IEC 62196-3:2022","b":"IEC","t":"Plugs, socket-outlets — Part 3: DC and AC/DC pin connectors (CCS)","c":"Charging","lv":"System","m":"EU,JP,KR","v":"All","p":"MUST","note":"CCS DC connector — EU CCS2, CHAdeMO ref"},
  {"n":"IEC 61980-1:2020","b":"IEC","t":"Electric vehicle wireless power transfer — Part 1: General requirements","c":"Charging","lv":"System","m":"EU,JP,KR","v":"4W","p":"SHOULD","note":"Wireless EV charging general"},
  {"n":"IEC 62933-2-1:2017","b":"IEC","t":"Electrical energy storage systems — Unit parameters and testing — General spec","c":"Performance","lv":"System","m":"EU,JP","v":"Industrial","p":"SHOULD","note":"ESS unit testing — industrial stationary"},
  {"n":"IEC 62933-5-1:2017","b":"IEC","t":"Electrical energy storage systems — Safety requirements — General spec","c":"Safety","lv":"System","m":"EU,JP","v":"Industrial","p":"MUST","note":"ESS safety — industrial stationary"},
  {"n":"IEC 60479-1:2018","b":"IEC","t":"Effects of current on human beings and livestock — Part 1: General aspects","c":"Safety","lv":"System","m":"EU,JP,KR","v":"All","p":"MUST","note":"HV safety — physiological effects, 0.2J limit"},
  {"n":"IEC 60479-2:2017","b":"IEC","t":"Effects of current on human beings — Part 2: Special aspects","c":"Safety","lv":"System","m":"EU,JP","v":"All","p":"SHOULD","note":"AC current physiological effects"},
  {"n":"IEC 63044-5-1:2017","b":"IEC","t":"Home and Building Electronic Systems — Part 5-1: EMC requirements","c":"EMC","lv":"System","m":"EU,JP","v":"Industrial","p":"OPTIONAL","note":"HBES EMC — stationary industrial applications"},
  {"n":"UNECE R100 Rev.3:2021","b":"UNECE","t":"Approval of vehicles regarding electric power train (M/N category)","c":"Safety","lv":"System","m":"EU,IN,JP,KR","v":"4W,Bus,Truck","p":"MUST","note":"Type approval — 4W/Bus/Truck EV EU mandatory"},
  {"n":"UNECE R136:2014","b":"UNECE","t":"Approval of L-category vehicles — REESS safety requirements","c":"Safety","lv":"System","m":"EU,IN,JP,KR","v":"2W","p":"MUST","note":"Type approval — 2-wheelers L-category"},
  {"n":"UNECE R10 Rev.6:2019","b":"UNECE","t":"Approval regarding electromagnetic compatibility — all vehicles","c":"EMC","lv":"System","m":"EU,IN,JP","v":"All","p":"MUST","note":"EMC type approval — E-mark required EU"},
  {"n":"UN 38.3 Rev.7:2020","b":"UN","t":"UN Manual Tests and Criteria — Li-ion battery transport testing","c":"Transport","lv":"Cell","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Transport safety — mandatory all markets globally"},
  {"n":"GTR No.20 Phase 2:2022","b":"UNECE","t":"UN Global Technical Regulation — Electric vehicle safety (Phase 2)","c":"Safety","lv":"Pack/System","m":"USA,CA,IN","v":"All","p":"SHOULD","note":"Global GTR — USA/Canada/India aligning"},
  {"n":"UNECE R94 Rev.2","b":"UNECE","t":"Front impact — vehicle occupant protection (battery position safety)","c":"Safety","lv":"System","m":"EU","v":"4W,Bus","p":"SHOULD","note":"Crash — battery position protection"},
  {"n":"UNECE R95 Rev.3","b":"UNECE","t":"Side impact — vehicle occupant protection","c":"Safety","lv":"System","m":"EU","v":"4W,Bus","p":"SHOULD","note":"Side crash — battery position protection"},
  {"n":"UNECE R66 Rev.2","b":"UNECE","t":"Strength of large vehicle superstructure — Bus rollover","c":"Safety","lv":"System","m":"EU","v":"Bus","p":"MUST","note":"Bus rollover — battery structural integrity"},
  {"n":"UNECE WP.29 Cybersecurity Regulation 155:2021","b":"UNECE","t":"Cybersecurity management system (CSMS) for vehicle type approval","c":"Cybersecurity","lv":"System","m":"EU,JP,KR","v":"4W,Bus,Truck","p":"SHOULD","note":"CSMS type approval — EU/Japan mandatory 2022"},
  {"n":"UNECE WP.29 Software Update Regulation 156:2021","b":"UNECE","t":"Software update management system (SUMS) for vehicle type approval","c":"Cybersecurity","lv":"System","m":"EU,JP,KR","v":"4W,Bus,Truck","p":"SHOULD","note":"OTA software updates — type approval"},
  {"n":"SAE J2929:2013","b":"SAE","t":"Safety Standard for EV Propulsion Battery Systems — Li-based rechargeable cells","c":"Safety","lv":"Pack","m":"USA,CA,IN,JP","v":"All","p":"MUST","note":"Core SAE EV battery safety standard"},
  {"n":"SAE J2464:2009","b":"SAE","t":"RESS Safety and Abuse Testing — thermal, crush, nail, overcharge, short","c":"Safety","lv":"Pack","m":"USA,CA,JP","v":"All","p":"MUST","note":"Abuse testing — key off-highway requirement"},
  {"n":"SAE J2380:2013","b":"SAE","t":"Vibration Testing of Electric Vehicle Batteries","c":"Mechanical","lv":"Pack","m":"USA,CA,JP","v":"All","p":"MUST","note":"EV battery vibration profile testing"},
  {"n":"SAE J2289:2008","b":"SAE","t":"Electric-Drive Battery Pack System Functional Guidelines","c":"Performance","lv":"Pack","m":"USA,CA","v":"All","p":"MUST","note":"Battery pack functional design guidelines"},
  {"n":"SAE J2288:2008","b":"SAE","t":"Life Cycle Testing of Electric Vehicle Battery Modules","c":"Performance","lv":"Module","m":"USA,CA,JP","v":"All","p":"MUST","note":"Module cycle life test methods"},
  {"n":"SAE J2344:2020","b":"SAE","t":"Guidelines for Electric Vehicle Safety","c":"Safety","lv":"System","m":"USA,CA,JP","v":"All","p":"MUST","note":"General EV safety guidelines"},
  {"n":"SAE J1766:2014","b":"SAE","t":"EV, Fuel Cell and HEV Crash Integrity Testing","c":"Safety","lv":"System","m":"USA,CA","v":"4W,Bus,Truck","p":"MUST","note":"Crash integrity for HV battery systems"},
  {"n":"SAE J1772:2017","b":"SAE","t":"SAE Electric Vehicle Conductive Charge Coupler (AC Level 1/2 + DC)","c":"Charging","lv":"System","m":"USA,CA,JP","v":"All","p":"MUST","note":"AC/DC charge coupler — North America/Japan"},
  {"n":"SAE J2954:2022","b":"SAE","t":"Wireless Power Transfer for Light-Duty Plug-In/Electric Vehicles","c":"Charging","lv":"System","m":"USA,CA,JP","v":"4W","p":"SHOULD","note":"Wireless charging — WPT1/WPT2/WPT3"},
  {"n":"SAE J3105:2023","b":"SAE","t":"Electric Vehicle Power Transfer System Using Conductive Automated Connection Dev","c":"Charging","lv":"System","m":"USA,CA","v":"Bus","p":"MUST","note":"Automated conductive charging — transit buses"},
  {"n":"SAE J3105/1:2020","b":"SAE","t":"Automated connection device — Infrastructure-mounted cross rail connection","c":"Charging","lv":"System","m":"USA,CA","v":"Bus","p":"SHOULD","note":"Bus overhead automated charging interface"},
  {"n":"SAE J3105/2:2020","b":"SAE","t":"Automated connection device — Vehicle roof mount connection","c":"Charging","lv":"System","m":"USA,CA","v":"Bus","p":"SHOULD","note":"Bus roof automated charging interface"},
  {"n":"SAE J3105/3:2020","b":"SAE","t":"Automated connection device — Enclosed pin and socket connection","c":"Charging","lv":"System","m":"USA,CA","v":"Bus","p":"SHOULD","note":"Bus enclosed pin automated charging"},
  {"n":"SAE J2990:2014","b":"SAE","t":"Hybrid and EV First and Second Responder Recommended Practice","c":"Safety","lv":"System","m":"USA,CA","v":"All","p":"SHOULD","note":"Emergency responder safety — HV systems"},
  {"n":"SAE J2910:2019","b":"SAE","t":"Design and Test of Hybrid Electric Trucks and Buses — Electrical Safety","c":"Safety","lv":"System","m":"USA,CA","v":"Truck,Bus","p":"MUST","note":"HV system safety for heavy trucks and buses"},
  {"n":"SAE J3004:2017","b":"SAE","t":"Battery Packaging Requirements for Commercial Vehicles and Buses","c":"General","lv":"Pack","m":"USA,CA","v":"Bus,Truck","p":"MUST","note":"Commercial vehicle battery packaging"},
  {"n":"SAE J3125:2020","b":"SAE","t":"Battery Safety Requirements for Commercial Vehicles and Buses","c":"Safety","lv":"Pack","m":"USA,CA","v":"Bus,Truck","p":"MUST","note":"Commercial bus/truck battery safety"},
  {"n":"SAE J3060:2019","b":"SAE","t":"Vibration Testing of HV Battery Modules and Packs — EV/HEV","c":"Mechanical","lv":"Module/Pack","m":"USA,CA","v":"All","p":"MUST","note":"Updated vibration testing — supersedes J2380"},
  {"n":"SAE J3073:2016","b":"SAE","t":"Thermal Management Systems for Batteries in EVs","c":"Thermal","lv":"Pack","m":"USA,CA","v":"All","p":"MUST","note":"Battery thermal management design guidelines"},
  {"n":"SAE J3178:2021","b":"SAE","t":"Adhesives for Electric Vehicle Battery Systems","c":"Material","lv":"Module/Pack","m":"USA,CA","v":"All","p":"SHOULD","note":"Battery adhesive performance requirements"},
  {"n":"SAE J2950:2020","b":"SAE","t":"Recommended Practice for Transportation of Lithium-Ion Batteries","c":"Transport","lv":"Cell/Module","m":"USA,CA","v":"All","p":"MUST","note":"Li-ion transport — North America 49 CFR reference"},
  {"n":"SAE J2907:2014","b":"SAE","t":"Power Rating Method for Automotive Propulsion Motor and Power Electronics","c":"Performance","lv":"System","m":"USA,CA","v":"All","p":"SHOULD","note":"Motor/inverter power rating method"},
  {"n":"SAE J2847/1:2017","b":"SAE","t":"Communication Between Plug-In Vehicles and the Utility Grid — Part 1","c":"Communication","lv":"System","m":"USA,CA","v":"All","p":"SHOULD","note":"V2G communication North America"},
  {"n":"SAE J2894/1:2020","b":"SAE","t":"Power Quality Requirements for Plug-In Vehicle Chargers — Part 1","c":"Charging","lv":"System","m":"USA,CA","v":"All","p":"SHOULD","note":"Power quality for EV chargers USA"},
  {"n":"SAE J1218:2012","b":"SAE","t":"Minimum Performance Criteria for Emergency Signal Devices Used by Law Enforcemen","c":"Safety","lv":"System","m":"USA,CA","v":"All","p":"OPTIONAL","note":"Emergency signal requirements — vehicle use"},
  {"n":"SAE J1211:1993","b":"SAE","t":"Recommended Environmental Practices for Electronic Equipment — Heavy-Duty Vehicl","c":"Environmental","lv":"Module/Pack","m":"USA,CA","v":"Bus,Truck","p":"MUST","note":"Heavy vehicle environment design spec"},
  {"n":"SAE J1455:2019","b":"SAE","t":"Recommended Environmental Practices — Electronic Equipment in Medium and Heavy-D","c":"Environmental","lv":"Module/Pack","m":"USA,CA","v":"Truck","p":"MUST","note":"Heavy truck environment specification"},
  {"n":"SAE J1797:2008","b":"SAE","t":"Recommended Practice for Packaging of Electric Vehicle Battery Modules","c":"General","lv":"Module","m":"USA,CA","v":"All","p":"SHOULD","note":"Module packaging guidelines"},
  {"n":"SAE J1715:2014","b":"SAE","t":"Hybrid Vehicle (HEV) and Electric Vehicle (EV) Terminology","c":"General","lv":"System","m":"USA,CA,JP","v":"All","p":"OPTIONAL","note":"EV terminology reference"},
  {"n":"SAE J1634:2012","b":"SAE","t":"Battery Electric Vehicle Energy Consumption and Range Test Procedure","c":"Performance","lv":"System","m":"USA,CA","v":"4W,Bus,Truck","p":"MUST","note":"BEV range and energy consumption testing"},
  {"n":"SAE J1711:2010","b":"SAE","t":"Recommended Practice for Measuring Fuel Economy and Emissions — HEV","c":"Performance","lv":"System","m":"USA,CA","v":"4W,Bus,Truck","p":"SHOULD","note":"HEV fuel economy and emissions measurement"},
  {"n":"SAE J2946:2014","b":"SAE","t":"Battery Electronic Fuel Gauging Recommended Practice","c":"Performance","lv":"Module/Pack","m":"USA,CA","v":"All","p":"SHOULD","note":"SOC fuel gauge requirements"},
  {"n":"SAE J2953:2018","b":"SAE","t":"Plug-In Electric Vehicle (PEV) Interoperability with Electric Vehicle Supply Equ","c":"Charging","lv":"System","m":"USA,CA","v":"4W,Bus,Truck","p":"MUST","note":"EV-EVSE interoperability testing"},
  {"n":"SAE J2997:2014","b":"SAE","t":"End-of-Life Battery Recycling — Usability Information Report","c":"Lifecycle","lv":"Pack","m":"USA,CA","v":"All","p":"OPTIONAL","note":"EOL battery recycling guidelines"},
  {"n":"SAE J3097:2018","b":"SAE","t":"Recommended Practice for Wireless Charging Interoperability — Light-Duty EV","c":"Charging","lv":"System","m":"USA,CA","v":"4W","p":"SHOULD","note":"Wireless charging interoperability"},
  {"n":"SAE J3207:2020","b":"SAE","t":"Large Format Electric Vehicle Battery Module/Pack — Dimensional Specifications","c":"General","lv":"Module/Pack","m":"USA,CA","v":"All","p":"OPTIONAL","note":"Large format battery dimensional specs"},
  {"n":"SAE J1113:2021","b":"SAE","t":"Electromagnetic Compatibility Measurement Procedures — Vehicles","c":"EMC","lv":"System","m":"USA,CA","v":"4W,Bus,Truck","p":"SHOULD","note":"SAE EMC measurement procedure — vehicles"},
  {"n":"UL 2580:2020","b":"UL","t":"Batteries for Use in Electric Vehicles","c":"Safety","lv":"Pack","m":"USA,CA","v":"All","p":"MUST","note":"UL EV battery pack certification — North America"},
  {"n":"UL 1642:2012","b":"UL","t":"Lithium Batteries (Cell Level)","c":"Safety","lv":"Cell","m":"USA,CA","v":"All","p":"MUST","note":"UL cell-level Li-ion safety"},
  {"n":"UL 2271:2018","b":"UL","t":"Batteries for Use in Light Electric Vehicle (LEV) Applications","c":"Safety","lv":"Pack","m":"USA,CA","v":"2W,Industrial","p":"MUST","note":"LEV battery — e-bike, forklift 48V-96V"},
  {"n":"UL 9540:2020","b":"UL","t":"Standard for Energy Storage Systems and Equipment","c":"Safety","lv":"System","m":"USA,CA","v":"Industrial","p":"MUST","note":"ESS fire safety — industrial systems"},
  {"n":"UL 9540A:2019","b":"UL","t":"Test Method for Evaluating Thermal Runaway Fire Propagation in Battery ESS","c":"Safety","lv":"System","m":"USA,CA","v":"Industrial","p":"MUST","note":"Thermal runaway propagation — authority adopted"},
  {"n":"UL 1973:2022","b":"UL","t":"Batteries for Stationary, Vehicle Auxiliary Power and Light Electric Rail","c":"Safety","lv":"Pack","m":"USA,CA","v":"Industrial","p":"MUST","note":"Stationary/auxiliary power battery safety"},
  {"n":"UL 2594:2018","b":"UL","t":"Electric Vehicle Supply Equipment","c":"Charging","lv":"System","m":"USA,CA","v":"All","p":"SHOULD","note":"EV charging equipment safety — EVSE"},
  {"n":"UL 508A:2018","b":"UL","t":"Industrial Control Panels","c":"Safety","lv":"System","m":"USA,CA","v":"Industrial","p":"SHOULD","note":"BMS industrial control panel safety"},
  {"n":"UL 2231-1:2002","b":"UL","t":"Personnel Protection Systems for EV Supply Circuits — Part 1: General requiremen","c":"Safety","lv":"System","m":"USA,CA","v":"All","p":"MUST","note":"HV personnel protection — ground fault"},
  {"n":"UL 2231-2:2002","b":"UL","t":"Personnel Protection Systems for EV Supply Circuits — Part 2: Tests","c":"Safety","lv":"System","m":"USA,CA","v":"All","p":"MUST","note":"HV personnel protection testing"},
  {"n":"ASTM E2911:2013","b":"ASTM","t":"Standard Guide for Minimum Performance — Vehicles Using Li-ion Batteries","c":"Safety","lv":"System","m":"USA,CA","v":"All","p":"SHOULD","note":"Vehicle Li-ion battery safety guide"},
  {"n":"ASTM B117:2019","b":"ASTM","t":"Standard Practice for Operating Salt Spray (Fog) Apparatus","c":"Environmental","lv":"Module/Pack","m":"USA,CA","v":"All","p":"MUST","note":"Salt spray — North America test method"},
  {"n":"ASTM D1002:2010","b":"ASTM","t":"Apparent Shear Strength of Single-Lap-Joint Adhesively Bonded Metal Specimens","c":"Material","lv":"Module","m":"USA,CA","v":"All","p":"OPTIONAL","note":"Adhesive shear strength — battery cell bonding"},
  {"n":"ASTM F2132:2020","b":"ASTM","t":"Standard Specification for Electrically Propelled Bicycles","c":"Safety","lv":"System","m":"USA,CA","v":"2W","p":"SHOULD","note":"E-bike safety specification USA"},
  {"n":"ASTM F2711:2019","b":"ASTM","t":"Test Methods for Photovoltaic and Hybrid Energy Storage","c":"Performance","lv":"System","m":"USA","v":"Industrial","p":"OPTIONAL","note":"Hybrid PV-battery energy storage testing"},
  {"n":"AIS-038 Rev.2:2022","b":"AIS/BIS","t":"Traction Battery Safety — M and N Category Vehicles (4W, Bus, Truck)","c":"Safety","lv":"Pack/System","m":"IN","v":"4W,Bus,Truck","p":"MUST","note":"Mandatory India — M/N category battery safety"},
  {"n":"AIS-156:2022","b":"AIS/BIS","t":"REESS Safety — L Category Electric Power Train Vehicles (2W, 3W)","c":"Safety","lv":"Pack/System","m":"IN","v":"2W","p":"MUST","note":"Mandatory India — L category (2W/3W)"},
  {"n":"AIS-039 Rev.1:2015","b":"AIS/BIS","t":"Battery Operated Vehicles — L Category specific requirements","c":"Safety","lv":"System","m":"IN","v":"2W","p":"MUST","note":"L category EV system requirements India"},
  {"n":"AIS-040 Rev.1:2015","b":"AIS/BIS","t":"Battery Operated Vehicles — M and N Category specific requirements","c":"Safety","lv":"System","m":"IN","v":"4W,Bus,Truck","p":"MUST","note":"M/N category EV system requirements India"},
  {"n":"AIS-041 Rev.1:2015","b":"AIS/BIS","t":"Battery Operated Vehicles — Recharging system requirements","c":"Charging","lv":"System","m":"IN","v":"All","p":"MUST","note":"Charging system requirements India"},
  {"n":"AIS-048:2015","b":"AIS/BIS","t":"Safety Requirements for Traction Batteries — Battery Operated Vehicles","c":"Safety","lv":"Pack","m":"IN","v":"All","p":"SHOULD","note":"Earlier traction battery safety India (ref standard)"},
  {"n":"AIS-049 Rev.1:2016","b":"AIS/BIS","t":"Test code for measuring range of battery operated vehicles","c":"Performance","lv":"System","m":"IN","v":"All","p":"MUST","note":"Range testing — India"},
  {"n":"AIS-102 Part 1:2009","b":"AIS/BIS","t":"Hybrid Electric Vehicles — L Category requirements","c":"Safety","lv":"System","m":"IN","v":"2W","p":"SHOULD","note":"HEV L-category India"},
  {"n":"AIS-102 Part 2","b":"AIS/BIS","t":"Hybrid Electric Vehicles — M and N Category requirements","c":"Safety","lv":"System","m":"IN","v":"4W,Bus,Truck","p":"SHOULD","note":"HEV M/N-category India"},
  {"n":"AIS-138 Part 1:2019","b":"AIS/BIS","t":"AC Conductive Charging System — Part 1: General requirements","c":"Charging","lv":"System","m":"IN","v":"All","p":"MUST","note":"AC charging India — BIS mandatory"},
  {"n":"AIS-168:2022","b":"AIS/BIS","t":"Safety Requirements for Electric Tractors and Agricultural Machinery","c":"Safety","lv":"System","m":"IN","v":"AgTractor","p":"MUST","note":"Electric agricultural tractor safety India — critical"},
  {"n":"AIS-174:2023","b":"AIS/BIS","t":"Electric Agricultural Tractors — Battery System requirements","c":"Safety","lv":"Pack","m":"IN","v":"AgTractor","p":"MUST","note":"Battery system for electric tractors India"},
  {"n":"IS 16893-1:2018","b":"AIS/BIS","t":"Secondary Li-ion Cells for Propulsion — Part 1: Performance testing","c":"Performance","lv":"Cell","m":"IN","v":"All","p":"MUST","note":"Cell performance — India mandatory"},
  {"n":"IS 16893-2:2018","b":"AIS/BIS","t":"Secondary Li-ion Cells for Propulsion — Part 2: Reliability and abuse testing","c":"Safety","lv":"Cell","m":"IN","v":"All","p":"MUST","note":"Cell abuse testing — India mandatory"},
  {"n":"IS 16893-3:2018","b":"AIS/BIS","t":"Secondary Li-ion Cells for Propulsion — Part 3: Safety requirements","c":"Safety","lv":"Cell","m":"IN","v":"All","p":"MUST","note":"Cell safety — India mandatory"},
  {"n":"IS 18237:2023","b":"AIS/BIS","t":"Safety of Lithium Cells and Batteries during Transport","c":"Transport","lv":"Cell","m":"IN","v":"All","p":"MUST","note":"India transport safety — lithium cells"},
  {"n":"IS 17017 Series:2021","b":"AIS/BIS","t":"Standard for EV Supply Equipment (EVSE) — India charger standards","c":"Charging","lv":"System","m":"IN","v":"All","p":"MUST","note":"EVSE standard India — BIS mandatory"},
  {"n":"AIS-197:2023","b":"AIS/BIS","t":"Bharat New Car Assessment Program (BNCAP) — crash safety with EV battery","c":"Safety","lv":"System","m":"IN","v":"4W","p":"SHOULD","note":"India NCAP — EV battery crash"},
  {"n":"AIS-123 Part 1","b":"AIS/BIS","t":"Retrofitment of Electrification Kit — 2W and 3W vehicles","c":"Safety","lv":"System","m":"IN","v":"2W","p":"OPTIONAL","note":"Retrofit EV kit India"},
  {"n":"JIS C 8715-1:2018","b":"JIS","t":"Industrial lithium secondary batteries — Part 1: Performance requirements","c":"Performance","lv":"Cell/Module","m":"JP","v":"All","p":"MUST","note":"Industrial Li-ion performance — Japan (IEC 62620)"},
  {"n":"JIS C 8715-2:2019","b":"JIS","t":"Industrial lithium secondary batteries — Part 2: Safety requirements","c":"Safety","lv":"Cell/Module","m":"JP","v":"All","p":"MUST","note":"Industrial Li-ion safety — Japan (IEC 62619)"},
  {"n":"JIS C 8711:2019","b":"JIS","t":"Performance of secondary lithium batteries for portable devices","c":"Performance","lv":"Cell","m":"JP","v":"2W,Industrial","p":"SHOULD","note":"Portable Li-ion performance Japan"},
  {"n":"JIS C 8712:2015","b":"JIS","t":"Safety requirements for secondary lithium batteries — portable devices","c":"Safety","lv":"Cell","m":"JP","v":"2W","p":"SHOULD","note":"Portable Li-ion safety Japan"},
  {"n":"JIS C 8714:2019","b":"JIS","t":"Safety tests for lithium-ion secondary cells for portable electronic application","c":"Safety","lv":"Cell","m":"JP","v":"2W,Industrial","p":"MUST","note":"Crush/short circuit safety — Japan (IEC 62133 ref)"},
  {"n":"JIS C 62133:2020","b":"JIS","t":"Secondary cells and batteries — Safety requirements for portable sealed Li-ion c","c":"Safety","lv":"Cell","m":"JP","v":"2W","p":"MUST","note":"Japan portable Li-ion — IEC 62133 aligned"},
  {"n":"JIS C 8713:2015","b":"JIS","t":"Mechanical property testing of sealed small secondary batteries","c":"Mechanical","lv":"Cell","m":"JP","v":"All","p":"SHOULD","note":"Cell vibration and drop testing Japan"},
  {"n":"JIS D 1601:2012","b":"JIS","t":"Vibration testing methods for automotive parts","c":"Mechanical","lv":"Module/Pack","m":"JP","v":"4W,Bus,Truck","p":"MUST","note":"Automotive vibration Japan — battery pack"},
  {"n":"JIS D 5601:2011","b":"JIS","t":"Electric vehicle battery testing methods","c":"Performance","lv":"Pack","m":"JP","v":"All","p":"MUST","note":"EV battery test methods Japan — fundamental"},
  {"n":"JIS D 0203:2021","b":"JIS","t":"Road vehicles — Electric vehicle (EV) — Terminology and classification","c":"General","lv":"System","m":"JP","v":"All","p":"OPTIONAL","note":"EV terminology — Japan"},
  {"n":"JIS D 1601-1:2012","b":"JIS","t":"Vibration testing methods for automotive electronic systems — Part 1","c":"Mechanical","lv":"Module/Pack","m":"JP","v":"4W","p":"SHOULD","note":"Automotive vibration electronic systems"},
  {"n":"PSE Mark (DENAN Law)","b":"JIS","t":"Electrical Appliance and Material Safety Law — PSE certification for Li-ion batt","c":"Regulatory","lv":"Cell/Module","m":"JP","v":"All","p":"MUST","note":"Mandatory Japan PSE — all Li-ion batteries sold"},
  {"n":"SBA S 1101:2006","b":"JIS","t":"Stationary rechargeable battery safety — Japan Storage Battery Association","c":"Safety","lv":"System","m":"JP","v":"Industrial","p":"SHOULD","note":"Stationary battery Japan — industrial ESS"},
  {"n":"SBA G 0601:2018","b":"JIS","t":"Guide for performance/safety of rechargeable batteries — Japan SBA","c":"General","lv":"Pack","m":"JP","v":"All","p":"OPTIONAL","note":"Japan battery performance/safety guide"},
  {"n":"JISC 9741:2020","b":"JIS","t":"Digital communication for EV charging — CHAdeMO protocol reference","c":"Charging","lv":"System","m":"JP","v":"All","p":"SHOULD","note":"CHAdeMO 2.0 DC fast charge — Japan dominant"},
  {"n":"KS C IEC 62619:2019","b":"KC/KS","t":"Safety requirements for secondary Li cells — industrial applications — Korea","c":"Safety","lv":"Cell/Module","m":"KR","v":"All","p":"MUST","note":"Korea mandatory — aligned to IEC 62619"},
  {"n":"KS C IEC 62620:2015","b":"KC/KS","t":"Secondary lithium cells performance requirements — industrial — Korea","c":"Performance","lv":"Cell/Module","m":"KR","v":"All","p":"MUST","note":"KS performance — industrial Li-ion"},
  {"n":"KS C IEC 62133:2020","b":"KC/KS","t":"Safety requirements for portable sealed secondary Li-ion cells — Korea","c":"Safety","lv":"Cell","m":"KR","v":"2W","p":"MUST","note":"Korea portable Li-ion safety certification"},
  {"n":"KS R ISO 12405-3:2015","b":"KC/KS","t":"Test specification Li-ion traction battery packs — Safety — Korea","c":"Safety","lv":"Pack","m":"KR","v":"All","p":"MUST","note":"Korea traction battery pack safety"},
  {"n":"KC Mark Certification:2024","b":"KC/KS","t":"Korea Certification — Mandatory safety certification for battery products","c":"Regulatory","lv":"Cell/Pack","m":"KR","v":"All","p":"MUST","note":"Mandatory KC mark — all Li-ion batteries sold in Korea"},
  {"n":"KS R 0122:2013","b":"KC/KS","t":"Electric vehicles — Battery system test methods — Korea","c":"Performance","lv":"Pack","m":"KR","v":"4W","p":"MUST","note":"Korea EV battery system test methods"},
  {"n":"KS C 8565:2019","b":"KC/KS","t":"Lithium-ion secondary batteries for electric vehicles — Korea","c":"Performance","lv":"Pack","m":"KR","v":"4W,Bus","p":"MUST","note":"Korea EV Li-ion pack performance standard"},
  {"n":"KBIA-10104-03:2020","b":"KC/KS","t":"Korean Battery Industry Association — Industrial battery safety standard","c":"Safety","lv":"System","m":"KR","v":"Industrial","p":"SHOULD","note":"Korea industrial battery industry standard"},
  {"n":"KS C IEC 61851-1:2018","b":"KC/KS","t":"EV conductive charging system — Part 1: General requirements — Korea","c":"Charging","lv":"System","m":"KR","v":"All","p":"MUST","note":"Korea EV conductive charging"},
  {"n":"KS R IEC 62660-1:2018","b":"KC/KS","t":"Secondary Li-ion cells for propulsion — Part 1: Performance — Korea","c":"Performance","lv":"Cell","m":"KR","v":"All","p":"MUST","note":"Korea propulsion cell performance"},
  {"n":"KS R IEC 62660-2:2018","b":"KC/KS","t":"Secondary Li-ion cells for propulsion — Part 2: Reliability/abuse — Korea","c":"Safety","lv":"Cell","m":"KR","v":"All","p":"MUST","note":"Korea cell abuse testing"},
  {"n":"EU Battery Regulation 2023/1542","b":"EN/CE","t":"EU Battery Regulation — lifecycle, sustainability, safety, carbon footprint, pas","c":"Regulatory","lv":"System","m":"EU","v":"All","p":"MUST","note":"New EU Regulation — replaces Directive 2006/66/EC"},
  {"n":"EN IEC 62133-1:2017","b":"EN/CE","t":"Safety requirements for portable sealed secondary Li-ion cells — Part 1 — EN","c":"Safety","lv":"Cell","m":"EU","v":"2W,Industrial","p":"MUST","note":"EN version IEC 62133 — CE marking"},
  {"n":"EN IEC 62619:2022","b":"EN/CE","t":"Safety requirements for secondary Li cells — industrial applications — EN","c":"Safety","lv":"Cell/Module","m":"EU","v":"All","p":"MUST","note":"EN version IEC 62619 — CE marking industrial"},
  {"n":"EN IEC 62660-1:2018","b":"EN/CE","t":"Li-ion cells for propulsion — Part 1: Performance testing — EN","c":"Performance","lv":"Cell","m":"EU","v":"All","p":"MUST","note":"EN propulsion cell performance — CE"},
  {"n":"EN 50604-1:2016","b":"EN/CE","t":"Secondary lithium batteries for light EVs — Part 1: General safety requirements","c":"Safety","lv":"Pack","m":"EU","v":"2W","p":"MUST","note":"EU light EV (e-bike) battery safety"},
  {"n":"EN 15194:2017+AMD1:2019","b":"EN/CE","t":"Cycles — Electrically power assisted cycles (EPAC) — EPAC bicycles","c":"Safety","lv":"System","m":"EU","v":"2W","p":"MUST","note":"EU e-bike complete vehicle standard — mandatory"},
  {"n":"EN 60204-1:2018","b":"EN/CE","t":"Safety of machinery — Electrical equipment of machines — Part 1: General require","c":"Safety","lv":"System","m":"EU","v":"Excavator,WheelLoader,Industrial","p":"MUST","note":"Machinery electrical safety — off-highway key"},
  {"n":"EU Machinery Directive 2006/42/EC","b":"EN/CE","t":"EU Machinery Directive — Essential health and safety requirements","c":"Regulatory","lv":"System","m":"EU","v":"Excavator,WheelLoader,Industrial,AgTractor","p":"MUST","note":"EU machinery CE marking — currently in force"},
  {"n":"EU Machinery Regulation 2023/1230","b":"EN/CE","t":"New EU Machinery Regulation — replaces Directive 2006/42/EC from 20 Jan 2027","c":"Regulatory","lv":"System","m":"EU","v":"All","p":"SHOULD","note":"Future EU machinery regulation — prepare now"},
  {"n":"EU Low Voltage Directive 2014/35/EU","b":"EN/CE","t":"Low Voltage Directive — electrical equipment 50V–1000V AC / 75V–1500V DC","c":"Regulatory","lv":"System","m":"EU","v":"All","p":"MUST","note":"LVD CE marking for battery systems"},
  {"n":"EU EMC Directive 2014/30/EU","b":"EN/CE","t":"Electromagnetic Compatibility Directive — all electrical products","c":"Regulatory","lv":"System","m":"EU","v":"All","p":"MUST","note":"EMC CE marking requirement"},
  {"n":"RoHS Directive 2011/65/EU","b":"EN/CE","t":"Restriction of Hazardous Substances in EEE — battery materials","c":"Regulatory","lv":"Cell/Module","m":"EU","v":"All","p":"MUST","note":"RoHS compliance — battery materials/chemistry"},
  {"n":"REACH Regulation EC 1907/2006","b":"EN/CE","t":"Registration, Evaluation, Authorisation and Restriction of Chemicals","c":"Regulatory","lv":"Cell","m":"EU","v":"All","p":"MUST","note":"Chemical safety — battery electrolyte, cathode"},
  {"n":"EN ISO 12100:2010","b":"EN/CE","t":"Safety of machinery — General principles — Risk assessment — EN version","c":"Safety","lv":"System","m":"EU","v":"Excavator,WheelLoader,Industrial","p":"MUST","note":"EU machinery risk assessment (ISO 12100 EN)"},
  {"n":"EU WEEE Directive 2012/19/EU","b":"EN/CE","t":"Waste Electrical and Electronic Equipment — battery end of life","c":"Regulatory","lv":"System","m":"EU","v":"All","p":"SHOULD","note":"EOL/recycling directive — battery registration"},
  {"n":"EU Regulation 2019/631","b":"EN/CE","t":"CO2 emission standards for new passenger cars and light commercial vehicles","c":"Regulatory","lv":"System","m":"EU","v":"4W","p":"SHOULD","note":"Fleet CO2 targets — drives EV adoption"},
  {"n":"EN 1175:2020","b":"EN/CE","t":"Industrial trucks — Safety requirements — Electrical requirements for battery-po","c":"Safety","lv":"System","m":"EU","v":"Industrial","p":"MUST","note":"Forklift electrical safety — battery-powered EU"},
  {"n":"EN 50272-3:2003","b":"EN/CE","t":"Safety requirements for secondary batteries — Part 3: Traction batteries","c":"Safety","lv":"Pack","m":"EU","v":"Industrial","p":"MUST","note":"Traction battery safety — forklift/industrial EU"},
  {"n":"FMVSS 305:2012","b":"FMVSS","t":"Electric-powered vehicles: Electrolyte spillage and electrical shock protection","c":"Safety","lv":"System","m":"USA","v":"4W,Bus,Truck","p":"MUST","note":"USA federal motor vehicle safety — crash + HV"},
  {"n":"FMVSS 303:2020","b":"FMVSS","t":"Fuel system integrity — Vehicles with REESS","c":"Safety","lv":"System","m":"USA","v":"4W,Bus,Truck","p":"SHOULD","note":"USA crash energy system integrity"},
  {"n":"NFPA 70 NEC Article 625:2023","b":"NFPA","t":"National Electrical Code — Electric vehicle charging equipment","c":"Charging","lv":"System","m":"USA","v":"All","p":"MUST","note":"USA NEC code for EV charging installations"},
  {"n":"NFPA 855:2023","b":"NFPA","t":"Standard for Installation of Stationary Energy Storage Systems","c":"Safety","lv":"System","m":"USA,CA","v":"Industrial","p":"MUST","note":"Industrial ESS installation safety USA"},
  {"n":"NFPA 72:2022","b":"NFPA","t":"National Fire Alarm and Signaling Code — Battery room monitoring","c":"Safety","lv":"System","m":"USA","v":"Industrial","p":"SHOULD","note":"Fire alarm for battery room installations"},
  {"n":"DOT 49 CFR Part 173.185","b":"DOT","t":"US DOT — Lithium battery transport regulations","c":"Transport","lv":"Cell","m":"USA,CA","v":"All","p":"MUST","note":"USA transport — Li batteries — federal requirement"},
  {"n":"DOT 49 CFR Part 172.102","b":"DOT","t":"Hazardous Materials Regulations — Special provisions for lithium batteries","c":"Transport","lv":"Cell","m":"USA,CA","v":"All","p":"MUST","note":"Hazmat special provisions — batteries USA"},
  {"n":"CAN/CSA-C22.2 No.107.1:2016","b":"CSA","t":"General Use Power Supplies — EV charging equipment — Canada","c":"Charging","lv":"System","m":"CA","v":"All","p":"MUST","note":"Canadian EV charging equipment standard"},
  {"n":"CSA C22.2 No.340:2022","b":"CSA","t":"Rechargeable batteries for use in industrial equipment — Canada","c":"Safety","lv":"Pack","m":"CA","v":"Industrial","p":"MUST","note":"Canada industrial battery safety"},
  {"n":"CAN/ULC-S524:2014","b":"CSA","t":"Standard for Installation of Fire Alarm Systems — Battery rooms","c":"Safety","lv":"System","m":"CA","v":"Industrial","p":"SHOULD","note":"Battery room fire safety Canada"},
  {"n":"GB 38031-2025","b":"GB/T","t":"Electric vehicles traction battery safety requirements (new edition — in force 2","c":"Safety","lv":"Cell/Pack","m":"IN,JP,KR","v":"All","p":"SHOULD","note":"China new mandatory — no fire/no explosion rule. Reference f"},
  {"n":"GB 38031-2020","b":"GB/T","t":"Electric vehicles traction battery safety requirements (current edition)","c":"Safety","lv":"Cell/Pack","m":"IN,JP,KR","v":"All","p":"SHOULD","note":"China mandatory — thermal runaway, vibration, immersion"},
  {"n":"GB/T 31484:2015","b":"GB/T","t":"Cycle life requirements and test methods for Li-ion traction batteries","c":"Performance","lv":"Cell/Pack","m":"IN,JP,KR","v":"All","p":"SHOULD","note":"China cycle life — cell/module/pack levels"},
  {"n":"GB/T 31486-2024","b":"GB/T","t":"Electrical performance requirements and test methods for EV traction batteries","c":"Performance","lv":"Cell/Pack","m":"IN,JP,KR","v":"All","p":"SHOULD","note":"China traction battery performance — April 2024"},
  {"n":"GB/T 31467-1:2015","b":"GB/T","t":"Li-ion traction battery pack and system — Part 1: High power applications","c":"Performance","lv":"Pack","m":"IN,JP,KR","v":"All","p":"SHOULD","note":"China HEV traction battery pack"},
  {"n":"GB/T 31467-2:2015","b":"GB/T","t":"Li-ion traction battery pack and system — Part 2: High energy applications","c":"Performance","lv":"Pack","m":"IN,JP,KR","v":"All","p":"SHOULD","note":"China BEV traction battery pack"},
  {"n":"GB/T 38661-2020","b":"GB/T","t":"Requirements for battery management systems for EV","c":"Performance","lv":"System","m":"IN,JP,KR","v":"All","p":"SHOULD","note":"China BMS requirements — referenced by India/Korea"},
  {"n":"GB 18384-2020","b":"GB/T","t":"Safety requirements for electric vehicles","c":"Safety","lv":"System","m":"IN,JP,KR","v":"4W,Bus,Truck","p":"SHOULD","note":"China mandatory EV vehicle safety"},
  {"n":"GB 38032-2020","b":"GB/T","t":"Electric buses safety requirements","c":"Safety","lv":"System","m":"IN,JP,KR","v":"Bus","p":"SHOULD","note":"China mandatory electric bus safety"},
  {"n":"IATA DGR 67th Ed. (2026)","b":"IATA","t":"Dangerous Goods Regulations — Lithium battery air transport","c":"Transport","lv":"Cell","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Air transport — updated annually — SOC limits new"},
  {"n":"IMDG Code 2024 (Amendment 42-24)","b":"IMDG","t":"International Maritime Dangerous Goods Code — Class 9 lithium batteries","c":"Transport","lv":"Cell","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Sea transport — Li batteries all markets"},
  {"n":"ADR 2025 — Class 9 UN3480/3481","b":"ADR","t":"European Agreement for Dangerous Goods Road Transport — Lithium batteries","c":"Transport","lv":"Cell","m":"EU,IN","v":"All","p":"MUST","note":"Road transport Europe/India — Li battery classification"},
  {"n":"ICAO Technical Instructions 2025-2026","b":"ICAO","t":"Safe Transport of Dangerous Goods by Air — Lithium batteries","c":"Transport","lv":"Cell","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Air transport instructions — ICAO foundation for IATA DGR"},
  {"n":"IEC 62228-1:2018","b":"IEC","t":"Integrated circuits — EMC evaluation — Part 1: General","c":"EMC","lv":"Module","m":"EU,JP","v":"All","p":"OPTIONAL","note":"IC EMC evaluation — BMS chips"},
  {"n":"ISO 26580:2021","b":"ISO","t":"Road vehicles — Methods and general performance requirements for side-facing chi","c":"Safety","lv":"Cell","m":"EU,JP","v":"All","p":"OPTIONAL","note":"Cell internal pressure reference tests"},
  {"n":"IEC 60730-1:2021","b":"IEC","t":"Automatic electrical controls — Part 1: General requirements","c":"Safety","lv":"Module/Pack","m":"EU,JP","v":"Industrial","p":"SHOULD","note":"BMS control system safety — Annex H PTC fuses"},
  {"n":"ISO 15623:2013","b":"ISO","t":"Transport information and control systems — Forward vehicle collision warning sy","c":"Safety","lv":"System","m":"EU,JP","v":"4W,Bus,Truck","p":"OPTIONAL","note":"ADAS collision warning — reference only"},
  {"n":"IEC 62923-1:2018","b":"IEC","t":"Battery system for off-road mobile machines — Part 1: Performance requirements","c":"Performance","lv":"Pack/System","m":"EU,JP,CA,USA","v":"Excavator,WheelLoader,Industrial","p":"MUST","note":"Battery system for off-road machines — direct fit Yanmar"},
  {"n":"IEC 62923-2:2018","b":"IEC","t":"Battery system for off-road mobile machines — Part 2: Safety requirements","c":"Safety","lv":"Pack/System","m":"EU,JP,CA,USA","v":"Excavator,WheelLoader,Industrial","p":"MUST","note":"Safety for off-road mobile machine batteries — direct fit"},
  {"n":"LV 124:2013","b":"LV","t":"Electrical and Electronic Components in Motor Vehicles up to 3.5t — General requ","c":"Safety","lv":"Module","m":"EU,JP","v":"4W","p":"SHOULD","note":"German OEM HV component standard (BMW/VW/Daimler)"},
  {"n":"LV 123:2014","b":"LV","t":"High voltage components in road vehicles — Electrical characteristics and safety","c":"Safety","lv":"Module/Pack","m":"EU,JP","v":"4W","p":"SHOULD","note":"HV component safety — German OEM standard"},
  {"n":"BATSO 01:2012","b":"BATSO","t":"Battery System Safety — Lithium-ion modules and packs for off-road applications","c":"Safety","lv":"Module/Pack","m":"EU,JP,CA,USA","v":"Excavator,WheelLoader,Industrial","p":"MUST","note":"Off-road battery safety — critical for Yanmar machines"},
  {"n":"BATSO 02:2014","b":"BATSO","t":"Battery System Safety — Lithium-ion modules and packs — System level requirement","c":"Safety","lv":"Pack/System","m":"EU,JP,CA,USA","v":"Excavator,WheelLoader,Industrial","p":"MUST","note":"Off-road battery system level safety — Yanmar direct"},
  {"n":"ISO 4210-9:2022","b":"ISO","t":"Cycles — Safety requirements — Part 9: Electrically power-assisted cycles","c":"Safety","lv":"System","m":"EU,IN,JP,KR","v":"2W","p":"MUST","note":"E-bike/EPAC safety — cycles standard"},
  {"n":"EN 50604-2:2020","b":"EN/CE","t":"Secondary lithium batteries for light EVs — Part 2: Stationary use","c":"Safety","lv":"Pack","m":"EU","v":"Industrial","p":"SHOULD","note":"Li battery for stationary/indoor light EV use"},
  {"n":"ISO 6469-5:2022","b":"ISO","t":"Electrically propelled road vehicles — Safety specs — Part 5: Functional safety ","c":"Func Safety","lv":"System","m":"EU,JP,KR","v":"All","p":"MUST","note":"EV functional safety and fault management — new part"},
  {"n":"IEC 62281 Ed.4:2019","b":"IEC","t":"Safety of lithium cells and batteries during transport — comprehensive update","c":"Transport","lv":"Cell/Module","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"MUST","note":"Battery transport safety — all modes consolidated"},
  {"n":"ISO 23629-1:2021","b":"ISO","t":"UAS traffic management — Part 1: General requirements","c":"Safety","lv":"System","m":"EU,JP","v":"Industrial","p":"OPTIONAL","note":"Drone traffic management — industrial UAV battery"},
  {"n":"OSHA 29 CFR 1910.303","b":"OSHA","t":"Electrical — General industry standards — Battery room safety","c":"Safety","lv":"System","m":"USA","v":"Industrial","p":"SHOULD","note":"Workshop/battery room electrical safety USA"},
  {"n":"IEC 62967-1:2020","b":"IEC","t":"Secondary cells for industrial applications — Lithium-ion cells — Part 1: Genera","c":"Safety","lv":"Cell","m":"EU,JP","v":"Industrial","p":"SHOULD","note":"Industrial Li cell general safety — IEC 62967 series"},
  {"n":"ISO 16232:2018","b":"ISO","t":"Road vehicles — Cleanliness of components and systems","c":"Quality","lv":"Module/Pack","m":"EU,JP,KR","v":"All","p":"SHOULD","note":"Component cleanliness — battery pack assembly"},
  {"n":"ISO 26262-10:2018","b":"ISO","t":"Road vehicles — Functional safety — Part 10: Guidelines on ISO 26262 (automotive","c":"Func Safety","lv":"System","m":"EU,JP","v":"4W,Bus,Truck","p":"OPTIONAL","note":"Guidance/informative only — not normative"},
  {"n":"ISO 26262-11:2018","b":"ISO","t":"Road vehicles — Functional safety — Part 11: Guidelines on application to semico","c":"Func Safety","lv":"System","m":"EU,JP","v":"4W,Bus,Truck","p":"OPTIONAL","note":"Semiconductor functional safety guidance"},
  {"n":"ISO 26262-12:2018","b":"ISO","t":"Road vehicles — Functional safety — Part 12: Adaptation for motorcycles","c":"Func Safety","lv":"System","m":"EU,JP","v":"2W","p":"SHOULD","note":"ISO 26262 adaptation for 2-wheelers"},
  {"n":"AIS-131","b":"AIS/BIS","t":"Standard for Pilot Project EVs — Government programs and FAME scheme vehicles","c":"General","lv":"System","m":"IN","v":"All","p":"OPTIONAL","note":"India pilot EV project standard"},
  {"n":"CMVR (Motor Vehicles Act 1988 Rules)","b":"AIS/BIS","t":"Central Motor Vehicle Rules — Type approval for EVs in India","c":"Regulatory","lv":"System","m":"IN","v":"4W,Bus,Truck,2W","p":"MUST","note":"India type approval legal framework — AIS standards enforced"},
  {"n":"IEC 60050-482:2004","b":"IEC","t":"International Electrotechnical Vocabulary — Primary and secondary cells and batt","c":"General","lv":"All","m":"EU,IN,JP,KR,CA,USA","v":"All","p":"OPTIONAL","note":"Terminology reference — IEV for batteries"},
  {"n":"ISO 8820-8:2010","b":"ISO","t":"Road vehicles — Fuse-links — Part 8: Fuse-links with rated voltage of 1000 V DC","c":"Safety","lv":"Module/Pack","m":"EU,JP,KR","v":"All","p":"MUST","note":"HV fuse links — 1000V DC battery circuits"},
  {"n":"IEC 60269-1:2022","b":"IEC","t":"Low-voltage fuses — Part 1: General requirements","c":"Safety","lv":"Module/Pack","m":"EU,JP,KR","v":"All","p":"SHOULD","note":"Fuse protection — HV battery circuits"},
  {"n":"ISO 7637-1:2015","b":"ISO","t":"Road vehicles — Electrical disturbances by conduction and coupling — Part 1: Def","c":"EMC","lv":"Module/Pack","m":"EU,JP,KR","v":"4W,Bus,Truck","p":"MUST","note":"Transient pulse testing — automotive 12V/HV"},
  {"n":"ISO 7637-2:2011","b":"ISO","t":"Road vehicles — Electrical disturbances — Part 2: Slow transient test methods","c":"EMC","lv":"Module/Pack","m":"EU,JP,KR","v":"4W,Bus,Truck","p":"MUST","note":"12V transient pulse tests — BMS supply lines"},
  {"n":"ISO 7637-3:2016","b":"ISO","t":"Road vehicles — Electrical disturbances — Part 3: Electrical transients via capa","c":"EMC","lv":"Module/Pack","m":"EU,JP,KR","v":"4W,Bus,Truck","p":"SHOULD","note":"Capacitive/inductive coupling transients"},
  {"n":"ISO 10605:2008+AMD1:2014","b":"ISO","t":"Road vehicles — Test methods for electrical disturbances from ESD","c":"EMC","lv":"Module/Pack","m":"EU,JP,KR","v":"All","p":"MUST","note":"ESD testing — automotive electronics and BMS"},
  {"n":"IEC 60068-2-7:2020","b":"IEC","t":"Environmental testing — Part 2-7: Test Ga: Acceleration, steady state","c":"Mechanical","lv":"All","m":"EU,JP,KR","v":"All","p":"SHOULD","note":"Steady-state acceleration — g-force testing"},
  {"n":"IEC 60068-2-17:1994","b":"IEC","t":"Environmental testing — Part 2-17: Test Q: Sealing","c":"Environmental","lv":"Module/Pack","m":"EU,JP","v":"All","p":"SHOULD","note":"Enclosure sealing test — hermetic seals"},
  {"n":"IEC 60068-2-31:2008","b":"IEC","t":"Environmental testing — Part 2-31: Test Ec: Rough handling drops and toppling","c":"Mechanical","lv":"Module/Pack","m":"EU,JP","v":"All","p":"SHOULD","note":"Rough handling drops — module/pack assembly"},
  {"n":"IEC 60068-2-38:2021","b":"IEC","t":"Environmental testing — Part 2-38: Test Z/AD: Composite temperature/humidity cyc","c":"Environmental","lv":"Module/Pack","m":"EU,JP,KR","v":"All","p":"MUST","note":"Composite T/H cyclic test — 85°C/85% cycling"},
  {"n":"SAE J2711:2002","b":"SAE","t":"Recommended Practice for Measuring Fuel Economy and Emissions of HEVs","c":"Performance","lv":"System","m":"USA,CA","v":"4W,Bus,Truck","p":"SHOULD","note":"HEV fuel economy measurement SAE"},
  {"n":"IEC 62688-1:2013","b":"IEC","t":"Hybrid propulsion systems for electrically propelled road vehicles — Part 1","c":"Performance","lv":"System","m":"EU,JP","v":"4W,Bus,Truck","p":"SHOULD","note":"Hybrid propulsion system performance"},
  {"n":"ISO 18649:2004","b":"ISO","t":"Mechanical vibration — Evaluation of measurement results from dynamic tests on v","c":"Mechanical","lv":"Module/Pack","m":"EU,JP","v":"All","p":"OPTIONAL","note":"Vibration test machine calibration reference"},
  {"n":"ISO 18649:2004","b":"IEC","t":"Utility-interconnected photovoltaic inverters — Test procedure of islanding prev","c":"Safety","lv":"System","m":"EU,JP","v":"Industrial","p":"OPTIONAL","note":"Anti-islanding — stationary industrial ESS inverter"},
  {"n":"ISO 21782-3:2023","b":"ISO","t":"Electrically propelled road vehicles — Test equipment and testing procedures — P","c":"Safety","lv":"System","m":"EU,JP,KR","v":"All","p":"MUST","note":"Safety during EV battery testing — test lab requirements"}
];

// ── FUNCTIONAL SAFETY CUSTOM ENTRY ──
function toggleFusaCustom() {
  const v = document.getElementById('t_fusa')?.value;
  const cd = document.getElementById('fusa_custom_div');
  if(cd) cd.style.display = v==='custom' ? 'block' : 'none';
}

// ── DATASHEET UPLOAD / PARSE ──
function handleDatasheetUpload(input) {
  const f = input.files[0];
  if(!f) return;
  // Update info in whichever container called this
  const infoId = input.id === 'gap_cell_ds' ? 'gap_cell_ds_info' : 'ds_upload_info';
  const setInfo = msg => { const el=document.getElementById(infoId); if(el) el.textContent=msg; };
  setInfo(`⏳ Reading ${f.name}...`);

  const reader = new FileReader();
  reader.onerror = () => setInfo('⚠ Could not read file — try a .txt or .csv version');
  reader.onload = e => {
    const raw = e.target.result || '';
    const text = raw.replace(/\s+/g,' '); // collapse whitespace for matching

    const tryMatch = (patterns) => {
      for(const p of patterns) {
        try {
          const m = text.match(p);
          if(m && m[1] && !isNaN(parseFloat(m[1]))) return parseFloat(m[1]);
        } catch(_){}
      }
      return null;
    };

    // Capacity / Ah
    const Ah = tryMatch([
      /(?:rated|nominal|typical)\s+capacity[:\s=]+(\d+\.?\d*)\s*Ah/i,
      /(\d+\.?\d*)\s*Ah\s+(?:nominal|rated|typical)/i,
      /capacity[:\s=]+(\d{2,3}\.?\d*)\s*[Aa]/,
      /(\d{2,3})\s*Ah/,
    ]);

    // Nominal voltage
    const Vnom = tryMatch([
      /nominal\s+voltage[:\s=]+(\d+\.?\d*)\s*V/i,
      /(\d+\.?\d*)\s*V\s+nominal/i,
      /nom(?:inal)?\s+volt(?:age)?[:\s=]+(\d+\.?\d*)/i,
    ]);

    // Max (charge cutoff) voltage
    const Vmax = tryMatch([
      /(?:max(?:imum)?|upper|charge\s+cut-?off)\s+voltage[:\s=]+(\d+\.?\d*)\s*V/i,
      /(?:charge|end-of-charge)\s+voltage[:\s=]+(\d+\.?\d*)/i,
      /(\d\.\d{1,2})\s*V\s+(?:max|upper|charge)/i,
    ]);

    // Min (discharge cutoff) voltage
    const Vmin = tryMatch([
      /(?:min(?:imum)?|lower|discharge\s+cut-?off)\s+voltage[:\s=]+(\d+\.?\d*)\s*V/i,
      /discharge\s+(?:end\s+)?voltage[:\s=]+(\d+\.?\d*)/i,
    ]);

    // Mass/weight
    const mass_g = tryMatch([
      /(?:weight|mass)[:\s=]+(\d{3,5}\.?\d*)\s*g/i,
      /(\d{3,5})\s*g\s+(?:typ|max|±)/i,
      /(?:weight|mass)[:\s=]+(\d+\.?\d*)\s*kg/i,
    ]);
    const mass = mass_g ? (mass_g > 100 ? mass_g : mass_g * 1000) : null;  // ensure grams

    // Internal resistance
    const ir = tryMatch([
      /(?:DC)?IR|internal\s+resistance[:\s=]+(\d+\.?\d*)\s*m[Ωω]/i,
      /(?:AC\s+)?impedance[:\s=]+(\d+\.?\d*)\s*m[Ωω]/i,
      /(\d+\.?\d*)\s*m[Ωω]\s+(?:typ|max|@)/i,
    ]);

    // Cell Cp (specific heat) — less common in datasheets, use default if not found
    const cp = tryMatch([
      /specific\s+heat[:\s=]+(\d+\.?\d*)\s*[Jj]/i,
      /heat\s+capacity[:\s=]+(\d+\.?\d*)/i,
    ]);

    // Collect results
    const found = [];
    if(Ah)   { setField('c_ah',    Ah.toFixed(1));     found.push(`Capacity: ${Ah}Ah`);    }
    if(Vnom) { setField('c_vnom',  Vnom.toFixed(3));   found.push(`Vnom: ${Vnom}V`);        }
    if(Vmax) { setField('c_vmax',  Vmax.toFixed(3));   found.push(`Vmax: ${Vmax}V`);        }
    if(Vmin) { setField('c_vmin',  Vmin.toFixed(3));   found.push(`Vmin: ${Vmin}V`);        }
    if(mass) { setField('c_mass',  mass.toFixed(0));   found.push(`Mass: ${mass}g`);        }
    if(ir)   { setField('c_ir_bol',ir.toFixed(3));     found.push(`IR: ${ir}mΩ`);          }
    if(cp)   { setField('c_cp',    cp.toFixed(0));     found.push(`Cp: ${cp}J/kg·K`);      }

    if(found.length > 0) {
      setInfo(`✓ Extracted: ${found.join(' | ')}`);
      // Mark as available in gap analysis
      const cb = document.getElementById('gap_celldata');
      if(cb) { cb.checked = true; }
      propagate();
    } else {
      setInfo(`⚠ Could not auto-parse "${f.name}". File may be a scanned PDF or use non-standard format. Please enter values manually below.`);
    }
  };

  // Try text first; if binary/PDF just note it
  if(f.name.toLowerCase().endsWith('.pdf')) {
    setInfo('ℹ️ PDF detected — auto-extraction limited. Try copy-pasting text into a .txt file, or enter values manually.');
    reader.readAsText(f);  // attempt anyway — works for text-based PDFs
  } else {
    reader.readAsText(f);
  }
}

function handleOCVUpload(input) {
  const f = input.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l=>l.trim());
    const pts = [];
    lines.forEach(l => {
      const [soc, ocv] = l.split(/[,\t;]/);
      if(!isNaN(+soc) && !isNaN(+ocv)) pts.push({soc:+soc, ocv:+ocv});
    });
    if(pts.length >= 2) {
      const closest = (arr, target) => arr.reduce((a,b) => Math.abs(b.soc-target)<Math.abs(a.soc-target)?b:a);
      const p10=closest(pts,10), p50=closest(pts,50), p90=closest(pts,90), p100=closest(pts,100);
      setField('c_ocv10', p10.ocv.toFixed(3));
      setField('c_ocv50', p50.ocv.toFixed(3));
      setField('c_ocv90', p90.ocv.toFixed(3));
      setField('c_ocv100', p100.ocv.toFixed(3));
      // Populate new 4-column table
      const tbody = document.getElementById('ocv_table_body');
      if(tbody) {
        const inp = (val, col, rgb, cls) =>
          `<input type="number" class="${cls}" value="${val}" step="0.01"
            style="width:76px;padding:5px 8px;background:rgba(${rgb},.07);border:1px solid rgba(${rgb},.35);border-radius:5px;color:${col};font-family:var(--mono);font-size:13px;font-weight:700;text-align:center"
            oninput="drawOCVCanvas()">`;
        tbody.innerHTML = pts.map(p => {
          const v25 = p.ocv.toFixed(3);
          const vtmin = (p.ocv * 0.960).toFixed(3);
          const v0    = (p.ocv * 0.985).toFixed(3);
          const vtmax = (p.ocv * 1.008).toFixed(3);
          return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:8px 14px;font-family:var(--mono);font-size:13px;font-weight:700;color:var(--text2)">${p.soc}</td>
            <td style="padding:5px 8px;text-align:center">${inp(vtmin,'#4a9eff','74,158,255','ocv-vtmin')}</td>
            <td style="padding:5px 8px;text-align:center">${inp(v0,'#00d4aa','0,212,170','ocv-v0')}</td>
            <td style="padding:5px 8px;text-align:center">${inp(v25,'#f5c518','245,197,24','ocv-v25')}</td>
            <td style="padding:5px 8px;text-align:center">${inp(vtmax,'#ff4d6d','255,77,109','ocv-vtmax')}</td>
            <td style="padding:4px 6px"><button onclick="this.closest('tr').remove();drawOCVCanvas()"
              style="padding:2px 6px;background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.3);color:var(--r);border-radius:3px;cursor:pointer;font-size:11px">✕</button></td>
          </tr>`;
        }).join('');
      }
      const msg = `✓ ${pts.length} OCV points loaded`;
      const el1 = document.getElementById('ocv_upload_info'); if(el1) el1.textContent = msg;
      const el2 = document.getElementById('gap_ocv_upload_info'); if(el2) el2.textContent = msg;
      drawOCVCanvas(); propagate();
    } else {
      const msg = '⚠ Could not parse CSV — format: soc%, ocv_V';
      const el1 = document.getElementById('ocv_upload_info'); if(el1) el1.textContent = msg;
    }
  };
  reader.readAsText(f);
}

// ── STANDARDS FILTER ──
function filterStandards() {
  const app = S.app || 'All';
  const markets = (document.getElementById('t_markets')?.value || '').split(',').map(m=>m.trim());
  const appMap = {Excavator:'Excavator',WheelLoader:'WheelLoader',AgTractor:'AgTractor','2W':'2W','4W':'4W',Bus:'Bus',Truck:'Truck',Industrial:'Industrial',Other:'All'};
  const vtKey = appMap[app] || 'All';
  
  return STDS.filter(s => {
    const vMatch = s.v === 'All' || s.v.includes(vtKey);
    const mMatch = markets.length === 0 || markets.some(m => s.m.includes(m));
    return vMatch && mMatch;
  });
}

// ── OVERRIDDEN SAFETY CALC WITH STANDARDS ──
function calcSafety() {
  const Id=getV('sf_id'), Ip=getV('sf_ip'), V=getV('sf_v');
  const Rint=getV('sf_ir'), Rext=getV('sf_re');
  const L=getV('sf_L'), Vd=getV('sf_vd');
  const rho=+(document.getElementById('sf_mat')?.value||0.0175);
  const I_fuse=1.25*Ip;
  const I_sc=V/((Rint+Rext)*1e-3);
  const A_cable=2*rho*L*Id/Vd;
  const cabSizes=[16,25,35,50,70,95,120,150,185,240];
  const A_std=cabSizes.find(a=>a>=A_cable)||'>240';
  const I_fuse_note = I_fuse > 500 ? '⚠ Consider semiconductor fuse (>500A)' : I_fuse > 300 ? '⚠ Use fast-blow HV fuse' : '✓ Standard automotive fuse range';
  const A_std_note = A_cable > 150 ? '⚠ Consider parallel cables' : `IEC 60228 Class 5 flexible, copper`;

  setRg('sf_results',[
    {l:'Fuse rating ≥',v:I_fuse.toFixed(0),u:'A',c:'ok',t:I_fuse_note},
    {l:'SC current',v:I_sc.toFixed(0),u:'A',c:'err',t:'Rint+Rext must handle. Add fusible element ≤ 5ms.'},
    {l:'Min cable area',v:A_cable.toFixed(1),u:'mm²',c:'neutral',t:`Formula: 2ρL×I/Vdrop = 2×${rho}×${L}×${Id}/${Vd}`},
    {l:'Std cable size',v:A_std,u:'mm²',c:'blue',t:A_std_note},
    {l:'Voltage class',v:V>60?'Class B HV':'Class A LV',u:'',c:V>60?'ok':'neutral',t:V>60?'Requires IMD, HVIL, Precharge, Safety covers':'Low voltage — basic insulation'},
  ]);

  // Standards from database
  const filtered = filterStandards();
  const cats = [...new Set(filtered.map(s=>s.c))].sort();
  
  // Selected standards tracking
  const selKey = 'selected_stds';
  let selected = {};
  try { selected = JSON.parse(localStorage.getItem(selKey)||'{}'); } catch(_) { selected = {}; }

  let regsHtml = `<div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap">
    ${cats.map(c=>`<button class="btn sm sec" onclick="filterStdCat('${c}')" id="stdbtn_${c.replace(/\s/g,'_')}">${c}</button>`).join('')}
    <button class="btn sm" onclick="filterStdCat('ALL')">All (${filtered.length})</button>
    <button class="btn sm o" onclick="addCustomStd()">+ Add custom</button>
  </div>
  <div id="custom_stds_list"></div>
  <div id="stds_table_wrap" class="tbl-wrap" style="max-height:350px">`;
  
  regsHtml += `<table><tr><th>Use</th><th>Standard</th><th>Body</th><th>Category</th><th>Scope</th><th>Markets</th></tr>`;
  filtered.forEach(s => {
    const id = `std_${s.n.replace(/[^a-zA-Z0-9]/g,'_')}`;
    const checked = selected[id] !== false; // default true
    // FIX: Added onchange handler to persist checkbox state back to localStorage
    regsHtml += `<tr data-cat="${s.c}"><td><input type="checkbox" ${checked?'checked':''} id="${id}" style="accent-color:var(--g)" onchange="try{var sel=JSON.parse(localStorage.getItem('selected_stds')||'{}');sel[this.id]=this.checked;localStorage.setItem('selected_stds',JSON.stringify(sel));}catch(_){}"></td>
      <td style="font-weight:500;white-space:nowrap">${s.n}</td><td>${tag(s.b,'b')}</td>
      <td>${tag(s.c,'y')}</td><td style="font-size:9px;color:var(--m);max-width:200px">${s.t}</td>
      <td style="font-size:9px;color:var(--dm)">${s.m}</td></tr>`;
  });
  regsHtml += '</table></div>';
  const _sfr=document.getElementById('sf_regs');if(_sfr)_sfr.innerHTML=regsHtml;
}

function filterStdCat(cat) {
  const rows = document.querySelectorAll('#stds_table_wrap tr[data-cat]');
  rows.forEach(r => r.style.display = (cat==='ALL' || r.dataset.cat===cat)?'':'none');
}

function addCustomStd() {
  const div = document.getElementById('custom_stds_list');
  const n = Date.now();
  div.innerHTML += `<div style="display:flex;gap:8px;margin-bottom:6px;align-items:center">
    <input placeholder="Standard number e.g. IEC 62619" style="flex:2;padding:5px 8px;background:var(--bg);border:1px solid var(--bd);border-radius:5px;color:var(--t);font-size:11px">
    <input placeholder="Description" style="flex:3;padding:5px 8px;background:var(--bg);border:1px solid var(--bd);border-radius:5px;color:var(--t);font-size:11px">
    <select style="padding:5px;background:var(--bg);border:1px solid var(--bd);border-radius:5px;color:var(--t);font-size:10px">
      <option>Safety</option><option>Performance</option><option>EMC</option><option>Transport</option><option>Func Safety</option><option>Other</option>
    </select>
    <button class="btn sm" style="margin:0;background:var(--r)" onclick="this.parentElement.remove()">✕</button>
  </div>`;
}

// ══════════════════════════════════════════════
// STANDARDS PANEL — full render + filter functions
// (used by panel-standards top-level tab)
// ══════════════════════════════════════════════
let _selectedStds = {};
try { _selectedStds = JSON.parse(localStorage.getItem('selected_stds') || '{}'); } catch(_) { _selectedStds = {}; }

// ══ STANDARDS TABLE — complete working implementation ══
window._selectedStds = window._selectedStds || {};
try {
  const saved = localStorage.getItem('selected_stds');
  if (saved) window._selectedStds = JSON.parse(saved);
} catch(_) {}

// Category colour map
const STD_CAT_COLORS = {
  'Safety':       {bg:'rgba(239,68,68,.1)',   color:'#ef4444',  border:'rgba(239,68,68,.3)'},
  'Performance':  {bg:'rgba(74,158,255,.1)',  color:'var(--b)', border:'rgba(74,158,255,.3)'},
  'Func Safety':  {bg:'rgba(255,123,53,.1)',  color:'var(--o)', border:'rgba(255,123,53,.3)'},
  'EMC':          {bg:'rgba(139,92,246,.1)',  color:'#a78bfa',  border:'rgba(139,92,246,.3)'},
  'Charging':     {bg:'rgba(0,212,170,.1)',   color:'var(--g)', border:'rgba(0,212,170,.3)'},
  'Environmental':{bg:'rgba(16,185,129,.1)',  color:'#34d399',  border:'rgba(16,185,129,.3)'},
  'Mechanical':   {bg:'rgba(245,158,11,.1)',  color:'var(--y)', border:'rgba(245,158,11,.3)'},
  'Regulatory':   {bg:'rgba(236,72,153,.1)',  color:'#f472b6',  border:'rgba(236,72,153,.3)'},
  'Transport':    {bg:'rgba(99,102,241,.1)',  color:'#818cf8',  border:'rgba(99,102,241,.3)'},
  'Communication':{bg:'rgba(6,182,212,.1)',   color:'#22d3ee',  border:'rgba(6,182,212,.3)'},
  'Cybersecurity':{bg:'rgba(239,68,68,.1)',   color:'#f87171',  border:'rgba(239,68,68,.3)'},
  'Quality':      {bg:'rgba(74,158,255,.1)',  color:'var(--b)', border:'rgba(74,158,255,.3)'},
  'Thermal':      {bg:'rgba(255,123,53,.1)',  color:'var(--o)', border:'rgba(255,123,53,.3)'},
  'Lifecycle':    {bg:'rgba(0,212,170,.1)',   color:'var(--g)', border:'rgba(0,212,170,.3)'},
  'General':      {bg:'rgba(107,130,153,.1)', color:'var(--m)', border:'rgba(107,130,153,.3)'},
  'Material':     {bg:'rgba(245,197,24,.1)',  color:'var(--y)', border:'rgba(245,197,24,.3)'},
};
function stdCatTag(cat) {
  const c = STD_CAT_COLORS[cat] || {bg:'var(--bg3)',color:'var(--m)',border:'var(--border)'};
  return `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;background:${c.bg};color:${c.color};border:1px solid ${c.border}">${cat}</span>`;
}

function renderStdTable() {
  const search  = (document.getElementById('std_search')?.value || '').toLowerCase().trim();
  const catF    = document.getElementById('std_filter_cat')?.value  || 'ALL';
  const priF    = document.getElementById('std_filter_pri')?.value  || 'ALL';
  const bodyF   = document.getElementById('std_filter_body')?.value || 'ALL';
  const projF   = document.getElementById('std_filter_project')?.checked || false;

  // Project-filtered set
  const projectFiltered = filterStandards();
  const projectSet = new Set(projectFiltered.map(s => s.n));

  // Apply all filters
  let list = STDS.filter(s => {
    if (projF  && !projectSet.has(s.n))      return false;
    if (catF  !== 'ALL' && s.c !== catF)     return false;
    if (priF  !== 'ALL' && s.p !== priF)     return false;
    if (bodyF !== 'ALL' && s.b !== bodyF)    return false;
    if (search) {
      const sn = (s.n || '').toLowerCase();
      const st = (s.t || '').toLowerCase();
      const sb = (s.b || '').toLowerCase();
      const sc = (s.c || '').toLowerCase();
      const sno = (s.note || '').toLowerCase();
      if (!sn.includes(search) && !st.includes(search) && !sb.includes(search) && !sc.includes(search) && !sno.includes(search)) return false;
    }
    return true;
  });

  // Update KPI strip
  const setK = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setK('std_k_total',    STDS.length);
  setK('std_k_shown',    list.length);
  setK('std_k_filtered', projectFiltered.length);
  setK('std_k_must',     projectFiltered.filter(s => s.p === 'MUST').length);
  setK('std_k_should',   projectFiltered.filter(s => s.p === 'SHOULD').length);
  setK('std_k_sel',      Object.values(window._selectedStds).filter(Boolean).length);

  // Render table
  const tbody = document.getElementById('stds_tbody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:48px;color:var(--text3);font-size:13px">
      <div style="font-size:28px;margin-bottom:10px">🔍</div>
      No standards match the current filters.<br>
      <button onclick="resetStdFilters()" style="margin-top:14px;padding:7px 16px;background:rgba(0,212,170,.1);border:1px solid rgba(0,212,170,.3);color:var(--g);border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">↺ Reset Filters</button>
    </td></tr>`;
  } else {
    const priStyle = {
      MUST:    'background:rgba(0,212,170,.1);color:var(--g);border:1px solid rgba(0,212,170,.3)',
      SHOULD:  'background:rgba(245,197,24,.1);color:var(--y);border:1px solid rgba(245,197,24,.3)',
      OPTIONAL:'background:var(--bg3);color:var(--m);border:1px solid var(--border)',
    };
    tbody.innerHTML = list.map((s, i) => {
      const sid = 'sel_' + s.n.replace(/[^a-zA-Z0-9]/g, '_');
      const chk = window._selectedStds[sid] !== false;
      const inProj = projectSet.has(s.n);
      const rowStyle = inProj ? '' : 'opacity:.5';
      const projDot = inProj ? '<span title="Matches your project" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--g);margin-right:4px;vertical-align:middle"></span>' : '';
      return `<tr style="${rowStyle}" class="std-row">
        <td style="padding:7px 12px;border-bottom:1px solid var(--border)">
          <input type="checkbox" ${chk?'checked':''} id="${sid}" style="accent-color:var(--teal)"
            onchange="window._selectedStds=window._selectedStds||{};window._selectedStds['${sid}']=this.checked;try{localStorage.setItem('selected_stds',JSON.stringify(window._selectedStds));}catch(_){};const k=document.getElementById('std_k_sel');if(k)k.textContent=Object.values(window._selectedStds).filter(Boolean).length">
        </td>
        <td style="padding:7px 10px;border-bottom:1px solid var(--border);font-size:10px;color:var(--text3);font-family:var(--mono)">${i+1}</td>
        <td style="padding:7px 12px;border-bottom:1px solid var(--border);white-space:nowrap">
          ${projDot}<span style="font-weight:700;font-family:'DM Mono',monospace;font-size:11px;color:var(--t)">${s.n}</span>
        </td>
        <td style="padding:7px 12px;border-bottom:1px solid var(--border)">
          <span style="background:rgba(74,158,255,.1);color:var(--b);border:1px solid rgba(74,158,255,.25);padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;white-space:nowrap">${s.b}</span>
        </td>
        <td style="padding:7px 12px;border-bottom:1px solid var(--border);font-size:12px;line-height:1.45;max-width:340px">${s.t}</td>
        <td style="padding:7px 12px;border-bottom:1px solid var(--border);white-space:nowrap">${stdCatTag(s.c)}</td>
        <td style="padding:7px 12px;border-bottom:1px solid var(--border);font-size:10px;color:var(--text3);white-space:nowrap">${s.lv}</td>
        <td style="padding:7px 12px;border-bottom:1px solid var(--border)">
          <span style="padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;${priStyle[s.p]||''}">${s.p}</span>
        </td>
        <td style="padding:7px 12px;border-bottom:1px solid var(--border);font-size:10px;color:var(--m);white-space:nowrap">${s.v}</td>
        <td style="padding:7px 12px;border-bottom:1px solid var(--border);font-size:10px;color:var(--text3)">${s.m}</td>
      </tr>`;
    }).join('');
  }

  const lbl = document.getElementById('stds_count_label');
  if (lbl) {
    const selCount = Object.values(window._selectedStds).filter(Boolean).length;
    lbl.textContent = `${list.length} of ${STDS.length} standards shown · ${selCount} selected`;
  }
}

function resetStdFilters() {
  const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const setC = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };
  setV('std_search', '');
  setV('std_filter_cat', 'ALL');
  setV('std_filter_pri', 'ALL');
  setV('std_filter_body', 'ALL');
  setC('std_filter_project', false);
  // Reset quick filter pills
  document.querySelectorAll('.sqf-btn').forEach(b => {
    const isAll = b.dataset.q === 'ALL';
    b.style.background = isAll ? 'rgba(0,212,170,.1)' : 'var(--bg2)';
    b.style.borderColor = isAll ? 'rgba(0,212,170,.3)' : 'var(--border)';
    b.style.color = isAll ? 'var(--g)' : 'var(--text3)';
  });
  renderStdTable();
}

function quickFilterStd(type) {
  // Reset all controls first
  const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const setC = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };
  setV('std_search', '');
  setV('std_filter_cat', 'ALL');
  setV('std_filter_pri', 'ALL');
  setV('std_filter_body', 'ALL');
  setC('std_filter_project', false);

  // Apply quick filter
  if (type === 'MUST')    setV('std_filter_pri', 'MUST');
  else if (type === 'project') setC('std_filter_project', true);
  else if (type !== 'ALL') setV('std_filter_cat', type);

  // Update pill styles
  document.querySelectorAll('.sqf-btn').forEach(b => {
    const active = b.dataset.q === type;
    b.style.background   = active ? 'rgba(0,212,170,.1)' : 'var(--bg2)';
    b.style.borderColor  = active ? 'rgba(0,212,170,.3)' : 'var(--border)';
    b.style.color        = active ? 'var(--g)' : 'var(--text3)';
    b.style.fontWeight   = active ? '700' : '500';
  });
  renderStdTable();
}

function selectAllFilteredStds() {
  window._selectedStds = window._selectedStds || {};
  document.querySelectorAll('#stds_tbody input[type=checkbox]').forEach(cb => {
    window._selectedStds[cb.id] = true;
    cb.checked = true;
  });
  try { localStorage.setItem('selected_stds', JSON.stringify(window._selectedStds)); } catch(_) {}
  const k = document.getElementById('std_k_sel');
  if (k) k.textContent = Object.values(window._selectedStds).filter(Boolean).length;
  const lbl = document.getElementById('stds_count_label');
  if (lbl) {
    const shown = document.querySelectorAll('#stds_tbody tr.std-row').length;
    const sel   = Object.values(window._selectedStds).filter(Boolean).length;
    lbl.textContent = `${shown} of ${STDS.length} standards shown · ${sel} selected`;
  }
}

function clearAllStds() {
  window._selectedStds = {};
  try { localStorage.setItem('selected_stds', '{}'); } catch(_) {}
  document.querySelectorAll('#stds_tbody input[type=checkbox]').forEach(cb => cb.checked = false);
  const k = document.getElementById('std_k_sel');
  if (k) k.textContent = '0';
}

function toggleAllStds(masterCb) {
  window._selectedStds = window._selectedStds || {};
  document.querySelectorAll('#stds_tbody input[type=checkbox]').forEach(cb => {
    cb.checked = masterCb.checked;
    window._selectedStds[cb.id] = masterCb.checked;
  });
  try { localStorage.setItem('selected_stds', JSON.stringify(window._selectedStds)); } catch(_) {}
  const k = document.getElementById('std_k_sel');
  if (k) k.textContent = Object.values(window._selectedStds).filter(Boolean).length;
}

function exportSelectedStds() {
  const selected = [];
  document.querySelectorAll('#stds_tbody input[type=checkbox]:checked').forEach(cb => {
    const row = cb.closest('tr');
    if (!row) return;
    const cells = row.querySelectorAll('td');
    selected.push([
      cells[2]?.textContent?.trim() || '',
      cells[3]?.textContent?.trim() || '',
      cells[4]?.textContent?.trim() || '',
      cells[5]?.textContent?.trim() || '',
      cells[6]?.textContent?.trim() || '',
      cells[7]?.textContent?.trim() || '',
      cells[8]?.textContent?.trim() || '',
      cells[9]?.textContent?.trim() || '',
    ]);
  });
  if (!selected.length) { alert('No standards selected. Check boxes in the table first.'); return; }
  const headers = ['Standard Number','Body','Title','Category','Level','Priority','Vehicles','Markets'];
  const csv = [headers, ...selected].map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'selected_standards_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}

function addCustomStdMain() {
  const tbody = document.getElementById('stds_tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.style.cssText = 'background:rgba(0,212,170,.04);';
  tr.innerHTML = `
    <td style="padding:7px 12px;border-bottom:1px solid var(--border)"><input type="checkbox" checked style="accent-color:var(--teal)"></td>
    <td style="padding:7px 10px;border-bottom:1px solid var(--border);font-size:10px;color:var(--text3)">—</td>
    <td style="padding:7px 12px;border-bottom:1px solid var(--border)"><input type="text" placeholder="ISO XXXX:20XX" style="padding:5px 8px;background:var(--bg);border:1px solid rgba(0,212,170,.3);border-radius:5px;color:var(--t);font-size:11px;width:145px;outline:none"></td>
    <td style="padding:7px 12px;border-bottom:1px solid var(--border)"><input type="text" placeholder="Body" style="padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--t);font-size:11px;width:65px;outline:none"></td>
    <td style="padding:7px 12px;border-bottom:1px solid var(--border)"><input type="text" placeholder="Standard title" style="padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--t);font-size:11px;width:280px;outline:none"></td>
    <td style="padding:7px 12px;border-bottom:1px solid var(--border)"><select style="padding:4px 7px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--t);font-size:11px;outline:none"><option>Safety</option><option>Performance</option><option>EMC</option><option>Regulatory</option><option>Other</option></select></td>
    <td style="padding:7px 12px;border-bottom:1px solid var(--border)"><input type="text" placeholder="Level" style="padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--t);font-size:11px;width:90px;outline:none"></td>
    <td style="padding:7px 12px;border-bottom:1px solid var(--border)"><select style="padding:4px 7px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--t);font-size:11px;outline:none"><option>MUST</option><option>SHOULD</option><option>OPTIONAL</option></select></td>
    <td style="padding:7px 12px;border-bottom:1px solid var(--border)"><input type="text" placeholder="Vehicles" style="padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--t);font-size:11px;width:90px;outline:none"></td>
    <td style="padding:7px 12px;border-bottom:1px solid var(--border)"><input type="text" placeholder="Markets" style="padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--t);font-size:11px;width:90px;outline:none"></td>
  `;
  tbody.insertBefore(tr, tbody.firstChild);
  tr.querySelector('input[type=text]')?.focus();
}
// Auto-render on standards tab activation
const _origSwitchTopTab2 = window.switchTopTab;
window.switchTopTab = function(tabId, btn) {
  _origSwitchTopTab2(tabId, btn);
  if (tabId === 'standards') {
    setTimeout(() => { try { renderStdTable(); } catch(e) {} }, 80);
  }
};

function analyzeDriveCycle(input) {
  const f = input.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l=>l.trim() && !l.startsWith('#'));
    let pts = [];
    lines.forEach(l => {
      const cols = l.split(/[,\t;]/);
      if(cols.length >= 2 && !isNaN(+cols[0]) && !isNaN(+cols[1])) {
        pts.push({t: +cols[0], p: +cols[1]});
      }
    });
    if(pts.length < 2) { alert('Could not parse CSV. Use format: time_s, power_kW'); return; }
    const dt_total = pts[pts.length-1].t - pts[0].t;
    const Pavg = pts.reduce((s,p)=>s+Math.abs(p.p),0)/pts.length;
    const Ppeak = Math.max(...pts.map(p=>Math.abs(p.p)));
    const regenPts = pts.filter(p=>p.p<0);
    const Pregen = regenPts.length > 0 ? regenPts.reduce((s,p)=>s+Math.abs(p.p),0)/regenPts.length : 0;
    const Econsume = Pavg * dt_total / 3600;
    const Eregen = Pregen * dt_total / 3600;
    document.getElementById('dc_results').innerHTML = `
      <div class="rg">
        ${ri('Duration',dt_total.toFixed(0),'s')}
        ${ri('Avg Power',Pavg.toFixed(1),'kW','blue')}
        ${ri('Peak Power',Ppeak.toFixed(1),'kW','warn')}
        ${ri('Regen Power',Pregen.toFixed(2),'kW avg','ok')}
        ${ri('Energy Consumed',Econsume.toFixed(2),'kWh','blue')}
        ${ri('Regen Energy',Eregen.toFixed(2),'kWh','ok')}
      </div>`;
    const budgetEl = document.getElementById('dc_energy_budget');
    if(budgetEl) {
      const autonomy = S.E_usable > 0 ? (S.E_usable / Math.max(Pavg, 0.1)).toFixed(1) : '—';
      budgetEl.innerHTML =
        tbar('Energy available', S.E_usable.toFixed(1), Math.max(S.E_usable, Econsume)*1.2, 'kWh', 'var(--g)') +
        tbar('Energy consumed', Econsume.toFixed(1), Math.max(S.E_usable, Econsume)*1.2, 'kWh', 'var(--b)') +
        tbar('Regen recovered', Eregen.toFixed(1), Math.max(S.E_usable, Econsume)*1.2, 'kWh', 'var(--ok)') +
        `<div style="margin-top:8px;font-size:11px;color:var(--m)">Estimated autonomy: <span style="color:var(--g);font-weight:600">${autonomy} h</span> at this avg load</div>`;
    }
    setField('curr_phyd', Pavg.toFixed(1));
    setField('lc_pavg', Pavg.toFixed(1));
    calcCurrent(); calcThermal();
    // ── AUTO-LINK to Thermal Rise tab ──
    // Push avg/peak power directly to tr_ fields for immediate thermal rise calc
    if (typeof setField === 'function') {
      setField('dc_pavg',  Pavg.toFixed(1));
      setField('dc_ppeak', Ppeak.toFixed(1));
      setField('lc_pavg',  Pavg.toFixed(1));
    }
    // Auto-trigger thermal rise simulation with the new duty cycle data
    if (typeof runThermalRise === 'function') {
      setTimeout(runThermalRise, 50);
    }
    // Show sync indicator
    const syncEl = document.getElementById('dc_thermal_sync');
    if (syncEl) {
      syncEl.textContent = `✓ Thermal Rise synced — Avg: ${Pavg.toFixed(1)} kW, Peak: ${Ppeak.toFixed(1)} kW`;
      syncEl.style.color = 'var(--teal)';
    }
  };
  reader.readAsText(f);
}

// ── POWER MAP FIX ──
// ═══════════════════════════════════════════════════════
// POWER MAP — live canvas, manual input rows, 3 view modes
// ═══════════════════════════════════════════════════════
window._pmView = 'pv';

function pmSetView(view) {
  window._pmView = view;
  ['pv','iv','pt','pi'].forEach(k => {
    const btn = document.getElementById('pm_btn_' + k);
    if (!btn) return;
    const active = k === view;
    btn.style.background  = active ? 'rgba(0,212,170,.2)' : 'var(--bg3)';
    btn.style.borderColor = active ? 'rgba(0,212,170,.4)' : 'var(--border)';
    btn.style.color       = active ? 'var(--g)' : 'var(--text2)';
  });
  drawPowerMap();
}

function addPMRow() {
  const container = document.getElementById('pm_mode_rows');
  const colors = ['#f5c518','#ff4d6d','#34d399','#f472b6','#fb923c'];
  const dashes = ['5,5','4,8','2,4','8,2','6,2'];
  const idx = container.querySelectorAll('.pm-row').length;
  const col  = colors[idx % colors.length];
  const dash = dashes[idx % dashes.length];
  const div  = document.createElement('div');
  div.className = 'pm-row';
  div.style.cssText = 'display:grid;grid-template-columns:1fr 62px 62px auto;gap:4px;margin-bottom:4px;align-items:center';
  div.innerHTML = `
    <input type="text" class="pm-label" value="Mode ${idx+1}" placeholder="Name"
      style="padding:4px 6px;background:var(--bg3);border:1px solid ${col}44;border-radius:5px;color:${col};font-size:9px;font-weight:700" oninput="drawPowerMap()">
    <input type="number" class="pm-val" data-col="${col}" data-dash="${dash}" value="30" step="1"
      style="padding:4px 6px;background:var(--bg3);border:1px solid ${col}44;border-radius:5px;color:${col};font-family:var(--mono);font-size:12px;font-weight:700;text-align:right" oninput="drawPowerMap()">
    <input type="number" class="pm-dur" value="60" step="10"
      style="padding:4px 6px;background:var(--bg3);border:1px solid ${col}22;border-radius:5px;color:${col}99;font-family:var(--mono);font-size:11px;text-align:right" oninput="drawPowerMap()">
    <button onclick="this.closest('.pm-row').remove();drawPowerMap()"
      style="padding:3px 6px;background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.3);color:var(--r);border-radius:4px;cursor:pointer;font-size:10px">✕</button>`;
  container.appendChild(div);
  drawPowerMap();
}

function getPMModes() {
