// Capture synthetic fixtures in isolated contexts; never reuse user browser storage.
const {chromium,firefox}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/phase-0');
const source=path.join(root,'working/markdown_studio.html');
const results=[];
(async()=>{
 const server=http.createServer((req,res)=>{if(req.url!=='/'){res.writeHead(404);return res.end();}res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(source));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  for(const [name,type]of Object.entries({chromium,firefox})){
   let browser;
   try{browser=await type.launch({headless:true});}
   catch(e){results.push({browser:name,status:'blocked',phase:'launch',origins:['file','http'],error:e.message,timestamp:new Date().toISOString()});continue;}
   try{
    for(const [origin,url]of Object.entries({file:'file://'+source,http:`http://127.0.0.1:${server.address().port}/`})){
     const context=await browser.newContext({viewport:{width:1440,height:1000}});
     try{
      const page=await context.newPage(),consoleLog=[],requests=[];
      page.on('pageerror',e=>consoleLog.push({type:'pageerror',message:e.message}));
      page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleLog.push({type:m.type(),message:m.text()});});
      page.on('requestfailed',r=>requests.push({url:r.url(),failure:r.failure()}));
      await page.goto(url,{waitUntil:'load',timeout:45000});
      const dependencies=await page.evaluate(()=>({marked:typeof marked,mermaid:typeof mermaid,hljs:typeof hljs,mathjax:typeof MathJax}));
      if(dependencies.marked==='undefined'||dependencies.mermaid==='undefined')throw new Error('Required CDN dependencies unavailable: '+JSON.stringify(dependencies));
      fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
      for(const file of fs.readdirSync(path.join(out,'fixtures')).filter(f=>f.endsWith('.md'))){
       await page.locator('#editor').fill(fs.readFileSync(path.join(out,'fixtures',file),'utf8'));
       await page.waitForTimeout(1500);
       await page.screenshot({path:path.join(out,'screenshots',`${name}-${origin}-${file}.png`),fullPage:true});
       results.push({browser:name,version:browser.version(),os:process.platform,origin,fixture:file,viewport:'1440x1000',theme:'dark',zoom:'default',status:'captured; visual review and functional assertions still required',timestamp:new Date().toISOString()});
      }
      fs.writeFileSync(path.join(out,`${name}-${origin}-console.json`),JSON.stringify({dependencies,consoleLog,requests},null,2));
     }catch(e){results.push({browser:name,origin,status:'blocked',error:e.message,timestamp:new Date().toISOString()});}
     finally{await context.close();}
    }
   }finally{await browser.close();}
  }
 }finally{await new Promise(r=>server.close(r));}
 const report={platform:process.platform,node:process.version,playwright:require('playwright/package.json').version,candidateSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),results};
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
