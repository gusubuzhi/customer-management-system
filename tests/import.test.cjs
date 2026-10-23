const test=require('node:test'),assert=require('node:assert/strict');
const I=require('../dist/import-core.js'),C=require('../dist/core.js');
const XLSX=require('../dist/vendor/xlsx.full.min.js');
const h=['序列号','日期','产品型号','尺寸','电压温度','特殊要求','数量','报价','总价','是否交货','交货日期','客户编号','备注'];
const row=(id='C-001',note='样品',serial='1')=>[serial,'2026/5/12','测试铝壳','66x20x5','220V270℃','封胶',5,2,10,'是','5月15日',id,note];
const run=(rows,old=C.empty(),options={})=>I.plan([h,...rows],old,{scope:'samples',...options});
test('按客户编号和样品备注筛选，批量及无编号记录不导入',()=>{
  const p=run([row(),row('','样品','2'),row('C-002','仓库补货','3')]);
  assert.equal(p.newCustomers,1);assert.equal(p.newSamples,1);assert.equal(p.excluded,2);
});
test('同一客户的不同规格分开保留，二次导入跳过并保留现有反馈',()=>{
  const a=row(),b=row('C-001','样品','2');b[4]='24V100℃';
  const p=run([a,b]);assert.equal(p.newCustomers,1);assert.equal(p.newSamples,2);
  p.next.samples[0].history.push({id:C.uid(),type:'note',at:new Date().toISOString(),text:'已经追加的反馈'});
  const again=run([a,b],p.next);assert.equal(again.duplicates,2);assert.equal(again.newSamples,0);
  assert.equal(again.next.samples[0].history.at(-1).text,'已经追加的反馈');
});
test('缺数量、错误数量和错误日期行被单独跳过，好行仍可导入',()=>{
  const missing=row('C-2','样品','2');missing[6]='';
  const wrong=row('C-3','样品','3');wrong[6]=1.5;
  const badDate=row('C-4','样品','4');badDate[1]='2026-02-30';
  const p=run([row(),missing,wrong,badDate]);assert.equal(p.errors,3);assert.equal(p.newSamples,1);assert.equal(p.newCustomers,1);
});
test('历史已交货不伪造寄出日期，原表交货日期与原始信息单独保留',()=>{
  const p=run([row()]),s=p.next.samples[0];C.validate(p.next);
  assert.equal(s.status,'已寄出待反馈');assert.equal(s.sentDate,'');assert.equal(s.deliveryDate,'2026-05-15');
  assert.equal(s.historicalDelivered,true);assert.equal(p.warnings,1);assert.match(s.history[0].text,/报价：2/);
  assert.equal(C.bucket(s),'unscheduled');
});
test('新建和普通导入的已寄出记录仍然要求寄出日期',()=>{
  const p=I.plan([['客户昵称','产品名称','数量','当前进度'],['测试客户','样品',3,'已寄出待反馈']],C.empty());
  assert.equal(p.errors,1);assert.equal(p.newSamples,0);
});
test('原表有交货日期但无年份时不会猜年份，无法核实的日期保留为待核实',()=>{
  const r=row();r[1]='';const p=run([r]);assert.equal(p.newSamples,1);assert.equal(p.next.samples[0].deliveryDate,'');assert.equal(p.warnings,1);
});
test('只有客户资料也可导入，已有档案不覆盖，同名不同联系方式分开',()=>{
  const rows=[['客户昵称','客户编号','联系方式','客户备注'],['测试客户','','wxA','旧备注'],['测试客户','','wxB','新备注']];
  const p=I.plan(rows,C.empty());assert.equal(p.newCustomers,2);assert.equal(p.newSamples,0);
  const q=I.plan([rows[0],['测试客户','','wxA','覆盖备注']],p.next);assert.equal(q.newCustomers,0);assert.equal(q.duplicates,1);assert.equal(q.next.customers[0].notes,'旧备注');
});
test('CSV支持BOM、逗号、双引号和换行，未闭合引号拒绝导入',()=>{
  assert.deepEqual(I.csv('\uFEFF客户昵称,客户备注\r\n测试客户,"需求,备注\n第二行"\r\n'),[['客户昵称','客户备注'],['测试客户','需求,备注\n第二行']]);
  assert.deepEqual(I.csv('客户昵称\t客户备注\n甲\t需求'),[['客户昵称','客户备注'],['甲','需求']]);
  assert.throws(()=>I.csv('a,b\n"abc'));
});
test('Excel日期序号、闰年、无效日期和少于60序号',()=>{
  assert.equal(I.date(46109),'2026-03-28');assert.equal(I.date(1),'1900-01-01');
  assert.equal(I.date('2月29日','2028'),'2028-02-29');assert.throws(()=>I.date(60));assert.throws(()=>I.date('2026/2/29'));
});
test('合并单元格仅填充明确的合并范围，空白客户编号不跨行猜测',()=>{
  const rows=[['客户编号'],['C-001'],[''],['']];I.expandMerges(rows,[{s:{r:1,c:0},e:{r:2,c:0}}]);assert.equal(rows[2][0],'C-001');assert.equal(rows[3][0],'');
});
test('Excel多工作表读写可重现导入结果，不修改原始台账',()=>{
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([h,row()]),'详细表');
  const loaded=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
  const old=C.demo(),before=JSON.stringify(old);const p=I.plan(XLSX.utils.sheet_to_json(loaded.Sheets['详细表'],{header:1,defval:''}),old,{scope:'samples'});
  assert.equal(p.newSamples,1);assert.equal(JSON.stringify(old),before);
});
test('客户层面的大货进度只保留为备注，不替每笔样品下成交结论',()=>{
  const p=run([row()],C.empty(),{tracking:{'c-001':'原表客户跟踪：已批量下定'}});
  assert.equal(p.next.samples[0].outcome,'');assert.match(p.next.samples[0].history.at(-1).text,/已批量下定/);
});
test('已结束记录要求成交结果，原有与导入历史备份均能校验',()=>{
  const p=I.plan([['客户昵称','产品名称','数量','当前进度','结束结果'],['测试客户','测试样品',1,'已结束','已转大货']],C.empty());
  assert.equal(p.newSamples,1);C.validate(JSON.parse(JSON.stringify(p.next)));assert.equal(C.bucket(p.next.samples[0]),'ended');
});
test('只有客户编号的表格可建立档案，非法客户编号类型会被校验拒绝',()=>{
  const p=I.plan([['客户编号'],['T-001']],C.empty());assert.equal(p.newCustomers,1);assert.equal(p.newSamples,0);
  p.next.customers[0].externalCode={bad:true};assert.throws(()=>C.validate(p.next));
});
