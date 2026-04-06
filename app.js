// ── DATA STORE — always read fresh from localStorage ──
const DB = {
  get user()    { return JSON.parse(localStorage.getItem('lb_user')     || 'null'); },
  get evidence(){ return JSON.parse(localStorage.getItem('lb_evidence') || '[]'); },
  get firs()    { return JSON.parse(localStorage.getItem('lb_firs')     || '[]'); },
  get audit()   { return JSON.parse(localStorage.getItem('lb_audit')    || '[]'); },
  get grants()  { return JSON.parse(localStorage.getItem('lb_grants')   || '[]'); },
  get requests(){ return JSON.parse(localStorage.getItem('lb_requests') || '[]'); },
  get users()   {
    const stored = localStorage.getItem('lb_users');
    if(stored) return JSON.parse(stored);
    const defaults = [
      {id:'u2',name:'Inspector Sharma',email:'sharma@police.gov',role:'police',badge:'POL-001'},
      {id:'u3',name:'Adv. Priya Mehta',email:'priya@law.in',role:'lawyer',badge:'BAR-2024'},
      {id:'u4',name:'Judge R. Verma',email:'verma@court.gov',role:'court',badge:'CRT-007'},
    ];
    localStorage.setItem('lb_users', JSON.stringify(defaults));
    return defaults;
  },
};

// ── SAVE HELPERS — each collection saved independently ──
const Store = {
  saveEvidence(list)  { localStorage.setItem('lb_evidence', JSON.stringify(list)); },
  saveFirs(list)      { localStorage.setItem('lb_firs',     JSON.stringify(list)); },
  saveGrants(list)    { localStorage.setItem('lb_grants',   JSON.stringify(list)); },
  saveRequests(list)  { localStorage.setItem('lb_requests', JSON.stringify(list)); },
  saveUsers(list)     { localStorage.setItem('lb_users',    JSON.stringify(list)); },
  // Audit is APPEND-ONLY — never overwrite, only add new entries
  appendAudit(entry){
    const existing = JSON.parse(localStorage.getItem('lb_audit') || '[]');
    if(existing.find(e=>e.id===entry.id)) return; // deduplicate
    existing.unshift(entry);
    localStorage.setItem('lb_audit', JSON.stringify(existing));
  },
};

// ── AUTH ──
function requireAuth(){
  if(!DB.user){ window.location.href='index.html'; return false; }
  return true;
}
function logout(){
  localStorage.removeItem('lb_user');
  window.location.href='index.html';
}
function loginUser(user){
  localStorage.setItem('lb_user', JSON.stringify(user));
}

