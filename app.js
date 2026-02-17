const state={kad:[],eid:[],kpk:[],kpkMaster:[],selectedKad:'',selectedEid:''};
const $=id=>document.getElementById(id);

function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function setStatus(ok,text){const el=$('status'); el.textContent=text; el.className='badge'+(ok?' ok':'');}

function parseSemicolon(text){
  const lines=String(text||'').split(/\r?\n/).filter(Boolean);
  if(!lines.length) return [];

  const cleanHeader=(h)=>String(h||'').replace(/^\uFEFF/, '').trim().toLowerCase();
  const headers=lines[0].split(';').map(cleanHeader);

  const out=[];
  for(let i=1;i<lines.length;i++){
    const cols=lines[i].split(';');
    if(cols.length<headers.length) continue;
    const obj={};
    headers.forEach((h,idx)=>obj[h]=String(cols[idx]??'').trim());
    out.push(obj);
  }
  return out;
}

async function loadText(path){
  const r=await fetch(path);
  if(!r.ok) throw new Error(`Αποτυχία φόρτωσης ${path}`);
  return r.text();
}

function eidDesc(eid){ return (state.eid.find(x=>x.eid===eid)?.per)||''; }
function numCode(v){ const n=parseInt(String(v||'').replace(/\D/g,''),10); return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER; }
function normCode(v){ const n=numCode(v); return Number.isFinite(n)&&n!==Number.MAX_SAFE_INTEGER ? String(n) : String(v||'').trim(); }
function sortByCode(rows,key){ return [...rows].sort((a,b)=>{ const an=numCode(a[key]), bn=numCode(b[key]); if(an!==bn) return an-bn; return String(a[key]||'').localeCompare(String(b[key]||'')); }); }

function renderKadList(rows){
  const el=$('kadResults'); el.innerHTML='';
  sortByCode(rows,'kad').slice(0,300).forEach(r=>{
    const d=document.createElement('div');
    d.className='item clickable'+(state.selectedKad===r.kad?' selected':'');
    d.innerHTML=`<b>${r.kad}</b> — ${r.per}`;
    d.onclick=()=>{
      state.selectedKad=r.kad;
      state.selectedEid='';
      $('selKadInfo').textContent=`Επιλεγμένος ΚΑΔ: ${r.kad} — ${r.per}`;
      $('selEidInfo').textContent='Δεν έχει επιλεγεί ΕΙΔ.';
      searchKad();
      searchEid();
      $('lookupOut').innerHTML='';
    };
    el.appendChild(d);
  });
  if(!rows.length) el.innerHTML=`<div class='item muted'>No results</div>`;
}

function renderEidList(rows){
  const el=$('eidResults'); el.innerHTML='';
  sortByCode(rows,'eid').slice(0,300).forEach(r=>{
    const d=document.createElement('div');
    d.className='item clickable'+(state.selectedEid===r.eid?' selected':'');
    d.innerHTML=`<b>${r.eid}</b> — ${r.per}`;
    d.onclick=()=>{
      state.selectedEid=r.eid;
      $('selEidInfo').textContent=`Επιλεγμένο ΕΙΔ: ${r.eid} — ${r.per}`;
      searchEid();
      lookupKpk();
    };
    el.appendChild(d);
  });
  if(!rows.length) el.innerHTML=`<div class='item muted'>No results</div>`;
}

