#!/usr/bin/env node
/**
 * od-consolidate.cjs — maintenance tool: consolidate open-design project structure.
 *
 * Tri-location pattern (DEC-DEV-0040 Q1): canonical source = repo `adapters/od-consolidate.cjs`
 * (DEC-DEV-0067); instance copied to <project>/.claude/integrator/adapters/ at /integrator:add.
 *
 * Problem: the CNT-003 migration imported ONE OD project per screen. Correct structure
 * = ONE project per feature (FM-NNN), screens as artifacts inside.
 *
 * This tool consolidates per-screen projects into a single per-feature project:
 *   build  --feature FM-001|FM-002   create consolidated project, copy each source screen's
 *                                     stored HTML into it (dedup by sha256), generate a hub
 *                                     index.html, then VERIFY every copied screen byte-for-byte.
 *                                     Writes a manifest of VERIFIED source project ids.
 *   delete --manifest <file>          delete the verified source projects (destructive — run
 *                                     only after inspecting the build report).
 *
 * Speaks MCP over stdio to `docker exec -i open-design node apps/daemon/dist/cli.js mcp`,
 * holding stdin open until each response arrives (EOF-truncation guard). Reads OD_API_TOKEN.
 *
 * NEVER deletes a source whose content was not byte-verified inside the consolidated project.
 */
'use strict';
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');

const TOK = (process.env.OD_API_TOKEN || '').trim();
if (!TOK) { console.error('OD_API_TOKEN env required'); process.exit(2); }

function startSession() {
  const child = spawn('docker', ['exec','-i','-e','OD_DAEMON_URL=http://127.0.0.1:7456',
    '-e',`OD_API_TOKEN=${TOK}`,'-e',`OD_TOOL_TOKEN=${TOK}`,
    'open-design','node','apps/daemon/dist/cli.js','mcp'], {stdio:['pipe','pipe','pipe']});
  const waiters = new Map();
  let buf='';
  child.stdout.on('data',d=>{ buf+=d.toString(); let i;
    while((i=buf.indexOf('\n'))>=0){ const line=buf.slice(0,i).trim(); buf=buf.slice(i+1);
      if(!line) continue; try{ const m=JSON.parse(line); if(m.id!==undefined && waiters.has(m.id)){ waiters.get(m.id)(m); waiters.delete(m.id); } }catch{} } });
  child.stderr.on('data',()=>{});
  const send=o=>child.stdin.write(JSON.stringify(o)+'\n');
  send({jsonrpc:'2.0',id:'init',method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'od-consolidate',version:'1'}}});
  send({jsonrpc:'2.0',method:'notifications/initialized',params:{}});
  let seq=0;
  function call(name,args,timeoutMs=60000){
    return new Promise((resolve,reject)=>{
      const id='x'+(seq++);
      const t=setTimeout(()=>{ waiters.delete(id); reject(new Error('timeout '+name)); },timeoutMs);
      waiters.set(id,m=>{ clearTimeout(t); if(m.error) return reject(new Error(name+': '+JSON.stringify(m.error)));
        let v=m.result; if(v&&Array.isArray(v.content)){ const t2=v.content.filter(c=>c.type==='text').map(c=>c.text).join('\n'); try{v=JSON.parse(t2);}catch{v=t2;} } resolve(v); });
      send({jsonrpc:'2.0',id,method:'tools/call',params:{name,arguments:args}});
    });
  }
  return { call, close:()=>{ try{child.stdin.end();}catch{} try{child.kill();}catch{} } };
}

const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');

// PER-PROJECT CONFIG (edit in the INSTANCE copy, not the repo reference):
// one entry per feature — target consolidated project name + how to match the
// per-screen source projects + the artifact path each screen gets inside it.
const FEATURES={
  // 'FM-001':{ projectName:'FM-001 <Feature title> — <project-name>',
  //   match:p=>/^SI-\d+$/.test(p.name),            // which OD projects belong to this feature
  //   pathOf:p=>`${p.name}/index.html` },          // artifact path inside the consolidated project
};

