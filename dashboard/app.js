const $ = (s) => document.querySelector(s);
const state = { user: null, section: 'overview' };

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (v) => v == null ? '—' : `KES ${Number(v).toLocaleString()}`;

function shell() {
  document.body.innerHTML = `<div class="app"><aside class="sidebar"><div class="brand"><img src="/dashboard/images/rica-logo.svg" alt="Rica Spa"><span>Rica Spa</span></div><nav id="nav"><button data-section="overview">Overview</button><button data-section="bookings">Bookings</button><button data-section="vouchers">Vouchers</button><button data-section="orders">Orders</button><button data-section="users" class="superuser-only">Staff & Users</button><button data-section="audit" class="superuser-only">Activity</button></nav><div class="side-foot"><span id="role"></span><button id="logout">Sign out</button></div></aside><main><header><div><p class="eyebrow">Rica Spa operations</p><h1 id="title">Overview</h1></div><div class="profile"><span id="who"></span></div></header><section id="content"></section></main></div>`;
  $('#nav').addEventListener('click', e => { const b=e.target.closest('button[data-section]'); if(b){state.section=b.dataset.section; render();} });
  $('#logout').onclick = async () => { await api('/api/dashboard-logout',{method:'POST'}); location.href='/dashboard/login.html'; };
}

async function render() {
  $('#title').textContent = ({overview:'Overview',bookings:'Bookings',vouchers:'Voucher Desk',orders:'Orders',users:'Staff & Users',audit:'Activity Log'})[state.section];
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.section===state.section));
  try {
    if(state.section==='overview') return overview();
    if(state.section==='bookings') return bookings();
    if(state.section==='orders') return orders();
    if(state.section==='users') return users();
    if(state.section==='audit') return audit();
    if(state.section==='vouchers') return vouchers();
  } catch(e) { $('#content').innerHTML=`<div class="notice error">${esc(e.message)}</div>`; }
}

async function overview() {
  const d=await api('/api/dashboard-stats');
  $('#content').innerHTML=`<div class="cards">${[['Bookings',d.bookings ?? d.totalBookings ?? 0],['Pending',d.pending ?? d.pendingBookings ?? 0],['Orders',d.orders ?? d.totalOrders ?? 0],['Revenue',money(d.revenue ?? d.totalRevenue ?? 0)]].map(x=>`<article class="card"><span>${x[0]}</span><strong>${x[1]}</strong></article>`).join('')}</div><div class="panel"><h2>Welcome back, ${esc(state.user.name)}</h2><p>You are signed in as <b>${esc(state.user.role)}</b>. All approvals, redemptions and administrative actions are attributed to your account.</p></div>`;
}

async function bookings() {
  const d=await api('/api/dashboard-bookings'); const rows=d.bookings||d.results||[];
  $('#content').innerHTML=`<div class="panel"><div class="panel-head"><h2>Booking requests</h2><button class="secondary" onclick="render()">Refresh</button></div><div class="table-wrap"><table><thead><tr><th>Guest</th><th>Service</th><th>Date</th><th>Time</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name||r.full_name)}</td><td>${esc(r.service)}</td><td>${esc(r.date)}</td><td>${esc(r.time)}</td><td><span class="pill">${esc(r.status)}</span></td><td><select onchange="bookingStatus('${esc(r.ref)}',this.value)"><option value="">Update…</option><option>confirmed</option><option>declined</option><option>completed</option><option>no-show</option></select></td></tr>`).join('')||'<tr><td colspan="6">No bookings found.</td></tr>'}</tbody></table></div></div>`;
}
window.bookingStatus=async(ref,status)=>{if(!status)return;try{await api('/api/update-booking-status',{method:'POST',body:JSON.stringify({ref,status})});await render();}catch(e){alert(e.message)}};

async function orders(){const d=await api('/api/dashboard-orders');const rows=d.orders||d.results||[];$('#content').innerHTML=`<div class="panel"><h2>Voucher orders</h2><div class="table-wrap"><table><thead><tr><th>Reference</th><th>Customer</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.ref||r.reference)}</td><td>${esc(r.email||r.customer_email)}</td><td>${money(r.amount)}</td><td><span class="pill">${esc(r.status)}</span></td><td>${esc(r.created_at)}</td></tr>`).join('')||'<tr><td colspan="5">No orders found.</td></tr>'}</tbody></table></div></div>`}

