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
let DATA = { regions: { "대만": emptyRegion(), "홍콩": emptyRegion() }, dailyLog: { "대만": [], "홍콩": [] } };
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
  DATA.regions = regions;
  DATA.dailyLog = dlog;
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
    const maxSpend = Math.max(...Object.values(ip.intros).map(x=>x.spend));
    html += `<div class="block-label">인트로별 성과 분해 ${ip.confident?'':' — 격차 '+ip.marginPct+'% (15% 미만, 근소한 차이)'}</div>`;
    Object.keys(ip.intros).sort().forEach(k=>{
      const v = ip.intros[k];
      const isWinner = Number(k)===ip.winner;
      const w = (v.spend/maxSpend*100).toFixed(1);
      html += `<div class="introwin-row">
        <div class="il">인트로${k}${isWinner?' 👑':''}</div>
        <div class="itrack"><div class="ifill${isWinner?'':' loser'}" style="width:${w}%;"></div></div>
        <div class="inum">${won(v.spend)}</div>
      </div>`;
    });
    html += `<div class="sub" style="color:var(--muted);font-size:11.5px;margin-top:4px;">${ip.confident ? `승자: 인트로${ip.winner} (지출 기준, 격차 ${ip.marginPct}%)` : `1·2위 격차 ${ip.marginPct}% — 15% 미만이라 확정된 승자로 단정하지 않음`}</div>`;
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
      <div class="hero-nav-card" data-tab="meta"><span class="ic">📡</span><div class="t">메타현황판</div><div class="d">매칭 현황과 최신 메타 성과를 한눈에</div></div>
      <div class="hero-nav-card" data-tab="trend"><span class="ic">📈</span><div class="t">성과추이</div><div class="d">소재별 지출·CPC·CPA·ROAS·CTR·구매</div></div>
      <div class="hero-nav-card" data-tab="daily"><span class="ic">🗓️</span><div class="t">일별/주별/월별/연별 추이</div><div class="d">매일 누적되는 데이터로 기간별 그래프 확인</div></div>
      <div class="hero-nav-card" data-tab="lowperf"><span class="ic">🔻</span><div class="t">저효율 인트로+개선방안</div><div class="d">AI가 분석한 저조한 인트로와 수정 제안</div></div>
    </div>
  </div>`;
  document.getElementById('shell').innerHTML = html;
  document.querySelectorAll('.hero-nav-card').forEach(el=>el.addEventListener('click', ()=>goTab(el.dataset.tab)));
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
    box.innerHTML = rows.map(s=>{
      const p = perfFor(s.name, s.brand);
      const ip = REG().introPerf[s.name];
      return `<div class="result-card" data-name="${esc(s.name)}" data-brand="${esc(s.brand)}">
        <div class="rc-head">
          <span class="rc-name">${highlight(s.name)}</span>
          ${matchTag(s.match)} ${verdictTag(s.verdict)} ${s.approval?approvalTag(s.approval):''}
        </div>
        <div class="rc-meta">${esc(s.brand)} · ${esc(s.product)}${ip?` · 승자 인트로${ip.winner}${ip.confident?'':'(근소)'}`:''}</div>
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
  }
  document.getElementById('search-input').addEventListener('input', e=>{ searchTerm = e.target.value; draw(); });
  document.getElementById('f-brand').addEventListener('change', draw);
  document.getElementById('f-verdict').addEventListener('change', draw);
  document.getElementById('f-match').addEventListener('change', draw);
  document.getElementById('add-concept-btn').addEventListener('click', openAddConceptModal);
  draw();
  setTimeout(()=>document.getElementById('search-input').focus(), 50);
}

