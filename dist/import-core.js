(function(root){
  'use strict';
  const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.FollowupCore;
  const text=v=>String(v??'').trim();
  const norm=v=>text(v).normalize('NFKC').replace(/[\s\u200b]/g,'').toLowerCase();
  function date(v,year=''){
    if(v===''||v==null)return '';
    if(typeof v==='number'){
      if(v<1||v>2958465||Math.floor(v)===60)throw Error('日期序号无效');
      return new Date(Date.UTC(1899,11,30)+(Math.floor(v)+(v<60?1:0))*86400000).toISOString().slice(0,10);
    }
    const s=text(v);let m=s.match(/^(\d{4})[年/.-](\d{1,2})[月/.-](\d{1,2})日?(?:[ T].*)?$/);
    if(!m){const p=s.match(/^(\d{1,2})[月/.-](\d{1,2})日?$/);if(p&&year)m=['',year,p[1],p[2]];}
    if(!m)throw Error('日期需填写完整年月日');
    const value=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    if(!C.dateValid(value))throw Error('日期不存在');return value;
  }
  function csv(s){
    s=s.replace(/^\uFEFF/,'');const first=s.split(/\r?\n/)[0]||'';
    const delimiter=first.includes('\t')?'\t':',';
    const rows=[];let row=[],cell='',quoted=false,afterQuote=false;
    for(let i=0;i<s.length;i++){
      const c=s[i];
      if(quoted){if(c==='"'){if(s[i+1]==='"'){cell+='"';i++;}else{quoted=false;afterQuote=true;}}else cell+=c;}
      else if(c==='"'&&!cell&&!afterQuote)quoted=true;
      else if(c===delimiter){row.push(cell);cell='';afterQuote=false;}
      else if(c==='\r'||c==='\n'){if(c==='\r'&&s[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';afterQuote=false;}
      else if(afterQuote&&!/\s/.test(c))throw Error('CSV 引号后有多余字符，请重新导出');
      else if(!afterQuote)cell+=c;
    }
    if(quoted)throw Error('CSV 存在未闭合的引号，请重新导出');
    if(cell||row.length)rows.push([...row,cell]);
    return rows;
  }
  function table(rows){
    const index=rows.findIndex(r=>r.some(x=>['客户昵称','客户名称','客户编号','客户姓名'].includes(text(x))));
    if(index<0)throw Error('找不到表头。请使用导入模板，或选择腾讯文档的“详细表”工作表。');
    const headers=rows[index].map(text);
    return{headers,headerRow:index,rows:rows.slice(index+1).map((r,i)=>({values:r,row:i+index+2})).filter(r=>r.values.some(x=>text(x)))};
  }
  function column(headers,...names){return headers.findIndex(h=>names.map(norm).includes(norm(h)));}
  function plan(rows,existing,options={}){
    C.validate(existing);const t=table(rows),h=t.headers;
    if(t.rows.length>5000)throw Error('一次最多导入 5000 行，请拆分后再导入。');
    const detailed=h.includes('产品型号')&&h.includes('客户编号');
    const get=(r,...names)=>{const i=column(h,...names);return i<0?'':r[i]??'';};
    const next=structuredClone(existing),result=[],at=new Date().toISOString();
    const importedKeys=new Set(next.samples.map(s=>s.importKey).filter(Boolean));
    let newCustomers=0,newSamples=0,duplicates=0,excluded=0,errors=0,warnings=0;
    const customersByCode=new Map(),customersByIdentity=new Map();
    for(const c of next.customers){if(c.externalCode)customersByCode.set(norm(c.externalCode),c);const key=JSON.stringify([norm(c.name),norm(c.contact)]);if(customersByIdentity.has(key))customersByIdentity.set(key,null);else customersByIdentity.set(key,c);}
    for(const item of t.rows){
      const r=item.values,code=text(get(r,'客户编号')),product=text(get(r,'产品名称','产品型号')),name=text(get(r,'客户昵称','客户名称','客户姓名'))||(code?`客户 ${code}`:'');
      const notes=h.map((v,i)=>norm(v)==='备注'?text(r[i]):'').filter(Boolean).join('；');
      const info={row:item.row,name:name||'未填写客户',product:product||'仅客户档案',kind:'',message:''};
      if(detailed){
        if(!product){excluded++;result.push({...info,kind:'excluded',message:'空产品行 / 汇总行'});continue;}
        if(options.scope!=='all'&&(!code||!notes.includes('样品'))){excluded++;result.push({...info,kind:'excluded',message:!code?'缺少客户编号，暂不导入':'备注未标注“样品”，不在本次范围'});continue;}
      }
      try{
        if(!name)throw Error('缺少客户昵称或客户编号');
        if(name.length>120||code.length>120)throw Error('客户昵称或编号过长');
        const contact=text(get(r,'联系方式','电话','微信','旺旺')),source=text(get(r,'客户来源','来源'))||(detailed?'腾讯文档历史导入':'历史导入');
        const identity=JSON.stringify([norm(name),norm(contact)]);
        let c=code?customersByCode.get(norm(code)):customersByIdentity.get(identity);
        if(c===null)throw Error('现有同名同联系方式客户不止一个，请补客户编号后重试');
        if(c&&code&&c.externalCode&&norm(c.externalCode)!==norm(code))throw Error('客户编号不一致，请核对客户资料');
        if(!c&&code){const named=customersByIdentity.get(identity);if(named&&!named.externalCode)c=named;}
        let sample=null,issues=[];
        if(product){
          if(product.length>200)throw Error('产品名称过长');
          const rawQty=get(r,'打样数量','数量'),qty=Number(text(rawQty));
          if(!text(rawQty)||!Number.isInteger(qty)||qty<1||qty>1000000)throw Error('数量缺失或不是有效的正整数，请补齐后重试');
          const originalDate=date(get(r,'原始日期','日期'));
          const year=originalDate.slice(0,4);
          const dt=(label,...aliases)=>{try{return date(get(r,...aliases),year);}catch(e){throw Error(label+'：'+e.message);}};
          const sentDate=dt('寄出日期','实际寄出日期','寄出日期'),nextDate=dt('下次联系日期','下次联系日期','下次跟进日期'),dueDate=dt('约定完成日期','约定完成日期');
          if(sentDate>C.today())throw Error('实际寄出日期晚于今天');
          let deliveryDate='';try{deliveryDate=date(get(r,'交货日期'),year);}catch{issues.push('原表交货日期待核实，原值已保留');}
          const historicalDelivered=detailed&&['是','已交货','已送样','已寄出'].includes(text(get(r,'是否交货')));
          let status=text(get(r,'当前进度','打样进度'))|| (historicalDelivered||sentDate?'已寄出待反馈':'待确认');
          const aliases={'已寄出':'已寄出待反馈','待反馈':'已寄出待反馈','制样':'制样中','已完成':'已结束'};status=aliases[status]||status;
          if(!C.STATUSES.includes(status))throw Error('进度无法识别，请改为待确认、制样中、已寄出待反馈或已结束');
          const outcome=status==='已结束'?text(get(r,'结束结果','成交结果')):'';
          if(status==='已结束'&&!['已转大货','未成交'].includes(outcome))throw Error('已结束记录需填写“已转大货”或“未成交”');
          if(status==='已寄出待反馈'&&!sentDate&&!historicalDelivered)throw Error('已寄出记录缺少实际寄出日期');
          if(historicalDelivered&&!sentDate)issues.push('原表已交货，实际寄出日期待补');
          const specs=[text(get(r,'规格要求')),...['尺寸','电压温度','特殊要求','电阻','冲击功率','最大功率','稳定功率(干烧)','稳定功率(吹风)'].map(k=>{const v=text(get(r,k));return v?`${k}：${v}`:'';})].filter(Boolean).join('\n');
          if(specs.length>30000)throw Error('规格要求过长');
          const serial=text(get(r,'序列号','原始序号'))||String(item.row);
          const importKey=JSON.stringify([detailed?'tencent-detail':'standard',code||name,serial,originalDate,product,specs,qty]);
          if(importedKeys.has(importKey)){duplicates++;result.push({...info,kind:'duplicate',message:'这笔记录已导入，保留现有进度与反馈'});continue;}
          const rawInfo=h.map((label,i)=>{if(!label||!text(r[i]))return '';let value=text(r[i]);if((label==='日期'||label.includes('日期'))&&typeof r[i]==='number')try{value=date(r[i]);}catch{}return `${label}：${value}`;}).filter(Boolean).join('\n');
          if(rawInfo.length>28000)throw Error('单行内容过长，请拆分备注');
          const extra=options.tracking?.[norm(code)]||'';
          const feedback=[notes?'原表备注：'+notes:'',text(get(r,'沟通记录','客户反馈','首次沟通记录')),extra].filter(Boolean).join('\n');
          sample={id:C.uid(),customerId:'',product,specs,quantity:qty,dueDate,sentDate,nextDate,status,tracking:text(get(r,'快递单号')),outcome,reason:status==='已结束'?text(get(r,'结束原因','结束原因 / 备注')):'',createdAt:originalDate?originalDate+'T04:00:00.000Z':at,importKey,historicalDelivered,deliveryDate,history:[{id:C.uid(),type:'system',text:`历史导入 · ${options.sourceName||'表格'} · 第 ${item.row} 行\n${rawInfo}`,at}]};
          if(feedback)sample.history.push({id:C.uid(),type:'note',text:feedback,at});
        }
        if(!c){c={id:C.uid(),name,externalCode:code,contact,source,notes:text(get(r,'客户备注'))||(!product?notes:''),createdAt:at};next.customers.push(c);newCustomers++;if(code)customersByCode.set(norm(code),c);customersByIdentity.set(identity,c);}
        if(sample){sample.customerId=c.id;next.samples.push(sample);importedKeys.add(sample.importKey);newSamples++;}
        else if(existing.customers.some(x=>x.id===c.id)||result.some(x=>x.customerId===c.id)){duplicates++;result.push({...info,kind:'duplicate',message:'客户已存在，不覆盖现有档案'});continue;}
        if(issues.length)warnings++;
        result.push({...info,customerId:c.id,kind:issues.length?'warning':'ready',message:issues.join('；')||(sample?'新增打样，关联客户档案':'新增客户档案')});
      }catch(e){errors++;result.push({...info,kind:'error',message:e.message});}
    }
    C.validate(next);
    return{next,result,newCustomers,newSamples,duplicates,excluded,errors,warnings,detailed,total:t.rows.length,accepted:result.filter(x=>['ready','warning'].includes(x.kind)).length};
  }
  function expandMerges(rows,merges){
    for(const m of merges||[]){const value=rows[m.s.r]?.[m.s.c];if(value==null||value==='')continue;for(let r=m.s.r;r<=m.e.r;r++){rows[r]||=[];for(let c=m.s.c;c<=m.e.c;c++)if(rows[r][c]==null||rows[r][c]==='')rows[r][c]=value;}}
    return rows;
  }
  const api={date,csv,table,plan,expandMerges,norm};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FollowupImport=api;
})(typeof window!=='undefined'?window:globalThis);
