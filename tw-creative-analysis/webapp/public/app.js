/* ================================================================
   대만/홍콩 소재분석 대시보드 — Express + SQLite + Socket.IO 실시간 협업판
   (Firebase 전면 제거, REST API(/api/dashboard) + Socket.IO로 대체)
================================================================ */
let ITEMS = [];
let socket = null;
let toastTmr = null;

function emptyRegion(){
  return { generatedAt:'실시간 동기화', scripts:[], performance:[], introPerf:{}, lowPerfFeedback:{}, dataIssues:[] };
}
let DATA = { regions: { "대만": emptyRegion(), "홍콩": emptyRegion() }, dailyLog: { "대만": [], "홍콩": [] }, smLog: { "대만": [], "홍콩": [] } };
let currentRegion = '대만';
const REGIONS = ['대만','홍콩'];
function REG(){ return DATA.regions[currentRegion]; }

/* ===================== 서버 동기화 ===================== */
function setSyncStatus(state, label){
  const dot = document.getElementById('sync-dot');
  if(dot) dot.className = 'sync-dot'+(state==='live'?' live':state==='error'?' error':'');
  const lbl = document.getElementById('sync-label');
  if(lbl) lbl.textContent = label;
}
function toast(msg, err){
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show'+(err?' err':'');
  clearTimeout(toastTmr); toastTmr = setTimeout(()=>t.className='toast', 2000);
}

function rebuildData(){
  const regions = { "대만": emptyRegion(), "홍콩": emptyRegion() };
  ITEMS.filter(it=>it.type==='concept').sort((a,b)=>(a.order??0)-(b.order??0)).forEach(it=>{
    const reg = regions[it.region]; if(!reg) return;
    const isCampaignLevel = it.performance && it.performance.isCampaignLevel;
    if(!isCampaignLevel){
      reg.scripts.push({
        _id: it.id, name:it.name, brand:it.brand, product:it.product, match:it.match, verdict:it.verdict,
        approval:it.approval, note:it.note||'', i1:it.i1, i2:it.i2, i3:it.i3, body:it.body,
        benefits:it.benefits||[], benefitsSource:it.benefitsSource, intent:it.intent, versionFlag:it.versionFlag,
        _new:it._new, _matchNote:it._matchNote
      });
    }
    if(it.performance){ reg.performance.push({ ...it.performance }); }
    if(it.introPerf){ reg.introPerf[it.name] = it.introPerf; }
    if(it.feedback){ reg.lowPerfFeedback[it.name] = it.feedback; }
  });
  ITEMS.filter(it=>it.type==='issue').sort((a,b)=>(a.order??0)-(b.order??0)).forEach(it=>{
    const reg = regions[it.region]; if(!reg) return;
    reg.dataIssues.push({issue:it.issue, detail:it.detail});
  });
  const dlog = { "대만":[], "홍콩":[] };
  ITEMS.filter(it=>it.type==='dailylog').forEach(it=>{
    if(!dlog[it.region]) dlog[it.region] = [];
    dlog[it.region].push({_id:it.id, date:it.date, brand:it.brand, concept:it.concept, impressions:it.impressions,
      clicks:it.clicks, spend:it.spend, purchases:it.purchases, ctr:it.ctr, cpm:it.cpm, cpc:it.cpc, cpa:it.cpa, roas:it.roas});
  });
  const smlog = { "대만":[], "홍콩":[] };
  ITEMS.filter(it=>it.type==='smlog').forEach(it=>{
    if(!smlog[it.region]) smlog[it.region] = [];
    smlog[it.region].push({_id:it.id, date:it.date, brand:it.brand, campaignId:it.campaignId, campaignName:it.campaignName,
      adsetId:it.adsetId, adsetName:it.adsetName, adId:it.adId, adName:it.adName, impressions:it.impressions,
      clicks:it.clicks, spend:it.spend, purchases:it.purchases, ctr:it.ctr, cpc:it.cpc, cpa:it.cpa, roas:it.roas});
  });
  DATA.regions = regions;
  DATA.dailyLog = dlog;
  DATA.smLog = smlog;
}

async function apiCreate(fields){
  const res = await fetch('/api/dashboard', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(fields) });
  if(!res.ok){ toast('추가 실패', true); throw new Error('create failed'); }
  return res.json();
}
async function apiUpdate(id, patch){
  const res = await fetch('/api/dashboard/'+id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(patch) });
  if(!res.ok){ toast('저장 실패', true); throw new Error('update failed'); }
  return res.json();
}
async function apiDelete(id){
  const res = await fetch('/api/dashboard/'+id, { method:'DELETE' });
  if(!res.ok){ toast('삭제 실패', true); throw new Error('delete failed'); }
  return res.json();
}

function initSocket(){
  socket = io();
  setSyncStatus('', '연결 중...');
  socket.on('connect', ()=>{ setSyncStatus('live', '실시간 공유중'); });
  socket.on('disconnect', ()=>{ setSyncStatus('error', '연결 끊김 · 재연결 시도중'); });
  socket.on('connect_error', ()=>{ setSyncStatus('error', '연결 오류'); });
  socket.on('dashboard:create', item=>{
    ITEMS.push(item); rebuildData(); renderRoute(); toast('새 항목이 추가됐습니다');
  });
  socket.on('dashboard:update', item=>{
    const idx = ITEMS.findIndex(x=>x.id===item.id);
    if(idx>=0) ITEMS[idx] = item; else ITEMS.push(item);
    rebuildData(); renderRoute();
  });
  socket.on('dashboard:delete', ({id})=>{
    ITEMS = ITEMS.filter(x=>x.id!==id); rebuildData(); renderRoute();
  });
  socket.on('dashboard:bulkcreate', ()=>{ loadInitial(); toast('데이터가 대량 갱신됐습니다'); });
}

async function loadInitial(){
  try{
    const res = await fetch('/api/dashboard');
    ITEMS = await res.json();
    rebuildData();
    renderRoute();
  }catch(e){
    console.error(e);
    setSyncStatus('error', '초기 로딩 실패');
  }
}

/* ===================== UTILS ===================== */
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function won(n){ return n==null ? '—' : '₩'+Math.round(n).toLocaleString(); }
function num(n){ return n==null ? '—' : n.toLocaleString(); }
function pct(n){ return n==null ? '—' : n.toFixed(2)+'%'; }
function roasFmt(n){ return n==null ? '—' : n.toFixed(2); }
function verdictTag(v){
  const cls = v==='성공'?'success':v==='실패'?'fail':v==='학습중'?'learning':'pending';
  return `<span class="tag ${cls}">${esc(v)}</span>`;
}
function matchTag(m){
  const cls = m==='매칭됨'?'matched':m==='매칭안됨'?'unmatched':'pending';
  return `<span class="tag ${cls}">${esc(m)}</span>`;
}
function approvalTag(a){
  if(!a) return `<span class="tag pending">—</span>`;
  const cls = a==='확정'?'confirmed':a==='검수대기'?'review':'fail';
  return `<span class="tag ${cls}">${esc(a)}</span>`;
}
function brandColor(b){ return b==='셀라딕스'?'#3182F6':b==='락토메디'?'#12B886':b==='엑스퍼트리션'?'#FF9F1C':'#8B95A1'; }
function perfFor(name, brand){ return REG().performance.find(p=>p.concept===name && p.brand===brand) || null; }
function scriptByKey(name, brand){ return REG().scripts.find(s=>s.name===name && s.brand===brand); }
const BRANDS_BY_REGION = { "대만": ["셀라딕스","락토메디","엑스퍼트리션"], "홍콩": ["셀라딕스","락토메디","엑스퍼트리션"] };
function BRANDS(){ return BRANDS_BY_REGION[currentRegion]; }
let searchTerm = '';
let currentTab = 'home';

