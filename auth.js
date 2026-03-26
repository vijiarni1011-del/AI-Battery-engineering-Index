// Base setField — writes value to DOM element without triggering oninput events
function setField(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  // Guard: don't overwrite SOURCE fields when data is locked
  if (_dataSubmitted && typeof SOURCE_FIELD_IDS !== 'undefined' && SOURCE_FIELD_IDS.includes(id)) return;
  if (el.type === 'checkbox') { el.checked = !!val; }
  else { el.value = val; }
}


// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// MULTI-USER AUTHENTICATION SYSTEM v2
// Pre-seeded users. Admin can add/edit/reset/delete users.
// Passwords stored as SHA-256 hashes in localStorage.
// ════════════════════════════════════════════════════════

const AUTH = {
  async hash(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  },

  USERS_KEY:   'battmis_users_v2',
  SESSION_KEY: 'battmis_session_v1',

  getUsers() {
    try { const r = localStorage.getItem(this.USERS_KEY); return r ? JSON.parse(r) : null; }
    catch(e) { return null; }
  },

  saveUsers(users) {
    try { localStorage.setItem(this.USERS_KEY, JSON.stringify(users)); } catch(e) {}
  },

  // ── Seed all accounts on first load (or force-reset) ──
  async initDefaults(force=false) {
    let users = this.getUsers();
    if (users && !force) return users;

    const seed = [
      { username:'Admin',  password:'May@03051995', displayName:'Administrator', role:'admin'  },
      { username:'User1',  password:'BatteryMIS1',  displayName:'User 1',        role:'user'   },
      { username:'User2',  password:'BatteryMIS2',  displayName:'User 2',        role:'user'   },
      { username:'User3',  password:'BatteryMIS3',  displayName:'User 3',        role:'user'   },
      { username:'User4',  password:'BatteryMIS4',  displayName:'User 4',        role:'user'   },
      { username:'User5',  password:'BatteryMIS5',  displayName:'User 5',        role:'user'   },
    ];

    users = {};
    for (const u of seed) {
      users[u.username] = {
        role:        u.role,
        pwHash:      await this.hash(u.password),
        dataKey:     `battmis_data_${u.username}`,
        created:     Date.now(),
        displayName: u.displayName,
        email:       '',
        active:      true
      };
    }
    this.saveUsers(users);
    return users;
  },

  async login(username, password) {
    const users = this.getUsers();
    if (!users || !users[username]) return {ok:false, msg:'User not found'};
    if (users[username].active === false) return {ok:false, msg:'Account is disabled'};
    const hash = await this.hash(password);
    if (hash !== users[username].pwHash) return {ok:false, msg:'Incorrect password'};
    const session = { username, role: users[username].role,
                      dataKey: users[username].dataKey, loginTime: Date.now() };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return {ok:true, session, user: users[username]};
  },

  getSession() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (Date.now() - s.loginTime > 8 * 3600 * 1000) { this.logout(); return null; }
      return s;
    } catch(e) { return null; }
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    window._appInitDone = false;   // allow initApp to run again on next login
    window._persistHooked = false; // allow hookPersist to re-wrap propagate
    window._propagating = false;   // clear any stuck guard
  },

  async addUser(adminSession, {username, password, displayName, email, role='user'}) {
    if (!adminSession || adminSession.role !== 'admin') return {ok:false, msg:'Admin access required'};
    const users = this.getUsers() || {};
    if (users[username]) return {ok:false, msg:'Username already exists'};
    const pwHash = await this.hash(password);
    users[username] = { role, pwHash, dataKey:`battmis_data_${username}`,
                        created:Date.now(), displayName:displayName||username,
                        email:email||'', active:true };
    this.saveUsers(users);
    return {ok:true, msg:`User '${username}' created`};
  },

  async resetPassword(adminSession, username, newPw) {
    if (!adminSession || adminSession.role !== 'admin') return {ok:false, msg:'Admin access required'};
    const users = this.getUsers() || {};
    if (!users[username]) return {ok:false, msg:'User not found'};
    users[username].pwHash = await this.hash(newPw);
    this.saveUsers(users);
    return {ok:true, msg:`Password reset for '${username}'`};
  },

  updateUser(adminSession, username, {displayName, email, role, active}) {
    if (!adminSession || adminSession.role !== 'admin') return {ok:false, msg:'Admin access required'};
    const users = this.getUsers() || {};
    if (!users[username]) return {ok:false, msg:'User not found'};
    if (displayName !== undefined) users[username].displayName = displayName;
    if (email      !== undefined) users[username].email        = email;
    if (role       !== undefined && username !== 'Admin') users[username].role = role;
    if (active     !== undefined && username !== 'Admin') users[username].active = active;
    this.saveUsers(users);
    return {ok:true};
  },

  removeUser(adminSession, username) {
    if (!adminSession || adminSession.role !== 'admin') return {ok:false, msg:'Admin access required'};
    if (username === 'Admin') return {ok:false, msg:'Cannot delete Admin'};
    const users = this.getUsers() || {};
    delete users[username];
    this.saveUsers(users);
    return {ok:true};
  },

  getUserDataKey() {
    const s = this.getSession();
    return s ? s.dataKey : 'battmis_data_guest';
  }
};

