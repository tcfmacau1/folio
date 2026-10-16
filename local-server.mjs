// Local-only persistence. Node.js 22.13+; no third-party dependencies.
import {createServer} from 'node:http';
import {mkdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import worker from './dist/server/index.js';
await mkdir('.local',{recursive:true});const db=new DatabaseSync('.local/portfolio.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS portfolios (owner TEXT PRIMARY KEY, data TEXT NOT NULL, updated TEXT NOT NULL)');
const env={DB:{prepare(sql){return {bind(...values){return {async first(){return db.prepare(sql).get(...values);},async run(){const result=db.prepare(sql).run(...values);return {meta:{changes:Number(result.changes)}};}};}};}}};
const port=Number(process.env.PORT||4173);if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be 1–65535');
const server=createServer(async(req,res)=>{try{
 if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){res.writeHead(403);res.end('Local requests only');return;}
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2000000){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'資料超過 2 MB。'}));return;}chunks.push(chunk);}
 const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-owner');const request=new Request(`http://${req.headers.host}`+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e.message);if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'本機服務暫時無法處理。'}));}
});server.listen(port,'127.0.0.1',()=>console.log(`本機預覽：http://127.0.0.1:${port}\n持倉保存於 .local/portfolio.sqlite；按 Ctrl+C 停止。`));