/* 승자 인트로 = 지출(spend)이 가장 높은 인트로. 다른 지표는 판정에 쓰지 않음. */
function determineWinnerIntro(ip){
  const introNums = Object.keys(ip.intros).map(Number);
  let winner = introNums[0], maxSpend = -1;
  introNums.forEach(n=>{ const sp = ip.intros[n].spend||0; if(sp > maxSpend){ maxSpend = sp; winner = n; } });
  return winner;
}
/* 해당 소재(concept[+brand])의 dailyLog 최초 날짜부터 오늘까지 누적 일수. dailyLog가 없으면 null(판단 보류). */
function daysTrackedFor(region, name, brand){
  const log = (DATA.dailyLog[region]||[]).filter(e=>e.concept===name && (!brand || e.brand===brand));
  if(!log.length) return null;
  const minDate = log.reduce((m,e)=> (!m||e.date<m)?e.date:m, null);
  return Math.floor((parseDate(todayStr()) - parseDate(minDate)) / 86400000) + 1;
}
const MIN_TRACKING_DAYS = 7;

function highlight(name){
  const e = esc(name);
  if(!searchTerm) return e;
  const idx = e.toLowerCase().indexOf(esc(searchTerm).toLowerCase());
  if(idx<0) return e;
  return e.slice(0,idx) + '<mark>' + e.slice(idx, idx+searchTerm.length) + '</mark>' + e.slice(idx+searchTerm.length);
}

/* ===================== 대본 상세 모달 ===================== */
function openScriptModal(name, brand){
  const s = scriptByKey(name, brand);
  if(!s) return;
  const p = perfFor(name, brand);
  const ip = REG().introPerf[name];
  const body = document.getElementById('modal-body');
  let html = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3>${esc(s.name)}</h3>
    <div class="modal-meta">${esc(s.brand)} · ${esc(s.product)} ${matchTag(s.match)} ${verdictTag(s.verdict)} ${s.approval?approvalTag(s.approval):''}</div>
    ${s._matchNote?`<div class="callout" style="margin-top:0;">${esc(s._matchNote)}</div>`:''}`;
  if(s.benefits && s.benefits.length){
    html += `<div class="benefits">${s.benefits.map(b=>`<span class="tag benefit">${esc(b)}</span>`).join('')}<span class="tag ${s.benefitsSource==='sheet'?'sheet':'inferred'}">${s.benefitsSource==='sheet'?'시트 확정':'본문 추정'}</span></div>`;
  }
  html += p ? `${p.stale?'<div class="callout warn" style="margin-top:8px;"><b>최근 확인 안됨</b> — 이 수치는 마지막으로 확인된 값입니다. 재조회 시 광고가 검색되지 않아 일시중지·종료된 것으로 추정됩니다.</div>':''}
    <div class="kpi-mini">
      <div class="item"><div class="l">ROAS</div><div class="v">${roasFmt(p.roas)}</div></div>
      <div class="item"><div class="l">CTR</div><div class="v">${pct(p.ctr)}</div></div>
      <div class="item"><div class="l">CPC</div><div class="v">${p.cpc?won(p.cpc):'—'}</div></div>
      <div class="item"><div class="l">CPA</div><div class="v">${p.cpa?won(p.cpa):'—'}</div></div>
    </div>
    <div class="kpi-mini">
      <div class="item"><div class="l">노출</div><div class="v">${num(p.impressions)}</div></div>
      <div class="item"><div class="l">클릭</div><div class="v">${num(p.clicks)}</div></div>
      <div class="item"><div class="l">지출</div><div class="v">${won(p.spend)}</div></div>
      <div class="item"><div class="l">구매</div><div class="v">${num(p.purchases)}</div></div>
    </div>` : `<div class="callout" style="margin-top:8px;">아직 메타 성과 데이터가 없는 소재입니다 (매칭 전 또는 신규 개선안).</div>`;

  if(ip){
    const days = daysTrackedFor(currentRegion, name, brand);
    if(days!=null && days < MIN_TRACKING_DAYS){
      html += `<div class="block-label">인트로별 성과 분해</div><div class="callout">데이터 축적 중 (${days}/${MIN_TRACKING_DAYS}일) — 최소 ${MIN_TRACKING_DAYS}일치 데이터가 쌓이면 승자 인트로를 판정합니다.</div>`;
    } else {
      const winner = determineWinnerIntro(ip);
      const maxSpend = Math.max(...Object.values(ip.intros).map(x=>x.spend));
      html += `<div class="block-label">인트로별 성과 분해</div>`;
      Object.keys(ip.intros).sort().forEach(k=>{
        const v = ip.intros[k];
        const isWinner = Number(k)===winner;
        const w = (v.spend/maxSpend*100).toFixed(1);
        html += `<div class="introwin-row">
          <div class="il">인트로${k}${isWinner?' 👑':''}</div>
          <div class="itrack"><div class="ifill${isWinner?'':' loser'}" style="width:${w}%;"></div></div>
          <div class="inum">${won(v.spend)}</div>
        </div>`;
      });
      html += `<div class="sub" style="color:var(--muted);font-size:11.5px;margin-top:4px;">승자: 인트로${winner} (지출 기준 최고)</div>`;
    }
  }

  if(s.intent){
    html += `<div class="block-label">기획의도 <span class="tag ${s.intent.type==='상세'?'sheet':'inferred'}" style="margin-left:6px;">${esc(s.intent.type)}형</span></div>
      <div class="block-text">${esc(s.intent.text)}</div>`;
  } else {
    html += `<div class="block-label">기획의도</div><div class="callout" style="margin:0 0 8px;">기획의도 미기재 (시트/슬라이드 어디에도 없음 — 담당자 작성 예정)</div>`;
  }
  if(s.versionFlag){
    html += `<div class="callout warn"><b>${s.versionFlag.type==='mismatch'?'⚠ 불일치':'❔ 판단 보류'}</b> — ${esc(s.versionFlag.note)}</div>`;
  }

  html += `<div class="block-label">인트로 1</div><div class="block-text">${esc(s.i1)}</div>
    ${s.i2?`<div class="block-label">인트로 2</div><div class="block-text">${esc(s.i2)}</div>`:''}
    ${s.i3?`<div class="block-label">인트로 3</div><div class="block-text">${esc(s.i3)}</div>`:''}
    <div class="block-label">본문</div><div class="block-text">${esc(s.body)}</div>
    <div class="noteedit">
      <div class="block-label">팀 메모 <span class="hint" style="text-transform:none;font-weight:400;">(클릭해서 바로 수정 — 모두에게 실시간 공유됨)</span></div>
      <div class="block-text" contenteditable="true" id="note-edit" data-id="${s._id}">${esc(s.note||'')}</div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;align-items:flex-end;">
      <div><div class="col-label">성과판정</div><select class="inline" id="modal-verdict-sel">${['성공','실패','학습중','미판정'].map(v=>`<option${v===s.verdict?' selected':''}>${v}</option>`).join('')}</select></div>
      <div><div class="col-label">승인상태</div><select class="inline" id="modal-approval-sel">${['','확정','검수대기','반려'].map(v=>`<option value="${v}"${(v||null)===s.approval || (v===''&&!s.approval)?' selected':''}>${v||'—'}</option>`).join('')}</select></div>
      <button id="modal-delete-btn" style="background:var(--danger-dim);color:var(--danger);border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;">이 소재 삭제</button>
    </div>`;
  body.innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
  const ne = document.getElementById('note-edit');
  ne.addEventListener('blur', ()=>{
    apiUpdate(s._id, { note: ne.textContent.trim() }).then(()=>toast('저장됨 ✓'));
  });
  document.getElementById('modal-verdict-sel').addEventListener('change', e=>{
    apiUpdate(s._id, { verdict: e.target.value }).then(()=>toast('저장됨 ✓'));
  });
  document.getElementById('modal-approval-sel').addEventListener('change', e=>{
    apiUpdate(s._id, { approval: e.target.value || null }).then(()=>toast('저장됨 ✓'));
  });
  document.getElementById('modal-delete-btn').addEventListener('click', ()=>{
    if(!confirm(`'${s.name}' 소재를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    apiDelete(s._id).then(()=>{ closeModal(); toast('삭제됨'); });
  });
}
function closeModal(){ document.getElementById('modal-overlay').classList.remove('open'); }
document.getElementById('modal-overlay').addEventListener('click', e=>{ if(e.target.id==='modal-overlay') closeModal(); });