// ── Login modal HTML ──
function showLoginModal() {
  const existing = document.getElementById('login_modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'login_modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(4,8,15,0.97);
    display:flex;align-items:center;justify-content:center;
    font-family:var(--sans,'Barlow',sans-serif);
    background-image:
      radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,212,170,.06) 0%, transparent 60%),
      linear-gradient(rgba(0,212,170,.012) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,212,170,.012) 1px, transparent 1px);
    background-size: auto, 40px 40px, 40px 40px;
  `;
  modal.innerHTML = `
    <div style="background:#080f1c;border:1px solid rgba(0,212,170,.18);border-radius:20px;padding:44px 44px 36px;width:100%;max-width:400px;box-shadow:0 32px 80px rgba(0,0,0,.8),0 0 24px rgba(0,212,170,.08)">
      <div style="text-align:center;margin-bottom:32px">
        <div style="width:60px;height:60px;background:linear-gradient(135deg,rgba(0,212,170,.2),rgba(59,130,246,.2));border:1px solid rgba(0,212,170,.35);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 18px;box-shadow:0 0 24px rgba(0,212,170,.18)">⚡</div>
        <div style="font-size:20px;font-weight:800;color:#dde8f8;letter-spacing:-.3px;font-family:var(--display)">BatteryMIS</div>
        <div style="font-size:12px;font-weight:500;color:#00d4aa;margin-top:3px;opacity:.8">EV Battery Engineering Platform</div>
        <div style="font-size:11px;color:#3a567a;margin-top:10px">Sign in to your workspace</div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:10px;font-family:var(--mono);letter-spacing:.12em;text-transform:uppercase;color:#3a567a;display:block;margin-bottom:6px">USERNAME</label>
        <input id="login_user" placeholder="Enter username" style="width:100%;padding:12px 14px;background:rgba(4,8,15,.8);border:1px solid #1f3856;border-radius:9px;font-size:14px;color:#dde8f8;outline:none;transition:border-color .2s,box-shadow .2s;box-sizing:border-box"
          onfocus="this.style.borderColor='rgba(0,212,170,.5)';this.style.boxShadow='0 0 0 3px rgba(0,212,170,.08)'"
          onblur="this.style.borderColor='#1f3856';this.style.boxShadow='none'" />
      </div>
      <div style="margin-bottom:20px">
        <label style="font-size:10px;font-family:var(--mono);letter-spacing:.12em;text-transform:uppercase;color:#3a567a;display:block;margin-bottom:6px">PASSWORD</label>
        <input id="login_pw" type="password" placeholder="Enter password" style="width:100%;padding:12px 14px;background:rgba(4,8,15,.8);border:1px solid #1f3856;border-radius:9px;font-size:14px;color:#dde8f8;outline:none;transition:border-color .2s,box-shadow .2s;box-sizing:border-box"
          onfocus="this.style.borderColor='rgba(0,212,170,.5)';this.style.boxShadow='0 0 0 3px rgba(0,212,170,.08)'"
          onblur="this.style.borderColor='#1f3856';this.style.boxShadow='none'"
          onkeydown="if(event.key==='Enter')doLogin()" />
      </div>
      <div id="login_err" style="font-size:11px;color:#ef4444;font-family:var(--mono);margin-bottom:12px;display:none;text-align:center"></div>
      <button id="login_btn" onclick="doLogin()" style="width:100%;padding:13px;background:linear-gradient(135deg,#00c49a,#00a882);border:none;border-radius:10px;font-size:13px;font-weight:700;color:#000;cursor:pointer;transition:all .2s;box-shadow:0 4px 20px rgba(0,196,154,.25);letter-spacing:.04em"
        onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 8px 28px rgba(0,196,154,.35)'"
        onmouseout="this.style.transform='';this.style.boxShadow='0 4px 20px rgba(0,196,154,.25)'">
        Sign In →
      </button>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #182840;text-align:center;font-size:10px;color:#3a567a;font-family:var(--mono);display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap">
        Built by <span style="color:#00d4aa;font-weight:700">Viji Venkatesan</span>
        <a href="https://www.linkedin.com/in/viji-venkatesan-262a75167/" target="_blank" rel="noopener"
          style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:5px;background:rgba(10,102,194,.15);border:1px solid rgba(10,102,194,.4);color:#5ba4f5;font-size:11px;font-weight:600;text-decoration:none">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          LinkedIn
        </a>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('login_user')?.focus(), 100);
}



