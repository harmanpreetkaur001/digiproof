const API = 'http://localhost:5000/api';

const store = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: k => localStorage.removeItem(k)
};

// ── Role Configuration ─────────────────────────────────────────────
const ROLES = {
  victim: {
    color: '#22c55e', emoji: '👤', label: 'Victim',
    canUpload: true, canView: true, canDownload: false,
    canComment: false, canApprove: false, canGrantAccess: false,
    dashTitle: 'My Evidence Vault',
    dashSub: 'Upload and manage your evidence securely',
    welcomeMsg: 'Your evidence is safe and tamper-proof.'
  },
  police: {
    color: '#3b82f6', emoji: '👮', label: 'Police Officer',
    canUpload: false, canView: false, canDownload: false,
    canComment: true, canApprove: false, canGrantAccess: false,
    dashTitle: 'Investigation Portal',
    dashSub: 'Request access to FIR evidence for investigation',
    welcomeMsg: 'Submit access requests to view evidence.'
  },
  lawyer: {
    color: '#f59e0b', emoji: '⚖️', label: 'Advocate',
    canUpload: false, canView: false, canDownload: true,
    canComment: false, canApprove: false, canGrantAccess: false,
    dashTitle: 'Legal Evidence Portal',
    dashSub: 'Access approved case evidence for legal proceedings',
    welcomeMsg: 'Request access to download case evidence.'
  },
  court: {
    color: '#a855f7', emoji: '🏛️', label: 'Court / Judge',
    canUpload: false, canView: true, canDownload: true,
    canComment: true, canApprove: true, canGrantAccess: true,
    dashTitle: 'Court Evidence Management',
    dashSub: 'Final authority on all evidence and access',
    welcomeMsg: 'You have full authority over all evidence.'
  }
};

function getUser() { return store.get('lockbox_user'); }
function getToken() { return store.get('lockbox_token'); }
function isLoggedIn() { return !!getToken(); }
function getRoleConfig() { return ROLES[getUser()?.role] || ROLES.victim; }

function requireAuth() {
  if (!isLoggedIn()) window.location.href = '../index.html';
}

function logout() {
  ['lockbox_user','lockbox_token'].forEach(k => store.del(k));
  window.location.href = '../index.html';
}

// ── Access Requests ────────────────────────────────────────────────
function getRequests() { return store.get('lockbox_requests') || []; }
function saveRequests(r) { store.set('lockbox_requests', r); }

function requestAccess(evidenceId, evidenceName) {
  const user = getUser();
  const reqs = getRequests();
  if (reqs.find(r => r.evidenceId === evidenceId && r.requesterId === user.id && r.status === 'pending')) {
    toast('Access request already pending', 'info'); return;
  }
  reqs.unshift({
    id: uid(), evidenceId, evidenceName,
    requesterId: user.id, requesterName: user.name, requesterRole: user.role,
    status: 'pending', approvedBy: null, requestedAt: new Date().toISOString()
  });
  saveRequests(reqs);
  addAuditLog('access_request', `${user.name} (${user.role}) requested access to "${evidenceName}"`, evidenceId);
  toast('✅ Access request sent to Court for approval', 'success');
}

function hasAccess(evidenceId) {
  const user = getUser();
  if (!user) return false;
  if (user.role === 'victim') return true;
  if (user.role === 'court') return true;
  // Police and lawyer need court-approved request only
  return getRequests().some(r =>
    r.evidenceId === evidenceId &&
    r.requesterId === user.id &&
    r.status === 'approved' &&
    r.approvedBy === 'court'
  );
}

function getPendingCount() {
  const user = getUser();
  if (!user) return 0;
  // Court sees all pending; police/lawyer see only their own pending
  if (user.role === 'court') return getRequests().filter(r => r.status === 'pending').length;
  return getRequests().filter(r => r.status === 'pending' && r.requesterId === user.id).length;
}

