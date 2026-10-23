const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../dist/core.js');
const DAY = '2026-10-22';
test('跟进分组跨月、跨年正确，结束记录始终退出待办', () => {
  const base = {status:'制样中'};
  assert.equal(C.bucket({...base,nextDate:'2026-10-21'}, DAY),'overdue');
  assert.equal(C.bucket({...base,nextDate:DAY}, DAY),'today');
  assert.equal(C.bucket({...base,nextDate:'2026-11-01'}, DAY),'upcoming');
  assert.equal(C.bucket({...base,nextDate:''}, DAY),'unscheduled');
  assert.equal(C.bucket({status:'已结束',nextDate:'2025-01-01'},DAY),'ended');
  assert.equal(C.offset('2026-12-31',1),'2027-01-01');
  assert.equal(C.days('2026-11-01','2026-10-31'),1);
});
test('同一客户的不同样品各自独立分组，修改日期即时重新分类', () => {
  const d = C.demo(DAY);C.validate(d);
  const samples = d.samples.filter(s=>s.customerId==='demo-c1');
  assert.equal(samples.length,2);
  assert.deepEqual(samples.map(s=>C.bucket(s,DAY)),['today','upcoming']);
  samples[0].nextDate='2026-10-25';
  assert.equal(C.bucket(samples[0],DAY),'upcoming');
  assert.equal(samples[1].nextDate,'2026-10-27');
});
test('导出、序列化、重新载入保留客户、规格和完整跟进历史', () => {
  const original=C.demo(DAY);
  const saved=JSON.stringify({...original,exportedAt:new Date().toISOString()});
  const restored=C.validate(JSON.parse(saved));
  assert.deepEqual(restored.customers,original.customers);
  assert.deepEqual(restored.samples,original.samples);
});
test('备份校验拒绝错误日期、重复编号、失去关联、无结果的结束记录和非法数量',()=>{
  const bad=[
    d=>d.samples[0].nextDate='2026-02-30',
    d=>d.customers.push({...d.customers[0]}),
    d=>d.samples[0].customerId='missing',
    d=>d.samples[0].quantity=0,
    d=>d.samples[0].status='不存在',
    d=>{d.samples[0].status='已结束';d.samples[0].outcome='';},
    d=>d.samples[0].sentDate='',
    d=>d.samples[0].history[0].at='invalid'
  ];
  for(const mutate of bad){const d=C.demo(DAY);mutate(d);assert.throws(()=>C.validate(d));}
});
test('空台账可保存，排序不改变原记录，示例不复用正式对象',()=>{
  C.validate(C.empty());
  const d=C.demo(DAY), before=JSON.stringify(d.samples);C.sorted(d.samples);
  assert.equal(JSON.stringify(d.samples),before);
  const other=C.demo(DAY);other.customers[0].name='更改';
  assert.equal(d.customers[0].name,'林女士');
});
test('中国日期格式、有效闰日及无效日期',()=>{
  assert.match(C.today(),/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(C.dateValid('2028-02-29'),true);
  assert.equal(C.dateValid('2026-02-29'),false);
  assert.equal(C.dateValid('2026-13-01'),false);
});
