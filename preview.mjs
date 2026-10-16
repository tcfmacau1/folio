import {readFile,writeFile} from 'node:fs/promises';
const html=await readFile('public/index.html','utf8'),css=await readFile('public/style.css','utf8');
const model=(await readFile('public/model.js','utf8')).replaceAll('export ','');
const transfer=(await readFile('public/transfer.js','utf8')).replace(/^import .*;\n/gm,'').replaceAll('export ','');
const app=(await readFile('public/app.js','utf8')).replace(/^import .*;\n/gm,'');
const adapter=`window.FOLIO_PREVIEW=true;let previewRows=[],previewRevision=null;window.FOLIO_API=async function(path,options={}){if(path!=='/api/portfolio')throw Error('離線預覽不支援外部請求');if(options.method==='PUT'){const data=JSON.parse(options.body);if(data.revision!==previewRevision)return {ok:false,json:async()=>({error:'資料版本已更新，請重新載入。'})};previewRows=validateRows(data.rows);previewRevision=crypto.randomUUID();return {ok:true,json:async()=>({revision:previewRevision})};}return {ok:true,json:async()=>({rows:previewRows,revision:previewRevision})};};`;
const output=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+css+'</style>').replace('<script type="module" src="app.js"></script>',()=>'<script>'+[model,transfer,adapter,app].join('\n').replaceAll('</script','<\\/script')+'</script>');
const path=process.argv[2]||'folio-preview-v4.html';await writeFile(path,output);console.log('Created '+path);
