const fs=require('fs'),http=require('http'),path=require('path');
const dir=path.join(__dirname,'app/src/main/assets/analysis');
const archive=JSON.parse(fs.readFileSync(path.join(dir,'archive.json'),'utf8'));
const data={widget:{rows:[],snapshots:0},archives:{batches:[archive],imported_files:0}};
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace('<script src="hospital-pages.js"></script>',()=>'<script>'+fs.readFileSync(path.join(dir,'hospital-pages.js'),'utf8')+'</script>').replace('<script src="analysis.js"></script>',()=>'<script>'+fs.readFileSync(path.join(dir,'analysis.js'),'utf8')+'</script><script>receive('+JSON.stringify(data).replace(/</g,'\\u003c')+');</script>');
fs.mkdirSync(path.join(__dirname,'deliverables'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'deliverables/WAED-v2-analysis-preview.html'),html);
if(process.argv.includes('--serve'))http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(__dirname,'deliverables/WAED-v2-analysis-preview.html')))}).listen(Number(process.env.WAED_PREVIEW_PORT||8765),'127.0.0.1',()=>console.log('Preview http://localhost:8765'));
