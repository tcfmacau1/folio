import {validateRows,migrateRows} from './public/model.js';
import {assets} from './generated-assets.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {async fetch(request,env){const url=new URL(request.url);
 if(url.pathname==='/api/portfolio'){
  const owner=request.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'未取得使用者身份。'},401);if(!env.DB)return json({error:'資料庫暫時未能使用。'},503);
  try{
   if(request.method==='GET'){const row=await env.DB.prepare('SELECT data, updated FROM portfolios WHERE owner = ?').bind(owner).first();return json({rows:row?validateRows(migrateRows(JSON.parse(row.data))):[],revision:row?.updated??null});}
   if(request.method==='PUT'){
    const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'請從本網站內儲存。'},403);if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'不支援的格式。'},415);
    const text=await request.text();if(new TextEncoder().encode(text).length>2000000)return json({error:'資料超過 2 MB。'},413);let input;
    try{input=JSON.parse(text);input.rows=validateRows(input.rows);if(input.revision!==null&&typeof input.revision!=='string')throw Error('版本資料不正確');}catch(e){return json({error:e.message||'資料不正確'},400);}
    const revision=crypto.randomUUID();const result=input.revision===null?await env.DB.prepare('INSERT OR IGNORE INTO portfolios (owner, data, updated) VALUES (?, ?, ?)').bind(owner,JSON.stringify(input.rows),revision).run():await env.DB.prepare('UPDATE portfolios SET data = ?, updated = ? WHERE owner = ? AND updated = ?').bind(JSON.stringify(input.rows),revision,owner,input.revision).run();
    if(!result.meta.changes)return json({error:'持倉已在其他視窗更新。請先保留輸入，再重新載入最新資料。'},409);return json({revision});
   }return json({error:'不支援的操作。'},405);
  }catch(e){console.error('Portfolio unavailable:',e.message);return json({error:'暫時無法存取持倉，請稍後重試。'},503);}
 }
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});const asset=assets[url.pathname==='/'?'/index.html':url.pathname];if(!asset)return new Response('Not found',{status:404});
 return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'"}});
}};
