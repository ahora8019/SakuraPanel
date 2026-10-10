export function ownerDashboardResponse(): Response {
  const html = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#101116">
<title>SakuraPanel — Control Center</title>
<style>
:root{color-scheme:dark;--bg:#101116;--panel:#17181f;--panel2:#1d1e27;--line:#2d2e39;--text:#f4f2f6;--muted:#9696a7;--pink:#ee83b6;--pink2:#c65d93;--green:#75d6a0;--amber:#f0c477;--red:#ff8c98;--blue:#9baaff;--radius:17px}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 65% -20%,#322034 0,transparent 38%),var(--bg);color:var(--text);font:14px/1.5 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input,select,textarea{font:inherit}button,a{ -webkit-tap-highlight-color:transparent}a{color:inherit;text-decoration:none}button{cursor:pointer}
.shell{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:100vh}.sidebar{position:sticky;top:0;height:100vh;padding:24px 16px;border-right:1px solid var(--line);background:#121319eF;display:flex;flex-direction:column;gap:26px}.brand{display:flex;align-items:center;gap:12px;padding:0 8px}.logo{width:42px;height:42px;border-radius:14px;background:linear-gradient(145deg,#f5a4cb,#b85b91);display:grid;place-items:center;color:#271622;font-size:22px;box-shadow:0 7px 24px #c65d9330}.brand strong{font-size:16px;letter-spacing:.2px}.brand small{display:block;color:var(--muted);font-size:11px;margin-top:1px}.nav-label{padding:0 12px;color:#6f7080;font-size:10px;letter-spacing:1.6px;font-weight:800}.nav{display:grid;gap:5px}.nav button{border:0;background:transparent;color:#a8a8b7;text-align:left;border-radius:11px;padding:11px 12px;display:flex;align-items:center;gap:12px;transition:.15s}.nav button:hover{background:#ffffff08;color:white}.nav button.active{background:linear-gradient(90deg,#e57cae22,#e57cae08);color:#ffacd0;box-shadow:inset 2px 0 var(--pink)}.nav .ico{width:20px;text-align:center;font-size:16px}.nav .nav-tail{margin-left:auto;font-size:10px;color:#777887}.side-bottom{margin-top:auto}.environment{padding:13px;border:1px solid var(--line);border-radius:13px;background:#ffffff04}.env-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--green);margin-right:7px;box-shadow:0 0 10px #75d6a050}.environment small{display:block;color:var(--muted);margin-top:5px;font-size:11px}
.main{min-width:0;padding:26px clamp(16px,3vw,42px) 50px;max-width:1600px;width:100%;margin:0 auto}.topbar{display:flex;align-items:center;gap:16px;margin-bottom:30px}.crumb{color:var(--muted);font-size:12px}.topbar h1{font-size:25px;letter-spacing:-.7px;margin:2px 0 0}.top-actions{margin-left:auto;display:flex;align-items:center;gap:9px}.icon-btn,.btn{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:11px;padding:10px 13px}.icon-btn{width:41px;height:41px;padding:0}.btn.primary{background:var(--pink);color:#2a1320;border-color:transparent;font-weight:750}.btn:hover,.icon-btn:hover{filter:brightness(1.1)}.profile{display:flex;align-items:center;gap:9px;padding-left:10px;border-left:1px solid var(--line)}.avatar{width:37px;height:37px;border-radius:12px;background:#30202d;color:#ffacd0;display:grid;place-items:center;font-weight:800}.profile strong{display:block;font-size:12px}.profile small{display:block;color:var(--muted);font-size:10px}
.welcome{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:23px}.eyebrow{font-size:11px;color:var(--pink);font-weight:800;letter-spacing:1.5px;text-transform:uppercase}.welcome h2{font-size:23px;letter-spacing:-.6px;margin:5px 0}.welcome p{color:var(--muted);margin:0}.date-chip{border:1px solid var(--line);border-radius:11px;padding:9px 12px;color:var(--muted);white-space:nowrap;font-size:12px}
.grid{display:grid;gap:15px}.stats{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:18px}.card{background:linear-gradient(145deg,#1b1c24,#17181f);border:1px solid var(--line);border-radius:var(--radius);padding:18px;min-width:0;box-shadow:0 8px 24px #0000000b}.stat-head{display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:12px}.stat-icon{width:35px;height:35px;display:grid;place-items:center;border-radius:11px;background:#e77eaf17;color:var(--pink);font-size:17px}.stat-value{font-size:29px;line-height:1.2;font-weight:800;letter-spacing:-1px;margin:13px 0 6px}.stat-foot{font-size:11px;color:var(--muted)}.status-word{color:var(--green)}
.two-col{grid-template-columns:minmax(0,1.35fr) minmax(290px,.85fr);margin-bottom:18px}.section-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:16px}.section-head h3{font-size:14px;margin:0}.section-head p{color:var(--muted);font-size:11px;margin:4px 0 0}.text-btn{background:none;border:0;color:var(--pink);font-size:12px;padding:5px}.system-list{display:grid;gap:2px}.system{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #ffffff0b}.system:last-child{border-bottom:0}.system-icon{width:37px;height:37px;flex:0 0 37px;border-radius:12px;background:#ffffff08;display:grid;place-items:center;font-size:16px}.system-copy{min-width:0;flex:1}.system-copy strong{font-size:12px;display:block}.system-copy small{font-size:11px;color:var(--muted)}.pill{display:inline-flex;align-items:center;gap:6px;border-radius:100px;padding:4px 8px;font-size:10px;font-weight:700;white-space:nowrap;background:#ffffff09;color:var(--muted)}.pill::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor}.pill.good{color:var(--green);background:#75d6a010}.pill.warn{color:var(--amber);background:#f0c47710}.pill.bad{color:var(--red);background:#ff8c9810}.pill.neutral{color:#a8a8bb}
.chart-wrap{height:174px;position:relative;margin-top:8px}.chart-wrap svg{width:100%;height:100%;overflow:visible}.chart-legend{display:flex;gap:14px;color:var(--muted);font-size:10px;margin-top:10px}.legend-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px}.chart-note{color:var(--muted);font-size:10px;margin-top:10px}
.quick-grid{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:18px}.quick{display:flex;align-items:center;gap:12px;text-align:left;border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:14px;padding:15px;min-width:0}.quick:hover{border-color:#b85b9170;transform:translateY(-1px)}.quick .q-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#e77eaf17;color:var(--pink);font-size:17px;flex:0 0 38px}.quick strong{display:block;font-size:12px}.quick small{display:block;color:var(--muted);font-size:10px;margin-top:3px}
.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;min-width:540px}th{text-align:left;color:#858696;font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:10px;border-bottom:1px solid var(--line)}td{padding:13px 10px;border-bottom:1px solid #ffffff0a;font-size:12px}tr:last-child td{border-bottom:0}.primary-cell{font-weight:700}.sub-cell{display:block;color:var(--muted);font-size:10px;margin-top:3px}.empty{color:var(--muted);text-align:center;padding:22px 10px;font-size:12px}
.panel-section{display:none}.panel-section.active{display:block}.section-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.form-card h3{margin:0 0 5px;font-size:14px}.form-card>p{color:var(--muted);font-size:11px;margin:0 0 15px}label.field{display:block;color:var(--muted);font-size:11px;margin:10px 0 5px}input,select,textarea{width:100%;border:1px solid #363743;background:#111218;color:var(--text);border-radius:10px;padding:11px 12px;outline:none}input:focus,select:focus,textarea:focus{border-color:var(--pink)}textarea{resize:vertical}form .btn{width:100%;margin-top:12px}.inline-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.inline-form .full{grid-column:1/-1}.list-item{padding:12px 0;border-bottom:1px solid #ffffff0d}.list-item:last-child{border-bottom:0}.list-item strong{font-size:12px}.list-item small{display:block;color:var(--muted);font-size:10px;margin-top:3px;overflow-wrap:anywhere}.notice{padding:12px 14px;border:1px solid #f0c47730;border-radius:12px;color:#e9c98d;background:#f0c4770a;font-size:11px;margin-bottom:15px}.output{white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto;color:var(--muted);font-size:11px}.mobile-menu{display:none}
#login{max-width:440px;margin:10vh auto;padding:24px}.login-logo{text-align:center;font-size:32px}#login h2{text-align:center;margin:6px 0}#login p{text-align:center;color:var(--muted);font-size:12px}#login form{margin-top:22px}#login input{margin:6px 0}#app[hidden],#login[hidden]{display:none!important}
.toast{position:fixed;right:20px;bottom:20px;z-index:20;background:#242530;border:1px solid var(--line);border-radius:12px;padding:12px 16px;max-width:min(380px,calc(100vw - 32px));box-shadow:0 15px 40px #0008;font-size:12px}.toast.error{border-color:#ff8c9860}.muted{color:var(--muted)}
@media(max-width:1100px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.quick-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.two-col{grid-template-columns:1fr}}
@media(max-width:720px){.shell{display:block}.sidebar{position:fixed;z-index:10;top:0;left:0;width:260px;transform:translateX(-102%);transition:transform .2s;box-shadow:15px 0 50px #0007}.sidebar.open{transform:translateX(0)}.mobile-menu{display:inline-grid;place-items:center}.main{padding:18px 14px 36px}.topbar{margin-bottom:23px}.topbar h1{font-size:20px}.profile .profile-copy{display:none}.top-actions{gap:6px}.top-actions .btn{padding:9px;font-size:11px}.welcome{align-items:start;flex-direction:column}.welcome h2{font-size:21px}.date-chip{display:none}.stats{gap:10px}.card{padding:14px;border-radius:14px}.stat-value{font-size:25px}.quick-grid{gap:9px}.quick{padding:11px;gap:9px}.quick .q-icon{width:32px;height:32px;flex-basis:32px}.quick strong{font-size:11px}.section-grid{grid-template-columns:1fr}.inline-form{grid-template-columns:1fr}.inline-form .full{grid-column:auto}}
@media(max-width:380px){.stats{grid-template-columns:1fr 1fr}.stat-value{font-size:23px}.quick-grid{grid-template-columns:1fr}.top-actions .refresh-label{display:none}}
</style>
</head>
<body>
<section id="login" class="card" hidden>
  <div class="login-logo">🌸</div><h2>SakuraPanel</h2><p>Secure owner access · Control Center</p>
  <form method="post" action="/owner/login">
    <label class="field" for="login-user">Owner username</label><input id="login-user" name="username" value="ahora_8019" autocomplete="username" required>
    <label class="field" for="login-secret">Bootstrap / login secret</label><input id="login-secret" name="bootstrapSecret" type="password" placeholder="Enter secret" autocomplete="current-password" required>
    <button class="btn primary" type="submit">Open Control Center ↗</button>
  </form>
  <p>Access is verified by SakuraPanel. Never share your secret or session token.</p>
</section>
<div id="app" class="shell" hidden>
<aside id="sidebar" class="sidebar">
  <a class="brand" href="/owner"><span class="logo">🌸</span><span><strong>SakuraPanel</strong><small>CONTROL CENTER · v1.0</small></span></a>
  <div><div class="nav-label">WORKSPACE</div><nav class="nav" aria-label="Main navigation">
    <button class="active" data-page="overview"><span class="ico">◫</span>Overview</button>
    <button data-page="users"><span class="ico">♙</span>Users <span id="usersNav" class="nav-tail"></span></button>
    <button data-page="configs"><span class="ico">⌘</span>Config Studio</button>
    <button data-page="subscriptions"><span class="ico">▤</span>Subscriptions</button>
  </nav></div>
  <div><div class="nav-label">SYSTEMS</div><nav class="nav">
    <button data-page="systems"><span class="ico">◉</span>Sakura Pulse</button>
    <button data-page="systems"><span class="ico">⌁</span>Route Advisor</button>
    <button data-page="systems"><span class="ico">↗</span>Speed Lab</button>
    <button data-page="systems"><span class="ico">✓</span>Safe Release Lab</button>
    <a class="nav-button" href="/owner/labs" style="display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:11px;color:#a8a8b7"><span class="ico">↗</span>Open Systems Lab</a>
  </nav></div>
  <div class="side-bottom"><div class="environment"><span class="env-dot"></span><strong style="font-size:11px">Control Center</strong><small>Environment status is verified separately</small></div><button id="logout" class="btn" style="width:100%;margin-top:10px">↪ Sign out</button></div>
</aside>
<main class="main">
<header class="topbar">
  <button id="mobileMenu" class="icon-btn mobile-menu" aria-label="Open navigation">☰</button>
  <div><div class="crumb">Workspace / <span id="crumb">Overview</span></div><h1 id="pageTitle">Overview</h1></div>
  <div class="top-actions"><button id="refresh" class="icon-btn" title="Refresh data" aria-label="Refresh data">↻</button><button class="btn primary" id="newSubscription">＋ New subscription</button><div class="profile"><div class="avatar">S</div><div class="profile-copy"><strong id="who">Owner</strong><small>OWNER ACCESS</small></div></div></div>
</header>
<section id="page-overview" class="panel-section active">
  <div class="welcome"><div><div class="eyebrow">Your Sakura workspace</div><h2>Welcome back, <span id="welcomeName">Owner</span> 🌸</h2><p>Here’s what’s happening across your panel today.</p></div><div class="date-chip" id="today">◷ Local time</div></div>
  <div class="grid stats">
    <article class="card"><div class="stat-head">Total users <span class="stat-icon">♙</span></div><div class="stat-value" id="usersCount">—</div><div class="stat-foot">Registered accounts</div></article>
    <article class="card"><div class="stat-head">Templates <span class="stat-icon">▦</span></div><div class="stat-value" id="templatesCount">—</div><div class="stat-foot">Available definitions</div></article>
    <article class="card"><div class="stat-head">Configurations <span class="stat-icon">⌘</span></div><div class="stat-value" id="configsCount">—</div><div class="stat-foot">Visible in current scope</div></article>
    <article class="card"><div class="stat-head">Subscriptions <span class="stat-icon">▤</span></div><div class="stat-value" id="subscriptionsCount">—</div><div class="stat-foot">Visible in current scope</div></article>
  </div>
  <div class="grid two-col">
    <article class="card"><div class="section-head"><div><h3>System health</h3><p>Live checks from configured SakuraPanel endpoints</p></div><button class="text-btn" data-goto="systems">View details ↗</button></div>
      <div id="systemList" class="system-list"><div class="empty">Checking system status…</div></div>
    </article>
    <article class="card"><div class="section-head"><div><h3>Workspace snapshot</h3><p>Current data, not estimated analytics</p></div><span class="pill neutral">Live data</span></div>
      <div class="chart-wrap"><svg viewBox="0 0 420 170" role="img" aria-label="Workspace composition bars"><defs><linearGradient id="pinkFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ee83b6" stop-opacity=".35"/><stop offset="1" stop-color="#ee83b6" stop-opacity="0"/></linearGradient></defs><g stroke="#ffffff0d" stroke-width="1"><path d="M12 25H408M12 65H408M12 105H408M12 145H408"/></g><path d="M12 126 C42 120,52 83,84 92 S126 116,158 72 S208 92,240 55 S292 84,322 45 S374 56,408 24 L408 145 L12 145Z" fill="url(#pinkFill)"/><path d="M12 126 C42 120,52 83,84 92 S126 116,158 72 S208 92,240 55 S292 84,322 45 S374 56,408 24" fill="none" stroke="#ee83b6" stroke-width="2.5" stroke-linecap="round"/><text x="12" y="164" fill="#777887" font-size="10">Illustrative visual · not analytics</text></svg></div>
      <div class="chart-note">This decorative curve is not real usage data. Connect an analytics source before using trend charts operationally.</div>
    </article>
  </div>
  <div class="section-head"><div><h3>Quick actions</h3><p>Jump straight into common tasks</p></div></div>
  <div class="grid quick-grid">
    <button class="quick" data-goto="users"><span class="q-icon">♙</span><span><strong>Manage users</strong><small>Accounts & roles</small></span></button>
    <button class="quick" data-goto="configs"><span class="q-icon">⌘</span><span><strong>Generate config</strong><small>Config Studio</small></span></button>
    <button class="quick" data-goto="subscriptions"><span class="q-icon">▤</span><span><strong>Create subscription</strong><small>Subscription control</small></span></button>
    <a class="quick" href="/owner/labs"><span class="q-icon">⌁</span><span><strong>Open system labs</strong><small>Pulse & diagnostics</small></span></a>
  </div>
  <article class="card"><div class="section-head"><div><h3>Recent subscriptions</h3><p>Latest records in the current owner scope</p></div><button class="text-btn" data-goto="subscriptions">View all ↗</button></div><div class="table-wrap"><table><thead><tr><th>Subscription</th><th>User</th><th>Status</th><th>Expires</th></tr></thead><tbody id="recentSubs"><tr><td colspan="4" class="empty">Loading subscription data…</td></tr></tbody></table></div></article>
</section>
<section id="page-users" class="panel-section">
  <div class="welcome"><div><div class="eyebrow">Access management</div><h2>Users</h2><p>Review accounts visible to your role and manage account status.</p></div></div>
  <article class="card"><div class="section-head"><div><h3>Registered users</h3><p id="usersCaption">Loading users…</p></div><input id="userSearch" placeholder="Search username / ID" style="max-width:230px"></div><div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>User ID</th></tr></thead><tbody id="usersTable"></tbody></table></div></article>
</section>
<section id="page-configs" class="panel-section">
  <div class="welcome"><div><div class="eyebrow">Configuration lifecycle</div><h2>Config Studio</h2><p>Manage templates and generate configurations using the existing API.</p></div></div>
  <div class="notice">Generated configurations and template definitions can contain sensitive details. Only create or share records with authorized users.</div>
  <div class="grid section-grid">
    <article class="card form-card"><h3>Template Registry</h3><p>Create a reusable config template.</p><form id="templateForm">
      <label class="field">Template name</label><input name="name" value="default-template" required maxlength="100">
      <label class="field">Protocol</label><input name="protocol" value="generic" required maxlength="32">
      <label class="field">Definition (JSON)</label><textarea name="definition" rows="5">{}</textarea>
      <button class="btn primary" type="submit">＋ Create template</button></form></article>
    <article class="card form-card"><h3>Generate configuration</h3><p>Use an existing user and template ID.</p><form id="configForm">
      <label class="field">User ID</label><input name="userId" placeholder="Target user ID" required>
      <label class="field">Template ID</label><input name="templateId" placeholder="Template ID" required>
      <label class="field">Device ID (optional)</label><input name="deviceId" placeholder="Device ID">
      <label class="field">Expiration (optional)</label><input name="expiresAt" type="datetime-local">
      <button class="btn primary" type="submit">Generate configuration</button></form></article>
  </div>
  <article class="card" style="margin-top:15px"><div class="section-head"><div><h3>Templates</h3><p>Available template records</p></div><button class="text-btn" id="refreshTemplates">Refresh ↻</button></div><div id="templatesList"></div></article>
  <article class="card" style="margin-top:15px"><div class="section-head"><div><h3>Configurations</h3><p>Records visible for the current owner scope</p></div></div><div id="configsList"></div></article>
</section>
<section id="page-subscriptions" class="panel-section">
  <div class="welcome"><div><div class="eyebrow">Subscription delivery</div><h2>Subscriptions</h2><p>Create subscriptions, provision versions, and rebuild delivery records.</p></div></div>
  <div class="grid section-grid">
    <article class="card form-card"><h3>Create subscription</h3><p>Create a subscription for an existing user.</p><form id="subscriptionForm">
      <label class="field">User ID</label><input name="userId" placeholder="Target user ID" required>
      <label class="field">Expiration (optional)</label><input name="expiresAt" type="datetime-local">
      <button class="btn primary" type="submit">＋ Create subscription</button></form></article>
    <article class="card form-card"><h3>Provision subscription</h3><p>Generate or update the provisioned version.</p><form id="provisionForm">
      <label class="field">Subscription ID</label><input name="subscriptionId" placeholder="Subscription ID" required>
      <label class="field">Template ID</label><input name="templateId" placeholder="Template ID" required>
      <label class="field">Device ID (optional)</label><input name="deviceId" placeholder="Device ID">
      <button class="btn primary" type="submit">Provision version</button></form></article>
  </div>
  <article class="card form-card" style="margin-top:15px"><h3>Rebuild delivery</h3><p>Use only when you intend to regenerate an existing subscription.</p><form id="rebuildForm" class="inline-form"><div><label class="field">Subscription ID</label><input name="subscriptionId" placeholder="Subscription ID" required></div><div style="align-self:end"><button class="btn" type="submit">↻ Rebuild subscription</button></div></form></article>
  <article class="card" style="margin-top:15px"><div class="section-head"><div><h3>Subscription records</h3><p>Records visible for the current owner scope</p></div><button class="text-btn" id="refreshSubs">Refresh ↻</button></div><div class="table-wrap"><table><thead><tr><th>Subscription</th><th>User</th><th>Status</th><th>Expires</th></tr></thead><tbody id="subsTable"></tbody></table></div></article>
</section>
<section id="page-systems" class="panel-section">
  <div class="welcome"><div><div class="eyebrow">Operational visibility</div><h2>System health</h2><p>Read-only checks and links to detailed diagnostics.</p></div><a class="btn primary" href="/owner/labs">Open Systems Lab ↗</a></div>
  <div class="grid section-grid"><article class="card"><div class="section-head"><div><h3>Readiness checks</h3><p>Application readiness endpoint</p></div><button id="runReadiness" class="text-btn">Run ↻</button></div><pre id="readinessOutput" class="output">Not checked yet.</pre></article>
  <article class="card"><div class="section-head"><div><h3>Sakura Pulse</h3><p>Configured health diagnostics</p></div><button id="runPulse" class="text-btn">Run ↻</button></div><pre id="pulseOutput" class="output">Not checked yet.</pre></article></div>
  <article class="card" style="margin-top:15px"><h3>Specialized tools</h3><p class="muted">Detailed Config Studio export, Pulse history, Speed Lab and Route Advisor tools are in Systems Lab.</p><a class="btn primary" href="/owner/labs">Go to Systems Lab ↗</a></article>
</section>
<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
</main>
</div>
<script>
const $=id=>document.getElementById(id);
const state={users:[],templates:[],configs:[],subscriptions:[],owner:null};
const pageNames={overview:"Overview",users:"Users",configs:"Config Studio",subscriptions:"Subscriptions",systems:"System health"};
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toast(message,error=false){const el=$("toast");el.textContent=message;el.className="toast"+(error?" error":"");el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,4200)}
async function api(path,options={}){const r=await fetch(path,{credentials:"same-origin",...options,headers:{...(options.body?{"content-type":"application/json"}:{}),...(options.headers||{})}});let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.error||("HTTP "+r.status));return j}
function goto(page){document.querySelectorAll(".panel-section").forEach(s=>s.classList.remove("active"));$("page-"+page)?.classList.add("active");document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));$("pageTitle").textContent=pageNames[page]||page;$("crumb").textContent=pageNames[page]||page;$("sidebar").classList.remove("open");history.replaceState(null,"","#"+page)}
function dt(value){if(!value)return "No expiry";const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})}
function statusPill(value){const v=String(value||"unknown").toLowerCase();const cls=["active","healthy","ok","published"].includes(v)?"good":["expired","disabled","suspended","failed","invalid","revoked"].includes(v)?"bad":["pending","unknown","insufficient_data"].includes(v)?"warn":"neutral";return '<span class="pill '+cls+'">'+esc(value||"unknown")+"</span>"}
function rowsOrEmpty(rows,cols,message){return rows.length?rows:'<tr><td colspan="'+cols+'" class="empty">'+message+"</td></tr>"}
function renderUsers(){const q=($("userSearch")?.value||"").trim().toLowerCase();const list=state.users.filter(u=>[u.username,u.id,u.role,u.status].some(v=>String(v||"").toLowerCase().includes(q)));$("usersCaption").textContent=state.users.length+" user record(s) loaded";$("usersTable").innerHTML=rowsOrEmpty(list.map(u=>'<tr><td class="primary-cell">'+esc(u.username||"Unnamed")+'</td><td>'+statusPill(u.role)+'</td><td>'+statusPill(u.status)+'</td><td><span class="sub-cell">'+esc(u.id)+'</span></td></tr>').join(""),4,"No matching users.");$("usersNav").textContent=state.users.length||""}
function renderTemplates(){$("templatesList").innerHTML=state.templates.length?state.templates.map(t=>'<div class="list-item"><strong>'+esc(t.name)+'</strong> '+statusPill(t.status||"available")+'<small>'+esc(t.id)+" · "+esc(t.protocol||"unknown protocol")+" · version "+esc(t.version??"—")+"</small></div>").join(""):'<div class="empty">No templates found.</div>'}
function renderConfigs(){$("configsList").innerHTML=state.configs.length?state.configs.map(c=>'<div class="list-item"><strong>'+esc(c.id)+'</strong> '+statusPill(c.status)+'<small>Template '+esc(c.templateId)+(c.deviceId?" · Device "+esc(c.deviceId):"")+"</small></div>").join(""):'<div class="empty">No configurations in this scope, or no records available.</div>'}
function renderSubscriptions(){$("subsTable").innerHTML=rowsOrEmpty(state.subscriptions.map(s=>'<tr><td class="primary-cell">'+esc(s.id)+'</td><td>'+esc(s.userId)+'</td><td>'+statusPill(s.status)+'</td><td>'+esc(dt(s.expiresAt))+'</td></tr>').join(""),4,"No subscriptions found.");$("recentSubs").innerHTML=rowsOrEmpty(state.subscriptions.slice().reverse().slice(0,5).map(s=>'<tr><td class="primary-cell">'+esc(s.id)+'</td><td>'+esc(s.userId)+'</td><td>'+statusPill(s.status)+'</td><td>'+esc(dt(s.expiresAt))+'</td></tr>').join(""),4,"No subscription records available.")}
function renderSystems(items){$("systemList").innerHTML=items.map(s=>'<div class="system"><div class="system-icon">'+s.icon+'</div><div class="system-copy"><strong>'+esc(s.name)+'</strong><small>'+esc(s.detail)+'</small></div>'+statusPill(s.status)+'</div>').join("")}
async function load(){ $("refresh").disabled=true;$("refresh").textContent="…";try{
 const [u,t,ready,pulse]=await Promise.allSettled([api("/internal/users"),api("/internal/templates"),fetch("/ready",{credentials:"same-origin"}).then(async r=>({http:r.status,data:await r.json()})),api("/internal/pulse")]);
 if(u.status==="fulfilled")state.users=u.value.value||[];else if(/401|unauthorized|session|auth/i.test(String(u.reason)))throw u.reason;
 if(t.status==="fulfilled")state.templates=t.value.value||[];
 const owner=state.users.find(x=>x.role==="OWNER")||state.users[0]||null;state.owner=owner;
 if(owner){const [c,s]=await Promise.allSettled([api("/internal/configs?userId="+encodeURIComponent(owner.id)),api("/internal/subscriptions?userId="+encodeURIComponent(owner.id))]);state.configs=c.status==="fulfilled"?(c.value.value||[]):[];state.subscriptions=s.status==="fulfilled"?(s.value.value||[]):[];$("who").textContent=owner.username||"Owner";$("welcomeName").textContent=owner.username||"Owner";$("avatar");document.querySelector(".avatar").textContent=(owner.username||"S").slice(0,1).toUpperCase()}
 $("usersCount").textContent=state.users.length;$("templatesCount").textContent=state.templates.length;$("configsCount").textContent=state.configs.length;$("subscriptionsCount").textContent=state.subscriptions.length;
 renderUsers();renderTemplates();renderConfigs();renderSubscriptions();
 const systemItems=[
 {name:"Worker / readiness",icon:"◉",detail:ready.status==="fulfilled"?"HTTP "+ready.value.http+" · "+(ready.value.data.ok?"ready":"checks need attention"):"Readiness endpoint unavailable",status:ready.status==="fulfilled"?(ready.value.data.ok?"Healthy":"Attention required"):"Unavailable"},
 {name:"D1 / Pulse diagnostics",icon:"▤",detail:pulse.status==="fulfilled"?"Health diagnostic response received":"Pulse endpoint unavailable",status:pulse.status==="fulfilled"?"Checked":"Unavailable"},
 {name:"Config & subscription APIs",icon:"⌘",detail:"Data endpoints "+(u.status==="fulfilled"&&t.status==="fulfilled"?"responding":"partially unavailable"),status:u.status==="fulfilled"&&t.status==="fulfilled"?"Available":"Partial"},
 {name:"Route Advisor",icon:"⌁",detail:"Open systems lab to inspect evidence freshness",status:"Needs review"}];
 renderSystems(systemItems);
 if(ready.status==="fulfilled")$("readinessOutput").textContent=JSON.stringify(ready.value,null,2);else $("readinessOutput").textContent=String(ready.reason);
 if(pulse.status==="fulfilled")$("pulseOutput").textContent=JSON.stringify(pulse.value.value||pulse.value,null,2);else $("pulseOutput").textContent=String(pulse.reason);
 $("today").textContent="◷ "+new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"});
 $("login").hidden=true;$("app").hidden=false;
 }catch(e){$("app").hidden=true;$("login").hidden=false;console.error(e)}finally{$("refresh").disabled=false;$("refresh").textContent="↻"}}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>goto(b.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>goto(b.dataset.goto)));
$("mobileMenu").onclick=()=>$("sidebar").classList.toggle("open");
$("refresh").onclick=()=>load().then(()=>toast("Dashboard refreshed.")).catch(e=>toast(String(e),true));
$("userSearch").oninput=renderUsers;
$("newSubscription").onclick=()=>{goto("subscriptions");document.querySelector('#subscriptionForm input[name="userId"]').focus()};
$("refreshTemplates").onclick=()=>load().then(()=>toast("Templates refreshed.")).catch(e=>toast(String(e),true));
$("refreshSubs").onclick=()=>load().then(()=>toast("Subscriptions refreshed.")).catch(e=>toast(String(e),true));
$("runReadiness").onclick=async()=>{try{const r=await fetch("/ready",{credentials:"same-origin"});$("readinessOutput").textContent=JSON.stringify({http:r.status,...await r.json()},null,2)}catch(e){$("readinessOutput").textContent=String(e)}};
$("runPulse").onclick=async()=>{try{$("pulseOutput").textContent=JSON.stringify(await api("/internal/pulse"),null,2)}catch(e){$("pulseOutput").textContent=String(e)}};
$("logout").onclick=async()=>{try{await fetch("/owner/logout",{method:"POST",credentials:"same-origin"})}finally{location.reload()}};
$("templateForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{let definition;try{definition=JSON.parse(f.get("definition")||"{}")}catch{throw new Error("Definition must be valid JSON.")}await api("/internal/templates",{method:"POST",body:JSON.stringify({name:f.get("name"),protocol:f.get("protocol"),definition})});e.target.reset();toast("Template created.");await load()}catch(x){toast(String(x),true)}};
$("configForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("/internal/configs",{method:"POST",body:JSON.stringify({userId:f.get("userId"),deviceId:f.get("deviceId")||undefined,templateId:f.get("templateId"),expiresAt:f.get("expiresAt")?new Date(f.get("expiresAt")).toISOString():undefined})});toast("Configuration generated.");await load()}catch(x){toast(String(x),true)}};
$("subscriptionForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("/internal/subscriptions",{method:"POST",body:JSON.stringify({userId:f.get("userId"),expiresAt:f.get("expiresAt")?new Date(f.get("expiresAt")).toISOString():undefined})});e.target.reset();toast("Subscription created.");await load()}catch(x){toast(String(x),true)}};
$("provisionForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("/internal/subscriptions/"+encodeURIComponent(f.get("subscriptionId"))+"/provision",{method:"POST",body:JSON.stringify({templateId:f.get("templateId"),deviceId:f.get("deviceId")||undefined})});toast("Subscription provisioned.");await load()}catch(x){toast(String(x),true)}};
$("rebuildForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);if(!confirm("Rebuild this subscription now?"))return;try{await api("/internal/subscriptions/"+encodeURIComponent(f.get("subscriptionId"))+"/rebuild",{method:"POST"});toast("Subscription rebuild requested.");await load()}catch(x){toast(String(x),true)}};
const initialPage=location.hash.slice(1);if(pageNames[initialPage])goto(initialPage);load();
</script>
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