function hubHtml(title, entries){
  const items=entries.map(e=>`    <li><a href="${e.path}">${e.label}</a></li>`).join('\n');
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:Inter,system-ui,sans-serif;background:#faf8ff;color:#131b2e;max-width:760px;margin:40px auto;padding:0 24px}
h1{font-size:22px;color:#004ac6}ul{list-style:none;padding:0}li{margin:6px 0}a{color:#004ac6;text-decoration:none;font-size:14px}
a:hover{text-decoration:underline}.n{color:#434655;font-size:13px}</style></head>
<body><h1>${title}</h1><p class="n">${entries.length} экранов · сгенерировано/консолидировано через open-design (od mcp). Каноничный спек — MK/NM.</p>
<ul>\n${items}\n</ul></body></html>`;
}

async function build(feature){
  const cfg=FEATURES[feature]; if(!cfg){ console.error('unknown feature',feature); process.exit(2); }
  const s=startSession();
  try{
    const lp=await s.call('list_projects',{});
    const all=(lp.projects||lp);
    if(all.some(p=>p.name===cfg.projectName)){ console.error('ABORT: target project already exists:',cfg.projectName); s.close(); process.exit(1); }
    const sources=all.filter(cfg.match);
    console.log(`[${feature}] source screen-projects: ${sources.length}`);
    const cp=await s.call('create_project',{name:cfg.projectName});
    const pid=(cp.project&&cp.project.id)||cp.id;
    console.log(`[${feature}] consolidated project: ${pid}`);
    const seen=new Map();         // sha -> path (dedup)
    const entries=[]; const verified=[]; const skipped=[];
    for(const src of sources){
      const content=await readEntry(s,src.id);
      if(content==null){ console.log('  ! read-fail, SKIP (keep source):',src.name,src.id); continue; }
      const h=sha(content);
      if(seen.has(h)){ console.log(`  = dup ${src.name} (${src.id.slice(0,8)}) == ${seen.get(h)} -> dedup, source deletable`); verified.push({id:src.id,name:src.name,dupOf:seen.get(h)}); continue; }
      const path=cfg.pathOf(src);
      await s.call('create_artifact',{project:pid,name:path,content});
      const back=await readPath(s,pid,path);
      if(back===content){ seen.set(h,path); entries.push({path,label:`${src.name} (${path})`}); verified.push({id:src.id,name:src.name,path}); console.log(`  ✓ ${src.name} -> ${path} (${content.length} chars, byte-verified)`); }
      else { console.log(`  ✗ VERIFY FAIL ${src.name} -> ${path} (source NOT marked deletable)`); }
    }
    // hub
    await s.call('create_artifact',{project:pid,name:'index.html',content:hubHtml(cfg.projectName,entries)});
    const manifestPath=`.product/.design-sessions/od-consolidate-${feature}.json`;
    fs.mkdirSync('.product/.design-sessions',{recursive:true});
    fs.writeFileSync(manifestPath,JSON.stringify({feature,consolidatedProjectId:pid,screens:entries.length,deletableSources:verified},null,2));
    console.log(`[${feature}] DONE. screens=${entries.length} dedup+verified-sources=${verified.length}. Manifest: ${manifestPath}`);
    console.log(`[${feature}] sources NOT verified (kept): ${sources.length-verified.length}`);
  } finally { s.close(); }
}

async function readEntry(s,projectId){
  // try project entryFile then index.html
  try{ const gp=await s.call('get_project',{project:projectId}); const ef=(gp&&gp.entryFile)||'index.html';
    return await readPath(s,projectId,ef); }catch{ try{ return await readPath(s,projectId,'index.html'); }catch{ return null; } }
}
async function readPath(s,projectId,path){
  const gf=await s.call('get_file',{project:projectId,path});
  if(typeof gf==='string') return gf;
  if(gf&&typeof gf.content==='string') return gf.content;
  if(gf&&gf.files&&gf.files[0]&&typeof gf.files[0].content==='string') return gf.files[0].content;
  return null;
}

async function del(manifestFile){
  const man=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  const s=startSession();
  try{
    console.log(`[delete] ${man.feature}: deleting ${man.deletableSources.length} verified source projects (consolidated=${man.consolidatedProjectId})`);
    let ok=0;
    for(const src of man.deletableSources){
      try{ await s.call('delete_project',{project:src.id,confirm:true}); console.log(`  ✓ deleted ${src.name} ${src.id.slice(0,8)}`); ok++; }
      catch(e){ console.log(`  ✗ delete failed ${src.name} ${src.id.slice(0,8)}: ${e.message.slice(0,80)}`); }
    }
    console.log(`[delete] removed ${ok}/${man.deletableSources.length}`);
  } finally { s.close(); }
}

(async()=>{
  const a=process.argv.slice(2);
  if(a[0]==='build'){ const fi=a.indexOf('--feature'); await build(a[fi+1]); }
  else if(a[0]==='delete'){ const mi=a.indexOf('--manifest'); await del(a[mi+1]); }
  else { console.error('usage: od-consolidate.cjs build --feature FM-001|FM-002  |  delete --manifest <file>'); process.exit(2); }
})().catch(e=>{ console.error(e); process.exit(2); });
