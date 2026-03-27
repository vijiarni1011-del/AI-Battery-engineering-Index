/* ═══════════════════════════════════════════════════════════════
   BatteryMIS — DCIR MAP  v2.0
   REAL INPUT SYSTEM — no hardcoded model
   Modes: A) Excel upload  B) Manual table entry
   Outputs: Cell + Pack heatmap, key op points, EoL projection
   ═══════════════════════════════════════════════════════════════ */

window._dcirData     = null;
window._dcirMode     = 'none';
window._dcirShowPack = false;
window._dcirManualSoCs  = [0,10,20,30,50,70,80,90,100];
window._dcirManualTemps = [-20,-10,0,10,25,35,45,55];
window._dcirManualVals  = {};

function dcirHeatCol(val, mn, mx) {
  if (mx <= mn) return 'rgba(0,212,170,.5)';
  const n = (val - mn) / (mx - mn);
  if (n <= 0.25) return `hsl(165,80%,${40+20*(1-n*4)}%)`;
  if (n <= 0.5)  return `hsl(${165-100*(n-0.25)*4},80%,48%)`;
  if (n <= 0.75) return `hsl(${65-50*(n-0.5)*4},85%,48%)`;
  return `hsl(${15-15*(n-0.75)*4},88%,44%)`;
}
function dcirTextCol(v,mn,mx){return (v-mn)/(mx-mn||1)>0.6?'#fff':'#000c08';}

function dcirInterp(soc, temp) {
  const d = window._dcirData;
  if (!d||!d.matrix||!d.matrix.length) return null;
  const {socs,temps,matrix} = d;
  const cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const fi=(arr,v)=>{let i=arr.findIndex(x=>x>v)-1;return cl(i<0?0:i,0,arr.length-2);};
  const si=fi(socs,soc), ti=fi(temps,temp);
  if(socs.length<2||temps.length<2) return matrix[si]?.[ti]??null;
  const ss=(soc-socs[si])/((socs[si+1]||socs[si])-socs[si]||1);
  const ts=(temp-temps[ti])/((temps[ti+1]||temps[ti])-temps[ti]||1);
  const r00=matrix[si]?.[ti]??0, r10=matrix[si+1]?.[ti]??r00;
  const r01=matrix[si]?.[ti+1]??r00, r11=matrix[si+1]?.[ti+1]??r00;
  return r00*(1-ss)*(1-ts)+r10*ss*(1-ts)+r01*(1-ss)*ts+r11*ss*ts;
}