/* ===================== 소재 추가 모달 ===================== */
function openAddConceptModal(){
  const body = document.getElementById('modal-body');
  const brandOptions = BRANDS().map(b=>`<option>${esc(b)}</option>`).join('');
  body.innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3>새 소재 추가 — ${esc(currentRegion)}</h3>
    <div class="modal-meta">추가 즉시 접속한 모든 사람의 화면에 실시간으로 반영됩니다.</div>
    <div class="block-label">컨셉명</div><input id="add-name" class="block-text" style="width:100%;border:1px solid var(--border);" placeholder="예: 신규할인훅" />
    <div class="block-label">브랜드</div><select id="add-brand" class="inline" style="width:100%;padding:8px;">${brandOptions}</select>
    <div class="block-label">제품</div><input id="add-product" class="block-text" style="width:100%;border:1px solid var(--border);" placeholder="예: 131앰플" />
    <div class="block-label">인트로 1</div><textarea id="add-i1" class="block-text" style="width:100%;border:1px solid var(--border);min-height:60px;"></textarea>
    <div class="block-label">본문</div><textarea id="add-body" class="block-text" style="width:100%;border:1px solid var(--border);min-height:90px;"></textarea>
    <div style="margin-top:16px;"><button id="add-save-btn" style="background:var(--primary);color:#fff;border:none;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;">추가하기</button></div>
  `;
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('add-save-btn').addEventListener('click', async ()=>{
    const name = document.getElementById('add-name').value.trim();
    if(!name){ toast('컨셉명을 입력하세요', true); return; }
    const fields = {
      type:'concept', region: currentRegion,
      name, brand: document.getElementById('add-brand').value, product: document.getElementById('add-product').value.trim() || null,
      match:'미시도', verdict:'미판정', approval:null, note:'',
      i1: document.getElementById('add-i1').value.trim() || null, i2:null, i3:null,
      body: document.getElementById('add-body').value.trim() || null,
      benefits:[], benefitsSource:'inferred', intent:null, versionFlag:null,
      order: Date.now()
    };
    await apiCreate(fields);
    closeModal();
    toast('소재가 추가됐습니다 ✓');
  });
}

/* ===================== AGGREGATES ===================== */
function brandStats(brand){
  const rows = REG().performance.filter(r=>r.brand===brand && !r.isCampaignLevel);
  const roasRows = rows.filter(r=>r.roas!=null);
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
  return {
    count: rows.length,
    spend: rows.reduce((a,r)=>a+r.spend,0),
    purchases: rows.reduce((a,r)=>a+r.purchases,0),
    avgCtr: avg(rows.map(r=>r.ctr)),
    avgCpc: avg(rows.map(r=>r.cpc)),
    avgRoas: avg(roasRows.map(r=>r.roas)),
    successCount: REG().scripts.filter(s=>s.brand===brand && s.verdict==='성공').length,
    learningCount: REG().scripts.filter(s=>s.brand===brand && s.verdict==='학습중').length,
  };
}

/* ===================== HOME ===================== */
function renderHome(){
  const total = REG().scripts.length;
  const matched = REG().scripts.filter(s=>s.match==='매칭됨').length;
  const totalSpend = REG().performance.filter(r=>!r.isCampaignLevel).reduce((a,r)=>a+r.spend,0);
  const roasRows = REG().performance.filter(r=>r.roas!=null && !r.isCampaignLevel);
  const avgRoas = roasRows.length ? roasRows.reduce((a,r)=>a+r.roas,0)/roasRows.length : null;
  const empty = total===0;
  const html = `
  <div class="hero">
    <h1>${esc(currentRegion)} 소재, <span class="accent">데이터</span>로<br>검증하고 개선하다</h1>
    <p>${esc(currentRegion)}파트 자체컨텐츠의 메타 성과를 자동으로 모으고, 인트로 단위까지 쪼개서 무엇이 왜 잘 되고 안 되는지 확인합니다.</p>
    ${empty?`<div class="callout warn" style="max-width:520px;margin:0 auto 24px;text-align:left;">${REG().dataIssues && REG().dataIssues[0] ? `<b>${esc(REG().dataIssues[0].issue)}</b> — ${esc(REG().dataIssues[0].detail)}` : '아직 데이터가 없습니다.'}</div>`:''}
    <div class="hero-tiles">
      <div class="hero-tile"><div class="l">전체 소재</div><div class="v">${total}개</div></div>
      <div class="hero-tile"><div class="l">메타 매칭</div><div class="v" style="color:var(--success)">${matched}개</div></div>
      <div class="hero-tile"><div class="l">누적 지출</div><div class="v">${won(totalSpend)}</div></div>
      <div class="hero-tile"><div class="l">평균 ROAS</div><div class="v" style="color:${avgRoas>=1.8?'var(--success)':'var(--danger)'}">${roasFmt(avgRoas)}</div></div>
    </div>
    <div class="hero-nav">
      <div class="hero-nav-card" data-tab="search"><span class="ic">🔍</span><div class="t">소재 검색</div><div class="d">컨셉명으로 찾아 대본·성과·기획의도를 바로 확인</div></div>
      <div class="hero-nav-card" data-tab="meta"><span class="ic">📡</span><div class="t">메타현황판</div><div class="d">기간·브랜드·SM캠페인·광고세트·소재명으로 드릴다운하는 성과 그래프</div></div>
      <div class="hero-nav-card" data-tab="lowperf"><span class="ic">🔻</span><div class="t">저효율 인트로+개선방안</div><div class="d">AI가 분석한 저조한 인트로와 수정 제안</div></div>
    </div>
  </div>`;
  document.getElementById('shell').innerHTML = html;
  document.querySelectorAll('.hero-nav-card').forEach(el=>el.addEventListener('click', ()=>goTab(el.dataset.tab)));
}

/* 브랜드 평균 대비 ROAS/CPA가 우수한 소재("주목해야할 소재")를 찾고, 그 소재들의 공통점을 요약한다. */
function computeStandouts(){
  const perfList = REG().performance.filter(p=>!p.isCampaignLevel);
  const byBrand = {};
  perfList.forEach(p=>{
    if(!byBrand[p.brand]) byBrand[p.brand] = { roasSum:0, roasCount:0, cpaSum:0, cpaCount:0 };
    const b = byBrand[p.brand];
    if(p.roas!=null){ b.roasSum+=p.roas; b.roasCount++; }
    if(p.cpa!=null){ b.cpaSum+=p.cpa; b.cpaCount++; }
  });
  const avg = {};
  Object.entries(byBrand).forEach(([b,v])=>{ avg[b] = { roas: v.roasCount? v.roasSum/v.roasCount:null, cpa: v.cpaCount? v.cpaSum/v.cpaCount:null }; });

  const standouts = {};
  REG().scripts.forEach(s=>{
    const p = perfFor(s.name, s.brand);
    if(!p || !(p.purchases>0)) return;
    const a = avg[s.brand]; if(!a) return;
    const roasGood = p.roas!=null && a.roas!=null && p.roas >= a.roas*1.2;
    const cpaGood = p.cpa!=null && a.cpa!=null && p.cpa <= a.cpa*0.8;
    if(roasGood || cpaGood){
      (standouts[s.brand] = standouts[s.brand]||[]).push(s);
    }
  });

  const reasons = {};
  Object.entries(standouts).forEach(([brand, list])=>{
    const benefitCount = {};
    list.forEach(s=> (s.benefits||[]).forEach(b=> benefitCount[b]=(benefitCount[b]||0)+1));
    const topBenefits = Object.entries(benefitCount).sort((a,b)=>b[1]-a[1]).filter(([,c])=>c>=2).slice(0,2).map(([b])=>b);
    const detailedCount = list.filter(s=>s.intent && s.intent.type==='상세').length;
    const parts = [];
    if(topBenefits.length) parts.push(`'${topBenefits.join("', '")}' 혜택요소를 공통으로 사용`);
    if(detailedCount>0 && detailedCount >= Math.ceil(list.length/2)) parts.push(`${detailedCount}/${list.length}개가 데이터 기반 상세 기획의도로 설계됨`);
    if(!parts.length) parts.push(`${list.length}개 소재가 브랜드 평균 대비 ROAS·CPA 우수`);
    reasons[brand] = `이 소재들이 잘 되는 이유: ${parts.join(', ')}`;
  });

  const standoutSet = new Set();
  Object.entries(standouts).forEach(([brand,list])=>list.forEach(s=>standoutSet.add(s.name+'|'+brand)));
  return { standoutSet, reasons };
}

/* ===================== 검색 ===================== */
function renderSearch(){
  const brands = ['전체', ...BRANDS()];
  let html = `
  <div class="search-hero">
    <div class="search-box"><span class="ic">🔍</span><input id="search-input" type="text" placeholder="소재명으로 검색... (예: 왜정가주고사)" value="${esc(searchTerm)}" /></div>
    <div class="search-filters">
      <select id="f-brand">${brands.map(b=>`<option>${esc(b)}</option>`).join('')}</select>
      <select id="f-verdict">${['전체','성공','실패','학습중','미판정'].map(v=>`<option>${esc(v)}</option>`).join('')}</select>
      <select id="f-match">${['전체','매칭됨','매칭안됨','미시도'].map(v=>`<option>${esc(v)}</option>`).join('')}</select>
      <button id="add-concept-btn" style="background:var(--primary);color:#fff;border:none;border-radius:10px;padding:8px 16px;font-size:12.5px;font-weight:700;cursor:pointer;">+ 새 소재 추가</button>
    </div>
  </div>
  <div id="search-results"></div>`;
  document.getElementById('shell').innerHTML = html;

  function draw(){
    const fb = document.getElementById('f-brand').value;
    const fv = document.getElementById('f-verdict').value;
    const fm = document.getElementById('f-match').value;
    const term = searchTerm.trim().toLowerCase();
    const rows = REG().scripts.filter(s =>
      (fb==='전체'||s.brand===fb) &&
      (fv==='전체'||s.verdict===fv) &&
      (fm==='전체'||s.match===fm) &&
      (!term || s.name.toLowerCase().includes(term))
    );
    const box = document.getElementById('search-results');
    if(!rows.length){ box.innerHTML = `<div class="callout" style="text-align:center;">검색 결과가 없습니다.</div>`; return; }
    const { standoutSet, reasons } = computeStandouts();
    box.innerHTML = rows.map(s=>{
      const p = perfFor(s.name, s.brand);
      const ip = REG().introPerf[s.name];
      const ipDays = ip ? daysTrackedFor(currentRegion, s.name, s.brand) : null;
      const ipReady = ip && !(ipDays!=null && ipDays < MIN_TRACKING_DAYS);
      const isStandout = standoutSet.has(s.name+'|'+s.brand);
      const reasonText = isStandout ? (reasons[s.brand]||'') : '';
      return `<div class="result-card" data-name="${esc(s.name)}" data-brand="${esc(s.brand)}">
        <div class="rc-head">
          <span class="rc-name">${highlight(s.name)}</span>
          ${matchTag(s.match)} ${verdictTag(s.verdict)} ${s.approval?approvalTag(s.approval):''}
          ${isStandout?`<span class="tag standout standout-badge" title="${esc(reasonText)}" data-reason="${esc(reasonText)}">🔥 주목해야할 소재</span>`:''}
        </div>
        <div class="rc-meta">${esc(s.brand)} · ${esc(s.product)}${ipReady?` · 승자 인트로${determineWinnerIntro(ip)}`:ip?` · 데이터 축적 중 (${ipDays}/${MIN_TRACKING_DAYS}일)`:''}</div>
        ${p ? `<div class="rc-stats" style="margin-top:8px;">
          <span>지출 <b>${won(p.spend)}</b></span>
          <span>ROAS <b>${roasFmt(p.roas)}</b></span>
          <span>CTR <b>${pct(p.ctr)}</b></span>
          <span>CPC <b>${p.cpc?won(p.cpc):'—'}</b></span>
          <span>CPA <b>${p.cpa?won(p.cpa):'—'}</b></span>
          <span>구매 <b>${num(p.purchases)}</b></span>
          ${p.stale?'<span class="tag stale">최근 확인 안됨</span>':''}
        </div>` : `<div class="rc-meta" style="margin-top:6px;">아직 성과 데이터 없음</div>`}
      </div>`;
    }).join('');
    box.querySelectorAll('.result-card').forEach(el=>{
      el.addEventListener('click', ()=>openScriptModal(el.dataset.name, el.dataset.brand));
    });
    box.querySelectorAll('.standout-badge').forEach(el=>{
      el.addEventListener('click', e=>{ e.stopPropagation(); toast(el.dataset.reason); });
    });
  }
  document.getElementById('search-input').addEventListener('input', e=>{ searchTerm = e.target.value; draw(); });
  document.getElementById('f-brand').addEventListener('change', draw);
  document.getElementById('f-verdict').addEventListener('change', draw);
  document.getElementById('f-match').addEventListener('change', draw);
  document.getElementById('add-concept-btn').addEventListener('click', openAddConceptModal);
  draw();
  setTimeout(()=>document.getElementById('search-input').focus(), 50);
}

/* ===================== 메타현황판 (성과추이 + 일별/주별/월별 추이 통합) ===================== */
let metaPeriod = 'day';
let metaBrand = '전체';
let metaCampaign = '전체';
let metaAdset = '전체';
let metaAdSearch = '';
let metaMetric = '전체';
let metaAnchor = null;
let metaChartInstance = null;

function smLogForRegion(){ return DATA.smLog[currentRegion] || []; }

/* 캠페인 롤업(concept, isCampaignLevel:true)의 dailyLog는 신규 SM 광고 단위 데이터와 겹치므로 통합 뷰에서 제외 */
function rollupConceptNames(){
  return new Set(REG().performance.filter(p=>p.isCampaignLevel).map(p=>p.concept));
}

function combinedMetaLog(){
  const rollups = rollupConceptNames();
  const conceptRows = (DATA.dailyLog[currentRegion]||[])
    .filter(e=>!rollups.has(e.concept))
    .map(e=>({
      date:e.date, brand:e.brand, spend:e.spend||0, clicks:e.clicks||0, purchases:e.purchases||0, roas:e.roas,
      campaignName:null, adsetName:null, label:e.concept
    }));
  const smRows = smLogForRegion().map(e=>({
    date:e.date, brand:e.brand, spend:e.spend||0, clicks:e.clicks||0, purchases:e.purchases||0, roas:e.roas,
    campaignName:e.campaignName, adsetName:e.adsetName, label:e.adName
  }));
  return conceptRows.concat(smRows);
}

function smCampaignsForBrand(brand){
  return Array.from(new Set(smLogForRegion().filter(e=>brand==='전체'||e.brand===brand).map(e=>e.campaignName))).sort();
}
function smAdsetsFor(brand, campaign){
  if(campaign==='전체') return [];
  return Array.from(new Set(smLogForRegion().filter(e=>(brand==='전체'||e.brand===brand) && e.campaignName===campaign).map(e=>e.adsetName))).sort();
}

function refreshMetaCampaignOptions(){
  const sel = document.getElementById('meta-campaign'); if(!sel) return;
  const names = smCampaignsForBrand(metaBrand);
  if(!names.includes(metaCampaign)) metaCampaign = '전체';
  sel.innerHTML = `<option value="전체">전체 캠페인</option>` + names.map(n=>`<option ${metaCampaign===n?'selected':''}>${esc(n)}</option>`).join('');
}
function refreshMetaAdsetOptions(){
  const sel = document.getElementById('meta-adset'); if(!sel) return;
  const names = smAdsetsFor(metaBrand, metaCampaign);
  if(!names.includes(metaAdset)) metaAdset = '전체';
  sel.innerHTML = `<option value="전체">전체 광고세트</option>` + names.map(n=>`<option ${metaAdset===n?'selected':''}>${esc(n)}</option>`).join('');
  sel.disabled = metaCampaign==='전체';
}

function renderMeta(){
  if(!metaAnchor){
    const all = combinedMetaLog();
    const latest = all.reduce((m,e)=> (!m||e.date>m)?e.date:m, null);
    metaAnchor = parseDate(latest || todayStr());
  }

  let html = `<div class="page-head"><h2>메타현황판</h2><div class="sub">성과추이 · 일별/주별/월별 추이를 하나로 통합했습니다 — 기간 · 브랜드 · SM캠페인 · 광고세트 · 소재명으로 드릴다운해서 확인하세요</div></div>`;
  html += `<div class="callout">일반 소재 데이터는 "오늘 스냅샷 기록" 버튼으로, SM캠페인 데이터는 채팅에서 갱신을 요청하면 최신화됩니다 (둘 다 자동 갱신은 아닙니다).</div>`;
  html += `<div class="filter-bar">
    <select id="meta-period">
      ${[['day','일단위'],['week','주단위'],['month','월단위'],['all','전체 기간']].map(([v,l])=>`<option value="${v}" ${metaPeriod===v?'selected':''}>${l}</option>`).join('')}
    </select>
    <select id="meta-brand">
      <option value="전체" ${metaBrand==='전체'?'selected':''}>전체 브랜드</option>
      ${BRANDS().map(b=>`<option ${metaBrand===b?'selected':''}>${esc(b)}</option>`).join('')}
    </select>
    <select id="meta-campaign"></select>
    <select id="meta-adset"></select>
    <input id="meta-adsearch" type="text" placeholder="소재명(광고명) 검색..." value="${esc(metaAdSearch)}" style="min-width:160px;" />
    <button id="meta-snapshot-btn" style="background:var(--primary);color:#fff;border:none;border-radius:10px;padding:8px 16px;font-size:12.5px;font-weight:700;cursor:pointer;">+ 오늘 스냅샷 기록</button>
  </div>`;

  const hasAny = combinedMetaLog().length > 0;
  if(!hasAny){
    html += `<div class="callout warn"><b>누적된 데이터가 없습니다.</b> "오늘 스냅샷 기록" 버튼을 눌러 첫 데이터를 쌓아보세요.</div>`;
    document.getElementById('shell').innerHTML = html;
    refreshMetaCampaignOptions(); refreshMetaAdsetOptions();
    document.getElementById('meta-snapshot-btn').addEventListener('click', recordDailySnapshot);
    return;
  }

  html += `<div class="card">
    <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:10px;">
      <button id="meta-prev" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:5px 12px;font-size:13px;font-weight:700;cursor:pointer;">◀</button>
      <span id="meta-range-label" style="font-size:13.5px;font-weight:700;color:var(--text);min-width:220px;text-align:center;"></span>
      <button id="meta-next" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:5px 12px;font-size:13px;font-weight:700;cursor:pointer;">▶</button>
    </div>
    <canvas id="meta-chart" height="90"></canvas>
  </div>`;
  html += `<div class="section-title" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <span>구간별 지표 <span class="hint">지출 금액 · 구매수 · 평균 ROAS · CPC · CPA</span></span>
    <select id="meta-metric" style="margin-left:auto;">
      ${[['전체','전체 지표'],...Object.entries(DAILY_METRICS).map(([k,m])=>[k,m.label])].map(([v,l])=>`<option value="${v}" ${metaMetric===v?'selected':''}>${l}</option>`).join('')}
    </select>
  </div>
  <div class="card" style="overflow-x:auto;"><table id="meta-interval-table"></table></div>`;

  html += `<div class="section-title" id="meta-rank-title">지출 순위</div>`;
  html += `<div class="card" id="meta-rank-bars"></div>`;
  html += `<div class="card" style="overflow-x:auto;"><table id="meta-rank-table"></table></div>`;

  document.getElementById('shell').innerHTML = html;
  refreshMetaCampaignOptions();
  refreshMetaAdsetOptions();

  function draw(){
    metaPeriod = document.getElementById('meta-period').value;
    metaBrand = document.getElementById('meta-brand').value;
    metaCampaign = document.getElementById('meta-campaign').value;
    metaAdset = document.getElementById('meta-adset').value;
    metaAdSearch = document.getElementById('meta-adsearch').value;
    metaMetric = document.getElementById('meta-metric').value;

    const term = metaAdSearch.trim().toLowerCase();
    const filtered = combinedMetaLog().filter(e=>
      (metaBrand==='전체'||e.brand===metaBrand) &&
      (metaCampaign==='전체'||e.campaignName===metaCampaign) &&
      (metaAdset==='전체'||e.adsetName===metaAdset) &&
      (!term || e.label.toLowerCase().includes(term))
    );

    const sortedDates = filtered.map(e=>e.date).sort();
    const dateRange = sortedDates.length ? { min: sortedDates[0], max: sortedDates[sortedDates.length-1] } : null;
    const { buckets, rangeLabel, prev, next } = getBuckets(metaPeriod, metaAnchor, dateRange);
    document.getElementById('meta-range-label').textContent = rangeLabel;
    const isAll = metaPeriod === 'all' || metaPeriod === 'month';
    document.getElementById('meta-prev').style.visibility = isAll ? 'hidden' : 'visible';
    document.getElementById('meta-next').style.visibility = isAll ? 'hidden' : 'visible';

    const agg = buckets.map(b => aggregateBucket(filtered.filter(b.match)));
    const labels = buckets.map(b=>b.label);

    const ctx = document.getElementById('meta-chart').getContext('2d');
    if(metaChartInstance) metaChartInstance.destroy();
    if(metaMetric === '전체'){
      const spendData = agg.map(a=>a.spend);
      const roasData = agg.map(a=>a.avgRoas);
      metaChartInstance = new Chart(ctx, {
        data: { labels, datasets: [
          {type:'bar', label:'지출 금액', data:spendData, backgroundColor:'rgba(49,130,246,.35)', yAxisID:'y'},
          {type:'line', label:'평균 ROAS', data:roasData, borderColor:'#12B886', backgroundColor:'#12B886', yAxisID:'y1', tension:.3, spanGaps:true}
        ]},
        options: {
          responsive:true, interaction:{ mode:'index', intersect:false },
          plugins:{ tooltip:{ callbacks:{ label:(c)=> c.dataset.yAxisID==='y' ? `지출 금액: ${won(c.raw)}` : `평균 ROAS: ${c.raw==null?'—':c.raw.toFixed(2)}` } } },
          scales:{
            y:{ position:'left', title:{display:true,text:'지출 금액(원)'}, ticks:{ callback:(v)=>won(v) } },
            y1:{ position:'right', title:{display:true,text:'평균 ROAS'}, grid:{drawOnChartArea:false} }
          }
        }
      });
    } else {
      const m = DAILY_METRICS[metaMetric];
      const data = agg.map(a=>m.get(a));
      metaChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label:m.label, data, backgroundColor:m.color }] },
        options: {
          responsive:true,
          plugins:{ tooltip:{ callbacks:{ label:(c)=> `${m.label}: ${m.fmt(c.raw)}` } } },
          scales:{ y:{ title:{display:true,text:m.label}, ticks:{ callback:(v)=>m.fmt(v) } } }
        }
      });
    }

    const cols = [
      { key:'label', header:'구간', num:false },
      { key:'spend', header:'지출 금액', num:true },
      { key:'purchases', header:'구매수', num:true },
      { key:'roas', header:'평균 ROAS', num:true },
      { key:'cpc', header:'CPC', num:true },
      { key:'cpa', header:'CPA', num:true }
    ];
    const table = document.getElementById('meta-interval-table');
    table.innerHTML = `<tr>${cols.map(c=>`<th class="${c.num?'num':''}${metaMetric===c.key?' metric-active':''}">${c.header}</th>`).join('')}</tr>` +
      buckets.map((b,i)=>{
        const a = agg[i];
        const values = { label: esc(b.label), spend: won(a.spend), purchases: num(a.purchases), roas: roasFmt(a.avgRoas), cpc: won(a.cpc), cpa: won(a.cpa) };
        return `<tr>${cols.map(c=>`<td class="${c.num?'num':''}${metaMetric===c.key?' metric-active':''}">${values[c.key]}</td>`).join('')}</tr>`;
      }).join('');

    document.getElementById('meta-prev').onclick = ()=>{ metaAnchor = prev(); draw(); };
    document.getElementById('meta-next').onclick = ()=>{ metaAnchor = next(); draw(); };

    /* 랭킹: 드릴다운 단계에 따라 캠페인 → 광고세트 → 광고(소재명) 단위로 그룹핑 */
    const groupKey = metaAdset!=='전체' ? (e=>e.label) : metaCampaign!=='전체' ? (e=>e.adsetName||e.label) : (e=>e.campaignName||e.label);
    const rankTitle = metaAdset!=='전체' ? '광고(소재명)별 성과' : metaCampaign!=='전체' ? '광고세트별 성과' : '캠페인/소재별 성과';
    document.getElementById('meta-rank-title').innerHTML = `${rankTitle} <span class="hint">클릭하면 드릴다운${metaCampaign==='전체'?' · 일반 소재는 대본 보기':''}</span>`;

    const groups = {};
    filtered.forEach(e=>{
      const k = groupKey(e);
      if(!groups[k]) groups[k] = { key:k, spend:0, purchases:0, clicks:0, roasSum:0, roasCount:0, brand:e.brand, hasCampaign:false, kind: metaAdset!=='전체'?'ad':metaCampaign!=='전체'?'adset':'campaign' };
      const g = groups[k];
      g.spend += e.spend; g.purchases += e.purchases; g.clicks += e.clicks;
      if(e.campaignName) g.hasCampaign = true;
      if(e.roas!=null){ g.roasSum += e.roas; g.roasCount++; }
    });
    const rankRows = Object.values(groups).map(g=>({
      ...g, avgRoas: g.roasCount? g.roasSum/g.roasCount : null,
      cpc: g.clicks? g.spend/g.clicks : null,
      cpa: g.purchases? g.spend/g.purchases : null
    })).sort((a,b)=>b.spend-a.spend);

    const maxSpend = Math.max(1, ...rankRows.map(r=>r.spend));
    const barsEl = document.getElementById('meta-rank-bars');
    barsEl.innerHTML = rankRows.map(r=>{
      const w = (r.spend/maxSpend*100).toFixed(1);
      return `<div class="barrow clickable" data-key="${esc(r.key)}" data-kind="${r.kind}" data-hascampaign="${r.hasCampaign}" data-brand="${esc(r.brand)}">
        <div class="bl">${esc(r.key)}</div>
        <div class="btrack"><div class="bfill" style="width:${w}%;background:${brandColor(r.brand)};"></div></div>
        <div class="bnum">${won(r.spend)}</div>
      </div>`;
    }).join('');

    const rankTable = document.getElementById('meta-rank-table');
    rankTable.innerHTML = `<tr><th>이름</th><th>브랜드</th><th class="num">지출</th><th class="num">CPC</th><th class="num">CPA</th><th class="num">ROAS</th><th class="num">구매</th></tr>` +
      rankRows.map(r=>`<tr class="clickable" data-key="${esc(r.key)}" data-kind="${r.kind}" data-hascampaign="${r.hasCampaign}" data-brand="${esc(r.brand)}">
        <td class="name-link">${esc(r.key)}</td><td>${esc(r.brand)}</td>
        <td class="num">${won(r.spend)}</td><td class="num">${r.cpc?won(r.cpc):'—'}</td><td class="num">${r.cpa?won(r.cpa):'—'}</td>
        <td class="num">${roasFmt(r.avgRoas)}</td><td class="num">${num(r.purchases)}</td>
      </tr>`).join('');

    function handleRankClick(el){
      const key = el.dataset.key, kind = el.dataset.kind, hasCampaign = el.dataset.hascampaign==='true', brand = el.dataset.brand;
      if(!hasCampaign){ openScriptModal(key, brand); return; }
      if(kind==='campaign'){
        metaCampaign = key; metaAdset = '전체';
        refreshMetaCampaignOptions(); refreshMetaAdsetOptions(); draw();
      } else if(kind==='adset'){
        metaAdset = key;
        refreshMetaAdsetOptions(); draw();
      } else {
        const g = groups[key];
        toast(`${key} · 지출 ${won(g?g.spend:0)} · 구매 ${num(g?g.purchases:0)} · ROAS ${roasFmt(g?(g.roasCount?g.roasSum/g.roasCount:null):null)}`);
      }
    }
    barsEl.querySelectorAll('.barrow.clickable').forEach(el=>el.addEventListener('click', ()=>handleRankClick(el)));
    rankTable.querySelectorAll('tr.clickable').forEach(el=>el.addEventListener('click', ()=>handleRankClick(el)));
  }

  document.getElementById('meta-period').addEventListener('change', draw);
  document.getElementById('meta-brand').addEventListener('change', ()=>{ metaBrand = document.getElementById('meta-brand').value; refreshMetaCampaignOptions(); refreshMetaAdsetOptions(); draw(); });
  document.getElementById('meta-campaign').addEventListener('change', ()=>{ metaCampaign = document.getElementById('meta-campaign').value; metaAdset='전체'; refreshMetaAdsetOptions(); draw(); });
  document.getElementById('meta-adset').addEventListener('change', draw);
  document.getElementById('meta-adsearch').addEventListener('input', draw);
  document.getElementById('meta-metric').addEventListener('change', draw);
  document.getElementById('meta-snapshot-btn').addEventListener('click', recordDailySnapshot);
  draw();
}

/* ===================== 저효율 인트로+개선방안 ===================== */
let lowPerfRefreshing = false;
async function refreshLowPerf(){
  if(lowPerfRefreshing) return;
  lowPerfRefreshing = true;
  const btn = document.getElementById('lowperf-refresh-btn');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ 갱신 중...'; }
  try{
    const res = await fetch('/api/dashboard');
    ITEMS = await res.json();
    rebuildData();
  }catch(e){
    toast('새로고침 실패', true);
  }finally{
    lowPerfRefreshing = false;
    renderLowPerf();
    toast('최신 데이터로 갱신됐습니다 ✓');
  }
}

function renderLowPerf(){
  if(!Object.keys(REG().introPerf).length){
    document.getElementById('shell').innerHTML = `<div class="page-head"><h2>저효율 인트로+개선방안</h2></div><div class="callout warn">${esc(currentRegion)} 인트로 비교 데이터가 아직 없습니다.</div>`;
    return;
  }
  const allRows = Object.entries(REG().introPerf).map(([name, ip])=>{
    const sc = REG().scripts.find(s=>s.name===name);
    const brand = sc?sc.brand:'';
    const days = daysTrackedFor(currentRegion, name, brand);
    if(days!=null && days < MIN_TRACKING_DAYS){
      return { name, brand, pending:true, days };
    }
    const winner = determineWinnerIntro(ip);
    const introNums = Object.keys(ip.intros).map(Number);
    const loserNum = introNums.filter(n=>n!==winner).sort((a,b)=>ip.intros[a].spend-ip.intros[b].spend)[0];
    const loser = ip.intros[String(loserNum)];
    const winnerData = ip.intros[String(winner)];
    const loserText = sc ? (loserNum===1?sc.i1:loserNum===2?sc.i2:sc.i3) : '';
    const winnerText = sc ? (winner===1?sc.i1:winner===2?sc.i2:sc.i3) : '';
    const shareOfWinner = winnerData.spend ? (loser.spend/winnerData.spend*100) : 0;
    return {name, brand, pending:false, loserNum, loser, loserText, winnerNum:winner, winnerText, shareOfWinner, stale:ip.stale};
  }).sort((a,b)=> a.pending===b.pending ? (a.pending?0:a.shareOfWinner-b.shareOfWinner) : (a.pending? 1:-1) );

  let html = `<div class="page-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
    <div><h2>저효율 인트로 + 개선방안</h2><div class="sub">각 소재 내에서 지출(spend)이 가장 높은 인트로를 승자로 보고, 나머지 중 지출이 가장 낮은 인트로를 저효율로 비교합니다. AI 피드백은 사람 검수 없이 바로 게재된 참고용 분석입니다.</div></div>
    <button id="lowperf-refresh-btn" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;">🔄 새로고침</button>
  </div>`;
  html += `<div class="callout">최초 집행일 기준 ${MIN_TRACKING_DAYS}일 미만 누적된 소재는 "데이터 축적 중"으로 표시하고 승자 판정을 하지 않습니다.</div>`;
  allRows.forEach(r=>{
    if(r.pending){
      html += `<div class="lowperf-card">
        <div class="head">
          <span class="name clickable" data-name="${esc(r.name)}" data-brand="${esc(r.brand)}" style="cursor:pointer;color:var(--primary);">${esc(r.name)}</span>
          <span class="meta">${esc(r.brand)} <span class="tag learning" style="margin-left:6px;">데이터 축적 중 (${r.days}/${MIN_TRACKING_DAYS}일)</span></span>
        </div>
      </div>`;
      return;
    }
    const fb = REG().lowPerfFeedback[r.name];
    html += `<div class="lowperf-card">
      <div class="head">
        <span class="name clickable" data-name="${esc(r.name)}" data-brand="${esc(r.brand)}" style="cursor:pointer;color:var(--primary);">${esc(r.name)}</span>
        <span class="meta">${esc(r.brand)} · 인트로${r.loserNum} 지출 ${won(r.loser.spend)} (승자 인트로${r.winnerNum}의 ${r.shareOfWinner.toFixed(0)}% 수준)
        ${fb && !fb.reliable?'<span class="tag pending" style="margin-left:6px;">표본 부족 주의</span>':''}
        ${r.stale?'<span class="tag stale" style="margin-left:6px;">최근 확인 안됨</span>':''}</span>
      </div>
      <div class="lowperf-grid">
        <div>
          <div class="col-label">저효율 인트로${r.loserNum}</div>
          <div class="block-text" style="margin-bottom:10px;">${esc(r.loserText||'')}</div>
          <div class="col-label">승자 인트로${r.winnerNum} (비교용)</div>
          <div class="block-text" style="opacity:.7;">${esc(r.winnerText||'')}</div>
        </div>
        <div>
          <div class="col-label">🤖 AI 피드백</div>
          <div class="ai-feedback">
            <div class="fb-block"><b>왜 저조했는지</b><br>${esc(fb?fb.reason:'분석 데이터 없음')}</div>
            <div class="fb-block"><b>이렇게 수정해보세요</b><br>${esc(fb?fb.suggestion:'')}</div>
          </div>
        </div>
      </div>
    </div>`;
  });
  document.getElementById('shell').innerHTML = html;
  document.querySelectorAll('.lowperf-card .name.clickable').forEach(el=>{
    el.addEventListener('click', ()=>openScriptModal(el.dataset.name, el.dataset.brand));
  });
  document.getElementById('lowperf-refresh-btn').addEventListener('click', refreshLowPerf);
}

/* ===================== 기간 버킷/집계 유틸 (메타현황판에서 사용) ===================== */
const DAILY_METRICS = {
  spend:     { label: '지출 금액',   get:a=>a.spend,    fmt: won,     color: 'rgba(49,130,246,.55)' },
  purchases: { label: '구매수',      get:a=>a.purchases, fmt: num,     color: 'rgba(18,184,134,.55)' },
  roas:      { label: '평균 ROAS',  get:a=>a.avgRoas,  fmt: roasFmt, color: 'rgba(255,159,28,.55)' },
  cpc:       { label: 'CPC',        get:a=>a.cpc,       fmt: won,     color: 'rgba(139,149,161,.55)' },
  cpa:       { label: 'CPA',        get:a=>a.cpa,       fmt: won,     color: 'rgba(224,49,49,.55)' }
};

function todayStr(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function parseDate(s){ return new Date(s+'T00:00:00'); }
function ymd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function mdLabel(d){ return String(d.getMonth()+1)+'/'+String(d.getDate()); }
function addDays(d,n){ const nd=new Date(d); nd.setDate(nd.getDate()+n); return nd; }
function addMonths(d,n){ const nd=new Date(d); nd.setMonth(nd.getMonth()+n); return nd; }
function addYears(d,n){ const nd=new Date(d); nd.setFullYear(nd.getFullYear()+n); return nd; }
function mondayOf(d){
  const nd = new Date(d); nd.setHours(0,0,0,0);
  const wd = (nd.getDay()+6)%7;
  nd.setDate(nd.getDate()-wd);
  return nd;
}
const WEEKDAY_KO = ['월','화','수','목','금','토','일'];

function getBuckets(period, anchor, dateRange){
  if(period==='all'){
    if(!dateRange){
      return { buckets: [], rangeLabel: '데이터 없음', prev:()=>anchor, next:()=>anchor };
    }
    const start = parseDate(dateRange.min);
    const end = parseDate(todayStr());
    const days = [];
    for(let d=start; d<=end; d=addDays(d,1)) days.push(d);
    const rangeLabel = `${dateRange.min} ~ ${todayStr()} (최초 집행일부터 전체 ${days.length}일)`;
    const buckets = days.map(d=>({ key: ymd(d), label: mdLabel(d), match: e=>e.date===ymd(d) }));
    return { buckets, rangeLabel, prev:()=>anchor, next:()=>anchor };
  }
  if(period==='day'){
    const monday = mondayOf(anchor);
    const days = Array.from({length:7}, (_,i)=>addDays(monday,i));
    const rangeLabel = `${days[0].getFullYear()}년 ${mdLabel(days[0])} ~ ${mdLabel(days[6])} (월요일 기준 7일)`;
    const buckets = days.map((d,i)=>({ key: ymd(d), label: `${WEEKDAY_KO[i]} (${mdLabel(d)})`, match: e=>e.date===ymd(d) }));
    return { buckets, rangeLabel, prev:()=>addDays(monday,-7), next:()=>addDays(monday,7) };
  }
  if(period==='week'){
    const y = anchor.getFullYear(), m = anchor.getMonth();
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m+1, 0);
    const rangeLabel = `${y}년 ${m+1}월 (4주 구간)`;
    const weekRanges = [[1,7],[8,14],[15,21],[22,monthEnd.getDate()]];
    const buckets = weekRanges.map(([s,e],i)=>{
      const sd = new Date(y,m,s);
      const ed = new Date(y,m,Math.min(e,monthEnd.getDate()));
      return { key:`${y}-${String(m+1).padStart(2,'0')}-W${i+1}`, label:`${i+1}주 (${mdLabel(sd)}~${mdLabel(ed)})`, match: ev=>{ const dd=parseDate(ev.date); return dd>=sd && dd<=ed; } };
    });
    return { buckets, rangeLabel, prev:()=>addMonths(monthStart,-1), next:()=>addMonths(monthStart,1) };
  }
  // period === 'month': 소재의 최초 집행월부터 이번 달까지, 월 단위로 표시
  if(!dateRange){
    return { buckets: [], rangeLabel: '데이터 없음', prev:()=>anchor, next:()=>anchor };
  }
  const start = parseDate(dateRange.min);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const today = parseDate(todayStr());
  const months = [];
  for(let d=monthStart; d<=today; d=addMonths(d,1)) months.push(d);
  const rangeLabel = `${months[0].getFullYear()}년 ${months[0].getMonth()+1}월 ~ ${months[months.length-1].getFullYear()}년 ${months[months.length-1].getMonth()+1}월 (최초 집행월부터 전체 ${months.length}개월)`;
  const buckets = months.map(d=>{
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return { key, label:`${d.getFullYear()}년 ${d.getMonth()+1}월`, match: ev => ev.date.slice(0,7) === key };
  });
  return { buckets, rangeLabel, prev:()=>anchor, next:()=>anchor };
}

function aggregateBucket(entries){
  let spend=0, purchases=0, clicks=0, roasSum=0, roasCount=0;
  entries.forEach(e=>{
    spend += e.spend||0;
    purchases += e.purchases||0;
    clicks += e.clicks||0;
    if(e.roas!=null){ roasSum += e.roas; roasCount++; }
  });
  return {
    spend, purchases,
    avgRoas: roasCount ? roasSum/roasCount : null,
    cpc: clicks ? spend/clicks : null,
    cpa: purchases ? spend/purchases : null
  };
}

async function recordDailySnapshot(){
  const region = currentRegion;
  const rows = REG().performance;
  if(!rows.length){ toast('기록할 성과 데이터가 없습니다', true); return; }
  const date = todayStr();
  const existingLog = DATA.dailyLog[region] || [];
  for(const r of rows){
    const existing = existingLog.find(e=>e.date===date && e.concept===r.concept && e.brand===r.brand);
    const fields = {date, brand:r.brand, concept:r.concept, impressions:r.impressions, clicks:r.clicks,
      spend:r.spend, purchases:r.purchases, ctr:r.ctr, cpm:r.cpm, cpc:r.cpc, cpa:r.cpa, roas:r.roas};
    if(existing){ await apiUpdate(existing._id, fields); }
    else{ await apiCreate({ type:'dailylog', region, ...fields, order: Date.now() }); }
  }
  toast(`${date} 스냅샷 기록 완료 (${rows.length}건)`);
}

/* ===================== ROUTER ===================== */
const RENDERERS = { home: renderHome, search: renderSearch, meta: renderMeta, lowperf: renderLowPerf };
function renderRoute(){ (RENDERERS[currentTab] || renderHome)(); }
function goTab(tab){
  currentTab = tab;
  document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active', x.dataset.tab===tab));
  renderRoute();
  window.scrollTo(0,0);
}
document.getElementById('nav').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  goTab(b.dataset.tab);
});
document.getElementById('region-nav').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  currentRegion = b.dataset.region;
  document.querySelectorAll('#region-nav button').forEach(x=>x.classList.toggle('active', x.dataset.region===currentRegion));
  currentTab = 'home';
  document.querySelectorAll('#nav button').forEach(x=>x.classList.remove('active'));
  renderRoute(); window.scrollTo(0,0);
});
document.getElementById('brand-home').addEventListener('click', ()=>{
  document.querySelectorAll('#nav button').forEach(x=>x.classList.remove('active'));
  currentTab = 'home'; renderRoute(); window.scrollTo(0,0);
});

renderHome();
initSocket();
loadInitial();
