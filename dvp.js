window.DVP_CONFIG = {
  n8nWebhookUrl: 'https://n8n.srv1454732.hstgr.cloud/webhook/dvp-intake',
  googleSheetId: 'YOUR_GOOGLE_SHEET_ID',
  googleApiKey: 'YOUR_GOOGLE_SHEETS_API_KEY',
  sheetNames: { dvpItems:'DVP_Items', results:'Results_Log', projects:'Projects' },
  approvalWebhookUrl: 'https://YOUR-N8N-INSTANCE.app.n8n.cloud/webhook/dvp-approval',
  siteName: 'EV Battery — Make It Simple',
  siteVersion: 'v2.0',
  company: 'Viji Venkatesan'
};
</script>

<!-- ════════════════════════════════════════════
     TOP-LEVEL TAB SWITCHING
════════════════════════════════════════════ -->
<script>
function switchTopTab(tabId, btn) {
  try {
    document.querySelectorAll('.main-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.top-tab').forEach(t => {
      t.classList.remove('active','active-eng');
    });
    const panel = document.getElementById('panel-' + tabId);
    if (panel) panel.classList.add('active');
    if (btn) {
      // FIX: Engineering needs BOTH active-eng (teal style) AND active (base state)
      if (tabId === 'engineering') {
        btn.classList.add('active-eng', 'active');
      } else {
        btn.classList.add('active');
      }
    }
  } catch(e) {
    try { console.log('[switchTopTab] panel switch error: ' + e); } catch(_) {}
  }

  // ── Per-tab initialisation ──
  if (tabId === 'engineering' && window._engInitDone) {
    setTimeout(() => {
      try { propagate(); } catch(e) {}
      try { setTimeout(drawPowerMap, 80); } catch(e) {}
      try { calcPrecharge(); } catch(e) {}
    }, 100);
  }
  if (tabId === 'dashboard') {
    // Show demo data immediately; replace with live data if Google Sheets is configured
    setTimeout(() => {
      try {
        if (typeof renderDemo === 'function') renderDemo();
        if (window.DVP_CONFIG &&
            window.DVP_CONFIG.googleSheetId !== 'YOUR_GOOGLE_SHEET_ID' &&
            window.DVP_CONFIG.googleApiKey  !== 'YOUR_GOOGLE_SHEETS_API_KEY') {
          loadData();
        }
      } catch(e) {}
    }, 80);
  }
  if (tabId === 'intake') {
    setTimeout(() => {
      try { if (typeof pullEngToIntake === 'function') pullEngToIntake(); } catch(e) {}
    }, 120);
  }
  if (tabId === 'reqmap') {
    setTimeout(() => {
      try {
        if (typeof buildReqMapFromTargets === 'function' && window._reqMapData && window._reqMapData.length === 0) {
          buildReqMapFromTargets();
        } else if (typeof renderReqMap === 'function') {
          renderReqMap();
        }
        if (typeof updateReqMapKPIs === 'function') updateReqMapKPIs();
        if (typeof renderCoverageCharts === 'function') renderCoverageCharts();
      } catch(e) {}
    }, 120);
  }
  try { window.scrollTo({top:0,behavior:'smooth'}); } catch(e) {}
}
</script>

<!-- ════════════════════════════════════════════
     DVP INTAKE LOGIC
════════════════════════════════════════════ -->
<!-- DVP/Dashboard JS in app.js -->

<!-- ════════════════════════════════════════════
     APPROVAL LOGIC
════════════════════════════════════════════ -->
<script>
async function submitApproval(force) {
  var dec = force || document.getElementById('ap-decision').value;
  if (!dec) { alert('Please select a decision.'); return; }
  var payload = {
    approval_type: 'standards_list', decision: dec,
    standards_to_add: (document.getElementById('ap-toAdd')||{value:''}).value.trim(),
    standards_to_remove: (document.getElementById('ap-toRemove')||{value:''}).value.trim(),
    notes: (document.getElementById('ap-notes')||{value:''}).value.trim(),
    submitted_at: new Date().toISOString(),
    submitted_by: 'Validation Head'
  };
  // FIX: guard placeholder webhook URL
  var webhookUrl = window.DVP_CONFIG && window.DVP_CONFIG.approvalWebhookUrl;
  if (!webhookUrl || webhookUrl.includes('YOUR-N8N-INSTANCE')) {
    var t = document.getElementById('toast');
    if(t){ t.textContent = '⚠ Configure approvalWebhookUrl in DVP_CONFIG to submit live approvals. Decision recorded locally: ' + dec; t.style.display='block'; setTimeout(()=>t.style.display='none',5000); }
    return;
  }
  try {
    await fetch(webhookUrl, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    var t = document.getElementById('toast');
    if(t){ t.textContent = dec === 'APPROVE' ? '✓ Approved — RAG ingestion starting now' : 'Rejection submitted — corrections noted'; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 4000); }
  } catch(e) {
    alert('Could not reach n8n: ' + e.message + '. Check approvalWebhookUrl in DVP_CONFIG');
  }
}
</script>

<!-- ════════════════════════════════════════════
     DASHBOARD LOGIC
