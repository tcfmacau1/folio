export const types=['股票','債券','基金','保險','存款證','股票掛鈎投資','其他'];
export const currencies=['HKD','MOP','USD','CNY','EUR','GBP','JPY','TWD','AUD','SGD'];
export const colors=['#378c79','#5487b0','#8699ca','#bb9a68','#a1c5bc','#d18b73','#a9b2bc'];
export const today=()=>new Date().toISOString().slice(0,10);
export const isHistorical=(r,on=today())=>Boolean(r.maturity&&r.maturity<on);
export const statusLabel=r=>isHistorical(r)?'歷史持倉（已結清）':'目前持倉';
export const activeRows=(rows,on=today())=>rows.filter(r=>!isHistorical(r,on));
export const isPriced=type=>['股票','債券','基金'].includes(type);
export function positionAmounts(r){if(isPriced(r.type)&&!r.legacyAmounts){const divisor=r.type==='債券'&&r.priceBasis==='per100'?100:1;return {cost:r.buyPrice*r.quantity/divisor,value:r.currentPrice*r.quantity/divisor};}return {cost:r.cost,value:r.value};}
export function metrics(rows){const cost=rows.reduce((s,r)=>s+positionAmounts(r).cost*r.costFx,0),value=rows.reduce((s,r)=>s+positionAmounts(r).value*r.fx,0),income=rows.reduce((s,r)=>s+r.income,0),fees=rows.reduce((s,r)=>s+r.fees,0),profit=value-cost+income-fees;return {cost,value,income,fees,profit,ret:cost?profit/cost*100:null,score:value?rows.reduce((s,r)=>s+positionAmounts(r).value*r.fx*r.risk,0)/value:null};}
export function portfolioSummary(rows,on=today()){const active=metrics(activeRows(rows,on)),historical=metrics(rows.filter(r=>isHistorical(r,on))),combined=metrics(rows);return {active,historical,totalProfit:combined.profit,totalCost:combined.cost,totalIncome:combined.income,totalFees:combined.fees,totalReturn:combined.ret};}
export function assetConcentration(rows,assetType,on=today()){
 if(!types.includes(assetType))throw Error('不支援的資產類別');const active=activeRows(rows,on),portfolioValue=metrics(active).value,map=new Map();
 for(const r of active.filter(r=>r.type===assetType)){const key=r.name.normalize('NFKC').replace(/\s+/g,'').toLowerCase(),g=map.get(key)||{name:r.name.trim(),value:0,records:0,currencies:new Set()};g.value+=positionAmounts(r).value*r.fx;g.records++;g.currencies.add(r.currency);map.set(key,g);}
 const totalValue=[...map.values()].reduce((s,g)=>s+g.value,0),threshold=25,groups=[...map.values()].map(g=>({...g,currencies:[...g.currencies],share:totalValue?g.value/totalValue*100:null,portfolioShare:portfolioValue?g.value/portfolioValue*100:null,overLimit:totalValue?g.value/totalValue*100>threshold:false})).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));
 return {assetType,totalValue,portfolioValue,threshold,groups,overLimitCount:groups.filter(g=>g.overLimit).length};
}
export function migrateRows(rows){if(!Array.isArray(rows))throw Error('持倉格式不正確');return rows.map(r=>{if(!r||typeof r!=='object')throw Error('持倉格式不正確');if(r.schemaVersion===2)return r;if(r.schemaVersion!==undefined&&r.schemaVersion!==1)throw Error('不支援此資料版本');return {...r,schemaVersion:2,startDate:r.startDate||'',legacyStart:!r.startDate,legacyAmounts:isPriced(r.type),buyPrice:null,currentPrice:null,quantity:null,priceBasis:'unit',linked:r.type==='股票掛鈎投資'?[{name:'舊版標的（待補資料）',market:'',symbol:'',currentPrice:r.underlying??null,barrier:r.barrier??null,legacyIdentity:true}]:[]};});}
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const amount=(n,positive=false)=>Number.isFinite(n)&&n>=(positive?0.00000001:0)&&n<=1e12;
export function validateRows(rows){
 if(!Array.isArray(rows)||rows.length>1000)throw Error('持倉數量最多為 1,000 筆');const ids=new Set();
 return rows.map(r=>{
  if(!r||typeof r!=='object'||r.schemaVersion!==2)throw Error('持倉格式不正確');
  for(const k of ['id','name','issuer','currency','liquidity','asof','maturity','startDate','notes'])if(typeof r[k]!=='string')throw Error('資料格式不正確：'+k);
  if(!r.id||r.id.length>100||ids.has(r.id))throw Error('持倉編號不正確或重複');ids.add(r.id);
  if(!r.name.trim()||!r.issuer.trim()||r.name.length>100||r.issuer.length>100||r.notes.length>1000)throw Error('請填寫有效名稱與發行人');
  if(!types.includes(r.type)||!currencies.includes(r.currency)||!['high','medium','low'].includes(r.liquidity))throw Error('分類或貨幣不正確');
  if(isPriced(r.type)&&!r.legacyAmounts){if(!amount(r.buyPrice)||!amount(r.currentPrice)||!amount(r.quantity,true))throw Error('請填寫有效價格及大於零的數量');if(!['unit','per100'].includes(r.priceBasis)||(r.type!=='債券'&&r.priceBasis!=='unit'))throw Error('報價方式不正確');}
  const a=positionAmounts(r);for(const n of [a.cost,a.value,r.income,r.fees])if(!amount(n))throw Error('金額必須非負且不超過 1 兆');
  for(const k of ['costFx','fx'])if(!Number.isFinite(r[k])||r[k]<.000001||r[k]>1e5)throw Error('請填寫有效匯率');
  if(r.currency==='HKD'&&(r.fx!==1||r.costFx!==1))throw Error('港元匯率須為 1');
  if(!Number.isInteger(r.risk)||r.risk<1||r.risk>5)throw Error('風險須為 1 至 5');
  if(!validDate(r.asof)||r.asof>today())throw Error('估值日期必須有效且不可在未來');
  if(!(r.legacyStart&&r.startDate==='')&&(!validDate(r.startDate)||r.startDate>r.asof))throw Error('投資起始日不可晚於估值日期');
  if(r.maturity&&(!validDate(r.maturity)||(r.startDate&&r.maturity<r.startDate)))throw Error('沽出日／到期日不可早於投資起始日');
  if(!Array.isArray(r.linked))throw Error('掛鈎標的格式不正確');let linked=[];
  if(r.type==='股票掛鈎投資'){
   if(r.linked.length<1||r.linked.length>2)throw Error('掛鈎票據須有 1–2 個不同標的');const symbols=new Set();
   linked=r.linked.map(l=>{if(!l||typeof l.name!=='string'||!l.name.trim()||l.name.length>100||typeof l.symbol!=='string')throw Error('請填寫標的名稱及代號');let symbol=l.symbol.trim().toUpperCase();
    if(!l.legacyIdentity){if(!['HK','US'].includes(l.market))throw Error('請選擇掛鈎市場');if(l.market==='HK'){if(!/^\d{1,5}$/.test(symbol)||Number(symbol)===0)throw Error('港股代號須為 1–5 位數字');symbol=symbol.padStart(5,'0');}else if(!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol))throw Error('美股代號不正確');const key=l.market+':'+symbol;if(symbols.has(key))throw Error('兩個掛鈎標的不可重複');symbols.add(key);}
    if((l.currentPrice===null)!==(l.barrier===null)||l.currentPrice!==null&&(!amount(l.currentPrice)||!amount(l.barrier,true)))throw Error('現價與正數障礙價須同時填寫，或同時留空');return {...l,name:l.name.trim(),symbol};
   });
  }
  return {...r,name:r.name.trim(),issuer:r.issuer.trim(),...a,linked};
 });
}
export function riskAlerts(rows){rows=activeRows(rows);const m=metrics(rows),alerts=[],issuers=new Map();const add=(title,detail)=>alerts.push({title,detail});
 for(const r of rows){const pct=m.value?positionAmounts(r).value*r.fx/m.value*100:0;issuers.set(r.issuer,(issuers.get(r.issuer)||0)+pct);if(pct>25)add('單一持倉集中：'+r.name,`佔目前總市值 ${pct.toFixed(1)}%，超過 25% 提示線。`);
  const days=Math.round((Date.parse(r.maturity)-Date.parse(today()))/86400000);if(r.maturity&&days>=0&&days<=30)add('沽出／到期日將至：'+r.name,`${r.maturity}，請核對結清金額及安排。`);
  if((Date.parse(today())-Date.parse(r.asof))/86400000>7)add('估值待更新：'+r.name,`最近估值 ${r.asof}，已超過 7 日。`);
  if(r.legacyAmounts||r.legacyStart)add('舊持倉資料待補：'+r.name,'原有金額已保留，請編輯補上日期、價格及數量。');
  if(r.type==='股票掛鈎投資')for(const l of r.linked){const label=r.name+' · '+l.name+(l.symbol?' ('+l.symbol+')':'');if(l.legacyIdentity)add('掛鈎身份待補：'+r.name,'請補上市場、名稱與股票代號。');if(l.barrier&&l.currentPrice!==null){const gap=(l.currentPrice/l.barrier-1)*100;add((gap<=10?'接近或低於障礙：':'掛鈎條款風險：')+label,`障礙距離 ${gap.toFixed(1)}%。僅比較目前價格，不代表是否已觸發；需核對觀察期及交收條款。`);}else add('掛鈎價格待補：'+label,'未填現價及障礙價，無法計算障礙距離。');}
 }
 for(const [name,p] of issuers)if(p>25)add('發行人集中：'+name,`相關持倉佔總市值 ${p.toFixed(1)}%。`);
 const low=m.value?rows.filter(r=>r.liquidity==='low').reduce((s,r)=>s+positionAmounts(r).value*r.fx,0)/m.value*100:0;if(low>20)add('低流動性資產偏高',`佔目前市值 ${low.toFixed(1)}%，高於 20% 提示線。`);return alerts;
}
const base={schemaVersion:2,currency:'HKD',costFx:1,fx:1,income:0,fees:0,liquidity:'high',startDate:'2026-01-02',asof:'2026-10-02',maturity:'',notes:'',priceBasis:'unit',linked:[]};
export const demo=validateRows([
{id:'d1',name:'騰訊控股',type:'股票',issuer:'騰訊控股',buyPrice:360,currentPrice:412.8,quantity:1000,income:4200,fees:480,risk:4},
{id:'d2',name:'美國國債 4.25% 2027',type:'債券',issuer:'美國財政部',currency:'USD',buyPrice:100,currentPrice:101.5,quantity:50000,priceBasis:'per100',costFx:7.8,fx:7.78,income:8287.5,fees:200,risk:2,maturity:'2027-11-15'},
{id:'d3',name:'環球股票指數基金',type:'基金',issuer:'環球資產管理（示範）',currency:'USD',buyPrice:32,currentPrice:35.4,quantity:1000,costFx:7.8,fx:7.78,income:1820,fees:350,risk:4},
{id:'d4',name:'美元儲蓄壽險',type:'保險',issuer:'安裕人壽（示範）',currency:'USD',cost:40000,value:36800,costFx:7.8,fx:7.78,risk:2,liquidity:'low',notes:'可退保價值，不包含身故保障額。'},
{id:'d5',name:'港元存款證 3.8%',type:'存款證',issuer:'海港銀行（示範）',cost:300000,value:304275,risk:1,liquidity:'medium',maturity:'2026-10-28'},
{id:'d6',name:'科技股掛鈎票據',type:'股票掛鈎投資',issuer:'海港銀行（示範）',currency:'USD',cost:25000,value:23000,costFx:7.8,fx:7.78,income:7585.5,fees:500,risk:5,liquidity:'low',maturity:'2026-12-18',linked:[{market:'US',symbol:'AAPL',name:'Apple',currentPrice:171.2,barrier:160},{market:'US',symbol:'MSFT',name:'Microsoft',currentPrice:390,barrier:300}],notes:'非保本；可能實物交收。價格為示範數據，非即時報價。'},
{id:'d7',name:'香港交易所',type:'股票',issuer:'香港交易及結算所有限公司',buyPrice:280,currentPrice:305,quantity:600,income:2600,fees:320,risk:4},
{id:'d8',name:'已沽出股票（示範）',type:'股票',issuer:'示範公司',buyPrice:50,currentPrice:56,quantity:1000,income:1200,fees:200,risk:4,maturity:'2026-09-25',asof:'2026-09-25',notes:'現價欄記錄實際沽出價。'}
].map(r=>({...base,...r})));
