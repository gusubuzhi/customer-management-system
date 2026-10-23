(function (root) {
  'use strict';
  const STATUSES = ['待确认', '制样中', '已寄出待反馈', '已结束'];
  function today() {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  function dateValid(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }
  function offset(s, n) { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function days(a, b) { return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000); }
  function bucket(s, day = today()) {
    if (s.status === '已结束') return 'ended';
    if (!s.nextDate) return 'unscheduled';
    return s.nextDate < day ? 'overdue' : s.nextDate === day ? 'today' : 'upcoming';
  }
  function sorted(records) { return [...records].sort((a,b) => (a.nextDate || '9999').localeCompare(b.nextDate || '9999') || b.createdAt.localeCompare(a.createdAt)); }
  function empty() { return { version: 1, customers: [], samples: [] }; }
  function uid() { return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  function validate(d) {
    if (!d || d.version !== 1 || !Array.isArray(d.customers) || !Array.isArray(d.samples)) throw new Error('这不是有效的打样跟进备份文件。');
    if(d.customers.length > 50000 || d.samples.length > 100000) throw new Error('文件中的记录过多。');
    const ids = new Set();
    const str = (v, max=30000) => typeof v === 'string' && v.length <= max;
    for (const c of d.customers) {
      if (!c || !str(c.id,150) || !c.id || ids.has(c.id) || !str(c.name,120) || !c.name.trim() || !['contact','source','notes','createdAt'].every(k=>str(c[k]))) throw new Error('客户资料格式不完整或编号重复。');
      ids.add(c.id);
      if(c.externalCode !== undefined && !str(c.externalCode,120)) throw new Error('客户编号格式不正确。');
    }
    const sampleIds = new Set();
    for (const s of d.samples) {
      if (!s || !str(s.id,150) || !s.id || sampleIds.has(s.id) || !ids.has(s.customerId) || !str(s.product,200) || !s.product.trim() || !Number.isInteger(s.quantity) || s.quantity < 1 || s.quantity > 1000000 || !STATUSES.includes(s.status) || !Array.isArray(s.history)) throw new Error('打样记录格式不正确，或关联客户不存在。');
      for(const k of ['specs','tracking','reason','createdAt']) if(!str(s[k])) throw new Error('打样信息不完整。');
      for(const k of ['dueDate','sentDate','nextDate']) if(s[k] !== '' && !dateValid(s[k])) throw new Error('记录中有无效的日期。');
      if(s.status === '已寄出待反馈' && !s.sentDate && !(s.historicalDelivered === true && typeof s.importKey === 'string' && s.importKey)) throw new Error('已寄出的打样需要填写寄出日期。');
      if(s.importKey !== undefined && !str(s.importKey,50000)) throw new Error('导入来源格式不正确。');
      if(s.deliveryDate !== undefined && s.deliveryDate !== '' && !dateValid(s.deliveryDate)) throw new Error('原表交货日期格式不正确。');
      if(s.historicalDelivered !== undefined && typeof s.historicalDelivered !== 'boolean') throw new Error('历史交货标记格式不正确。');
      if(s.status === '已结束' && !['已转大货','未成交'].includes(s.outcome)) throw new Error('已结束的打样需要填写结果。');
      if(s.status !== '已结束' && s.outcome !== '') throw new Error('未结束的打样不能包含结束结果。');
      for(const h of s.history) if(!h || !str(h.id,150) || !str(h.text) || !h.text.trim() || !str(h.at,100) || isNaN(Date.parse(h.at)) || !['note','system'].includes(h.type)) throw new Error('沟通记录格式不正确。');
      sampleIds.add(s.id);
    }
    return d;
  }
  function demo(day = today()) {
    const d = empty(), createdAt = day + 'T02:00:00.000Z';
    const customers = [ ['林女士','lin_home88','淘宝','家居用品开发，关注温升稳定性。'], ['陈工','chen_tech','微信','设备研发，需要确认安装尺寸。'], ['王先生','wang_smart','淘宝','智能家居项目，小批量试产。'], ['刘经理','liu_purchase','老客户','采购负责人，近期准备补货。'], ['周先生','zhou_studio','1688','新款产品验证中。'] ];
    d.customers = customers.map((c,i)=>({id:'demo-c'+i,name:c[0],contact:c[1],source:c[2],notes:c[3],createdAt}));
    const rows = [
      [0,'PTC 恒温发热片','12V / 60℃ / 30 × 20 mm，背胶安装',5,-2,-6,'已寄出待反馈','客户已收到样品，正在进行连续加热测试。'],
      [1,'铝壳加热器','24V / 80W，线长 300 mm',3,0,-3,'已寄出待反馈','安装尺寸已确认，今天询问升温测试结果。'],
      [2,'柔性硅胶加热片','12V / 15W / 100 × 50 mm',10,0,-4,'已寄出待反馈','客户反馈样品外观符合要求，等待实际装机。'],
      [3,'PTC 恒温发热片','220V / 120℃ / 带支架',8,2,-1,'已寄出待反馈','已发送快递单号，下周确认试用情况。'],
      [4,'定制陶瓷加热芯','24V / 50W，按图纸定制',2,null,null,'制样中','需求已确认，等待首件完成。'],
      [1,'迷你恒温加热板','24V / 45℃ / 40 × 40 mm',5,5,null,'制样中','首件制样中，完成后联系确认寄样。'],
      [3,'铝壳加热器','220V / 100W，标准规格',3,null,-12,'已结束','测试通过，客户已确认首批大货。']
    ];
    d.samples = rows.map((r,i)=>({id:'demo-s'+i,customerId:d.customers[r[0]].id,product:r[1],specs:r[2],quantity:r[3],nextDate:r[4]===null?'':offset(day,r[4]),sentDate:r[5]===null?'':offset(day,r[5]),dueDate:offset(day,i-5),tracking:r[5]===null?'':'SF 示例单号 '+(1000+i),status:r[6],outcome:r[6]==='已结束'?'已转大货':'',reason:r[6]==='已结束'?'测试通过，进入首批采购。':'',createdAt,history:[{id:'demo-h'+i,type:'note',text:r[7],at:offset(day,-1)+'T08:30:00.000Z'}]}));
    return d;
  }
  const api = { STATUSES, today, dateValid, offset, days, bucket, sorted, empty, uid, validate, demo };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FollowupCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