window.renderDCIRMap = function() {
  const root = document.getElementById('dcir_root');
  if (!root) return;
  const S=window.S||{};
  // Always read from source DOM fields as primary source
  const srcN = id => { const el=document.getElementById(id); return (el&&el.value!=='')?+el.value:null; };
  const srcS = id => { const el=document.getElementById(id); return el?el.value:null; };
  const Ss   = (+(document.getElementById('c_cps')?.value)||S.c_cps||14)*(+(document.getElementById('c_ss')?.value)||S.c_ss||8);
  const Pp   = S.c_pp || 1;
  const chem = (srcS('c_chem') || S.c_chem || 'LFP').split(' ')[0].toUpperCase();
  const ir_bol = srcN('c_ir_bol') ?? S.c_ir_bol ?? 0.22;
  const ir_eol = srcN('c_ir_eol') ?? S.c_ir_eol ?? 0.35;
  const hasData = window._dcirData && window._dcirData.matrix?.length>0;

  root.innerHTML = `
<div class="ico-banner" style="margin-bottom:10px">
  🔗 Cell: <b>${chem}</b> · ${Ss}S/${Pp}P · IR_BoL: <b>${ir_bol} mΩ/cell</b> (${(ir_bol*Ss/Pp).toFixed(1)} mΩ pack) · 
  IR_EoL: <b>${ir_eol} mΩ/cell</b> · From Cell Inputs — 
  <a onclick="showSec('cell',document.querySelector('.nb'))" style="color:var(--b);cursor:pointer;text-decoration:underline">Edit in Cell Inputs</a>
</div>
<style>
.dcir-tbl td,.dcir-tbl th{padding:6px 8px;text-align:center;font-family:var(--mono);font-size:11px;border:1px solid rgba(255,255,255,.05)}
.dcir-tbl th{background:var(--bg3);color:var(--text2);font-size:10px;font-weight:700}
.dcir-inp{width:54px;padding:3px 4px;background:var(--bg);border:1px solid var(--border2);border-radius:4px;color:var(--text);font-family:var(--mono);font-size:11px;text-align:center}
.dcir-inp:focus{outline:none;border-color:var(--teal)}
</style>

<div class="g2" style="margin-bottom:16px">
  <div class="card">
    <div class="ch3">📊 Upload Cell DCIR Datasheet</div>
    <div class="fbox" style="margin-bottom:10px">
      <b>Expected Excel layout:</b><br>
      • Row 1: Temperature labels (°C) — e.g. -20, -10, 0, 10, 25, 35, 45, 55<br>
      • Col A: SoC values (%) — e.g. 0, 10, 20 … 100<br>
      • Body: actual DCIR values in <b>mΩ</b><br>
      Supports .xlsx · .xls · .csv
    </div>
    <div id="dcir_dropzone" onclick="document.getElementById('dcir_file').click()"
      ondragover="event.preventDefault();this.style.borderColor='var(--teal)'"
      ondragleave="this.style.borderColor='var(--border2)'"
      ondrop="event.preventDefault();this.style.borderColor='var(--border2)';dcirHandleFile(event.dataTransfer.files[0])"
      style="border:2px dashed var(--border2);border-radius:10px;padding:24px;text-align:center;cursor:pointer;background:var(--bg3)">
      <div style="font-size:28px;margin-bottom:8px">📋</div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">Drop Excel / CSV here or click to browse</div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px">.xlsx · .xls · .csv</div>
      <input type="file" id="dcir_file" accept=".xlsx,.xls,.csv" style="display:none" onchange="dcirHandleFile(this.files[0])">
    </div>
    <div id="dcir_file_status" style="margin-top:8px;font-size:11px;font-family:var(--mono);color:var(--text3)"></div>
  </div>

  <div class="card">
    <div class="ch3">✏️ Manual DCIR Entry (mΩ)</div>
    <div class="fbox" style="margin-bottom:8px">Enter DCIR (mΩ) for each SoC × Temperature. Min: 25°C column. Click <b>Apply</b> to calculate.</div>
    <div id="dcir_manual_wrap">${dcirBuildManualTable()}</div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
      <button onclick="dcirAddSoC()" style="padding:5px 10px;background:rgba(0,212,170,.1);border:1px solid rgba(0,212,170,.3);color:var(--g);border-radius:5px;font-size:10px;font-weight:700;cursor:pointer">+ SoC Row</button>
      <button onclick="dcirAddTemp()" style="padding:5px 10px;background:rgba(74,158,255,.1);border:1px solid rgba(74,158,255,.3);color:var(--b);border-radius:5px;font-size:10px;font-weight:700;cursor:pointer">+ Temp Col</button>
      <button onclick="dcirApplyManual()" style="padding:5px 16px;background:rgba(0,212,170,.18);border:1px solid rgba(0,212,170,.5);color:var(--g);border-radius:5px;font-size:11px;font-weight:700;cursor:pointer">▶ Apply & Calculate</button>
      <button onclick="dcirReset()" style="padding:5px 10px;background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.25);color:var(--r);border-radius:5px;font-size:10px;cursor:pointer">✕ Reset</button>
    </div>
  </div>
</div>

<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;font-size:11px">
  <span style="font-family:var(--mono);color:var(--teal);font-weight:700">${Ss}S / ${Pp}P</span>
  <span style="color:var(--text3)">·</span>
  <span style="font-family:var(--mono);color:var(--blue2)">${chem}</span>
  <span style="color:var(--text3)">·</span>
  <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
    <input type="checkbox" id="dcir_show_pack" onchange="window._dcirShowPack=this.checked;renderDCIRMap()" style="accent-color:var(--teal)" ${window._dcirShowPack?'checked':''}>
    <span style="color:var(--text2)">Show Pack IR in heatmap</span>
  </label>
</div>

${hasData ? dcirRenderResults(Ss,Pp,S) : `<div style="padding:48px;text-align:center;border:1px dashed var(--border2);border-radius:10px;background:var(--bg3)">
  <div style="font-size:32px;margin-bottom:12px">📋</div>
  <div style="font-size:14px;font-weight:700;color:var(--text2);margin-bottom:6px">No DCIR Data</div>
  <div style="font-size:12px;color:var(--text3)">Upload your cell supplier Excel/CSV datasheet above,<br>or fill in the manual table and click <b>▶ Apply & Calculate</b>.</div>
</div>`}`;
};