async function doLogin() {
  const btn = document.getElementById('login_btn');
  const err = document.getElementById('login_err');
  const user = document.getElementById('login_user')?.value?.trim() || '';
  const pw   = document.getElementById('login_pw')?.value || '';
  if (!user || !pw) { err.textContent='Please enter username and password'; err.style.display='block'; return; }
  btn.textContent = 'Signing in…'; btn.disabled = true;
  const result = await AUTH.login(user, pw);
  if (result.ok) {
    document.getElementById('login_modal').remove();
    onLoginSuccess(result.session, result.user);
  } else {
    err.textContent = result.msg || 'Login failed';
    err.style.display = 'block';
    btn.textContent = 'Sign In'; btn.disabled = false;
  }
}

function loginAsGuest() {
  document.getElementById('login_modal')?.remove();
  onLoginSuccess({username:'guest', role:'guest', dataKey:'battmis_data_guest', loginTime:Date.now()}, {displayName:'Guest'});
}

function onLoginSuccess(session, user) {
  // Update header user display
  const userEl = document.getElementById('hdr_user');
  if (userEl) {
    userEl.textContent = user.displayName || session.username;
    userEl.style.display = 'flex';
  }
  const roleEl = document.getElementById('hdr_role');
  if (roleEl) roleEl.textContent = session.role === 'admin' ? '⚡ Admin' : '👤 User';

  // Show admin panel button only for admin
  const adminBtn = document.getElementById('hdr_admin_btn');
  if (adminBtn) adminBtn.style.display = session.role === 'admin' ? 'flex' : 'none';

  // Set per-user PERSIST_KEY BEFORE initApp loads the project
  window.PERSIST_KEY = session.dataKey || 'battmis_data_guest';

  // Boot the app (loads project, hooks propagate, runs all calcs, draws canvases)
  if (typeof window.initApp === 'function') window.initApp();
}

// ── Admin Panel ──
function _adminInput(id, placeholder, type='text') {
  return `<input id="${id}" type="${type}" placeholder="${placeholder}" style="width:100%;padding:8px 10px;background:#04080f;border:1px solid #182840;border-radius:6px;color:#dde8f8;font-size:12px;outline:none;box-sizing:border-box"
    onfocus="this.style.borderColor='rgba(0,212,170,.4)'" onblur="this.style.borderColor='#182840'">`;
}