function renderKpk(rows){
  const el=$('lookupOut'); el.innerHTML='';
  sortByCode(sortByCode(rows,'eid'),'kad').slice(0,300).forEach(r=>{
    const d=document.createElement('div'); d.className='item';
    const master = state.kpkMaster.find(m => normCode(m.kpk) === normCode(r.kpk));
    const masterHtml = master
      ? `<div class='muted'>${master.per}</div><div><code>εργαζόμενος</code>: <b>${master.pemployee}</b> | <code>εργοδότης</code>: <b>${master.pcompany}</b> | <code>σύνολο</code>: <b>${master.ptotal}</b> | <code>από</code>: <b>${master.dfrom}</b></div>`
      : `<div class='error-text'>Δεν βρέθηκε αντίστοιχη εγγραφή στο kpk.txt για ΚΠΚ ${r.kpk}</div>`;
    d.innerHTML=`KAD <b>${r.kad}</b> | EID <b>${r.eid}</b> → KPK <b>${r.kpk}</b> <span class='muted'>(από ${r.ymfrom} έως ${r.ymto})</span>${masterHtml}`;
    el.appendChild(d);
  });
  if(!rows.length) el.innerHTML=`<div class='item muted'>Δεν βρέθηκε αποτέλεσμα ΚΠΚ για τον επιλεγμένο συνδυασμό</div>`;
}

function searchKad(){
  const q=norm($('qKad').value);
  const rows=!q?state.kad:state.kad.filter(r=>norm(r.kad).includes(q)||norm(r.per).includes(q));

  // auto-select when filter results in exactly one KAD
  if(rows.length===1){
    const only=rows[0];
    if(state.selectedKad!==only.kad){
      state.selectedKad=only.kad;
      state.selectedEid='';
      $('selKadInfo').textContent=`Επιλεγμένος ΚΑΔ: ${only.kad} — ${only.per}`;
      $('selEidInfo').textContent='Δεν έχει επιλεγεί ΕΙΔ.';
      $('lookupOut').innerHTML='';
      searchEid();
    }
  }

  renderKadList(rows);
}

function searchEid(){
  if(!state.selectedKad){ $('eidResults').innerHTML=`<div class='item muted'>Επίλεξε πρώτα ΚΑΔ.</div>`; return; }
  const allowedEids=[...new Set(state.kpk.filter(r=>r.kad===state.selectedKad).map(r=>r.eid))];
  const baseRows=allowedEids.map(eid=>({eid, per:eidDesc(eid)}));
  const q=norm($('qEid').value);
  const rows=!q?baseRows:baseRows.filter(r=>norm(r.eid).includes(q)||norm(r.per).includes(q));

  // auto-select when filter results in exactly one EID
  if(rows.length===1){
    const only=rows[0];
    if(state.selectedEid!==only.eid){
      state.selectedEid=only.eid;
      $('selEidInfo').textContent=`Επιλεγμένο ΕΙΔ: ${only.eid} — ${only.per}`;
      lookupKpk();
    }
  }

  renderEidList(rows);
}

function lookupKpk(){
  if(!state.selectedKad || !state.selectedEid){ $('lookupOut').innerHTML=`<div class='item muted'>Επίλεξε ΚΑΔ και ΕΙΔ για να εμφανιστεί το ΚΠΚ.</div>`; return; }
  let rows=state.kpk.filter(r=>r.kad===state.selectedKad && r.eid===state.selectedEid);
  renderKpk(rows);
}

async function loadDefaultFiles(){
  const [kadTxt,eidTxt,kpkTxt,kpkMasterTxt]=await Promise.all([loadText('./kad.txt'),loadText('./eid.txt'),loadText('./kad_eid_kpk.txt'),loadText('./kpk.txt')]);
  state.kad=parseSemicolon(kadTxt);
  state.eid=parseSemicolon(eidTxt);
  state.kpk=parseSemicolon(kpkTxt);
  state.kpkMaster=parseSemicolon(kpkMasterTxt);
}
async function loadFromFileInput(inputId){
  const f=$(inputId).files[0];
  if(!f) throw new Error(`Λείπει αρχείο για ${inputId}`);
  return f.text();
}

async function loadManual(){
  const [kadTxt,eidTxt,kpkTxt,kpkMasterTxt]=await Promise.all([loadFromFileInput('fKad'),loadFromFileInput('fEid'),loadFromFileInput('fKpk'),loadFromFileInput('fKpkMaster')]);
  state.kad=parseSemicolon(kadTxt);
  state.eid=parseSemicolon(eidTxt);
  state.kpk=parseSemicolon(kpkTxt);
  state.kpkMaster=parseSemicolon(kpkMasterTxt);
}