function vouchers(){$('#content').innerHTML=`<div class="grid-two"><div class="panel"><h2>Look up voucher</h2><form id="voucher-form"><label>Voucher code<input name="code" placeholder="RICA-XXXX-XXXX" required></label><button>Look up</button></form><div id="voucher-result"></div></div><div class="panel"><h2>Redeem</h2><p>Verify the code with the customer, then redeem it. The redemption is recorded against your staff account.</p><button id="redeem" class="danger" disabled>Redeem voucher</button></div></div>`;let current=null;$('#voucher-form').onsubmit=async e=>{e.preventDefault();try{const code=new FormData(e.target).get('code');const d=await api('/api/redeem-voucher',{method:'POST',body:JSON.stringify({code,action:'lookup'})});current=d.voucher;$('#voucher-result').innerHTML=`<div class="voucher"><b>${esc(current.code||code)}</b><span>Status: ${esc(current.status)}</span><span>Service: ${esc(current.service||current.serviceName||'Voucher')}</span><span>Value: ${money(current.amount||current.value)}</span></div>`;$('#redeem').disabled=current.status==='redeemed';}catch(x){$('#voucher-result').innerHTML=`<div class="notice error">${esc(x.message)}</div>`}};$('#redeem').onclick=async()=>{if(!current)return;try{await api('/api/redeem-voucher',{method:'POST',body:JSON.stringify({code:current.code,action:'redeem'})});alert('Voucher redeemed.');current=null;$('#redeem').disabled=true;}catch(x){alert(x.message)}}}

async function users(){if(state.user.role!=='superuser'){return $('#content').innerHTML='<div class="notice error">Superuser access required.</div>'}const d=await api('/api/dashboard-users');$('#content').innerHTML=`<div class="grid-two"><div class="panel"><h2>Add staff</h2><form id="user-form"><label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Password<input name="password" type="password" minlength="8" required></label><label>Role<select name="role"><option value="employee">Staff</option><option value="superuser">Superuser</option></select></label><button>Create account</button></form></div><div class="panel"><h2>People with access</h2><div class="user-list">${(d.users||[]).map(u=>`<div class="user-row"><div><b>${esc(u.name)}</b><small>${esc(u.email)}</small></div><div><span class="pill">${esc(u.role)}</span><select onchange="userStatus('${esc(u.id)}',this.value)"><option>${esc(u.status)}</option><option>active</option><option>disabled</option><option>pending</option></select></div></div>`).join('')}</div></div></div>`;$('#user-form').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));try{await api('/api/dashboard-users',{method:'POST',body:JSON.stringify(o)});await users();}catch(x){alert(x.message)}}}
window.userStatus=async(id,status)=>{try{await api('/api/dashboard-users',{method:'PATCH',body:JSON.stringify({id,status})});await users()}catch(e){alert(e.message)}};

async function audit(){const d=await api('/api/dashboard-audit');$('#content').innerHTML=`<div class="panel"><div class="panel-head"><h2>Who did what</h2><button class="secondary" onclick="render()">Refresh</button></div><div class="table-wrap"><table><thead><tr><th>When</th><th>Staff member</th><th>Action</th><th>Entity</th></tr></thead><tbody>${(d.events||[]).map(a=>`<tr><td>${esc(a.created_at)}</td><td>${esc(a.user_name||'System')}</td><td>${esc(a.action)}</td><td>${esc(a.entity_type||'')} ${esc(a.entity_id||'')}</td></tr>`).join('')||'<tr><td colspan="4">No activity yet.</td></tr>'}</tbody></table></div></div>`}

(async()=>{try{const d=await api('/api/dashboard-me');state.user=d.user;shell();$('#who').textContent=state.user.name;$('#role').textContent=state.user.role==='superuser'?'Superuser':'Staff';if(state.user.role!=='superuser')document.querySelectorAll('.superuser-only').forEach(x=>x.remove());await render();}catch(e){location.href='/dashboard/login.html';}})();