/* ===================== 메타현황판 ===================== */
function renderMeta(){
  if(!REG().scripts.length){
    document.getElementById('shell').innerHTML = `<div class="page-head"><h2>메타현황판</h2></div><div class="callout warn">${REG().dataIssues && REG().dataIssues[0] ? `<b>${esc(REG().dataIssues[0].issue)}</b> — ${esc(REG().dataIssues[0].detail)}` : esc(currentRegion)+' 데이터가 아직 없습니다.'}</div>`;
    return;
  }
  const total = REG().scripts.length;
  const matched = REG().scripts.filter(s=>s.match==='매칭됨').length;
  const unmatched = REG().scripts.filter(s=>s.match==='매칭안됨').length;
  const pctMatched = (matched+unmatched) ? (matched/(matched+unmatched)*100).toFixed(1) : null;
  const staleCount = REG().performance.filter(p=>p.stale).length;
  let html = `<div class="page-head"><h2>메타현황판</h2><div class="sub">매칭 현황과 메타 성과를 최신 상태로 유지합니다 · ${esc(REG().generatedAt)}</div></div>`;
  html += `<div class="grid cols-4">
    <div class="card"><div class="label">전체 매칭률</div><div class="big" style="color:${pctMatched==null?'var(--muted)':pctMatched>=50?'var(--success)':'var(--danger)'}">${pctMatched==null?'—':pctMatched+'%'}</div><div class="sub">${pctMatched==null?'데이터 없음':'기준선 50% '+(pctMatched>=50?'통과':'미달')}</div></div>
    <div class="card"><div class="label">매칭됨</div><div class="big" style="color:var(--success)">${matched}건</div></div>
    <div class="card"><div class="label">매칭안됨</div><div class="big" style="color:var(--danger)">${unmatched}건</div></div>
    <div class="card"><div class="label">최근 확인 안됨</div><div class="big" style="color:${staleCount?'var(--warning)':'var(--success)'}">${staleCount}건</div><div class="sub">재조회 시 광고 없음</div></div>
  </div>`;

  html += `<div class="section-title">브랜드별 매칭 현황</div><div class="card"><table>
    <tr><th>브랜드</th><th class="num">매칭됨</th><th class="num">매칭안됨</th><th class="num">매칭률</th></tr>`;
  BRANDS().forEach(b=>{
    const m = REG().scripts.filter(s=>s.brand===b && s.match==='매칭됨').length;
    const u = REG().scripts.filter(s=>s.brand===b && s.match==='매칭안됨').length;
    const r = (m+u)? (m/(m+u)*100).toFixed(1) : '—';
    html += `<tr><td>${esc(b)}</td><td class="num">${m}</td><td class="num">${u}</td><td class="num">${r}${r!=='—'?'%':''}</td></tr>`;
  });
  html += `</table></div>`;

  html += `<div class="section-title">매칭된 소재 — 최신 성과 <span class="hint">클릭하면 상세 보기</span></div>
  <div class="card" style="overflow-x:auto;"><table id="meta-matched-table">
    <tr><th>컨셉명</th><th>브랜드</th><th class="num">지출</th><th class="num">ROAS</th><th class="num">CTR</th><th class="num">구매</th><th>상태</th></tr>
    ${REG().scripts.filter(s=>s.match==='매칭됨').map(s=>{
      const p = perfFor(s.name, s.brand);
      return `<tr class="clickable" data-name="${esc(s.name)}" data-brand="${esc(s.brand)}">
        <td class="name-link">${esc(s.name)}</td><td>${esc(s.brand)}</td>
        <td class="num">${p?won(p.spend):'—'}</td><td class="num">${p?roasFmt(p.roas):'—'}</td><td class="num">${p?pct(p.ctr):'—'}</td><td class="num">${p?num(p.purchases):'—'}</td>
        <td>${p&&p.stale?'<span class="tag stale">최근 확인 안됨</span>':'<span class="tag success">최신</span>'}</td>
      </tr>`;
    }).join('')}
  </table></div>`;

  html += `<div class="section-title">매칭안됨 소재 <span class="hint">수동 확인 필요</span></div><div class="card"><table>
    <tr><th>컨셉명</th><th>브랜드</th><th>제품</th></tr>` +
    REG().scripts.filter(s=>s.match==='매칭안됨').map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.brand)}</td><td>${esc(s.product)}</td></tr>`).join('') +
    `</table></div>`;

  const confirmed = REG().scripts.filter(s=>s.approval==='확정');
  if(confirmed.length){
    html += `<div class="section-title">✔ 확정된 개선안</div><div class="card"><table>
      <tr><th>컨셉명</th><th>브랜드</th><th>제품</th></tr>
      ${confirmed.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.brand)}</td><td>${esc(s.product)}</td></tr>`).join('')}
    </table></div>`;
  }

  if(REG().dataIssues.length){
    html += `<div class="section-title">⚠ 데이터 매핑 이슈</div>`;
    REG().dataIssues.forEach(d=>{ html += `<div class="callout warn"><b>${esc(d.issue)}</b> — ${esc(d.detail)}</div>`; });
  }

  document.getElementById('shell').innerHTML = html;
  document.getElementById('meta-matched-table').addEventListener('click', e=>{
    const tr = e.target.closest('tr.clickable'); if(!tr) return;
    openScriptModal(tr.dataset.name, tr.dataset.brand);
  });
}

