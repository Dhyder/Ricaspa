(() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api = async (path, options={}) => { const r=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options}); const d=await r.json().catch(()=>({})); if(!r.ok) throw Error(d.error||`Request failed (${r.status})`); return d; };
  async function enhance(){
    const me=await api('/api/dashboard-me').catch(()=>null);
    if(me?.user?.role !== 'superuser') return;
    const content=document.querySelector('#content'); if(!content) return;
    if(document.querySelector('#superuser-voucher-panel')) return;
    const d=await api('/api/dashboard-orders').catch(()=>({orders:[]})); const rows=d.orders||[];
    const panel=document.createElement('div'); panel.id='superuser-voucher-panel'; panel.className='panel'; panel.style.marginTop='20px';
    panel.innerHTML=`<div class="panel-head"><div><span class="section-kicker">Superuser tools</span><h2>Voucher cleanup & offline redemption</h2></div><button class="secondary" id="sv-refresh">Refresh</button></div><div class="table-wrap"><table><thead><tr><th>Voucher</th><th>Customer</th><th>State</th><th>Created</th><th>Actions</th></tr></thead><tbody id="sv-body"></tbody></table></div>`;
    content.appendChild(panel);
    const body=panel.querySelector('#sv-body');
    const renderRows=orders=>{body.innerHTML=orders.map(r=>`<tr><td><strong>${esc(r.voucher_code||'—')}</strong></td><td>${esc(r.buyer_name||r.buyer_email||'—')}</td><td><span class="pill">${esc(r.voucher_state||r.payment_state||'—')}</span></td><td>${esc(r.created_at||'—')}</td><td>${r.voucher_code?`<button class="danger sv-redeem" data-code="${esc(r.voucher_code)}">Redeem offline</button>`:''} ${r.voucher_code?`<button class="secondary sv-delete" data-ref="${esc(r.ref)}">Delete</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No voucher orders found.</td></tr>'};
    renderRows(rows);
    panel.addEventListener('click',async e=>{
      const redeem=e.target.closest('.sv-redeem'); const del=e.target.closest('.sv-delete'); if(!redeem&&!del)return;
      if(redeem){ if(!confirm(`Mark ${redeem.dataset.code} as redeemed offline?`))return; try{await api('/api/dashboard-voucher-action',{method:'POST',body:JSON.stringify({action:'redeem',code:redeem.dataset.code})}); await enhance();}catch(x){alert(x.message)} }
      if(del){ if(!confirm('Delete this voucher/order permanently? This is intended for test or clutter entries.'))return; try{await api('/api/dashboard-voucher-action',{method:'POST',body:JSON.stringify({action:'delete',ref:del.dataset.ref})}); await enhance();}catch(x){alert(x.message)} }
    });
    panel.querySelector('#sv-refresh').onclick=()=>{panel.remove();enhance()};
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-section="vouchers"]')) setTimeout(enhance,50)});
})();
