export function ownerDashboardResponse(): Response {
  const html = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SakuraPanel Owner</title>
<style>
:root{color-scheme:dark}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:860px;margin:0 auto;padding:18px;background:#101010;color:#fff}
h1,h2{margin:8px 0 14px}.muted{color:#aaa}.card{background:#191919;border:1px solid #303030;border-radius:16px;padding:16px;margin:12px 0}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.stat{font-size:28px;font-weight:800}
input,select,textarea,button{width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #444;background:#222;color:#fff}
button{background:#d85f9d;border:0;font-weight:700}.secondary{background:#333}.danger{background:#8d3d58}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.item{padding:10px 0;border-top:1px solid #333}.pill{display:inline-block;padding:3px 8px;border-radius:99px;background:#292929;margin-left:5px}
pre{white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto}
@media(max-width:600px){.grid,.row{grid-template-columns:1fr}}
</style></head><body>
<h1>🌸 SakuraPanel Owner</h1>

<section id="login" class="card">
<form method="post" action="/owner/login">
<p class="muted">Temporary Owner session. Credential is sent only over HTTPS.</p>
<input name="username" value="ahora_8019" autocomplete="username" required>
<input name="bootstrapSecret" type="password" placeholder="Bootstrap secret" autocomplete="off" required>
<button type="submit">Open Dashboard</button>
</form></section>

<section id="app" hidden>
<div class="card"><strong>OWNER</strong><div id="who" class="muted"></div></div>
<div class="grid">
<div class="card"><div id="users" class="stat">—</div><div class="muted">Users</div></div>
<div class="card"><div id="endpointsCount" class="stat">—</div><div class="muted">Endpoints</div></div>
<div class="card"><div id="templatesCount" class="stat">—</div><div class="muted">Templates</div></div>
</div>

<div class="card">
<h2>1. Endpoint Registry</h2>
<form id="endpointForm">
<div class="row">
<input name="name" placeholder="Endpoint name" value="Endpoint-A" required>
<input name="host" placeholder="Host / domain" required>
</div>
<div class="row">
<input name="port" type="number" min="1" max="65535" value="443" required>
<input name="transport" placeholder="Transport" value="tcp" required>
</div>
<div class="row">
<input name="region" placeholder="Region" value="WEUR">
<input name="priority" type="number" value="100" required>
</div>
<label><input name="tls" type="checkbox" checked style="width:auto"> TLS</label>
<button>Create Endpoint</button>
</form>
<div id="endpointsList"></div>
</div>

<div class="card">
<h2>2. Template Registry</h2>
<form id="templateForm">
<div class="row">
<input name="name" placeholder="Template name" value="default-template" required>
<input name="protocol" placeholder="Protocol" value="generic" required>
</div>
<textarea name="definition" rows="4">{}</textarea>
<button>Create Template</button>
</form>
<div id="templatesList"></div>
</div>

<div class="card">
<h2>3. Config Engine</h2>
<form id="configForm">
<input name="endpointId" placeholder="Endpoint ID" required>
<input name="templateId" placeholder="Template ID" required>
<input name="expiresAt" type="datetime-local">
<button>Generate Config</button>
</form>
<p class="muted">The current Owner user is used automatically. Config secrets/payload are not displayed here.</p>
<div id="configsList"></div>
</div>

<div class="card">
<h2>4. Subscription</h2>
<form id="subscriptionForm">
<input name="expiresAt" type="datetime-local">
<button>Create Subscription for Owner</button>
</form>
<form id="provisionForm">
<input name="subscriptionId" placeholder="Subscription ID" required>
<input name="templateId" placeholder="Template ID" required>
<input name="maxEndpoints" type="number" min="1" max="20" value="2" required>
<button>Provision Version</button>
</form>
<div id="subscriptionsList"></div>
</div>

<div class="card">
<h2>5. Health & Failover</h2>
<p class="muted">Use Healthy once for a new endpoint. Three failures move it to DOWN; two consecutive recoveries move it back to HEALTHY.</p>
<div id="healthList"></div>
<form id="rebuildForm">
<input name="subscriptionId" placeholder="Subscription ID to rebuild" required>
<button class="secondary">Rebuild Subscription / Failover</button>
</form>
</div>

<div class="card">
<button id="refresh" class="secondary">Refresh Everything</button>
<form method="post" action="/owner/logout"><button type="submit" class="danger">Logout</button></form>
<pre id="out"></pre>
</div>
</section>

<script>
const $=id=>document.getElementById(id);
let state={users:[],endpoints:[],templates:[],configs:[],subscriptions:[]};

async function api(path,options={}){
  const r=await fetch(path,{credentials:"same-origin",...options,headers:{"content-type":"application/json",...(options.headers||{})}});
  let j={}; try{j=await r.json()}catch{}
  if(!r.ok) throw new Error(j.error||("HTTP "+r.status));
  return j;
}
function json(value){return JSON.stringify(value)}
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}

async function load(){
  const [u,e,t]=await Promise.all([api("/internal/users"),api("/internal/endpoints"),api("/internal/templates")]);
  state.users=u.value||[]; state.endpoints=e.value||[]; state.templates=t.value||[];
  const owner=state.users.find(x=>x.role==="OWNER")||state.users[0];
  if(owner){
    const [c,s]=await Promise.all([api("/internal/configs?userId="+encodeURIComponent(owner.id)),api("/internal/subscriptions?userId="+encodeURIComponent(owner.id))]);
    state.configs=c.value||[]; state.subscriptions=s.value||[];
    $("who").textContent=owner.username+" • authenticated";
  }
  $("users").textContent=state.users.length;
  $("endpointsCount").textContent=state.endpoints.length;
  $("templatesCount").textContent=state.templates.length;
  render();
  $("login").hidden=true; $("app").hidden=false;
}
function render(){
  $("endpointsList").innerHTML=state.endpoints.map(e=>`<div class="item"><b>${esc(e.name)}</b> <span class="pill">${esc(e.status)}</span><br><span class="muted">${esc(e.id)} • ${esc(e.host)}:${e.port} • ${esc(e.region||"-")}</span><div class="row"><button data-health="${esc(e.id)}" data-value="true">Mark Healthy</button><button class="danger" data-health="${esc(e.id)}" data-value="false">Mark Failure</button></div></div>`).join("")||'<p class="muted">No endpoints yet.</p>';
  $("templatesList").innerHTML=state.templates.map(t=>`<div class="item"><b>${esc(t.name)}</b> <span class="pill">${esc(t.protocol)}</span><br><span class="muted">${esc(t.id)} • v${t.version}</span></div>`).join("")||'<p class="muted">No templates yet.</p>';
  $("configsList").innerHTML=state.configs.map(c=>`<div class="item"><b>${esc(c.id)}</b><br><span class="muted">endpoint ${esc(c.endpointId)} • template ${esc(c.templateId)} • ${esc(c.status)}</span></div>`).join("")||'<p class="muted">No configs yet.</p>';
  $("subscriptionsList").innerHTML=state.subscriptions.map(s=>`<div class="item"><b>${esc(s.id)}</b> <span class="pill">${esc(s.status)}</span><br><span class="muted">user ${esc(s.userId)}${s.expiresAt?" • expires "+esc(s.expiresAt):""}</span></div>`).join("")||'<p class="muted">No subscriptions yet.</p>';
  $("healthList").innerHTML=state.endpoints.map(e=>`<div class="item"><b>${esc(e.name)}</b> — ${esc(e.status)}<br><span class="muted">${esc(e.id)}</span></div>`).join("")||'<p class="muted">No endpoints.</p>';
}
$("endpointForm").onsubmit=async e=>{
 e.preventDefault(); const f=new FormData(e.target); const now=new Date().toISOString();
 try{await api("/internal/endpoints",{method:"POST",body:json({id:crypto.randomUUID(),name:f.get("name"),host:f.get("host"),port:Number(f.get("port")),transport:f.get("transport"),tls:f.get("tls")==="on",region:f.get("region")||undefined,priority:Number(f.get("priority")),status:"PROVISIONING",createdAt:now,updatedAt:now})});e.target.reset();await load()}catch(x){$("out").textContent=String(x)}};
$("templateForm").onsubmit=async e=>{
 e.preventDefault(); const f=new FormData(e.target);
 try{await api("/internal/templates",{method:"POST",body:json({name:f.get("name"),protocol:f.get("protocol"),definition:JSON.parse(f.get("definition")||"{}")})});await load()}catch(x){$("out").textContent=String(x)}};
$("configForm").onsubmit=async e=>{
 e.preventDefault(); const f=new FormData(e.target); const owner=state.users.find(x=>x.role==="OWNER")||state.users[0];
 try{await api("/internal/configs",{method:"POST",body:json({userId:owner.id,endpointId:f.get("endpointId"),templateId:f.get("templateId"),expiresAt:f.get("expiresAt")?new Date(f.get("expiresAt")).toISOString():undefined})});await load()}catch(x){$("out").textContent=String(x)}};
$("subscriptionForm").onsubmit=async e=>{
 e.preventDefault(); const f=new FormData(e.target); const owner=state.users.find(x=>x.role==="OWNER")||state.users[0];
 try{const j=await api("/internal/subscriptions",{method:"POST",body:json({userId:owner.id,expiresAt:f.get("expiresAt")?new Date(f.get("expiresAt")).toISOString():undefined})});$("provisionForm").elements.subscriptionId.value=j.value.id;await load()}catch(x){$("out").textContent=String(x)}};
$("provisionForm").onsubmit=async e=>{
 e.preventDefault(); const f=new FormData(e.target);
 try{await api("/internal/subscriptions/"+encodeURIComponent(f.get("subscriptionId"))+"/provision",{method:"POST",body:json({templateId:f.get("templateId"),maxEndpoints:Number(f.get("maxEndpoints"))})});await load()}catch(x){$("out").textContent=String(x)}};
$("rebuildForm").onsubmit=async e=>{
 e.preventDefault(); const f=new FormData(e.target);
 try{await api("/internal/subscriptions/"+encodeURIComponent(f.get("subscriptionId"))+"/rebuild",{method:"POST"});await load()}catch(x){$("out").textContent=String(x)}};
$("refresh").onclick=()=>load().catch(x=>$("out").textContent=String(x));
document.addEventListener("click",async e=>{
 const b=e.target.closest("[data-health]"); if(!b)return;
 try{await api("/internal/endpoints/"+encodeURIComponent(b.dataset.health)+"/health",{method:"POST",body:json({healthy:b.dataset.value==="true"})});await load()}catch(x){$("out").textContent=String(x)}
});
load().catch(()=>{});
</script></body></html>`;
  return new Response(html,{headers:{"content-type":"text/html; charset=UTF-8","cache-control":"no-store"}});
}
