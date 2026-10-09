export function ownerLabsResponse(): Response {
  const html = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SakuraPanel Labs</title>
<style>
:root{color-scheme:dark}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:900px;margin:0 auto;padding:18px;background:#101010;color:#f8f8f8}
a{color:#f08dbd}.muted{color:#aaa}.card{background:#191919;border:1px solid #303030;border-radius:16px;padding:16px;margin:12px 0}
button,input,select{box-sizing:border-box;padding:11px;margin:5px 0;border-radius:9px;border:1px solid #444;background:#222;color:#fff}
button{background:#d85f9d;border:0;font-weight:700}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto}.row{display:flex;gap:8px;flex-wrap:wrap}.row>*{flex:1;min-width:130px}.status{font-weight:700}.good{color:#83e6a1}.bad{color:#ff9b9b}.warn{color:#f4d38a}
</style></head><body>
<p><a href="/owner">← Owner dashboard</a></p><h1>🌸 SakuraPanel v1 Systems</h1>
<p class="muted">Private operational tools. Every API call is authorized server-side; diagnostic output does not include secrets.</p>
<section class="card"><h2>Config Studio</h2>
<div class="row"><input id="userId" placeholder="Target user ID (optional)"><select id="format"><option value="json">Validated JSON</option><option value="links">Existing protocol links</option><option value="subscription">Base64 subscription</option></select><button id="export">Generate export</button></div>
<p id="exportStatus" class="muted">No export generated.</p><button id="download" hidden>Download export</button><pre id="exportBody"></pre></section>
<section class="card"><h2>Sakura Pulse</h2><p class="muted">Read-only D1/schema, foreign-key, and Emergency Lock binding checks.</p><button id="pulse">Run health checks</button><pre id="pulseResult">Not run.</pre></section>
<section class="card"><h2>Sakura Speed Lab</h2><p class="muted">One bounded server-side database query and local JSON serialization sample. Not a benchmark.</p><button id="speed">Measure sample</button><pre id="speedResult">Not run.</pre></section>
<section class="card"><h2>Route Advisor</h2><p class="muted">Advisory only. The current schema removed the legacy endpoint model, so this remains insufficient-data until supported route candidates exist.</p><button id="routes">Check recommendation status</button><pre id="routeResult">Not run.</pre></section>
<script>
const $=id=>document.getElementById(id);let lastExport=null;
async function api(path,options={}){const r=await fetch(path,{credentials:"same-origin",...options,headers:{"content-type":"application/json",...(options.headers||{})}});let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error((j&&j.error)||("HTTP "+r.status));return j}
function show(id,value){$(id).textContent=JSON.stringify(value,null,2)}
$("export").onclick=async()=>{const status=$("exportStatus");status.textContent="Generating and validating…";$("exportBody").textContent="";$("download").hidden=true;try{const q=new URLSearchParams({format:$("format").value});if($("userId").value.trim())q.set("userId",$("userId").value.trim());const r=await api("/internal/config-studio?"+q.toString());lastExport=r.value;status.textContent="Validated "+r.value.count+" export item(s). Excluded: "+JSON.stringify(r.value.excluded);$("exportBody").textContent=r.value.body;$("download").hidden=false}catch(e){status.textContent="Export failed: "+String(e)}};
$("download").onclick=()=>{if(!lastExport)return;const blob=new Blob([lastExport.body],{type:lastExport.contentType});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=lastExport.filename;a.click();URL.revokeObjectURL(url)};
$("pulse").onclick=async()=>{show("pulseResult",{status:"running"});try{const r=await api("/internal/pulse");show("pulseResult",r.value)}catch(e){show("pulseResult",{status:"failed_or_unavailable",error:String(e)})}};
$("speed").onclick=async()=>{show("speedResult",{status:"running"});try{const r=await api("/internal/speed",{method:"POST",body:"{}"});show("speedResult",r.value)}catch(e){show("speedResult",{status:"failed_or_unavailable",error:String(e)})}};
$("routes").onclick=async()=>{show("routeResult",{status:"running"});try{const r=await api("/internal/route-advisor");show("routeResult",r.value)}catch(e){show("routeResult",{status:"failed_or_unavailable",error:String(e)})}};
</script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "no-store" } });
}