function dcirBuildManualTable() {
  const socs=window._dcirManualSoCs, temps=window._dcirManualTemps, vals=window._dcirManualVals;
  let h='<div style="overflow-x:auto"><table class="dcir-tbl" id="dcir_mtbl">';
  h+=`<tr><th style="background:var(--bg2)">SoC \\ T°C</th>`;
  temps.forEach((t,ti)=>h+=`<th><input class="dcir-inp" value="${t}" style="width:46px" onchange="window._dcirManualTemps[${ti}]=+this.value"><button onclick="window._dcirManualTemps.splice(${ti},1);document.getElementById('dcir_manual_wrap').innerHTML=dcirBuildManualTable()" style="background:none;border:none;color:var(--r);cursor:pointer;font-size:9px"> ✕</button></th>`);
  h+='</tr>';
  socs.forEach((soc,si)=>{
    h+=`<tr><th><input class="dcir-inp" value="${soc}" style="width:32px" onchange="window._dcirManualSoCs[${si}]=+this.value">%<button onclick="window._dcirManualSoCs.splice(${si},1);document.getElementById('dcir_manual_wrap').innerHTML=dcirBuildManualTable()" style="background:none;border:none;color:var(--r);cursor:pointer;font-size:9px"> ✕</button></th>`;
    temps.forEach((t,ti)=>{
      const k=`${si}_${ti}`, v=vals[k]??'';
      h+=`<td><input class="dcir-inp" id="dcir_v_${k}" value="${v}" placeholder="mΩ" oninput="window._dcirManualVals['${k}']=parseFloat(this.value)||undefined"></td>`;
    });
    h+='</tr>';
  });
  return h+'</table></div>';
}

window.dcirAddSoC=function(){window._dcirManualSoCs.push(Math.min(100,(window._dcirManualSoCs.slice(-1)[0]||90)+10));document.getElementById('dcir_manual_wrap').innerHTML=dcirBuildManualTable();};
window.dcirAddTemp=function(){window._dcirManualTemps.push((window._dcirManualTemps.slice(-1)[0]||45)+10);document.getElementById('dcir_manual_wrap').innerHTML=dcirBuildManualTable();};
window.dcirApplyManual=function(){
  const socs=window._dcirManualSoCs, temps=window._dcirManualTemps;
  const matrix=socs.map((s,si)=>temps.map((t,ti)=>{
    const el=document.getElementById(`dcir_v_${si}_${ti}`);
    const v=el?parseFloat(el.value):window._dcirManualVals[`${si}_${ti}`];
    return isNaN(v)?null:v;
  }));
  if(!matrix.flat().some(v=>v!==null)){alert('Enter at least some DCIR values (mΩ) first.');return;}
  window._dcirData={socs:[...socs],temps:[...temps],matrix};
  window._dcirMode='manual';
  const b=dcirInterp(50,25);
  if(b&&typeof setField==='function'){setField('c_ir_bol',b.toFixed(3));try{propagate&&propagate();}catch(e){}}
  renderDCIRMap();
};
window.dcirReset=function(){
  window._dcirData=null; window._dcirMode='none';
  window._dcirManualVals={};
  window._dcirManualSoCs=[0,10,20,30,50,70,80,90,100];
  window._dcirManualTemps=[-20,-10,0,10,25,35,45,55];
  renderDCIRMap();
};