════════════════════════════════════════════ -->
<script>
var allItems=[], allResults=[], activeFilter='all';
function dashStatusClass(s){s=(s||'').toLowerCase();if(s==='pass')return 'pass';if(s==='fail')return 'fail';if(s==='running'||s==='in progress'||s==='in_progress')return 'running';if(s==='conditional')return 'conditional';return 'pending';}
function statusBadge(s){var c=dashStatusClass(s);var labels={pass:'PASS',fail:'FAIL',running:'RUNNING',conditional:'CONDITIONAL',pending:'PENDING'};return '<span class="status-badge sb-'+c+'">'+(labels[c]||'PENDING')+'</span>';}
function barColor(s){var c=dashStatusClass(s);if(c==='pass')return '#10b981';if(c==='fail')return '#ef4444';if(c==='running')return '#f59e0b';if(c==='conditional')return '#8b5cf6';return '#2a5080';}
async function loadData(){
  var refreshEl = document.getElementById('lastRefresh');
  if(refreshEl) refreshEl.textContent='Refreshing...';
  var cfg=window.DVP_CONFIG;
  // FIX: if Google Sheet keys are still placeholders, skip fetch and show demo immediately
  if(!cfg || cfg.googleSheetId==='YOUR_GOOGLE_SHEET_ID' || cfg.googleApiKey==='YOUR_GOOGLE_SHEETS_API_KEY'){
    renderDemo();
    if(refreshEl) refreshEl.textContent='Demo data — configure googleSheetId & googleApiKey in DVP_CONFIG for live data';
    return;
  }
  var base='https://sheets.googleapis.com/v4/spreadsheets/'+cfg.googleSheetId+'/values/';
  var key='?key='+cfg.googleApiKey;
  try{
    var [itemsResp,resultsResp]=await Promise.all([
      fetch(base+encodeURIComponent(cfg.sheetNames.dvpItems)+key).then(r=>r.json()),
      fetch(base+encodeURIComponent(cfg.sheetNames.results)+key).then(r=>r.json())
    ]);
    allItems=parseSheet(itemsResp); allResults=parseSheet(resultsResp);
    renderAll();
    if(refreshEl) refreshEl.textContent='Updated '+new Date().toLocaleTimeString();
  }catch(e){
    // FIX: always fall back to demo — never leave dashboard blank
    renderDemo();
    if(refreshEl) refreshEl.textContent='⚠ Sheet error: '+e.message+' — showing demo data';
  }
}
function parseSheet(resp){if(!resp.values||resp.values.length<2)return [];var headers=resp.values[0];return resp.values.slice(1).map(function(row){var obj={};headers.forEach(function(h,i){obj[h]=row[i]||'';});return obj;});}
function renderAll(){
  var items=allItems;
  if(activeFilter==='fail')items=items.filter(i=>dashStatusClass(i.result||i.status)==='fail');
  else if(activeFilter==='pending')items=items.filter(i=>dashStatusClass(i.result||i.status)==='pending');
  else if(activeFilter!=='all')items=items.filter(i=>(i.level||'').toLowerCase()===activeFilter);
  var total=allItems.length,pass=0,fail=0,running=0,pending=0;
  allItems.forEach(function(i){var s=dashStatusClass(i.result||i.status||'');if(s==='pass')pass++;else if(s==='fail')fail++;else if(s==='running')running++;else pending++;});
  var done=pass+fail;
  document.getElementById('k-total').textContent=total||'—';
  document.getElementById('k-pass').textContent=pass||'—';
  document.getElementById('k-fail').textContent=fail||'—';
  document.getElementById('k-running').textContent=running||'—';
  document.getElementById('k-pct').textContent=done>0?Math.round(pass/done*100)+'%':'—';
  document.getElementById('k-pending').textContent=pending+' pending';
  var g=document.getElementById('statusGrid');
  if(!items.length){g.innerHTML='<div class="empty-state"><div class="big">📋</div>No test items loaded yet.<br>Add data to your Google Sheet to see results here.</div>';return;}
  g.innerHTML=items.map(function(item){var s=dashStatusClass(item.result||item.status||'');return '<div class="test-card '+s+'" onclick="showDetail(\''+encodeURIComponent(JSON.stringify(item))+'\')"><div class="tc-id">'+(item.test_id||'—')+'</div><div class="tc-name">'+(item.test_name||'—')+'</div><div class="tc-meta"><span class="tc-level">'+(item.level||'—')+'</span>'+statusBadge(item.result||item.status||'')+'</div><div class="tc-eng">'+(item.engineer?'👤 '+item.engineer:'Unassigned')+'</div></div>';}).join('');
  renderGantt(items);
  var tbody=document.getElementById('resultsBody');
  var resultItems=allResults.length?allResults:allItems.filter(i=>i.result&&i.result.toLowerCase()!=='pending');
  if(!resultItems.length){tbody.innerHTML='<tr><td colspan="8" style="padding:32px;text-align:center;color:var(--text3);font-size:13px">No results logged yet</td></tr>';return;}
  tbody.innerHTML=resultItems.slice(0,50).map(function(r){return '<tr><td style="font-family:var(--mono);font-size:11px;color:var(--text2)">'+(r.test_id||r.test_name||'—')+'</td><td>'+(r.category||'—')+'</td><td style="font-family:var(--mono);font-size:11px">'+(r.level||'—')+'</td><td>'+statusBadge(r.result||r.pass_fail||'')+'</td><td style="font-size:11px;font-family:var(--mono);color:var(--text2)">'+(r.standard_cited||r.applicable_standard||'—')+'</td><td style="font-size:12px">'+(r.engineer||'—')+'</td><td style="font-size:11px;font-family:var(--mono)">'+(r.test_date||'—')+'</td><td style="font-size:11px">'+statusBadge(r.confidence_level||'')+'</td></tr>';}).join('');
}
function renderGantt(items){
  var body=document.getElementById('ganttBody');
  var maxWk=0;items.forEach(i=>{if(parseInt(i.end_week)>maxWk)maxWk=parseInt(i.end_week);});maxWk=Math.max(maxWk,20);
  var wkHtml='<div class="gantt-weeks">';for(var w=1;w<=maxWk;w++)wkHtml+='<div class="gantt-wk">W'+w+'</div>';wkHtml+='</div>';
  var rowsHtml=items.filter(i=>i.start_week&&i.end_week).slice(0,20).map(function(i){var sw=parseInt(i.start_week)||1,ew=parseInt(i.end_week)||sw+1;var left=((sw-1)/maxWk*100).toFixed(1)+'%';var width=((ew-sw+1)/maxWk*100).toFixed(1)+'%';var s=dashStatusClass(i.result||i.status||'');return '<div class="gantt-row"><div class="gantt-label">'+(i.test_id||'').substring(0,18)+'</div><div class="gantt-track"><div class="gantt-bar" style="left:'+left+';width:'+width+';background:'+barColor(s)+'">'+(i.test_name||'').substring(0,16)+'</div></div></div>';}).join('');
  body.innerHTML=wkHtml+(rowsHtml||'<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px">No Gantt data yet — add start_week and end_week columns to DVP_Items sheet</div>');
}
function renderDemo(){
  var demo=[{test_id:'ELEC-CELL-001',test_name:'Cell capacity at 1C',level:'cell',category:'Electrical',result:'PASS',engineer:'Ravi K',test_date:'2026-05-10',start_week:'2',end_week:'3'},{test_id:'ELEC-CELL-002',test_name:'Cell DCIR measurement',level:'cell',category:'Electrical',result:'PASS',engineer:'Ravi K',test_date:'2026-05-12',start_week:'3',end_week:'4'},{test_id:'THERMAL-PACK-001',test_name:'Pack thermal runaway',level:'pack',category:'Thermal',result:'FAIL',engineer:'Priya S',test_date:'2026-05-15',start_week:'4',end_week:'6'},{test_id:'MECH-PACK-001',test_name:'Pack vibration test',level:'pack',category:'Mechanical',result:'running',engineer:'Arjun M',start_week:'5',end_week:'8'},{test_id:'SAFETY-SYS-001',test_name:'HV isolation check',level:'system',category:'Safety',result:'pending',start_week:'7',end_week:'9'},{test_id:'ENV-PACK-001',test_name:'IP67 ingress test',level:'pack',category:'Environmental',result:'pending',start_week:'8',end_week:'10'},{test_id:'EMC-PACK-001',test_name:'Pack radiated emissions',level:'pack',category:'EMC',result:'pending',start_week:'9',end_week:'11'},{test_id:'LIFE-CELL-001',test_name:'Cell cycle aging',level:'cell',category:'Lifetime',result:'running',engineer:'Ravi K',start_week:'3',end_week:'14'}];
  allItems=demo; allResults=demo.filter(i=>i.result==='PASS'||i.result==='FAIL');
  renderAll();
  document.getElementById('lastRefresh').textContent='Demo data — connect Google Sheets to see live data';
}
function setFilter(f,btn){activeFilter=f;document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderAll();}
function showDetail(enc){var item=JSON.parse(decodeURIComponent(enc));document.getElementById('modalTitle').textContent=(item.test_id||'Test')+' — '+(item.test_name||'');var keys=['level','category','applicable_standard','standard_version_year','clause_reference','acceptance_criteria','engineer','test_date','result','confidence_level','actual_result_summary','deviation_notes','recommendation','result_file_link'];document.getElementById('modalBody').innerHTML=keys.filter(k=>item[k]).map(function(k){return '<div class="modal-row"><div class="modal-key">'+k.replace(/_/g,' ')+'</div><div class="modal-val">'+item[k]+'</div></div>';}).join('');document.getElementById('modalBg').style.display='flex';}
function closeModal(e){if(e.target.id==='modalBg')document.getElementById('modalBg').style.display='none';}
loadData();
setInterval(()=>{ try{ loadData(); }catch(e){} }, 60000);
</script>
<!-- app.js loaded at bottom of body -->

<!-- mark eng init done -->
<script>window._engInitDone=true;</script>

<script>