// ── Toast ──────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; c.className = 'toast-container'; document.body.appendChild(c); }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Crypto ─────────────────────────────────────────────────────────
async function sha256(file) {
  const buf = await file.arrayBuffer();
  const h = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function getDeviceInfo() {
  return {
    browser: navigator.userAgent.split(') ')[0].split('(')[1] || 'Unknown',
    platform: navigator.platform,
    language: navigator.language,
    screen: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

// ── Formatters ─────────────────────────────────────────────────────
function fmtDate(iso) { return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
function fileIcon(t) {
  if (!t) return '📄';
  if (t.startsWith('image/')) return '🖼️';
  if (t.startsWith('video/')) return '🎥';
  if (t.startsWith('audio/')) return '🎵';
  if (t === 'application/pdf') return '📑';
  if (t.includes('text')) return '📝';
  return '📦';
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

// ── Evidence Store ─────────────────────────────────────────────────
function getEvidence() { return store.get('lockbox_evidence') || []; }
function saveEvidence(list) { store.set('lockbox_evidence', list); }

// ── Audit ──────────────────────────────────────────────────────────
function getAuditLogs() { return store.get('lockbox_audit') || []; }
function addAuditLog(action, detail, fileId = null) {
  const logs = getAuditLogs();
  const user = getUser();
  logs.unshift({ id: uid(), action, detail, fileId, user: user?.name||'Unknown', role: user?.role||'Unknown', time: new Date().toISOString() });
  // Audit is append-only — never trim or delete
  store.set('lockbox_audit', logs);
}

// ── Notifications ──────────────────────────────────────────────────
function getNotifications() {
  return store.get('lockbox_notifs') || [
    { icon: '📤', msg: 'Evidence uploaded successfully', time: '2 min ago' },
    { icon: '👁️', msg: 'Police requested access to Video.mp4', time: '15 min ago' },
    { icon: '⚖️', msg: 'Lawyer approved for FIR-2024-001', time: '1 hr ago' },
    { icon: '🏛️', msg: 'Court reviewed Medical_Report.pdf', time: '2 hr ago' }
  ];
}

function renderUserBadge() {
  const user = getUser();
  if (!user) return;
  const el = document.getElementById('user-badge');
  if (!el) return;
  const rc = ROLES[user.role] || ROLES.victim;
  el.innerHTML = `
    <div class="avatar">${user.name[0].toUpperCase()}</div>
    <div class="user-info">
      <span>${user.name}</span>
      <small style="color:${rc.color}">${rc.emoji} ${rc.label}</small>
    </div>`;
}

// ── Role-specific Sidebar ──────────────────────────────────────────
function sidebarHTML(activePage) {
  const user = getUser();
  const role = user?.role || 'victim';
  const rc = ROLES[role];
  const pending = getPendingCount();

  const navMap = {
    victim: [
      { page:'dashboard', icon:'📊', label:'Dashboard',       href:'dashboard.html' },
      { page:'upload',    icon:'📤', label:'Upload Evidence', href:'upload.html' },
      { page:'evidence',  icon:'📁', label:'My Evidence',     href:'evidence.html' },
      { page:'fir',       icon:'🧾', label:'FIR Cases',       href:'fir.html' },
      { page:'audit',     icon:'📜', label:'Audit Logs',      href:'audit.html' },
      { page:'settings',  icon:'⚙️', label:'Settings',        href:'settings.html' }
    ],
    police: [
      { page:'dashboard', icon:'📊', label:'Investigation Dashboard', href:'dashboard.html' },
      { page:'evidence',  icon:'🔍', label:'Browse Evidence',         href:'evidence.html' },
      { page:'access',    icon:'🔒', label:'My Requests',             href:'access.html', badge: pending||0 },
      { page:'fir',       icon:'🧾', label:'FIR Cases',               href:'fir.html' },
      { page:'audit',     icon:'📜', label:'Audit Logs',              href:'audit.html' },
      { page:'settings',  icon:'⚙️', label:'Settings',                href:'settings.html' }
    ],
    lawyer: [
      { page:'dashboard', icon:'📊', label:'Legal Dashboard',  href:'dashboard.html' },
      { page:'evidence',  icon:'📁', label:'Case Evidence',    href:'evidence.html' },
      { page:'access',    icon:'🔒', label:'My Requests',      href:'access.html', badge: pending||0 },
      { page:'fir',       icon:'🧾', label:'FIR Cases',        href:'fir.html' },
      { page:'audit',     icon:'📜', label:'Audit Logs',       href:'audit.html' },
      { page:'settings',  icon:'⚙️', label:'Settings',         href:'settings.html' }
    ],
    court: [
      { page:'dashboard', icon:'📊', label:'Court Dashboard',    href:'dashboard.html' },
      { page:'evidence',  icon:'📁', label:'All Evidence',       href:'evidence.html' },
      { page:'fir',       icon:'🧾', label:'FIR Cases',          href:'fir.html' },
      { page:'access',    icon:'🔒', label:'Access Control',     href:'access.html', badge: pending||0 },
      { page:'audit',     icon:'📜', label:'Audit Logs',         href:'audit.html' },
      { page:'settings',  icon:'⚙️', label:'Settings',           href:'settings.html' }
    ]
  };

  const items = navMap[role] || navMap.victim;

  return `
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon">🔒</div>
      <div>
        <span>LockBox</span>
        <small style="color:${rc.color}">${rc.emoji} ${rc.label}</small>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${items.map(item => `
        <a href="${item.href}" class="nav-item ${activePage===item.page?'active':''}" data-page="${item.page}">
          <span class="icon">${item.icon}</span>
          ${item.label}
          ${item.badge ? `<span style="margin-left:auto;background:#ef4444;color:#fff;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700">${item.badge}</span>` : ''}
        </a>`).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="user-badge" id="user-badge"></div>
      <button onclick="logout()" class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px;justify-content:center">
        🚪 Logout
      </button>
    </div>
  </aside>`;
}

// ── Topbar ─────────────────────────────────────────────────────────
function topbarHTML(title, subtitle) {
  return `
  <header class="topbar">
    <div>
      <h1>${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
    </div>
    <div class="topbar-actions" style="position:relative">
      <button class="notif-btn" onclick="toggleNotif()" id="notif-btn">
        🔔 <span class="notif-dot"></span>
      </button>
      <div class="notif-panel" id="notif-panel">
        <div class="notif-panel-header">🔔 Notifications</div>
        ${getNotifications().map(n => `
          <div class="notif-item">
            <span class="notif-icon">${n.icon}</span>
            <div class="notif-msg">${n.msg}<div class="notif-t">${n.time}</div></div>
          </div>`).join('')}
      </div>
    </div>
  </header>`;
}

function toggleNotif() { document.getElementById('notif-panel').classList.toggle('open'); }

document.addEventListener('click', e => {
  const panel = document.getElementById('notif-panel');
  const btn = document.getElementById('notif-btn');
  if (panel && btn && !btn.contains(e.target) && !panel.contains(e.target)) panel.classList.remove('open');
});