window.dcirHandleFile=function(file){
  if(!file) return;
  const st=document.getElementById('dcir_file_status');
  if(st) st.textContent=`⏳ Reading ${file.name}…`;
  const run=()=>dcirParseExcel(file,st);
  if(typeof XLSX==='undefined'){
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload=run; s.onerror=()=>{if(st)st.textContent='⚠ Could not load Excel parser.';};
    document.head.appendChild(s);
  } else run();
};

function dcirParseExcel(file,statusEl){
  const ext=file.name.split('.').pop().toLowerCase();
  const proc=wb=>{
    let best=null,bestN=0;
    wb.SheetNames.forEach(n=>{
      const d=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:''});
      const c=d.flat().filter(v=>!isNaN(parseFloat(v))&&v!=='').length;
      if(c>bestN){bestN=c;best={n,d};}
    });
    if(!best){if(statusEl)statusEl.textContent='⚠ No numeric data found.';return;}
    parseRawDCIR(best.d,file.name,best.n,statusEl);
  };
  const reader=new FileReader();
  if(ext==='csv'){
    reader.onload=e=>{try{proc(XLSX.read(e.target.result,{type:'string'}));}catch(err){if(statusEl)statusEl.textContent='⚠ '+err.message;}};
    reader.readAsText(file);
  } else {
    reader.onload=e=>{try{proc(XLSX.read(new Uint8Array(e.target.result),{type:'array'}));}catch(err){if(statusEl)statusEl.textContent='⚠ '+err.message;}};
    reader.readAsArrayBuffer(file);
  }
}

function parseRawDCIR(raw,fileName,sheetName,statusEl){
  let hRow=-1;
  for(let r=0;r<Math.min(raw.length,10);r++){
    if(raw[r].filter(v=>!isNaN(parseFloat(v))&&String(v).trim()!=='').length>=2){hRow=r;break;}
  }
  if(hRow<0){if(statusEl)statusEl.textContent='⚠ Cannot find temperature header row.';return;}
  const temps=[],tCols=[];
  raw[hRow].forEach((v,ci)=>{const n=parseFloat(v);if(!isNaN(n)&&n>=-60&&n<=120){temps.push(n);tCols.push(ci);}});
  const socs=[],matrix=[];
  for(let r=hRow+1;r<raw.length;r++){
    const row=raw[r],soc=parseFloat(row[0]);
    if(isNaN(soc)||soc<0||soc>100) continue;
    const irRow=tCols.map(ci=>{const v=parseFloat(row[ci]);return isNaN(v)?null:v;});
    if(!irRow.some(v=>v!==null)) continue;
    socs.push(soc); matrix.push(irRow);
  }
  if(socs.length<2||temps.length<2){if(statusEl)statusEl.textContent=`⚠ Only ${socs.length} SoC × ${temps.length} temps — need ≥2 each.`;return;}
  window._dcirData={socs,temps,matrix};
  window._dcirMode='excel';
  window._dcirManualSoCs=[...socs]; window._dcirManualTemps=[...temps]; window._dcirManualVals={};
  socs.forEach((s,si)=>temps.forEach((t,ti)=>{if(matrix[si]?.[ti]!==null)window._dcirManualVals[`${si}_${ti}`]=matrix[si][ti];}));
  const b=dcirInterp(50,25);
  if(b&&typeof setField==='function'){setField('c_ir_bol',b.toFixed(3));try{propagate&&propagate();}catch(e){}}
  const filled=matrix.flat().filter(v=>v!==null).length;
  if(statusEl)statusEl.textContent=`✓ ${sheetName} · ${socs.length}×${temps.length} = ${filled} values · ${b?'Baseline @25°C/50%SoC: '+b.toFixed(3)+' mΩ → pushed to Cell tab':''}`;
  renderDCIRMap();
}

