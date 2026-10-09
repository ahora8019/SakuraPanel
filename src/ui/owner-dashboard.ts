export function ownerDashboardResponse(): Response {
  const html = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SakuraPanel Owner</title>
<style>
:root{color-scheme:dark}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:860px;margin:0 auto;padding:18px;background:#101010;color:#fff}
h1,h2{margin:8px 0 14px}.muted{color:#aaa}.card{background:#191919;border:1px solid #303030;border-radius:16px;padding:16px;margin:12px 0}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.stat{font-size:28px;font-weight:800}
input,select,textarea,button{width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #444;background:#222;color:#fff}
button{background:#d85f9d;border:0;font-weight:700}.secondary{background:#333}.danger{background:#8d3d58}.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.item{padding:10px 0;border-top:1px solid #333}.pill{display:inline-block;padding:3px 8px;border-radius:99px;background:#292929;margin-left:5px}
pre{white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto}@media(max-width:600px){.grid,.row{grid-template-columns:1fr}}
</style></head><body>
<h1>🌸 SakuraPanel Owner</h1>
<section id="login" class="card"><form method="post" action="/owner/login">
<p class="muted">Cloudflare-only control panel. No external VPS is required by SakuraPanel itself.</p>
<input name="username" value="ahora_8019" autocomplete="username" required>
<input name="bootstrapSecret" type="password" placeholder="Bootstrap secret" autocomplete="off" required>
<button type="submit">Open Dashboard</button></form></section>

<section id="app" hidden>
<div class="card"><strong>OWNER</strong><div id="who" class="muted"></div></div>
<div class="grid">
<div class="card"><div id="users" class="stat">—</div><div class="muted">Users</div></div>
<div class="card"><div id="templatesCount" class="stat">—</div><div class="muted">Templates</div></div>
<div class="card"><div id="configsCount" class="stat">—</div><div class="muted">Configs</div></div>
</div>

<div class="card">
<h2>1. Template Registry</h2>
<form id="templateForm"><div class="row">
<input name="name" placeholder="Template name" value="default-template" required>
<input name="protocol" placeholder="Protocol" value="generic" required>
</div><textarea name="definition" rows="5">{}</textarea><button>Create Template</button></form>
<div id="templatesList"></div></div>

<div class="card">
<h2>2. Config Generator</h2>
<p class="muted">Choose a protocol preset, set the port and subscription name, then generate 1–100 configs.</p>
<form id="configForm">
<label for="generatorProtocol">Protocol</label>
<select id="generatorProtocol" name="protocol" required>
<option value="VLESS">VLESS</option><option value="VMess">VMess</option><option value="Trojan">Trojan</option><option value="Shadowsocks">Shadowsocks</option>
</select>
<div class="row">
<div><label for="generatorPort">Port</label><input id="generatorPort" name="port" type="number" min="1" max="65535" value="443" required></div>
<div><label for="generatorCount">Number of configs</label><input id="generatorCount" name="count" type="number" min="1" max="100" value="10" required></div>
</div>
<label for="subscriptionName">Subscription Name</label><input id="subscriptionName" name="subscriptionName" maxlength="64" value="Sakura-Sub" required>
<button id="generateButton" type="submit">🌸 Generate</button>
</form>
<div id="generatorResult" aria-live="polite"></div>
<div id="configsList"></div></div>

<div class="card">
<h2>3. Subscription</h2>
<form id="subscriptionForm"><input name="userId" placeholder="User ID" required><input name="name" placeholder="Subscription name (optional)" maxlength="64"><input name="expiresAt" type="datetime-local"><button>Create Subscription</button></form>
<form id="provisionForm"><input name="subscriptionId" placeholder="Subscription ID" required><input name="templateId" placeholder="Template ID" required><input name="deviceId" placeholder="Optional Device ID"><button>Provision Version</button></form>
<form id="rebuildForm"><input name="subscriptionId" placeholder="Subscription ID" required><button class="secondary">Rebuild Subscription</button></form>
<div id="subscriptionsList"></div></div>

<div class="card"><button id="refresh" class="secondary">Refresh Everything</button>
<form method="post" action="/owner/logout"><button type="submit" class="danger">Logout</button></form><pre id="out"></pre></div>
</section>

<script>
const $=id=>document.getElementById(id); let state={users:[],templates:[],configs:[],subscriptions:[]};
async function api(path,options={}){const r=await fetch(path,{credentials:"same-origin",...options,headers:{"content-type":"application/json",...(options.headers||{})}});let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.error||("HTTP "+r.status));return j}
function json(v){return JSON.stringify(v)} function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
async function load(){
 const [u,t]=await Promise.all([api("/internal/users"),api("/internal/templates")]);state.users=u.value||[];state.templates=t.value||[];
 const owner=state.users.find(x=>x.role==="OWNER")||state.users[0];if(owner){const[c,s]=await Promise.all([api("/internal/configs?userId="+encodeURIComponent(owner.id)),api("/internal/subscriptions?userId="+encodeURIComponent(owner.id))]);state.configs=c.value||[];state.subscriptions=s.value||[];$("who").textContent=owner.username+" • authenticated"}
 $("users").textContent=state.users.length;$("templatesCount").textContent=state.templates.length;$("configsCount").textContent=state.configs.length;render();$("login").hidden=true;$("app").hidden=false
}
function render(){
 $("templatesList").innerHTML=state.templates.map(t=>'<div class="item"><b>'+esc(t.name)+'</b> <span class="pill">'+esc(t.protocol)+'</span><br><span class="muted">'+esc(t.id)+' • v'+t.version+'</span></div>').join("")||'<p class="muted">No templates yet.</p>';
 $("configsList").innerHTML=state.configs.map(c=>'<div class="item"><b>'+esc(c.payload?.name||c.id)+'</b> <span class="pill">'+esc(c.status)+'</span><br><span class="muted">'+esc(c.payload?.protocol||"Template config")+" • port "+esc(c.payload?.port??"—")+" • "+esc(c.id)+'</span></div>').join("")||'<p class="muted">No configs yet.</p>';
 $("subscriptionsList").innerHTML=state.subscriptions.map(s=>'<div class="item"><b>'+esc(s.name||s.id)+'</b> <span class="pill">'+esc(s.status)+'</span><br><span class="muted">'+esc(s.id)+" • user "+esc(s.userId)+(s.expiresAt?" • expires "+esc(s.expiresAt):"")+'</span></div>').join("")||'<p class="muted">No subscriptions yet.</p>';
}
$("templateForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("/internal/templates",{method:"POST",body:json({name:f.get("name"),protocol:f.get("protocol"),definition:JSON.parse(f.get("definition")||"{}")})});await load()}catch(x){$("out").textContent=String(x)}};
$("configForm").onsubmit=async e=>{
e.preventDefault();const f=new FormData(e.target);const button=$("generateButton");button.disabled=true;button.textContent="Generating…";$("generatorResult").textContent="Generating configs…";
try{
const result=await api("/internal/config-generator",{method:"POST",body:json({protocol:f.get("protocol"),port:Number(f.get("port")),subscriptionName:String(f.get("subscriptionName")).trim(),count:Number(f.get("count"))})});
const link=location.origin+"/s/"+result.value.accessToken;
$("generatorResult").textContent="✓ "+result.value.subscription.name+" — "+result.value.subscription.configCount+" configs generated (version "+result.value.subscription.version+").";
$("out").textContent="Subscription link (save it now):\n"+link+"\n\nGenerated configs:\n"+JSON.stringify(result.value.configs,null,2);
await load();
}catch(x){const message=String(x);$("generatorResult").textContent=message.includes("template_not_found")?"No active template matches this protocol. Add an active protocol template with the required server/credential settings first.":"Generation failed: "+message;}
finally{button.disabled=false;button.textContent="🌸 Generate"}
};
$("subscriptionForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("/internal/subscriptions",{method:"POST",body:json({userId:f.get("userId"),name:f.get("name")||undefined,expiresAt:f.get("expiresAt")?new Date(f.get("expiresAt")).toISOString():undefined})});await load()}catch(x){$("out").textContent=String(x)}};
$("provisionForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("/internal/subscriptions/"+encodeURIComponent(f.get("subscriptionId"))+"/provision",{method:"POST",body:json({templateId:f.get("templateId"),deviceId:f.get("deviceId")||undefined})});await load()}catch(x){$("out").textContent=String(x)}};
$("rebuildForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("/internal/subscriptions/"+encodeURIComponent(f.get("subscriptionId"))+"/rebuild",{method:"POST"});await load()}catch(x){$("out").textContent=String(x)}};
$("refresh").onclick=()=>load().catch(x=>$("out").textContent=String(x));load().catch(()=>{});
</script></body></html>`;
  return new Response(html, { headers: {
    "content-type": "text/html; charset=UTF-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "cross-origin-resource-policy": "same-origin",
    "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'"
  }});
}