async function loadFromDirectoryInput(){
  const files=[...($('fDir').files||[])];
  if(!files.length) throw new Error('Επίλεξε πρώτα φάκελο');

  const byName = Object.fromEntries(files.map(f=>[f.name.toLowerCase(), f]));
  const kadF = byName['kad.txt'];
  const eidF = byName['eid.txt'];
  const relF = byName['kad_eid_kpk.txt'];
  const kpkF = byName['kpk.txt'];
  if(!kadF || !eidF || !relF || !kpkF) throw new Error('Στον επιλεγμένο φάκελο πρέπει να υπάρχουν: kad.txt, eid.txt, kad_eid_kpk.txt, kpk.txt');

  const [kadTxt,eidTxt,kpkTxt,kpkMasterTxt]=await Promise.all([kadF.text(),eidF.text(),relF.text(),kpkF.text()]);
  state.kad=parseSemicolon(kadTxt);
  state.eid=parseSemicolon(eidTxt);
  state.kpk=parseSemicolon(kpkTxt);
  state.kpkMaster=parseSemicolon(kpkMasterTxt);
}

function onDataLoaded(){
  setStatus(true,`Φορτώθηκαν: kad ${state.kad.length}, eid ${state.eid.length}, kad_eid_kpk ${state.kpk.length}, kpk ${state.kpkMaster.length}`);
  state.selectedKad=''; state.selectedEid='';
  $('selKadInfo').textContent='Δεν έχει επιλεγεί ΚΑΔ.';
  $('selEidInfo').textContent='Δεν έχει επιλεγεί ΕΙΔ.';
  searchKad();
  searchEid();
  $('lookupOut').innerHTML='';
}

function wireUI(){
  const btnLoadDir=$('btnLoadDir'), qKad=$('qKad'), qEid=$('qEid'), selKadInfo=$('selKadInfo'), selEidInfo=$('selEidInfo'), filePickerRow=$('filePickerRow');
  if(!btnLoadDir || !qKad || !qEid || !selKadInfo || !selEidInfo || !filePickerRow){
    console.error('Αποτυχία σύνδεσης UI KEK: λείπουν αναμενόμενα στοιχεία', {
      btnLoadDir: !!btnLoadDir, qKad: !!qKad, qEid: !!qEid, selKadInfo: !!selKadInfo, selEidInfo: !!selEidInfo, filePickerRow: !!filePickerRow
    });
    return;
  }

  btnLoadDir.onclick=async()=>{
    try{
      setStatus(false,'Φόρτωση από φάκελο...');
      await loadFromDirectoryInput();
      onDataLoaded();
    }
    catch(e){setStatus(false,e.message||'Αποτυχία φόρτωσης φακέλου');}
  };

  // auto-load only when served over http(s)
  if(location.protocol==='http:' || location.protocol==='https:'){
    filePickerRow.style.display='none';
    (async()=>{
      try{
        setStatus(false,'Αυτόματη φόρτωση από server...');
        await loadDefaultFiles();
        onDataLoaded();
      }catch(e){
        setStatus(false,`Αποτυχία αυτόματης φόρτωσης: ${e.message || ''}`.trim());
      }
    })();
  } else {
    filePickerRow.style.display='flex';
  }

  qKad.oninput=()=>{
    state.selectedEid='';
    $('selEidInfo').textContent='Δεν έχει επιλεγεί ΕΙΔ.';
    $('eidResults').innerHTML='';
    $('lookupOut').innerHTML='';
    searchKad();
  };
  qEid.oninput=()=>{
    $('lookupOut').innerHTML='';
    searchEid();
  };
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', wireUI);
else wireUI();