function dcirRenderResults(Ss,Pp,S){
  const d=window._dcirData;
  const allV=d.matrix.flat().filter(v=>v!==null);
  const mn=Math.min(...allV),mx=Math.max(...allV);
  const showPack=window._dcirShowPack;
  const scMn=showPack?mn*Ss/Pp:mn, scMx=showPack?mx*Ss/Pp:mx;
  const ir_nom=dcirInterp(50,25)??allV[0];
  const Ipeak=S.t_ppeak?(S.t_ppeak*1000/(S.V_nom_pack||400)):300;

  // Heatmap
  let tH=`<tr><th style="background:var(--bg2);font-size:10px;color:var(--text3)">SoC\\T°C</th>`;
  d.temps.forEach(t=>tH+=`<th>${t}°C</th>`);
  tH+='</tr>';
  const tB=d.socs.map((soc,si)=>{
    let row=`<tr><td style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--text2);background:var(--bg2)">${soc}%</td>`;
    d.temps.forEach((temp,ti)=>{
      const cv=d.matrix[si]?.[ti];
      if(cv===null||cv===undefined){row+=`<td style="background:var(--bg4);color:var(--text3)">—</td>`;return;}
      const dv=showPack?(cv*Ss/Pp):cv;
      row+=`<td style="background:${dcirHeatCol(dv,scMn,scMx)};color:${dcirTextCol(dv,scMn,scMx)};font-family:var(--mono);font-size:11px;font-weight:600;padding:6px 4px;cursor:default"
        title="SoC ${soc}% | ${temp}°C&#10;Cell: ${cv.toFixed(3)} mΩ&#10;Pack: ${(cv*Ss/Pp).toFixed(2)} mΩ"
        onmouseenter="this.style.outline='2px solid var(--teal)'" onmouseleave="this.style.outline=''">
        ${dv.toFixed(showPack?1:3)}</td>`;
    });
    return row+'</tr>';
  }).join('');

  // Key operating points
  const ops=[
    {label:'Cold start discharge', soc:20, temp:d.temps[0],                    note:`${d.temps[0]}°C worst-case`},
    {label:'Nominal (BoL ref)',    soc:50, temp:25,                              note:'Datasheet baseline'},
    {label:'Peak discharge',       soc:80, temp:25,                              note:'High SoC, 25°C'},
    {label:'Regen braking',        soc:90, temp:25,                              note:'High SoC regen pulse'},
    {label:'Hot ambient',          soc:50, temp:d.temps[d.temps.length-1],      note:`${d.temps[d.temps.length-1]}°C hot`},
    {label:'Cold charge start',    soc:10, temp:Math.max(d.temps[0],d.temps[1]),note:'BMS charge gate risk'},
  ];
  const opRows=ops.map(op=>{
    const ir=dcirInterp(op.soc,op.temp); if(!ir) return '';
    const pIR=ir*Ss/Pp, fac=ir_nom>0?ir/ir_nom:1;
    const Vd=pIR*1e-3*Ipeak, Vdp=(S.V_nom_pack||400)>0?Vd/(S.V_nom_pack||400)*100:0;
    const st=fac>4?'<span style="color:var(--r)">⚠ CRITICAL</span>':fac>2?'<span style="color:var(--o)">HIGH</span>':fac>1.3?'<span style="color:var(--y)">ELEVATED</span>':'<span style="color:var(--g)">NOMINAL</span>';
    return `<tr><td>${op.label}</td><td style="font-family:var(--mono)">${op.soc}%</td><td style="font-family:var(--mono)">${op.temp}°C</td>
      <td style="font-family:var(--mono);font-weight:700">${ir.toFixed(3)} mΩ</td><td style="font-family:var(--mono)">${pIR.toFixed(1)} mΩ</td>
      <td style="font-family:var(--mono);color:${fac>2?'var(--r)':fac>1.2?'var(--o)':'var(--g)'}">×${fac.toFixed(2)}</td>
      <td style="font-family:var(--mono);color:${Vdp>5?'var(--r)':Vdp>3?'var(--o)':'var(--g)'}">${Vd.toFixed(1)}V (${Vdp.toFixed(1)}%)</td>
      <td>${st}</td><td style="color:var(--text3);font-size:11px">${op.note}</td></tr>`;
  }).join('');

  const ir_eol=S.c_ir_eol||ir_nom*1.6, grow=ir_nom>0?ir_eol/ir_nom:1.6;
  const coldIR=dcirInterp(20,d.temps[0]);

  return `
<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
  <span style="font-size:10px;color:var(--text3);font-family:var(--mono)">Scale (${showPack?'Pack':'Cell'} mΩ):</span>
  <span style="background:linear-gradient(90deg,hsl(165,80%,45%),hsl(65,85%,48%),hsl(0,88%,44%));border-radius:4px;width:120px;height:10px;display:inline-block"></span>
  <span style="font-size:10px;color:var(--text3)">${scMn.toFixed(1)} → ${scMx.toFixed(1)} mΩ · ${d.socs.length}SoC × ${d.temps.length}T · source: <b>${window._dcirMode}</b></span>
</div>

<div class="card" style="overflow-x:auto;margin-bottom:16px;padding:0">
  <div style="padding:12px 16px 8px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
    <div class="ch3" style="margin:0">🌡️ DCIR Heatmap — ${showPack?`Pack (${Ss}S/${Pp}P)`:'Cell'} IR (mΩ) · hover for details</div>
    <span style="font-size:10px;font-family:var(--mono);color:var(--text3)">Baseline ${ir_nom.toFixed(3)} mΩ @ 25°C / 50%SoC</span>
  </div>
  <table class="dcir-tbl" style="width:100%;min-width:500px"><thead>${tH}</thead><tbody>${tB}</tbody></table>
</div>

<div class="card" style="margin-bottom:16px">
  <div class="ch3">⚡ Key Operating Points — I_peak = ${Ipeak.toFixed(0)} A</div>
  <div style="overflow-x:auto"><table class="res-tbl" style="font-size:12px">
    <thead><tr><th>Condition</th><th>SoC</th><th>Temp</th><th>Cell IR</th><th>Pack IR</th><th>vs Nom</th><th>Pack ΔV</th><th>Status</th><th>Note</th></tr></thead>
    <tbody>${opRows}</tbody>
  </table></div>
</div>

<div class="card">
  <div class="ch3">📊 BoL → EoL Projection</div>
  <div class="g3" style="margin-top:12px">
    ${[
      {l:'Cell IR BoL (25°C/50%SoC)', v:ir_nom.toFixed(3)+' mΩ', c:'var(--g)'},
      {l:'Cell IR EoL (Cell tab)',     v:ir_eol.toFixed(3)+' mΩ', c:'var(--o)'},
      {l:'Growth factor',              v:'×'+grow.toFixed(2),      c:'var(--y)'},
      {l:'Pack IR BoL',               v:(ir_nom*Ss/Pp).toFixed(1)+' mΩ', c:'var(--b)'},
      {l:'Pack IR EoL',               v:(ir_eol*Ss/Pp).toFixed(1)+' mΩ', c:'var(--o)'},
      {l:`Pack IR EoL (${d.temps[0]}°C/20%SoC)`, v:coldIR?(coldIR*grow*Ss/Pp).toFixed(1)+' mΩ':'—', c:'var(--r)'},
    ].map(r=>`<div class="kpi-card" style="border-color:${r.c}22"><div class="kpi-v" style="color:${r.c};font-size:13px">${r.v}</div><div class="kpi-l">${r.l}</div></div>`).join('')}
  </div>
</div>
<div class="ico-banner" style="margin-top:12px">
  📌 All values from ${window._dcirMode==='excel'?'uploaded cell supplier datasheet':'manual entry'}.
  Pack = Cell × ${Ss}/${Pp}. EoL growth = c_ir_eol ÷ c_ir_bol (Cell Inputs tab).
</div>`;
}

(function(){
  const _ss=window.showSec;
  window.showSec=function(id,btn){
    if(typeof _ss==='function') _ss(id,btn);
    if(id==='dcir') setTimeout(()=>{try{renderDCIRMap();}catch(e){}},60);
  };
})();
