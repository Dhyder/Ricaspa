/* Ricaspa dashboard shell adaptation of the supplied shadcn-admin template. */
(()=>{
  const boot=()=>{
    const app=document.querySelector('.app'), sidebar=document.querySelector('.sidebar'), header=document.querySelector('.app header');
    if(!app||!sidebar||!header||document.querySelector('[data-template-sidebar-toggle]')) return;
    const toggle=document.createElement('button');
    toggle.type='button'; toggle.dataset.templateSidebarToggle='1'; toggle.className='template-sidebar-toggle'; toggle.setAttribute('aria-label','Toggle sidebar');
    toggle.innerHTML='<span></span><span></span><span></span>';
    sidebar.prepend(toggle);
    const saved=localStorage.getItem('rica-sidebar-collapsed')==='1';
    if(saved) app.classList.add('sidebar-collapsed');
    toggle.onclick=()=>{const collapsed=app.classList.toggle('sidebar-collapsed');localStorage.setItem('rica-sidebar-collapsed',collapsed?'1':'0')};
    const markActive=()=>document.querySelectorAll('[data-section]').forEach(el=>el.classList.toggle('template-active',el.dataset.section===window.__ricaSection));
    const observer=new MutationObserver(markActive); observer.observe(sidebar,{subtree:true,childList:true}); markActive();
    window.addEventListener('resize',()=>{if(innerWidth<768) app.classList.remove('sidebar-collapsed')});
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();