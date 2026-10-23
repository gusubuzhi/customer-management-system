/* 样有回音 — 无外部依赖的单人打样跟进工作台。 */
(() => {
  'use strict';
  const C = window.FollowupCore, I = window.FollowupImport, KEY = 'sample-echo:v1';
  let historyImport = null;
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    box:'M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z M3 7.5l9 4.5 9-4.5 M12 12v9 M7.5 5.2l9 4.6',
    home:'M3 10.5 12 3l9 7.5 M5 9v11h14V9 M9 20v-6h6v6',
    list:'M8 5h12 M8 12h12 M8 19h12 M3 5h.1 M3 12h.1 M3 19h.1',
    users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M18 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-3.9',
    plus:'M12 5v14 M5 12h14',clock:'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    calendar:'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2 M8 14h2 M14 14h2',
    flag:'M4 22V3c5-4 10 4 16 0v11c-6 4-11-4-16 0',arrow:'M5 12h14 M14 7l5 5-5 5',
    chevron:'M9 5l7 7-7 7',search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    note:'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V10.5A8.5 8.5 0 0 1 10.5 2h2 M16 4l4 4 M13 11l2-5 5-5 3 3-5 5-5 2Z',
    message:'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V10.5A8.5 8.5 0 0 1 10.5 2h2a8.5 8.5 0 0 1 8.5 8.5Z M7 8h9 M7 12h6',
    check:'M5 12l4 4L19 6',close:'M6 6l12 12 M6 18 18 6',
    settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 2h6l1 4 4 1 2 5-3 3v5l-5 2-3-3-5 1-3-5 1-4-2-4 4-2 3-3Z',
    download:'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',upload:'M12 16V4 M7 9l5-5 5 5 M4 16v5h16v-5',
    leaf:'M20 3C7 2 2 9 6 16s16 4 14-13Z M5 21 16 9',info:'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    file:'M14 2H4v20h16V8l-6-6Z M14 2v6h6 M8 13h8 M8 17h6'
  };
  const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[n] || paths.box}"/></svg>`;
  let data = C.empty(), demoMode = false, loadError = '', savedRaw = null, externalChanged = false;
  let view = 'today', activeTab = 'all', query = '', statusFilter = '', modal = null, oldFocus = null, initialForm = '';
  let toastTimer;
  function load() {
    try { savedRaw = localStorage.getItem(KEY); data = savedRaw ? C.validate(JSON.parse(savedRaw)) : C.empty(); loadError = ''; }
    catch(e) { data = C.empty(); loadError = '未能读取本机记录。原始数据仍被保留，请先导出备份；保存功能暂不可用。'; }
  }
  load();
  function toast(message) { const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3500); }
  function commit(next) {
    try {
      C.validate(next);
      if (!demoMode) {
        if(loadError) throw new Error('请先处理数据读取问题，现有记录不会被覆盖。');
        if(externalChanged || localStorage.getItem(KEY) !== savedRaw) { externalChanged=true;throw new Error('记录已在其他窗口更新。请关闭当前弹窗，刷新资料后重试。'); }
        const raw = JSON.stringify(next);localStorage.setItem(KEY,raw);savedRaw=raw;
      }
      data=next;return true;
    } catch(e) { formError(e.name === 'QuotaExceededError' ? '浏览器存储空间不足，请先导出备份。此次修改没有保存。' : e.message || '保存失败，请检查浏览器是否允许本地存储。');return false; }
  }
  function formError(m) { const e=$('.form-error');if(e){e.textContent=m;e.classList.add('visible');e.scrollIntoView({block:'nearest'});}else toast(m); }
  function customer(s) { return data.customers.find(c=>c.id===s.customerId); }
  function latest(s) { return [...s.history].reverse().find(h=>h.type==='note')?.text || '还没有沟通记录，记下最近一次交流吧。'; }
  const badge = s=>`<span class="badge s${C.STATUSES.indexOf(s.status)}">${esc(s.status==='已结束'?s.outcome:s.status)}</span>`;
  const shortDate = d=>d ? `${Number(d.slice(5,7))}月${Number(d.slice(8,10))}日` : '—';
  const timeText = d=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d));
  const counts = ()=>Object.fromEntries(['overdue','today','upcoming','unscheduled','ended'].map(b=>[b,data.samples.filter(s=>C.bucket(s)===b).length]));
  function getMatches(records=data.samples) { const q=query.trim().toLowerCase();return records.filter(s=>(!statusFilter||s.status===statusFilter)&&(!q||[s.product,customer(s)?.name,customer(s)?.externalCode,s.specs].some(x=>x?.toLowerCase().includes(q)))); }
  function navItem(id,label,i,count='') { return `<button class="nav-item ${view===id?'active':''}" data-action="nav" data-view="${id}" ${view===id?'aria-current="page"':''}>${icon(i)}<span>${label}</span>${count?`<span class="nav-count">${count}</span>`:''}</button>`; }
  function render() {
    const n=counts(), titles={today:'今日跟进',samples:'打样记录',customers:'客户档案'};
    $('#app').innerHTML=`<div class="layout"><aside class="sidebar"><div class="brand"><div class="brand-logo">${icon('box')}</div><div><div class="brand-title">样有回音</div><div class="brand-sub">SAMPLE / FOLLOW UP</div></div></div><div class="workspace-label">我的工作台 / WORKSPACE</div><nav class="nav" aria-label="主导航">${navItem('today','今日跟进','home',n.overdue+n.today)}${navItem('samples','打样记录','box')}${navItem('customers','客户档案','users')}</nav><div class="sidebar-note"><strong>${icon('leaf')}每一次寄样，都值得被跟进</strong>把需求记清楚，把进度放在心上，<br>让每一份样品都有回音。</div><div class="sidebar-bottom"><div class="avatar">我</div><div><p>我的工作空间</p><small>个人版 · V1.0</small></div><button class="icon-button" data-action="backup" aria-label="数据与备份" title="数据与备份">${icon('settings')}</button></div></aside><div class="content"><header class="topbar"><div class="crumb">工作台 ${icon('chevron')} <b>${titles[view]}</b></div><div class="top-tools"><span class="top-date">${new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date())}</span><span class="save-status ${loadError?'error':''}">${demoMode?'示例体验中':loadError?'存储需检查':'本机自动保存'}</span><button class="icon-button" data-action="backup" aria-label="导出与恢复备份" title="导出与恢复备份">${icon('download')}</button></div></header>${demoMode?'<div class="demo-banner"><span>示例体验 · 这里的客户和记录均为虚构，修改不会影响你的正式记录。</span><button data-action="demo-exit">退出示例，使用我的数据</button></div>':''}<main class="main">${loadError?`<div class="error-banner" role="alert">${esc(loadError)} <button data-action="export" class="small-link">导出原始备份</button></div>`:''}<div class="page-title"><div><div class="eyebrow">${view==='today'?'EVERY SAMPLE, A NEXT STEP.':view==='samples'?'FROM FIRST SAMPLE TO NEXT ORDER.':'GOOD FOLLOW-UP STARTS WITH A NAME.'}</div><h1>${titles[view]}</h1><p>${view==='today'?'把今天的联系安排好，让每一份样品都有下一步。':view==='samples'?'从需求确认到客户反馈，每一步都有记录。':'记住每一位客户，也记住每一次合作的进展。'}</p></div><div class="actions page-actions"><button class="secondary" data-action="history-import">${icon('upload')}导入历史客户</button><button class="primary" data-action="${view==='customers'?'new-customer':'new-sample'}">${icon('plus')}${view==='customers'?'新建客户':'新建打样'}</button></div></div>${view==='today'?home(n):view==='samples'?samples():customers()}<footer class="footer"><span>样有回音 <span aria-hidden="true">·</span> 把每一次寄样，跟进到结果。</span><div class="footer-right"><button data-action="backup">数据与备份</button><button data-action="${demoMode?'demo-exit':'demo'}">${demoMode?'退出示例':'查看示例'}</button></div></footer></main></div></div>`;
  }
  function home(n) {
    const cards=[['today','今天要联系','calendar','按约定，把沟通往前推进'],['overdue','已逾期','clock','优先联系，重新安排下一步'],['upcoming','后续待跟进','flag','已经安排好下次联系'],['unscheduled','待安排日期','list','补上日期，避免忘记跟进']];
    return `<div class="stats">${cards.map(([b,t,i,note])=>`<button class="stat ${b} ${activeTab===b?'selected':''}" data-action="tab" data-tab="${b}"><div class="stat-top">${t}<span class="stat-icon">${icon(i)}</span></div><div class="stat-value"><b>${n[b]}</b><span>笔打样</span></div><div class="stat-note">${note}</div></button>`).join('')}</div><div class="workspace-grid"><section class="panel"><div class="panel-heading"><h2>跟进清单 <span>${data.samples.filter(s=>s.status!=='已结束').length} 笔进行中</span></h2><button class="ghost" data-action="nav" data-view="samples">全部打样 ${icon('arrow')}</button></div><div class="tab-bar" role="tablist" aria-label="跟进分类">${[['all','全部',null],['overdue','已逾期',n.overdue],['today','今天',n.today],['upcoming','后续',n.upcoming],['unscheduled','待安排',n.unscheduled]].map(([b,t,v])=>`<button role="tab" aria-selected="${activeTab===b}" class="tab ${activeTab===b?'active':''}" data-action="tab" data-tab="${b}">${t}${v!==null?`<span>${v}</span>`:''}</button>`).join('')}</div>${todoList()}</section><aside class="aside">${aside(n)}</aside></div>`;
  }
  function todoList() {
    if(!data.samples.length) return empty('从第一笔打样开始','录入客户和样品，安排好下次联系日期。之后每天打开这里，就能看到该跟进谁。','new-sample','新建第一笔打样',true);
    const groups=[['overdue','已逾期','先联系这些客户，把下一步接上'],['today','今天要联系','今天的沟通，今天有着落'],['upcoming','后续待跟进','下一次联系，已经在计划里'],['unscheduled','待安排日期','补一个日期，让跟进有着落']];
    let html='';
    for(const [b,t,note] of groups) {
      if(activeTab!=='all'&&activeTab!==b)continue;
      const rows=C.sorted(data.samples.filter(s=>C.bucket(s)===b));if(!rows.length)continue;
      html+=`<div class="group-label ${b}">${icon(b==='overdue'?'clock':'calendar')}${t} · ${rows.length}<span class="group-extra">${note}</span></div>${rows.map(s=>followCard(s,b)).join('')}`;
    }
    return html || empty('这里的跟进已安排妥当','当前分类没有待办。可以查看其他分类，或到打样记录里查看历史。','show-all','查看全部跟进');
  }
  function followCard(s,b) {
    const c=customer(s), late=C.days(C.today(),s.nextDate);
    return `<article class="follow-card"><div class="customer-avatar ${b==='overdue'?'warm':''}" aria-hidden="true">${esc(c.name.slice(0,1))}</div><div><div class="card-head"><button class="customer-name" data-action="customer" data-id="${esc(c.id)}">${esc(c.name)}</button>${c.source?`<span class="source">${esc(c.source)}</span>`:''}</div><div class="product-line"><button class="product" data-action="detail" data-id="${esc(s.id)}">${esc(s.product)}</button>${badge(s)}</div><div class="card-meta"><span>${s.sentDate?'寄出于 '+shortDate(s.sentDate):s.historicalDelivered?'已交货 · 寄出日期待补':'尚未寄样'}</span><span>数量 ${s.quantity}</span></div><div class="feedback">${icon('message')}<span>${esc(latest(s))}</span></div></div><div class="card-actions"><span class="date-badge ${b==='overdue'?'late':''}">${icon(b==='overdue'?'clock':'calendar')}${b==='overdue'?'逾期 '+late+' 天':b==='today'?'今天联系':b==='unscheduled'?'未安排日期':shortDate(s.nextDate)+' 联系'}</span><button class="secondary" data-action="follow" data-id="${esc(s.id)}">${icon('note')}记跟进</button></div></article>`;
  }
  function aside(n) {
    const ended=data.samples.filter(s=>s.outcome==='已转大货').length;
    const bars=Array.from({length:7},(_,i)=>{const date=C.offset(C.today(),i);return{date,count:data.samples.filter(s=>s.status!=='已结束'&&s.nextDate===date).length};});
    const max=Math.max(3,...bars.map(b=>b.count));
    return `<section class="focus-panel"><div class="eyebrow">A LITTLE FOLLOW-UP GOES A LONG WAY</div><h3>样品寄出后，<br>让联系继续。</h3><p>一条反馈，一个新的联系日期，<br>都是下一次合作的开始。</p><div class="decor">${icon('box')}</div><div class="focus-footer"><span>已转大货</span><span><b>${ended}</b> 笔</span></div></section><section class="panel mini-panel"><h3>接下来 7 天</h3><div class="week-bars" aria-label="未来七天跟进数量">${bars.map((b,i)=>`<div class="day-bar ${i===0?'current':''}" title="${b.date}：${b.count} 笔"><span class="bar-count">${b.count||''}</span><div class="bar" style="height:${Math.max(3,b.count/max*60)}px"></div><label>${i===0?'今天':shortDate(b.date).replace('月','/').replace('日','')}</label></div>`).join('')}</div><div class="week-note">${n.unscheduled?`还有 ${n.unscheduled} 笔打样没安排联系日期。<br><button class="small-link" data-action="tab" data-tab="unscheduled">现在去安排 ${icon('arrow')}</button>`:'每次沟通结束，顺手约好下次联系。'}</div></section><section class="tip-card"><h3>${icon('info')}跟进小习惯</h3><p>记下客户反馈，也记下下一步。暂时没回复的客户，可以重新约一个联系日期。</p></section>`;
  }
  function empty(title,text,action,label,example=false) { return `<div class="empty"><div class="empty-icon">${icon('box')}</div><h3>${title}</h3><p>${text}</p><div class="actions"><button class="primary" data-action="${action}">${icon('plus')}${label}</button>${example?'<button class="secondary" data-action="demo">先看看示例</button>':''}</div></div>`; }
  function samples() {
    const list=C.sorted(getMatches());
    return `<section class="panel"><div class="toolbar"><label class="search">${icon('search')}<input id="search-input" type="search" aria-label="搜索客户或产品" placeholder="搜索客户昵称、产品或规格" value="${esc(query)}"></label><select id="status-filter" class="filter" aria-label="按进度筛选"><option value="">全部进度</option>${C.STATUSES.map(s=>`<option ${statusFilter===s?'selected':''}>${s}</option>`).join('')}</select></div>${list.length?`<div class="table-wrap"><table><thead><tr><th>客户 / 产品</th><th>进度</th><th>寄出日期</th><th>下次联系</th><th>操作</th></tr></thead><tbody>${list.map(s=>`<tr><td><button class="table-title" data-action="detail" data-id="${esc(s.id)}">${esc(s.product)}</button><div class="subline">${esc(customer(s).name)} · ${s.quantity} 件</div></td><td>${badge(s)}</td><td>${shortDate(s.sentDate)}</td><td class="table-date ${C.bucket(s)==='overdue'?'late':''}">${s.status==='已结束'?'已结束':shortDate(s.nextDate)}${C.bucket(s)==='overdue'?' · 逾期':''}</td><td><button class="table-actions" data-action="detail" data-id="${esc(s.id)}">查看详情</button></td></tr>`).join('')}</tbody></table></div><div class="panel-footer">共 ${list.length} 笔打样${query||statusFilter?' · 已筛选':''}</div>`:empty(data.samples.length?'没有找到匹配的打样':'还没有打样记录',data.samples.length?'换个关键词或进度筛选再试试。':'把客户需求记下来，开始追踪第一笔打样。',data.samples.length?'clear-filters':'new-sample',data.samples.length?'清除筛选':'新建打样')}</section>`;
  }
  function customers() {
    const q=query.trim().toLowerCase(),list=data.customers.filter(c=>[c.name,c.externalCode||'',c.contact,c.source].some(x=>x.toLowerCase().includes(q)));
    return `<label class="search" style="max-width:400px">${icon('search')}<input id="search-input" type="search" aria-label="搜索客户" placeholder="搜索客户昵称、联系方式或来源" value="${esc(query)}"></label>${list.length?`<div class="customer-grid">${list.map(c=>{const ss=data.samples.filter(s=>s.customerId===c.id);return `<button class="customer-card" data-action="customer" data-id="${esc(c.id)}"><div class="customer-card-top"><div class="customer-avatar">${esc(c.name.slice(0,1))}</div><h3>${esc(c.name)}</h3>${c.source?`<span class="source">${esc(c.source)}</span>`:''}</div><p>${esc(c.notes || c.contact || '暂无备注，可随时补充客户信息。')}</p><div class="customer-card-bottom"><span>累计打样 ${ss.length} 笔</span><span>进行中 ${ss.filter(s=>s.status!=='已结束').length} 笔</span></div></button>`;}).join('')}</div>`:empty(query?'没有找到匹配的客户':'先认识第一位客户',query?'换个昵称或联系方式再试试。':'新建客户档案，也可以在新建打样时一起录入。',query?'clear-filters':'new-customer',query?'清除搜索':'新建客户')}`;
  }
  const errorBox='<div class="form-error" role="alert"></div>';
  function field(label,name,value='',type='text',extra='') { return `<label class="field">${label}<input type="${type}" name="${name}" value="${esc(value)}" ${extra}></label>`; }
  function textField(label,name,value='',extra='') { return `<label class="field full">${label}<textarea name="${name}" ${extra}>${esc(value)}</textarea></label>`; }
  function customerFields(c={}) { return `${field('客户昵称 *','name',c.name||'','text','required maxlength="120" placeholder="例如：林女士 / 店铺昵称"')}${field('客户编号','externalCode',c.externalCode||'','text','maxlength="120" placeholder="可选，用于历史数据匹配"')}${field('联系方式','contact',c.contact||'','text','maxlength="300" placeholder="微信、电话或旺旺"')}${field('客户来源','source',c.source||'','text','maxlength="120" placeholder="例如：淘宝、微信、老客户"')}${textField('客户备注','notes',c.notes||'','maxlength="10000" placeholder="记下客户的项目、偏好或特别要求"')}`; }
  function openModal(type,id='',returnTo=null) {
    if(!modal) oldFocus=document.activeElement;
    modal={type,id,returnTo};initialForm='';renderModal();document.body.style.overflow='hidden';
    requestAnimationFrame(()=>{const el=$('.modal [autofocus]') || $('.modal input:not([type=hidden])') || $('.modal .modal-header button');el?.focus();const f=$('.modal form');if(f)initialForm=JSON.stringify([...new FormData(f)]);});
  }
  function closeModal(force=false) {
    const f=$('.modal form');
    if(!force&&modal?.type==='history-import'&&historyImport&&!historyImport.applied&&!confirm('尚未导入，确定关闭此次预览吗？'))return;
    if(!force&&f&&initialForm&&JSON.stringify([...new FormData(f)])!==initialForm&&!confirm('还有未保存的修改，确定放弃并关闭吗？'))return;
    modal=null;$('#overlay-root').innerHTML='';document.body.style.overflow='';
    if(externalChanged&&!demoMode){externalChanged=false;load();render();toast('已载入其他窗口的最新记录');}
    oldFocus?.isConnected&&oldFocus.focus();
  }
  function shell(title,sub,body,footer='',wide=false) { return `<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><h2 id="modal-title">${title}</h2>${sub?`<small>${sub}</small>`:''}</div><button type="button" class="icon-button" data-action="close" aria-label="关闭弹窗">${icon('close')}</button></div>${body}${footer}</section></div>`; }
  function formShell(title,sub,kind,body,submit='保存',wide=false) { return shell(title,sub,`<form id="modal-form" data-kind="${kind}" class="modal-body">${errorBox}${body}</form>`,`<div class="modal-footer"><button type="button" class="secondary" data-action="close">取消</button><button class="primary" type="submit" form="modal-form">${icon('check')}${submit}</button></div>`,wide); }
  function renderModal() {
    const m=modal;let html='';
    if(m.type==='sample-edit'||m.type==='new-sample') {
      const s=data.samples.find(x=>x.id===m.id)||{};const existing=!!s.id;
      html=formShell(existing?'编辑打样':'新建打样','先记清需求，再安排下一步。','sample',`<div class="form-grid"><div class="form-section first">01 / 客户信息</div><label class="field full">选择客户 *<select name="customerId" id="customer-select">${!data.customers.length?'<option value="new">新建客户</option>':`<option value="" disabled ${!existing?'selected':''}>请选择客户</option>${data.customers.map(c=>`<option value="${esc(c.id)}" ${s.customerId===c.id?'selected':''}>${esc(c.name)}${c.contact?' · '+esc(c.contact):''}</option>`).join('')}<option value="new">＋ 新建客户</option>`}</select></label><div class="form-grid field full" id="inline-customer" ${data.customers.length?'hidden':''}>${customerFields()}</div><div class="form-section">02 / 打样要求</div>${field('产品名称 *','product',s.product||'','text','required maxlength="200" placeholder="例如：PTC 恒温发热片"')}${field('打样数量 *','quantity',s.quantity||1,'number','required min="1" max="1000000" step="1"')}${textField('规格要求','specs',s.specs||'','maxlength="15000" placeholder="电压、功率、温度、尺寸、安装方式等，按实际需求填写"')}${field('约定完成日期','dueDate',s.dueDate||'','date')}<label class="field">当前进度 *<select name="status" id="sample-status">${C.STATUSES.map(v=>`<option ${s.status===v?'selected':''}>${v}</option>`).join('')}</select></label><div class="form-section">03 / 寄样与跟进</div>${field('实际寄出日期','sentDate',s.sentDate||'','date',`max="${C.today()}"`)}${field('快递单号','tracking',s.tracking||'','text','maxlength="300" placeholder="可在寄出后补充"')}${field('下次联系日期','nextDate',s.nextDate||'','date')}<div class="field"><span>跟进提醒</span><span class="hint">日期由你安排；到期后会自动出现在今日跟进。未填日期的记录会出现在“待安排”。</span></div><div id="end-fields" class="form-grid field full" ${s.status==='已结束'?'':'hidden'}><label class="field full">结束结果 *<select name="outcome"><option value="">请选择结束结果</option><option ${s.outcome==='已转大货'?'selected':''}>已转大货</option><option ${s.outcome==='未成交'?'selected':''}>未成交</option></select></label>${textField('结束原因 / 备注','reason',s.reason||'','maxlength="10000"')}</div>${!existing?textField('首次沟通记录','firstNote','','maxlength="15000" placeholder="例如：客户正在开发新产品，已确认样品规格。"'):''}</div>`,existing?'保存修改':'保存打样');
    } else if(m.type==='new-customer'||m.type==='customer-edit') {
      const c=data.customers.find(x=>x.id===m.id)||{};
      html=formShell(c.id?'编辑客户':'新建客户','同一客户的多次打样，会汇总在这份档案里。','customer',`<div class="form-grid">${customerFields(c)}</div>`,c.id?'保存修改':'保存客户');
    } else if(m.type==='detail') {
      const s=data.samples.find(x=>x.id===m.id);if(!s){closeModal(true);return;}const c=customer(s);
      html=shell('打样详情','每一步进展，都有迹可循。',`<div class="modal-body"><div class="detail-summary"><div><h3>${esc(s.product)}</h3><p>${esc(c.name)} · ${s.quantity} 件</p></div>${badge(s)}</div><div class="contact-block"><button data-action="customer" data-id="${esc(c.id)}">查看档案</button><strong>${esc(c.name)}</strong><p>${esc((c.externalCode?'客户编号 '+c.externalCode+' · ':'')+(c.contact||'尚未填写联系方式'))}${c.source?' · '+esc(c.source):''}</p></div><dl class="detail-grid"><div class="full"><dt>规格要求</dt><dd>${esc(s.specs||'尚未填写')}</dd></div><div><dt>约定完成日期</dt><dd>${esc(s.dueDate||'尚未约定')}</dd></div><div><dt>实际寄出日期</dt><dd>${esc(s.sentDate||(s.historicalDelivered?'待补（原表已交货）':'尚未寄出'))}</dd></div>${s.deliveryDate?`<div><dt>原表交货日期</dt><dd>${esc(s.deliveryDate)}</dd></div>`:''}<div><dt>快递单号</dt><dd>${esc(s.tracking||'尚未填写')}</dd></div><div><dt>下次联系日期</dt><dd>${s.status==='已结束'?'本笔打样已结束':esc(s.nextDate||'尚未安排')}</dd></div>${s.status==='已结束'?`<div class="full"><dt>结束结果</dt><dd>${esc(s.outcome)}${s.reason?' · '+esc(s.reason):''}</dd></div>`:''}</dl><div class="section-title">沟通与进度记录 <span class="note-count">${s.history.length} 条</span></div><div class="timeline">${s.history.length?[...s.history].reverse().map(h=>`<div class="timeline-item ${h.type}"><time>${timeText(h.at)}</time><p>${esc(h.text)}</p></div>`).join(''):'<p class="hint">还没有沟通记录。</p>'}</div></div>`,`<div class="modal-footer"><button class="secondary" data-action="edit-sample" data-id="${esc(s.id)}">编辑打样</button>${s.status!=='已结束'?`<button class="primary" data-action="follow" data-id="${esc(s.id)}">${icon('note')}记跟进 / 结束打样</button>`:''}</div>`);
    } else if(m.type==='follow') {
      const s=data.samples.find(x=>x.id===m.id);if(!s||s.status==='已结束'){closeModal(true);return;}
      html=formShell('记一次跟进',esc(customer(s).name)+' · '+esc(s.product),'follow',`<div class="helper-box">上次反馈：${esc(latest(s))}</div><div class="form-grid">${textField('本次沟通 / 客户反馈 *','text','','required maxlength="15000" autofocus placeholder="客户测试结果如何？还有哪些问题？下一步准备做什么？"')}<label class="field full">这次跟进后的安排<select name="result" id="follow-result"><option value="continue">继续跟进</option><option value="已转大货">已转大货，结束本笔打样</option><option value="未成交">不再跟进，标记为未成交</option></select></label><div id="follow-next" class="field full"><label class="field">下次联系日期<input type="date" name="nextDate" value="${s.nextDate>=C.today()?esc(s.nextDate):''}"></label><div class="actions">${[[0,'今天'],[3,'3 天后'],[7,'7 天后']].map(([n,t])=>`<button class="ghost" type="button" data-action="quick-date" data-days="${n}">${t}</button>`).join('')}</div><span class="hint">客户没回复或暂缓采购，可以继续安排日期；不填则放入“待安排”。</span></div><div id="follow-end" class="field full" hidden>${textField('结束原因 / 备注','reason','','maxlength="10000" placeholder="例如：测试通过，首批大货已确认。"')}</div></div>`,'保存跟进');
    } else if(m.type==='customer') {
      const c=data.customers.find(x=>x.id===m.id);if(!c){closeModal(true);return;}const rows=C.sorted(data.samples.filter(s=>s.customerId===c.id));
      html=shell('客户档案','客户资料与历次打样，放在一起看。',`<div class="modal-body"><div class="detail-summary"><div><h3>${esc(c.name)}</h3><p>${esc(c.source||'未填写来源')}</p></div><button class="secondary" data-action="edit-customer" data-id="${esc(c.id)}">编辑资料</button></div><dl class="detail-grid"><div class="full"><dt>联系方式</dt><dd>${esc(c.contact||'尚未填写')}</dd></div><div class="full"><dt>客户备注</dt><dd>${esc(c.notes||'暂无备注')}</dd></div></dl><div class="section-title">历次打样 <span class="note-count">${rows.length} 笔</span></div><div class="compact-list">${rows.length?rows.map(s=>`<button class="compact-record" data-action="detail" data-id="${esc(s.id)}"><span><b>${esc(s.product)}</b><small>${s.quantity} 件 · ${s.sentDate?'寄出 '+s.sentDate:'尚未寄出'} · ${s.status==='已结束'?'已结束':'联系 '+(s.nextDate||'待安排')}</small></span>${badge(s)}</button>`).join(''):'<p class="hint">这位客户还没有打样记录。</p>'}</div></div>`,`<div class="modal-footer"><button class="primary" data-action="sample-for-customer" data-id="${esc(c.id)}">${icon('plus')}为此客户新建打样</button></div>`);
    } else if(m.type==='history-import') {
      html = renderHistoryImport();
    } else if(m.type==='backup') {
      html=shell('数据与备份','让客户记录，留在你手里。',`<div class="modal-body"><div class="helper-box">${demoMode?'当前处于示例模式，备份操作仅针对示例数据。退出示例后可备份正式记录。':'当前数据保存在这个浏览器、这个网址下。关闭网页后仍会保留；更换电脑、浏览器或清理网站数据时，需要通过备份恢复。'}</div><div class="backup-actions"><button class="backup-option" data-action="history-import">${icon('upload')}<span><strong>导入历史客户 / 打样</strong><small>支持 Excel、CSV 与腾讯文档导出表格，预览后追加导入。</small></span></button><button class="backup-option" data-action="export">${icon('download')}<span><strong>${loadError?'导出原始数据':'导出全部记录'}</strong><small>下载 JSON 文件，包含客户档案、打样单与跟进历史。<br>当前共 ${data.customers.length} 位客户、${data.samples.length} 笔打样。</small></span></button><button class="backup-option" data-action="import" ${loadError?'disabled':''}>${icon('upload')}<span><strong>从备份恢复</strong><small>选择本系统导出的 JSON 文件。恢复前会确认数量；<br>恢复将替换当前数据，请先导出当前记录。</small></span></button></div><p class="save-warning">建议定期导出备份。第一版不提供跨设备同步，也不会自动向客户发送消息。</p></div>`);
    }
    $('#overlay-root').innerHTML=html;
    if(m.type==='new-sample'||m.type==='sample-edit')syncCustomerFields();
  }
  function syncCustomerFields() {
    const show=$('#customer-select')?.value==='new',el=$('#inline-customer');if(!el)return;
    el.hidden=!show;el.querySelectorAll('input,textarea').forEach(x=>x.disabled=!show);
  }
  function importRows(sheetName) {
    if(historyImport.csvRows)return historyImport.csvRows;
    const ws=historyImport.workbook.Sheets[sheetName];
    const ref=ws['!fullref']||ws['!ref'];
    if(ref&&XLSX.utils.decode_range(ref).e.r>5001)throw Error('该工作表超过 5000 行，请拆分后导入。');
    return I.expandMerges(XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true,blankrows:true}),ws['!merges']);
  }
  function refreshImportPlan() {
    try {
      const tracking={};
      if(historyImport.workbook?.Sheets['打样客户跟踪表']){
        const rows=importRows('打样客户跟踪表'),head=rows[0]||[];
        for(const r of rows.slice(1)){
          const code=String(r[1]??'').trim();if(!code)continue;
          const items=r.slice(2).map((v,i)=>{
            if(v===''||v==null)return '';
            let label=head[i+2]||'跟进备注';
            if(typeof label==='number')try{label=I.date(label);}catch{label='跟进备注';}
            return `${label}：${v}`;
          }).filter(Boolean);
          if(items.length)tracking[I.norm(code)]='原表客户跟踪（客户层面的记录）：\n'+items.join('\n');
        }
      }
      historyImport.plan=I.plan(importRows(historyImport.sheet),data,{scope:historyImport.scope,sourceName:historyImport.sheet,tracking});
      historyImport.error='';
    }catch(e){historyImport.error=e.message;historyImport.plan=null;}
  }
  function renderHistoryImport() {
    const state=historyImport,p=state?.plan;
    const step=state?.applied?3:p?2:1;
    const steps=`<div class="import-steps">${['选择表格','核对预览','完成导入'].map((t,i)=>`<span class="${step>=i+1?'on':''}"><b>${i+1}</b>${t}</span>`).join('')}</div>`;
    let body='';
    if(state?.applied){
      body=`<div class="import-success">${icon('check')}<h3>历史记录已加入台账</h3><p>新增 ${p.newCustomers} 位客户、${p.newSamples} 笔打样。${p.duplicates?`跳过 ${p.duplicates} 行重复记录。`:''}</p><p>未安排联系日期的打样，可在首页“待安排”中继续处理。</p>${p.errors?`<p class="save-warning">${p.errors} 行资料不完整，尚未导入。可下载核对结果，补齐后再次导入。</p>`:''}</div>`;
    }else if(state?.loading){body='<div class="empty"><h3>正在读取表格…</h3><p>只在当前浏览器中解析，请稍候。</p></div>';}
    else if(!state){
      body=`<div class="import-drop"><div class="empty-icon">${icon('upload')}</div><h3>把积累的客户，接到新的跟进台账</h3><p>支持 .xlsx、.xls、.csv、.tsv<br>一次最多 5000 行，文件不超过 10MB</p><button class="primary" data-action="history-pick">${icon('file')}选择历史表格</button><button class="small-link" data-action="history-template">下载空白 Excel 模板</button></div><div class="import-guide"><strong>数据在腾讯文档里？</strong><p>在腾讯文档中选择“导出为 Excel”，然后在这里选择导出的文件。导入时可选择“详细表”，不用重新整理列名。</p><p>默认筛选：有客户编号、备注含“样品”的记录。同一客户的多笔打样分别保留。</p></div><div class="helper-box">这是追加导入，已有客户和跟进记录会保留。文件只在当前浏览器中处理，不会上传到公开网页。</div>`;
    }else{
      body=`<div class="import-file-info">${icon('file')}<span>${esc(state.filename)}</span><button class="small-link" data-action="history-pick">重新选择</button></div><div class="import-controls">${state.workbook?`<label class="field">选择工作表<select id="history-sheet">${state.workbook.SheetNames.map(n=>`<option value="${esc(n)}" ${state.sheet===n?'selected':''}>${esc(n)}</option>`).join('')}</select></label>`:''}${p?.detailed?`<label class="field">导入范围<select id="history-scope"><option value="samples" ${state.scope==='samples'?'selected':''}>有客户编号，且备注含“样品”</option><option value="all" ${state.scope==='all'?'selected':''}>全部有效记录（仍需客户编号 / 昵称）</option></select></label>`:''}</div>${state.error?`<div class="error-banner" role="alert">${esc(state.error)}</div>`:''}${p?`<div class="import-totals"><div><b>${p.newCustomers}</b><span>新增客户</span></div><div><b>${p.newSamples}</b><span>新增打样</span></div><div><b>${p.duplicates}</b><span>重复跳过</span></div><div class="${p.errors?'warn':''}"><b>${p.errors}</b><span>资料待补</span></div></div><div class="import-summary">共读取 ${p.total} 行 · 范围外 ${p.excluded} 行 · ${p.warnings} 行有待补充信息<br>按客户编号优先匹配；无编号时按昵称和联系方式匹配。已有资料和跟进记录不被覆盖。</div>${p.warnings?'<div class="helper-box">“原表已交货”的历史样品会保留该事实；没有实际寄出日期时标为待补。交货日期单独保存，不当作寄出日期。原客户跟踪进度以备注保留，避免把客户的大货状态套到每笔打样上。</div>':''}<div class="import-preview"><table><thead><tr><th>原表行</th><th>客户 / 产品</th><th>处理结果</th></tr></thead><tbody>${[...p.result].sort((a,b)=>{const order={error:0,warning:1,ready:2,duplicate:3,excluded:4};return order[a.kind]-order[b.kind]||a.row-b.row;}).slice(0,40).map(r=>`<tr><td>${r.row}</td><td><div class="table-title">${esc(r.name)}</div><div class="subline">${esc(r.product)}</div></td><td><span class="import-label ${r.kind}">${{ready:'可导入',warning:'可导入 · 待补信息',error:'暂不导入',duplicate:'重复跳过',excluded:'范围外'}[r.kind]}</span><div class="import-result-message">${esc(r.message)}</div></td></tr>`).join('')}</tbody></table></div><div class="import-summary">预览前 40 行，优先展示需核对的记录。完整结果可下载留存。<br>缺客户编号 / 昵称、缺数量等错误行会跳过，补齐后可再次导入。</div>`:''}`;
    }
    const footer=state?.applied?`<div class="modal-footer"><button class="secondary" data-action="history-report">下载核对结果</button><button class="primary" data-action="close">完成</button></div>`:p?`<div class="modal-footer import-footer"><button class="small-link" data-action="export">先备份现有记录</button><div class="actions"><button class="secondary" data-action="history-report">下载核对结果</button><button class="primary" data-action="history-apply" ${!p.accepted||loadError?'disabled':''}>确认追加 ${p.newCustomers} 位客户 / ${p.newSamples} 笔打样</button></div></div>`:'';
    return shell('导入历史客户','追加历史资料，让后续跟进接得上。',`<div class="modal-body">${steps}${errorBox}${body}</div>`,footer,true);
  }
  function saveBlob(body,filename,type) {
    const blob=new Blob([body],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function downloadImportTemplate() {
    const headers=['客户昵称','客户编号','联系方式','客户来源','客户备注','产品名称','规格要求','数量','原始日期','约定完成日期','实际寄出日期','快递单号','当前进度','下次联系日期','沟通记录','结束结果','结束原因'];
    const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols']=headers.map(h=>({wch:h==='规格要求'||h==='沟通记录'?35:20}));
    XLSX.utils.book_append_sheet(wb,ws,'导入数据');
    const help=[['填写说明'],['仅导客户：填写客户昵称或客户编号，产品名称留空。'],['导入打样：另填产品名称和正整数数量。'],['客户编号用于匹配老客户；电话、编号等请设成文本格式以保留开头的 0。'],['日期格式：2026-10-22。下次联系日期不填时，会显示在“待安排”。'],['进度：待确认、制样中、已寄出待反馈、已结束；不填则根据寄出日期判断。'],['已寄出待反馈需填实际寄出日期；已结束需填结束结果：已转大货 / 未成交。'],['支持直接导入腾讯文档导出的 Excel，并选择“详细表”。'],['文件只在当前浏览器解析。导入是追加操作，不替换整个台账。']];
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(help),'填写说明');
    saveBlob(XLSX.write(wb,{bookType:'xlsx',type:'array'}),'历史客户导入模板.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  function downloadImportReport() {
    if(!historyImport?.plan)return;
    const cell=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const rows=[['原表行','客户','产品','结果','说明'],...historyImport.plan.result.map(r=>[r.row,r.name,r.product,{ready:'可导入',warning:'可导入，待补信息',error:'资料待补，未导入',duplicate:'重复跳过',excluded:'不在范围内'}[r.kind],r.message])];
    saveBlob('\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),`历史导入核对结果-${C.today()}.csv`,'text/csv;charset=utf-8');
  }
  function applyHistoryImport() {
    const p=historyImport?.plan;if(!p||!p.accepted||historyImport.applied)return;
    if(!commit(p.next))return;
    historyImport.applied=true;render();renderModal();toast(demoMode?'已追加到独立示例台账':'历史记录已追加导入');
  }
  $('#history-file').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    if(modal?.type!=='history-import')openModal('history-import');
    const state={filename:file.name,loading:true,scope:'samples'};historyImport=state;renderModal();
    try {
      if(file.size>10*1024*1024)throw Error('文件超过 10MB，请拆分或导出较小的表格。');
      const ext=file.name.split('.').at(-1).toLowerCase();
      if(!['xlsx','xls','csv','tsv'].includes(ext))throw Error('请选择 Excel、CSV 或 TSV 文件。');
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(historyImport!==state||modal?.type!=='history-import')return;
      if(ext==='csv'||ext==='tsv'){
        let source;
        if(bytes[0]===255&&bytes[1]===254)source=new TextDecoder('utf-16le').decode(bytes);
        else try{source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{source=new TextDecoder('gb18030').decode(bytes);}
        state.csvRows=I.csv(source);state.sheet=file.name;
      }else{
        state.workbook=XLSX.read(bytes,{type:'array',cellDates:false,cellFormula:false,cellHTML:false,sheetRows:5002});
        if(!state.workbook.SheetNames.length)throw Error('表格没有工作表。');
        state.sheet=state.workbook.SheetNames.includes('详细表')?'详细表':state.workbook.SheetNames[0];
      }
      state.loading=false;refreshImportPlan();renderModal();
    } catch(err){if(historyImport!==state||modal?.type!=='history-import')return;state.loading=false;state.error='无法读取：'+err.message;state.plan=null;renderModal();}
  });

  function history(type,text) { return {id:C.uid(),type,text,at:new Date().toISOString()}; }
  function saveForm(form) {
    const f=Object.fromEntries(new FormData(form)), next=structuredClone(data), now=new Date().toISOString();
    for(const k in f) if(typeof f[k]==='string') f[k]=f[k].trim();
    let resultId='';
    if(form.dataset.kind==='customer') {
      if(!f.name)return formError('请填写客户昵称。');
      let c=next.customers.find(x=>x.id===modal.id);
      if(!c){c={id:C.uid(),createdAt:now};next.customers.push(c);}
      Object.assign(c,{name:f.name,contact:f.contact,source:f.source,notes:f.notes,externalCode:f.externalCode});resultId=c.id;
    }
    if(form.dataset.kind==='sample') {
      let customerId=f.customerId;
      if(customerId==='new') {
        if(!f.name)return formError('请填写客户昵称。');
        customerId=C.uid();next.customers.push({id:customerId,name:f.name,contact:f.contact,source:f.source,notes:f.notes,externalCode:f.externalCode,createdAt:now});
      }
      if(!next.customers.some(c=>c.id===customerId))return formError('请选择客户，或新建客户。');
      if(!f.product)return formError('请填写产品名称。');
      if(f.sentDate && f.sentDate>C.today())return formError('实际寄出日期不能晚于今天。');
      if(f.status==='已寄出待反馈'&&!f.sentDate&&!data.samples.find(x=>x.id===modal.id)?.historicalDelivered)return formError('请填写实际寄出日期，再标记为已寄出。');
      if(f.status==='已结束'&&!f.outcome)return formError('请选择结束结果：已转大货或未成交。');
      let s=next.samples.find(x=>x.id===modal.id);
      if(!s){s={id:C.uid(),history:[],createdAt:now};next.samples.push(s);s.history.push(history('system','新建打样记录'));}
      else {
        if(s.status!==f.status)s.history.push(history('system',`进度更新：${s.status} → ${f.status}`));
        if(s.nextDate!==f.nextDate)s.history.push(history('system',`下次联系：${f.nextDate||'待安排'}`));
      }
      Object.assign(s,{customerId,product:f.product,specs:f.specs,quantity:Number(f.quantity),dueDate:f.dueDate,status:f.status,sentDate:f.sentDate,tracking:f.tracking,nextDate:f.nextDate,outcome:f.status==='已结束'?f.outcome:'',reason:f.status==='已结束'?f.reason:''});
      if(f.firstNote)s.history.push(history('note',f.firstNote));resultId=s.id;
    }
    if(form.dataset.kind==='follow') {
      const s=next.samples.find(x=>x.id===modal.id);if(!s||s.status==='已结束')return formError('这笔打样已结束，请先检查打样详情。');
      if(!f.text)return formError('请填写本次沟通或客户反馈。');
      s.history.push(history('note',f.text));
      if(f.result==='continue') {s.nextDate=f.nextDate;s.history.push(history('system','下次联系：'+(f.nextDate||'待安排')));}
      else {s.status='已结束';s.outcome=f.result;s.reason=f.reason;s.history.push(history('system',`结束打样：${f.result}${f.reason?'；'+f.reason:''}`));}
      resultId=s.id;
    }
    if(!commit(next))return;
    closeModal(true);render();toast(demoMode?'示例记录已更新':'已保存');
    openModal(form.dataset.kind==='customer'?'customer':'detail',resultId);
  }
  function download() {
    let body=loadError?savedRaw:JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2);
    if(!body){toast('没有可导出的原始数据');return;}
    const blob=new Blob([body],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`样有回音-${demoMode?'示例-':''}${C.today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份已导出，请妥善保管');
  }
  function action(el) {
    const a=el.dataset.action,id=el.dataset.id;
    if(a==='nav'){closeModal();if(modal)return;view=el.dataset.view;query='';statusFilter='';render();window.scrollTo(0,0);}
    else if(a==='tab'){activeTab=el.dataset.tab;render();}
    else if(a==='show-all'){activeTab='all';render();}
    else if(a==='new-sample')openModal('new-sample');
    else if(a==='new-customer')openModal('new-customer');
    else if(a==='detail'||a==='customer'||a==='follow')openModal(a,id);
    else if(a==='edit-sample')openModal('sample-edit',id);
    else if(a==='edit-customer')openModal('customer-edit',id);
    else if(a==='sample-for-customer'){openModal('new-sample');$('#customer-select').value=id;syncCustomerFields();requestAnimationFrame(()=>{const f=$('#modal-form');initialForm=JSON.stringify([...new FormData(f)]);});}
    else if(a==='close')closeModal();
    else if(a==='backup')openModal('backup');
    else if(a==='history-import'){historyImport=null;openModal('history-import');}
    else if(a==='history-pick'){const f=$('#history-file');f.value='';f.click();}
    else if(a==='history-template')downloadImportTemplate();
    else if(a==='history-apply')applyHistoryImport();
    else if(a==='history-report')downloadImportReport();
    else if(a==='history-back'){historyImport=null;renderModal();}
    else if(a==='export')download();
    else if(a==='import'){$('#import-file').value='';$('#import-file').click();}
    else if(a==='quick-date'){$('[name=nextDate]').value=C.offset(C.today(),Number(el.dataset.days));}
    else if(a==='clear-filters'){query='';statusFilter='';render();}
    else if(a==='demo'){closeModal();if(modal)return;demoMode=true;data=C.demo();view='today';activeTab='all';query='';statusFilter='';render();window.scrollTo(0,0);toast('已进入独立的示例体验');}
    else if(a==='demo-exit'){closeModal();if(modal)return;demoMode=false;load();view='today';activeTab='all';query='';statusFilter='';render();window.scrollTo(0,0);}
  }
  document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(el&&!el.disabled)action(el);else if(e.target.classList.contains('modal-backdrop'))closeModal();});
  document.addEventListener('submit',e=>{if(e.target.id==='modal-form'){e.preventDefault();saveForm(e.target);}});
  document.addEventListener('change',e=>{
    if(e.target.id==='history-sheet'){historyImport.sheet=e.target.value;historyImport.scope='samples';refreshImportPlan();renderModal();}
    if(e.target.id==='history-scope'){historyImport.scope=e.target.value;refreshImportPlan();renderModal();}
    if(e.target.id==='status-filter'){statusFilter=e.target.value;render();}
    if(e.target.id==='customer-select')syncCustomerFields();
    if(e.target.id==='sample-status')$('#end-fields').hidden=e.target.value!=='已结束';
    if(e.target.id==='follow-result'){$('#follow-next').hidden=e.target.value!=='continue';$('#follow-end').hidden=e.target.value==='continue';}
  });
  document.addEventListener('input',e=>{if(e.target.id==='search-input'){const pos=e.target.selectionStart;query=e.target.value;render();const input=$('#search-input');input.focus();try{input.setSelectionRange(pos,pos);}catch{}}});
  document.addEventListener('keydown',e=>{
    if(!modal)return;
    if(e.key==='Escape'){e.preventDefault();closeModal();}
    if(e.key==='Tab'){
      const els=[...document.querySelectorAll('.modal button:not(:disabled),.modal input:not(:disabled),.modal select:not(:disabled),.modal textarea:not(:disabled),.modal a[href]')].filter(x=>x.getClientRects().length);
      const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  $('#import-file').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try {
      if(file.size>20*1024*1024)throw new Error('备份文件超过 20MB，请选择较小的文件。');
      const next=C.validate(JSON.parse(await file.text()));
      if(!confirm(`即将恢复 ${next.customers.length} 位客户、${next.samples.length} 笔打样。\n这将替换${demoMode?'示例':'当前正式'}记录，是否已备份并确认恢复？`))return;
      if(commit({version:1,customers:next.customers,samples:next.samples})){closeModal(true);render();toast('备份已恢复');}
    } catch(err){toast(err instanceof SyntaxError?'文件无法读取，请选择本系统导出的 JSON 备份。':err.message);}
  });
  window.addEventListener('storage',e=>{if(e.key===KEY&&!demoMode){if(modal){externalChanged=true;toast('其他窗口已更新记录，请关闭弹窗后再操作');}else{load();render();}}});
  let lastDay=C.today();setInterval(()=>{const d=C.today();if(d!==lastDay){lastDay=d;render();}},30000);
  render();
})();