// ── SHA-256 ──
async function sha256(buffer){
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// ── HELPERS ──
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function fmtDate(d){ return new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function fmtSize(b){ if(b<1024)return b+'B'; if(b<1048576)return (b/1024).toFixed(1)+'KB'; return (b/1048576).toFixed(1)+'MB'; }
function truncHash(h){ return h?h.slice(0,8)+'...'+h.slice(-8):''; }
function fileIcon(type=''){
  if(type.startsWith('image'))return '🖼️';
  if(type.startsWith('video'))return '🎥';
  if(type.startsWith('audio'))return '🎵';
  if(type.includes('pdf'))return '📄';
  if(type.includes('zip')||type.includes('rar'))return '🗜️';
  return '📁';
}

// ── AUDIT ──
function addAudit(action, evidenceId, evidenceName, details=''){
  const u = DB.user;
  Store.appendAudit({
    id: uid(),
    action,
    evidenceId,
    evidenceName,
    performedBy: u?.name || 'Unknown',
    performedByRole: u?.role || 'unknown',
    details,
    timestamp: new Date().toISOString(),
  });
}

// ── ACCESS CONTROL ──
// Returns all evidence a given user is allowed to see:
// - victim: only their own uploads
// - police/lawyer/court: evidence explicitly granted to them OR all if court
function getVisibleEvidence(user){
  if(!user) return [];
  const all = DB.evidence;
  if(user.role === 'victim'){
    return all.filter(e => e.uploadedBy === user.name);
  }
  if(user.role === 'court'){
    return all; // court sees everything
  }
  // police / lawyer: see evidence where a grant exists for their user id or name
  const grants = DB.grants;
  const grantedIds = grants
    .filter(g => g.grantedToId === user.id || g.grantedToName === user.name)
    .map(g => g.evidenceId);
  // Also show evidence they uploaded themselves (edge case)
  return all.filter(e => grantedIds.includes(e.id) || e.uploadedBy === user.name);
}

// Returns true if user can download a specific evidence
function canDownload(user, ev){
  if(!user || !ev) return false;
  if(user.role === 'victim') return ev.uploadedBy === user.name;
  if(user.role === 'court') return true;
  // police/lawyer: need a download grant
  const grant = DB.grants.find(g =>
    g.evidenceId === ev.id &&
    (g.grantedToId === user.id || g.grantedToName === user.name) &&
    g.permission === 'download'
  );
  return !!grant;
}

// ── SIDEBAR ──
function renderSidebar(activePage){
  const u = DB.user;
  if(!u) return;
  const rc = {
    victim: {emoji:'👤',label:'Victim',cls:'role-victim',badge:'badge-victim'},
    police: {emoji:'👮',label:'Police Officer',cls:'role-police',badge:'badge-police'},
    lawyer: {emoji:'⚖️',label:'Advocate',cls:'role-lawyer',badge:'badge-lawyer'},
    court:  {emoji:'🏛️',label:'Court Authority',cls:'role-court',badge:'badge-court'},
  }[u.role] || {emoji:'👤',label:'User',cls:'role-victim',badge:'badge-victim'};

  // Pending badge counts
  const pendingEv   = DB.evidence.filter(e=>!e.courtStatus||e.courtStatus==='pending').length;
  const pendingReqs = DB.requests.filter(r=>r.status==='pending').length;
  const myPending   = DB.requests.filter(r=>r.requestedBy===u.name&&r.status==='pending').length;

  const navItems = [
    {href:'dashboard.html',   icon:'📊', label:'Dashboard'},
    {href:'evidence.html',    icon:'📁', label:'Evidence'},
    {href:'fir.html',         icon:'🧾', label:'FIR Cases'},
    ...(u.role==='victim' ? [{href:'upload.html',  icon:'📤', label:'Upload Evidence'}] : []),
    ...(u.role==='victim' ? [{href:'access.html',  icon:'🔒', label:'Access Control'}]  : []),
    ...((u.role==='police'||u.role==='lawyer') ? [{href:'requests.html', icon:'📝', label:`My Requests${myPending?` (${myPending})`:''}` }] : []),
    ...(u.role==='court' ? [{href:'court-review.html', icon:'🏛️', label:`Court Review${pendingEv+pendingReqs?` (${pendingEv+pendingReqs})`:''}` }] : []),
    {href:'audit.html',       icon:'📜', label:'Audit Logs'},
    {href:'ai-detection.html',icon:'🤖', label:'AI Duplicate Check'},
  ];

  const navHTML = navItems.map(n=>`
    <a href="${n.href}" class="nav-item ${activePage===n.href?'active':''}">
      <span>${n.icon}</span>${n.label}
    </a>`).join('');

  document.getElementById('sidebar-mount').innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">
          <svg width="20" height="20" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div><h1>Evidence Lockbox</h1><span>Digital Justice System</span></div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-label">Navigation</div>
        ${navHTML}
      </nav>
      <div class="sidebar-footer">
        <div class="user-card">
          <div class="user-avatar ${rc.cls}">${rc.emoji}</div>
          <div class="user-info">
            <div class="uname">${u.name}</div>
            <span class="role-badge ${rc.badge}">${rc.label}</span>
          </div>
          <button onclick="logout()" title="Logout" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px;font-size:16px;">⏻</button>
        </div>
      </div>
    </aside>
    <div class="sidebar-overlay" id="overlay" onclick="closeSidebar()"></div>`;
}

function renderTopbar(title){
  const u = DB.user;
  document.getElementById('topbar-mount').innerHTML = `
    <header class="topbar">
      <div class="flex-center gap-3">
        <button class="hamburger" onclick="openSidebar()">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <h2 class="topbar-title">${title}</h2>
      </div>
      <div class="topbar-right">
        <div class="notif-btn"><span>🔔</span><span class="notif-dot"></span></div>
        <div style="font-size:13px;color:rgba(255,255,255,.75);">Welcome, <strong style="color:#fff">${u?.name||''}</strong></div>
      </div>
    </header>`;
}

function openSidebar(){ document.getElementById('sidebar')?.classList.add('open'); document.getElementById('overlay')?.classList.add('open'); }
function closeSidebar(){ document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('overlay')?.classList.remove('open'); }