/* ===================== 성과추이 ===================== */
function renderTrend(){
  if(!REG().performance.length){
    document.getElementById('shell').innerHTML = `<div class="page-head"><h2>성과추이</h2></div><div class="callout warn">${esc(currentRegion)} 성과 데이터가 아직 없습니다.</div>`;
    return;
  }
  let html = `<div class="page-head"><h2>성과추이</h2><div class="sub">매칭된 소재별 지출·CPC·CPA·ROAS·CTR·구매를 한 화면에서 비교합니다</div></div>`;
  html += `<div class="grid cols-3">`;
  BRANDS().forEach(b=>{
    const s = brandStats(b);
    html += `<div class="card">
      <div class="label">${esc(b)}</div>
      <div class="big" style="color:${brandColor(b)}">${s.count?won(s.spend):'데이터 없음'}</div>
      <div class="sub">평균 ROAS ${roasFmt(s.avgRoas)} · 평균 CTR ${pct(s.avgCtr)} · 평균 CPC ${s.avgCpc?won(s.avgCpc):'—'}</div>
      <div class="sub">구매 누적 ${num(s.purchases)}건</div>
    </div>`;
  });
  html += `</div>`;

  html += `<div class="section-title">지출 순위 <span class="hint">클릭하면 대본 보기</span></div>`;
  const maxSpend = Math.max(...REG().performance.map(r=>r.spend));
  html += `<div class="card" id="trend-bars">`;
  REG().performance.slice().sort((a,b)=>b.spend-a.spend).forEach(r=>{
    const w = (r.spend/maxSpend*100).toFixed(1);
    html += `<div class="barrow clickable" data-name="${esc(r.concept)}" data-brand="${esc(r.brand)}">
      <div class="bl">${esc(r.concept)}</div>
      <div class="btrack"><div class="bfill" style="width:${w}%;background:${brandColor(r.brand)};"></div></div>
      <div class="bnum">${won(r.spend)}</div>
    </div>`;
  });
  html += `</div>`;

  html += `<div class="section-title">전체 지표 <span class="hint">지출·CPC·CPA·ROAS·CTR·구매</span></div>
  <div class="card" style="overflow-x:auto;"><table id="trend-table">
    <tr><th>컨셉명</th><th>브랜드</th><th class="num">지출</th><th class="num">CPC</th><th class="num">CPA</th><th class="num">ROAS</th><th class="num">CTR</th><th class="num">구매</th></tr>
    ${REG().performance.slice().sort((a,b)=>b.spend-a.spend).map(r=>`<tr class="clickable" data-name="${esc(r.concept)}" data-brand="${esc(r.brand)}">
      <td class="name-link">${esc(r.concept)}${r.stale?' <span class="tag stale">최근확인안됨</span>':''}${r.isCampaignLevel?' <span class="tag pending" title="'+esc(r.campaignNote||'')+'">캠페인 합계</span>':''}</td><td>${esc(r.brand)}</td>
      <td class="num">${won(r.spend)}</td><td class="num">${r.cpc?won(r.cpc):'—'}</td><td class="num">${r.cpa?won(r.cpa):'—'}</td>
      <td class="num">${roasFmt(r.roas)}</td><td class="num">${pct(r.ctr)}</td><td class="num">${num(r.purchases)}</td>
    </tr>`).join('')}
  </table></div>`;

  document.getElementById('shell').innerHTML = html;
  document.getElementById('trend-bars').addEventListener('click', e=>{
    const row = e.target.closest('.barrow.clickable'); if(!row) return;
    openScriptModal(row.dataset.name, row.dataset.brand);
  });
  document.getElementById('trend-table').addEventListener('click', e=>{
    const tr = e.target.closest('tr.clickable'); if(!tr) return;
    openScriptModal(tr.dataset.name, tr.dataset.brand);
  });
}