function showAdminPanel() {
  const session = AUTH.getSession();
  if (!session || session.role !== 'admin') { alert('Admin access required'); return; }
  const users = AUTH.getUsers() || {};
  document.getElementById('admin_modal')?.remove();

  const rows = Object.entries(users).map(([uname, u]) => {
    const isAdmin = uname === 'Admin';
    const active  = u.active !== false;
    return `
    <tr id="row_${uname}" style="border-bottom:1px solid #0d1829;transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,.02)'" onmouseout="this.style.background=''">
      <td style="padding:10px 12px;white-space:nowrap">
        <div style="font-weight:600;color:#dde8f8;font-size:13px">${uname}</div>
        <div style="font-size:10px;color:#3a567a;margin-top:2px">${u.email||'no email'}</div>
      </td>
      <td style="padding:10px 12px;color:#6d8fba;font-size:12px">${u.displayName||'—'}</td>
      <td style="padding:10px 12px">
        <span style="padding:3px 8px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:.04em;background:${u.role==='admin'?'rgba(59,130,246,.18)':'rgba(0,212,170,.12)'};color:${u.role==='admin'?'#60a5fa':'#00d4aa'};border:1px solid ${u.role==='admin'?'rgba(59,130,246,.25)':'rgba(0,212,170,.2)'}">
          ${u.role.toUpperCase()}
        </span>
      </td>
      <td style="padding:10px 12px;text-align:center">
        <span style="padding:3px 8px;border-radius:4px;font-size:9px;font-weight:700;background:${active?'rgba(0,212,170,.1)':'rgba(239,68,68,.1)'};color:${active?'#00d4aa':'#ef4444'};border:1px solid ${active?'rgba(0,212,170,.2)':'rgba(239,68,68,.2)'}">
          ${active?'ACTIVE':'DISABLED'}
        </span>
      </td>
      <td style="padding:10px 12px;white-space:nowrap">
        <div style="display:flex;gap:6px;align-items:center">
          <button onclick="adminEditUser('${uname}')" title="Edit user" style="background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.25);color:#60a5fa;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600">✏️ Edit</button>
          <button onclick="adminResetPw('${uname}')" title="Reset password" style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);color:#f59e0b;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600">🔑 Reset PW</button>
          ${!isAdmin ? `<button onclick="adminToggleActive('${uname}',${active})" style="background:${active?'rgba(239,68,68,.1)':'rgba(0,212,170,.1)'};border:1px solid ${active?'rgba(239,68,68,.25)':'rgba(0,212,170,.25)'};color:${active?'#ef4444':'#00d4aa'};padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600">${active?'⛔ Disable':'✅ Enable'}</button>` : ''}
          ${!isAdmin ? `<button onclick="adminDeleteUser('${uname}')" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#ef4444;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600">🗑 Delete</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'admin_modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(4,8,15,.93);display:flex;align-items:center;justify-content:center;font-family:var(--sans);padding:16px';
  modal.innerHTML = `
    <div style="background:#080f1c;border:1px solid rgba(0,212,170,.15);border-radius:18px;padding:28px 28px;width:100%;max-width:860px;max-height:90vh;overflow-y:auto;box-shadow:0 32px 80px rgba(0,0,0,.8),0 0 24px rgba(0,212,170,.06)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
        <div>
          <div style="font-size:18px;font-weight:800;color:#dde8f8;font-family:var(--display)">⚡ Admin Panel</div>
          <div style="font-size:11px;color:#3a567a;margin-top:2px">Manage users, credentials and access control</div>
        </div>
        <button onclick="document.getElementById('admin_modal').remove()" style="background:#0d1829;border:1px solid #1f3856;border-radius:8px;color:#6d8fba;padding:7px 14px;cursor:pointer;font-size:12px;font-weight:600">✕ Close</button>
      </div>

      <!-- User Table -->
      <div style="background:#04080f;border:1px solid #182840;border-radius:12px;overflow:hidden;margin-bottom:24px">
        <div style="padding:12px 16px;border-bottom:1px solid #0d1829;display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:11px;font-weight:700;color:#6d8fba;text-transform:uppercase;letter-spacing:.08em">All Users (${Object.keys(users).length})</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#0a1626">
            <th style="padding:10px 12px;text-align:left;color:#3a567a;font-size:9px;text-transform:uppercase;letter-spacing:.06em">User</th>
            <th style="padding:10px 12px;text-align:left;color:#3a567a;font-size:9px;text-transform:uppercase;letter-spacing:.06em">Display Name</th>
            <th style="padding:10px 12px;text-align:left;color:#3a567a;font-size:9px;text-transform:uppercase;letter-spacing:.06em">Role</th>
            <th style="padding:10px 12px;text-align:center;color:#3a567a;font-size:9px;text-transform:uppercase;letter-spacing:.06em">Status</th>
            <th style="padding:10px 12px;text-align:left;color:#3a567a;font-size:9px;text-transform:uppercase;letter-spacing:.06em">Actions</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <!-- Add New User -->
      <div style="background:#0a1626;border:1px solid #182840;border-radius:12px;padding:20px">
        <div style="font-size:12px;font-weight:700;color:#00d4aa;margin-bottom:16px;text-transform:uppercase;letter-spacing:.08em">+ Add New User</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
          <div><label style="font-size:9px;color:#3a567a;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em">Username</label>
            ${_adminInput('new_uname','e.g. User6')}</div>
          <div><label style="font-size:9px;color:#3a567a;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em">Display Name</label>
            ${_adminInput('new_dname','e.g. User Six')}</div>
          <div><label style="font-size:9px;color:#3a567a;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em">Password</label>
            ${_adminInput('new_pw','Set password','password')}</div>
          <div><label style="font-size:9px;color:#3a567a;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em">Email (optional)</label>
            ${_adminInput('new_email','email@example.com')}</div>
          <div><label style="font-size:9px;color:#3a567a;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em">Role</label>
            <select id="new_role" style="width:100%;padding:8px 10px;background:#04080f;border:1px solid #182840;border-radius:6px;color:#dde8f8;font-size:12px;outline:none">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div id="add_user_msg" style="font-size:11px;margin-bottom:10px;display:none;font-family:var(--mono)"></div>
        <button onclick="adminAddUser()" style="background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;border-radius:8px;color:#fff;padding:10px 22px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(59,130,246,.25)">+ Add User</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// ── Edit user display name / email ──
function adminEditUser(username) {
  const session = AUTH.getSession();
  const users = AUTH.getUsers() || {};
  const u = users[username];
  if (!u) return;
  document.getElementById('edit_modal')?.remove();

  const m = document.createElement('div');
  m.id = 'edit_modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(4,8,15,.85);display:flex;align-items:center;justify-content:center;font-family:var(--sans)';
  m.innerHTML = `
    <div style="background:#080f1c;border:1px solid rgba(0,212,170,.2);border-radius:16px;padding:28px 32px;width:100%;max-width:420px;box-shadow:0 24px 60px rgba(0,0,0,.8)">
      <div style="font-size:16px;font-weight:800;color:#dde8f8;margin-bottom:6px">Edit — ${username}</div>
      <div style="font-size:11px;color:#3a567a;margin-bottom:24px">Update display name, email or role</div>
      <div style="margin-bottom:12px"><label style="font-size:9px;color:#3a567a;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em">Display Name</label>
        <input id="edit_dname" value="${u.displayName||''}" style="width:100%;padding:10px 12px;background:#04080f;border:1px solid #182840;border-radius:8px;color:#dde8f8;font-size:13px;outline:none;box-sizing:border-box"></div>
      <div style="margin-bottom:12px"><label style="font-size:9px;color:#3a567a;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em">Email</label>
        <input id="edit_email" value="${u.email||''}" style="width:100%;padding:10px 12px;background:#04080f;border:1px solid #182840;border-radius:8px;color:#dde8f8;font-size:13px;outline:none;box-sizing:border-box"></div>
      ${username !== 'Admin' ? `<div style="margin-bottom:20px"><label style="font-size:9px;color:#3a567a;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em">Role</label>
        <select id="edit_role" style="width:100%;padding:10px 12px;background:#04080f;border:1px solid #182840;border-radius:8px;color:#dde8f8;font-size:13px;outline:none">
          <option value="user" ${u.role==='user'?'selected':''}>User</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
        </select></div>` : '<div style="height:8px"></div>'}
      <div id="edit_msg" style="font-size:11px;margin-bottom:12px;display:none;font-family:var(--mono)"></div>
      <div style="display:flex;gap:10px">
        <button onclick="doEditUser('${username}')" style="flex:1;background:linear-gradient(135deg,#00c49a,#00a882);border:none;border-radius:8px;color:#000;padding:11px;font-size:12px;font-weight:700;cursor:pointer">Save Changes</button>
        <button onclick="document.getElementById('edit_modal').remove()" style="background:#0d1829;border:1px solid #1f3856;border-radius:8px;color:#6d8fba;padding:11px 18px;font-size:12px;cursor:pointer">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(m);
}

function doEditUser(username) {
  const session = AUTH.getSession();
  const dname = document.getElementById('edit_dname')?.value?.trim();
  const email = document.getElementById('edit_email')?.value?.trim();
  const role  = document.getElementById('edit_role')?.value;
  const msg   = document.getElementById('edit_msg');
  const result = AUTH.updateUser(session, username, {displayName:dname, email, role});
  if (msg) { msg.textContent = result.ok ? '✅ Saved!' : result.msg; msg.style.color = result.ok ? '#00d4aa' : '#ef4444'; msg.style.display = 'block'; }
  if (result.ok) setTimeout(() => { document.getElementById('edit_modal')?.remove(); showAdminPanel(); }, 700);
}

// ── Reset password ──
function adminResetPw(username) {
  document.getElementById('resetpw_modal')?.remove();
  const m = document.createElement('div');
  m.id = 'resetpw_modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(4,8,15,.85);display:flex;align-items:center;justify-content:center;font-family:var(--sans)';
  m.innerHTML = `
    <div style="background:#080f1c;border:1px solid rgba(245,158,11,.2);border-radius:16px;padding:28px 32px;width:100%;max-width:380px;box-shadow:0 24px 60px rgba(0,0,0,.8)">
      <div style="font-size:16px;font-weight:800;color:#dde8f8;margin-bottom:6px">🔑 Reset Password</div>
      <div style="font-size:11px;color:#3a567a;margin-bottom:22px">Set new password for <span style="color:#f59e0b;font-weight:700">${username}</span></div>
      <div style="margin-bottom:16px"><label style="font-size:9px;color:#3a567a;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em">New Password</label>
        <input id="new_reset_pw" type="password" placeholder="Enter new password" style="width:100%;padding:10px 12px;background:#04080f;border:1px solid #182840;border-radius:8px;color:#dde8f8;font-size:13px;outline:none;box-sizing:border-box"
          onkeydown="if(event.key==='Enter')doResetPw('${username}')"></div>
      <div id="resetpw_msg" style="font-size:11px;margin-bottom:12px;display:none;font-family:var(--mono)"></div>
      <div style="display:flex;gap:10px">
        <button onclick="doResetPw('${username}')" style="flex:1;background:linear-gradient(135deg,#f59e0b,#d97706);border:none;border-radius:8px;color:#000;padding:11px;font-size:12px;font-weight:700;cursor:pointer">Reset Password</button>
        <button onclick="document.getElementById('resetpw_modal').remove()" style="background:#0d1829;border:1px solid #1f3856;border-radius:8px;color:#6d8fba;padding:11px 18px;font-size:12px;cursor:pointer">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  setTimeout(() => document.getElementById('new_reset_pw')?.focus(), 80);
}

async function doResetPw(username) {
  const session = AUTH.getSession();
  const pw  = document.getElementById('new_reset_pw')?.value;
  const msg = document.getElementById('resetpw_msg');
  if (!pw || pw.length < 4) { if(msg){msg.textContent='Password too short (min 4 chars)';msg.style.color='#ef4444';msg.style.display='block';} return; }
  const result = await AUTH.resetPassword(session, username, pw);
  if (msg) { msg.textContent = result.ok ? `✅ Password reset for ${username}` : result.msg; msg.style.color = result.ok ? '#00d4aa' : '#ef4444'; msg.style.display = 'block'; }
  if (result.ok) setTimeout(() => { document.getElementById('resetpw_modal')?.remove(); }, 1000);
}

// ── Toggle active/disabled ──
function adminToggleActive(username, currentlyActive) {
  const session = AUTH.getSession();
  AUTH.updateUser(session, username, {active: !currentlyActive});
  showAdminPanel();
}

async function adminAddUser() {
  const session = AUTH.getSession();
  const uname = document.getElementById('new_uname')?.value?.trim();
  const dname = document.getElementById('new_dname')?.value?.trim();
  const pw    = document.getElementById('new_pw')?.value;
  const email = document.getElementById('new_email')?.value?.trim();
  const role  = document.getElementById('new_role')?.value;
  const msg   = document.getElementById('add_user_msg');
  if (!uname || !pw) { if(msg){msg.textContent='Username and password required';msg.style.color='#ef4444';msg.style.display='block';} return; }
  const result = await AUTH.addUser(session, {username:uname, password:pw, displayName:dname, email, role});
  if (msg) { msg.textContent = result.msg; msg.style.color = result.ok ? '#00d4aa' : '#ef4444'; msg.style.display = 'block'; }
  if (result.ok) setTimeout(() => { document.getElementById('admin_modal')?.remove(); showAdminPanel(); }, 800);
}

function adminDeleteUser(username) {
  if (!confirm(`Delete user '${username}'? This cannot be undone.`)) return;
  const session = AUTH.getSession();
  AUTH.removeUser(session, username);
  document.getElementById('admin_modal')?.remove();
  showAdminPanel();
}

// ── Check session on page load ──
async function initAuth() {
  await AUTH.initDefaults();   // seeds users on very first visit
  const session = AUTH.getSession();
  if (!session) {
    showLoginModal();
  } else {
    const users = AUTH.getUsers();
    const user = users?.[session.username] || {displayName: session.username};
    onLoginSuccess(session, user);
  }
}

</script>
