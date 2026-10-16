import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
const assets={};for(const [name,type] of [['index.html','text/html; charset=utf-8'],['style.css','text/css; charset=utf-8'],['app.js','text/javascript; charset=utf-8'],['model.js','text/javascript; charset=utf-8'],['transfer.js','text/javascript; charset=utf-8']])assets['/'+name]={type,body:await readFile('public/'+name,'utf8')};
await mkdir('dist/server/public',{recursive:true});await writeFile('dist/server/generated-assets.js','export const assets='+JSON.stringify(assets)+';');await cp('public/model.js','dist/server/public/model.js');await cp('worker.js','dist/server/index.js');
console.log('Built local server assets.');