/* ===================== 저효율 인트로+개선방안 ===================== */
function renderLowPerf(){
  if(!Object.keys(REG().introPerf).length){
    document.getElementById('shell').innerHTML = `<div class="page-head"><h2>저효율 인트로+개선방안</h2></div><div class="callout warn">${esc(currentRegion)} 인트로 비교 데이터가 아직 없습니다.</div>`;
    return;
  }
  const rows = Object.entries(REG().introPerf).map(([name, ip])=>{
    const introNums = Object.keys(ip.intros).map(Number);
    const loserNum = introNums.filter(n=>n!==ip.winner).sort((a,b)=>ip.intros[a].spend-ip.intros[b].spend)[0];
    const loser = ip.intros[String(loserNum)];
    const winnerData = ip.intros[String(ip.winner)];
    const sc = REG().scripts.find(s=>s.name===name);
    const loserText = sc ? (loserNum===1?sc.i1:loserNum===2?sc.i2:sc.i3) : '';
    const winnerText = sc ? (ip.winner===1?sc.i1:ip.winner===2?sc.i2:sc.i3) : '';
    const shareOfWinner = winnerData.spend ? (loser.spend/winnerData.spend*100) : 0;
    return {name, brand:sc?sc.brand:'', loserNum, loser, loserText, winnerNum:ip.winner, winnerText, marginPct:ip.marginPct, confident:ip.confident, shareOfWinner, stale:ip.stale};
  }).sort((a,b)=> a.confident===b.confident ? b.marginPct-a.marginPct : (a.confident? -1:1) );

  let html = `<div class="page-head"><h2>저효율 인트로 + 개선방안</h2><div class="sub">각 소재의 여러 인트로 중 반응이 가장 저조했던 인트로를 승자와 비교합니다. AI 피드백은 사람 검수 없이 바로 게재된 참고용 분석입니다.</div></div>`;
  html += `<div class="callout">표본이 너무 작은 경우(노출 매우 적음)는 창작 문제가 아니라 예산 배분 문제일 수 있어 "표본 부족"으로 별도 표시했습니다.</div>`;
  rows.forEach(r=>{
    const fb = REG().lowPerfFeedback[r.name];
    html += `<div class="lowperf-card">
      <div class="head">
        <span class="name clickable" data-name="${esc(r.name)}" data-brand="${esc(r.brand)}" style="cursor:pointer;color:var(--primary);">${esc(r.name)}</span>
        <span class="meta">${esc(r.brand)} · 인트로${r.loserNum} 지출 ${won(r.loser.spend)} (승자 인트로${r.winnerNum}의 ${r.shareOfWinner.toFixed(0)}% 수준)
        ${r.confident?'':'<span class="tag learning" style="margin-left:6px;">격차 15% 미만 · 근소</span>'}
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
}

/* ===================== 일별/주별/월별/연별 추이 ===================== */
let dailyPeriod = 'day';
let dailyBrand = '전체';
let dailyConceptFilter = '전체';
let dailyMetric = '전체';
let dailyAnchor = null;
let dailyChartInstance = null;

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
  const y = anchor.getFullYear();
  const yearStart = new Date(y,0,1);
  const rangeLabel = `${y}년 (1~12월)`;
  const buckets = Array.from({length:12},(_,i)=>({
    key:`${y}-${String(i+1).padStart(2,'0')}`, label:`${i+1}월`,
    match: ev => ev.date.slice(0,7) === `${y}-${String(i+1).padStart(2,'0')}`
  }));
  return { buckets, rangeLabel, prev:()=>addYears(yearStart,-1), next:()=>addYears(yearStart,1) };
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

function renderDaily(){
  const fullLog = DATA.dailyLog[currentRegion] || [];

  if(!dailyAnchor){
    const latest = fullLog.reduce((m,e)=> (!m || e.date>m) ? e.date : m, null);
    dailyAnchor = parseDate(latest || todayStr());
  }

  const conceptNames = Array.from(new Set(fullLog.map(e=>e.concept))).sort();

  let html = `<div class="page-head"><h2>일별/주별/연별 추이</h2><div class="sub">일단위(월요일 기준 7일) · 주단위(한 달을 4주로 분할) · 연단위(1~12월) · 전체 기간(소재의 최초 집행일부터 오늘까지) 으로 조회합니다</div></div>`;
  html += `<div class="callout">데이터는 자동으로 매일 쌓이지 않고, 아래 <b>"오늘 스냅샷 기록"</b> 버튼을 하루 한 번 눌러야 그날 데이터가 누적됩니다.</div>`;
  html += `<div class="filter-bar">
    <select id="daily-period">
      ${[['day','일단위'],['week','주단위'],['year','연단위'],['all','전체 기간']].map(([v,l])=>`<option value="${v}" ${dailyPeriod===v?'selected':''}>${l}</option>`).join('')}
    </select>
    <select id="daily-brand">
      <option value="전체" ${dailyBrand==='전체'?'selected':''}>전체 브랜드</option>
      ${BRANDS().map(b=>`<option ${dailyBrand===b?'selected':''}>${esc(b)}</option>`).join('')}
    </select>
    <select id="daily-concept">
      <option value="전체" ${dailyConceptFilter==='전체'?'selected':''}>전체 소재</option>
      ${conceptNames.map(c=>`<option ${dailyConceptFilter===c?'selected':''}>${esc(c)}</option>`).join('')}
    </select>
    <button id="daily-snapshot-btn" style="background:var(--primary);color:#fff;border:none;border-radius:10px;padding:8px 16px;font-size:12.5px;font-weight:700;cursor:pointer;">+ 오늘 스냅샷 기록</button>
  </div>`;

  if(!fullLog.length){
    html += `<div class="callout warn"><b>누적된 일별 데이터가 없습니다.</b> "오늘 스냅샷 기록" 버튼을 눌러 첫 데이터를 쌓아보세요.</div>`;
    document.getElementById('shell').innerHTML = html;
    document.getElementById('daily-snapshot-btn').addEventListener('click', recordDailySnapshot);
    return;
  }

  html += `<div class="card">
    <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:10px;">
      <button id="daily-prev" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:5px 12px;font-size:13px;font-weight:700;cursor:pointer;">◀</button>
      <span id="daily-range-label" style="font-size:13.5px;font-weight:700;color:var(--text);min-width:220px;text-align:center;"></span>
      <button id="daily-next" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:5px 12px;font-size:13px;font-weight:700;cursor:pointer;">▶</button>
    </div>
    <canvas id="daily-chart" height="90"></canvas>
  </div>`;
  html += `<div class="section-title" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <span>구간별 지표 <span class="hint">지출 금액 · 구매수 · 평균 ROAS · CPC · CPA</span></span>
    <select id="daily-metric" style="margin-left:auto;">
      ${[['전체','전체 지표'],...Object.entries(DAILY_METRICS).map(([k,m])=>[k,m.label])].map(([v,l])=>`<option value="${v}" ${dailyMetric===v?'selected':''}>${l}</option>`).join('')}
    </select>
  </div>
  <div class="card" style="overflow-x:auto;"><table id="daily-table"></table></div>`;
  document.getElementById('shell').innerHTML = html;

  function draw(){
    dailyPeriod = document.getElementById('daily-period').value;
    dailyBrand = document.getElementById('daily-brand').value;
    dailyConceptFilter = document.getElementById('daily-concept').value;
    dailyMetric = document.getElementById('daily-metric').value;

    const filtered = fullLog.filter(e=>
      (dailyBrand==='전체' || e.brand===dailyBrand) &&
      (dailyConceptFilter==='전체' || e.concept===dailyConceptFilter)
    );

    const sortedDates = filtered.map(e=>e.date).sort();
    const dateRange = sortedDates.length ? { min: sortedDates[0], max: sortedDates[sortedDates.length-1] } : null;

    const { buckets, rangeLabel, prev, next } = getBuckets(dailyPeriod, dailyAnchor, dateRange);
    document.getElementById('daily-range-label').textContent = rangeLabel;
    const isAll = dailyPeriod === 'all';
    document.getElementById('daily-prev').style.visibility = isAll ? 'hidden' : 'visible';
    document.getElementById('daily-next').style.visibility = isAll ? 'hidden' : 'visible';

    const agg = buckets.map(b => aggregateBucket(filtered.filter(b.match)));
    const labels = buckets.map(b=>b.label);

    const ctx = document.getElementById('daily-chart').getContext('2d');
    if(dailyChartInstance) dailyChartInstance.destroy();

    if(dailyMetric === '전체'){
      const spendData = agg.map(a=>a.spend);
      const roasData = agg.map(a=>a.avgRoas);
      dailyChartInstance = new Chart(ctx, {
        data: {
          labels,
          datasets: [
            {type:'bar', label:'지출 금액', data:spendData, backgroundColor:'rgba(49,130,246,.35)', yAxisID:'y'},
            {type:'line', label:'평균 ROAS', data:roasData, borderColor:'#12B886', backgroundColor:'#12B886', yAxisID:'y1', tension:.3, spanGaps:true}
          ]
        },
        options: {
          responsive:true,
          interaction:{ mode:'index', intersect:false },
          plugins:{ tooltip:{ callbacks:{ label:(c)=> c.dataset.yAxisID==='y' ? `지출 금액: ${won(c.raw)}` : `평균 ROAS: ${c.raw==null?'—':c.raw.toFixed(2)}` } } },
          scales:{
            y:{ position:'left', title:{display:true,text:'지출 금액(원)'}, ticks:{ callback:(v)=>won(v) } },
            y1:{ position:'right', title:{display:true,text:'평균 ROAS'}, grid:{drawOnChartArea:false} }
          }
        }
      });
    } else {
      const m = DAILY_METRICS[dailyMetric];
      const data = agg.map(a=>m.get(a));
      dailyChartInstance = new Chart(ctx, {
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
    const table = document.getElementById('daily-table');
    table.innerHTML = `<tr>${cols.map(c=>`<th class="${c.num?'num':''}${dailyMetric===c.key?' metric-active':''}">${c.header}</th>`).join('')}</tr>` +
      buckets.map((b,i)=>{
        const a = agg[i];
        const values = { label: esc(b.label), spend: won(a.spend), purchases: num(a.purchases), roas: roasFmt(a.avgRoas), cpc: won(a.cpc), cpa: won(a.cpa) };
        return `<tr>${cols.map(c=>`<td class="${c.num?'num':''}${dailyMetric===c.key?' metric-active':''}">${values[c.key]}</td>`).join('')}</tr>`;
      }).join('');

    document.getElementById('daily-prev').onclick = ()=>{ dailyAnchor = prev(); draw(); };
    document.getElementById('daily-next').onclick = ()=>{ dailyAnchor = next(); draw(); };
  }

  document.getElementById('daily-period').addEventListener('change', draw);
  document.getElementById('daily-brand').addEventListener('change', draw);
  document.getElementById('daily-concept').addEventListener('change', draw);
  document.getElementById('daily-metric').addEventListener('change', draw);
  document.getElementById('daily-snapshot-btn').addEventListener('click', recordDailySnapshot);
  draw();
}

/* ===================== ROUTER ===================== */
const RENDERERS = { home: renderHome, search: renderSearch, meta: renderMeta, trend: renderTrend, daily: renderDaily, lowperf: renderLowPerf };
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
