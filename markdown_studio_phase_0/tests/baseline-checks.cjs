// Reproductions against extracted baseline functions. These are not browser tests.
const fs=require('fs'), path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/phase-0');
const srcRaw=fs.readFileSync(path.join(root,'baseline/markdown_studio.original.html'),'utf8');
const src=srcRaw.replace(/\r\n/g,'\n'); // CRLF checkouts: normalize so section()/hashes match the committed LF blob
const marked=require('./vendor/marked.min.js');
const results=[];
function section(a,b){const start=src.indexOf(a);assert(start>=0,a);const end=src.indexOf(b,start+a.length);assert(end>start,b);return src.slice(start,end).trim();}
function fn(name,next){return section(`function ${name}`,next);}
function record(id,issues,procedure,observation){results.push({id,issues,gate:'G0',method:'Node extracted-function or parser reproduction; no browser',timestamp:new Date().toISOString(),expected:'Baseline defect is observable; no remediation expected in Phase 0',procedure,observation,status:'reproduced'});}
const templates=vm.runInNewContext('('+section('const DIAGRAM_TEMPLATES = {','// --------------------------------------------------------------------------').replace(/^const DIAGRAM_TEMPLATES = /,'').replace(/;$/,'')+')');
let n=0;for(const [type,variants]of Object.entries(templates))for(const[key,t]of Object.entries(variants)){fs.writeFileSync(path.join(out,'fixtures',`template-${type}-${key}.md`),'```mermaid\n'+t.code+'\n```\n');n++;}
fs.writeFileSync(path.join(out,'templates.json'),JSON.stringify({count:n,templates},null,2)+'\n');
for(const [i,m]of [...src.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].entries())new vm.Script(m[1],{filename:`inline-${i}.js`});
results.push({id:'B00',issues:[],gate:'G0',status:'pass',procedure:'Compile inline scripts with vm.Script; compare source hash to plan.',observation:{sha256:crypto.createHash('sha256').update(src).digest('hex'),sha256Raw:crypto.createHash('sha256').update(srcRaw).digest('hex'),lineEndings:srcRaw.includes('\r\n')?'CRLF-on-disk':'LF',inlineSyntax:'valid',templatesExtracted:n},timestamp:new Date().toISOString()});
const wrap=fn('wrapSelection(before, after)', 'function prependLines');
const editor={value:'',selectionStart:0,selectionEnd:0,focus(){},dispatchEvent(){}};
const ctx={editorEl:editor,Event:class{}};vm.createContext(ctx);vm.runInContext(wrap,ctx);
vm.runInContext("wrapSelection('\\n\\n---\\n\\n','')",ctx);assert(editor.value.endsWith('text'));
record('B10',['R10'],'Execute actual wrapSelection with empty selection and divider snippet.',{actual:editor.value,unwantedSuffix:'text'});
editor.value='';editor.selectionStart=editor.selectionEnd=0;ctx.prompt=()=> 'https://example.test/image.png';
vm.runInContext(section("const imgUrl = prompt(","break;"),ctx);
assert.equal(editor.value,'![Alt text](texthttps://example.test/image.png)');
record('B11',['R11'],'Execute actual image case with synthetic URL and empty selection.',{actual:editor.value,expectedMarkdown:'![Alt text](https://example.test/image.png)'});
const palette=src.match(/data-insert="([^"]*subgraph[^\"]*)"/)[1];assert(palette.includes('\\n'));
record('B12',['R12'],'Read Subgraph Box attribute as literal HTML attribute text.',{attribute:palette,literalBackslashNCount:palette.split('\\n').length-1,actualNewlines:palette.split('\n').length-1});
const mixed=fs.readFileSync(path.join(out,'fixtures/mixed-fences.md'),'utf8');
const parsed=[];const renderer=new marked.Renderer();renderer.code=(code,lang)=>{if(lang==='mermaid')parsed.push(code);return '';};marked.parse(mixed,{renderer});
const regexMatches=[...mixed.matchAll(/```mermaid[\s\S]*?```/g)];assert.equal(parsed.length,2);assert.equal(regexMatches.length,1);assert(parsed[0].includes('Tilde'));assert(regexMatches[0][0].includes('Backtick'));
record('B05',['R05'],'Parse mixed-fences fixture with baseline Marked 12.0.2; compare actual replacement regex.',{previewDiagramCount:parsed.length,replacementCount:regexMatches.length,previewIndex0:parsed[0],replacementIndex0:regexMatches[0][0],consequence:'Editing preview index 0 targets the second diagram.'});
const raw={textContent:'flowchart TD\n A --> B'},buttons=[],listeners=[];
let rawPresent=true,html='',calls=0;
const canvas={style:{},querySelector:()=>({style:{}})};Object.defineProperty(canvas,'innerHTML',{get:()=>html,set:v=>{html=v;rawPresent=false;}});
const viewport={dataset:{},classList:{add(){},remove(){}},style:{}};
const card={dataset:{diagramIndex:'0'},querySelector:s=>s==='.mermaid-canvas'?canvas:s==='.mermaid-raw-code'?(rawPresent?raw:null):viewport,querySelectorAll:s=>s==='.diag-action-btn'?buttons:[]};
const c={document:{querySelectorAll:()=>[card]},mermaid:{parse:async()=>{calls++},render:async()=>({svg:'<svg></svg>'})},uid:()=> 'test',cleanStrayMermaidElements(){},logError(){},escapeHtml:s=>s,setupPreviewDiagramInteractivity(){},window:{addEventListener:(type)=>listeners.push(type)},navigator:{clipboard:{writeText:async()=>{}}},openStudioWithCode(){},openFullscreenDiagram(){},exportDiagramSvg(){},exportDiagramPng(){}};
vm.createContext(c);vm.runInContext('async '+fn('renderAllPreviewDiagrams()', '// --------------------------------------------------------------------------'),c);
(async()=>{
 await c.renderAllPreviewDiagrams();assert(!rawPresent);await c.renderAllPreviewDiagrams();assert.equal(calls,1);
 record('B01',['R01','R02'],'Run actual preview render twice on a DOM contract that removes child source on innerHTML replacement.',{sourceBefore:raw.textContent,sourceAfter:null,parseCallsAfterTwoRenders:calls,canvas:html});
 vm.runInContext(fn('setupPreviewDiagramInteractivity()', '// --------------------------------------------------------------------------'),c);
 c.setupPreviewDiagramInteractivity();c.setupPreviewDiagramInteractivity();assert.equal(listeners.length,4);
 record('B09',['R09'],'Call actual interactivity setup twice for one card; count registered window handlers.',{calls:2,windowListenersAdded:listeners});
 const failureButton={className:'btn btn-sm btn-primary',dataset:{action:'edit-diagram'}};
 assert(!failureButton.className.split(' ').includes('diag-action-btn'));
 record('B03',['R03'],'Compare generated Fix in Studio class with actual action-binding selector.',{generatedClass:failureButton.className,bindingSelector:'.diag-action-btn',matches:false,browserClick:'unverified'});
 const scope={document:{getElementById:()=>null},uid:()=> 'test',escapeHtml:s=>s,navigator:{},showToast(){}};vm.createContext(scope);
 vm.runInContext('(()=>{'+section('const MAX_LOG_ENTRIES = 50;','// --------------------------------------------------------------------------')+'})()',scope);
 let errors=[];for(const call of ["copyErrorText('synthetic error')","dismissError('test')"]){try{vm.runInContext(call,scope)}catch(e){assert.equal(e.name,'ReferenceError');errors.push(e.message)}}
 assert.equal(errors.length,2);
 record('B04',['R04'],'Invoke actual inline handler names in global scope after evaluating error functions within application closure.',{errors,browserConsole:'not captured; these are Node scope errors'});
 const summary={environment:{runtime:process.version,platform:process.platform,arch:process.arch,browser:'none; executables unavailable',origin:'not applicable; extracted source'},candidateSha256:crypto.createHash('sha256').update(src).digest('hex'),results};
 fs.writeFileSync(path.join(out,'test-results.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
